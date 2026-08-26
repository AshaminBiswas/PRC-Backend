import { z } from 'zod';

// ─── Branches ────────────────────────────────────────────────────────────────

export const ListBranchesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  search: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});

export const CreateBranchSchema = z.object({
  name: z.string().min(1, 'Branch name is required').max(100),
  code: z.string().min(2, 'Code must be at least 2 chars').max(10).toUpperCase(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  isActive: z.boolean().optional().default(true),
});

export const UpdateBranchSchema = CreateBranchSchema.partial();

// ─── Suppliers / Vendors ──────────────────────────────────────────────────────

export const ListSuppliersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(20),
  search: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});

export const CreateSupplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required').max(150),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  address: z.string().optional(),
  gstNumber: z.string().max(15).optional().or(z.literal('')),
  isActive: z.boolean().optional().default(true),
});

export const UpdateSupplierSchema = CreateSupplierSchema.partial();

// ─── Inventory List & Lookup ─────────────────────────────────────────────────

export const ListInventoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(20),
  branchId: z.string().optional(),
  productId: z.string().optional(),
  categoryId: z.string().optional(),
  search: z.string().optional(),
  lowStock: z.coerce.boolean().optional(),
  sortBy: z.string().default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ─── Purchases (Stock-In) ────────────────────────────────────────────────────

export const CreatePurchaseItemSchema = z.object({
  productId: z.string().optional(),
  sku: z.string().optional(),
  name: z.string().optional(),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  unitPurchasePrice: z.number().min(0, 'Purchase price must be positive'),
});

export const CreatePurchaseSchema = z.object({
  branchId: z.string().min(1, 'Branch ID is required'),
  supplierId: z.string().min(1, 'Supplier ID is required'),
  invoiceNumber: z.string().optional(),
  purchaseDate: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(CreatePurchaseItemSchema).min(1, 'At least one item is required'),
});

// ─── Quick Stock (Add New SKU & Initial Stock Entry) ─────────────────────────

export const QuickStockSchema = z.object({
  sku: z.string().min(1, 'SKU is required').max(50),
  name: z.string().min(1, 'Product Name is required').max(150),
  branchId: z.string().min(1, 'Branch ID is required'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  unitCost: z.number().min(0).optional().default(0),
  sellingPrice: z.number().min(0).optional(),
  reorderLevel: z.number().int().min(0).optional().default(10),
  categoryId: z.string().optional(),
  notes: z.string().optional(),
});

export const ListPurchasesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(20),
  branchId: z.string().optional(),
  supplierId: z.string().optional(),
  search: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  sortBy: z.string().default('purchaseDate'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ─── Stock Transfers ─────────────────────────────────────────────────────────

export const CreateTransferItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
});

export const CreateStockTransferSchema = z.object({
  fromBranchId: z.string().min(1, 'Source branch is required'),
  toBranchId: z.string().min(1, 'Destination branch is required'),
  notes: z.string().optional(),
  items: z.array(CreateTransferItemSchema).min(1, 'At least one item is required to transfer'),
}).refine((data) => data.fromBranchId !== data.toBranchId, {
  message: 'Source and destination branches cannot be the same',
  path: ['toBranchId'],
});

export const ListStockTransfersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(20),
  branchId: z.string().optional(),
  fromBranchId: z.string().optional(),
  toBranchId: z.string().optional(),
  status: z.enum(['PENDING', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const TransferActionSchema = z.object({
  notes: z.string().optional(),
});

// ─── Stock Adjustments ───────────────────────────────────────────────────────

export const CreateStockAdjustmentSchema = z.object({
  branchId: z.string().min(1, 'Branch is required'),
  productId: z.string().min(1, 'Product is required'),
  type: z.enum(['ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'DAMAGE', 'RETURN_IN']),
  quantity: z.number().int().min(1, 'Adjustment quantity must be at least 1'),
  reason: z.string().min(3, 'Mandatory explanation/reason is required for stock adjustment'),
});

// ─── Stock Movements Ledger ──────────────────────────────────────────────────

export const ListStockMovementsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  branchId: z.string().optional(),
  productId: z.string().optional(),
  type: z.enum([
    'PURCHASE_IN',
    'TRANSFER_IN',
    'TRANSFER_OUT',
    'ADJUSTMENT_IN',
    'ADJUSTMENT_OUT',
    'SALE_OUT',
    'DAMAGE',
    'RETURN_IN',
  ]).optional(),
  referenceType: z.string().optional(),
  referenceId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ─── Reports & Exports ───────────────────────────────────────────────────────

export const InventoryReportQuerySchema = z.object({
  branchId: z.string().optional(),
  supplierId: z.string().optional(),
  productId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  format: z.enum(['xlsx', 'pdf', 'json']).default('xlsx'),
});

// ─── Manual / POS Sales (Stock-Out) ──────────────────────────────────────────

export const CreateSaleItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  branchId: z.string().min(1, 'Branch ID is required'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
});

export const CreateSaleSchema = z.object({
  referenceId: z.string().min(1, 'Reference ID or receipt number is required'),
  referenceType: z.string().optional().default('WALK_IN_SALE'),
  notes: z.string().optional(),
  items: z.array(CreateSaleItemSchema).min(1, 'At least one sale item is required'),
});

// ─── Type Exports ────────────────────────────────────────────────────────────

export type ListBranchesQuery = z.infer<typeof ListBranchesQuerySchema>;
export type CreateBranchInput = z.infer<typeof CreateBranchSchema>;
export type UpdateBranchInput = z.infer<typeof UpdateBranchSchema>;

export type ListSuppliersQuery = z.infer<typeof ListSuppliersQuerySchema>;
export type CreateSupplierInput = z.infer<typeof CreateSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof UpdateSupplierSchema>;

export type ListInventoryQuery = z.infer<typeof ListInventoryQuerySchema>;
export type CreatePurchaseInput = z.infer<typeof CreatePurchaseSchema>;
export type ListPurchasesQuery = z.infer<typeof ListPurchasesQuerySchema>;

export type CreateStockTransferInput = z.infer<typeof CreateStockTransferSchema>;
export type ListStockTransfersQuery = z.infer<typeof ListStockTransfersQuerySchema>;
export type TransferActionInput = z.infer<typeof TransferActionSchema>;

export type CreateStockAdjustmentInput = z.infer<typeof CreateStockAdjustmentSchema>;
export type ListStockMovementsQuery = z.infer<typeof ListStockMovementsQuerySchema>;
export type InventoryReportQuery = z.infer<typeof InventoryReportQuerySchema>;

export type CreateSaleItemInput = z.infer<typeof CreateSaleItemSchema>;
export type CreateSaleInput = z.infer<typeof CreateSaleSchema>;
export type QuickStockInput = z.infer<typeof QuickStockSchema>;

