import prisma from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import type {
  CreateShippingZoneInput,
  UpdateShippingZoneInput,
  CreateShippingRateInput,
  UpdateShippingRateInput,
  CalculateShippingInput,
} from './shipping.schema';
import type { Prisma } from '@prisma/client';

const formatRate = (r: {
  minWeight: Prisma.Decimal;
  maxWeight: Prisma.Decimal | null;
  minOrderAmount: Prisma.Decimal | null;
  maxOrderAmount: Prisma.Decimal | null;
  rate: Prisma.Decimal;
  [key: string]: unknown;
}) => ({
  ...r,
  minWeight: Number(r.minWeight),
  maxWeight: r.maxWeight !== null ? Number(r.maxWeight) : null,
  minOrderAmount: r.minOrderAmount !== null ? Number(r.minOrderAmount) : null,
  maxOrderAmount: r.maxOrderAmount !== null ? Number(r.maxOrderAmount) : null,
  rate: Number(r.rate),
});

export const listZones = async () => {
  const zones = await prisma.shippingZone.findMany({
    include: {
      rates: {
        orderBy: { rate: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return zones.map((z) => ({
    ...z,
    rates: z.rates.map(formatRate),
  }));
};

export const createZone = async (input: CreateShippingZoneInput) => {
  const zone = await prisma.shippingZone.create({
    data: {
      name: input.name,
      countries: input.countries ?? ['India'],
      states: input.states ?? [],
      postalCodes: input.postalCodes ?? [],
      isActive: input.isActive ?? true,
    },
    include: { rates: true },
  });

  return {
    ...zone,
    rates: zone.rates.map(formatRate),
  };
};

export const updateZone = async (id: string, input: UpdateShippingZoneInput) => {
  const zone = await prisma.shippingZone.findUnique({ where: { id } });
  if (!zone) {
    throw new AppError('NOT_FOUND', 'Shipping zone not found', 404);
  }

  const updated = await prisma.shippingZone.update({
    where: { id },
    data: input,
    include: { rates: true },
  });

  return {
    ...updated,
    rates: updated.rates.map(formatRate),
  };
};

export const deleteZone = async (id: string) => {
  const zone = await prisma.shippingZone.findUnique({ where: { id } });
  if (!zone) {
    throw new AppError('NOT_FOUND', 'Shipping zone not found', 404);
  }

  await prisma.shippingZone.delete({ where: { id } });
};

export const getZoneRates = async (zoneId: string) => {
  const zone = await prisma.shippingZone.findUnique({ where: { id: zoneId } });
  if (!zone) {
    throw new AppError('NOT_FOUND', 'Shipping zone not found', 404);
  }

  const rates = await prisma.shippingRate.findMany({
    where: { zoneId },
    orderBy: { rate: 'asc' },
  });

  return rates.map(formatRate);
};

export const createZoneRate = async (zoneId: string, input: CreateShippingRateInput) => {
  const zone = await prisma.shippingZone.findUnique({ where: { id: zoneId } });
  if (!zone) {
    throw new AppError('NOT_FOUND', 'Shipping zone not found', 404);
  }

  const rate = await prisma.shippingRate.create({
    data: {
      zoneId,
      name: input.name,
      minWeight: input.minWeight ?? 0,
      maxWeight: input.maxWeight,
      minOrderAmount: input.minOrderAmount,
      maxOrderAmount: input.maxOrderAmount,
      rate: input.rate,
      estimatedDays: input.estimatedDays,
      isActive: input.isActive ?? true,
    },
  });

  return formatRate(rate);
};

export const updateRate = async (rateId: string, input: UpdateShippingRateInput) => {
  const rate = await prisma.shippingRate.findUnique({ where: { id: rateId } });
  if (!rate) {
    throw new AppError('NOT_FOUND', 'Shipping rate not found', 404);
  }

  const updated = await prisma.shippingRate.update({
    where: { id: rateId },
    data: input,
  });

  return formatRate(updated);
};

export const deleteRate = async (rateId: string) => {
  const rate = await prisma.shippingRate.findUnique({ where: { id: rateId } });
  if (!rate) {
    throw new AppError('NOT_FOUND', 'Shipping rate not found', 404);
  }

  await prisma.shippingRate.delete({ where: { id: rateId } });
};

export const calculateShipping = async (input: CalculateShippingInput) => {
  const country = input.address?.country ?? 'India';
  const state = input.address?.state;
  const postalCode = input.address?.postalCode;
  const weight = input.weight ?? 0;
  const orderAmount = input.orderAmount ?? 0;

  const activeZones = await prisma.shippingZone.findMany({
    where: { isActive: true },
    include: {
      rates: {
        where: { isActive: true },
      },
    },
  });

  let matchedZone = null;

  if (postalCode) {
    matchedZone = activeZones.find((z) => z.postalCodes.includes(postalCode));
  }

  if (!matchedZone && state) {
    matchedZone = activeZones.find(
      (z) => z.states.some((s) => s.toLowerCase() === state.toLowerCase())
    );
  }

  if (!matchedZone && country) {
    matchedZone = activeZones.find(
      (z) => z.countries.some((c) => c.toLowerCase() === country.toLowerCase())
    );
  }

  if (!matchedZone && activeZones.length > 0) {
    matchedZone = activeZones[0];
  }

  const applicableRates: Array<{
    id: string;
    name: string;
    rate: number;
    estimatedDays: string | null;
    isFreeShipping?: boolean;
  }> = [];

  // Check free shipping threshold (₹5000 default)
  if (orderAmount >= 5000) {
    applicableRates.push({
      id: 'free-shipping',
      name: 'Free Shipping',
      rate: 0,
      estimatedDays: '3-5 Business Days',
      isFreeShipping: true,
    });
  }

  if (matchedZone) {
    for (const r of matchedZone.rates) {
      const minW = Number(r.minWeight);
      const maxW = r.maxWeight !== null ? Number(r.maxWeight) : null;
      const minO = r.minOrderAmount !== null ? Number(r.minOrderAmount) : null;
      const maxO = r.maxOrderAmount !== null ? Number(r.maxOrderAmount) : null;

      const weightMatch = weight >= minW && (maxW === null || weight <= maxW);
      const amountMatch = (minO === null || orderAmount >= minO) && (maxO === null || orderAmount <= maxO);

      if (weightMatch && amountMatch) {
        applicableRates.push({
          id: r.id,
          name: r.name,
          rate: Number(r.rate),
          estimatedDays: r.estimatedDays,
        });
      }
    }
  }

  // Fallback if no matching rate found
  if (applicableRates.length === 0) {
    applicableRates.push({
      id: 'standard-default',
      name: 'Standard Delivery',
      rate: 100,
      estimatedDays: '3-5 Business Days',
    });
  }

  const cheapestRate = applicableRates.reduce((prev, curr) => (curr.rate < prev.rate ? curr : prev));

  return {
    zone: matchedZone
      ? { id: matchedZone.id, name: matchedZone.name }
      : { id: 'default', name: 'Standard Pan-India Zone' },
    calculatedRate: cheapestRate.rate,
    selectedOption: cheapestRate,
    availableOptions: applicableRates,
  };
};
