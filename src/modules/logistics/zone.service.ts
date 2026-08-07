import prisma from '../../config/database';
import { AppError } from '../../middleware/error.middleware';

/**
 * Resolves the Shipping Zone for a given Warehouse and Customer PIN Code.
 */
export const resolveShippingZone = async (warehouseId: string, pincode: string) => {
  // 1. Direct Warehouse-Zone PIN Range Mapping Search
  const mapping = await prisma.warehouseZoneMapping.findFirst({
    where: {
      warehouseId,
      pinStart: { lte: pincode },
      pinEnd: { gte: pincode },
      zone: { isActive: true },
    },
    include: {
      zone: {
        include: {
          courier: true,
        },
      },
    },
  });

  if (mapping && mapping.zone) {
    return {
      zone: mapping.zone,
      courier: mapping.zone.courier,
      matchType: 'PIN_RANGE' as const,
    };
  }

  // 2. Lookup Location details from PinCode DB
  const pincodeRecord = await prisma.pinCode.findUnique({
    where: { pincode },
  });

  const state = pincodeRecord?.state;

  // 3. Fallback Search by State / Direct Postal Code in ShippingZone
  const activeZones = await prisma.shippingZone.findMany({
    where: { isActive: true },
    include: { courier: true },
  });

  let matchedZone = null;

  if (pincode) {
    matchedZone = activeZones.find((z) => z.postalCodes.includes(pincode));
  }

  if (!matchedZone && state) {
    matchedZone = activeZones.find((z) =>
      z.states.some((s) => s.toLowerCase() === state.toLowerCase())
    );
  }

  if (!matchedZone && activeZones.length > 0) {
    matchedZone = activeZones[0];
  }

  if (!matchedZone) {
    throw new AppError('NO_SHIPPING_ZONE', `No shipping zone configured for PIN ${pincode}`, 404);
  }

  return {
    zone: matchedZone,
    courier: matchedZone.courier,
    matchType: 'STATE_OR_DEFAULT' as const,
  };
};

export const listShippingZones = async () => {
  return prisma.shippingZone.findMany({
    where: { isActive: true },
    include: {
      courier: true,
      rates: true,
      courierRates: true,
      warehouseMappings: {
        include: { warehouse: { select: { id: true, name: true, code: true } } },
      },
    },
    orderBy: { name: 'asc' },
  });
};

export const createWarehouseZoneMapping = async (input: {
  warehouseId: string;
  zoneId: string;
  pinStart: string;
  pinEnd: string;
}) => {
  const warehouse = await prisma.warehouse.findUnique({ where: { id: input.warehouseId } });
  if (!warehouse) throw new AppError('NOT_FOUND', 'Warehouse not found', 404);

  const zone = await prisma.shippingZone.findUnique({ where: { id: input.zoneId } });
  if (!zone) throw new AppError('NOT_FOUND', 'Shipping zone not found', 404);

  if (Number(input.pinStart) > Number(input.pinEnd)) {
    throw new AppError('BAD_REQUEST', 'pinStart cannot be greater than pinEnd', 400);
  }

  return prisma.warehouseZoneMapping.create({
    data: input,
    include: { warehouse: true, zone: true },
  });
};
