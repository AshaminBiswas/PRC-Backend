/**
 * seed-all-permissions.js
 *
 * Comprehensive Upsert Script for ALL Platform Permissions.
 * Ensures Super Admin has 100% control to manage and assign every single module
 * and granular capability across PRC Hardware.
 */

'use strict';

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ALL_SYSTEM_PERMISSIONS = [
  // ─── 1. Auth & Security ────────────────────────────────────────────────────
  { name: 'View Auth Logs', slug: 'auth.logs', module: 'auth', description: 'View authentication logs and login attempts' },
  { name: 'Read Audit Logs', slug: 'audit-logs.read', module: 'audit-logs', description: 'View administrative action audit logs' },

  // ─── 2. Users ──────────────────────────────────────────────────────────────
  { name: 'Read Users', slug: 'users.read', module: 'users', description: 'View user list, customer profiles, and staff accounts' },
  { name: 'Create Users', slug: 'users.create', module: 'users', description: 'Create new user accounts and admin staff' },
  { name: 'Update Users', slug: 'users.update', module: 'users', description: 'Edit user accounts, roles, and profile information' },
  { name: 'Delete Users', slug: 'users.delete', module: 'users', description: 'Deactivate or delete user accounts' },

  // ─── 3. Roles & RBAC ───────────────────────────────────────────────────────
  { name: 'Read Roles', slug: 'roles.read', module: 'roles', description: 'View RBAC roles, permission assignments, and matrix' },
  { name: 'Create Roles', slug: 'roles.create', module: 'roles', description: 'Create new customized RBAC roles' },
  { name: 'Update Roles', slug: 'roles.update', module: 'roles', description: 'Edit custom roles and configure permission matrices' },
  { name: 'Delete Roles', slug: 'roles.delete', module: 'roles', description: 'Delete custom roles without assigned users' },

  // ─── 4. Categories ─────────────────────────────────────────────────────────
  { name: 'Read Categories', slug: 'categories.read', module: 'categories', description: 'View catalog categories taxonomy' },
  { name: 'Create Categories', slug: 'categories.create', module: 'categories', description: 'Create new product categories' },
  { name: 'Update Categories', slug: 'categories.update', module: 'categories', description: 'Edit category metadata, hierarchy, and visibility' },
  { name: 'Delete Categories', slug: 'categories.delete', module: 'categories', description: 'Delete catalog categories' },

  // ─── 5. Products & Variants ────────────────────────────────────────────────
  { name: 'Read Products', slug: 'products.read', module: 'products', description: 'View products, prices, specs, and stock levels' },
  { name: 'Create Products', slug: 'products.create', module: 'products', description: 'Create new hardware SKUs and catalog items' },
  { name: 'Update Products', slug: 'products.update', module: 'products', description: 'Edit product specifications, pricing, and media' },
  { name: 'Delete Products', slug: 'products.delete', module: 'products', description: 'Archive or delete products' },
  { name: 'Read Variants', slug: 'variants.read', module: 'variants', description: 'View product SKU variants (finishes, sizes, models)' },
  { name: 'Create Variants', slug: 'variants.create', module: 'variants', description: 'Create new SKU variants' },
  { name: 'Update Variants', slug: 'variants.update', module: 'variants', description: 'Edit SKU variant attributes, price overrides, and stock' },
  { name: 'Delete Variants', slug: 'variants.delete', module: 'variants', description: 'Delete SKU variants' },

  // ─── 6. Wishlist, Cart & Checkout ──────────────────────────────────────────
  { name: 'Read Wishlists', slug: 'wishlist.read', module: 'wishlist', description: 'View customer saved wishlists' },
  { name: 'Manage Wishlists', slug: 'wishlist.manage', module: 'wishlist', description: 'Manage customer wishlists' },
  { name: 'Read Carts', slug: 'cart.read', module: 'cart', description: 'View active customer shopping carts' },
  { name: 'Manage Carts', slug: 'cart.manage', module: 'cart', description: 'Modify or clear customer carts' },
  { name: 'Manage Checkout', slug: 'checkout.manage', module: 'checkout', description: 'Configure checkout rules and thresholds' },

  // ─── 7. Orders ─────────────────────────────────────────────────────────────
  { name: 'Read Orders', slug: 'orders.read', module: 'orders', description: 'View customer orders and fulfillment milestones' },
  { name: 'Create Orders', slug: 'orders.create', module: 'orders', description: 'Create manual admin orders or convert quotes' },
  { name: 'Update Orders', slug: 'orders.update', module: 'orders', description: 'Update order status, tracking numbers, and items' },
  { name: 'Delete Orders', slug: 'orders.delete', module: 'orders', description: 'Cancel or void customer orders' },
  { name: 'Manage Orders', slug: 'orders.manage', module: 'orders', description: 'Full order lifecycle and dispute management' },
  { name: 'Edit Orders', slug: 'orders.edit', module: 'orders', description: 'Edit line items, customer details, or payment status' },

  // ─── 8. Quotes (B2B Bulk RFQ) ──────────────────────────────────────────────
  { name: 'Read Quotes', slug: 'quotes.read', module: 'quotes', description: 'View B2B quotation requests and inquiries' },
  { name: 'Create Quotes', slug: 'quotes.create', module: 'quotes', description: 'Generate custom quotation proposals' },
  { name: 'Update Quotes', slug: 'quotes.update', module: 'quotes', description: 'Edit quotation line items, discounts, and terms' },
  { name: 'Approve Quotes', slug: 'quotes.approve', module: 'quotes', description: 'Approve or reject quotation pricing' },
  { name: 'Manage Quotes', slug: 'quotes.manage', module: 'quotes', description: 'Full quotation pipeline management' },
  { name: 'Edit Quotes', slug: 'quotes.edit', module: 'quotes', description: 'Edit draft quotation proposals' },

  // ─── 9. Reviews & Moderation ───────────────────────────────────────────────
  { name: 'Read Reviews', slug: 'reviews.read', module: 'reviews', description: 'View customer ratings and product reviews' },
  { name: 'Moderate Reviews', slug: 'reviews.moderate', module: 'reviews', description: 'Approve, feature, or hide customer reviews' },
  { name: 'Delete Reviews', slug: 'reviews.delete', module: 'reviews', description: 'Delete spam or inappropriate reviews' },

  // ─── 10. Enquiries & Support ───────────────────────────────────────────────
  { name: 'Read Enquiries', slug: 'enquiries.read', module: 'enquiries', description: 'View customer inquiries and contact requests' },
  { name: 'Update Enquiries', slug: 'enquiries.update', module: 'enquiries', description: 'Update enquiry status, notes, and replies' },
  { name: 'Delete Enquiries', slug: 'enquiries.delete', module: 'enquiries', description: 'Delete customer enquiries' },

  // ─── 11. CMS (Pages, Blog, FAQ) ────────────────────────────────────────────
  { name: 'Read CMS', slug: 'cms.read', module: 'cms', description: 'View CMS pages, blog articles, and FAQ entries' },
  { name: 'Create CMS', slug: 'cms.create', module: 'cms', description: 'Create new CMS pages, articles, and FAQ categories' },
  { name: 'Update CMS', slug: 'cms.update', module: 'cms', description: 'Edit CMS content, rich HTML, and SEO tags' },
  { name: 'Delete CMS', slug: 'cms.delete', module: 'cms', description: 'Delete CMS pages and articles' },
  { name: 'Manage CMS', slug: 'cms.manage', module: 'cms', description: 'Full CMS and content management' },

  // ─── 12. Banners & Homepage ────────────────────────────────────────────────
  { name: 'Read Banners', slug: 'banners.read', module: 'banners', description: 'View promotional banners and sliders' },
  { name: 'Create Banners', slug: 'banners.create', module: 'banners', description: 'Create new promotional hero banners' },
  { name: 'Update Banners', slug: 'banners.update', module: 'banners', description: 'Edit banner targeting, links, and positions' },
  { name: 'Delete Banners', slug: 'banners.delete', module: 'banners', description: 'Delete promotional banners' },
  { name: 'Read Homepage', slug: 'homepage.read', module: 'homepage', description: 'View storefront homepage layout sections' },
  { name: 'Manage Homepage', slug: 'homepage.manage', module: 'homepage', description: 'Reorder homepage sections and featured collections' },

  // ─── 13. Coupons & Promotions ──────────────────────────────────────────────
  { name: 'Read Coupons', slug: 'coupons.read', module: 'coupons', description: 'View discount coupons and promotional campaigns' },
  { name: 'Create Coupons', slug: 'coupons.create', module: 'coupons', description: 'Create new discount coupon codes' },
  { name: 'Update Coupons', slug: 'coupons.update', module: 'coupons', description: 'Edit coupon discounts, validity, and usage limits' },
  { name: 'Delete Coupons', slug: 'coupons.delete', module: 'coupons', description: 'Delete discount coupon codes' },

  // ─── 14. Payments & Shipping ───────────────────────────────────────────────
  { name: 'Read Payments', slug: 'payments.read', module: 'payments', description: 'View gateway transactions (Razorpay, PhonePe)' },
  { name: 'Refund Payments', slug: 'payments.refund', module: 'payments', description: 'Authorize and execute payment refunds' },
  { name: 'Read Shipping', slug: 'shipping.read', module: 'shipping', description: 'View shipping rates, zones, and SLAs' },
  { name: 'Manage Shipping', slug: 'shipping.manage', module: 'shipping', description: 'Configure shipping zones, rates, and carrier partners' },

  // ─── 15. Invoices & GST Tax Hub ────────────────────────────────────────────
  { name: 'Read Invoices', slug: 'invoices.read', module: 'invoices', description: 'View GST tax invoices, sequence numbers, and IRN' },
  { name: 'Create Invoices', slug: 'invoices.create', module: 'invoices', description: 'Generate GST compliant tax invoices' },
  { name: 'Update Invoices', slug: 'invoices.update', module: 'invoices', description: 'Edit draft invoices and line items' },
  { name: 'Edit Invoices', slug: 'invoices.edit', module: 'invoices', description: 'Edit invoice particulars and notes' },
  { name: 'Approve Invoices', slug: 'invoices.approve', module: 'invoices', description: 'Approve invoices and lock financial figures' },
  { name: 'Cancel Invoices', slug: 'invoices.cancel', module: 'invoices', description: 'Cancel invoices and issue credit/debit notes' },
  { name: 'Sign Invoices', slug: 'invoices.sign', module: 'invoices', description: 'Digitally sign invoices with cryptographic certificate' },
  { name: 'Email Invoices', slug: 'invoices.email', module: 'invoices', description: 'Email official invoice PDFs to customers' },
  { name: 'Delete Invoices', slug: 'invoices.delete', module: 'invoices', description: 'Delete draft invoices' },
  { name: 'Manage Finance', slug: 'finance.manage', module: 'invoices', description: 'Full financial controls, tax settings, and ledgers' },

  // ─── 16. Allocation & Logistics ────────────────────────────────────────────
  { name: 'Read Allocation', slug: 'allocation.read', module: 'allocation', description: 'View order warehouse routing and fulfillment scores' },
  { name: 'Manage Allocation', slug: 'allocation.manage', module: 'allocation', description: 'Manage allocation engine formulas and pincode mappings' },
  { name: 'Read Logistics', slug: 'logistics.read', module: 'logistics', description: 'View courier shipping rates and logistics zones' },
  { name: 'Manage Logistics', slug: 'logistics.manage', module: 'logistics', description: 'Manage courier rates and warehouse zone mappings' },

  // ─── 17. Notifications, Search & Settings ──────────────────────────────────
  { name: 'Read Notifications', slug: 'notifications.read', module: 'notifications', description: 'View real-time system notifications and alerts' },
  { name: 'Create Notifications', slug: 'notifications.create', module: 'notifications', description: 'Broadcast admin or customer notifications' },
  { name: 'View Dashboard', slug: 'dashboard.read', module: 'dashboard', description: 'Access executive analytics, revenue KPIs, and growth charts' },
  { name: 'View Reports', slug: 'reports.read', module: 'reports', description: 'Access financial, sales, and inventory report dashboards' },
  { name: 'Export Reports', slug: 'reports.export', module: 'reports', description: 'Download CSV, Excel, and PDF reports' },
  { name: 'Read Search Logs', slug: 'search.read', module: 'search', description: 'View customer search query analytics' },
  { name: 'Read Settings', slug: 'settings.read', module: 'settings', description: 'View system configurations, company info, and parameters' },
  { name: 'Manage Settings', slug: 'settings.manage', module: 'settings', description: 'Modify system configurations, GSTIN, and company details' },

  // ─── 18. Inventory & Stock ─────────────────────────────────────────────────
  { name: 'Read Stock', slug: 'inventory.stock.read', module: 'inventory', description: 'View branch inventory levels and reserved stock' },
  { name: 'Update Stock', slug: 'inventory.stock.write', module: 'inventory', description: 'Update stock levels and log movements' },
  { name: 'Adjust Stock', slug: 'inventory.stock.adjust', module: 'inventory', description: 'Perform manual stock adjustments, cycle counts, or damages' },
  { name: 'Reconcile Stock', slug: 'inventory.stock.reconcile', module: 'inventory', description: 'Reconcile physical stock discrepancies' },
  { name: 'View Inventory', slug: 'inventory.view', module: 'inventory', description: 'View multi-branch inventory tracking hub' },
  { name: 'Adjust Inventory', slug: 'inventory.adjust', module: 'inventory', description: 'Adjust multi-branch inventory counts' },
  { name: 'Read Inventory Dashboard', slug: 'inventory.dashboard.read', module: 'inventory', description: 'View multi-branch inventory KPIs and alerts' },
  { name: 'Read Inventory Products', slug: 'inventory.products.read', module: 'inventory', description: 'View inventory product catalog' },
  { name: 'Create Inventory Products', slug: 'inventory.products.create', module: 'inventory', description: 'Register new inventory product items' },
  { name: 'Update Inventory Products', slug: 'inventory.products.update', module: 'inventory', description: 'Edit inventory product specifications' },
  { name: 'Delete Inventory Products', slug: 'inventory.products.delete', module: 'inventory', description: 'Delete inventory product items' },
  { name: 'Import Inventory Products', slug: 'inventory.products.import', module: 'inventory', description: 'Bulk import inventory items from CSV/Excel' },
  { name: 'Export Inventory Products', slug: 'inventory.products.export', module: 'inventory', description: 'Bulk export inventory items to CSV/Excel' },
  { name: 'Read Inventory Reports', slug: 'inventory.reports.read', module: 'inventory', description: 'View stock turnover, low stock, and procurement reports' },
  { name: 'Read Inventory Audit', slug: 'inventory.audit.read', module: 'inventory', description: 'View chronological stock movement ledger' },
  { name: 'Manage Inventory Audit', slug: 'inventory.audit.manage', module: 'inventory', description: 'Correct or reverse erroneous stock movements' },
  { name: 'Read Warehouses', slug: 'inventory.warehouses.read', module: 'inventory', description: 'View warehouse fulfillment facilities' },
  { name: 'Create Warehouses', slug: 'inventory.warehouses.create', module: 'inventory', description: 'Register new warehouse facilities' },
  { name: 'Update Warehouses', slug: 'inventory.warehouses.update', module: 'inventory', description: 'Edit warehouse details and pincodes' },
  { name: 'Delete Warehouses', slug: 'inventory.warehouses.delete', module: 'inventory', description: 'Delete warehouse facilities' },

  // ─── 19. Employee Management Master HR ─────────────────────────────────────
  { name: 'Read Employees', slug: 'employees.read', module: 'employees', description: 'View employee directory, profiles, and employment credentials' },
  { name: 'Create Employees', slug: 'employees.create', module: 'employees', description: 'Register new employees with auto-generated PPSE ID and salary' },
  { name: 'Update Employees', slug: 'employees.update', module: 'employees', description: 'Edit employee profile, designation, CTC, and banking details' },
  { name: 'Delete Employees', slug: 'employees.delete', module: 'employees', description: 'Deactivate or terminate employee records' },
  { name: 'Export Employees', slug: 'employees.export', module: 'employees', description: 'Export employee directory and master data to Excel' },

  // ─── 20. Attendance ────────────────────────────────────────────────────────
  { name: 'Read Attendance', slug: 'attendance.read', module: 'attendance', description: 'View daily attendance records, punch logs, and overtime hours' },
  { name: 'Mark Attendance', slug: 'attendance.mark', module: 'attendance', description: 'Record employee attendance status (Present, CL, EL, Half-Day, UL)' },
  { name: 'Edit Attendance', slug: 'attendance.update', module: 'attendance', description: 'Modify attendance logs, overtime hours, and punch remarks' },
  { name: 'Batch Attendance', slug: 'attendance.batch', module: 'attendance', description: 'Execute fast batch attendance marking across active staff' },
  { name: 'Sunday Shift Approval', slug: 'attendance.sunday_approval', module: 'attendance', description: 'Approve Sunday shift overrides and weekend shifts' },

  // ─── 21. Leaves & Accrual ──────────────────────────────────────────────────
  { name: 'Read Leave Ledger', slug: 'leaves.read', module: 'leaves', description: 'View employee leave ledger, CL/EL transactions, and balance history' },
  { name: 'Adjust Leaves', slug: 'leaves.adjust', module: 'leaves', description: 'Perform manual credit or debit adjustments to CL or EL balances' },
  { name: 'Accrue Monthly Leaves', slug: 'leaves.accrue', module: 'leaves', description: 'Trigger automated monthly leave accrual runs (+1.00 CL, +0.25 EL)' },

  // ─── 22. Advances ──────────────────────────────────────────────────────────
  { name: 'Read Advances', slug: 'advances.read', module: 'advances', description: 'View salary advance records, taken dates, and recovery schedules' },
  { name: 'Issue Advance', slug: 'advances.create', module: 'advances', description: 'Issue salary advances with advance taken date and recovery period' },
  { name: 'Edit Advance', slug: 'advances.update', module: 'advances', description: 'Modify salary advance amount, reason, and recovery schedule' },
  { name: 'Delete Advance', slug: 'advances.delete', module: 'advances', description: 'Delete or cancel salary advance records' },

  // ─── 23. Deductions ────────────────────────────────────────────────────────
  { name: 'Read Deductions', slug: 'deductions.read', module: 'deductions', description: 'View custom deductions, fines, and salary penalties' },
  { name: 'Add Deduction', slug: 'deductions.create', module: 'deductions', description: 'Record new deduction or penalty with apply month' },
  { name: 'Edit Deduction', slug: 'deductions.update', module: 'deductions', description: 'Modify deduction amount, reason, and apply period' },
  { name: 'Delete Deduction', slug: 'deductions.delete', module: 'deductions', description: 'Delete or cancel deduction records' },

  // ─── 24. Monthly Payroll Engine ────────────────────────────────────────────
  { name: 'Read Payroll', slug: 'payroll.read', module: 'payroll', description: 'View monthly payroll calculations, summaries, and disbursement status' },
  { name: 'Calculate Payroll', slug: 'payroll.calculate', module: 'payroll', description: 'Execute monthly payroll formula calculation engine' },
  { name: 'Finalize Payroll', slug: 'payroll.finalize', module: 'payroll', description: 'Finalize monthly payroll advice and lock figures' },
  { name: 'Revert Payroll to Draft', slug: 'payroll.revert_draft', module: 'payroll', description: 'Unlock and revert finalized payroll back to draft for adjustments' },
  { name: 'Disburse Payroll', slug: 'payroll.disburse', module: 'payroll', description: 'Authorize salary disbursement, record payment reference, and mark paid' },
  { name: 'Download Payslip', slug: 'payroll.download_payslip', module: 'payroll', description: 'Generate and download official salary slip PDFs' },
  { name: 'Email Payslip', slug: 'payroll.email_payslip', module: 'payroll', description: 'Dispatch salary slips directly to employee email addresses' },

  // ─── 25. Installer Payments ────────────────────────────────────────────────
  { name: 'Read Installer Bills', slug: 'installer_payments.read', module: 'installer_payments', description: 'View installer payment bills and settlement records' },
  { name: 'Create Installer Bill', slug: 'installer_payments.create', module: 'installer_payments', description: 'Generate sequential installer job billing records (PPSI)' },
  { name: 'Edit Installer Bill', slug: 'installer_payments.update', module: 'installer_payments', description: 'Modify bill items, models, quantities, and penalties' },
  { name: 'Delete Installer Bill', slug: 'installer_payments.delete', module: 'installer_payments', description: 'Void or remove installer bills' },
  { name: 'Record Installer Payment', slug: 'installer_payments.record_payment', module: 'installer_payments', description: 'Record installment payments and mark cleared' },
  { name: 'Download Bill PDF', slug: 'installer_payments.download_bill', module: 'installer_payments', description: 'Download branded installer payment advice PDFs' },
  { name: 'Email Installer Bill', slug: 'installer_payments.send_email', module: 'installer_payments', description: 'Dispatch bill PDF and settlement details to installer' },
  { name: 'Export Installer Bills', slug: 'installer_payments.export', module: 'installer_payments', description: 'Export 26-column installer billing history to Excel' },

  // ─── 26. Cubicle Installers ────────────────────────────────────────────────
  { name: 'Read Installers', slug: 'cubicle_installers.read', module: 'cubicle_installers', description: 'View master directory of cubicle installers' },
  { name: 'Register Installer', slug: 'cubicle_installers.create', module: 'cubicle_installers', description: 'Register new cubicle installer credentials' },
  { name: 'Update Installer', slug: 'cubicle_installers.update', module: 'cubicle_installers', description: 'Edit installer contact details and status' },
  { name: 'Deactivate Installer', slug: 'cubicle_installers.delete', module: 'cubicle_installers', description: 'Deactivate installer records' },
  { name: 'View Installer Ledger', slug: 'cubicle_installers.ledger', module: 'cubicle_installers', description: 'View complete job and payment ledger for installer' },

  // ─── 27. Cubicle Models ────────────────────────────────────────────────────
  { name: 'Read Models', slug: 'cubicle_models.read', module: 'cubicle_models', description: 'View cubicle, UMP, and locker installation models and rates' },
  { name: 'Create Model', slug: 'cubicle_models.create', module: 'cubicle_models', description: 'Add new installation model and default rate' },
  { name: 'Edit Model', slug: 'cubicle_models.update', module: 'cubicle_models', description: 'Update installation model pricing and category' },
  { name: 'Deactivate Model', slug: 'cubicle_models.delete', module: 'cubicle_models', description: 'Deactivate installation models' },

  // ─── 28. Proforma Invoices (PI) ────────────────────────────────────────────
  { name: 'Read Proforma Invoices', slug: 'proforma_invoices.read', module: 'proforma_invoices', description: 'View proforma invoices, advance requirements, and ledger' },
  { name: 'Create Proforma Invoice', slug: 'proforma_invoices.create', module: 'proforma_invoices', description: 'Issue proforma invoice from scratch, Quote, or PO' },
  { name: 'Edit Proforma Invoice', slug: 'proforma_invoices.update', module: 'proforma_invoices', description: 'Edit line items, advance terms, and notes' },
  { name: 'Approve Proforma Invoice', slug: 'proforma_invoices.approve', module: 'proforma_invoices', description: 'Approve proforma invoice and assign sequence' },
  { name: 'Cancel Proforma Invoice', slug: 'proforma_invoices.cancel', module: 'proforma_invoices', description: 'Cancel or void proforma invoices' },
  { name: 'Sign Proforma Invoice', slug: 'proforma_invoices.sign', module: 'proforma_invoices', description: 'Digitally sign PI with HMAC cryptographic seal' },
  { name: 'Email Proforma Invoice', slug: 'proforma_invoices.send_email', module: 'proforma_invoices', description: 'Email PDF advice to client' },
  { name: 'WhatsApp PI Reminders', slug: 'proforma_invoices.send_whatsapp', module: 'proforma_invoices', description: 'Dispatch WhatsApp payment reminders' },
  { name: 'Download PI PDF', slug: 'proforma_invoices.download_pdf', module: 'proforma_invoices', description: 'Download high-res vector PDF with anti-tamper QR' },
  { name: 'Delete Proforma Invoice', slug: 'proforma_invoices.delete', module: 'proforma_invoices', description: 'Delete proforma invoice records permanently' },

  // ─── 29. PO Management & AI Scanner ────────────────────────────────────────
  { name: 'Read PO Submissions', slug: 'po_management.read', module: 'po_management', description: 'View inbound email POs, classifications, and messages' },
  { name: 'Create PO Submission', slug: 'po_management.create', module: 'po_management', description: 'Record inbound PO submission' },
  { name: 'Update PO Submission', slug: 'po_management.update', module: 'po_management', description: 'Update status, priority, and assigned staff' },
  { name: 'Classify Inbound Emails', slug: 'po_management.classify', module: 'po_management', description: 'Classify emails as PO_DETECTED, POSSIBLE_PO, etc.' },
  { name: 'Run AI PO Scanner', slug: 'po_management.ai_scan', module: 'po_management', description: 'Run AI detection and parse line items and PO numbers' },
  { name: 'Send PO Replies', slug: 'po_management.reply_email', module: 'po_management', description: 'Send threaded email replies with attachments' },
  { name: 'Assign PO', slug: 'po_management.assign', module: 'po_management', description: 'Assign purchase order submissions to team members' },
  { name: 'Delete PO Submissions', slug: 'po_management.delete', module: 'po_management', description: 'Remove or bulk delete PO submissions' },
  { name: 'Full PO Management', slug: 'po.manage', module: 'po_management', description: 'Full PO lifecycle and email inbound pipeline control' },

  // ─── 30. Branches (Multi-Branch Operations) ────────────────────────────────
  { name: 'Read Branches', slug: 'branches.read', module: 'branches', description: 'View physical branches and warehouses (Delhi, Kolkata, etc.)' },
  { name: 'Create Branch', slug: 'branches.create', module: 'branches', description: 'Register new physical facility or warehouse' },
  { name: 'Edit Branch', slug: 'branches.update', module: 'branches', description: 'Modify branch location, code, and address' },
  { name: 'Deactivate Branch', slug: 'branches.delete', module: 'branches', description: 'Deactivate branch facilities' },

  // ─── 31. Suppliers ─────────────────────────────────────────────────────────
  { name: 'Read Suppliers', slug: 'suppliers.read', module: 'suppliers', description: 'View hardware vendor directory and GSTIN records' },
  { name: 'Create Supplier', slug: 'suppliers.create', module: 'suppliers', description: 'Add new vendor or fabrication partner' },
  { name: 'Edit Supplier', slug: 'suppliers.update', module: 'suppliers', description: 'Modify vendor contacts, address, and GSTIN' },
  { name: 'Delete Supplier', slug: 'suppliers.delete', module: 'suppliers', description: 'Delete supplier records' },
  { name: 'Manage Suppliers', slug: 'suppliers.manage', module: 'suppliers', description: 'Full supplier vendor management' },

  // ─── 32. Purchases (Stock-In Ledger) ───────────────────────────────────────
  { name: 'Read Purchases', slug: 'purchases.read', module: 'purchases', description: 'View stock-in procurement ledger ("Kahan Se Kharida")' },
  { name: 'Create Purchase', slug: 'purchases.create', module: 'purchases', description: 'Record stock-in purchases, supplier invoices, and unit costs' },
  { name: 'Update Purchase', slug: 'purchases.update', module: 'purchases', description: 'Edit purchase entries, bills, and items' },
  { name: 'Delete Purchase', slug: 'purchases.delete', module: 'purchases', description: 'Void or delete purchase entries' },
  { name: 'View Purchases', slug: 'purchases.view', module: 'purchases', description: 'Read-only view for procurement records' },
  { name: 'Edit Purchases', slug: 'purchases.edit', module: 'purchases', description: 'Edit-only access for procurement records' },

  // ─── 33. Stock Transfers (Inter-Branch) ────────────────────────────────────
  { name: 'Read Stock Transfers', slug: 'stock_transfers.read', module: 'stock_transfers', description: 'View inter-branch transfer shipments' },
  { name: 'Create Stock Transfer', slug: 'stock_transfers.create', module: 'stock_transfers', description: 'Initiate inter-branch stock transfer' },
  { name: 'Edit Stock Transfer', slug: 'stock_transfers.edit', module: 'stock_transfers', description: 'Edit transfer quantities and notes' },
  { name: 'Dispatch Transfer', slug: 'stock_transfers.dispatch', module: 'stock_transfers', description: 'Dispatch shipment from source facility' },
  { name: 'Receive Transfer', slug: 'stock_transfers.receive', module: 'stock_transfers', description: 'Receive and accept transferred stock into destination inventory' },
  { name: 'Cancel Transfer', slug: 'stock_transfers.cancel', module: 'stock_transfers', description: 'Cancel pending stock transfer and release reserved units' },
  { name: 'View Transfers', slug: 'transfers.view', module: 'stock_transfers', description: 'Inter-branch transfers view alias' },
  { name: 'Create Transfers', slug: 'transfers.create', module: 'stock_transfers', description: 'Inter-branch transfers create alias' },
  { name: 'Approve Transfers', slug: 'transfers.approve', module: 'stock_transfers', description: 'Inter-branch transfers approval alias' },
  { name: 'Receive Transfers', slug: 'transfers.receive', module: 'stock_transfers', description: 'Inter-branch transfers receive alias' },
  { name: 'Cancel Transfers', slug: 'transfers.cancel', module: 'stock_transfers', description: 'Inter-branch transfers cancel alias' },

  // ─── 34. Materials Master ──────────────────────────────────────────────────
  { name: 'Read Materials', slug: 'materials.read', module: 'materials', description: 'View hardware materials catalog' },
  { name: 'Create Material', slug: 'materials.create', module: 'materials', description: 'Add new raw materials and hardware specifications' },
  { name: 'Edit Material', slug: 'materials.update', module: 'materials', description: 'Edit material specs, descriptions, and properties' },
  { name: 'Delete Material', slug: 'materials.delete', module: 'materials', description: 'Delete hardware material records' },
  { name: 'Manage Materials', slug: 'materials.manage', module: 'materials', description: 'Complete materials catalog administration' },

  // ─── 35. B2B Pricing ──────────────────────────────────────────────────────
  { name: 'Read B2B Pricing', slug: 'b2b_pricing.read', module: 'b2b_pricing', description: 'View negotiated customer-specific pricing matrices' },
  { name: 'Set B2B Price', slug: 'b2b_pricing.create', module: 'b2b_pricing', description: 'Set custom price overrides and minimum order quantities' },
  { name: 'Update B2B Price', slug: 'b2b_pricing.update', module: 'b2b_pricing', description: 'Modify custom pricing and discount rates' },
  { name: 'Delete B2B Price', slug: 'b2b_pricing.delete', module: 'b2b_pricing', description: 'Remove customer-specific price overrides' },

  // ─── 36. Appointments & Service Scheduling ─────────────────────────────────
  { name: 'Read Appointments', slug: 'appointments.read', module: 'appointments', description: 'View service and installation appointments' },
  { name: 'Book Appointment', slug: 'appointments.create', module: 'appointments', description: 'Create and schedule new service appointments' },
  { name: 'Update Appointment', slug: 'appointments.update', module: 'appointments', description: 'Reschedule, assign technician, or update status' },
  { name: 'Delete Appointment', slug: 'appointments.delete', module: 'appointments', description: 'Cancel or delete service appointments' },
  { name: 'Manage Appointments', slug: 'appointments.manage', module: 'appointments', description: 'Full service booking and engineer dispatch control' },

  // ─── 37. Projects (Showcase Portfolio) ─────────────────────────────────────
  { name: 'Read Projects', slug: 'projects.read', module: 'projects', description: 'View commercial showcase projects' },
  { name: 'Create Project', slug: 'projects.create', module: 'projects', description: 'Add new installation case study and project photos' },
  { name: 'Edit Project', slug: 'projects.update', module: 'projects', description: 'Edit project details, testimonials, and specifications' },
  { name: 'Delete Project', slug: 'projects.delete', module: 'projects', description: 'Delete showcase projects' },
  { name: 'Manage Projects', slug: 'projects.manage', module: 'projects', description: 'Full project portfolio management' },

  // ─── 38. AI Agent (Copilot & Pilot AI) ─────────────────────────────────────
  { name: 'Use AI Copilot', slug: 'ai.use', module: 'ai_agent', description: 'Access AI Copilot chat, automated drafting, and AI report generation' },
];

