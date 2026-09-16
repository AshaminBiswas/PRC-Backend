import bwipjs from 'bwip-js';
import QRCode from 'qrcode';
import path from 'path';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfmake = require('pdfmake');

// ─── PDF Font Setup ──────────────────────────────────────────────────────────
try {
  const pdfmakeDir = path.dirname(require.resolve('pdfmake/package.json'));
  pdfmake.addFonts({
    Roboto: {
      normal: path.join(pdfmakeDir, 'fonts/Roboto/Roboto-Regular.ttf'),
      bold: path.join(pdfmakeDir, 'fonts/Roboto/Roboto-Medium.ttf'),
      italics: path.join(pdfmakeDir, 'fonts/Roboto/Roboto-Italic.ttf'),
      bolditalics: path.join(pdfmakeDir, 'fonts/Roboto/Roboto-MediumItalic.ttf'),
    },
  });
} catch (e: any) {
  console.warn('[Barcode Service] pdfmake font initialization warning:', e?.message || e);
}

export interface BarcodeScanResponse {
  found: boolean;
  product: {
    id: string;
    name: string;
    sku: string;
    slug: string;
    thumbnail?: string | null;
    images: string[];
    category?: { id: string; name: string } | null;
    status: string;
    isVisible: boolean;
    reorderLevel: number;
    weight?: number | null;
  };
  specs: {
    finish: string;
    colour: string;
    colours: string[];
    dimensions?: {
      height?: number;
      width?: number;
      length?: number;
      unit?: string;
    } | null;
    attributes?: any;
  };
  pricing: {
    price: number;
    salePrice?: number | null;
    offerPrice?: number | null;
  };
  inventories: Array<{
    branchId: string;
    branchName: string;
    branchCode: string;
    quantity: number;
    reservedQuantity: number;
    availableQuantity: number;
    reorderLevel: number;
    health: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  }>;
  metrics: {
    totalStock: number;
    totalReserved: number;
    totalAvailable: number;
    healthStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
    branchCount: number;
  };
  dispatchOrders: Array<{
    orderId: string;
    orderItemId: string;
    orderNumber: string;
    orderStatus: string;
    orderDate: string;
    customerName: string;
    customerPhone?: string;
    city?: string;
    orderedQuantity: number;
    unitPrice: number;
    totalPrice: number;
    canDispatch: boolean;
  }>;
  recentMovements: Array<{
    id: string;
    type: string;
    quantity: number;
    branchName: string;
    notes?: string | null;
    createdAt: string;
  }>;
  barcodeUrl: string;
  qrCodeUrl: string;
  labelPdfUrl: string;
}

export class BarcodeService {
  /**
   * Generates a crisp Code-128 barcode PNG buffer using bwip-js
   */
  static async generateBarcodePng(sku: string): Promise<Buffer> {
    if (!sku || !sku.trim()) {
      throw new AppError('SKU_REQUIRED', 'SKU is required for barcode generation', 400);
    }
    const cleanSku = sku.trim().toUpperCase();

    return new Promise<Buffer>((resolve, reject) => {
      bwipjs.toBuffer(
        {
          bcid: 'code128',
          text: cleanSku,
          scale: 3,
          height: 12,
          includetext: true,
          textxalign: 'center',
          textsize: 10,
          backgroundcolor: 'FFFFFF',
        },
        (err: any, png: Buffer) => {
          if (err) {
            const msg = typeof err === 'string' ? err : err?.message || 'Barcode render failed';
            reject(new AppError('BARCODE_RENDER_ERROR', `Failed to generate barcode: ${msg}`, 500));
          } else {
            resolve(png);
          }
        }
      );
    });
  }

