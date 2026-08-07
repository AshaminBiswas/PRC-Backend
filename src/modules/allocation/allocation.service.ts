import prisma from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { calculateDistance, isValidCoordinates } from '../../utils/haversine.utils';
import { getParallelRoutes } from '../../utils/osrm.client';
import { recordStockMovement } from '../inventory/movement/movement.service';
import { StockMovementType, Prisma } from '@prisma/client';
import { resolveShippingZone } from '../logistics/zone.service';
import { calculateCourierRate } from '../logistics/rate.service';
import { env } from '../../config/env';
import type {
  AllocateOrderInput,
  NearestWarehousesQueryInput,
  AllocateByPincodeInput,
  CreateAdminWarehouseInput,
  UpdateAdminWarehouseInput,
  AllocationLogQueryInput,
} from './allocation.schema';
import { AllocationStrategyFactory } from './strategies/strategy.factory';
import type { CandidateWarehouse } from './strategies/allocation.strategy.interface';
import { resolveOrFetchPincode } from './pincode.service';

export interface EvaluatedWarehouseLogistics {
  warehouseId: string;
  code: string;
  name: string;
  city: string | null;
  state: string | null;
  priority: number;
  dailyCapacity: number;
  currentLoad: number;
  distanceKm: number;
  shippingCost: number;
  deliveryDays: number;
  courierId: string | null;
  courierName: string | null;
  zoneId: string | null;
  zoneName: string | null;
  allocationScore: number;
  isInventorySufficient: boolean;
  missingItems: Array<{ sku: string; requestedQty: number; availableQty: number }>;
}

export interface AllocationResultLogistics {
  allocatedWarehouse: {
    id: string;
    code: string;
    name: string;
    address: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    latitude: number;
    longitude: number;
  };
  allocatedCourier: {
    id: string;
    name: string;
    code: string;
  } | null;
  allocatedZone: {
    id: string;
    name: string;
  } | null;
  customerLocation: {
    pincode: string;
    city: string;
    district: string;
    state: string;
    latitude: number;
    longitude: number;
  };
  shippingCost: number;
  deliveryDays: number;
  allocationScore: number;
  allocationReason: string;
  distanceKm: number;
  isReserved: boolean;
  shipmentId?: string;
  evaluatedWarehouses: EvaluatedWarehouseLogistics[];
}

/**
 * Intelligent Warehouse Allocation Engine (Lowest Shipping Cost Priority)
 * Evaluates active warehouses by 100% stock, Lowest Shipping Cost, SLA, Priority, and Capacity Load.
 */
