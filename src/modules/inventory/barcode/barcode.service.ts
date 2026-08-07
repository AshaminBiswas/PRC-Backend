import prisma from '../../../config/database';
import { AppError } from '../../../middleware/error.middleware';
import { generateBarcodeBuffer, generateQRCodeDataUrl, generateQRCodeBuffer } from '../shared/inventory.helpers';

export const generateBarcode = async (productId: string) => {
  const item = await prisma.inventoryProduct.findUnique({
    where: { id: productId },
    include: { product: { select: { name: true } } },
  });

  if (!item) throw new AppError('NOT_FOUND', 'Inventory product not found', 404);

  const textToEncode = item.barcode || item.sku;
  const imageBuffer = await generateBarcodeBuffer(textToEncode);

  return {
    productId: item.id,
    sku: item.sku,
    barcode: textToEncode,
    productName: item.product.name,
    imageBuffer,
  };
};

export const generateQR = async (productId: string) => {
  const item = await prisma.inventoryProduct.findUnique({
    where: { id: productId },
    include: { product: { select: { name: true } } },
  });

  if (!item) throw new AppError('NOT_FOUND', 'Inventory product not found', 404);

  const qrData = item.qrCode || JSON.stringify({ id: item.id, sku: item.sku, name: item.product.name });
  const dataUrl = await generateQRCodeDataUrl(qrData);
  const imageBuffer = await generateQRCodeBuffer(qrData);

  return {
    productId: item.id,
    sku: item.sku,
    qrCode: item.qrCode,
    productName: item.product.name,
    dataUrl,
    imageBuffer,
  };
};
