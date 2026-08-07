import prisma from '../../../config/database';

export const searchProducts = async (ventureId: string, q: string) => {
  return prisma.inventoryProduct.findMany({
    where: {
      ventureId,
      deletedAt: null,
      OR: [
        { sku: { contains: q, mode: 'insensitive' } },
        { barcode: { contains: q, mode: 'insensitive' } },
        { qrCode: { contains: q, mode: 'insensitive' } },
        { brand: { contains: q, mode: 'insensitive' } },
        { product: { name: { contains: q, mode: 'insensitive' } } },
      ],
    },
    take: 20,
    include: { product: { select: { id: true, name: true, thumbnail: true } } },
  });
};

export const searchBySKU = async (ventureId: string, q: string) => {
  return prisma.inventoryProduct.findMany({
    where: { ventureId, sku: { contains: q, mode: 'insensitive' }, deletedAt: null },
    take: 20,
    include: { product: true },
  });
};

export const searchByBarcode = async (ventureId: string, barcode: string) => {
  return prisma.inventoryProduct.findFirst({
    where: { ventureId, barcode, deletedAt: null },
    include: { product: true, stocks: { include: { warehouse: true } } },
  });
};

export const searchByQR = async (ventureId: string, qrCode: string) => {
  return prisma.inventoryProduct.findFirst({
    where: { ventureId, qrCode, deletedAt: null },
    include: { product: true, stocks: { include: { warehouse: true } } },
  });
};

export const searchSuppliers = async (ventureId: string, q: string) => {
  return prisma.supplier.findMany({
    where: {
      ventureId,
      deletedAt: null,
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { code: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
      ],
    },
    take: 20,
  });
};