async function seedAllPermissions() {
  console.log(`[seed-permissions] Starting upsert of ${ALL_SYSTEM_PERMISSIONS.length} platform permissions...`);

  let createdCount = 0;
  let updatedCount = 0;

  for (const perm of ALL_SYSTEM_PERMISSIONS) {
    const existing = await prisma.permission.findUnique({
      where: { slug: perm.slug },
    });

    if (existing) {
      await prisma.permission.update({
        where: { slug: perm.slug },
        data: {
          name: perm.name,
          module: perm.module,
          description: perm.description,
        },
      });
      updatedCount++;
    } else {
      await prisma.permission.create({
        data: {
          name: perm.name,
          slug: perm.slug,
          module: perm.module,
          description: perm.description,
        },
      });
      createdCount++;
    }
  }

  console.log(`[seed-permissions] Permissions upserted: ${createdCount} created, ${updatedCount} updated.`);

  // Find Super Admin role (by slug or name)
  const superAdminRole = await prisma.role.findFirst({
    where: {
      OR: [
        { slug: 'super-admin' },
        { slug: 'super_admin' },
        { name: { equals: 'Super Admin', mode: 'insensitive' } },
      ],
    },
  });

  if (superAdminRole) {
    const allDbPerms = await prisma.permission.findMany({ select: { id: true } });
    const existingRolePerms = await prisma.rolePermission.findMany({
      where: { roleId: superAdminRole.id },
      select: { permissionId: true },
    });
    const existingPermIds = new Set(existingRolePerms.map((rp) => rp.permissionId));

    const missingForSuper = allDbPerms
      .filter((p) => !existingPermIds.has(p.id))
      .map((p) => ({ roleId: superAdminRole.id, permissionId: p.id }));

    if (missingForSuper.length > 0) {
      await prisma.rolePermission.createMany({
        data: missingForSuper,
        skipDuplicates: true,
      });
      console.log(`[seed-permissions] Linked ${missingForSuper.length} new permissions to Super Admin role.`);
    } else {
      console.log(`[seed-permissions] Super Admin role already possesses all permissions.`);
    }
  }

  const finalTotal = await prisma.permission.count();
  console.log(`[seed-permissions] Total permissions now in database: ${finalTotal}`);
}

module.exports = { seedAllPermissions, ALL_SYSTEM_PERMISSIONS };

if (require.main === module) {
  seedAllPermissions()
    .catch((err) => {
      console.error('[seed-permissions] Fatal error:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