  /**
   * Generates high-density QR code PNG buffer
   */
  static async generateQrPng(textOrUrl: string): Promise<Buffer> {
    if (!textOrUrl || !textOrUrl.trim()) {
      throw new AppError('URL_REQUIRED', 'Text or URL is required for QR code generation', 400);
    }
    return QRCode.toBuffer(textOrUrl.trim(), {
      width: 320,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#18181B',
        light: '#FFFFFF',
      },
    });
  }

  /**
   * Generates a production thermal barcode sticker PDF (standard 58mm x 40mm)
   */
  static async generateLabelPdf(
    sku: string,
    options?: {
      size?: '58x40' | '80x40';
      companyName?: string;
    }
  ): Promise<Buffer> {
    const cleanSku = sku.trim().toUpperCase();
    const product = await prisma.product.findUnique({
      where: { sku: cleanSku },
      include: { category: true },
    });

    if (!product) {
      throw new AppError('NOT_FOUND', `Product with SKU "${cleanSku}" not found`, 404);
    }

    const companyName = options?.companyName || 'PACIFIC HARDWARE (PRC)';
    const size = options?.size || '58x40';

    // Page dimensions in PDF points (72 points = 1 inch = 25.4 mm)
    const pageWidth = size === '80x40' ? 226.7 : 164.4;
    const pageHeight = 113.4;

    // Generate Barcode PNG base64
    const barcodePng = await this.generateBarcodePng(cleanSku);
    const barcodeBase64 = `data:image/png;base64,${barcodePng.toString('base64')}`;

    // Generate QR Code
    const qrUrl = `https://pacificrestroomcubicles.com/product/${product.slug || cleanSku}`;
    const qrPng = await this.generateQrPng(qrUrl);
    const qrBase64 = `data:image/png;base64,${qrPng.toString('base64')}`;

    const docDefinition: any = {
      pageSize: { width: pageWidth, height: pageHeight },
      pageMargins: [8, 6, 8, 6],
      content: [
        {
          columns: [
            {
              width: '*',
              stack: [
                { text: companyName, fontSize: 8, bold: true, color: '#1F2937', characterSpacing: 0.5 },
                {
                  text: `SKU: ${cleanSku}`,
                  fontSize: 13,
                  bold: true,
                  color: '#000000',
                  margin: [0, 3, 0, 0],
                },
              ],
            },
            {
              width: 36,
              image: qrBase64,
              fit: [34, 34],
              alignment: 'right',
            },
          ],
        },
        {
          image: barcodeBase64,
          fit: [pageWidth - 16, 56],
          alignment: 'center',
          margin: [0, 5, 0, 0],
        },
      ],
      defaultStyle: {
        font: 'Roboto',
      },
    };

    const doc = pdfmake.createPdf(docDefinition);
    return await doc.getBuffer();
  }

  /**
   * Unified Scan Lookup — Resolves SKU, Barcode, or ID from camera or laser scanner.
   * Returns complete production specifications, multi-branch stock, and pending dispatch orders!
   */
  static async lookupScan(rawCode: string): Promise<BarcodeScanResponse> {
    if (!rawCode || !rawCode.trim()) {
      throw new AppError('CODE_REQUIRED', 'Scan code cannot be empty', 400);
    }

    let cleanCode = rawCode.trim();

    // If a full URL was scanned
    if (cleanCode.startsWith('http://') || cleanCode.startsWith('https://')) {
      try {
        const parsed = new URL(cleanCode);
        if (parsed.searchParams.has('sku')) {
          cleanCode = parsed.searchParams.get('sku') || cleanCode;
        } else {
          const pathParts = parsed.pathname.split('/').filter(Boolean);
          if (pathParts.length > 0) {
            cleanCode = pathParts[pathParts.length - 1];
          }
        }
      } catch {
        // keep cleanCode as is
      }
    }

    // Lookup Product by SKU, ID, or Slug
    let product = await prisma.product.findFirst({
      where: {
        OR: [
          { sku: { equals: cleanCode, mode: 'insensitive' } },
          { id: cleanCode },
          { slug: { equals: cleanCode, mode: 'insensitive' } },
        ],
        deletedAt: null,
      },
      include: {
        category: { select: { id: true, name: true } },
        material: { select: { id: true, name: true } },
        inventories: {
          include: {
            branch: true,
          },
        },
      },
    });

    // If not found directly, search by ProductVariant SKU
    if (!product) {
      const variant = await prisma.productVariant.findFirst({
        where: { sku: { equals: cleanCode, mode: 'insensitive' } },
        include: {
          product: {
            include: {
              category: { select: { id: true, name: true } },
              material: { select: { id: true, name: true } },
              inventories: {
                include: {
                  branch: true,
                },
              },
            },
          },
        },
      });
      if (variant && variant.product) {
        product = variant.product;
      }
    }

    if (!product) {
      throw new AppError('NOT_FOUND', `No SKU or product found matching barcode "${cleanCode}"`, 404);
    }

    // Fetch all active facilities to guarantee complete branch presence
    const allBranches = await prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    const inventoryMap = new Map<string, any>();
    product.inventories.forEach((inv) => {
      inventoryMap.set(inv.branchId, inv);
    });

    let totalStock = 0;
    let totalReserved = 0;

    const inventories = allBranches.map((b) => {
      const existing = inventoryMap.get(b.id);
      const qty = existing ? existing.quantity || 0 : 0;
      const res = existing ? existing.reservedQuantity || 0 : 0;
      const reorder = existing?.reorderLevel || product!.reorderLevel || 10;
      const avail = Math.max(0, qty - res);

      totalStock += qty;
      totalReserved += res;

      let health: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' = 'IN_STOCK';
      if (avail === 0) health = 'OUT_OF_STOCK';
      else if (avail <= reorder) health = 'LOW_STOCK';

      return {
        branchId: b.id,
        branchName: b.name,
        branchCode: b.code,
        quantity: qty,
        reservedQuantity: res,
        availableQuantity: avail,
        reorderLevel: reorder,
        health,
      };
    });

    const totalAvailable = Math.max(0, totalStock - totalReserved);
    let healthStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' = 'IN_STOCK';
    if (totalAvailable === 0) healthStatus = 'OUT_OF_STOCK';
    else if (totalAvailable <= (product.reorderLevel || 10)) healthStatus = 'LOW_STOCK';

    // Extract Hardware Specs
    const finish = (product as any).finish || (product.attributes as any)?.finish || 'N/A';
    const colour = (product as any).colour || (product.attributes as any)?.colour || 'N/A';
    const colours = (product as any).colours || [];
    const dimensions = (product.dimensions as any) || null;

    // Fetch Pending / Processing Orders containing this SKU for Order Dispatch
    const pendingOrderItems = await prisma.orderItem.findMany({
      where: {
        productId: product.id,
        order: {
          status: { in: ['PENDING', 'PROCESSING'] },
        },
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            createdAt: true,
            shippingAddress: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const dispatchOrders = pendingOrderItems.map((item) => {
      const address = (item.order.shippingAddress as any) || {};
      const customerName =
        [item.order.user?.firstName, item.order.user?.lastName].filter(Boolean).join(' ') ||
        address.fullName ||
        'Customer';

      return {
        orderId: item.order.id,
        orderItemId: item.id,
        orderNumber: item.order.orderNumber,
        orderStatus: item.order.status,
        orderDate: item.order.createdAt.toISOString(),
        customerName,
        customerPhone: item.order.user?.phone || address.phone,
        city: address.city || address.state,
        orderedQuantity: item.quantity,
        unitPrice: Number(item.price),
        totalPrice: Number(item.total),
        canDispatch: totalAvailable >= item.quantity,
      };
    });

    // Fetch Last 5 Stock Movement Records
    const stockMovements = await prisma.stockMovement.findMany({
      where: { productId: product.id },
      include: {
        branch: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const recentMovements = stockMovements.map((m) => ({
      id: m.id,
      type: m.type,
      quantity: m.quantity,
      branchName: m.branch?.name || 'Central Facility',
      notes: m.notes,
      createdAt: m.createdAt.toISOString(),
    }));

    return {
      found: true,
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku,
        slug: product.slug,
        thumbnail: product.thumbnail,
        images: product.images || [],
        category: product.category,
        status: product.status,
        isVisible: product.isVisible,
        reorderLevel: product.reorderLevel,
        weight: product.weight ? Number(product.weight) : null,
      },
      specs: {
        finish,
        colour,
        colours,
        dimensions,
        attributes: product.attributes,
      },
      pricing: {
        price: Number(product.price),
        salePrice: product.salePrice ? Number(product.salePrice) : null,
        offerPrice: product.offerPrice ? Number(product.offerPrice) : null,
      },
      inventories,
      metrics: {
        totalStock,
        totalReserved,
        totalAvailable,
        healthStatus,
        branchCount: inventories.length,
      },
      dispatchOrders,
      recentMovements,
      barcodeUrl: `/api/v1/barcode/${encodeURIComponent(product.sku)}/image`,
      qrCodeUrl: `/api/v1/barcode/${encodeURIComponent(product.sku)}/qr`,
      labelPdfUrl: `/api/v1/barcode/${encodeURIComponent(product.sku)}/label`,
    };
  }

  /**
   * Dispatches or verifies an order item via barcode scan
   */
  static async verifyAndDispatchOrder(data: {
    orderId: string;
    orderItemId?: string;
    sku: string;
    quantity: number;
    branchId: string;
    staffUserId?: string;
    notes?: string;
  }) {
    const { orderId, sku, quantity, branchId, staffUserId, notes } = data;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
      },
    });

    if (!order) {
      throw new AppError('NOT_FOUND', `Order with ID ${orderId} not found`, 404);
    }

    const item = order.items.find((i) => i.sku.toUpperCase() === sku.toUpperCase());
    if (!item) {
      throw new AppError('INVALID_ITEM', `SKU ${sku} does not belong to Order ${order.orderNumber}`, 400);
    }

    // Verify stock availability in specified branch
    const inventory = await prisma.inventory.findUnique({
      where: {
        productId_branchId: {
          productId: item.productId,
          branchId,
        },
      },
    });

    if (!inventory || inventory.quantity < quantity) {
      throw new AppError(
        'INSUFFICIENT_STOCK',
        `Insufficient physical stock in selected facility. Available: ${inventory?.quantity || 0}`,
        400
      );
    }

    // Atomic transaction: Deduct stock, log StockMovement, and advance order status
    return await prisma.$transaction(async (tx) => {
      // Deduct inventory
      const updatedInv = await tx.inventory.update({
        where: {
          productId_branchId: {
            productId: item.productId,
            branchId,
          },
        },
        data: {
          quantity: { decrement: quantity },
        },
      });

      // Also deduct Product aggregate stock
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: quantity } },
      });

      // Record StockMovement audit ledger
      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          branchId,
          type: 'TRANSFER_OUT',
          quantity: -quantity,
          previousQty: inventory.quantity,
          newQty: updatedInv.quantity,
          notes: `Dispatched for Order ${order.orderNumber}. ${notes || ''}`.trim(),
          referenceId: order.id,
          referenceType: 'ORDER_DISPATCH',
          performedById: staffUserId || 'system',
        },
      });

      // Update Order Status to SHIPPED
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'SHIPPED',
        },
      });

      // Log status history
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: 'SHIPPED',
          comment: `Barcode scan verified & dispatched SKU ${sku} (${quantity} units) from branch.`,
          changedBy: staffUserId,
        },
      });

      return {
        success: true,
        order: updatedOrder,
        dispatchedSku: sku,
        dispatchedQuantity: quantity,
        remainingBranchStock: updatedInv.quantity,
      };
    });
  }
}