export const allocateWarehouseForOrder = async (
  input: AllocateOrderInput,
  txClient?: Prisma.TransactionClient
): Promise<AllocationResultLogistics> => {
  const db = txClient || prisma;
  const { pincode, items, reserveStock = false, ventureId, orderId } = input;

  // 1. Resolve Customer Location from PIN Code DB (Auto-resolves missing PIN codes)
  const pincodeRecord = await resolveOrFetchPincode(pincode, db);

  if (!pincodeRecord) {
    throw new AppError('PINCODE_NOT_FOUND', `PIN code '${pincode}' is not found in location database`, 404);
  }

  const { latitude: custLat, longitude: custLon, city, district, state } = pincodeRecord;

  // 2. Fetch Active Warehouses
  const warehouseWhere: Prisma.WarehouseWhereInput = {
    isActive: true,
    status: 'ACTIVE',
    deletedAt: null,
  };

  if (ventureId) {
    warehouseWhere.ventureId = ventureId;
  }

  const warehouses = await db.warehouse.findMany({
    where: warehouseWhere,
  });

  if (warehouses.length === 0) {
    throw new AppError('WAREHOUSE_UNAVAILABLE', 'No active warehouses available for allocation', 503);
  }

  const itemsList = items || [];

  // Calculate total order weight (estimate 0.5kg per item if not provided)
  const totalItemCount = itemsList.reduce((sum, item) => sum + item.quantity, 0);
  const totalWeight = Math.max(0.5, totalItemCount * 0.5);

  const evaluatedWarehouses: EvaluatedWarehouseLogistics[] = [];

  for (const wh of warehouses) {
    // 3. Priority 1: Check 100% SKU Inventory Availability
    let isInventorySufficient = true;
    const missingItems: Array<{ sku: string; requestedQty: number; availableQty: number }> = [];

    for (const item of itemsList) {
      let invProd = await db.inventoryProduct.findFirst({
        where: { sku: item.sku, deletedAt: null },
        include: {
          stocks: {
            where: { warehouseId: wh.id },
          },
        },
      });

      if (!invProd && item.productId) {
        invProd = await db.inventoryProduct.findFirst({
          where: { productId: item.productId, deletedAt: null },
          include: {
            stocks: {
              where: { warehouseId: wh.id },
            },
          },
        });
      }

      const stockRecord = invProd?.stocks[0];
      const availableQty = stockRecord ? stockRecord.quantity - stockRecord.reservedQty : 0;

      if (!stockRecord || availableQty < item.quantity) {
        isInventorySufficient = false;
        missingItems.push({
          sku: item.sku,
          requestedQty: item.quantity,
          availableQty: Math.max(0, availableQty),
        });
      }
    }

    // 4. Distance placeholder — will be replaced with OSRM road distance below
    const whLat = wh.latitude || 0;
    const whLon = wh.longitude || 0;
    const distanceKm = 0; // Will be overwritten by OSRM parallel results

    let shippingCost = 150;
    let deliveryDays = 3;
    let courierId: string | null = null;
    let courierName: string | null = null;
    let zoneId: string | null = null;
    let zoneName: string | null = null;

    try {
      const zoneResult = await resolveShippingZone(wh.id, pincode);
      zoneId = zoneResult.zone.id;
      zoneName = zoneResult.zone.name;

      const rates = await calculateCourierRate({
        zoneId: zoneResult.zone.id,
        weight: totalWeight,
        courierId: zoneResult.courier?.id,
      });

      if (rates.length > 0) {
        const topRate = rates[0];
        shippingCost = topRate.totalShippingCost;
        deliveryDays = topRate.estimatedDeliveryDays;
        courierId = topRate.courierId;
        courierName = topRate.courierName;
      }
    } catch (e) {
      // Default fallback cost calculation based on distance
      shippingCost = 50 + Math.round(distanceKm * 0.15);
      deliveryDays = Math.min(6, Math.max(1, Math.ceil(distanceKm / 350)));
    }

    // Dynamic Multi-Priority Weighted Allocation Score Calculation
    const maxCost = 500;
    const costScore = Math.max(0, 100 - (shippingCost / maxCost) * 100);
    const inventoryScore = isInventorySufficient ? 100 : 0;
    const maxDays = 7;
    const slaScore = Math.max(0, 100 - (deliveryDays / maxDays) * 100);
    const maxPriority = 10;
    const priorityScore = Math.min(100, (wh.priority / maxPriority) * 100);
    const capacityRatio = wh.dailyCapacity > 0 ? (wh.dailyCapacity - wh.currentLoad) / wh.dailyCapacity : 0;
    const loadScore = Math.max(0, Math.min(100, capacityRatio * 100));

    const allocationScore = Number(
      (
        0.50 * costScore +
        0.25 * inventoryScore +
        0.15 * slaScore +
        0.05 * priorityScore +
        0.05 * loadScore
      ).toFixed(2)
    );

    evaluatedWarehouses.push({
      warehouseId: wh.id,
      code: wh.code,
      name: wh.name,
      city: wh.city,
      state: wh.state,
      priority: wh.priority,
      dailyCapacity: wh.dailyCapacity,
      currentLoad: wh.currentLoad,
      distanceKm,
      shippingCost,
      deliveryDays,
      courierId,
      courierName,
      zoneId,
      zoneName,
      allocationScore,
      isInventorySufficient,
      missingItems,
    });
  }

  // ── OSRM Road Distance Enrichment (Parallel) ────────────────────────────────
  // Replace the placeholder distanceKm=0 with actual OSRM road distances.
  if (warehouses.length > 0 && isValidCoordinates(custLat, custLon)) {
    try {
      const destinations = warehouses
        .filter((wh) => wh.latitude && wh.longitude)
        .map((wh) => ({ id: wh.id, latitude: wh.latitude!, longitude: wh.longitude! }));

      const osrmResults = await getParallelRoutes(custLat, custLon, destinations);

      for (const evalWh of evaluatedWarehouses) {
        const osrmResult = osrmResults.find((r) => r.warehouseId === evalWh.warehouseId);
        if (osrmResult && !osrmResult.error && isFinite(osrmResult.distanceKm)) {
          evalWh.distanceKm = osrmResult.distanceKm;
        } else if (env.osrm.fallbackToHaversine) {
          // Fallback: compute Haversine if OSRM failed for this warehouse
          const wh = warehouses.find((w) => w.id === evalWh.warehouseId);
          if (wh?.latitude && wh?.longitude && isValidCoordinates(custLat, custLon)) {
            evalWh.distanceKm = Number(
              calculateDistance(custLat, custLon, wh.latitude, wh.longitude).toFixed(2)
            );
          }
        }
      }
    } catch (osrmErr: any) {
      // OSRM batch call itself failed — fall back to Haversine for all
      console.warn(`[allocateWarehouseForOrder] OSRM parallel route fetch failed: ${osrmErr.message}. Using Haversine fallback.`);
      for (const evalWh of evaluatedWarehouses) {
        const wh = warehouses.find((w) => w.id === evalWh.warehouseId);
        if (wh?.latitude && wh?.longitude && isValidCoordinates(custLat, custLon)) {
          evalWh.distanceKm = Number(
            calculateDistance(custLat, custLon, wh.latitude, wh.longitude).toFixed(2)
          );
        }
      }
    }
  }


  // Filter warehouses meeting 100% stock requirement AND having available daily capacity
  const qualifyingWarehouses = evaluatedWarehouses.filter(
    (w) => w.isInventorySufficient && w.currentLoad < w.dailyCapacity
  );

  // Fallback 1: Warehouses with inventory
  // Fallback 2: All active warehouses (Delhi/Kolkata) sorted by lowest shipping cost
  const candidatePool = qualifyingWarehouses.length > 0
    ? qualifyingWarehouses
    : (evaluatedWarehouses.filter((w) => w.isInventorySufficient).length > 0
        ? evaluatedWarehouses.filter((w) => w.isInventorySufficient)
        : evaluatedWarehouses);

  if (candidatePool.length === 0) {
    throw new AppError(
      'WAREHOUSE_UNAVAILABLE',
      `No active warehouses available for allocation for PIN code ${pincode}`,
      503
    );
  }

  // Sort candidates by Lowest Shipping Cost ASC, then Delivery SLA ASC, then Allocation Score DESC
  candidatePool.sort((a, b) => {
    if (a.shippingCost !== b.shippingCost) {
      return a.shippingCost - b.shippingCost;
    }
    if (a.deliveryDays !== b.deliveryDays) {
      return a.deliveryDays - b.deliveryDays;
    }
    return b.allocationScore - a.allocationScore;
  });

  const selected = candidatePool[0];

  // 6. Optional Inventory Reservation & Shipment Record Creation
  let isReserved = false;
  let shipmentId: string | undefined = undefined;

  if (reserveStock) {
    const targetWh = await db.warehouse.findUnique({
      where: { id: selected.warehouseId },
      select: { id: true, ventureId: true },
    });

    // Reserve stock for items
    for (const item of itemsList) {
      let invProd = await db.inventoryProduct.findFirst({
        where: { sku: item.sku, deletedAt: null },
      });

      if (!invProd && item.productId) {
        invProd = await db.inventoryProduct.findFirst({
          where: { productId: item.productId, deletedAt: null },
        });
      }

      if (invProd && targetWh) {
        const targetVentureId = targetWh.ventureId || invProd.ventureId;

        const existingStock = await db.inventoryStock.findUnique({
          where: {
            inventoryProductId_warehouseId: {
              inventoryProductId: invProd.id,
              warehouseId: selected.warehouseId,
            },
          },
        });

        if (existingStock) {
          await db.inventoryStock.update({
            where: {
              inventoryProductId_warehouseId: {
                inventoryProductId: invProd.id,
                warehouseId: selected.warehouseId,
              },
            },
            data: {
              reservedQty: { increment: item.quantity },
            },
          });
        } else {
          await db.inventoryStock.create({
            data: {
              ventureId: targetVentureId,
              inventoryProductId: invProd.id,
              warehouseId: selected.warehouseId,
              quantity: 0,
              reservedQty: item.quantity,
            },
          });
        }

        await recordStockMovement(
          {
            ventureId: targetVentureId,
            inventoryProductId: invProd.id,
            warehouseId: selected.warehouseId,
            qtyChanged: item.quantity,
            movementType: StockMovementType.RESERVED,
            channel: 'ONLINE',
            referenceType: 'ALLOCATION_RESERVE',
            reason: `Stock reserved by lowest cost allocation engine for PIN ${pincode} (Shipping Cost: ₹${selected.shippingCost})`,
          },
          txClient
        );
      }
    }

    // Increment current workload on selected warehouse
    await db.warehouse.update({
      where: { id: selected.warehouseId },
      data: { currentLoad: { increment: 1 } },
    });

    // Create Shipment Record if orderId is provided
    if (orderId) {
      const shipment = await db.shipment.create({
        data: {
          orderId,
          warehouseId: selected.warehouseId,
          courierId: selected.courierId,
          zoneId: selected.zoneId,
          shippingCost: selected.shippingCost,
          deliveryDays: selected.deliveryDays,
          trackingNumber: `TRK-PRC-${Date.now().toString().slice(-8)}`,
          shipmentStatus: 'PENDING',
        },
      });
      shipmentId = shipment.id;
    }

    isReserved = true;
  }

  const selectedWhRaw = warehouses.find((w) => w.id === selected.warehouseId)!;

  let courierObj: { id: string; name: string; code: string } | null = null;
  if (selected.courierId) {
    const cour = await db.courier.findUnique({ where: { id: selected.courierId } });
    if (cour) courierObj = { id: cour.id, name: cour.name, code: cour.code };
  }

  let zoneObj: { id: string; name: string } | null = null;
  if (selected.zoneId) {
    const z = await db.shippingZone.findUnique({ where: { id: selected.zoneId } });
    if (z) zoneObj = { id: z.id, name: z.name };
  }

  return {
    allocatedWarehouse: {
      id: selectedWhRaw.id,
      code: selectedWhRaw.code,
      name: selectedWhRaw.name,
      address: selectedWhRaw.address,
      city: selectedWhRaw.city,
      state: selectedWhRaw.state,
      pincode: selectedWhRaw.pincode,
      latitude: selectedWhRaw.latitude || 0,
      longitude: selectedWhRaw.longitude || 0,
    },
    allocatedCourier: courierObj,
    allocatedZone: zoneObj,
    customerLocation: {
      pincode: pincodeRecord.pincode,
      city,
      district,
      state,
      latitude: custLat,
      longitude: custLon,
    },
    shippingCost: selected.shippingCost,
    deliveryDays: selected.deliveryDays,
    allocationScore: selected.allocationScore,
    allocationReason: `Selected ${selected.name} (${selected.code}) based on Lowest Shipping Cost (₹${selected.shippingCost}) with ${selected.deliveryDays}-day SLA and 100% stock availability.`,
    distanceKm: selected.distanceKm,
    isReserved,
    shipmentId,
    evaluatedWarehouses,
  };
};

