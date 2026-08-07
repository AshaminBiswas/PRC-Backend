import { PrismaClient, DiscountType, ContentStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();

// ─── 1. Permissions Definition ────────────────────────────────────────────────

const PERMISSIONS = [
  // Auth & Security
  { name: 'View Auth Logs', slug: 'auth.logs', module: 'auth', description: 'View authentication logs' },
  { name: 'Read Audit Logs', slug: 'audit-logs.read', module: 'audit-logs', description: 'View administrative action audit logs' },

  // Users
  { name: 'Read Users', slug: 'users.read', module: 'users', description: 'View user list and details' },
  { name: 'Create Users', slug: 'users.create', module: 'users', description: 'Create new users' },
  { name: 'Update Users', slug: 'users.update', module: 'users', description: 'Edit user information' },
  { name: 'Delete Users', slug: 'users.delete', module: 'users', description: 'Delete users' },

  // Roles
  { name: 'Read Roles', slug: 'roles.read', module: 'roles', description: 'View roles and permissions' },
  { name: 'Create Roles', slug: 'roles.create', module: 'roles', description: 'Create new roles' },
  { name: 'Update Roles', slug: 'roles.update', module: 'roles', description: 'Edit roles and permissions' },
  { name: 'Delete Roles', slug: 'roles.delete', module: 'roles', description: 'Delete roles' },

  // Categories
  { name: 'Read Categories', slug: 'categories.read', module: 'categories', description: 'View categories' },
  { name: 'Create Categories', slug: 'categories.create', module: 'categories', description: 'Create categories' },
  { name: 'Update Categories', slug: 'categories.update', module: 'categories', description: 'Edit categories' },
  { name: 'Delete Categories', slug: 'categories.delete', module: 'categories', description: 'Delete categories' },

  // Products & Variants
  { name: 'Read Products', slug: 'products.read', module: 'products', description: 'View products' },
  { name: 'Create Products', slug: 'products.create', module: 'products', description: 'Create products' },
  { name: 'Update Products', slug: 'products.update', module: 'products', description: 'Edit products' },
  { name: 'Delete Products', slug: 'products.delete', module: 'products', description: 'Delete products' },
  { name: 'Read Variants', slug: 'variants.read', module: 'variants', description: 'View product variants' },
  { name: 'Create Variants', slug: 'variants.create', module: 'variants', description: 'Create product variants' },
  { name: 'Update Variants', slug: 'variants.update', module: 'variants', description: 'Edit product variants' },
  { name: 'Delete Variants', slug: 'variants.delete', module: 'variants', description: 'Delete product variants' },

  // Customer Experience (Wishlist, Cart, Checkout)
  { name: 'Read Wishlists', slug: 'wishlist.read', module: 'wishlist', description: 'View customer wishlists' },
  { name: 'Manage Wishlists', slug: 'wishlist.manage', module: 'wishlist', description: 'Manage customer wishlists' },
  { name: 'Read Carts', slug: 'cart.read', module: 'cart', description: 'View active customer carts' },
  { name: 'Manage Carts', slug: 'cart.manage', module: 'cart', description: 'Modify or clear customer carts' },
  { name: 'Manage Checkout', slug: 'checkout.manage', module: 'checkout', description: 'Configure checkout rules' },

  // Orders
  { name: 'Read Orders', slug: 'orders.read', module: 'orders', description: 'View orders' },
  { name: 'Create Orders', slug: 'orders.create', module: 'orders', description: 'Create orders' },
  { name: 'Update Orders', slug: 'orders.update', module: 'orders', description: 'Update order status & tracking' },
  { name: 'Delete Orders', slug: 'orders.delete', module: 'orders', description: 'Delete orders' },

  // Quotes
  { name: 'Read Quotes', slug: 'quotes.read', module: 'quotes', description: 'View quotes' },
  { name: 'Create Quotes', slug: 'quotes.create', module: 'quotes', description: 'Create quotes' },
  { name: 'Update Quotes', slug: 'quotes.update', module: 'quotes', description: 'Update quotes pricing' },
  { name: 'Approve Quotes', slug: 'quotes.approve', module: 'quotes', description: 'Approve/reject quotes' },

  // Reviews & Moderation
  { name: 'Read Reviews', slug: 'reviews.read', module: 'reviews', description: 'View reviews' },
  { name: 'Moderate Reviews', slug: 'reviews.moderate', module: 'reviews', description: 'Approve/reject reviews' },
  { name: 'Delete Reviews', slug: 'reviews.delete', module: 'reviews', description: 'Delete reviews' },

  // Customer Support & Enquiries
  { name: 'Read Enquiries', slug: 'enquiries.read', module: 'enquiries', description: 'View customer enquiries' },
  { name: 'Update Enquiries', slug: 'enquiries.update', module: 'enquiries', description: 'Update enquiry status' },
  { name: 'Delete Enquiries', slug: 'enquiries.delete', module: 'enquiries', description: 'Delete enquiries' },

  // CMS (Pages, Blog, FAQ)
  { name: 'Read CMS', slug: 'cms.read', module: 'cms', description: 'View CMS pages, blogs, and FAQs' },
  { name: 'Create CMS', slug: 'cms.create', module: 'cms', description: 'Create CMS content' },
  { name: 'Update CMS', slug: 'cms.update', module: 'cms', description: 'Edit CMS content' },
  { name: 'Delete CMS', slug: 'cms.delete', module: 'cms', description: 'Delete CMS content' },

  // Banners & Homepage
  { name: 'Read Banners', slug: 'banners.read', module: 'banners', description: 'View banners' },
  { name: 'Create Banners', slug: 'banners.create', module: 'banners', description: 'Create banners' },
  { name: 'Update Banners', slug: 'banners.update', module: 'banners', description: 'Edit banners' },
  { name: 'Delete Banners', slug: 'banners.delete', module: 'banners', description: 'Delete banners' },
  { name: 'Read Homepage', slug: 'homepage.read', module: 'homepage', description: 'View homepage configuration' },
  { name: 'Manage Homepage', slug: 'homepage.manage', module: 'homepage', description: 'Manage homepage sections' },

  // Promotions & Coupons
  { name: 'Read Coupons', slug: 'coupons.read', module: 'coupons', description: 'View coupons' },
  { name: 'Create Coupons', slug: 'coupons.create', module: 'coupons', description: 'Create coupons' },
  { name: 'Update Coupons', slug: 'coupons.update', module: 'coupons', description: 'Edit coupons' },
  { name: 'Delete Coupons', slug: 'coupons.delete', module: 'coupons', description: 'Delete coupons' },

  // Payments & Shipping
  { name: 'Read Payments', slug: 'payments.read', module: 'payments', description: 'View payment transactions' },
  { name: 'Refund Payments', slug: 'payments.refund', module: 'payments', description: 'Process payment refunds' },
  { name: 'Read Shipping', slug: 'shipping.read', module: 'shipping', description: 'View shipping zones and rates' },
  { name: 'Manage Shipping', slug: 'shipping.manage', module: 'shipping', description: 'Manage shipping configurations' },

  // Enterprise Invoices & Finance
  { name: 'Read Invoices', slug: 'invoices.read', module: 'invoices', description: 'View invoices and commercial documents' },
  { name: 'Create Invoices', slug: 'invoices.create', module: 'invoices', description: 'Create invoices, quotations, and challans' },
  { name: 'Update Invoices', slug: 'invoices.update', module: 'invoices', description: 'Edit draft invoices' },
  { name: 'Approve Invoices', slug: 'invoices.approve', module: 'invoices', description: 'Approve invoices and assign FY sequences' },
  { name: 'Cancel Invoices', slug: 'invoices.cancel', module: 'invoices', description: 'Cancel invoices' },
  { name: 'Sign Invoices', slug: 'invoices.sign', module: 'invoices', description: 'Digitally sign invoices' },
  { name: 'Email Invoices', slug: 'invoices.email', module: 'invoices', description: 'Dispatch invoice PDFs via email' },
  { name: 'Delete Invoices', slug: 'invoices.delete', module: 'invoices', description: 'Delete invoices' },
  { name: 'Manage Finance', slug: 'finance.manage', module: 'invoices', description: 'Full financial & invoice management' },

  // Warehouse Allocation & Logistics Engine
  { name: 'Read Allocation', slug: 'allocation.read', module: 'allocation', description: 'View order warehouse allocations' },
  { name: 'Manage Allocation', slug: 'allocation.manage', module: 'allocation', description: 'Manage allocation engine and PIN codes' },
  { name: 'Read Logistics', slug: 'logistics.read', module: 'logistics', description: 'View courier shipping rates and zones' },
  { name: 'Manage Logistics', slug: 'logistics.manage', module: 'logistics', description: 'Manage courier rates and warehouse zone mappings' },

  // Notifications & Communications
  { name: 'Read Notifications', slug: 'notifications.read', module: 'notifications', description: 'View notifications' },
  { name: 'Create Notifications', slug: 'notifications.create', module: 'notifications', description: 'Send system notifications' },

  // Analytics & Dashboard
  { name: 'View Dashboard', slug: 'dashboard.read', module: 'dashboard', description: 'Access executive dashboard' },
  { name: 'View Reports', slug: 'reports.read', module: 'reports', description: 'Access reports and analytics' },
  { name: 'Read Search Logs', slug: 'search.read', module: 'search', description: 'View search analytics' },

  // System Settings
  { name: 'Read Settings', slug: 'settings.read', module: 'settings', description: 'View system settings' },
  { name: 'Manage Settings', slug: 'settings.manage', module: 'settings', description: 'Manage system settings' },

  // Inventory Management
  { name: 'Read Ventures', slug: 'ventures.read', module: 'inventory', description: 'View ventures' },
  { name: 'Create Ventures', slug: 'ventures.create', module: 'inventory', description: 'Create ventures' },
  { name: 'Update Ventures', slug: 'ventures.update', module: 'inventory', description: 'Update ventures' },
  { name: 'Delete Ventures', slug: 'ventures.delete', module: 'inventory', description: 'Delete ventures' },
  { name: 'Read All Ventures', slug: 'ventures.read.all', module: 'inventory', description: 'Read all ventures across organization' },
  { name: 'Read Inventory Dashboard', slug: 'inventory.dashboard.read', module: 'inventory', description: 'View inventory dashboard' },
  { name: 'Read Inventory Products', slug: 'inventory.products.read', module: 'inventory', description: 'View inventory products' },
  { name: 'Create Inventory Products', slug: 'inventory.products.create', module: 'inventory', description: 'Create inventory products' },
  { name: 'Update Inventory Products', slug: 'inventory.products.update', module: 'inventory', description: 'Edit inventory products' },
  { name: 'Delete Inventory Products', slug: 'inventory.products.delete', module: 'inventory', description: 'Delete inventory products' },
  { name: 'Import Inventory Products', slug: 'inventory.products.import', module: 'inventory', description: 'Bulk import inventory products' },
  { name: 'Export Inventory Products', slug: 'inventory.products.export', module: 'inventory', description: 'Export inventory product data' },
  { name: 'Read Stock', slug: 'inventory.stock.read', module: 'inventory', description: 'View stock levels & history' },
  { name: 'Update Stock', slug: 'inventory.stock.update', module: 'inventory', description: 'Increase or decrease stock levels' },
  { name: 'Adjust Stock', slug: 'inventory.stock.adjust', module: 'inventory', description: 'Perform manual stock adjustments' },
  { name: 'Reconcile Stock', slug: 'inventory.stock.reconcile', module: 'inventory', description: 'Reconcile stock count discrepancies' },
  { name: 'Read Warehouses', slug: 'inventory.warehouses.read', module: 'inventory', description: 'View warehouses' },
  { name: 'Create Warehouses', slug: 'inventory.warehouses.create', module: 'inventory', description: 'Create warehouses' },
  { name: 'Update Warehouses', slug: 'inventory.warehouses.update', module: 'inventory', description: 'Edit warehouses' },
  { name: 'Delete Warehouses', slug: 'inventory.warehouses.delete', module: 'inventory', description: 'Delete warehouses' },
  { name: 'Read Transfers', slug: 'inventory.transfers.read', module: 'inventory', description: 'View stock transfers' },
  { name: 'Create Transfers', slug: 'inventory.transfers.create', module: 'inventory', description: 'Create stock transfers' },
  { name: 'Approve Transfers', slug: 'inventory.transfers.approve', module: 'inventory', description: 'Approve or reject stock transfers' },
  { name: 'Cancel Transfers', slug: 'inventory.transfers.cancel', module: 'inventory', description: 'Cancel pending transfers' },
  { name: 'Read Suppliers', slug: 'inventory.suppliers.read', module: 'inventory', description: 'View suppliers' },
  { name: 'Create Suppliers', slug: 'inventory.suppliers.create', module: 'inventory', description: 'Create suppliers' },
  { name: 'Update Suppliers', slug: 'inventory.suppliers.update', module: 'inventory', description: 'Edit suppliers' },
  { name: 'Delete Suppliers', slug: 'inventory.suppliers.delete', module: 'inventory', description: 'Delete suppliers' },
  { name: 'Read Purchases', slug: 'inventory.purchases.read', module: 'inventory', description: 'View purchase orders' },
  { name: 'Create Purchases', slug: 'inventory.purchases.create', module: 'inventory', description: 'Create purchase orders' },
  { name: 'Receive Purchases', slug: 'inventory.purchases.receive', module: 'inventory', description: 'Receive purchase order stock' },
  { name: 'Payment Purchases', slug: 'inventory.purchases.payment', module: 'inventory', description: 'Manage purchase order payments' },
  { name: 'Read Dispatches', slug: 'inventory.dispatches.read', module: 'inventory', description: 'View stock dispatches' },
  { name: 'Create Dispatches', slug: 'inventory.dispatches.create', module: 'inventory', description: 'Create stock dispatches' },
  { name: 'Update Dispatches', slug: 'inventory.dispatches.update', module: 'inventory', description: 'Update stock dispatches' },
  { name: 'Manage POS', slug: 'inventory.pos.manage', module: 'inventory', description: 'Configure POS settings and registers' },
  { name: 'Sell POS', slug: 'inventory.pos.sell', module: 'inventory', description: 'Perform POS sales' },
  { name: 'Return POS', slug: 'inventory.pos.return', module: 'inventory', description: 'Process POS returns' },
  { name: 'Read Inventory Reports', slug: 'inventory.reports.read', module: 'inventory', description: 'View inventory reports' },
  { name: 'Read Inventory Analytics', slug: 'inventory.analytics.read', module: 'inventory', description: 'View inventory analytics' },
  { name: 'Read Inventory Audit', slug: 'inventory.audit.read', module: 'inventory', description: 'View inventory audit logs' },
];

// ─── 2. Role Definitions & Mappings ───────────────────────────────────────────

const ALL_PERMISSION_SLUGS = PERMISSIONS.map((p) => p.slug);

const SUPER_ADMIN_ONLY_SLUGS = [
  'settings.manage',
  'audit-logs.read',
  'roles.create',
  'roles.delete',
  'users.delete',
];

const ADMIN_PERMISSIONS = ALL_PERMISSION_SLUGS.filter(
  (slug) => !SUPER_ADMIN_ONLY_SLUGS.includes(slug)
);

const ROLES = [
  {
    name: 'Super Admin',
    slug: 'super-admin',
    description: 'Full system access with all permissions',
    isSystem: true,
    permissions: ALL_PERMISSION_SLUGS,
  },
  {
    name: 'Admin',
    slug: 'admin',
    description: 'Administrative access without system critical security controls',
    isSystem: true,
    permissions: ADMIN_PERMISSIONS,
  },
  {
    name: 'Customer',
    slug: 'customer',
    description: 'Regular B2C customer',
    isSystem: true,
    permissions: [],
  },
  {
    name: 'B2B Customer',
    slug: 'b2b-customer',
    description: 'Business-to-business customer with quote access',
    isSystem: true,
    permissions: ['quotes.create', 'quotes.read'],
  },
];

// ─── 3. Data Collections for Phase 1 & 2 ─────────────────────────────────────

const SAMPLE_SETTINGS = [
  { key: 'store_name', value: 'PRC Hardware Enterprise', group: 'GENERAL', isPublic: true },
  { key: 'store_email', value: 'support@pacifichardware.com', group: 'CONTACT', isPublic: true },
  { key: 'store_phone', value: '+91 98765 43210', group: 'CONTACT', isPublic: true },
  { key: 'currency_code', value: 'INR', group: 'FINANCIAL', isPublic: true },
  { key: 'currency_symbol', value: '₹', group: 'FINANCIAL', isPublic: true },
  { key: 'tax_rate', value: '18.00', group: 'FINANCIAL', isPublic: true },
  { key: 'free_shipping_threshold', value: '5000.00', group: 'SHIPPING', isPublic: true },
  { key: 'contact_address', value: '123 Industrial Estate, Peenya Phase 1, Bengaluru, Karnataka 560058', group: 'CONTACT', isPublic: true },
];

const SAMPLE_COUPONS = [
  {
    code: 'WELCOME10',
    description: '10% discount on first order above ₹1000',
    discountType: DiscountType.PERCENTAGE,
    discountValue: 10.0,
    minOrderAmount: 1000.0,
    maxDiscountAmount: 500.0,
    usageLimit: 500,
    perUserLimit: 1,
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    isActive: true,
  },
  {
    code: 'FLAT500',
    description: 'Flat ₹500 off on orders above ₹3000',
    discountType: DiscountType.FIXED_AMOUNT,
    discountValue: 500.0,
    minOrderAmount: 3000.0,
    maxDiscountAmount: 500.0,
    usageLimit: 200,
    perUserLimit: 1,
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    isActive: true,
  },
  {
    code: 'B2BBULK15',
    description: '15% bulk order discount for B2B orders above ₹20000',
    discountType: DiscountType.PERCENTAGE,
    discountValue: 15.0,
    minOrderAmount: 20000.0,
    maxDiscountAmount: 5000.0,
    usageLimit: 50,
    perUserLimit: 2,
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    isActive: true,
  },
];

const SAMPLE_BANNERS = [
  {
    title: 'Heavy Duty Power Tools Mega Sale',
    subtitle: 'Get up to 30% discount on Bosch, Makita & Milwaukee power tools',
    image: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?q=80&w=1200',
    link: '/category/power-tools',
    position: 'HERO',
    order: 1,
    isActive: true,
  },
  {
    title: 'Industrial Fasteners & Hardware Bulk Supply',
    subtitle: 'Wholesale rates for B2B contracts with next-day dispatch',
    image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?q=80&w=1200',
    link: '/category/fasteners',
    position: 'HERO',
    order: 2,
    isActive: true,
  },
  {
    title: 'Certified Safety Gear Clearance',
    subtitle: 'Protect your workforce with ISI certified helmets & safety boots',
    image: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?q=80&w=1200',
    link: '/category/safety-equipment',
    position: 'PROMOTIONAL',
    order: 1,
    isActive: true,
  },
];

const SAMPLE_HOMEPAGE_SECTIONS = [
  {
    title: 'Hero Banner Slider',
    subtitle: 'Main promotion carousel',
    type: 'BANNER_SLIDER',
    position: 1,
    configuration: { bannerPosition: 'HERO' },
    isActive: true,
  },
  {
    title: 'Shop by Category',
    subtitle: 'Explore our top industrial hardware categories',
    type: 'CATEGORY_GRID',
    position: 2,
    configuration: { limit: 6 },
    isActive: true,
  },
  {
    title: 'Featured Power Tools',
    subtitle: 'Top-rated tools tested for maximum performance',
    type: 'FEATURED_PRODUCTS',
    position: 3,
    configuration: { categorySlug: 'power-tools', limit: 8 },
    isActive: true,
  },
];

const SAMPLE_CMS_PAGES = [
  {
    title: 'About Us',
    slug: 'about-us',
    content: `
      <h2>Welcome to PRC Hardware Enterprise</h2>
      <p>PRC Hardware Enterprise is India's leading supplier of professional power tools, hand tools, industrial fasteners, and personal protective safety gear. Serving B2C and B2B clients since 2010, we deliver high-quality, authentic hardware with certified safety compliance.</p>
      <h3>Our Core Strengths</h3>
      <ul>
        <li>Direct authorized distribution for Bosch, Makita, Stanley, Milwaukee, and Taparia.</li>
        <li>Custom B2B quotation workflow with volume discounts.</li>
        <li>Express delivery across major industrial hubs in India.</li>
      </ul>
    `,
    metaTitle: 'About PRC Hardware Enterprise — Premium Industrial Hardware',
    metaDescription: 'Learn about PRC Hardware Enterprise, your trusted B2B and B2C hardware supplier in India.',
    status: ContentStatus.PUBLISHED,
  },
  {
    title: 'Terms & Conditions',
    slug: 'terms-and-conditions',
    content: `
      <h2>Terms and Conditions of Sale</h2>
      <p>By placing an order on PRC Hardware Enterprise, you agree to the following terms and conditions:</p>
      <ol>
        <li><strong>Pricing & Taxes:</strong> All prices listed are subject to 18% GST unless specified otherwise.</li>
        <li><strong>B2B Quotes:</strong> Quotations approved by our sales team are valid for 14 calendar days.</li>
        <li><strong>Warranty:</strong> Power tools carry manufacturer standard warranty servicing.</li>
      </ol>
    `,
    metaTitle: 'Terms & Conditions — PRC Hardware Enterprise',
    metaDescription: 'Official terms and conditions of sale and service at PRC Hardware Enterprise.',
    status: ContentStatus.PUBLISHED,
  },
  {
    title: 'Shipping & Return Policy',
    slug: 'shipping-returns',
    content: `
      <h2>Shipping and Delivery Guidelines</h2>
      <p>Orders placed before 2:00 PM IST are dispatched on the same business day.</p>
      <h3>Return Policy</h3>
      <p>Items can be returned within 7 days of receipt if delivered damaged or incorrect.</p>
    `,
    metaTitle: 'Shipping & Returns — PRC Hardware Enterprise',
    metaDescription: 'Delivery timelines, shipping charges, and returns policy.',
    status: ContentStatus.PUBLISHED,
  },
];

const CATEGORIES = [
  {
    name: 'Power Tools',
    slug: 'power-tools',
    description: 'Electric and battery-powered tools for professional and DIY use',
    position: 1,
    children: [
      { name: 'Drills & Drivers', slug: 'drills-drivers', position: 1 },
      { name: 'Circular Saws', slug: 'circular-saws', position: 2 },
      { name: 'Angle Grinders', slug: 'angle-grinders', position: 3 },
      { name: 'Sanders & Polishers', slug: 'sanders-polishers', position: 4 },
    ],
  },
  {
    name: 'Hand Tools',
    slug: 'hand-tools',
    description: 'Quality hand tools for every trade',
    position: 2,
    children: [
      { name: 'Hammers & Mallets', slug: 'hammers-mallets', position: 1 },
      { name: 'Wrenches & Spanners', slug: 'wrenches-spanners', position: 2 },
      { name: 'Screwdrivers', slug: 'screwdrivers', position: 3 },
      { name: 'Pliers & Cutters', slug: 'pliers-cutters', position: 4 },
    ],
  },
  {
    name: 'Fasteners',
    slug: 'fasteners',
    description: 'Screws, bolts, nuts, and all fastening solutions',
    position: 3,
    children: [
      { name: 'Screws & Bolts', slug: 'screws-bolts', position: 1 },
      { name: 'Nuts & Washers', slug: 'nuts-washers', position: 2 },
      { name: 'Nails & Staples', slug: 'nails-staples', position: 3 },
    ],
  },
  {
    name: 'Safety Equipment',
    slug: 'safety-equipment',
    description: 'Personal protective equipment and safety gear',
    position: 4,
    children: [
      { name: 'Hard Hats & Helmets', slug: 'hard-hats', position: 1 },
      { name: 'Safety Gloves', slug: 'safety-gloves', position: 2 },
      { name: 'Eye Protection', slug: 'eye-protection', position: 3 },
    ],
  },
];

const SAMPLE_PRODUCTS = (drillCategoryId: string, hammerCategoryId: string) => [
  {
    name: 'Bosch GSB 600 Watt Impact Drill',
    slug: 'bosch-gsb-600-impact-drill',
    sku: 'BSH-GSB-600',
    description: 'Professional 600W impact drill with variable speed control and reverse function.',
    shortDesc: '600W Impact Drill with keyless chuck',
    price: 3499.0,
    salePrice: 2999.0,
    stock: 50,
    reorderLevel: 10,
    status: 'ACTIVE' as const,
    isVisible: true,
    isFeatured: true,
    categoryId: drillCategoryId,
    tags: ['bosch', 'drill', 'impact', 'power-tool'],
  },
  {
    name: 'Makita HR2630 SDS-Plus Rotary Hammer',
    slug: 'makita-hr2630-sds-rotary-hammer',
    sku: 'MKT-HR2630',
    description: 'Versatile 3-mode SDS-Plus rotary hammer with 26mm drilling capacity.',
    shortDesc: '26mm SDS-Plus Rotary Hammer',
    price: 8999.0,
    stock: 20,
    reorderLevel: 5,
    status: 'ACTIVE' as const,
    isVisible: true,
    isFeatured: true,
    categoryId: drillCategoryId,
    tags: ['makita', 'rotary-hammer', 'sds', 'power-tool'],
  },
  {
    name: 'Stanley FatMax 16oz Claw Hammer',
    slug: 'stanley-fatmax-16oz-claw-hammer',
    sku: 'STL-FM16CH',
    description: '16oz steel claw hammer with anti-vibration handle for reduced fatigue.',
    shortDesc: '16oz Claw Hammer with anti-vibration grip',
    price: 649.0,
    stock: 200,
    reorderLevel: 30,
    status: 'ACTIVE' as const,
    isVisible: true,
    isFeatured: false,
    categoryId: hammerCategoryId,
    tags: ['stanley', 'hammer', 'hand-tool'],
  },
  {
    name: 'Taparia 11-Piece Combination Wrench Set',
    slug: 'taparia-11pc-combination-wrench-set',
    sku: 'TAP-CWS11',
    description: 'Chrome vanadium steel combination wrench set (8mm–19mm) with roll pouch.',
    shortDesc: '11-piece CrV Combination Wrench Set',
    price: 1299.0,
    salePrice: 999.0,
    stock: 80,
    reorderLevel: 15,
    status: 'ACTIVE' as const,
    isVisible: true,
    isFeatured: false,
    categoryId: hammerCategoryId,
    tags: ['taparia', 'wrench', 'hand-tool', 'set'],
  },
  {
    name: 'Milwaukee M18 FUEL 2-Tool Combo Kit',
    slug: 'milwaukee-m18-fuel-2-tool-combo',
    sku: 'MWK-M18-2TK',
    description: 'M18 FUEL brushless hammer drill and impact driver combo with 2x batteries.',
    shortDesc: 'M18 FUEL Combo Kit — Drill + Driver',
    price: 24999.0,
    salePrice: 21999.0,
    stock: 15,
    reorderLevel: 3,
    status: 'ACTIVE' as const,
    isVisible: true,
    isFeatured: true,
    categoryId: drillCategoryId,
    tags: ['milwaukee', 'm18', 'cordless', 'combo', 'power-tool'],
  },
];

// ─── 4. Main Seed Execution ───────────────────────────────────────────────────

async function main() {
  console.log('🌱 Starting database seed...\n');

  // 1. Permissions
  console.log('📋 Seeding permissions catalog...');
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { slug: perm.slug },
      update: perm,
      create: perm,
    });
  }
  console.log(`   ✅ ${PERMISSIONS.length} permissions upserted successfully.`);

  // 2. Roles
  console.log('🔑 Seeding system roles & mapping permissions...');
  for (const roleDef of ROLES) {
    const { permissions, ...roleData } = roleDef;
    const role = await prisma.role.upsert({
      where: { slug: roleData.slug },
      update: { name: roleData.name, description: roleData.description },
      create: roleData,
    });

    const permRecords = await prisma.permission.findMany({
      where: { slug: { in: permissions } },
    });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    if (permRecords.length > 0) {
      await prisma.rolePermission.createMany({
        data: permRecords.map((p) => ({ roleId: role.id, permissionId: p.id })),
      });
    }
  }
  console.log(`   ✅ ${ROLES.length} roles created & mapped.`);

  // 3. Admin User
  console.log('👤 Seeding default super-admin user...');
  const seedAdminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@pacifichardware.com';
  const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@123';
  const superAdminRole = await prisma.role.findUnique({ where: { slug: 'super-admin' } });
  const adminHash = await bcrypt.hash(seedAdminPassword, 12);

  const adminUser = await prisma.user.upsert({
    where: { email: seedAdminEmail },
 update: {
      passwordHash: adminHash,
    },
    create: {
      email: seedAdminEmail,
      passwordHash: adminHash,
      firstName: 'Super',
      lastName: 'Admin',
      status: 'ACTIVE',
      isVerified: true,
    },
  });

  if (superAdminRole) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: adminUser.id, roleId: superAdminRole.id } },
      update: {},
      create: { userId: adminUser.id, roleId: superAdminRole.id },
    });
  }
  console.log(`   ✅ Super admin user ready: ${seedAdminEmail}`);

  // 4. System Settings
  console.log('⚙️ Seeding system settings...');
  for (const setting of SAMPLE_SETTINGS) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: { value: setting.value, group: setting.group, isPublic: setting.isPublic },
      create: setting,
    });
  }
  console.log(`   ✅ ${SAMPLE_SETTINGS.length} system settings seeded.`);

  // 5. Coupons
  console.log('🎟️ Seeding sample coupons...');
  for (const coupon of SAMPLE_COUPONS) {
    await prisma.coupon.upsert({
      where: { code: coupon.code },
      update: coupon,
      create: coupon,
    });
  }
  console.log(`   ✅ ${SAMPLE_COUPONS.length} sample coupons seeded.`);

  // 6. Banners
  console.log('🖼️ Seeding promotional banners...');
  for (const banner of SAMPLE_BANNERS) {
    const existing = await prisma.banner.findFirst({ where: { title: banner.title } });
    if (existing) {
      await prisma.banner.update({ where: { id: existing.id }, data: banner });
    } else {
      await prisma.banner.create({ data: banner });
    }
  }
  console.log(`   ✅ ${SAMPLE_BANNERS.length} banners seeded.`);

  // 7. Homepage Sections
  console.log('🏠 Seeding homepage sections...');
  for (const section of SAMPLE_HOMEPAGE_SECTIONS) {
    const existing = await prisma.homepageSection.findFirst({ where: { title: section.title } });
    if (existing) {
      await prisma.homepageSection.update({ where: { id: existing.id }, data: section });
    } else {
      await prisma.homepageSection.create({ data: section });
    }
  }
  console.log(`   ✅ ${SAMPLE_HOMEPAGE_SECTIONS.length} homepage sections seeded.`);

  // 8. CMS Pages
  console.log('📄 Seeding static CMS pages...');
  for (const page of SAMPLE_CMS_PAGES) {
    await prisma.cmsPage.upsert({
      where: { slug: page.slug },
      update: page,
      create: page,
    });
  }
  console.log(`   ✅ ${SAMPLE_CMS_PAGES.length} CMS pages seeded.`);

  // 9. Shipping Zone & Rates
  console.log('🚚 Seeding shipping zones & rates...');
  let defaultZone = await prisma.shippingZone.findFirst({ where: { name: 'Pan-India Standard Zone' } });
  if (!defaultZone) {
    defaultZone = await prisma.shippingZone.create({
      data: {
        name: 'Pan-India Standard Zone',
        countries: ['India'],
        states: [],
        postalCodes: [],
        isActive: true,
      },
    });
  }

  const rates = [
    {
      zoneId: defaultZone.id,
      name: 'Standard Delivery',
      minWeight: 0,
      maxWeight: 10,
      rate: 100.0,
      estimatedDays: '3-5 Business Days',
      isActive: true,
    },
    {
      zoneId: defaultZone.id,
      name: 'Express Delivery',
      minWeight: 0,
      maxWeight: 10,
      rate: 250.0,
      estimatedDays: '1-2 Business Days',
      isActive: true,
    },
  ];

  for (const rateData of rates) {
    const existingRate = await prisma.shippingRate.findFirst({
      where: { zoneId: defaultZone.id, name: rateData.name },
    });
    if (existingRate) {
      await prisma.shippingRate.update({ where: { id: existingRate.id }, data: rateData });
    } else {
      await prisma.shippingRate.create({ data: rateData });
    }
  }
  console.log('   ✅ Shipping zone and rates seeded.');

  // 10. FAQ Categories & FAQs
  console.log('❓ Seeding FAQ categories & FAQs...');
  const faqCategory = await prisma.faqCategory.upsert({
    where: { slug: 'general' },
    update: { name: 'General Questions', position: 1, isActive: true },
    create: { name: 'General Questions', slug: 'general', description: 'Frequently asked store questions', position: 1, isActive: true },
  });

  const sampleFaqs = [
    {
      categoryId: faqCategory.id,
      question: 'What payment methods do you accept?',
      answer: 'We accept Razorpay (Cards, UPI, NetBanking), Direct Bank Transfer for B2B, and Cash on Delivery (COD).',
      position: 1,
      isActive: true,
    },
    {
      categoryId: faqCategory.id,
      question: 'How do I place a bulk B2B quote request?',
      answer: 'Registered B2B customers can add items to quote cart and submit a quote request directly from the product page.',
      position: 2,
      isActive: true,
    },
  ];

  for (const faq of sampleFaqs) {
    const existingFaq = await prisma.faq.findFirst({
      where: { categoryId: faqCategory.id, question: faq.question },
    });
    if (existingFaq) {
      await prisma.faq.update({ where: { id: existingFaq.id }, data: faq });
    } else {
      await prisma.faq.create({ data: faq });
    }
  }
  console.log('   ✅ FAQ category and FAQs seeded.');

  // 11. Categories & Sample Products
  console.log('📁 Seeding product categories & sample products...');
  let drillCategoryId = '';
  let hammerCategoryId = '';

  for (const catDef of CATEGORIES) {
    const { children, ...catData } = catDef;
    const parent = await prisma.category.upsert({
      where: { slug: catData.slug },
      update: { name: catData.name, description: catData.description },
      create: { ...catData, level: 0, status: 'ACTIVE', isVisible: true },
    });

    for (const child of children) {
      const childCat = await prisma.category.upsert({
        where: { slug: child.slug },
        update: { name: child.name },
        create: {
          ...child,
          parentId: parent.id,
          level: 1,
          status: 'ACTIVE',
          isVisible: true,
        },
      });

      if (child.slug === 'drills-drivers') drillCategoryId = childCat.id;
      if (child.slug === 'hammers-mallets') hammerCategoryId = childCat.id;
    }
  }

  const sampleProducts = SAMPLE_PRODUCTS(drillCategoryId, hammerCategoryId);
  for (const prod of sampleProducts) {
    await prisma.product.upsert({
      where: { sku: prod.sku },
      update: { name: prod.name, price: prod.price },
      create: { ...prod, rating: 0, reviewCount: 0, images: [] },
    });
  }
  console.log(`   ✅ Categories & ${sampleProducts.length} sample products created.`);

  // 12. Venture, Warehouses & PIN Codes (Intelligent Allocation Engine Seed)
  console.log('🏭 Seeding venture, Delhi & Kolkata warehouses & sample PIN codes...');
  
  const defaultVenture = await prisma.venture.upsert({
    where: { code: 'PRC-RETAIL' },
    update: { name: 'PRC Hardware Retail', status: 'ACTIVE' },
    create: {
      name: 'PRC Hardware Retail',
      slug: 'prc-hardware-retail',
      code: 'PRC-RETAIL',
      type: 'RETAIL',
      status: 'ACTIVE',
      contactEmail: 'retail@pacifichardware.com',
    },
  });

  const delhiWh = await prisma.warehouse.upsert({
    where: { code: 'DELHI-WH-01' },
    update: {
      name: 'Delhi Central Warehouse',
      latitude: 28.6139,
      longitude: 77.2090,
      city: 'Delhi',
      state: 'Delhi',
      pincode: '110001',
      isActive: true,
      status: 'ACTIVE',
    },
    create: {
      ventureId: defaultVenture.id,
      name: 'Delhi Central Warehouse',
      code: 'DELHI-WH-01',
      type: 'MAIN',
      address: 'Plot 42, Connaught Place Industrial Area',
      city: 'Delhi',
      state: 'Delhi',
      pincode: '110001',
      country: 'India',
      latitude: 28.6139,
      longitude: 77.2090,
      isActive: true,
      status: 'ACTIVE',
      priority: 10,
    },
  });

  const kolkataWh = await prisma.warehouse.upsert({
    where: { code: 'KOLKATA-WH-01' },
    update: {
      name: 'Kolkata Hub Warehouse',
      latitude: 22.5726,
      longitude: 88.3639,
      city: 'Kolkata',
      state: 'West Bengal',
      pincode: '700001',
      isActive: true,
      status: 'ACTIVE',
    },
    create: {
      ventureId: defaultVenture.id,
      name: 'Kolkata Hub Warehouse',
      code: 'KOLKATA-WH-01',
      type: 'MAIN',
      address: 'Building B, Strand Road Logistics Zone',
      city: 'Kolkata',
      state: 'West Bengal',
      pincode: '700001',
      country: 'India',
      latitude: 22.5726,
      longitude: 88.3639,
      isActive: true,
      status: 'ACTIVE',
      priority: 5,
    },
  });

  // Seed sample PIN codes
  const samplePincodes = [
    { pincode: '110001', city: 'New Delhi', district: 'Central Delhi', state: 'Delhi', latitude: 28.6139, longitude: 77.2090, geohash: 'tt921b' },
    { pincode: '110002', city: 'New Delhi', district: 'Central Delhi', state: 'Delhi', latitude: 28.6360, longitude: 77.2410, geohash: 'tt924e' },
    { pincode: '700001', city: 'Kolkata', district: 'Kolkata', state: 'West Bengal', latitude: 22.5726, longitude: 88.3639, geohash: 'tup1ed' },
    { pincode: '700002', city: 'Kolkata', district: 'Kolkata', state: 'West Bengal', latitude: 22.6000, longitude: 88.3700, geohash: 'tup1gh' },
    { pincode: '400001', city: 'Mumbai', district: 'Mumbai City', state: 'Maharashtra', latitude: 18.9388, longitude: 72.8353, geohash: 'te7udv' },
    { pincode: '560001', city: 'Bengaluru', district: 'Bengaluru Urban', state: 'Karnataka', latitude: 12.9716, longitude: 77.5946, geohash: 'tdr4cf' },
    { pincode: '600001', city: 'Chennai', district: 'Chennai', state: 'Tamil Nadu', latitude: 13.0827, longitude: 80.2707, geohash: 'tf347w' },
    { pincode: '500001', city: 'Hyderabad', district: 'Hyderabad', state: 'Telangana', latitude: 17.3850, longitude: 78.4867, geohash: 'te7udv' },
  ];

  for (const pin of samplePincodes) {
    await prisma.pinCode.upsert({
      where: { pincode: pin.pincode },
      update: pin,
      create: pin,
    });
  }

  // Create inventory products and stock for products in seeded warehouses
  const dbProducts = await prisma.product.findMany({ take: 10 });
  for (const p of dbProducts) {
    const invProd = await prisma.inventoryProduct.upsert({
      where: { sku: p.sku },
      update: { productId: p.id, ventureId: defaultVenture.id },
      create: {
        productId: p.id,
        ventureId: defaultVenture.id,
        sku: p.sku,
        purchasePrice: Number(p.price) * 0.7,
        sellingPrice: Number(p.price),
        mrp: Number(p.price) * 1.2,
        status: 'ACTIVE',
      },
    });

    // Stock in Delhi Warehouse
    await prisma.inventoryStock.upsert({
      where: { inventoryProductId_warehouseId: { inventoryProductId: invProd.id, warehouseId: delhiWh.id } },
      update: { quantity: 100 },
      create: {
        inventoryProductId: invProd.id,
        warehouseId: delhiWh.id,
        ventureId: defaultVenture.id,
        quantity: 100,
        reservedQty: 0,
      },
    });

    // Stock in Kolkata Warehouse
    await prisma.inventoryStock.upsert({
      where: { inventoryProductId_warehouseId: { inventoryProductId: invProd.id, warehouseId: kolkataWh.id } },
      update: { quantity: 100 },
      create: {
        inventoryProductId: invProd.id,
        warehouseId: kolkataWh.id,
        ventureId: defaultVenture.id,
        quantity: 100,
        reservedQty: 0,
      },
    });
  }

  console.log('   ✅ Venture, Delhi & Kolkata warehouses, PIN codes, and inventory stock seeded.');

  // 13. Couriers, Zones, Warehouse Mappings & Rates (Lowest Shipping Cost Engine Seed)
  console.log('🚚 Seeding Couriers, Shipping Zones, Warehouse Mappings & Courier Rates...');

  const courierExpress = await prisma.courier.upsert({
    where: { code: 'EXPRESS_LOGISTICS' },
    update: { name: 'Express Industrial Logistics', isActive: true },
    create: {
      name: 'Express Industrial Logistics',
      code: 'EXPRESS_LOGISTICS',
      isActive: true,
      trackingUrl: 'https://track.pacifichardware.com/express/{trackingNumber}',
    },
  });

  const courierBlueDart = await prisma.courier.upsert({
    where: { code: 'BLUEDART' },
    update: { name: 'BlueDart Surface', isActive: true },
    create: {
      name: 'BlueDart Surface',
      code: 'BLUEDART',
      isActive: true,
      trackingUrl: 'https://bluedart.com/tracking/{trackingNumber}',
    },
  });

  // Zones
  const zoneNorth = await prisma.shippingZone.upsert({
    where: { id: 'zone-north-01' },
    update: { name: 'North Zone (Delhi Hub)', zoneCode: 'ZONE-NORTH' },
    create: {
      id: 'zone-north-01',
      courierId: courierExpress.id,
      zoneCode: 'ZONE-NORTH',
      zoneName: 'North India Zone',
      name: 'North Zone (Delhi Hub)',
      description: 'Covering Delhi NCR, Punjab, Haryana, UP, Rajasthan',
      states: ['Delhi', 'Haryana', 'Punjab', 'Uttar Pradesh', 'Rajasthan'],
      isActive: true,
    },
  });

  const zoneEast = await prisma.shippingZone.upsert({
    where: { id: 'zone-east-01' },
    update: { name: 'East Zone (Kolkata Hub)', zoneCode: 'ZONE-EAST' },
    create: {
      id: 'zone-east-01',
      courierId: courierExpress.id,
      zoneCode: 'ZONE-EAST',
      zoneName: 'East India Zone',
      name: 'East Zone (Kolkata Hub)',
      description: 'Covering West Bengal, Odisha, Bihar, Assam, Northeast',
      states: ['West Bengal', 'Odisha', 'Bihar', 'Assam'],
      isActive: true,
    },
  });

  const zoneWestSouth = await prisma.shippingZone.upsert({
    where: { id: 'zone-westsouth-01' },
    update: { name: 'West & South Zone', zoneCode: 'ZONE-WESTSOUTH' },
    create: {
      id: 'zone-westsouth-01',
      courierId: courierBlueDart.id,
      zoneCode: 'ZONE-WESTSOUTH',
      zoneName: 'West & South India Zone',
      name: 'West & South Zone',
      description: 'Covering Maharashtra, Gujarat, Karnataka, Tamil Nadu, Telangana',
      states: ['Maharashtra', 'Gujarat', 'Karnataka', 'Tamil Nadu', 'Telangana'],
      isActive: true,
    },
  });

  // Warehouse-Zone PIN Mappings
  // Delhi Warehouse mappings
  const existingMapping1 = await prisma.warehouseZoneMapping.findFirst({
    where: { warehouseId: delhiWh.id, zoneId: zoneNorth.id },
  });
  if (!existingMapping1) {
    await prisma.warehouseZoneMapping.create({
      data: {
        warehouseId: delhiWh.id,
        zoneId: zoneNorth.id,
        pinStart: '110000',
        pinEnd: '349999',
      },
    });
  }

  // Kolkata Warehouse mappings
  const existingMapping2 = await prisma.warehouseZoneMapping.findFirst({
    where: { warehouseId: kolkataWh.id, zoneId: zoneEast.id },
  });
  if (!existingMapping2) {
    await prisma.warehouseZoneMapping.create({
      data: {
        warehouseId: kolkataWh.id,
        zoneId: zoneEast.id,
        pinStart: '700000',
        pinEnd: '799999',
      },
    });
  }

  // Courier Rates
  // North Zone Rates (Cheap local rates for Delhi WH)
  const existingRate1 = await prisma.courierRate.findFirst({
    where: { courierId: courierExpress.id, zoneId: zoneNorth.id },
  });
  if (!existingRate1) {
    await prisma.courierRate.create({
      data: {
        courierId: courierExpress.id,
        zoneId: zoneNorth.id,
        weightFrom: 0,
        weightTo: 5,
        baseRate: 50.0, // ₹50 local shipping from Delhi to North
        additionalRate: 10.0,
        fuelSurcharge: 5.0, // 5%
        handlingCharge: 10.0,
        codCharge: 30.0,
        estimatedDeliveryDays: 1,
        isActive: true,
      },
    });
  }

  // East Zone Rates (Cheap local rates for Kolkata WH)
  const existingRate2 = await prisma.courierRate.findFirst({
    where: { courierId: courierExpress.id, zoneId: zoneEast.id },
  });
  if (!existingRate2) {
    await prisma.courierRate.create({
      data: {
        courierId: courierExpress.id,
        zoneId: zoneEast.id,
        weightFrom: 0,
        weightTo: 5,
        baseRate: 55.0, // ₹55 local shipping from Kolkata to East
        additionalRate: 12.0,
        fuelSurcharge: 5.0,
        handlingCharge: 10.0,
        codCharge: 30.0,
        estimatedDeliveryDays: 1,
        isActive: true,
      },
    });
  }

  // Interstate / Cross-Zone Rates (Delhi to East = ₹180, Kolkata to North = ₹190)
  const existingRate3 = await prisma.courierRate.findFirst({
    where: { courierId: courierBlueDart.id, zoneId: zoneNorth.id },
  });
  if (!existingRate3) {
    await prisma.courierRate.create({
      data: {
        courierId: courierBlueDart.id,
        zoneId: zoneNorth.id,
        weightFrom: 0,
        weightTo: 5,
        baseRate: 180.0,
        additionalRate: 25.0,
        fuelSurcharge: 10.0,
        handlingCharge: 20.0,
        codCharge: 50.0,
        estimatedDeliveryDays: 4,
        isActive: true,
      },
    });
  }

  console.log('   ✅ Couriers, Shipping Zones, Warehouse Mappings, and Courier Rates seeded.');

  console.log(`   Admin login: ${process.env.SEED_ADMIN_EMAIL || 'admin@pacifichardware.com'} (password set via SEED_ADMIN_PASSWORD)`);
}

main()
  .catch((e) => {
    console.error('❌ Database seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
