import prisma from '../../config/database';
import { AppError } from '../../middleware/error.middleware';

export interface CalculatedShippingRate {
  courierId: string;
  courierName: string;
  courierCode: string;
  zoneId: string;
  zoneName: string | null;
  weight: number;
  baseRate: number;
  additionalRate: number;
  fuelSurchargeAmount: number;
  handlingCharge: number;
  codCharge: number;
  totalShippingCost: number;
  estimatedDeliveryDays: number;
}

/**
 * Courier Rate Engine
 * Calculates total shipping charges based on weight slabs, base rates, fuel surcharges, handling, and COD fees.
 */
export const calculateCourierRate = async (input: {
  zoneId: string;
  weight: number;
  courierId?: string;
  orderAmount?: number;
  isCod?: boolean;
}): Promise<CalculatedShippingRate[]> => {
  const { zoneId, weight, courierId, isCod = false } = input;

  const where: any = {
    zoneId,
    isActive: true,
    weightFrom: { lte: weight },
    weightTo: { gte: weight },
  };

  if (courierId) {
    where.courierId = courierId;
  }

  let rateRecords = await prisma.courierRate.findMany({
    where,
    include: {
      courier: true,
      zone: true,
    },
    orderBy: { baseRate: 'asc' },
  });

  // Fallback: If no exact weight slab matches, find rate with highest weightTo for zone
  if (rateRecords.length === 0) {
    rateRecords = await prisma.courierRate.findMany({
      where: { zoneId, isActive: true },
      include: { courier: true, zone: true },
      orderBy: { weightTo: 'desc' },
      take: 1,
    });
  }

  if (rateRecords.length === 0) {
    throw new AppError('NO_COURIER_RATE', `No active courier rate found for zone ${zoneId} and weight ${weight}kg`, 404);
  }

  const results: CalculatedShippingRate[] = rateRecords.map((r) => {
    const base = Number(r.baseRate);

    // Calculate additional weight charge if weight exceeds base weightTo slab
    let extraWeight = Math.max(0, weight - Number(r.weightTo));
    let additional = Number(r.additionalRate) * Math.ceil(extraWeight);

    const fuelPct = Number(r.fuelSurcharge);
    const fuelSurchargeAmount = Number((((base + additional) * fuelPct) / 100).toFixed(2));
    const handling = Number(r.handlingCharge);
    const cod = isCod ? Number(r.codCharge) : 0;

    const totalShippingCost = Number((base + additional + fuelSurchargeAmount + handling + cod).toFixed(2));

    return {
      courierId: r.courierId,
      courierName: r.courier.name,
      courierCode: r.courier.code,
      zoneId: r.zoneId,
      zoneName: r.zone.zoneName || r.zone.name,
      weight,
      baseRate: base,
      additionalRate: additional,
      fuelSurchargeAmount,
      handlingCharge: handling,
      codCharge: cod,
      totalShippingCost,
      estimatedDeliveryDays: r.estimatedDeliveryDays,
    };
  });

  // Sort lowest total cost first
  results.sort((a, b) => a.totalShippingCost - b.totalShippingCost);

  return results;
};

export const listCourierRates = async () => {
  const rates = await prisma.courierRate.findMany({
    where: { isActive: true },
    include: { courier: true, zone: true },
    orderBy: { createdAt: 'desc' },
  });

  return rates.map((r) => ({
    ...r,
    weightFrom: Number(r.weightFrom),
    weightTo: Number(r.weightTo),
    baseRate: Number(r.baseRate),
    additionalRate: Number(r.additionalRate),
    fuelSurcharge: Number(r.fuelSurcharge),
    handlingCharge: Number(r.handlingCharge),
    codCharge: Number(r.codCharge),
  }));
};

export const createCourierRate = async (input: {
  courierId: string;
  zoneId: string;
  weightFrom: number;
  weightTo: number;
  baseRate: number;
  additionalRate?: number;
  fuelSurcharge?: number;
  handlingCharge?: number;
  codCharge?: number;
  estimatedDeliveryDays?: number;
  isActive?: boolean;
}) => {
  const courier = await prisma.courier.findUnique({ where: { id: input.courierId } });
  if (!courier) throw new AppError('NOT_FOUND', 'Courier not found', 404);

  const zone = await prisma.shippingZone.findUnique({ where: { id: input.zoneId } });
  if (!zone) throw new AppError('NOT_FOUND', 'Shipping zone not found', 404);

  return prisma.courierRate.create({
    data: input,
    include: { courier: true, zone: true },
  });
};