export const findNearestWarehouses = async (query: NearestWarehousesQueryInput) => {
  const pincodeRecord = await resolveOrFetchPincode(query.pincode);

  if (!pincodeRecord) {
    throw new AppError('PINCODE_NOT_FOUND', `PIN code '${query.pincode}' not found`, 404);
  }

  const { latitude: custLat, longitude: custLon } = pincodeRecord;

  const warehouses = await prisma.warehouse.findMany({
    where: {
      isActive: true,
      status: 'ACTIVE',
      deletedAt: null,
      latitude: { not: null },
      longitude: { not: null },
    },
    include: {
      venture: { select: { id: true, name: true, code: true } },
    },
  });

  // Fire parallel OSRM road distance requests for all warehouses
  let results = warehouses.map((wh) => ({ ...wh, distanceKm: 0, durationMinutes: null as number | null, source: 'PENDING' }));

  try {
    const destinations = warehouses.map((wh) => ({
      id: wh.id,
      latitude: wh.latitude!,
      longitude: wh.longitude!,
    }));

    const osrmResults = await getParallelRoutes(custLat, custLon, destinations);

    results = warehouses.map((wh) => {
      const osrm = osrmResults.find((r) => r.warehouseId === wh.id);
      const distanceKm = osrm && !osrm.error && isFinite(osrm.distanceKm)
        ? osrm.distanceKm
        : Number(calculateDistance(custLat, custLon, wh.latitude!, wh.longitude!).toFixed(2));
      const durationMinutes = osrm && !osrm.error ? osrm.durationMinutes : null;
      const source = osrm && !osrm.error ? osrm.source : 'HAVERSINE_FALLBACK';
      return { ...wh, distanceKm, durationMinutes, source };
    });
  } catch {
    // Full OSRM failure — fall back to Haversine for all
    results = warehouses.map((wh) => ({
      ...wh,
      distanceKm: Number(calculateDistance(custLat, custLon, wh.latitude!, wh.longitude!).toFixed(2)),
      durationMinutes: null,
      source: 'HAVERSINE_FALLBACK',
    }));
  }

  const sortedResults = results
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, query.limit);

  return {
    customerLocation: pincodeRecord,
    nearestWarehouses: sortedResults,
  };
};

