export const INVENTORY_PERMISSIONS = {
  // Ventures
  VENTURES_READ: 'ventures.read',
  VENTURES_CREATE: 'ventures.create',
  VENTURES_UPDATE: 'ventures.update',
  VENTURES_DELETE: 'ventures.delete',
  VENTURES_READ_ALL: 'ventures.read.all',

  // Dashboard
  DASHBOARD_READ: 'inventory.dashboard.read',

  // Products
  PRODUCTS_READ: 'inventory.products.read',
  PRODUCTS_CREATE: 'inventory.products.create',
  PRODUCTS_UPDATE: 'inventory.products.update',
  PRODUCTS_DELETE: 'inventory.products.delete',
  PRODUCTS_IMPORT: 'inventory.products.import',
  PRODUCTS_EXPORT: 'inventory.products.export',

  // Stock
  STOCK_READ: 'inventory.stock.read',
  STOCK_UPDATE: 'inventory.stock.update',
  STOCK_ADJUST: 'inventory.stock.adjust',
  STOCK_RECONCILE: 'inventory.stock.reconcile',

  // Warehouses
  WAREHOUSES_READ: 'inventory.warehouses.read',
  WAREHOUSES_CREATE: 'inventory.warehouses.create',
  WAREHOUSES_UPDATE: 'inventory.warehouses.update',
  WAREHOUSES_DELETE: 'inventory.warehouses.delete',

  // Transfers
  TRANSFERS_READ: 'inventory.transfers.read',
  TRANSFERS_CREATE: 'inventory.transfers.create',
  TRANSFERS_APPROVE: 'inventory.transfers.approve',
  TRANSFERS_CANCEL: 'inventory.transfers.cancel',

  // Suppliers
  SUPPLIERS_READ: 'inventory.suppliers.read',
  SUPPLIERS_CREATE: 'inventory.suppliers.create',
  SUPPLIERS_UPDATE: 'inventory.suppliers.update',
  SUPPLIERS_DELETE: 'inventory.suppliers.delete',

  // Purchases
  PURCHASES_READ: 'inventory.purchases.read',
  PURCHASES_CREATE: 'inventory.purchases.create',
  PURCHASES_RECEIVE: 'inventory.purchases.receive',
  PURCHASES_PAYMENT: 'inventory.purchases.payment',

  // Dispatches
  DISPATCHES_READ: 'inventory.dispatches.read',
  DISPATCHES_CREATE: 'inventory.dispatches.create',
  DISPATCHES_UPDATE: 'inventory.dispatches.update',

  // POS
  POS_MANAGE: 'inventory.pos.manage',
  POS_SELL: 'inventory.pos.sell',
  POS_RETURN: 'inventory.pos.return',

  // Reports & Analytics
  REPORTS_READ: 'inventory.reports.read',
  ANALYTICS_READ: 'inventory.analytics.read',

  // Audit
  AUDIT_READ: 'inventory.audit.read',
} as const;