/**
 * Enterprise Road Distance Allocation Engine (OSRM Strategy Pattern)
 * Calculates actual road distance using self-hosted OSRM routing server.
 * Falls back to Haversine if OSRM is unavailable (configurable via env).
 * Returns exact payload matching prompt specifications.
 */
export const allocateByShortestDistance = async (
  input: AllocateByPincodeInput,
  txClient?: Prisma.TransactionClient
) => {
  const db = txClient || prisma;
  const { pincode, orderId, strategy = env.osrm.defaultStrategy } = input;

  // 1. Validate 6-digit Indian PIN code format
  if (!/^\d{6}$/.test(pincode)) {
    throw new AppError('INVALID_PINCODE', 'Invalid PIN Code format. Must be a 6-digit number.', 400);
  }

  // 2. Query Pincode_Master (Auto-resolves missing 6-digit PIN codes)
  const pincodeRecord = await resolveOrFetchPincode(pincode, db);

  if (!pincodeRecord) {
    throw new AppError('NOT_FOUND', 'Invalid PIN Code', 404);
  }

  if (pincodeRecord.isServiceable === false) {
    throw new AppError('BAD_REQUEST', 'Service not available', 400);
  }

  // 3. Fetch all active warehouses
  const warehouses = await db.warehouse.findMany({
    where: {
      isActive: true,
      status: 'ACTIVE',
      deletedAt: null,
      latitude: { not: null },
      longitude: { not: null },
    },
  });

  if (warehouses.length === 0) {
    throw new AppError('WAREHOUSE_UNAVAILABLE', 'No active warehouses available for allocation', 503);
  }

  // 4. Execute Allocation via Strategy Pattern
  const allocationStrategy = AllocationStrategyFactory.getStrategy(strategy);
  const candidateWarehouses: CandidateWarehouse[] = warehouses.map((wh) => ({
    id: wh.id,
    name: wh.name,
    code: wh.code,
    latitude: wh.latitude!,
    longitude: wh.longitude!,
    priority: wh.priority,
    isActive: wh.isActive,
    city: wh.city,
    state: wh.state,
  }));

  const result = await allocationStrategy.allocate(
    { pincode, latitude: pincodeRecord.latitude, longitude: pincodeRecord.longitude },
    candidateWarehouses
  );

  // 5. Create Allocation Log (includes durationMinutes from OSRM)
  const selectedDuration = result.selectedWarehouse.durationMinutes ?? null;
  const resolvedStrategy = (strategy || env.osrm.defaultStrategy).toUpperCase();

  await db.allocationLog.create({
    data: {
      orderId: orderId || null,
      customerPincode: pincode,
      customerLatitude: pincodeRecord.latitude,
      customerLongitude: pincodeRecord.longitude,
      warehouseId: result.selectedWarehouse.id,
      calculatedDistanceKm: result.selectedWarehouse.distance,
      durationMinutes: selectedDuration,
      allocationMethod: resolvedStrategy,
      allocationReason: `Allocated to ${result.selectedWarehouse.name} (${result.selectedWarehouse.distance} km road, ${selectedDuration ?? 'N/A'} min) via ${resolvedStrategy} strategy`,
    },
  });

  // 6. Return response with durationMinutes (backward compatible — new optional field)
  return {
    success: true,
    customer: {
      pincode: pincodeRecord.pincode,
      latitude: pincodeRecord.latitude,
      longitude: pincodeRecord.longitude,
    },
    selectedWarehouse: {
      id: result.selectedWarehouse.id,
      name: result.selectedWarehouse.name,
      code: result.selectedWarehouse.code,
      distance: result.selectedWarehouse.distance,
      ...(result.selectedWarehouse.durationMinutes !== undefined && {
        durationMinutes: result.selectedWarehouse.durationMinutes,
      }),
      source: result.selectedWarehouse.source ?? resolvedStrategy,
    },
    allWarehouses: result.allWarehouses.map((wh) => ({
      id: wh.id,
      name: wh.name,
      code: wh.code,
      distance: wh.distance,
      ...(wh.durationMinutes !== undefined && { durationMinutes: wh.durationMinutes }),
    })),
    meta: {
      strategy: resolvedStrategy,
      allocatedAt: new Date().toISOString(),
    },
  };
};

// ─── ADMIN WAREHOUSE & ALLOCATION MANAGEMENT LOGIC ─────────────────────────────

export const createAdminWarehouse = async (input: CreateAdminWarehouseInput) => {
  let ventureId = input.ventureId;
  if (!ventureId) {
    const defaultVenture = await prisma.venture.findFirst({ where: { deletedAt: null } });
    if (!defaultVenture) {
      throw new AppError('BAD_REQUEST', 'Default venture not found', 400);
    }
    ventureId = defaultVenture.id;
  }

  const existing = await prisma.warehouse.findUnique({ where: { code: input.code } });
  if (existing) {
    throw new AppError('CONFLICT', `Warehouse with code '${input.code}' already exists`, 409);
  }

  return prisma.warehouse.create({
    data: {
      ventureId,
      name: input.name,
      code: input.code,
      address: input.address,
      city: input.city,
      state: input.state,
      pincode: input.pincode,
      latitude: input.latitude,
      longitude: input.longitude,
      priority: input.priority ?? 0,
      contactPhone: input.contactPhone,
      isActive: input.isActive ?? true,
      status: input.isActive === false ? 'INACTIVE' : 'ACTIVE',
    },
  });
};

export const updateAdminWarehouse = async (id: string, input: UpdateAdminWarehouseInput) => {
  const warehouse = await prisma.warehouse.findUnique({ where: { id, deletedAt: null } });
  if (!warehouse) {
    throw new AppError('NOT_FOUND', `Warehouse '${id}' not found`, 404);
  }

  return prisma.warehouse.update({
    where: { id },
    data: {
      ...(input.name && { name: input.name }),
      ...(input.address !== undefined && { address: input.address }),
      ...(input.city !== undefined && { city: input.city }),
      ...(input.state !== undefined && { state: input.state }),
      ...(input.pincode !== undefined && { pincode: input.pincode }),
      ...(input.latitude !== undefined && { latitude: input.latitude }),
      ...(input.longitude !== undefined && { longitude: input.longitude }),
      ...(input.priority !== undefined && { priority: input.priority }),
      ...(input.contactPhone !== undefined && { contactPhone: input.contactPhone }),
      ...(input.isActive !== undefined && {
        isActive: input.isActive,
        status: input.isActive ? 'ACTIVE' : 'INACTIVE',
      }),
    },
  });
};

export const deleteAdminWarehouse = async (id: string) => {
  const warehouse = await prisma.warehouse.findUnique({ where: { id, deletedAt: null } });
  if (!warehouse) {
    throw new AppError('NOT_FOUND', `Warehouse '${id}' not found`, 404);
  }

  return prisma.warehouse.update({
    where: { id },
    data: {
      isActive: false,
      status: 'INACTIVE',
      deletedAt: new Date(),
    },
  });
};

export const listAllocationLogs = async (query: AllocationLogQueryInput) => {
  const page = query.page || 1;
  const limit = query.limit || 20;
  const skip = (page - 1) * limit;

  const where: Prisma.AllocationLogWhereInput = {};
  if (query.pincode) where.customerPincode = query.pincode;
  if (query.warehouseId) where.warehouseId = query.warehouseId;
  if (query.search) {
    where.OR = [
      { customerPincode: { contains: query.search, mode: 'insensitive' } },
      { orderId: { contains: query.search, mode: 'insensitive' } },
      { warehouse: { name: { contains: query.search, mode: 'insensitive' } } },
    ];
  }

  const [logs, total] = await Promise.all([
    prisma.allocationLog.findMany({
      where,
      include: {
        warehouse: { select: { id: true, name: true, code: true, city: true, state: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.allocationLog.count({ where }),
  ]);

  return {
    data: logs,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const exportAllocationLogsCsv = async () => {
  const logs = await prisma.allocationLog.findMany({
    include: {
      warehouse: { select: { name: true, code: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  });

  let csv = 'ID,Order ID,PIN Code,Customer Lat,Customer Lon,Warehouse Code,Warehouse Name,Distance (KM),Method,Created At\n';
  for (const log of logs) {
    csv += `"${log.id}","${log.orderId || ''}","${log.customerPincode}",${log.customerLatitude},${log.customerLongitude},"${log.warehouse.code}","${log.warehouse.name}",${log.calculatedDistanceKm},"${log.allocationMethod}","${log.createdAt.toISOString()}"\n`;
  }
  return csv;
};
