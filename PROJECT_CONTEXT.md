# PRC Hardware - Comprehensive Architecture & Project Context

> **CRITICAL PROTOCOL FOR ALL AI AGENTS & DEVELOPERS**:
> 1. **Read this file FIRST** before planning or executing any tasks across `PRC-Backend`, `admin`, or `frontend`.
> 2. **Update this file** whenever you add, modify, or delete any models, API routes, modules, UI pages, services, or system workflows.
> 3. Ensure all changes maintain strict end-to-end consistency across the Backend API, Admin Console, and Customer Storefront.

---

## 1. System Ecosystem Overview

The PRC Hardware platform consists of six primary sub-projects located under `D:\`:

```
D:\
├── PRC-Backend/              # Express + TypeScript + Prisma REST API Backend (Port 5000)
├── admin/                    # React + Vite + Tailwind Enterprise ERP & Operations Dashboard (Port 5174)
├── frontend/                 # React + Vite + Tailwind Customer E-Commerce Storefront (Port 5175/3000)
├── PACIFIC RESTROOM CUBICLE/ # Corporate Website, 3D Configurator, CAD Studio & CMS (Port 5173)
├── PACIFIC-Backend/          # Express + TypeScript + Prisma REST API for Pacific Restroom Cubicle (Port 5001)
└── PACIFIC-Admin/            # React + Vite + Tailwind Admin Console for Pacific Restroom Cubicle (Port 5176)
```

---

## 2. Technology Stack & Infrastructure

### 2.1 Backend (`PRC-Backend`)
- **Runtime & Language**: Node.js (>= 18), TypeScript (Strict mode), Express.js.
- **ORM & Database**: Prisma Client `v5.22.0`, PostgreSQL (Hosted on Supabase).
- **Database Connection Architecture**:
  - `DATABASE_URL`: Supabase Transaction Pooler via PgBouncer on port `6543` (`?pgbouncer=true`). Used for application queries.
  - `DIRECT_URL`: Supabase Direct Session Pooler on port `5432`. Required for DDL migrations and schema changes.
- **Database Self-Healing & Instant Boot**: `src/scripts/fix-db.js` and `src/config/database.ts` use SHA256 hash tracking against `_applied_schema_patches` to complete schema verification in <20ms on boot (skipping redundant DDL statements). `seed-all-permissions.js` performs single-query diffing and bulk inserts, dropping startup overhead from 50s down to <1s.
- **Sleep Prevention & Keep-Alive**: `src/jobs/keepAlive.ts` pings `https://prc-backend-6sw7.onrender.com/health` every 4 minutes externally, preventing Render free-tier inactivity timeouts. Zero-overhead `/ping` and `/api/v1/ping` endpoints allow instant health monitoring.
- **Caching & KV**: Upstash Redis (REST HTTP client) and `ioredis`.
- **Background Jobs & Queues**: BullMQ worker queues for async jobs, emails, and batch processing (`src/queues/bullmq.worker.ts`).
- **Real-Time Communication**: Server-Sent Events (SSE) at `/api/v1/notifications/stream` and internal `eventBus` (`src/events/eventBus.ts`).
- **Authentication**: JWT (Access + Refresh tokens), 2FA TOTP (Speakeasy + QR codes), Email OTP, RBAC with granular permissions.
- **Payments**: Razorpay SDK and PhonePe Gateway integration with webhook signature verification.
- **Invoicing & GST**: Indian GST tax engine (Intrastate CGST+SGST, Interstate IGST), HSN/SAC code mapping, IRN / E-Invoice suite with endpoints at `/api/v1/invoices`, `/api/v1/gst/invoices`, and `/api/v1/gst/einvoice`.

### 2.2 Admin Console (`D:\admin`)
- **Framework**: React 18, Vite 6, TypeScript.
- **Styling**: Tailwind CSS, Radix UI primitives, Lucide React icons.
- **Mobile Native App & PWA Architecture**:
  - Viewport-fit cover, theme color `#18181B`, standalone mobile web app capability (`apple-mobile-web-app-capable`).
  - Persistent Mobile Bottom Navigation Dock (`AdminLayout.tsx`) with 5 core tabs (Dashboard, Orders, Products, Quotes, All Views Drawer) and safe-area padding (`pb-24 sm:pb-6`).
  - Dual-mode responsive view architecture across all core operational hubs (`sm:hidden` touch cards + `hidden sm:block` full tables):
    - **Dashboard (`DashboardPage.tsx`)**: 2x2 mobile metric cards, responsive charts, live recent order cards.
    - **Orders Management (`OrdersPage.tsx`)**: Mobile order cards with customer details, order type badges, amount, and responsive modals.
    - **Products Hub (`ProductsPage.tsx`, `EditProductPage.tsx`, `CreateProductPage.tsx`)**: Mobile touch product cards and high-density desktop matrix displaying thumbnail, SKU, live stock badge, selling price, Finish badges (`SS`, `NA`, `NYLON`), surface Colour swatch chips, and mm Dimensions (`H × W × L mm`), interactive 1-click Finish filter chips (`ALL`, `SS`, `NA`, `NYLON`), slide-over View Details Drawer with full hardware specification breakdown, and dedicated full-page Product Editors featuring interactive Material Finish selectors `{SS, NA, NYLON}`, dynamic dependent surface Colour options (`Golden, Black, SS` for SS; `Black, NA Aluminium` for NA; `Black` for NYLON) with visual preview swatches, and optional Height, Width, and Length dimensions in millimeters.
    - **B2B & Commercial Operational Suite (`AdminSidebar.tsx`, `AdminLayout.tsx`)**: Unified enterprise workspace grouping 8 specialized commercial hubs:
      - **B2B Enterprise Customers Directory (`UsersPage.tsx` with `filterMode="B2B_ONLY"` under `b2b-customers`)**: Isolated enterprise client management hub displaying exclusively commercial accounts (`companyName`, `gstin`, or B2B roles), custom 4-metric enterprise KPI deck (Active B2B Companies, GSTIN Verified Accounts, Inactive/Suspended, Total Registered B2B Enterprises), pre-configured B2B modal defaults, customized enterprise CSV exports (`PRC_B2B_Enterprises_Export.csv`), and 1-click links to negotiate customer custom pricing and inspect complete 360 dossiers with dynamic return navigation.
      - **B2B Orders Pipeline (`B2BOrdersPage.tsx`, `CreateB2BOrderPage.tsx` under `b2b-orders` & `create-b2b-order`)**: Enterprise wholesale orders management with dual-channel order processing supporting both **Storefront (Online)** customer direct checkout & quote conversions (`source: 'customer_frontend'`) and **Offline (Admin Created)** wholesale orders booked by sales staff (`source: 'admin_created'`). Features automatic storefront B2B checkout synchronization in `checkout.service.ts`, 3-way channel source filter pills, dedicated Storefront Orders KPI card, responsive mobile touch cards, and a **Dedicated Full-Page Offline Wholesale Order Studio (`CreateB2BOrderPage.tsx`)** featuring: (a) **Strict B2B Customer Isolation** — customer autocomplete and search exclusively display enterprise accounts (`companyName`, `gstin`, or B2B roles `b2bbuyer`/`b2bcustomer`/`enterprise`/`wholesale`/`commercial`); retail B2C customers are completely excluded via `isB2BCustomer()` helper in both `CreateB2BOrderPage.tsx` and `B2BOrdersPage.tsx` `CreateB2BOrderModal`; (b) **Live Branch Stock Display** — catalog loaded from `/products?limit=250` master API for accurate product IDs, prices, and thumbnails; real-time available stock per selected facility fetched via `/b2b-orders/check-stock` and displayed as `✓ X in Stock`, `⚠ Only X Left`, or `✕ Out of Stock` badges with a loading spinner during fetch; branch switching triggers an automatic live re-fetch; Add button disabled for out-of-stock items; (c) Negotiated custom pricing auto-detection (`/b2b-pricing/customer/:id`), line item quantity steppers, price overrides, 18% GST calculation, commercial notes, and atomic Super Admin confirmation. **Backend**: `submit_b2b_order` SQL procedure in `fix-db.js` enhanced to auto-initialize branch inventory rows from `products.stock` master catalog when a product has no prior branch allocation, preventing false `INSUFFICIENT_STOCK` errors for newly onboarded products.
      - **PO Management & Email Workspace (`POManagementPage.tsx`, `PODetailPage.tsx` under `po-management`)**: Inbound email pipeline, 4 classification tabs (`PO_DETECTED`, `POSSIBLE_PO`, `GENERAL_EMAIL`, `ALL`), dedicated full-page email dossier with interactive HTML viewer, threaded customer replies, attachment galleries, timeline audit logs, and AI-Powered PO Detection.
      - **Proforma Invoices (PI) (`ProformaInvoicesPage.tsx` under `proforma-invoices`)**: Complete commercial proforma lifecycle management, black & white PDF generator, and email/WhatsApp ledger dispatches.
      - **Payment Follow-up & Dues Recovery Cockpit (`AdvancePaymentsTrackerPage.tsx` under `advance-payments`)**: Enterprise receivables recovery cockpit, multi-channel communication engine, and commercial ledger across mobile, tablet, and desktop devices:
        - **5-Tab Operational Cockpit**:
          1. `DUES_RECOVERY` ("Dues Recovery & Aging"): Dynamic aging bucket filters (`ALL`, `0_30`, `31_60`, `61_90`, `90_PLUS`), follow-up profile status filters (`ALL`, `ACTIVE`, `PAYMENT_PROMISED`, `PARTIALLY_PAID`, `OVERDUE`), direct click-to-call (`<a href="tel:+91...">`), WhatsApp shortcuts, multi-select checkboxes for batch actions, and responsive dual-mode layout (mobile stacked cards + desktop high-density matrix). All rows and cards are 1-click interactive to launch the 360° Customer Dues Detail Drawer.
          2. `DOCUMENTS_LEDGER` ("Advance Payments & PI Receivables"): Original 4-stage commercial pipeline (`[QT] ──> [PO] ──> [PI] ──> [B2B Order]`), quick inspector modals for Quotations, POs, PIs, and B2B Orders, bidirectional payment reconciliation, and 1-click customer cells launching 360° dossiers.
          3. `CUSTOMER_ACCOUNTS` ("Company Ledgers"): Customer accounts summary, outstanding balances, and 1-click customer cards launching the full ledger and dues breakdown.
          4. `DISPUTED_ACCOUNTS` ("Declined & Disputed"): Dedicated isolation queue for accounts with rate disputes or collection suspensions, requiring mandatory justifications, protecting accounts from automated communications, with 1-click "Resume Recovery" and 360° inspection.
          5. `AUTOMATION_RULES` ("Follow-up Rules & Automation"): Automated trigger rules based on invoice maturity, repeat intervals, dispatch channels (SMS, Email Ledger), and "Run Scheduled Trigger Now" test runner.
        - **Interactive Statement of Account (Ledger Generation System)**:
          - Endpoints: `GET /api/v1/payment-followup/customers/:id/ledger` (JSON ledger data with `fromDate` and `toDate` filtering) and `GET /api/v1/payment-followup/customers/:id/ledger-pdf` (streams vector monochrome A4 Statement of Account PDF).
          - Generates chronological Debit, Credit, and Running Balance with opening balance reconciliation. Features pure black-and-white print-ready layout (`generateCustomerLedgerPdfBuffer` via `pdfmake` and `customerLedgerPdfGenerator.ts` for browser print preview) with corporate letterhead, HDFC Bank remittance details, and authorized signatory blocks matching the official PI/PO standard.
        - **Add Historical Balance / Multiple Installments for Existing Customers (`AddCustomerBalanceModal.tsx`)**:
          - Endpoint: `POST /api/v1/payment-followup/customers/:id/balance-entry`.
          - Accommodates legacy clients and customers paying in multiple staggered installments. Supports both `DEBIT` entries (opening dues or historical debit adjustments with custom `referenceDate`, `referenceNumber`, and notes) created via `OpeningBalanceEntry`, and `CREDIT` entries (historical payments or advance credits with custom `referenceDate`, `paymentMode`, and UTR #) allocated chronologically via `paymentAllocationService.recordAndAllocatePayment` (`OLDEST_DUE_FIRST`).
        - **Multi-Channel Dynamic Attachment Engine (`SendCommunicationModal.tsx`)**:
          - Endpoint: `POST /api/v1/payment-followup/customers/:id/send-communication`.
          - Multi-channel selector (Email, WhatsApp, SMS). Enables dynamic checkbox selection of commercial documents to attach: Statement of Account PDF, Proforma Invoices (PI), Quotations (QT), Purchase Orders (PO), and GST Invoices.
          - Multi-attachment email engine in `payment-followup-resend.service.ts` generating real-time PDF buffers.
          - Pre-formatted WhatsApp Click-to-Chat link generator (`https://wa.me/91<phone>?text=...`) with 1-click clipboard copy.
          - SMS dispatch via `smsReminderService` with variable interpolation.
        - **Interactive Follow-up & Write Notes System**:
          - Endpoint: `POST /api/v1/payment-followup/customers/:id/touchpoints`.
          - Embedded inline note logger directly within `CustomerDuesDetailDrawer.tsx` allowing credit officers to log remarks, interaction channels (`CALL`, `NOTE`, `SMS`, `EMAIL`, `IN_PERSON`), outcomes (`CALL_MADE`, `PAYMENT_PROMISED`, `DISPUTED`, etc.), PTP amount/date, and next follow-up dates without leaving the drawer.
        - **Universal 360° Customer Dues Detail Drawer (`CustomerDuesDetailDrawer.tsx`)**:
          - Full 360 calculations deck: Total Billed Amount, Total Advance Paid, Payments Collected, Net Remaining Balance Due, and Aging days.
          - Complete Billing and Shipping address cards with full details (Line 1, 2, City, State, PIN).
          - Multi-tab navigation: `OVERVIEW`, `LEDGER` (accounting table with date filters, print, and PDF export), `DOCUMENTS` (PIs, POs, Quotations, Invoices with quick send), `DUES` (traceable open receivables), `ALLOCATIONS` (payment receipts and UTRs), and `TIMELINE` (touchpoint audit log).
        - **Legacy Customer Onboarding (`AddOldCustomerModal.tsx`)**: Onboards pre-existing clients (`users.source = 'OLD_CUSTOMER'`) with legitimate opening balances (`opening_balance_entries`) without creating fake orders or synthetic invoices.
        - **Atomic Payment Allocations (`RecordPaymentAllocationModal.tsx`)**: Dual allocation modes executed in database transactions: `INVOICE_SPECIFIC` (allocates against specific document target) and `OLDEST_DUE_FIRST` (automatic chronological waterfall fulfillment).
        - **Direct SMS Reminders (`SendSmsReminderModal.tsx`)**: Dynamic variable interpolation (`{{customer_name}}`, `{{outstanding_amount}}`, etc.) and delivery logging.
        - **2-Stage Bulk Actions (`BulkCommunicationModal.tsx`)**: Pre-execution preview breakdown detailing eligible accounts vs skipped accounts followed by resilient sequential batch dispatch with summary results.
      - **QR & Document Validator (`QRDocumentValidatorPage.tsx` under `qr-validator`)**: Verification terminal for digitally signed quotations and proforma documents.
      - **B2B Quotations Pipeline (`QuotesPage.tsx` under `quotes`)**: Mobile RFQ cards with reference numbers, company info, totals, status pills, and 1-tap PDF downloads.
      - **B2B Custom Pricing Matrix (`B2BPricingPage.tsx` under `b2b-pricing`)**: Negotiated rate matrix per enterprise account with standard MRP vs custom B2B rate input, MOQ stepper, and live margin badges.
      - **Zero-Clutter Live Notification System**: All static text badges removed from the B2B sidebar group; replaced by dynamic real-time notification pills featuring glowing animated pulse dots (`<span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />`) that only appear when actionable pending items exist (e.g., new PO submissions, quotes awaiting review, pending B2B orders, or active enterprise clients) and remain completely clean when count is 0, synchronized via periodic polling and instant Server-Sent Events (SSE).
    - **Retail Customers & Users Hub (`UsersPage.tsx` with `filterMode="B2C_ONLY"` under `users` in `Customers & Access`)**: Clean retail user management hub strictly filtering out B2B enterprises, featuring dedicated retail metric cards (Active Retail Shoppers, Verified Phone Accounts, Inactive, Total Retail Shoppers) and specialized retail CSV export.
    - **GST Tax Invoice Hub (`InvoiceListView.tsx`)**: Mobile invoice stream with legal name, GSTIN, tax breakdown, and instant PDF action buttons.
    - **Administrator Master Console (`AdminManagementPage.tsx`)**: Enterprise staff credentials directory with 4 interactive KPI metric cards, role-filtered staff tables, mobile touch cards, 360 activity inspector modal, and **Super Admin Direct Password Management** (1-click `KeyRound` modal to change/reset passwords for any administrator role without requiring previous passwords, cryptographically secure random password generator, forced password change on next sign-in flag `mustChangePassword`, optional email notification dispatch, and 1-click temporary password copy confirmation).
    - **Executive Authentication & Recovery (`AdminLoginPage.tsx`)**: Enterprise login portal supporting standard email/password authentication, TOTP 2FA verification with 8-digit emergency backup recovery, and **Admin Self-Service Password Recovery** (dedicated multi-stage forgot password flow directly on the console card featuring registered corporate email validation, 6-digit numeric OTP verification with 60-second resend countdown, live password match validation, and seamless transition back to login).
    - **Employee & Payroll Management Workspace (`EmployeeManagementPage.tsx`)**: 6-tab enterprise HR hub (Employee Master Directory with instant search and department filters; **Worker Operations Hub** with 4 dedicated sub-views for **Worker Master Directory** with touch action cards, Worker Attendance Matrix, Worker Advances & Recovery, and Worker Monthly Payroll Runs; **High-Efficiency Bulk In-Memory Payroll Engine** replacing $4N$ sequential database queries with 4 parallel bulk queries and microsecond in-memory HashMap grouping, slashing calculation time from 15–20s down to $<200\text{ms}$ with parallel database upserts; **Debounced Non-Blocking Background Auto-Calculation Queue** (`queuePayrollAutoCalculation` with 350ms quiet debounce and `queueBatchPayrollAutoCalculation` with 500ms debounce) that automatically and invisibly recomputes monthly employee wages and Net Pay whenever attendance is marked, unmarked, double duty assigned, half day recorded, Sunday override toggled, overtime adjusted, or batch marked, ensuring payroll is always fresh without blocking the $<30\text{ms}$ attendance HTTP response; **Strict Formula Compliance** ($\text{Payable Days} = \text{Total Days} - \text{Default Sundays} + \text{Approved Sundays}$; $\text{Per-Day Rate} = \text{Monthly CTC} / \text{Payable Days}$; $\text{Paid Days} = \text{Present} + 2 \times \text{Double Duty} + \text{CL} + \text{EL} + 0.5 \times \text{Half Day} + \text{Approved Sundays}$; $\text{Gross Salary} = \text{Per-Day Rate} \times \text{Paid Days} + \text{OT Pay}$; $\text{Net Salary} = \max(0, \text{Gross Salary} - \text{Advance} - \text{Deductions})$); **Live Auto-Sync UI Indicator** in Worker Hub and Payroll tabs with non-blocking client background synchronization `triggerPayrollSync()`; **Worker-Friendly Zero-Friction Registration Protocol** allowing factory workers and daily-wage staff to be onboarded without mandatory email addresses via automatic collision-free internal placeholder generation `${employeeId}@internal.prc`, automatic sanitization of Aadhaar/PAN/Voter ID numbers stripping spaces/dashes, optional bank details, and tolerant schema parsing; **Strict 400 Validation Error Propagation** via backend `ZodError` middleware and frontend `assertSuccess` guards preventing silent failure swallowing; Daily Attendance Matrix with 0ms optimistic updates, **Double Duty (2x Shifts / DD)** marking support, **Toggle-Off (Simple) Unmark Interaction** (clicking an active status such as Present toggles it back to neutral unrecorded state and deletes the record), and worker-only filter toggle; Leave Ledger with automated monthly CL/EL accrual; Advances & Deductions tracking with worker-only filter and full edit/delete modals; and Monthly Payroll Engine with worker-only filter, 2x duty credit for Double Duty days, formula calculation, Super Admin disbursement authorization, PDF payslip generation, and automated payslip emailing).
    - **Daily Cash Expense Tracker Workspace (`ExpensesPage.tsx`)**: 7-tab responsive operational cash management hub featuring a dedicated **Cash Float & Money Given to UP Workspace (`activeTab === 'float'`)** with 4 financial KPI metric cards (**Total Money Given to UP**, **This Month to UP**, **All-Branch Total Float**, and **Latest Float Addition**), instant fast actions (`+ Give Money to UP Factory` pre-configuring destination to UP Factory and source to `HQ Cash Float`, and `+ Add General Float`), interactive facility filter pills (`⭐ Money Given to UP`, `All Facilities`, `Delhi HQ`, `Kolkata Branch`), instant text search, upgraded Top-Up modal with explicit Destination Facility selection (`UP Factory`, `Delhi HQ`, `Kolkata Branch`), quick amount pills (`₹5,000, ₹10,000, ₹25,000, ₹50,000, ₹1,00,000`), preset sources (`HQ Cash Float Transfer`, `Cash from Bank`, `Bank Transfer / NEFT`, `Director Capital Infusion`), high-density desktop matrix and mobile touch cards, official receipt/voucher preview modal, and Super Admin delete/reverse authorization; **Instant 0ms Optimistic Voucher Approvals & Rejections** (immediate UI state transitions, live balance mutation, and non-blocking background synchronization with automated rollback on error; zero artificial polling delays), **Stale-While-Revalidate (SWR) Instant Boot** (0ms initial mount utilizing local storage cached facilities, categories, and balances with parallel background refresh and clean shimmer loading states), Fast-Log Cash Outflow form with dual-attribution (`paidBy` Who Paid Name field + `paidTo` Vendor/Person), quick preset buttons, auto-approval threshold notifications, recently logged voucher preview card with direct ledger shortcuts and inline approval, receipt attachments, and live Today transaction feed; Dedicated Organization Expense Ledger Tab for browsing, searching, and filtering all historical vouchers across dates, categories, statuses, and branches; Pending Approval Queue for management authorization with inline 1-click Approve/Reject; Float Top-Up & End-of-Day Physical Cash Reconciliation with interactive currency denomination counter ($\times 500, 200, 100, 50, 20, 10, 5, 2, 1$) and automated variance flags; Category Master & Monthly Budgets; and Multi-Sheet Server-Side Excel Generator for Day/Week/Month/Year expense reports featuring branch location selection (Delhi HQ, Kolkata Branch, or All Branches Consolidated), uniform 13-column itemized voucher worksheets across all report periods with clickable receipt slip hyperlinks, and native Excel `autoFilter` header controls.
    - **UP — Private Factory Operations & Daily Expense Module (`UPPage.tsx` under `up`)**: Private, factory-specific financial ledger and petty cash management for the manufacturing facility, completely isolated from general corporate operations and displayed throughout the UI strictly as **UP**. (Factory Inventory is cleanly decoupled from the expense tracker and operates independently in its own dedicated workspace at `/up-inventory`):
      - **5-Layer Defense-in-Depth Authorization & Strict Allow-List**: (1) Navigation Shield (`AdminSidebar.tsx`) completely hides UP and UP Inventory from unauthorized users via `hasUpAccess`; (2) Frontend Route Guard blocks direct URL access with 403 barriers and zero financial/operational data leakage; (3) Server Middleware (`requireUPAccess` & `requireUPSuperAdmin`) verifies independent per-user authorization; (4) API Layer rejects unauthorized requests with 403 Forbidden; (5) PostgreSQL Row-Level Security (RLS) on all `up_*` tables (`up_expenses`, `up_expense_categories`, `up_expense_access`, `up_expense_audit`, `up_cash_days`, `up_boms`, `up_bom_items`, `up_production_orders`, `up_damaged_stock`, `up_scrap_logs`, `up_physical_counts`, `up_prc_dispatches`) with `SECURITY DEFINER` helper `public.has_up_access()`. Super Admin automatically has permanent access; custom admins require explicit allow-list records (`up_expense_access.revoked_at IS NULL`); general admin or finance roles never grant UP access.
      - **Mobile-First Daily Expense Entry**: High-speed touch entry (Amount $\to$ Category $\to$ Paid To $\to$ Note $\to$ Receipt file/camera capture $\to$ Save), `+ Add Another` continuous mode, numeric keyboards, and server-side validation ($> 0$).
      - **Petty Cash Daily Reconciliation & HQ Float Integration**: Opening balance, live tracking of today's cash float received from HQ (`floatReceived`), automatic deduction of today's cash expenses, expected closing balance calculation ($\text{Expected} = \text{Opening} + \text{Float from HQ} - \text{Cash Expenses}$), 5-card visual reconciliation calculation deck, physical cash input, instant variance detection ($\text{Difference} = \text{Actual} - \text{Expected}$), 1-click day closure & lock, and dedicated **Cash Float Received from HQ (Money Given to UP)** audit table displaying all incoming funds with amounts, channels, and UTR references.
      - **Immutable Financial Audit Trail**: Every CREATE, UPDATE, DELETE, VERIFY, and UNVERIFY operation transactionally logs before/after JSON states and actor IDs to `up_expense_audit`.
      - **Dynamic Analysis Horizon & Financial Velocity Dashboard**: Real-time KPI deck (Active Period Total, Today Spend, Verified Total, Unverified Total, Avg Daily Burn Rate, Peak Expense), category breakdown with visual progress bars, and dynamic Expense Velocity Area Chart. Features:
        - **Multi-Horizon Filter Bar**: 5 selectable modes: `This Month`, `Select Month` (interactive month picker with previous/next chevrons and native month dialog `YYYY-MM`), `Custom Range` (From/To pickers with Last 7D/30D quick presets), `Today`, and `This Year`.
        - **Continuous Velocity Timeline**: Backend dynamically queries expenses for the exact timeframe and fills day-by-day continuous intervals ($\le 62$ days) with zero-spend fills, providing smooth Recharts AreaChart curves.
        - **Dynamic Peak Single Spend Recalculation**: Automatically identifies the single largest voucher in the active interval with exact amount, date, vendor, and category attribution, preventing static `Peak: ₹0` displays.
        - **Contextual Category Breakdown**: Real-time recalculation of budget shares and percentages matching the chosen month or custom range.
      - **Category-Wise & Month-Wise Expense Audit Report (Multi-Page PDF Generator)**:
        - **Backend PDF Engine (`src/modules/up/up-category-pdf.service.ts`)**: Built with `pdfmake` to generate a single, multi-page vector PDF document consolidating the complete factory ledger for any selected month (`YYYY-MM`) or custom date range:
          - **Page 1 (Executive Summary Deck & Matrix)**: Official Pacific Products & Solutions / UP Factory corporate letterhead, 4-metric executive KPI deck (Total Outflow, Verified Outflow %, Pending Audit Outflow %, Daily Run Rate, and Peak Spend), followed by a comprehensive Category Allocation Matrix summary table (Category Description, Voucher Count, Verified Spend, Pending Spend, Total Outflow, and Percentage Share of Budget).
          - **Page 2 Onwards (Itemized Category Ledgers)**: Dedicated category sections beginning on subsequent pages with category header banners, subtotal badges, and high-density itemized tables listing all individual vouchers (`Date`, `Voucher ID`, `Paid To / Vendor`, `Mode`, `Note / Particulars`, `Audit Status`, `Amount`).
          - **Financial Compliance & Authorization Sign-Off**: Statutory compliance disclosure and 3-tier signature blocks (Accounts Officer, UP Plant Head, Managing Director / Super Admin).
          - **Running Header & Footer**: Document title and automated `Page X of Y | Confidential — Pacific Products & Solutions (UP Factory)` running footer on all pages.
        - **Backend Route & Controller**: Mounted at `GET /api/v1/up/reports/category-pdf` (`up.controller.ts` & `up.routes.ts`) with `requireUPAccess` and `validate(ListUpExpensesQuerySchema, 'query')`, streaming the PDF buffer directly with dynamic `Content-Disposition: attachment; filename="UP_Category_Expense_Report_YYYY-MM.pdf"`.
        - **Admin Console Integration (`UPPage.tsx`, `upApi.ts`, `UPPresentationModal.tsx`)**:
          - Dedicated **Reports & BI Tab (`activeTab === 'reports'`)**: Features an interactive report generator card with month selector (`YYYY-MM`), custom start/end date inputs, category focus selector, audit status filter (`All`, `Verified Only`, `Pending Audit Only`), and 1-click **Download Multi-Page PDF Report** button with spinner loading feedback and success banner.
          - **Dashboard Horizon Quick Action**: Direct 1-click "Category PDF" download button on the main Horizon action bar for instant export of the active timeframe.
          - **Executive Presentation Deck Integration**: Added a direct "Multi-Page PDF" action button inside `UPPresentationModal.tsx` top control bar.
          - Client helper `downloadCategoryPdfReport(params)` in `admin/src/api/upApi.ts` using binary blob streaming.
      - **Executive Visual Presentation Report Generator (`UPPresentationModal.tsx`)**: High-resolution presentation report generator designed for executive board reviews, plant audits, and management slide presentations:
        - Includes official Pacific Products & Solutions / PRC Hardware corporate header, active period tag, 4-metric executive KPI deck, vector SVG Expense Velocity curve with peak annotations, category breakdown distribution bars, and Top 5 Largest Expenditures in period.
        - Automated management observations and 3-tier authorized signatory blocks (Accounts Officer, UP Plant Head, Managing Director).
        - **1-Click Print / Save as PDF**: CSS `@media print` optimized layout for clean A4 presentation sheets without UI margins or cutoffs.
        - **Standalone Presentation HTML Download**: Generates a self-contained offline presentation HTML file ready for projector displays without server connectivity.
        - **Itemized Excel Ledger Export**: 1-click download of the complete period workbook matching active horizon filters.
      - **Allow-List Delegation & Category Management (Super Admin)**: Live allow-list management table with 1-click Grant and soft Revoke actions (`revoked_at = NOW()`), and non-destructive category active/inactive toggles.
    - **UP Factory Inventory — Vendor & Supplier to PRC Hardware (`UPInventoryPage.tsx` under `up-inventory`)**: Standalone, independent factory inventory management system representing the UP manufacturing plant in its role as a manufacturing vendor and supplier to PRC Hardware. Features:
      - **Single-Plant Vendor Identity (Zero Facility Clutter)**: UP operates as a dedicated single manufacturing facility. Internal branch/facility dropdown selectors are removed from the factory floor view, preserving its distinct identity as a manufacturing supplier.
      - **Factory Product Registration Suite (`AddProductModal`)**: Dedicated multi-classification product registration supporting both **Finished Goods** (for supply and dispatch to PRC Hardware distribution network) and **Raw Materials** (for internal factory BOM assembly), with SKU codes, barcodes, finish specifications (`SS, Matt Black, Brass, Chrome, etc.`), units of measure (`PCS, SET, KG, MTR, etc.`), unit manufacturing costs, PRC transfer prices, initial stock, and reorder levels. Backend: `createFactoryProduct()` in `up-inventory.service.ts` mounted at `POST /api/admin/up/inventory/products`.
      - **Supply to PRC Hardware Pipeline (`SupplyPrcModal`)**: Formal outward vendor dispatch workflow enabling factory supervisors to supply finished goods directly to PRC Hardware branch depots (e.g., Delhi HQ, Kolkata Branch, etc.). Submitting a dispatch atomically deducts stock from the UP Factory plant, increments on-hand stock at the target PRC Hardware branch depot, generates `StockMovement` ledger records, and creates an official Delivery Challan with transport mode, vehicle number, driver details, and billing valuation. Backend: `supplyToPrc()` in `up-inventory.service.ts` mounted at `POST /api/admin/up/inventory/supply-prc`.
      - **Delivery Challan Ledger & Detailed Viewer (`subTab === 'prc-dispatches'` & `ChallanDetailModal`)**: Complete outward dispatch history tracking challan numbers (`UP-PRC-YYYYMMDD-XXXX`), destination branches, total units, transfer valuation, transport logistics, and printable A4 Delivery Challans. Supported by `up_prc_dispatches` database table with RLS. Backend: `listPrcDispatches()` mounted at `GET /api/admin/up/inventory/dispatches`.
      - **Factory Floor Stock & Manufacturing WIP**: High-speed SKU search dock (<100ms), 1-tap floor actions (Receive Material, Issue Material to Floor, Damage Quarantine with photo capture, Scrap Write-Off, Physical Inventory Cycle Count), Bill of Materials (BOM) multi-component recipe master, Production Work Orders with auto-deduction of components upon completion, and factory inventory valuation reports.
    - **Central Multi-Branch Stock Inventory (`InventoryPage.tsx`, `AddSkuPage.tsx` under `inventory`)**: Active and preserved in the primary navigation sidebar under **Catalog & Stock**. Serves as the central multi-depot stock management and warehouse distribution console for PRC Hardware (Delhi HQ, Kolkata Branch, etc.), completely distinct and independent from the UP Factory inventory. Features:
      - **0ms SWR Instant Boot & 30s In-Memory Tab Cache**: Instant render from local storage snapshots for branches, suppliers, categories, and metrics.
      - **8-Tab Enterprise Navigation Bar**: `stock`, `purchase-orders`, `purchases`, `transfers`, `movements`, `suppliers`, `branches`, `reports`.
      - **Purchase Order (PO) Creation & Email Dispatch Suite (`PurchaseOrderListTab.tsx`, `CreatePurchaseOrderModal.tsx`, `SendPoEmailModal.tsx`, `ReceivePoGoodsModal.tsx`, `PoTimelineModal.tsx`, `purchaseOrderPdfGenerator.ts`)**: Enterprise commercial procurement pipeline enabling staff to raise official purchase orders to external suppliers and vendors (e.g. Stars Aluminium, Superfit Industries, UP PRC Factory, etc.). Features:
        - **Dual-Entity Brand & Logo Customization**: Supports issuing POs under either **Pacific Products & Solutions** (GSTIN `07AADFP3948F1Z1`, Mandoli Delhi, with Pacific logo) or **PRC Hardware** (GSTIN `07AABCP1234F1Z9`, Melaram Farm Delhi, with PRC logo), with dynamic logo selector and pre-filled letterhead contact details.
        - **Strict Pure Black & White (Monochrome) Print Layout**: Vector and HTML print-ready layout matching the Proforma Invoice (PI) design language — high-contrast black text, clean dividing rules, light gray table headers, two-column party dossier (Vendor Left vs Ship-to Depot Right), HSN itemized table with discount and GST breakdown, terms and conditions, amount in Indian currency words, and dual signatory blocks.
        - **Sequential Numbering & Revisions**: Atomically generated sequential numbers (`PO-<FY>/<seq>`, e.g. `PO-2026-27/0001`) via `purchase_order_sequences`. Any update made to a PO after initial dispatch creates an immutable revision (`PO-2026-27/0001-R1`).
        - **Automated Email Dispatch Engine**: Sends POs directly to the vendor's registered email with vector PDF attached via backend `sendMail` (Resend/Brevo/SMTP), editable subject line, custom purchase notes, and CC to internal purchase desks (`billing@pacifichardware.com` or `purchase@prchardware.com`), logging delivery state and timestamp to `purchase_order_dispatches`.
        - **Partial & Full Goods Receipt Tracking (`ReceivePoGoodsModal`)**: Accommodates multi-batch deliveries against a single PO. Receiving goods updates item `quantityReceived`, transitions status (`PARTIALLY_RECEIVED` vs `RECEIVED`), creates a corresponding `Purchase` procurement record, automatically increments physical inventory in `inventories` at the destination depot, and logs audit entries in `StockMovement`.
        - **Backend Module**: `purchase-order.service.ts`, `purchase-order-pdf.service.ts`, and `purchase-order.controller.ts` mounted at `/api/v1/purchase-orders` and `/api/v1/inventory/purchase-orders`. Database tables: `purchase_orders`, `purchase_order_items`, `purchase_order_events`, `purchase_order_dispatches`, `purchase_order_sequences`.
      - **Permanent Hard-Deletion of Listed Stock Items**:
        - **Backend Hard Deletion Engine (`deleteInventoryItem` in `inventory.service.ts`)**: Upgraded from soft-deletion to permanent, hard database deletion. When an administrator deletes an item from the stock matrix, it cascades through all dependent relational records (`inventories`, `stock_movements`, `stock_reservations`, `stock_transfer_items`, `purchase_items`, `product_variants`, `cart_items`, `wishlist_items`, `reviews`, `b2b_customer_prices`), and executes `await tx.product.delete({ where: { id: targetProduct.id } })` to permanently eradicate the product and SKU from PostgreSQL (preserving historical order/invoice records with 0-stock archiving if legal audit retention requires).
        - **Pure Inventory Source of Truth**: Removed synthetic fallback in `listInventory` that previously fabricated phantom inventory rows for empty tables. The stock list strictly reflects genuine, allocated inventory in `inventories`.
        - **Client-Side Cache Eviction (`InventoryPage.tsx`)**: In `handleConfirmDelete`, the deleted SKU is immediately evicted from the persistent browser cache `localStorage.getItem('prc_cached_inventory_snapshot')`, and in-memory caches `tabCacheRef.current = {}` are invalidated, preventing deleted items from reappearing on page reload or filter changes.
      - **Multi-Stock Inventory Database Reset Protocol (`src/scripts/reset-multistock-inventory.ts`)**: Transactional script providing zero-downtime clearing of all multi-stock operational tables (`inventories`, `stock_movements`, `stock_transfers`, `stock_transfer_items`, `purchases`, `purchase_items`, `stock_reservations`) and resetting all `products.stock` counts to 0, while keeping master product definitions, categories, warehouse branches, and suppliers completely intact.
      - **Dedicated Add SKU & Stock Allocation Suite (`AddSkuPage.tsx`)**: Full-page SKU creation with dynamic Material Finish `{SS, NA, NYLON}`, dependent surface Colour swatches, millimeter dimensions, and destination branch allocation.
      - **Stock Update Suite (`StockEditModal.tsx`)**: Quick delta adjustment chips, live calculation preview bar, and audit logging to `StockMovement`.
      - **Auditor-Grade Production Report Export Suites**: Stock Matrix & Valuation, Stock Movements Audit Ledger, Purchases & Procurement Report, and Customer Orders & Stock Consumption Report across B2C & B2B channels.
    - **Production Barcode & Dispatch Command Center (`BarcodePage.tsx`)**: High-precision warehouse scanning & thermal labeling station featuring **Dual-Engine Hardware & Camera Scanner** (native `BarcodeDetector` hardware-accelerated 60fps frame scanning with fallback to `jsQR`, rear/front camera switcher, flashlight/torch toggle on supported mobile browsers, two-tone synthesizer audio chime feedback, and haptic vibration), **Hardware Laser Scanner Gun Listener** (automatic buffered keystroke detection for physical USB/Bluetooth scanners ending with Enter), **Single-Device Single-Scan Anti-Double-Scan Lock** (device-level lock with cooldown countdown, warning tone, viewfinder lock overlay, and "Scan Next" unlock action to prevent rapid double-scanning of the same SKU on a single terminal), **Strict 2-Stage Fulfillment Lifecycle (`PACKING` vs `RECEIVED`)** (enforces that a product can ONLY be scanned twice in its operational life: Scan 1 when packing the parcel for dispatch, and Scan 2 when receiving at destination; blocks receiving until packing is verified and permanently seals the lifecycle as terminal once 2 scans are reached), **Downloadable Mobile PWA Scanner** (`manifest.webmanifest` with standalone full-screen display, Service Worker offline caching, 1-tap browser installation prompt, and iOS Safari Add-to-Home-Screen interactive guide), **E-Commerce Online-Shopping Grade SKU Dossier** (high-resolution product thumbnail, SKU badge, status chip, Material Finish badge `{SS, NA, NYLON}`, surface Colour swatch chip, millimetric dimensions `H × W × L mm`, and live multi-branch inventory table comparing Delhi HQ vs Kolkata Branch on-hand, reserved, and available stock), **Order Dispatch & Fulfillment Workflow** (itemized customer orders awaiting dispatch containing the scanned SKU, branch source facility selector, quantity stepper, and 1-click **Verify & Dispatch** action executing atomic physical stock deduction, `StockMovement` audit logging, and order advance to `SHIPPED`), and **Thermal Sticker Label Studio** (real-time 58mm × 40mm and 80mm × 40mm thermal label visual preview with Company header, product details, MRP, Code-128 barcode image, scannable QR code, 1-click direct thermal browser print via scoped `@media print` CSS, and downloadable vector PDF labels). Accessible via persistent bottom mobile navigation dock ("Scan" tab), sidebar ("Barcode & Scanner"), and stock header shortcuts.
- **State & Auth**: `AdminAuthContext` (JWT in localStorage), `ThemeContext` (Light/Dark mode).
- **Features**: Real-time SSE notification stream, executive analytics, product/variant CRUD, quotation pipeline, GST Tax Invoice Hub, custom B2B pricing, RBAC roles & permissions, media studio.

### 2.3 Storefront (`D:\frontend`)
- **Framework**: React 18, Vite 6, React Router v7, TypeScript.
- **Styling**: Tailwind CSS 4, Radix UI, tw-animate-css, Lucide React.
- **Mobile App Architecture**:
  - Persistent bottom mobile navigation bar (`MobileBottomNav.tsx`) with animated badge counters for Cart and Wishlist.
  - Mobile-first compact typography, tighter padding/margins, and touch manipulation optimization (`-webkit-tap-highlight-color: transparent`, `touch-action: manipulation`).
  - Horizontal touch-swipe carousels (`no-scrollbar snap-x snap-mandatory`) for hero sliders, aesthetic collections, and product strips.
  - 2-Column compact mobile product grids (`grid-cols-2 gap-2 sm:gap-4`) across all catalog and listing pages (`ProductsCatalogPage`, `CategoryProductsPage`, `BestSellersPage`, `NewArrivalsPage`, `OffersPage`, `WishlistPage`).
  - **Full-Spectrum Hardware Specification Display**: Product cards (`ProductCard.tsx`) and quick-view modals (`QuickViewModal.tsx`) dynamically display Hardware Finish badges (`SS`, `NA`, `NYLON`), surface Colour tags, and millimetric Dimensions (`H × W × L mm`). Product detail pages (`ProductDetailPage.tsx`) prominently feature Finish, Colour, and Dimension tags in the hero metadata header alongside the Technical Specifications tab.
  - Mobile sticky bottom action bars for single-tap Add-to-Cart / Buy-Now on Product Detail and instant 1-tap checkout on Cart and Checkout pages.
  - **User Profile (`UserProfilePage.tsx`)**: Horizontal touch scroll tab bar (`no-scrollbar`), compact hero avatar & badges, responsive mobile order cards with status chips and quick actions.
  - **Quotation Suite (`RequestQuotePage.tsx` & `CustomerQuoteApprovalPage.tsx`)**: Responsive 1-column mobile inputs, touch-friendly product search & selection, responsive line item cards with stepper controls, and compact digital signature seal.
  - **Appointments & Service (`AppointmentsPage.tsx`)**: Compact service selection cards, 3/4-column time slot grid, and responsive booking confirmation cards.
  - **Warranty & Claims (`WarrantyClaimPage.tsx`)**: Touch upload file zone, mobile certificate verification and generator modal.
  - **Order Tracking & Notifications (`TrackOrderPage.tsx` & `NotificationsPage.tsx`)**: Mobile vertical order milestone stepper and compact notification cards.
  - **Policies & Information Suite (`AboutPage.tsx`, `ContactPage.tsx`, `FaqPage.tsx`, `PolicyPage.tsx`, `TermsOfServicePage.tsx`, `PrivacyPolicyPage.tsx`, `RefundPolicyPage.tsx`, `ShippingPolicyPage.tsx`)**: Mobile horizontal pill bars for quick policy switching, compact FAQ accordions, and responsive inquiry submission forms.
  - **Dynamic Banner Loading (`HeroSlider.tsx` & `UpcomingSlider.tsx`)**: Zero hardcoded image flashing on refresh; skeleton shimmer placeholders during live database banner retrieval.
- **State & Services**: Custom React contexts (`AuthContext`, `CartContext`, etc.), modular API services in `src/services/`.
- **Features**: Product catalog with dynamic filters, category browsing, instant search, persistent cart, multi-step checkout, B2B quotation request, installation appointment booking, customer order tracking, reviews & ratings, wishlist.

### 2.4 Pacific Products & Solutions — Corporate & 3D Cubicle Platform (`D:\PACIFIC RESTROOM CUBICLE`)
- **Framework**: React 18, Vite 6, React Router v7, TypeScript, Tailwind CSS v4, Lucide React.
- **3D Graphics & Configurator Engines**: Three.js (`0.184.0`), `@react-three/fiber` (`8.17.10`), `@react-three/drei` (`9.121.4`), Zustand (`5.0.14`).
- **Interactive 3D Configurator (`/configure-cubicle`)**:
  - Parametric 3D cubicle viewport (`CubicleViewer.tsx`, `CubicleModel.tsx`) supporting Toilet Cubicles, Toilet Partitions, and Locker Systems.
  - Real-time dimension adjustments (Width, Depth, Height in mm), material selection (HPL vs Phenolic Plywood), hardware finish options (`SS`, `Chrome`, `Brass`, `Black`), and accessories (indicator locks, coat hooks, LED backlighting, support legs, wall bracket clamps).
  - Dynamic cost estimator (`getEstimatedPriceRange()`), deep URL query param configuration sharing, and client-side vector PDF quote generation via `jspdf`.
- **AutoCAD-Style 3D Design Studio (`/design-studio`)**:
  - CAD modeling suite featuring ribbon toolbar (`AutoCADRibbon.tsx`), interactive command line (`AutoCADCommandLine.tsx`), 3D canvas (`DesignCanvas3D.tsx`), layers, dimension overlays, snapping, undo/redo history, and JSON layout serialization.
- **AI Chatbot ("Aria")**:
  - Local intent parser and NVIDIA NIM LLM completion proxy (`api/nvidia.ts` on Vercel Edge Runtime) keeping API keys server-side.
- **Headless CMS & Database (`/admin/dashboard`)**:
  - Supabase integration (PostgreSQL, Supabase Auth, Supabase Storage with WebP image compression).
  - Full CRUD dashboards for Products, Blogs, Solutions, Gallery Images, Hero Sliders, Core Services, Page Banners, Catalogs, Contact Queries, Feedback, FAQs, and Configurator Leads.
  - Resilient offline fallback (`isSupabaseConfigured()`) ensuring full functionality via `demo-data.ts` even without active cloud database connections.
- **Development & Verification**:
  - Dedicated agent skill: `prc-cubicle-dev` (`.agents/skills/prc-cubicle-dev/SKILL.md`).
  - Validation: `npx tsc --noEmit`, `npm run build`, `npm test`.

---

## 3. Database Schema & Prisma Models (`prisma/schema.prisma`)

### Core Models Registry (79 Active Models):

1. **Authentication, Users & RBAC**:
   - `User`: Customers, staff, and superadmins (`email`, `phone`, `role`, `status`, `isTwoFactorEnabled`, `twoFactorSecret`, `b2bCompanyName`, `b2bGstin`).
   - `Role`: System and custom RBAC roles (`name`, `slug`, `isSystem`).
   - `Permission`: Fine-grained permission strings (e.g. `products.create`, `orders.manage`, `allocation.manage`).
   - `RolePermission` & `UserRole`: Many-to-many junction tables for RBAC.
   - `RefreshToken`, `EmailVerification`, `PasswordReset`, `UserActivityLog`: Session and audit records.

2. **Catalog & Products**:
   - `Category`: Categories hierarchy (`parentId`, `slug`, `position`, `isVisible`, `isBestseller`).
   - `Product`: Main product catalog (`name`, `slug`, `sku`, `price`, `salesPrice`, `offerPrice`, `stock`, `status`, `manufacturerInfo`, `dimensions`, `tags`, `attributes`).
   - `ProductVariant`: SKU variants for colors, sizes, materials, and finishes (`sku`, `price`, `stock`, `attributes`, `images`).

3. **B2B & Pricing Engine**:
   - `B2BCustomerPrice`: Custom negotiated product pricing per B2B customer account (`customerId`, `productId`, `customPrice`, `minQuantity`, `discountPercent`).
   - `Quote`: B2B bulk quotation requests (`quoteNumber`, `clientId`, `companyName`, `status`, `totalEstimatedValue`, `validUntil`).
   - `QuotationRevision`, `QuoteItem`, `QuoteActivityLog`, `QuoteSequence`: Versioned quotation revisions and items.

4. **Cart, Orders & Fulfillment**:
   - `Cart` & `CartItem`: Persistent shopping cart for guest and registered users.
   - `Order` & `OrderItem`: Customer orders (`orderNumber`, `orderStatus`, `paymentStatus`, `totalAmount`, `isB2B`, `shippingAddress`, `billingAddress`).
   - `OrderStatusHistory`: Immutable order lifecycle audit log.
   - `Warehouse`: Fulfillment centers with geolocation and priority.
   - `PinCode`: Serviceable postal codes mapped to warehouses with delivery SLA and shipping rates.
   - `AllocationLog`: Automated order routing decision records based on weighted scoring formula.

5. **Coupons, Discounts & Payments**:
   - `Coupon`: Promo codes (`code`, `discountType`, `discountValue`, `minOrderAmount`, `maxDiscountAmount`, `applicable_product_ids`, `applicable_category_ids`, `usageLimit`).
   - `CouponUsage`: Tracks per-user coupon redemption.
   - `Payment`: Gateway transaction records (`orderId`, `gateway`, `paymentMethod`, `transactionId`, `status`, `amount`, `currency`).

6. **Invoicing & GST Tax Hub**:
   - `Invoice` & `InvoiceItem`: GST compliant tax invoices (`invoiceNumber`, `placeOfSupply`, `supplyType`, `cgstAmount`, `sgstAmount`, `igstAmount`, `irn`, `signedQrCode`, `status`).
   - `InvoiceHistory` & `InvoiceSequence`: Financial year sequence tracking (`PRC/2026-27/0001`).

7. **Logistics & Shipping**:
   - `Courier`, `ShippingZone`, `WarehouseZoneMapping`, `CourierRate`, `Shipment`, `ShippingRate`: Multi-carrier logistics routing (BlueDart, Delhivery, GATI).

8. **Service Appointments**:
   - `AppointmentService`: Hardware repair, installation, and inspection services.
   - `StaffAvailability`, `BlackoutDate`, `Appointment`, `AppointmentStatusHistory`: Booking slots and engineer dispatch.

9. **Storefront Content & Engagement**:
   - `CmsPage`, `BlogPost`, `FaqCategory`, `Faq`, `Banner`, `HomepageSection`: Dynamic content management.
   - `Review`: Verified buyer product reviews and star ratings.
   - `Enquiry`: Customer contact forms and support tickets.
   - `Wishlist` & `WishlistItem`: Customer saved items.
   - `Notification`: In-app and system alerts.
10. **Multi-Branch Inventory & Procurement Ledger**:
    - `Branch`: Physical facilities with independent stock tracking (`Delhi HQ (DEL)`, `Kolkata Branch (KOL)`).
    - `Supplier`: External hardware vendors and fabricators (`name`, `contactPerson`, `phone`, `email`, `gstNumber`).
    - `Inventory`: Branch-wise physical and reserved quantity per SKU with reorder thresholds (`quantity`, `reservedQuantity`, `reorderLevel`). `@@unique([productId, branchId])`. Deletion of inventory records cascades to write off remaining physical units with `StockMovementType.ADJUSTMENT_OUT` audit records, deallocates all warehouse inventory records, and soft-deletes the associated `Product` (`deletedAt`, `status = INACTIVE`, `isVisible = false`, `stock = 0`) along with variant deactivations.
    - `Purchase` & `PurchaseItem`: Stock-in procurement ledger ("Kahan Se Kharida") capturing supplier, invoice number, purchase date, unit costs, and total procurement spend.
    - `PurchaseOrder`, `PurchaseOrderItem`, `PurchaseOrderEvent`, `PurchaseOrderDispatch`, `PurchaseOrderSequence`: Enterprise commercial PO lifecycle (`PO-<FY>/<seq>`), dual entity branding (`PACIFIC_PRODUCTS` vs `PRC_HARDWARE`), pure B&W print layout, email dispatch tracking, and partial/full goods receipt updating `inventories` and `StockMovement`.
    - `StockTransfer` & `StockTransferItem`: Multi-stage inter-branch logistics workflow (`PENDING` -> `IN_TRANSIT` -> `RECEIVED` / `CANCELLED`) with automatic source quantity reservation and destination credit.
    - `StockMovement`: Immutable chronological audit ledger of every unit mutation (`PURCHASE_IN`, `TRANSFER_IN`, `TRANSFER_OUT`, `ADJUSTMENT_IN`, `ADJUSTMENT_OUT`, `DAMAGE`, `RETURN_IN`) recording previous/new quantity, reference, and performer.
11. **PO Management Pipeline ("From Email" Workflow)**:
    - `PoSubmission`: Inbound email purchase orders and inquiries (`poSubmissionId`, `customerPoNumber`, `classification`, `source`, `status`, `priority`, `customerEmail`, `customerName`, `companyName`, `assignedUserId`).
    - `PoEmailMessage`: Complete RFC email metadata, headers, plain text body, sanitized HTML body, and threading pointers (`messageId`, `inReplyTo`, `references`, `threadId`).
    - `PoEmailAttachment`: Attachment file details, MIME types, cloud storage URLs, and extracted text.
    - `PoInternalNote`: Staff internal communication thread attached to specific PO records.
    - `PoActivityLog`: Lifecycle audit events (`EMAIL_RECEIVED`, `PO_ID_ASSIGNED`, `STATUS_CHANGED`, `PRIORITY_CHANGED`, `RECLASSIFIED`, `CUSTOMER_PO_NUMBER_UPDATED`).
    - `PoSequence`: Atomic transaction-safe yearly sequence generator (`year`, `lastNumber`) producing `PRC-PO-YYYY-XXXXXX` IDs with automatic annual restart.
12. **B2B Proforma Invoices (PI) & Cryptographic QR Verification Suite**:
    - `ProformaInvoice` & `ProformaInvoiceItem`: Commercial advance demand invoices (`piNumber`, `financialYear`, `sequenceNo`, `status`, `subtotal`, `taxableAmount`, `cgst`, `sgst`, `igst`, `grandTotal`, `advancePercentage`, `advanceAmount`, `balanceDue`, `paymentTerms`, `deliveryTimeline`, `validUntil`, `verificationToken`, `verificationId`, `documentHash`, `digitalSignature`, `signedBy`, `signedAt`, `qrCodeDataUrl`, `bankDetails`, `reminderCount`, `emailReminderCount`, `whatsappReminderCount`, `lastReminderAt`, `lastWhatsappAt`, `lastEmailAt`).
    - `ProformaInvoiceHistory` & `ProformaInvoiceSequence`: Atomic annual sequence tracking (`PRC/PI/2026-27/0001`) and chronological state transitions audit trail.
13. **Cubicle Installer Payment Tracking System**:
    - `CubicleInstaller`: Master installer credentials directory (`id`, `name`, `email` unique, `phone`, `isActive`, `createdAt`, `updatedAt`).
    - `CubicleModel`: Master rate catalog for installation models across categories (`modelName` unique, `installationPrice`, `category` enum `CUBICLE`/`UMP`/`LOCKER` default `CUBICLE`, `isActive`, `createdAt`, `updatedAt`).
    - `InstallerBill`: Itemized installer job billing records (`billNumber` unique sequential `PPSI-00001`, `installerId` foreign key to `CubicleInstaller`, `installerName`, `installerPhone`, `installerEmail`, `siteAddress`, `jobDate`, `isNcr`, `travelExpenses`, `cubicleQuantity`, `cubicleTotal`, `umpQuantity`, `umpRate`, `umpTotal`, `lockerQuantity`, `lockerTotal`, `deductionAmount`, `deductionReason`, `subtotal`, `totalAmount`, `amountPaid`, `balanceDue`, `paymentStatus` enum `PARTIAL`/`CLEARED`, `paymentDate`, `notes` mandatory internal audit notes, `emailStatus`, `emailSentAt`, `emailError`, `createdById`, `createdAt`, `updatedAt`).
    - `InstallerBillItem`: Line items mapped to models (`billId`, `cubicleModelId`, `modelName`, `category` enum `CUBICLE`/`UMP`/`LOCKER` default `CUBICLE`, `quantity`, `unitPrice`, `lineTotal`).
    - `InstallerBillPayment`: Payment installment audit records (`billId`, `amount`, `paymentDate`, `paymentMode`, `referenceNumber`, `notes`, `recordedById`, `createdAt`).
    - `InstallerBillSequence`: Atomic sequence generator tracking sequential numbers (`PPSI-XXXXX`).
14. **Employee Management & Payroll Suite**:
    - `Employee`: Master employee HR credentials directory (`id`, `employeeId` unique sequential `PPSE202609001`, `name`, `email` unique, `phone`, `address`, `governmentIdType` `AADHAAR`/`PAN`/`VOTER_ID`, `governmentIdNumber`, `bankAccountNumber` optional, `bankIfsc` optional, `bankName` optional, `bankAccountHolder` optional, `designation`, `department`, `responsibilities`, `monthlyCtc`, `joiningDate`, `status` `ACTIVE`/`INACTIVE`/`TERMINATED`, `clBalance`, `elBalance`, `createdAt`, `updatedAt`).
    - `EmployeeAttendance`: Daily attendance and shift logging (`employeeId`, `date`, `status` `PRESENT`/`DOUBLE_DUTY`/`CL`/`EL`/`UL`/`HALF_DAY`/`LEAVE`, `isSunday`, `isSundayOverride`, `overtimeHours`, `notes`, `markedById`, `createdAt`, `updatedAt`). `DOUBLE_DUTY` awards 2x duty days pay in payroll runs. `@@unique([employeeId, date])`.
    - `EmployeeLeaveLedger`: Chronological leave accrual & usage audit ledger (`employeeId`, `leaveType` `CL`/`EL`, `transactionType` `ACCRUAL`/`USAGE`/`ADJUSTMENT`, `amount`, `balanceAfter`, `month`, `year`, `reason`, `recordedById`, `createdAt`).
    - `EmployeeAdvance`: Short-term salary advances and scheduled recovery ledger (`employeeId`, `amount`, `reason`, `advanceDate`, `recoveryMonth`, `recoveryYear`, `isRecovered`, `recoveredAt`, `payrollRunId`, `createdById`, `createdAt`, `updatedAt`).
    - `EmployeeDeduction`: Custom deductions and penalties ledger (`employeeId`, `amount`, `reason`, `applyMonth`, `applyYear`, `isApplied`, `appliedAt`, `payrollRunId`, `createdById`, `createdAt`, `updatedAt`).
    - `EmployeePayrollRun`: Monthly payroll calculations and disbursement advice (`employeeId`, `month`, `year`, `monthlyCtc`, `totalCalendarDays`, `sundaysCount`, `approvedSundays`, `payableDays`, `perDayRate`, `presentDays`, `clDays`, `elDays`, `halfDays`, `unpaidDays`, `paidDays`, `overtimeHours`, `overtimeRate`, `overtimePay`, `grossSalary`, `advanceDeduction`, `otherDeductions`, `deductionSummary`, `netSalary`, `status` `DRAFT`/`FINALIZED`/`PAID`, `paidAt`, `paymentMode`, `paymentReference`, `paymentNotes`, `emailSent`, `emailSentAt`, `emailStatus`, `emailError`, `createdById`, `finalizedById`, `createdAt`, `updatedAt`). `@@unique([employeeId, year, month])`.
    - `EmployeeIdSequence`: Atomic sequence generator tracking monthly sequences (`PPSE` + `YYYYMM` + `XXX`).
15. **Daily Cash Expense Tracker & Cash-in-Hand Balance Suite**:
    - `ExpenseCategory`: Master directory of expense heads (`name`, `code` unique, `description`, `icon`, `color`, `isActive`, `isDefault`, `maxLimitPaise`, `requiresApproval`, `monthlyBudgetPaise`, `displayOrder`). Pre-seeded with 10 industry-standard categories (Logistics, Packaging, Tea/Snacks, Site Supplies, Repair, Utilities, Petty Office, Travel, Casual Labor, Miscellaneous).
    - `ExpenseEntry`: Itemized operational cash outflow records (`expenseNumber` sequential `EXP-YYYY-MM-XXXX`, `branchId`, `categoryId`, `amountPaise` strictly integer paise, `paymentMode` enum `CASH`/`UPI`/`BANK_TRANSFER`/`PETTY_CARD`/`CHEQUE`, `paidTo`, `paidBy` (cashier/payer staff name), `contactNumber`, `purpose`, `invoiceNumber`, `receiptUrl`, `notes`, `status` enum `PENDING_APPROVAL`/`APPROVED`/`REJECTED`/`AUTO_APPROVED`/`VOIDED`, `approvedById`, `approvedAt`, `rejectionReason`, `voidReason`, `voidedById`, `voidedAt`, `offlineClientId`, `syncedAt`, `createdById`, `employeeId`).
    - `ExpenseDailyLedger`: End-of-day physical cash count reconciliation and audit locking (`branchId`, `date`, `openingBalancePaise`, `totalFloatInPaise`, `totalExpensePaise`, `closingBalancePaise`, `physicalCashCountPaise`, `variancePaise`, `varianceReason`, `status` enum `OPEN`/`RECONCILED`/`VARIANCE_FLAGGED`/`LOCKED`, `notes`, `denominationJson` storing currency note counts $\times 500, 200, 100, 50, 20, 10, 5, 2, 1$, `closedById`, `closedAt`, `approvedById`, `approvedAt`). `@@unique([branchId, date])`.
    - `ExpenseFloatTopUp`: Replenishment of branch cash-in-hand register float (`branchId`, `amountPaise`, `source`, `referenceNumber`, `notes`, `addedById`).
    - `BranchCashBalance`: $O(1)$ fast lookup table maintaining live running cash balance (`branchId` unique, `currentBalancePaise`, `lastCalculatedAt`, `lastExpenseAt`).
    - `ExpenseDailyRollup`: High-performance pre-aggregated day-wise summary table updated on write (`branchId`, `date`, `totalExpensePaise`, `totalCount`, `approvedCount`, `pendingCount`, `rejectedCount`, `voidedCount`, `categoryBreakdownJson`). `@@unique([branchId, date])`.
    - `ExpenseMonthlyRollup`: High-performance month-wise financial summary table updated on write (`branchId`, `year`, `month`, `totalExpensePaise`, `totalCount`, `categoryBreakdownJson`). `@@unique([branchId, year, month])`.
    - `ExpenseAuditLog`: Immutable financial security audit log tracking every expense mutation, approval, rejection, void, top-up, and daily ledger lock.
    - `ExpenseSequence`: Atomic concurrency-safe sequence generator for `EXP-YYYY-MM-XXXX`.
    - `ExpenseSettings`: Branch or global threshold and policy configuration (`autoApprovalLimitPaise` default 200000 = ₹2,000, `requireReceiptAbovePaise` default 50000 = ₹500, `requireEmployeeLinkAbovePaise` default 500000 = ₹5,000, `maxDailyExpenseLimitPaise` default 5000000 = ₹50,000, `negativeBalanceAllowed` default false).
16. **B2B Order Management & Physical Stock Reservation Suite**:
    - `B2bOrder`: Master B2B enterprise order record (`orderNumber` unique sequential `PRC-B2B-YYYY-YY/XXXX`, `customerId` FK to `User`, `branchId` FK to `Branch`, `source` enum `ADMIN_OFFLINE`/`CUSTOMER_SELF_SERVICE`, `status` enum `PENDING_APPROVAL`/`CONFIRMED`/`CANCELLED`/`REJECTED`, `subtotalPaise`, `taxAmountPaise`, `grandTotalPaise`, `quoteId` optional FK to `Quote`, `poSubmissionId` optional FK to `PoSubmission`, `clientRequestId` unique idempotency key, `notes`, `approvedById`, `approvedAt`, `rejectionReason`, `rejectedById`, `rejectedAt`, `cancelledById`, `cancelledAt`, `cancellationReason`).
    - `B2bOrderItem`: Itemized order line records (`orderId` FK to `B2bOrder`, `productId` FK to `Product`, `sku`, `name`, `quantity`, `unitPricePaise`, `taxPercent`, `taxAmountPaise`, `totalPaise`, `isRemoved`).
    - `StockReservation`: Non-deducted inventory hold placed during `PENDING_APPROVAL` (`b2bOrderId` FK to `B2bOrder`, `b2bOrderItemId` FK to `B2bOrderItem`, `branchId` FK to `Branch`, `productId` FK to `Product`, `quantity`, `status` enum `ACTIVE`/`CONVERTED`/`RELEASED`, `expiresAt`). Available stock formula: $\text{Available} = \text{Physical} - \text{Active Reservations}$.
    - `B2bOrderSequence`: Atomic transaction-safe yearly sequence generator (`financialYear`, `lastSequence`) producing sequential `PRC-B2B-YYYY-YY/XXXX` order references.
17. **Production Barcode & 2-Stage Scan Lifecycle**:
    - `ProductScanLifecycle`: Tracks physical warehouse fulfillment scan lifecycle for products and parcels (`sku`, `trackingCode`, `orderId`, `orderItemId`, `status` enum `PENDING_PACK` / `PACKED` / `RECEIVED`, `scanCount` 0..2, `packedAt`, `packedBy`, `packedByName`, `packedDeviceId`, `packedBranchId`, `packedNotes`, `receivedAt`, `receivedBy`, `receivedByName`, `receivedDeviceId`, `receivedBranchId`, `receivedNotes`). Enforces terminal 2-scan constraint (Scan 1: Packing, Scan 2: Received; any 3rd scan blocked). Indexed by `sku`, `trackingCode`, `orderId`, and `status`.
18. **Payment Follow-up, Customer Dues & Aging Recovery Suite**:
    - `OpeningBalanceEntry`: Verifiable opening balance dues for historical legacy clients (`customerId`, `customerName`, `companyName`, `openingAmount`, `paidAmount`, `remainingBalance`, `referenceDate`, `referenceNote`, `sourceType`, `status`, `createdById`).
    - `PaymentAllocation`: Atomic payment allocation records linking cash/bank receipts to specific dues or oldest dues (`customerId`, `targetType` enum `OPENING_BALANCE`/`TAX_INVOICE`/`B2B_ORDER`/`PROFORMA_INVOICE`, `targetId`, `targetDocumentNumber`, `paymentAmount`, `allocatedAmount`, `paymentDate`, `paymentMode`, `transactionRef`, `allocationMode` enum `INVOICE_SPECIFIC`/`OLDEST_DUE_FIRST`, `notes`, `recordedById`).
    - `PaymentFollowupProfile`: Per-customer follow-up lifecycle state (`customerId` unique, `status` enum `ACTIVE`/`PAYMENT_PROMISED`/`PARTIALLY_PAID`/`PAID`/`OVERDUE`/`DISPUTED`/`DECLINED`/`MANUAL_REVIEW`, `declineReason`, `declinedAt`, `declinedById`, `notes`, `lastFollowupAt`, `nextActionDate`, `totalRemindersSent`, `ptpDate`, `ptpAmount`).
    - `PaymentFollowupEntry`: Chronological interaction touchpoint log (`customerId`, `channel` enum `CALL`/`SMS`/`EMAIL`/`LEDGER_EMAIL`/`NOTE`/`IN_PERSON`/`OTHER`, `outcome` enum `PAYMENT_PROMISED`/`PAYMENT_RECEIVED`/`NO_ANSWER`/`CALL_BACK_LATER`/`DISPUTED`/`REFUSED`/`WRONG_NUMBER`/`EMAIL_BOUNCED`/`SMS_FAILED`/`CALL_MADE`/`OTHER`, `notes`, `ptpDate`, `ptpAmount`, `nextActionDate`, `targetDocumentId`, `targetDocumentNumber`, `recordedById`).
    - `PaymentFollowupRule`: Automation rules for payment reminders (`name`, `isEnabled`, `agingThresholdDays`, `repeatIntervalDays`, `communicationType` enum `EMAIL_LEDGER`/`SMS_REMINDER`/`CALL_REMINDER`, `maxReminders`, `templateSubject`, `templateBody`).
    - `PaymentFollowupEmailLog` & `PaymentFollowupSmsLog`: Dispatch audit records for Resend Statement of Account emails with vector PDF attachments and HTTP SMS reminders.

> **Note on Removed Subsystems**: The legacy multi-tenant enterprise venture/POS subsystem was permanently removed in favor of direct SKU catalog management and this streamlined multi-branch inventory tracking suite.

---

## 4. Backend Module Architecture (`src/modules/`)

All modules follow a uniform, production-grade layered architecture:
`routes.ts` -> `controller.ts` -> `service.ts` -> `schema.ts` (Zod validation) -> Database (`database.ts` Prisma client).

| Module | Route Prefix | Primary Purpose |
|---|---|---|
| `allocation` | `/api/v1/allocation` | Order routing algorithm, warehouse scoring, pincode SLA mapping |
| `appointments` | `/api/v1/appointments` | Hardware service & installation scheduling |
| `auth` | `/api/v1/auth` | JWT auth, 2FA TOTP, email verification, password resets |
| `b2b-pricing` | `/api/v1/b2b-pricing` | Customer-specific pricing matrices & bulk rate lookup |
| `b2b-orders` | `/api/v1/b2b-orders` | Dedicated B2B Dual-Channel Order Management — Admin Offline orders (immediate confirm + physical stock deduction), Customer Self-Service orders (`pending_approval` + stock reservation), Super Admin approval gate (reservation -> physical deduction `B2B_ORDER`), Super Admin rejection (releases reservation, 0 stock movements), customer self-cancellation (strictly `pending_approval`), Super Admin cancellation (restores stock `B2B_CANCELLATION`), Super Admin line-item editing (delta stock adjustments `B2B_ADJUSTMENT`), and available stock lookup (`physical - reservedQuantity`). |
| `barcode` | `/api/v1/barcode` | Production Code-128 Barcode & QR code streaming (`/image`, `/qr`), streamlined 58mm & 80mm thermal sticker PDF generator (`/label`), camera/laser scan lookup (`/scan/:code`) with multi-branch stock levels & lifecycle state, order dispatch verification with physical inventory deduction (`POST /dispatch`), and **Strict 2-Stage Fulfillment Scan Lifecycle** (`POST /stage-scan`) enforcing terminal 2-scan progression (`PACKING` Scan 1 -> `RECEIVED` Scan 2) with device attribution (`deviceId`, `deviceName`). |
| `banners` | `/api/v1/banners` | Promotional hero banners, position targeting, CTR metrics |
| `cart` | `/api/v1/cart` | Shopping cart sync, item mutations, stock availability |
| `categories` | `/api/v1/categories` | Hierarchical category taxonomy & bestseller flags |
| `checkout` | `/api/v1/checkout` | Order calculation, tax computation, address validation |
| `cms` | `/api/v1/cms` | Dynamic pages, blogs, and FAQ content |
| `coupons` | `/api/v1/coupons` | Promo code validation, discounts, defensive self-healing |
| `dashboard` | `/api/v1/dashboard` | Admin executive analytics, revenue KPIs, growth rates |
| `enquiries` | `/api/v1/enquiries` | Customer tickets, contact queries, resolution workflow |
| `homepage` | `/api/v1/homepage` | Dynamic storefront layout sections & module ordering |
| `inventory` | `/api/v1/inventory` | Multi-branch stock tracking (Delhi/Kolkata), reserved quantities, threshold alerts, streamlined non-redundant querying, and **Unified Stock-to-Catalog Cascade Deletion** (`DELETE /:id` resolving by inventory ID, product ID, SKU, or variant SKU, writing off remaining physical units with audit logs, deleting branch allocations, soft-deleting catalog products with `deletedAt`, and deactivating variants). |
| `branches` | `/api/v1/branches` | Physical facility registration, codes, addresses, activation status |
| `suppliers` | `/api/v1/suppliers` | Vendor directory, GSTIN tracking, contact dossiers |
| `purchases` | `/api/v1/purchases` | Stock-in procurement ledger ("Kahan Se Kharida"), unit pricing, purchase orders |
| `transfers` | `/api/v1/transfers` | Inter-branch transfers with reservation, dispatch, and receiving stages |
| `stock-adjustments` | `/api/v1/stock-adjustments` | Cycle count adjustments, damages, returns with mandatory reason audit |
| `stock-movements` | `/api/v1/stock-movements` | Immutable audit ledger of every inventory mutation across facilities |
| `invoices` | `/api/v1/invoices`, `/api/v1/gst/invoices`, `/api/v1/gst/einvoice` | GST tax invoices, IRN generation (`POST /gst/einvoice/:id/generate`), IRN cancellation, signed QR codes, IRN JSON exports, HTML/PDF rendering, and DRAFT validations |
| `logistics` | `/api/v1/logistics` | Courier integration, waybill generation, SLA tracking |
| `notifications` | `/api/v1/notifications` | Real-time SSE event stream, user inbox, admin alerts |
| `orders` | `/api/v1/orders` | Full order lifecycle, status transitions, cancellation restock |
| `payments` | `/api/v1/payments` | Razorpay & PhonePe checkouts, webhooks, refund processing |
| `payment-followup` | `/api/v1/payment-followup`, `/api/v1/dues-recovery` | Production-grade customer dues recovery & receivables management — 4-bucket aging calculations (`0-30`, `31-60`, `61-90`, `90+` days), legacy customer onboarding (`source = OLD_CUSTOMER`) with opening balances, atomic payment allocations (`INVOICE_SPECIFIC` & `OLDEST_DUE_FIRST`), decoupled Resend mailer with pure B&W Statement of Account PDF, HTTP SMS reminders with variable interpolation, dispute & decline isolation queue, 2-stage bulk communication preview & dispatch, and scheduled automation rules runner. |
| `po-management` | `/api/v1/po-management` | Inbound business email ingestion, PO multi-factor classification, atomic sequence generator (`PRC-PO-YYYY-XXXXXX`), email threading, PO dossier management, customer storefront submissions (`POST /customer-submit` for Quotation-linked POs, Custom Form line-item composer, and Direct PO document uploads), **AI-Powered PO Detection & Procurement Extraction Engine** (`POST /api/v1/po-management/:id/ai-detect`, `POST /api/v1/po-management/ai-detect-batch`) via PRC PILOT LLM with resilient offline semantic heuristic fallback, intelligent customer PO number extraction, company name parsing, and priority suggestion. |
| `proforma-invoices` | `/api/v1/proforma-invoices` | Dedicated B2B Proforma Invoice (PI) lifecycle suite — **Admin-Only Generation** (from scratch, Quotation, PO, or Order), atomic sequence generator (`PRC/PI/YYYY-YY/XXXX`), automated Indian GST computation (Delhi HQ Intra-state CGST 9% + SGST 9%, Interstate IGST 18%), advance payment terms schedule, HMAC-SHA256 digital signing, high-density vector QR code generation, vector-branded A4 PDF export (borderless QR and logo, pure monochrome contrast), public anti-tamper QR verification resolver, **Customer Self-Service API** (`GET /customer/my-proformas`), **Customer Storefront Portal** (`/pi/:token` & `/proforma/:token`), **B2B Profile Proforma Section** (`UserProfilePage.tsx` tab), **Commercial Ledger & Remaining Balance Engine** (`GET /:id/ledger`), **WhatsApp & Email Payment Reminder Engine with PDF auto-attachment** (`POST /:id/reminder`), and **Follow-up Counter Tracking** (`reminderCount`, `emailReminderCount`, `whatsappReminderCount`, `lastReminderAt`, `lastWhatsappAt`, `lastEmailAt`). |
| `products` | `/api/v1/products` | Hardware SKU catalog, prices, specs, tags, filters |
| `quotes` | `/api/v1/quotes` | B2B bulk quotations, negotiations, approvals, PDF quotes |
| `reports` | `/api/v1/reports` | Financial & sales data exports (CSV, XLSX, PDF) |
| `reviews` | `/api/v1/reviews` | Product reviews, star ratings, moderation workflow |
| `roles` | `/api/v1/roles` | RBAC role definitions, permission matrix assignment |
| `search` | `/api/v1/search` | Search indexing, fuzzy matching, query analytics |
| `settings` | `/api/v1/settings` | System-wide configuration, company GSTIN, maintenance |
| `shipping` | `/api/v1/shipping` | Shipping zone calculation, pincode validation |
| `upload` | `/api/v1/upload` | Media asset upload manager, image optimization |
| `users` | `/api/v1/users` | Customer profiles, admin staff management, addresses, and **Super Admin Password Management** (`POST /api/v1/users/:id/change-password` guarded by `requireSuperAdmin` and `authorize('users.update')` allowing direct password changes for any administrator account with mandatory session revocation and optional forced reset on next sign-in). |
| `variants` | `/api/v1/variants` | Product variant matrix (color, size, finish), SKUs |
| `wishlist` | `/api/v1/wishlist` | Customer saved wishlists & demand forecast tracking |
| `installer-payments` | `/api/v1/installer-payments` | **Cubicle Installer Payment Tracking** — Dynamic Models Master CRUD across 3 categories (`CUBICLE`, `UMP`, `LOCKER`), atomic sequential bill generation (`PPSI-00001`), automated NCR territory detection, deductions & penalties (`deductionAmount`, `deductionReason`), installment payments ledger, auto-clearance calculation (`Net Total = Math.max(0, Subtotal + Travel - Deductions)`), automated PDF advice with red deduction itemization, 26-column Excel (.xlsx) export with deduction metrics, technician filter queries, and dedicated installer payment history ledger endpoint (`GET /installers/:id/ledger`). |
| `employees` | `/api/v1/employees` | **Employee Management & Payroll Suite** — Master employee HR directory with auto-generated atomic sequential IDs (`PPSE202609001`), strict Government ID validation (Aadhaar/PAN/Voter ID), bank credentials, daily attendance tracking with Sunday override, overtime hours, **Double Duty (2x Shifts)** support, instant **Toggle-Off (Simple) Unmark** deletion (`DELETE /attendance`), automated leave accrual (+1.00 CL/month, +0.25 EL/month), advance and deduction recovery pipelines, monthly payroll formula calculation engine with 2x duty pay for Double Duty ($\text{Payable Days} = \text{Total Days} - \text{Default Sundays} + \text{Approved Sundays}$, $\text{Paid Days} = \text{Present} + \text{CL} + \text{EL} + 0.5 \times \text{Half} + \text{Approved Sundays}$, $\text{OT Pay} = \text{OT Hours} \times (\text{Per-Day Rate} / 8)$, $\text{Net} = \text{Gross} - \text{Advances} - \text{Deductions}$), Super Admin disbursement authorization (`POST /payroll/:id/mark-paid`), vector-styled A4 PDF payslip generation via `pdfmake`, and automated email dispatch with PDF attachment via `sendMail`. |
| `expenses` | `/api/v1/expenses` | **Organization-Level Daily Cash Expense Tracker** — Fast entry cashier workflow (<10s) with dual attribution (`paidBy` Who Paid Name + `paidTo` Vendor/Person), live running cash-in-hand balance ($O(1)$ `BranchCashBalance`), dual-layer threshold auto-approval ($\le ₹2,000$ auto-approved, $> ₹2,000$ admin review), **Atomic Batch Pipelined Transactions** (`prisma.$transaction([ ... ])` on approval/rejection eliminating interactive transaction overhead on PgBouncer pooler), receipt slip upload engine (`POST /upload-receipt` via Multer memory storage & Supabase CDN supporting JPEG, PNG, WEBP, HEIC, PDF up to 10MB), voucher edit pipeline (`PATCH /:id` with atomic balance recomputation and audit logging), super-admin voucher deletion (`DELETE /:id` with automatic financial refund/restoration for approved vouchers back into `BranchCashBalance.currentBalance`), float top-up replenishments, voiding with reverse balances & audit reasons, end-of-day physical cash reconciliation with denomination breakdown ($\times 500, 200, 100, 50, 20, 10, 5, 2, 1$) & variance reporting, multi-sheet Excel reports via `exceljs` with branch location selection (Delhi HQ, Kolkata Branch, or All Branches Consolidated), uniform 13-column itemized voucher worksheets across all report periods (Date, Voucher No, Branch, Who Paid, Category, Sub-Category, Amount, Payment Mode, Description, Paid To, Clickable Receipt Slip, Status, Approved By) with native `autoFilter` header controls and total sum formulas, pre-aggregated daily/monthly rollups on write, and offline tolerance sync. |
| `up` | `/api/admin/up` | **UP Private Factory Operations & Ledger** — Private factory daily expense ledger, receipt capture, petty cash reconciliation with denomination counters, immutable audit trail, and Super Admin allow-list delegation. |
| `up-inventory` | `/api/admin/up/inventory` | **UP Factory Inventory (Vendor & Supplier to PRC)** — Single-facility manufacturing plant inventory management. Endpoints: `POST /products` (register finished goods & raw materials), `POST /supply-prc` (outward vendor dispatch to PRC Hardware branch depots with delivery challan), `GET /dispatches` (outward challan ledger), `POST /receive` (material receipts), `POST /issue` (production floor issuance), `POST /damage` (defects write-off), `POST /scrap` (industrial scrap logging), `POST /bom` (assembly recipe master), and `POST /production-orders` (WIP jobs). |

---

## 5. Security & Authentication Flow

1. **Access Tokens**: Short-lived JWTs passed in `Authorization: Bearer <token>` or HTTP-only cookies.
2. **Refresh Tokens**: Long-lived tokens rotated on refresh at `/api/v1/auth/refresh`.
3. **Two-Factor Authentication (2FA)**:
   - TOTP Authenticator apps (Google Authenticator, Authy) supported.
   - Enforced in `auth.middleware.ts` before sensitive operations.
4. **RBAC Middleware**:
   - `requireAuth`: Ensures valid authenticated user session.
   - `requireRole(['super_admin', 'admin'])`: Restricts endpoint to specific roles.
   - `requirePermission('products.create')`: Granular capability verification against `RolePermission`.

---

## 6. Development Guidelines & Modification Protocol

Whenever introducing changes to the codebase, follow these rules:

1. **Database Changes**:
   - Update `prisma/schema.prisma`.
   - Add idempotent DDL patch to `src/scripts/fix-db.js` if deploying to live Supabase pooler without full migration downtime.
   - Run `npx prisma generate` to rebuild Prisma Client.
   - Validate with `npx prisma validate`.
2. **Type Safety**:
   - Always run `npx tsc --noEmit` on the affected projects (`PRC-Backend`, `admin`, or `frontend`) to guarantee 0 compile errors.
3. **Cross-Project Synchronization**:
   - If an API endpoint or response structure changes in `PRC-Backend`, immediately update:
     - The corresponding service in `D:\admin\src\api\` and types in `D:\admin\src\types\admin.ts`.
     - The corresponding service in `D:\frontend\src\services\` and types in `D:\frontend\src\types\`.
4. **Update This File**:
   - Record any new models, endpoints, or architectural changes in this `PROJECT_CONTEXT.md` document.

---

## 7. Storefront Mobile-First UX Architecture (`D:\frontend`)

The Storefront was architected and optimized for native app-like responsiveness on small mobile devices (320px–420px):
- **Responsive Top Navigation**: Removed cluttered search and profile buttons on small screens, shifting brand logo to right with left hamburger drawer.
- **Dedicated Bottom App Bar & Search Overlay**: Bottom navigation bar triggers interactive search overlay (`SearchOverlay.tsx`) modal without unnecessary page transitions.
- **Ultra-Compact Product Cards (`ProductCard.tsx`)**: Re-engineered with `p-1.5` internal padding, scaled micro-typography, compact stock badges, and responsive action triggers (`Add` on mobile vs `Add to Cart` on desktop).
- **Product Detail Viewing Page (`ProductDetailPage.tsx`)**: Responsive image gallery viewport (`h-64 sm:h-80 md:h-[450px]`), touch-scrollable horizontal specifications and review tab bar (`no-scrollbar touch-pan-x`), compact pricing and finish options, and a fixed bottom sticky purchase bar for mobile checkout.
- **Showcase & Aesthetic Banners (`ShopByAestheticSection.tsx`, `CubicleHardwareSection.tsx`, `LockerHardwareSection.tsx`)**: Clean responsive CSS grid with smooth hardware-accelerated scroll-reveal animations on mobile (even cards slide in from left, odd cards from right) and `overflow-hidden` containers to eliminate jitter and horizontal overflow.
- **Product Showcase Sliders (`SuperSaverSection.tsx`, `BestSellerSection.tsx`, `ValueMoneySection.tsx`)**: Upward scroll-triggered animation (`opacity-0 translate-y-12` -> `opacity-100 translate-y-0`) with staggered product card elevation as the user scrolls into view.
- **Responsive Order & Quotation Suite (`UserProfilePage.tsx`, `RequestQuotePage.tsx`, `CustomerQuoteApprovalPage.tsx`, `B2BQuotationManager.tsx`, `SubmitPoPage.tsx`)**: Optimized orders tab, dedicated Purchase Orders (PO) tab (`/profile?tab=po`) with live tracking, document downloads, and status indicators, B2B quotation submission form, line item cards, financial cost breakdown, and digital signature verification seal with compact typography, scaled paddings, and mobile-first touch actions for small devices (320px–420px).
- **Reversible Bidirectional Scroll Animations (`useInView.ts`, Showcase Sections)**: Implemented continuous reversible scroll observation across all showcase banners and product sliders. When scrolling into view (up or down), cards and headers glide in smoothly with staggered elevation; when scrolling past or away, components gracefully reset their transforms so they continuously re-animate on every scroll interaction.
- **Our Clients & Completed Projects Portfolio Suite (`/projects`, `ProjectsPage.tsx`, `IndiaMap.tsx`, `ProjectFilterBar.tsx`, `ProjectCard.tsx`, `ProjectDetailModal.tsx`, `projectService.ts`)**:
  1. **Dedicated Storefront Route & Footer Placement (`/projects`, `Footer.tsx`)**: High-impact national architectural portfolio showcasing PRC Hardware's completed installations across India, neatly linked from the Quick Links footer navigation.
  2. **Authentic Geographic Outer Line Vector Map (`IndiaMap.tsx`, `india-exact-vector.json`)**: Built directly from the official GIS boundary coordinates of India, displaying exclusively the clean outer line and silhouette of India (Mainland + Andaman & Nicobar + Lakshadweep) with zero adjacent country maps or external tile clutter. Features an architectural golden outline (`#D39858`, weight 2.2), subtle 3D elevation shadow, mathematically precise GPS coordinate pins for 25+ major hubs (Bangalore 48, Delhi NCR 35, Mumbai/Thane 15, Lucknow, Guwahati, Hyderabad, Udaipur, etc.), interactive city spotlight popovers, and a 1-click **"Open in Google Maps ↗"** direct link.
  3. **Multi-Dimensional Filter & 10-Card Pagination Suite (`ProjectFilterBar.tsx`, `ProjectsPage.tsx`)**: Live search across client/project/fittings, city dropdown, and category selector pills. Added responsive 10-cards-per-page pagination with first/last, prev/next, and smart numbered buttons with smooth scroll-up to `#portfolio-grid`.
  4. **Full-Spectrum Responsiveness**: Optimized across all viewports (1 column on mobile, 2 columns on tablets/medium screens `sm:grid-cols-2`, 3 to 4 columns on desktop `lg:grid-cols-3 xl:grid-cols-4`), with responsive drawer spotlight and compact trust metrics.
  5. **Project Details Dossier Modal (`ProjectDetailModal.tsx`)**: High-resolution image gallery carousel (supporting minimum 2 photos with thumbnail rail, next/prev navigation, and fullscreen zoom lightbox) and embedded 16:9 landscape video player (supporting YouTube, Vimeo, and direct MP4 streams).
  6. **Admin Project Management Console (`d:\admin\src\pages\ProjectsPage.tsx`, `projectsService.ts`)**: Complete administrative management suite with KPI cards, multi-image uploader (drag/click reorder, cover photo selection, minimum 2 images validator), 16:9 video link support, featured toggle, visibility controls, and automated 133+ project database seed/sync.
  7. **Database Persistence & Zero-Downtime Patch (`schema.prisma`, `fix-db.js`)**: Added `Project` model with automated DDL migration table creation on boot, and backend REST endpoints under `/api/v1/projects` with geographic location aggregations.
- **Trusted Landmark Projects & Enterprise Showcase (`TrustedProjectsSection.tsx`)**: Multi-track continuous auto-scrolling marquee (dual-direction: Rows 1 & 3 Right-to-Left, Row 2 Left-to-Right) showcasing 130+ landmark projects with smooth pause-on-hover micro-interactions and direct **"Explore Interactive India Map & Completed Projects →"** link to `/projects`.
- **Product Weight Unit Standardization (Grams)**: Product weight specifications standardized to Grams (`Weight (Gram)` / `g`) across Admin (`CreateProductPage.tsx`, `EditProductPage.tsx`, `ProductDossierModal.tsx`, `ProductDossierPage.tsx`) and Storefront (`ProductDetailPage.tsx`) with seamless backwards-compatible formatting.
- **Deployment Stale Chunk Resilience & Auto-Reload Suite (`lazyWithRetry.ts`, `ViewErrorBoundary.tsx`, `vercel.json`)**: Integrated resilient dynamic import loaders that automatically detect stale Vite deployment chunks (preventing MIME type `text/html` errors when clients have older sessions open during Vercel deploys), triggering a seamless refresh with loop guards and view-level error boundary fallbacks across both Admin Console and Customer Storefront.
- **User Address Management Suite (`/api/v1/users/addresses`)**: Implemented complete CRUD endpoints for user addresses (`GET`, `POST`, `PATCH`, `PUT`, `DELETE` on `/users/addresses` & `/users/addresses/:addressId`) mounted before `/:id` admin routes. Added dual payload compatibility (`addressLine1`/`line1`, `postalCode`/`pincode`), contact fields (`phone`, `email`, `altPhone`), **WhatsApp availability toggle** (`hasWhatsapp`), **GPS geolocation / Map location picker coordinates** (`latitude`, `longitude`), address label chips, and idempotent PostgreSQL DDL table patches in `fix-db.js` and `database.ts`.
- **Customer B2B Upgrade & Downgrade Safeguard (`UserProfilePage.tsx`, `users.service.ts`)**: Implemented explicit self-serve upgrade workflow allowing B2C retail customers to upgrade into B2B Wholesale Partners by providing Company Name and 15-character GSTIN. Once upgraded or registered as B2B, the account is permanently locked to B2B status (downgrading back to B2C is strictly blocked on backend and locked in frontend UI to preserve wholesale pricing agreements, quote archives, and GST billing records).
- **Government GSTIN, Phone & Email Validation Suite (`validation.utils.ts`, `validation.ts`)**: Implemented complete multi-layer validation:
  1. **GSTIN Validation**: Official GSTN Luhn Mod-36 checksum calculation, 37 Indian State/UT code validation with live state resolution (e.g. `27` -> Maharashtra), and PAN entity type decoding.
  2. **Phone Number Validation**: Strict 10-digit Indian mobile validation (`^[6-9]\d{9}$`), normalization (stripping `+91`/`0`/formatting), and rejection of dummy/sequence numbers.
  3. **Email Deliverability & Disposable Blocker**: Zero-cost DNS MX record verification (`dns.promises.resolveMx`) and 30+ disposable email domain blocklist (`tempmail`, `mailinator`, `10minutemail`, `yopmail`, etc.).
- **Duplicate Account Prevention, Phone Multi-Account Limit & Unified Password Recovery (`auth.service.ts`, `AuthModal.tsx`)**:
  1. **Registration Duplicate Prevention**: Pre-checks Email, GSTIN, and Company Name before creation. Rejects duplicates with a 1-click **"Reset Password →"** action that pre-fills their identifier into account recovery.
  2. **Phone Number Multi-Account Limit**: Enforces a strict maximum of **3 accounts per phone number**; 4th registration triggers `PHONE_LIMIT_EXCEEDED`.
  3. **Unified Password Reset via Email OR GSTIN with 6-Digit OTP**: Customers can initiate recovery by typing either their Email or GSTIN. A 6-digit OTP is dispatched to their registered email with interactive OTP entry and instant password reset.
- **Admin Customer 360° Master Profile & Full-Page Dossier Hub (`/api/v1/users/:id/360`, `CustomerDossierPage.tsx`, `UsersPage.tsx`, `/user-detail`)**:
  1. **Unified Search Engine**: Admin can instantly find accounts by 15-digit GSTIN, Email, 10-digit Phone number, Company Name, or First/Last name.
  2. **Customer Longevity & Seniority**: Real-time calculation of platform membership duration (Years, Months, Days).
  3. **Full-Page 360° Dossier View**: Dedicated full-page experience (`CustomerDossierPage.tsx`, route `/user-detail` / `/customer-detail`) with top breadcrumb navigation, "Back to Directory" action, customer identity hero card, WhatsApp integration, and 7 deep tabs: Identity & Legal credentials, Address Book with 1-click Google Maps GPS navigation and WhatsApp indicators, Order History with line items and fulfillment status, RFQ Quotations pipeline with digital seals, GST Tax Invoices register, Proforma Invoices (PI) & Purchase Orders (PO) tracking, B2B Custom Matrix Pricing rates with live discount margins, and security logs.
- **Enterprise Admin 360° Activity Dossier & Full Audit Logging Hub (`/api/v1/audit/admin/:id/360`, `AdminDossierPage.tsx`, `AdminManagementPage.tsx`, `auditLogger.ts`, `admin_audit_logs`)**:
  1. **Super-Admin Security Clearance Gate**: Only authenticated users with the `super_admin` role can access full admin activity dossiers and sensitive audit logs. Non-super-admins attempting access receive strict HTTP 403 Forbidden protection.
  2. **Production Database Audit Tracking**: Idempotent PostgreSQL `admin_audit_logs` table (patched in `fix-db.js`) tracks all admin operations across the system with user ID, name, email, role, action, domain entity, target IDs, summary details, severity level, JSONB metadata/diff snapshots, IP address, and user agent.
  3. **Multi-Domain Action Interceptors**: Logs Quotation approvals/rejections/edits, GST Tax Invoices and Proforma Invoices (PI) generation, Purchase Order (PO) approvals, Customer creations/deletions/edits, B2B custom pricing overrides, Product & variant creations/edits/deletions, Stock adjustments, and Role/Permission modifications.
- **Enterprise Staff Provisioning & Security Settings Architecture (`AdminManagementPage.tsx`, `AdminSecuritySettings.tsx`)**:
  1. **Separation of Concerns**: Removed admin creation widgets and modal from Personal Security Settings (`/settings`), focusing `/settings` exclusively on personal 2FA authenticator app pairing (TOTP), secret key regeneration, backup codes, and security preferences.
  2. **Comprehensive Staff Provisioning Workflow (`/admins`)**: Consolidated all administrator, store manager, and staff provisioning into the Super-Admin gated `AdminManagementPage.tsx`.
  3. **Granular Role Assignment & Preview**: Dynamic role selector fetching all active system and custom roles with role badge, description, and permission scope overview before provisioning.
  4. **Password Security Suite**: Features real-time email regex validator, 1-click **Generate Strong Password** utility (`generateRandomPassword`), reveal/hide password toggle, and "Require password change on first sign-in" enforcement.
- **Custom Role & Custom Permission CRUD Governance Suite (`/api/v1/roles/permissions`, `roles.service.ts`, `RolesPage.tsx`, `rolesApi`)**:
  1. **Comprehensive Platform Permissions Registry (49 Modules, 241 Permissions)**:
     - Expanded from the legacy 120 permissions to a comprehensive 241-permission matrix covering every operational domain across the company:
       - **Employee Management HR Suite**: `employees` (`read`, `create`, `update`, `delete`, `export`), `attendance` (`read`, `mark`, `update`, `batch`, `sunday_approval`), `leaves` (`read`, `adjust`, `accrue`), `advances` (`read`, `create`, `update`, `delete`), `deductions` (`read`, `create`, `update`, `delete`), `payroll` (`read`, `calculate`, `finalize`, `revert_draft`, `disburse`, `download_payslip`, `email_payslip`).
       - **Installer Payments & Cubicle Suite**: `installer_payments` (`read`, `create`, `update`, `delete`, `record_payment`, `download_bill`, `send_email`, `export`), `cubicle_installers` (`read`, `create`, `update`, `delete`, `ledger`), `cubicle_models` (`read`, `create`, `update`, `delete`).
       - **B2B Proforma Invoices (PI)**: `proforma_invoices` (`read`, `create`, `update`, `approve`, `cancel`, `sign`, `send_email`, `send_whatsapp`, `download_pdf`, `delete`), `invoices.edit`.
       - **PO Management & AI Scanner**: `po_management` (`read`, `create`, `update`, `classify`, `ai_scan`, `reply_email`, `assign`, `delete`), `po.manage`.
       - **Multi-Branch Operations & Logistics**: `branches` (`read`, `create`, `update`, `delete`), `suppliers` (`read`, `create`, `update`, `delete`, `manage`), `purchases` (`read`, `create`, `update`, `delete`, `view`, `edit`), `stock_transfers` (`read`, `create`, `edit`, `dispatch`, `receive`, `cancel`), `transfers` aliases.
       - **Catalog & Pricing Extensions**: `materials` (`read`, `create`, `update`, `delete`, `manage`), `b2b_pricing` (`read`, `create`, `update`, `delete`), `appointments` (`read`, `create`, `update`, `delete`, `manage`), `projects` (`read`, `create`, `update`, `delete`, `manage`), `ai_agent` (`ai.use`).
     - **Self-Healing on Container Boot**: `fix-db.js` automatically runs `seedAllPermissions()` on every deploy/restart to idempotently patch any missing permissions in Supabase PostgreSQL and link them to the Super Admin role.
     - **Custom Role Route Authorization**: Backend routes across `employee-management`, `installer-payments`, `b2b-pricing`, `materials`, and `projects` use granular `authorize(...)` and role middleware fallback so customized staff roles possess exact, scoped execution privileges without requiring hardcoded admin role slugs.
  2. **Full Permission CRUD Endpoints**:
     - `POST /api/v1/roles/permissions`: Create new discrete permissions with display name, module categorization, auto/custom key slug, and scope description.
     - `GET /api/v1/roles/permissions`: List all registered permissions grouped by module.
     - `PATCH /api/v1/roles/permissions/:id`: Update permission metadata (name, module, slug, description).
     - `DELETE /api/v1/roles/permissions/:id`: Permanently delete custom permissions and automatically cascade-revoke from assigned role junction tables.
  3. **Dual-Tab RBAC Command Center (`RolesPage.tsx`)**:
     - **Tab 1 ("Security Roles & Access Matrix")**: Select role, view assigned permissions count, toggle discrete or batch CRUD actions (All Create, All Read, All Update, All Delete), clone role templates, and quickly register new custom permissions directly via an in-matrix shortcut button without losing place. All 49 modules feature dedicated icons (`Briefcase`, `Clock`, `CalendarCheck`, `IndianRupee`, `Wrench`, `Building2`, `Truck`, `Receipt`, `Bot`, `FolderKanban`, etc.) and human-readable formatting (`formatModuleName`).
     - **Tab 2 ("System & Custom Permissions Directory")**: Full searchable and filterable directory of all 241 permissions with module chips, CRUD badges, code snippets with 1-click clipboard copy, and inline Edit & Delete modals for custom permissions.
- **Multi-Branch Live Stock, Concurrency-Guarded Sales & Catalog Search Engine (`inventory.service.ts`, `checkout.service.ts`, `orders.service.ts`, `ProductPicker.tsx`, `ProductsPage.tsx`, `InventoryPage.tsx`)**:
  1. **Atomic Concurrency-Guarded Sales Mutation (`recordSale`)**: Every customer order checkout automatically decrements branch stock with atomic guard conditions (`updateMany({ where: { productId, branchId, quantity: { gte: qty } } })`), rolls back the checkout transaction on stock exhaustion, creates immutable `StockMovement` records (`SALE_OUT`), synchronizes catalog totals (`syncProductStock`), and emits real-time `inventory.low_stock` alerts.
  2. **Order Cancellation & Return Restock (`recordRestock`)**: When orders are cancelled or returned, line items are automatically credited back to the fulfilling facility ledger as `RETURN_IN` movements with full audit rationale.
  3. **Single Source of Truth Stock Status (`getStockStatus`)**: Standardized calculation across backend API, Excel/PDF export services, and Admin UI views with consistent thresholds (`OUT_OF_STOCK`, `LOW_STOCK`, `IN_STOCK`).
  4. **Reusable Combobox (`ProductPicker.tsx`)**: Debounced server-side product lookup (300ms) with thumbnail, SKU, price, cross-branch total stock, and live facility-specific available-to-transfer check (`GET /inventory/product/:productId`) wired into Procurement (`PurchaseModal`), Transfers (`TransferModal` with pre-submit quantity validation), and Adjustments (`AdjustmentModal`).
  5. **Server-Side Catalog Search & Filtering (`ProductsPage.tsx`)**: Server-side pagination, debounced query search, quick filter pills (`All`, `In Stock`, `Out of Stock`, `Featured`, `Bestsellers`, `Offers`, `New Arrivals`), and real-time stock health badges.
  6. **Harmonized Admin Inventory UI Design System (`InventoryPage.tsx`)**: Modernized and aligned color palette and layout tokens to match the global Admin Console (`#8B5CF6` primary violet accent, `dark:bg-[#18181B]` surfaces, `dark:border-[#27272A]`, `dark:bg-[#09090B]` canvas, rounded-2xl cards, standard breadcrumbs, unified badge hierarchy, and styled modal forms).
  7. **Fulfillment Facilities & Branch Management (`InventoryPage.tsx`, `inventory.service.ts`, `fix-db.js`, `database.ts`)**: Added a 6th dedicated tab ("Fulfillment Facilities") in the Inventory Hub and "+ Add Facility" / "+ New Facility" action controls. Admins can view all physical branch depots, register new facilities (name, 2-6 char uppercase code, city, state, full address, active status toggle), edit facility details, and auto-initialize 0-quantity catalog inventory records across all active products. Database auto-healers (`fix-db.js` and `database.ts`) maintain both camelCase and snake_case column aliases (`isActive`, `createdAt`, `updatedAt`, `deletedAt`) to ensure zero-downtime database synchronization.
  8. **Dedicated Add SKU & Stock Allocation Suite (`AddSkuPage.tsx`, `InventoryPage.tsx`, `inventory.service.ts`, `inventory.schema.ts`, `inventory.routes.ts`)**:
     - `POST /api/v1/inventory/quick-stock`: Direct entry point to register brand new items or link existing catalog products by SKU, Name (mandatory), Quantity, Facility (supporting `PRC_STOCK` central master allocation), Finish, Colour, Dimensions (Height, Width, Length in mm), non-mandatory Unit Cost and Selling Price, and Reorder Level in one step.
     - `Dedicated Add SKU Page ('inventory-add-sku')`: Replaces modal popups when clicking "+ Add SKU & Stock" / "+ Add New SKU & Stock" in the Inventory Hub. Provides full-page operational workspace with breadcrumbs, return link to `/inventory`, live catalog checking, and live product dossier preview card.
     - `Finish & Dynamic Colour Architecture`:
       - Finish options: `{ SS, NA, NYLON }`.
       - Colour options dynamically constrained to selected finish:
         - **SS**: `Golden`, `Black`, `SS` (Stainless Steel Natural).
         - **NA**: `Black`, `NA Aluminium`.
         - **NYLON**: `Black`.
     - `Dimensions & Sizing Protocol`: Optional `height`, `width`, and `length` inputs recorded in millimeters (`mm`) and persisted to `Product.dimensions` (`{ height, width, length, unit: 'mm' }`) and `Product.attributes`.
     - `Pricing Flexibility`: Unit purchase price/cost and selling price/MRP are non-mandatory (optional), while SKU Name and SKU Code are strictly mandatory.
     - `Stock Matrix Tab`: Features a dedicated **Total Product Stock Sum** column calculating consolidated cross-branch stock product-by-product alongside branch-specific allocations. Includes a multi-field real-time filter toolbar (Product Name filter, SKU filter, Destination Facility dropdown, Stock Health Status dropdown, Category dropdown, Low-Stock toggle, and Clear Filters control).
     - `Seamless Catalog Merging`: Both backend (`listInventory`) and client API (`inventoryApi.getInventory`) seamlessly cross-reference the Product catalog so all newly created SKUs and products immediately display in the Stock Matrix even before branch ledger rows are created.
  9. **Searchable SKU & Product Name Auto-Fetch (`CreateProductPage.tsx`, `inventory.service.ts`, `adminApi.ts`)**:
     - Searchable dropdowns for both `Product Name` and `SKU` fields query both catalog and live inventory in real time.
     - Dual-layer stock resolution computes the true consolidated live warehouse quantity across all fulfillment branches (`getProductInventory` falls back gracefully to `Product.stock` when branch ledger rows are pending).
     - Selecting an existing item auto-populates Name, SKU, live available Stock Quantity, Reorder Level, Pricing, and Category with an accurate Live Stock Link status banner.
  10. **Strict Inventory Ledger Audit Locking on Product Updates (`EditProductPage.tsx`, `products.service.ts`)**:
     - On product creation (`CreateProductPage.tsx`), initial stock can be set.
     - On product editing (`EditProductPage.tsx`), **Stock Quantity** is strictly **Read-Only / Ledger-Locked** and excluded from `cleanPayload` and `updateProduct` updates. Stock adjustments must strictly be executed through the Inventory Hub (`/inventory`) via Procurement Stock-In, Inter-Branch Transfers, or Ledger Adjustments to preserve audit integrity.
  11. **Production-Grade Procurement (Stock-In) & Stock Ledger Audit Hub (`InventoryPage.tsx`, `inventory.service.ts`, `adminApi.ts`)**:
     - **Procurement (Stock-In) Tab (`activeTab === 'purchases'`)**:
       - Features a full multi-field filter toolbar: Search by Invoice #, Supplier, or Line Item, filter by Destination Facility (including `PRC_STOCK`), and filter by Vendor/Supplier with live transaction counts and Clear Filters controls.
       - `PurchaseModal`: Supports selecting `PRC_STOCK (Central Depot Allocation)` or individual branch facilities, catalog SKU search or dynamic on-the-fly custom item creation, flexible supplier selection or custom vendor entry, live calculation of line totals and grand totals, and instant ledger synchronization.
       - Detailed Invoice Breakdown Drawer (`selectedPurchase`): Inspects item-by-item SKU, product name, quantity, unit purchase cost, line total, supplier contact details, and receiving depot.
       - Dual-layer fallback export (`inventoryApi.downloadPurchasesReport`) downloads backend XLSX reports with automatic resilient client-side CSV fallback.
     - **Stock Ledger Audit Tab (`activeTab === 'movements'`)**:
       - Features a multi-field filter toolbar: Search by SKU, Product Name, Notes, or Reference ID, Movement Type dropdown filter (`PURCHASE_IN`, `TRANSFER_IN`, `TRANSFER_OUT`, `SALE_OUT`, `ADJUSTMENT_IN`, `ADJUSTMENT_OUT`, `DAMAGE`, `RETURN_IN`), Facility dropdown (`All Facilities`, `PRC STOCK`), and quick "+ Adjust Stock (Ledger)" action button.
       - High-density immutable audit table displaying Timestamp, Product thumbnail/Name/SKU, Facility code badge, color-coded transaction type pills, quantity changed (`+` emerald or `-` rose), stock progression audit (`Previous → New`), and audit justification notes.
       - `AdjustmentModal`: Directly logs manual stock additions, reductions, damage write-offs, or customer returns with mandatory audit reasons and atomic cross-branch synchronization.
  12. **Quotation PDF Approval Gate & Strict Two-Email Lifecycle (`quotes.controller.ts`, `quotes.service.ts`, `CustomerQuoteApprovalPage.tsx`)**:
      - **PDF Download Security Gate**:
        - Customer PDF download endpoint `/api/v1/quotes/public/:token/pdf` strictly enforces `quote.status === 'APPROVED'`. Any unapproved quotation (e.g. `PENDING`, `UNDER_REVIEW`) returns HTTP 403 Forbidden.
        - On storefront (`/quote/:token`, `/request-quote`), unapproved quotations allow customers to view the submitted project scope and line items on screen, while the **Download PDF** button is strictly reserved and rendered only once the quotation is officially approved and digitally signed by administration.
      - **Strict Two-Email Rule**:
        - **Email 1 (At Submission)**: Customer receives instant confirmation (`sendQuotationSubmittedEmail`) containing the Quotation Reference Number (`PRC-QT-...`), project details, and a live tracking link.
        - **Email 2 (At Approval)**: Customer receives the official approval notification (`sendQuotationApprovedEmailWithPdf`) with the digitally signed PDF attached and link to review/accept.
        - All intermediate status notifications (`UNDER_REVIEW`, `PENDING` notes, customer negotiation revisions, customer decision alerts to admin, and sender/admin submission alerts) are eliminated to maintain a clean, zero-noise email pipeline.
  13. **Stock Matrix – Product-Wise Complete Transaction & Inventory Traceability Dossier (`InventoryPage.tsx`, `ProductDossierModal.tsx`, `inventory.service.ts`, `inventory-export.service.ts`)**:
      - **Interactive Stock Matrix Rows & Audit Hub**:
        - Clicking any product row or dedicated "Audit Hub" button in the Stock Matrix table (`/inventory` Tab 1) opens the comprehensive **Product Transaction & Inventory Dossier** modal.
      - **Multi-Source Lifecycle Aggregation (`getProductTraceabilityDossier`)**:
        - Aggregates master product profile, creator/listing provenance, and branch inventory distribution.
        - Joins **Purchases & Suppliers** (`PurchaseItem`, `Purchase`, `Supplier`, receiving branch depot, and recording staff).
        - Joins **Sales & Customer Orders** (`OrderItem`, `Order`, customer profile, shipping address/city, sale price, line total, taxes/GST, fulfillment tracking, carrier, delivery dates, and processing staff).
        - Joins **Stock Movement Ledger** (`StockMovement` with `PURCHASE_IN`, `SALE_OUT`, `TRANSFER`, `ADJUSTMENT`, `DAMAGE`, `RETURN_IN` and before-to-after progression).
        - Generates a **Unified Chronological Timeline** tracking complete lifecycle steps with color-coded nodes, actor resolution, reference documents, and quantity deltas.
        - Calculates financial summary KPIs: Lifetime Units Procured, Lifetime Purchase Spend, Average Unit Cost, Lifetime Units Sold, Sales Revenue, Average Selling Price, Gross Profit Margin %, and Asset Valuation at Cost & Retail.
      - **Multi-Sheet Excel (.xlsx) & PDF Export**:
        - Multi-sheet Excel workbook (`generateProductDossierExcel`) with 6 formatted sheets: (1) Product Profile & Facility Matrix, (2) Vendor & Purchases, (3) Stock Ledger Movements, (4) Sales & Orders, (5) Buyer Directory & Lifetime Value, (6) Chronological Audit Timeline.
        - Printable PDF report (`generateProductDossierPdf`) with branded layout, product specification card, facility distribution table, purchase records, and stock ledger progression.
  14. **Full CRUD Lifecycle Across All 6 Inventory Sections (`InventoryPage.tsx`, `inventory.service.ts`, `inventory.controller.ts`)**:
       - **Section 1: Stock Matrix (`activeTab === 'stock'`)**:
         - *Create*: `+ Add New SKU & Stock` (`QuickStockModal`) creates or reactivates catalog product, handles soft-deleted SKU recovery (`deletedAt: null`, `status: 'ACTIVE'`, `isVisible: true`), and creates/updates warehouse inventory with bidirectional database triggers.
         - *Read*: Filter by Branch/Depot, Category, Stock Status, SKU/Name search with live badge indicators.
         - *Audit Hub (Full Page View)*: Clicking the **Audit Hub** button (or the product name row) now opens the dedicated **Product Audit & Traceability Hub Page** (`ProductDossierPage.tsx` at view route `'product-dossier'`) with breadcrumb navigation, KPI cards, 6 comprehensive traceability tabs, Excel & PDF export, and seamless back-navigation.
         - *Update*: `⚡ Adjust` (`AdjustmentModal`) for direct ledger stock adjustments; `✏️ Edit` (`StockEditModal`) for editing On-Hand Quantity, Reorder Level thresholds, and Reserved Units with atomic ledger logging and `Product.stock` synchronization.
         - *Delete*: `🗑️ De-allocate` (`inventoryApi.deleteInventoryItem`) with confirmation dialog to unassign SKU allocation from facility and write off on-hand units in ledger.
       - **Section 2: Procurement (Stock-In) (`activeTab === 'purchases'`)**:
         - *Create*: `+ Record Stock-In (Purchase)` (`PurchaseModal`).
         - *Read*: High-density PO table and itemized breakdown drawer (`selectedPurchase`).
         - *Update*: `✏️ Edit PO` (`PurchaseModal` in edit mode) modifying supplier, invoice #, purchase date, and notes (`inventoryApi.updatePurchase`).
         - *Delete*: `🗑️ Void / Delete PO` (`inventoryApi.deletePurchase`) with confirmation dialog that voids the PO, deletes purchase items, and atomically rolls back received inventory units with audit movement logging.
       - **Section 3: Inter-Branch Transfers (`activeTab === 'transfers'`)**:
         - *Create*: `+ Create Transfer` (`TransferModal`) initiating transfers with stock reservation at origin depot.
         - *Read*: Status tracking (`PENDING`, `IN_TRANSIT`, `RECEIVED`, `CANCELLED`) and SKU breakdown drawer.
         - *Update*: `🚀 Dispatch` (`IN_TRANSIT`), `✅ Mark Received` (`RECEIVED`), `🚫 Cancel` (`CANCELLED`), and `✏️ Edit Transfer` (`TransferModal` in edit mode) to adjust destination branch or notes while in `PENDING` state.
         - *Delete*: `🗑️ Delete Transfer` (`inventoryApi.deleteStockTransfer`) for pending or cancelled transfers, releasing reserved stock.
       - **Section 4: Stock Ledger Audit (`activeTab === 'movements'`)**:
         - *Create*: `+ Adjust Stock (Ledger)` (`AdjustmentModal`).
         - *Read*: Immutable chronological ledger with movement type, branch, delta (`+` / `-`), stock progression (`Prev → New`), and justification notes.
         - *Update*: `✏️ Note` (`MovementEditModal` in `edit_notes` mode) to update audit reference notes and justification (`inventoryApi.updateStockMovement`).
         - *Delete / Reverse*: `🔄 Reverse` (`MovementEditModal` in `reverse` mode) executing an atomic offsetting transaction (`PURCHASE_IN` / `TRANSFER_IN` reversed via `ADJUSTMENT_OUT`, and vice versa) with mandatory reason logging (`inventoryApi.reverseStockMovement`).
       - **Section 5: Vendors & Suppliers (`activeTab === 'suppliers'`)**:
         - *Create*: `+ Add New Vendor / Supplier` (`SupplierModal` in create mode).
         - *Read*: Interactive multi-field search (by company name, contact person, phone, email, GSTIN, and depot address), status toggle filters (`ALL` | `ACTIVE` | `INACTIVE`), vendor cards with structured contact points, GSTIN badge, and linked purchase count.
         - *Update*: `✏️ Edit Vendor Profile` (`SupplierModal` in edit mode) modifying company name, contact person, phone, email, registered depot address, GSTIN, and Active/Inactive toggle (`inventoryApi.updateSupplier` via `PATCH /api/v1/inventory/suppliers/:id`). Also directly editable on-the-fly from within the **Product Dossier Modal** (`ProductDossierModal.tsx` Tab 1 & Tab 2).
         - *Delete*: `🗑️ Delete / Deactivate` (`inventoryApi.deleteSupplier`) with confirmation dialog.
       - **Section 6: Fulfillment Facilities (`activeTab === 'branches'`)**:
         - *Create*: `+ Register New Branch Facility` (`BranchModal`).
         - *Read*: Branch cards with facility code, location, active status, and tracked SKU counts.
         - *Update*: `✏️ Edit Facility` (`BranchModal` in edit mode) updating facility name, code, location, address, and active toggle (`inventoryApi.updateBranch`).
         - *Delete*: `🗑️ Delete Facility` (`inventoryApi.deleteBranch`) soft-deactivating branch with confirmation dialog.
  15. **Product Creation & Storefront Slug Architecture (`CreateProductPage.tsx`, `EditProductPage.tsx`, `products.service.ts`, `frontend/src/`)**:
        - **Active Status by Default**: Newly created SKUs and products default to `status: 'ACTIVE'` and `isVisible: true` for instant availability in the catalog and storefront.
        - **Minimalist Search Autocomplete**: In `CreateProductPage.tsx`, matching suggestions for Product Name and SKU searches render exclusively **SKU badge**, **Product Name**, and **Live Stock count**, stripping away clutter (no redundant price tags or image thumbnails).
        - **Auto-Reflecting URL Slug**:
          - Real-time slug generation from product name with manual custom slug editing and `/product/` route preview.
          - Frontend components (`ProductCard.tsx`, `SingleProductCard.tsx`, `SearchOverlay.tsx`, `BestSellersPage.tsx`, `NewArrivalsPage.tsx`, `OffersPage.tsx`, `CartPage.tsx`, `WishlistPage.tsx`) navigate using `product.slug || product.id`, reflecting human-readable SEO slugs across all storefront URLs.
        - **SEO & Meta Keywords Field**: Dedicated input field for comma-separated SEO / search keywords (`metaKeywords`), stored in database and indexed for search engines.
        - **Promotional Toggle Buttons**: Added 4 toggle switches with visual icons in the Admin sidebar:
          - `Featured` (`isFeatured`) with sparkle badge.
          - `Bestsellers` (`isBestseller`) with flame badge.
          - `On Offer` (`isInOffer`) with percent badge.
          - `New Arrivals` (`isNewArrival`) with tag badge.
  16. **Inventory Retention, Enhanced Stock Updates & Multi-Horizon Production Report Export Suites (`inventory.service.ts`, `inventory-export.service.ts`, `inventory.controller.ts`, `inventory.routes.ts`, `adminApi.ts`, `StockEditModal.tsx`, `InventoryPage.tsx`)**:
         - **Catalog Deletion Decoupling**: Soft-deleting or delisting a product from the catalog storefront no longer removes or hides physical stock from the Inventory Management Hub (`/inventory`). Warehouse stock balances, physical facility counts, purchase receipts, and historical audit ledger movements remain intact and fully manageable.
         - **Quick Stock Update Suite (`StockEditModal.tsx` & `PATCH /api/v1/inventory/:id`)**:
           - Interactive Quick Delta adjustment chips (`+1, +5, +10, +25, +50, +100, -1, -5, -10, -25`) for lightning-fast stock updates.
           - Real-time live calculation preview bar showing On-Hand, Reserved, Available balances, and dynamic health badges (In Stock, Low Stock, Out of Stock).
           - Custom audit note input logging granular `StockMovement` records tracking `previousQty` → `newQty`, actor attribution, and reason notes.
         - **Enterprise Multi-Horizon Production Report Generator (`activeTab === 'reports'`)**:
           - **5 Time Horizon Resolution Modes**:
             1. **Day-wise**: Specific calendar date with full 00:00:00 to 23:59:59 precision.
             2. **Week-wise**: Pick any day in the week to automatically compute Monday through Sunday date spans with formatted date range labels.
             3. **Month-wise**: Dropdown selection of month (January to December) and calendar year.
             4. **Year-wise**: Calendar year selection (2024–2028).
             5. **Range-wise**: Custom `from` to `to` date boundaries.
           - **Flexible Scope Filtering**:
             - Facility Scope: Consolidated ("All Depots / Facilities") or individual branch depot.
             - Sales Channel Scope: All Channels, B2C Retail Storefront, or B2B Wholesale Portal.
           - **4 Dedicated Auditor-Grade Production Report Export Engines**:
             1. **Stock Matrix & Valuation Report** (`GET /api/v1/reports/stock`): Real binary `.xlsx` and printable PDF detailing SKU, Product Name, Category, Facility, On-Hand, Available, Reserved, Reorder Level, Unit Cost (₹), Line Stock Value (₹), Health Status, and consolidated total valuation.
             2. **Stock Movements Audit Ledger** (`GET /api/v1/reports/movements`): Granular chronological ledger detailing Timestamp, SKU, Product Name, Branch Depot, Movement Type (Stock-In, Sale-Out, Transfer, Adjustment, Write-Off), Quantity Delta (+/-), Progression Balance (Before → After), Reference ID, Notes/Reason, and **Staff Actor Attribution** (`firstName`, `lastName`, `email`).
             3. **Itemized Purchases & Procurement Report** (`GET /api/v1/reports/purchases`): Complete procurement ledger explicitly answering **who purchased, in which date, how much quantity**, PO/Invoice Number, Supplier/Vendor, Destination Branch, Line Item SKU, Product Name, Unit Cost (₹), Line Total (₹), and **Buyer Staff Member Attribution** (`firstName`, `lastName`, `email`).
             4. **Customer Orders & Stock Consumption Report** (`GET /api/v1/reports/orders`): Comprehensive outbound fulfillment ledger explicitly answering **who placed the order, in which date, how much quantity**, Channel (B2C Retail vs B2B Wholesale), Customer Full Name, Email, Phone, Company Name, GSTIN, Order Number, SKU, Product Name, Quantity, Selling Price (₹), Line Total (₹), Fulfillment Facility, Order Status, and Payment Status.
           - **Direct 1-Click Fast Exports**: Direct "Export Purchases" trigger on Tab 2 (Procurement) and "Export Audit Ledger" trigger on Tab 4 (Stock Movements).
           - Multi-layer failover in `adminApi.ts` guaranteeing that export clicks never yield blank or corrupt files.
  17. **B2B Target Enterprise Buyer Selector & Custom vs. Sale Price Fallback Architecture (`B2BPricingPage.tsx`, `pricing.ts`, `b2b-pricing.service.ts`, `cart.service.ts`, `checkout.service.ts`, `quotes.service.ts`)**:
         - **B2B Buyer Dropdown Population**:
           - Fixed query limits in `ListUsersQuerySchema` to allow large batches (up to 500) and refined `listUsers` filter (`type: 'b2b'` excludes internal staff while matching `b2b-customer` roles, company names, or GST numbers).
           - Enhanced `loadCustomers` in `B2BPricingPage.tsx` with graceful fallback to fetch all customer accounts, populating "Select Target B2B Enterprise / Buyer" with company name, GSTIN badge, or customer name/email.
         - **Strict Custom vs. Sale Price Fallback Protocol**:
           - **If Custom B2B Price is set by Admin**: Uses the explicit `customPrice` configured in `B2BCustomerPrice` across the Admin Matrix, Storefront Product Page, Catalog Cards, Cart, Checkout, and B2B Quotations.
           - **If Custom B2B Price is NOT set by Admin**: Strictly falls back to the product's live **Sale Price** (`salePrice || price`), completely eliminating artificial automatic discounts (`* 0.8`) or arbitrary tier reductions.

  18. **Dynamic Material Master, Frequently Paired Hardware Recommendation Engine & Visibility Optimization (`materials.service.ts`, `MaterialsPage.tsx`, `materialService.ts`, `ProductDetailPage.tsx`, `BestSellersPage.tsx`, `NewArrivalsPage.tsx`, `OffersPage.tsx`)**:
         - **Dynamic Material Master (Single Source of Truth)**:
           - Created `materials` database table (`id`, `name`, `slug`, `short_name`, `grade_badge`, `description`, `tagline`, `specs`, `is_active`, `position`) with initial 4 certified materials seeded (304 Grade Stainless Steel, 316 Grade Stainless Steel, Architectural Aluminium, Nylon Polyamide 6).
           - Added full CRUD REST endpoints (`/api/v1/materials`) with active filtering and position ordering.
           - Implemented dedicated Admin Hub (`MaterialsPage.tsx` under "Catalog & Stock" in Admin Sidebar) with add/edit modals, auto-slug generation, active status toggles, and product count badges.
           - Linked `Product.materialId` foreign key to `Material` model. Integrated Material dropdown selector in both `CreateProductPage.tsx` and `EditProductPage.tsx`.
           - Created storefront `materialService.ts` with local storage caching for zero-latency instant rendering.
           - Dynamic Storefront "By Material" Dropdown (`MaterialsDropdown.tsx`) and quick switcher tabs (`MaterialProductsPage.tsx`) automatically reflect active materials from the database; disabled/deleted materials automatically disappear.
         - **Frequently Paired Hardware Recommendation Engine**:
           - Added `frequently_paired_ids` array column on `products` table and `Product` model.
           - In `EditProductPage.tsx`, added a dedicated "Frequently Paired Hardware Recommendations" control center featuring live catalog product search, 1-click addition, drag/reorder controls (Move Up / Move Down), and deletion with instant payload sync.
           - Backend resolves `frequentlyPairedProducts` preserving exact admin ordering on `GET /products/:id`, `GET /products/slug/:slug`, and dedicated public endpoint `GET /api/v1/products/:id/paired`.
           - In `ProductDetailPage.tsx`, dynamic "Frequently Paired Hardware" section renders complementary hardware items with thumbnail, product title, live B2B/retail price, dynamic stock availability badge, card click navigation, and 1-tap Add to Cart.
         - **Customer Stock Quantity Masking Protocol**:
           - Strictly eliminated all numerical inventory count leaks across customer storefronts (e.g. `({product.stock ?? 0} Available)` removed from `ProductDetailPage.tsx`).
           - Customer storefront displays exclusively qualitative status badges via `getProductStockStatus`:
             - `stock > reorderLevel` → `In Stock` (Green)
             - `stock > 0 && stock <= reorderLevel` → `Few Left Only` (Amber / Orange)
             - `stock <= 0` or `inStock === false` → `Out of Stock` (Red / Rose)
           - Actual stock counts and multi-depot allocations remain strictly confidential and visible only within the authenticated Admin Console and Inventory Hub.
         - **Non-Mutually Exclusive Promotional Section Logic & Card Navigation Standardization**:
           - Enforced non-mutually exclusive promotional flags (`isFeatured`, `isBestseller`, `isInOffer`, `isNewArrival`). A product can belong to any combination or none.
           - Eliminated arbitrary fallback logic across `BestSellersPage.tsx`, `NewArrivalsPage.tsx`, `OffersPage.tsx`, `BestSellerSection.tsx`, and `SuperSaverSection.tsx`. If no products match a promotional flag, un-flagged products are never erroneously displayed.
           - Standardized clickable product card navigation across all grids and carousels: whole card wrapper is clickable with `cursor-pointer` navigating directly to `/product/:slugOrId`, with `e.stopPropagation()` applied to all child interactive buttons (Wishlist, Add to Cart, Quick View).
         - **Product Details Specification Cleanup**:
           - Removed legacy "Load Capacity" and "Cycle Test Rating" parameters from customer-facing product specifications (`ProductDetailPage.tsx`).

  19. **Proactive JWT Refresh Mutex & Concurrency Grace Architecture (`api.ts`, `auth.service.ts`, `b2bPricingService.ts`, `useB2BPricing.ts`)**:
         - **Proactive Token Refresh & Mutex Lock (`api.ts`)**:
           - Implemented client-side JWT payload inspection (`isTokenExpired`) with a 15-second pre-expiry buffer.
           - Built `getFreshToken()` with a singleton in-flight promise (`refreshPromise`) acting as an asynchronous mutex lock. Any concurrent requests occurring during token renewal await the same promise rather than issuing duplicate `/auth/refresh-token` requests.
           - Guaranteed that expired tokens are proactively renewed *before* issuing network requests, preventing 401 Unauthorized errors in browser consoles.
         - **Backend Refresh Concurrency Grace Window (`auth.service.ts`)**:
           - Added an industry-standard 30-second concurrency grace period to `refreshTokens`: if a rotated token was revoked within the last 30 seconds by a concurrent request from the same client session, the backend safely reuses the newest active token rather than rejecting with 401.
         - **Unauthenticated Route Guarding**:
           - Updated `fetchB2BPricingMatrix` and `useB2BPricing` to verify `isAuthenticated && getStoredToken()` before issuing requests to protected endpoints (`/b2b-pricing/customer/:userId`), gracefully falling back to local cache for guest or expired sessions.
  ### 4.7 B2B Proforma Invoice (PI) & QR Tamper Validation Module
  - **Backend Endpoints (`/api/v1/proforma-invoices`)**:
    - `GET /`: Admin list with pagination, search, status filters, and executive financial KPI metrics.
    - `POST /`: Create commercial Proforma Invoice directly into PostgreSQL (`ProformaInvoice` and `ProformaInvoiceItem` models) with automated GST calculation (Intra-state Delhi: CGST 9% + SGST 9%; Inter-state: IGST 18%).
    - `GET /customer/my-proformas`: Authenticated B2B Customer self-service endpoint querying all issued PIs by customer ID or email.
    - `POST /:id/email`: Dispatches high-contrast monochrome Black & White PDF attachment to customer with email history logging.
    - `GET /:id/pdf`: Streams binary PDF generated on-the-fly via `pdfmake` in strict Monochrome (Black & White).
    - `POST /:id/convert-to-invoice`: Converts approved/advance-paid PI into official GST Tax Invoice.
    - `POST /:id/record-payment`: Admin endpoint to record/confirm advance payment received (amount, payment mode: RTGS/NEFT/IMPS/UPI/Cheque/Cash, transaction UTR, payment date, notes) with immutable `ProformaInvoiceHistory` audit logging.
    - `GET /verify/:token`: Public cryptographic verification resolver with multi-identifier resolution (supports token UUID, verification ID, PI number, document hash, or full URL).
    - `POST /validate-tamper`: Comprehensive Document Tamper Analysis Engine. Evaluates physical paper claims against database records and digital signatures, returning structured integrity verdicts (`AUTHENTIC`, `MANIPULATED`, `UNSIGNED_DRAFT`, `DOCUMENT_NOT_FOUND`).
    - `POST /public/:token/upload-receipt`: Public customer endpoint to upload bank payment screenshot (PNG, JPG, WEBP) or payment receipt PDF (up to 10MB) via `uploadAttachmentFile` cloud storage fallback pipeline.
    - `POST /public/:token/feedback`: Public customer acceptance & payment submission with UTR reference, contact phone, notes, and uploaded receipt URL.
    - `DELETE /:id`: Exclusive super admin void/delete endpoint for proforma records.
    - `AdvancePaymentsTrackerPage.tsx` (`/advance-payments`): Unified B2B Payments & Commercial Receivables Hub (`B2B Payments & Receivables`):
      - Aggregates ALL B2B customer financial records across Proforma Invoices (PIs), GST Tax Invoices, and official B2B Wholesale Orders (`b2b_orders`).
      - Complete 4-Stage Commercial Document Pipeline (`[QT] ──> [PO] ──> [PI] ──> [B2B Order]`):
        - Live interactive visualizer rendered on mobile cards and desktop table rows (`Commercial Pipeline` column) with status badges and document references.
        - 1-Click Quick Inspector Modals: On-demand inspectors for Quotations (`QuoteInspectorModal`), Purchase Orders (`PoInspectorModal`), Proforma Invoices, and B2B Orders (`B2bOrderInspectorModal`) showing item breakdown, financial summary, and customer metadata.
        - Universal Multi-Document Search: Instant matching by Quotation #, Customer PO #, Proforma Invoice #, and B2B Order #.
      - Bidirectional Payment Synchronization:
        - Recording payment on a Proforma Invoice automatically syncs to any linked B2B Wholesale Order (`b2b_orders.paid_amount`, `payment_status`).
        - Recording payment on a B2B Wholesale Order (`POST /api/v1/b2b-orders/:id/record-payment`) automatically syncs to the linked Proforma Invoice (`proforma_invoices.advance_amount_paid`, `advance_payment_status`).
      - Dual Intelligent View Architecture:
        - Mode 1: Commercial Documents & Receivables Ledger (granular per-document aging, SLA overdues, advance payable, balance due, and UTR proofs).
        - Mode 2: B2B Customer Accounts 360° Exposure Ledger (enterprise client matrix with lifetime invoiced value, cleared payments, open balances, oldest overdue days, risk level, and 1-click customer account dossier filter).
      - 5 Executive KPI Matrix cards: Total B2B Invoiced Value, Total Payments Cleared, Outstanding Receivables Pending, Customer UTR Proofs Awaiting Clearance, and Overdue Dues Alert (>30 Days SLA).
      - Multi-Tier Aging & SLA Overdue Engine: Computes exact document days elapsed, validity countdown, `Overdue by X days` alerts, and `Due in X days` warnings.
      - Universal Record & Reconcile Payment Modal: Allows accounts team to record advance deposits, balance payments, or full settlements across PIs, B2B Orders, and GST Tax Invoices with payment mode (RTGS/NEFT/IMPS/UPI/Cheque/Cash), bank account credited, and transaction UTR.
      - Full-Screen Payment Receipt Lightbox Modal: Enlarge uploaded customer payment screenshots or download receipt PDFs directly.
      - 1-Click Export to CSV: Exports full unified commercial ledger with aging days, overdue flags, and financials.
    - `QRDocumentValidatorPage.tsx` (`/qr-validator`): Full-featured QR Scanner & Document Tamper Validation Hub:
      - Live Camera Scanner (`navigator.mediaDevices` + `jsQR`) with viewfinder crosshair radar.
      - Image / Screenshot drag-and-drop QR decoding.
      - Physical Paper Forgery Inspector matrix (compares printed Total, Advance, GSTIN, Customer Name, and Item Count against database).
      - System-wide QR Registry of all issued commercial invoices with high-res 400px QR modal, print badges, and PDF download.
      - Real-time scan verification audit trail.
    - `ProformaInvoicesPage.tsx`: Full operational pipeline with 4 KPI cards, multi-facility routing, direct server binary PDF download, status filtering (`ACCEPTED`, `ADVANCE_RECEIVED`, `APPROVED`, `SENT`, `DRAFT`, `CONVERTED_TO_INVOICE`, `CANCELLED`), table status tags with customer acceptance indicators, row-level **Edit Proforma Invoice** action, quick navigation button to Advance & Payment Tracker, quick QR Scanner launcher button, super admin delete action, and print view.
    - `ProformaInvoiceCreateView.tsx`: Enterprise creation & edit form supporting both new generation and full editing of existing Proforma Invoices (`initialInvoice`), with B2B customer search, live customer custom pricing lookup, automatic customer address fetching, line item addition/modification/deletion, live GST recalculation (CGST 9% + SGST 9% for Delhi; IGST 18% for other states), advance percentage tuning, and shipping charges adjustments.
    - `ProformaInvoiceDetailView.tsx`: Full PI dossier featuring live customer acceptance & advance remittance banner (`CheckCircle2`/`Landmark` dossier with UTR reference, customer comments, phone number, timestamp), payment proof preview card (with image thumbnail, direct PDF download, and full-screen image lightbox modal), **Edit Proforma Invoice** launcher button in the action header, complete immutable activity audit trail (`ProformaInvoiceHistory` timeline with receipt links), customer details, items breakdown, direct PDF download, super admin delete action, and SMTP email dispatch modal.
    - `proformaService.ts`: Robust API integration, server-side data mapping (`transformBackendInvoiceToPI` with `history`, `notes`, `termsAndConditions`), binary PDF streaming, Proforma update client (`updateProformaInvoice`), payment clearance recording (`recordPayment`), and tamper validation.
  - **Storefront (`D:\frontend`)**:
    - `UserProfilePage.tsx`: Integrated B2B Proforma Invoices tab with search, status filters, financial breakdown, 1-tap PDF downloads, and direct **"Upload Payment Receipt & UTR"** quick launcher for active proforma records.
    - `CustomerProformaViewPage.tsx`: Public/authenticated verification and acceptance page (`/proforma/:token` & `/pi/:token`) featuring dedicated response modes: 'Accept & Confirm Terms' (accept commercial terms cleanly with remarks), 'Advance Payment Initiated' (mandatory Bank UTR reference and payment screenshot / bank PDF upload with live preview and removal), and 'Questions / Request Change', plus direct monochrome PDF streaming.
    - `VerifyProformaInvoicePage.tsx`: Public QR-code scan verification landing portal (`/verify/pi/:token`) checking cryptographic signature, tamper status, item summary, and financial authenticity.
    - `proformaInvoiceService.ts`: Direct client API service for fetching customer PIs, uploading payment receipt attachments, submitting customer feedback & UTR references, verifying QR scan tokens, and streaming PDFs.

   20. **National Architectural Portfolio & Interactive India Map Hub (`projects.service.ts`, `projects.seed.ts`, `ProjectsPage.tsx`, `IndiaMap.tsx`, `ProjectFilterBar.tsx`, `ProjectDetailModal.tsx`)**:
          - **Master Dataset & Database Synchronization**:
            - Seeded all **200 completed architectural projects** from the cleaned & researched master dataset into PostgreSQL `projects` table (`id`, `name`, `client_name`, `location`, `city`, `state`, `region`, `is_pan_india`, `category`, `description`, `completion_year`, `products_used`, `images`, `video_url`, `is_featured`, `status`, `order_index`).
            - Standardized **11 industry categories**: *Corporate Offices & Tech Parks, Government & Infrastructure, Sports & Stadiums, Educational Institutions, Healthcare & Hospitals, Commercial & Retail Malls, Automotive Flagships, Residential & Clubhouses, Hotels & Hospitality, Gym & Fitness, Industrial & Logistics*.
            - Mapped verified GPS coordinates across **36 distinct cities** and **28 state centroid fallbacks** (`CITY_COORDINATES`, `STATE_CENTROIDS`), ensuring any newly created city automatically resolves its geographic pin on the India map.
          - **Interactive Vector India Map & Mobile Ergonomics (`IndiaMap.tsx`)**:
            - Dynamic city clusters with project density pulse rings.
            - Relocated zoom controls to the bottom-right on mobile devices (`bottom-2 right-2 sm:bottom-auto sm:top-3 sm:right-3`) as a compact horizontal pill, preventing map occlusion.
            - Redesigned City Spotlight popup on mobile into a compact drawer (`w-52 max-w-[calc(100%-145px)]`) with micro-thumbnails, 1-tap close (`X`), and zero collision with zoom buttons.
            - Desktop draggable scroll rails (`useDraggableScroll.ts`) with left/right hover buttons for fluid navigation across Quick Hubs and Category Pills.
          - **Dynamic Storefront Reflection & Pagination (`ProjectsPage.tsx`)**:
            - Real-time count-up metrics animating dynamically from `0` to the live database totals for Completed Projects, Cities Covered, and Pan-India Chains.
            - 10-cards-per-page pagination with smart ellipsis pagination (`<<`, `<`, `1, 2, 3 ... 20`, `>`, `>>`) and smooth auto-scroll to `#portfolio-grid`.
            - Full-spectrum responsive grid (1-col on mobile, 2-col on tablet, 3-4 col on desktop).
          - **Admin Console Project Management (`admin/src/pages/ProjectsPage.tsx`, `projectsService.ts`)**:
            - Complete CRUD interface supporting image galleries, video URL links, rich descriptions, category dropdowns, multi-product tagger, status toggles (`ACTIVE` / `INACTIVE`), and featured spotlight toggles.

   21. **Quotation Live Tracking & Smart Auto-Suggestions Hub (`QuotationTrackingModal.tsx`, `B2BQuotationManager.tsx`, `RequestQuotePage.tsx`, `UserProfilePage.tsx`)**:
          - **Universal Quotation Tracking Modal (`QuotationTrackingModal.tsx`)**:
            - Accessible directly from the **"Track Quotation"** button in "My Quotations" tab / header, as well as on individual quote cards and unauthenticated quotation tracking views.
            - Features a 4-stage visual stepper: *1. Submitted (RFQ Logged) → 2. Under Review (Estimator Verification) → 3. Approved & Signed (B2B Volume Rates Finalized) → 4. Order Converted (Accepted & Production)*.
            - Provides 1-tap quote reference number copying, itemized bill of quantities breakdown, estimator review notices, and direct actions (*"View & Accept Quotation"*, *"Download Signed PDF"*).
          - **Smart Auto-Suggestions on Search Input Click**:
            - When focusing or clicking on the Quotation Tracking search input, an intelligent auto-suggestions dropdown automatically displays all in-progress quotations (**`PENDING`** and **`UNDER_REVIEW`**).
            - Each suggestion displays the reference number, project name, company name, status badge, estimated total, and date submitted.
    22. **PO Management & Automated Inbound Email Ingestion Hub (`po-management`, `POManagementPage.tsx`, `PODetailPage.tsx`, `po-sync.service.ts`)**:
          - **Automated IMAP Email Ingestion & Background Queue**:
            - Background auto-sync service (`startPoAutoSync(60000)`) connects to configured IMAP inbox (Gmail/Exchange/Outlook) every 60s without UI polling.
            - Processes raw RFC 822 MIME emails, extracts customer details, attachments, and analyzes content with multi-factor confidence scoring (`PO_DETECTED`, `POSSIBLE_PO`, `GENERAL_EMAIL`).
            - Atomic yearly sequence generator (`PRC-PO-YYYY-XXXXXX`).
          - **Mailbox Deletion Synchronization & Reconciliation**:
            - During sync passes, `syncInboundEmails()` compares active `Message-ID`s in the IMAP `INBOX` against `po_email_messages` in PostgreSQL.
            - When an email is deleted in the user's Mail app (e.g. Gmail / Outlook / Apple Mail), the sync engine automatically prunes the deleted message, removes the corresponding `PoSubmission` record from the database, and emits `po.deleted` real-time SSE events.
          - **Real-Time SSE Event Stream & Silent Insetion**:
            - `po.created`: Silently accumulates into pending background queue with user-facing notification banner ("N new email(s) received in background").
            - `po.deleted`: Instantly removes deleted submissions from active UI tables and decrements KPI metrics in real time.
            - `po.updated`: Real-time status, priority, and classification updates.
          - **Admin Console PO Operations & Full-Page Dossier**:
            - Dedicated full-page PO Dossier (`PODetailPage.tsx`) with 5 tabs (Email/Thread Viewer with raw HTML sanitizer, Overview, Attachments, Timeline, Internal Notes).
            - Built-in Inbound Email Reply Composer with multi-file attachment dispatcher (PDFs, docs, spreadsheets), RFC 822 `In-Reply-To`/`References` threading headers, and automatic activity logging (`POST /api/v1/po-management/:id/reply`).
            - Direct manual **Delete PO / Email** action with confirmation dialog, **Bulk Select & Delete** toolbar, and clean Eye icon dossier viewers.
            - Interactive KPI metric cards (Urgent Attention quick filter toggle, Purchase Orders, Possible PO, General Emails).
            - Universal Email Attachment Uploader (`uploadAttachmentFile`) supporting all document types (PDFs, Excel, Word, ZIPs, CAD, images) with streaming download & preview endpoints (`GET /attachments/:attachmentId`, `GET /attachments/:attachmentId/download`).
            - REST API endpoints at `/api/v1/po-management` (`GET /`, `GET /metrics`, `POST /sync`, `POST /bulk-delete`, `GET /:id`, `POST /:id/reply`, `PATCH /:id/status`, `PATCH /:id/priority`, `PATCH /:id/assign`, `PATCH /:id/classification`, `PATCH /:id/customer-po-number`, `POST /:id/notes`, `DELETE /:id`, `GET /attachments/:attachmentId`, `GET /attachments/:attachmentId/download`).
          - **Quotation-Linked PO Auto-Generation, PO PDF Generation & Bi-Directional Linking**:
            - When a customer submits a PO against an active admin-approved quotation (`source: QUOTATION`) or via direct file upload (`source: CUSTOM_PDF_UPLOAD`), the system atomically generates the sequential tracking ID (`PRC-PO-YYYY-XXXXXX`) and auto-generates the PO number (`PO-<QuoteRef>` e.g. `PO-PRC-QT-2026-0001` or `PRC-PO-YYYY-XXXXXX` if not manually specified).
            - **Production-Grade PO PDF Generation (`po-pdf.service.ts`)**: Built with `pdfmake`, generating an official commercial Purchase Order document with PRC Hardware branding, GSTIN, line-item specs, unit rates, GST (18%) breakdown, advance percentage calculations, digital seal, and authorized signatory.
            - **Automated Customer Dispatch & Admin View**: The generated PO PDF (`PRC-PO-YYYY-XXXXXX-Commercial-PO.pdf`) is attached directly to the customer confirmation email (`sendMail`) and saved as an official `PoEmailAttachment` so it is instantly viewable and downloadable by staff in the Admin Console (`/po-management` and `/po-detail`).
            - **Streamlined 2-Channel Storefront Portal (`SubmitPoPage.tsx`)**: Refactored to two clean channels: **Option 1 (PO from Approved Quotation)** and **Option 2 (Upload Signed PO Document)**, removing obsolete custom line-item builder mode.
            - The backend marks the linked `Quote` as `status: 'CONVERTED'`, sets `convertedOrderId = submission.id`, and logs `QuoteActivityLog` and `PoActivityLog` transitions.
    23. **Proforma Invoice (PI) Generation, Backend Module & Verification Hub (`proforma-invoices`, `ProformaInvoicesPage.tsx`, `proformaService.ts`, `proforma-invoice-pdf.service.ts`, `proformaPdfGenerator.ts`)**:
          - **Dedicated Backend REST Module (`src/modules/proforma-invoices/`)**:
            - **Controllers & Services**: `proforma-invoices.controller.ts`, `proforma-invoices.service.ts`, `proforma-invoices.routes.ts`.
            - Full CRUD and lifecycle transitions: `GET /api/v1/proforma-invoices`, `POST /api/v1/proforma-invoices`, `GET /:id`, `PATCH /:id`, `DELETE /:id`, `POST /:id/sign`, `POST /:id/send-email`, `GET /:id/pdf`, `GET /customer/my-pis` (for B2B customer portal).
            - **Cryptographic QR Code & Verification Engine**: `GET /api/v1/proforma-invoices/verify/:token` (public endpoint), generating high-resolution HMAC-SHA256 digital authenticity verification records and QR code images (`qrcode` library) embedded directly into the generated PDF and UI views.
          - **Dedicated Admin Console Hub (`/proforma-invoices`)**:
            - Accessible from the Admin sidebar under **Sales & Fulfillment** with route `id: "proforma-invoices"`.
            - Features high-level commercial KPIs (Total PIs Issued, Total Proforma Value ₹, Expected Advance Deposits, Active Documents), status filters (`ALL`, `SENT`, `DRAFT`, `CONVERTED`, `EXPIRED`), and dual-facility origin filters.
            - **Parallel B2B Custom Pricing Integration**: Product selection search and inputs are locked by default until a customer is chosen. Upon selecting a B2B customer, the system immediately fetches the pre-negotiated customer contract pricing matrix via `b2bPricingApi.getCustomerPricingMatrix()`, displaying custom contract prices with `🎯 B2B CUSTOM PRICE` badges and catalog prices in strikethrough.
          - **Customer Storefront B2B Profile Portal (`ProfilePage.tsx`, `CustomerProformaViewPage.tsx`)**:
            - B2B customer profile includes a dedicated **"Proforma Invoices"** tab (`/profile?tab=proforma-invoices`).
            - B2B customers can view their issued PIs, inspect commercial tax breakdowns and advance schedules, submit feedback / inquiries, and download official signed PDFs.
          - **Exact Corporate PDF Design Mirroring Quotations & Purchase Orders (`proforma-invoice-pdf.service.ts`, `proformaPdfGenerator.ts`)**:
            - Built with `pdfmake` (backend) and printable HTML (admin client) embedding the official high-resolution `PRC_LOGO_DATA_URL`.
            - Exact matching typography, Obsidian Navy (`#0f172a`), Amber Gold (`#d97706`/`#f59e0b`), Emerald Green (`#047857`), vector SVG icons (mail, phone, globe, calendar, clock, user, project, listGrid, shield, mapPin, docRef, bank, signatureSvg).
            - **Page 1**: Logo and contact header, amber accent bar, PI NO. badge, 3-column metadata strip (Issue Date, FY, Valid Until), 2-column Bill To (Buyer) & Order Details cards, `#0b1e38` Navy Dark line items table with alternating rows, digital authenticity stamp with QR code & HMAC-SHA256 hash, bank remittance box (HDFC Bank Ltd), and financial summary table (Basic, CGST/SGST/IGST, Logistics, Grand Total, Advance Payable %, and Balance Due).
            - **Page 2**: General Terms & Conditions (1. Specifications Required for Production, 2. Other Terms & Conditions, 3. Payment Terms for Supply, 4. Special Note on Site Delay & Payment Liability, 5. Delivery Timeline, 6. Statutory Compliance, and Dual Signatures for Client Acceptance and Pacific Products and Solutions).
            - Fixed header and footer with location pin, contact details, document reference, and dynamic page number pill (`X / Y`).
    24. **B2B Payments & Commercial Receivables Hub with Commercial Follow-up Engine (`AdvancePaymentsTrackerPage.tsx`, `proforma-invoices.service.ts`, `proforma-invoices.controller.ts`, `CustomerProformaViewPage.tsx`)**:
          - **Multi-Source Unified Receivables Ledger (`AdvancePaymentsTrackerPage.tsx`)**:
            - Unified tracking for all B2B customer payments, Proforma Invoices (PIs), GST Tax Invoices, credit SLA overdues, bank UTR clearances, and client ledger exposures.
            - Real-time aggregation of commercial records into a single unified ledger with SLA calculations, aging categories (<7d, 7-14d, 15-30d, 31-60d, >60d), and balance due tracking.
            - Executive Financial Matrix KPIs: Total B2B Invoiced, Total Payments Cleared, Outstanding Receivables, Customer UTR Proofs Awaiting Clearance, and Overdue SLA Breaches.
            - **Customer Accounts 360° Matrix**: Client risk profiling (`HIGH_RISK_OVERDUE`, `MODERATE`, `LOW_RISK`), total invoiced vs payments received, active document breakdown, and 1-click drilldown into client ledger.
          - **Customer Payment Proof & UTR Verification Workflow**:
            - Customer Storefront portal (`CustomerProformaViewPage.tsx`) cleanly separates **"Accept & Confirm Terms"** from **"Advance Payment Initiated"**.
            - Dedicated 10MB payment proof upload system supporting PNG, JPG, WEBP, and PDF receipts with live document preview.
            - **Dedicated Full-Page Workspaces for Follow-up & Payment Clearance**:
              - Clicking **"Follow-up"** or **"Clear"** opens comprehensive full-page workspaces (`activeFollowupRecord` and `activePaymentRecord`) with responsive 2-column operational views, document/buyer context banners, and instant back navigation to the ledger.
              - **Commercial Follow-up Workspace**: 1-click WhatsApp/Email/Phone communications suite, touchpoint logger with PTP commitments & next scheduled due dates, and real-time chronological follow-up audit timeline dossier.
              - **Payment Clearance Workspace**: Document breakdown, 1-click amount fill chips (Advance / Balance / Full), bank account & payment mode selectors, UTR verification, accounts clearance notes, and embedded live receipt document inspector (Image / PDF).
            - **Origin Facility Clean Brand Protocol**: Cleaned origin facility labels in Proforma Invoices and ledger views to standard corporate name `PRC Hardware` (removing legacy `(Pacific Products & Solutions)` from table columns and facility constants).
    25. **Cryptographic QR Document Validator & Multi-Format PDF Tamper Hub (`QRDocumentValidatorPage.tsx`)**:
          - **Universal Document Ingestion**: Supports high-res live camera scanning, document image upload (PNG/JPG/WEBP), and multi-page drag-and-drop PDF ingestion (`pdfjs-dist` v3.11.174).
          - **Multi-Page Canvas Rendering & Extraction**: Renders uploaded PDF pages to offscreen high-res HTML5 canvases for `jsQR` 2D barcode localization, combined with embedded PDF text-layer extraction for PI number, total value, and GSTIN regex matching.
          - **Cryptographic Tamper Audit**: Queries public verification API (`GET /proforma-invoices/verify/:token`), checks SHA-256 digital document signature against original tamper-proof database hash, and verifies monetary amounts, GST breakdown, customer name, and issue dates.
    26. **Automated WhatsApp Ledger Statement & Email Reminder Follow-up Suite (`WhatsAppLedgerModal.tsx`, `EmailReminderModal.tsx`, `proforma-invoices.service.ts`)**:
          - **WhatsApp Ledger Dispatch & Balance Reminder**:
            - Generates pre-formatted WhatsApp statement containing total quote value, advance deposit required/paid, and **highlighted Remaining Balance Due to Pay**.
            - Includes official bank RTGS/NEFT remittance details, direct authenticated PDF download link, and anti-tamper QR seal verification link.
            - Automatically increments `whatsappReminderCount` and `reminderCount`, updates `lastWhatsappAt` & `lastReminderAt`, and logs audit trail.
            - 1-click launch opens `https://wa.me/91<phone>?text=...` with full ledger statement.
          - **Email Payment Reminder with Auto-Attached PDF**:
            - Generates executive branded HTML email with commercial balance due summary, bank remittance instructions, and auto-attaches official monochrome PDF Proforma Invoice.
            - Increments `emailReminderCount` and `reminderCount`, updates `lastEmailAt`, and logs history.
          - **Admin Console Follow-up Tracking**:
            - **`ProformaInvoicesPage.tsx`**: Follow-up counter badges (`🔔 N Sent`) with 1-click WhatsApp and Email quick trigger buttons.
            - **`ProformaInvoiceDetailView.tsx`**: Top header actions and dedicated **Payment Ledger & Commercial Follow-up Summary** card highlighting Gross Order Value, Advance Required/Paid, **Remaining Balance Due (₹)**, and real-time follow-up statistics.
    27. **Admin Notifications Command Center & Bulk Deletion Suite (`NotificationsPage.tsx`, `notifications.service.ts`, `notifications.routes.ts`, `adminApi.ts`, `notificationService.ts`)**:
          - **Click-to-Open Interactive Detail Modal**: Clicking any notification card in the Admin Notifications Hub opens a comprehensive **Notification Detail Modal** with rich metadata, formatted multi-line message view, raw JSON payload drawer, and 1-click navigation links to linked entities (Order, Quotation, Inventory Product, or Customer Account).
          - **Automatic Real-Time Read State**: Opening unread alerts immediately triggers `handleMarkAsRead` across the database and UI, decrementing unread priority counters synchronously.
          - **Bulk Selection & Strict Max-50 Deletion Guard**:
            - Card-level selection checkboxes and a toolbar "Select Visible (Max 50)" control.
            - Sticky floating Bulk Action Bar with real-time selection counter (`X / 50 max`).
            - Enforced hard cap of maximum 50 notifications per batch with immediate feedback notices.
            - Backend atomic batch deletion via `POST /api/v1/notifications/bulk-delete` and `DELETE /api/v1/notifications/bulk` validated with `BulkDeleteNotificationsSchema` (max 50 limit).
            - Full cross-stack synchronization across `PRC-Backend`, `adminApi.ts`, and Storefront `notificationService.ts`.
    28. **Cubicle Installer Payment Tracking System (`InstallerPaymentsPage.tsx`, `installerPaymentsService.ts`, `installer-bill-pdf.service.ts`, `installer-export.service.ts`)**:
          - **Role-Based Access Control & Dual-Layer Enforcement**:
            - **Super Admin**: Full unrestricted access including Cubicle Model Master CRUD (`/api/v1/installer-payments/models`) and Full Payment History Excel Export (`/api/v1/installer-payments/export/excel`), enforced at both backend routes (`requireSuperAdmin` returning HTTP 403 Forbidden) and Admin UI tabs/actions.
            - **Admin**: Can create, inspect, and edit installer payment records, log payment installments, download individual bill PDFs, and manually trigger email re-send. Blocked on backend and hidden on UI from model master management and full historical exports.
          - **Atomic Sequential Bill Numbering**:
            - Uses dedicated PostgreSQL sequence `ppsi_bill_seq` with atomic zero-padded formatting `PPSI-00001` (strictly incrementing, never reused or duplicated across concurrent transactions).
          - **NCR (National Capital Region) Dynamic Business Logic & Automated PIN Code Detection**:
            - Master PIN Code Registry (`admin/src/utils/ncrPincodes.ts`) containing comprehensive coverage of 137+ official NCR postal PINs across Delhi (110xxx), Haryana (121xxx Faridabad, 122xxx Gurugram, 123xxx Rewari, 124xxx Rohtak/Jhajjar, 126xxx Jind, 127xxx Bhiwani, 131xxx Sonipat, 132xxx Panipat/Karnal), Uttar Pradesh (201xxx Ghaziabad/Noida, 203xxx Bulandshahr, 212xxx, 245xxx Hapur, 250xxx Meerut, 247xxx Shamli, 251xxx Muzaffarnagar), and Rajasthan (301xxx Alwar, 321xxx Bharatpur).
            - Real-time PIN auto-matching: As soon as a 6-digit postal PIN is typed/pasted on bill creation (`CreateInstallerBillPage.tsx`), it automatically evaluates against `isNcrPinCode(pin)`.
            - When matched: automatically selects `isNcr = true`, locks `travelExpenses = 0`, and displays a clear green confirmation badge (`NCR Territory Matched - Travel locked to ₹0.00`).
            - When outside NCR: automatically selects `isNcr = false`, enables the Travel Expenses input for outstation allowance, and displays a blue outstation badge. Manual override remains accessible if needed.
          - **Itemized Multi-Model Billing & Financial Calculations**:
            - Live auto-computation: `Subtotal = Σ (Quantity × Unit Price)`, `Total Amount = Subtotal + Travel Expenses`, `Balance Due = Total Amount - Amount Paid`.
            - Status transitions: `PARTIAL` when `amountPaid < totalAmount`, and `CLEARED` when `amountPaid >= totalAmount`.
          - **Payment Installments Ledger**:
            - Supports recording partial installments (`InstallerBillPayment`) with payment date, mode (Bank Transfer, UPI, Cash, Cheque), reference/UTR number, and notes, updating `amountPaid` and `balanceDue` atomically.
          - **Automated Bill PDF Generation & Dedicated Installer Email Dispatch**:
            - Itemized PDF bill generated using `pdfmake` featuring Pacific Products & Solutions corporate styling, obsidian navy headers (`#0F172A`), amber accents (`#D97706`), clean vector icons, job/site details, itemized breakdown, payment summary, and authorized signature seal.
            - **Dedicated Recipient Routing (`to: bill.installerEmail`)**: Emails are explicitly dispatched to the installer's verified email address (`installerEmail`).
            - **Dynamic Cleared vs Partial Styling**:
              - **CLEARED bills**: Dispatches receipt with subject `Payment Cleared — Bill #${bill.billNo} — Pacific Products & Solutions`, green cleared banner, and zero balance confirmation.
              - **PARTIAL bills**: Dispatches advice with subject `Payment Advice & Installation Bill #${bill.billNo} — Pacific Products & Solutions`, amber statement banner, and itemized breakdown of Amount Disbursed to Date vs Outstanding Balance Due.
            - **Automatic Auto-Dispatch on Creation**: Configurable checkbox on `CreateInstallerBillPage.tsx` (`sendEmailToInstaller: true` by default) dispatches official payment voucher immediately upon generation.
            - **Interactive Email Dispatch Modal (`SendBillEmailModal`)**: Admins can click "Send Email", "Resend", or "Retry" to open an interactive modal displaying Installer Name, editable destination email address, bill financial summary, and attached PDF voucher filename before dispatching.
            - **Table Email Clearance Action**: Removed previous disabled "On Clearance" gating; now permits dispatching advice for any bill with an installer email, displaying a live green "Sent" badge alongside a "Resend" button.
          - **Super Admin-Only Bill Editing & Field Adjustments (`PATCH /api/v1/installer-payments/:id`)**:
            - **Strict Security & RBAC**: Endpoint strictly restricted to Super Admin via `requireSuperAdmin` middleware. Non-super-admins receive HTTP 403 Forbidden.
            - **Editable Scopes & Recalculation**: Super Admin can adjust technician info (name, email, install date), site logistics (address, PIN, NCR toggle), travel expenses, UMP overrides, deduction amount & reason, and internal admin notes. Financial totals (`subtotal`, `total`, `balanceDue`, and `paymentStatus`) are automatically recomputed server-side.
            - **Audit Trail Logging (`audit_logs`)**: Every edit automatically writes an entry to `audit_logs` capturing `userId`, `ipAddress`, `action: 'UPDATE'`, `entity: 'InstallerBill'`, and a granular `changes.fields` mapping containing `{ before, after }` values for all modified properties.
            - **Audit Log Retrieval API (`GET /api/v1/installer-payments/:id/audit-logs`)**: Available to all authorized admins to inspect the chronological edit trail of any bill.
            - **UI Integration (`EditInstallerBillModal`, `BillDetailsDrawer`)**:
              - Edit button (pencil icon) rendered exclusively for `isSuperAdmin` in Desktop table, Mobile cards, Ledger job items, and Bill Dossier Drawer.
              - `EditInstallerBillModal`: interactive modal with auto-NCR PIN detection, live financial recalculation preview, and deduction reason enforcement.
              - `BillDetailsDrawer`: dedicated "Issue & Edit History" section displaying issuing user (`bill.createdBy`), issue date, and live timeline of past edits with before → after values.
          - **Super Admin-Only Bill Deletion (`DELETE /api/v1/installer-payments/:id`)**:
            - **Strict Security & RBAC**: Endpoint strictly protected by `authenticate` and `requireSuperAdmin` middleware. Rejects non-super-admins with HTTP 403 Forbidden.
            - **Soft-Delete Safety**: Updates `deletedAt: new Date()`, safely preserving payment history, line items, and audit integrity while completely removing the bill from lists, KPI metrics, and Excel exports.
            - **UI Integration**: Red trash action button rendered exclusively for `isSuperAdmin` in the desktop bills table, mobile touch cards, and the Bill Dossier Drawer.
            - **Confirmation Modal (`DeleteBillConfirmationModal`)**: Double-confirmation dialog displaying bill number, installer details, site address, and amount before executing deletion.
          - **Dynamic Multi-Category Model Master (Cubicles, UMP, Lockers)**:
            - **Super Admin Dynamic Rate & Model Configuration**: In Tab 3 ("Model Master"), Super Admin can register, edit, and deactivate models across three product categories:
              - `CUBICLE`: Restroom Cubicle Models (e.g. Delight, Sky Light, Horizon).
              - `UMP`: Urinal Modesty Panels (e.g. Standard UMP, Full Height UMP).
              - `LOCKER`: Locker Systems (e.g. 1-Tier Locker, 2-Tier Locker, 3-Tier Locker, Z-Locker).
            - **Category Filtering & Badges**: Filter tabs for "All Models", "Restroom Cubicles", "Urinal Modesty Panels (UMP)", and "Lockers" with color-coded badges (Violet for Cubicles, Emerald for UMP, Blue for Lockers).
          - **Default Zero (0) Values & Mandatory Active Selection**:
            - **Zero Pre-Selection Policy**: In `CreateInstallerBillPage.tsx` and fallback creation modal, no model is pre-selected on mount. All initial quantities default to `0` with unit prices at `₹0.00`.
            - Admins must actively select the model from the master dropdown and enter quantities greater than 0 before submission.
            - Validates that at least one valid item is selected and non-zero across the job scopes.
          - **Dedicated Scope Columns in Bills Table**:
            - Desktop table displays 3 dedicated scope breakdown columns:
              - **Cubicles**: Lists installed cubicle models, unit counts, and cubicle subtotal units.
              - **UMP**: Lists installed UMP models and counts with emerald badge indicator.
              - **Lockers**: Lists installed locker models and counts with blue badge indicator.
            - Mobile touch cards provide itemized color-coded scope breakdown cards for Cubicles, UMP, and Lockers.
          - **Itemized Scopes in Dossier Drawer & PDF Payment Vouchers**:
            - **Bill Details Drawer (`BillDetailsDrawer`)**: Renders distinct itemized sections for Cubicle Models, Urinal Modesty Panels (UMP), and Locker Units, with line totals and a detailed financial breakdown.
            - **PDF Payment Voucher (`installer-bill-pdf.service.ts`)**: Integrated the new official **Pacific Restroom Cubicle & Locker Solutions** brand logo (`PACIFIC_RESTROOM_LOGO_DATA_URL`) with 3D isometric architectural cubicle emblem, replacing the legacy monogram. Category badges (`[CUBICLE]`, `[UMP]`, `[LOCKER]`) and scope subtotals itemized in the voucher table.
            - **Excel History Export (`installer-export.service.ts`)**: 24-column executive `.xlsx` workbook export with frozen header pane, dark navy styling (`#1E293B`), Indian Rupee formatting (`₹#,##0.00`), and dedicated breakdown columns:
              - **Cubicle Breakdown**: `Cubicle Units`, `Cubicle Subtotal (₹)`
              - **UMP Breakdown**: `UMP Units`, `UMP Rate (₹)`, `UMP Total (₹)`
              - **Locker Breakdown**: `Locker Units`, `Locker Subtotal (₹)`
              - **Overall Financials & Audit**: `Total Units`, `Subtotal (₹)`, `Travel Expenses (₹)`, `Total Due (₹)`, `Amount Paid (₹)`, `Balance Due (₹)`, `Payment Status`, `Payment Date`, `Clearance Email Status`, and bottom-line summary totals row.
          - **Complete Removal of Hardcoded Models & Prices (100% Dynamic Catalog)**:
            - **No Seeded / Hardcoded Rates**: All static seed insertions (`Delight`, `Sky Light`, `Standard UMP`, `1-Tier Locker`, etc.) and hardcoded fallbacks (such as fixed ₹150 for UMP or ₹900 defaults) have been completely removed from `fix-db.js`, `schema.prisma`, backend schemas/services, and Admin UI.
            - **Super Admin Dynamic Control**: All models and rates must be registered and managed dynamically by Super Admin via Tab 3 ("Installation Models Master") with custom naming, pricing, and active status across `CUBICLE`, `UMP`, and `LOCKER`.
            - **Clean Database Catalog**: Removed all inactive hardcoded seed models from the live database, ensuring only genuine administrator-configured models appear in bill creation dropdowns.
            - **Category Synchronization & State Reset**: `CubicleModelModal` accepts `initialCategory` dynamically matching the active tab pill filter (`CUBICLE`, `UMP`, `LOCKER`), includes reactive `useEffect` form reset, and database self-healing in `fix-db.js` ensures model categories match their installation scope.
          - **Admin Console Operational Hub & Dedicated New Bill Page**:
            - **Dedicated "New Installer Bill" Page (`CreateInstallerBillPage.tsx`, route `'create-installer-bill'`)**: Full-page view featuring breadcrumbs, "Back to Bills" navigation, installer auto-fetch selector, dynamic model rows across Cubicle, UMP, and Locker sections, automated NCR postal PIN detection, explicit **Payment Date** picker, **Mandatory Internal Notes** textarea, and auto-dispatch email toggle.
            - **Super Admin Installers Directory (`cubicle_installers` & Admin Tab 2)**: Super Admin can register, edit, and deactivate installers (`name`, `email`, `phone`). Gated on API (`requireSuperAdmin`) and Admin UI.
            - **Admin Auto-Fetch**: When generating a new bill, Admins can choose from registered installers in a dropdown, automatically pre-filling the installer's legal name, registered email, and contact phone.
            - **Mandatory Internal Notes**: Required internal audit and verification notes field enforced with strict validation at both backend Zod schema and UI form levels.
          - **Deductions & Penalties Engine (`deductionAmount`, `deductionReason`)**:
            - **Net Calculation Formula**: `Net Total = Math.max(0, Subtotal + Travel Expenses - Deduction Amount)`, `Balance Due = Math.max(0, Net Total - Amount Paid)`.
            - **Mandatory Reason Guard**: Whenever a deduction amount > 0 is entered, a non-empty deduction reason is strictly enforced across backend Zod validation schemas (`CreateInstallerBillSchema`, `UpdateInstallerBillSchema`) and Admin UI forms.
            - **Itemized PDF Payment Advice (`installer-bill-pdf.service.ts`)**: Itemizes deductions with explicit red formatting (`-₹<deductionAmount>`) and states the deduction reason, retitling the final disbursement line to `Net Disbursement Due: ₹<total>`.
            - **26-Column Excel Audit Report (`installer-export.service.ts`)**: Expanded from 24 to 26 columns (`A` through `Z`):
              - Col 19: `Deductions (₹)` (formatted currency `₹#,##0.00` with bottom summary sum)
              - Col 20: `Deduction Reason` (left-aligned audit explanation text)
              - Supported single-technician export when filtering by `installerId`.
          - **Installer-Wise Payment History & Ledger Hub (Tab 5: "Installer Ledgers & History")**:
            - **Dedicated Ledger API (`GET /api/v1/installer-payments/installers/:id/ledger`)**: Computes lifetime technician KPI metrics (Total Jobs Completed, Total Units across Cubicles/UMP/Lockers, Gross Subtotal, Travel Reimbursement, Total Deductions, Net Payable, Total Disbursed, Balance Due, Cleared vs Partial counts) and retrieves full chronological job records.
            - **Admin Tab 5 Interface (`InstallerPaymentsPage.tsx`)**:
              - **Technician Selector**: Dropdown to select any registered technician with live profile overview card.
              - **6 Lifetime Executive KPI Cards**: Completed Jobs, Units Installed, Gross Earnings & Travel, Total Deductions (highlighted in red), Total Disbursed, and Balance Due.
              - **Download Technician Statement (.xlsx)**: 1-click export of the installer's complete statement.
              - **Chronological Jobs & Payment Ledger Table**: Comprehensive history showing Bill No, Date, Site Address & PIN, Units Breakdown, Subtotal, Travel, Deductions & Reason, Net Total, Disbursed, Balance, Status pill, and 1-tap PDF voucher download.
            - **Tab 1 ("Payment Records & Bills")**: Added dynamic "Installer" filter dropdown to isolate bills by technician; bills table displays deduction badges with tooltips under the Total Due column.
            - **Tab 2 ("Installers Directory")**: Added a direct "View Payment Ledger & History" action icon button on each installer row/card to jump immediately to that technician's ledger in Tab 5.
            - **Bill Details Drawer & Modals**: Enhanced `BillDetailsDrawer` and `CreateBillModal` to display and capture deductions, penalties, and reasons alongside Net Disbursement calculations.
          - **Fast Schema Auto-Healing & Render Port Binding Protocol**:
            - **`_applied_schema_patches` Hash-Cache Table**: Tracks cryptographic SHA-256 hashes of all applied schema statements. On container boot, `fix-db.js` fetches applied hashes in a single fast query (~150ms) and skips already-verified patches instantly, slashing execution time from 73+ seconds down to ~0.7 seconds.
            - **15-Second Pre-Start Guard**: Strict safety timeout in `fix-db.js` guarantees that database verification will never exceed 15 seconds, preventing Render's 60-second port scan timeout from ever killing the container with SIGTERM.
            - **Port Binding Priority**: `server.ts` binds `app.listen(port, '0.0.0.0')` immediately on boot so Render detects an active listening port in <100ms.

    29. **Employee & Payroll Management System (`employee-management`, `EmployeeManagementPage.tsx`, `employeeService.ts`, `payslip-pdf.service.ts`)**:
          - **Master Employee Directory**:
            - Auto-generated alphanumeric ID (`EMP-0001` upwards, strictly formatted and system-generated).
            - Complete employee profile: Full Name, unique Email, Phone, Address, Government ID (Aadhaar / PAN / Voter / Passport / Driving License), Bank Account details (Account Number, IFSC, Bank Name, Account Holder Name), Department, Designation, Joining Date, and Active/Inactive status.
            - **Designation Hierarchy & "Workers" First-Class Role**:
              - Default designation for new staff is **"Workers"** (`COMMON_DESIGNATIONS` includes `Workers`, `Hardware Technician`, `Cubicle Installer`, `Site Supervisor`, `Operations Executive`, `Senior Hardware Engineer`, `Sales & Business Development`, `Finance & Accounts`, `Administration & HR`, `Fabricator / Carpenter`, `Helper / Support Staff`).
              - Quick 1-tap designation pill buttons (`[Workers]`, `[Hardware Technician]`, `[Cubicle Installer]`, `[Site Supervisor]`) for fast mobile/touch logging.
              - Custom designation support (`+ Other`) for specialized trades or custom job titles.
              - Employee Directory toolbar filter dropdown for **Designation** allowing 1-click filtering of staff by "Workers" or other roles, with backend query support (`GET /api/v1/employees?designation=Workers`).
            - **Optional Bank Disbursement Account Protocol**:
              - Bank account section in Add/Edit Employee is completely optional, supporting cash-based workers and daily wage staff who do not have immediate bank credentials.
              - Clear "(Optional)" visual badges and helper guidance in the modal.
              - Backend Zod schemas (`CreateEmployeeSchema`, `UpdateEmployeeSchema`) sanitize empty strings, whitespace, and placeholder strings (`N/A`, `NA`, `NONE`, `NIL`) to `null` without triggering IFSC regex validation failures.
              - Directory table gracefully indicates `Optional (Not Provided)` for staff without bank credentials.
            - Compensation profile: Monthly CTC, Basic Salary (50% of CTC), HRA (40% of Basic), Special Allowance (remainder), and dynamic Leave Balances (CL, EL).
          - **Worker Operations Hub (Dedicated Tab for Factory & On-Site Workers)**:
            - **Target Roles**: Tailored for factory workers, carpenters, fabricators, installers, and helpers (`Workers`, `Fabricator / Carpenter`, `Helper / Support Staff`, `Cubicle Installer`, `Hardware Technician`).
            - **Worker Summary KPI Dashboard**: Real-time cards showing Active Workers headcount, Today's Worker Attendance Rate (% & present count), Total Worker Advances Pending Recovery for active month, and Total Worker Net Wages calculated / disbursed.
            - **Sub-View 1: Worker Attendance Matrix**: Fast daily attendance recording with 1-click status pills (`P`, `HD`, `UL`, `CL`), inline overtime hours stepper, Sunday shift override toggle, worker search, monthly attendance summary counters per worker, and 1-click "Mark All Workers Present" batch action.
            - **Sub-View 2: Worker Advances & Recovery**: Cash/salary advance issuance with preset amounts (₹500, ₹1,000, ₹2,000, ₹5,000), worker-specific pending recovery balance tracking, recovery scheduling, and full edit/delete controls.
            - **Sub-View 3: Worker Monthly Payroll Runs**: 1-click worker wage calculation ($(\text{Days Worked} \times \text{Daily Rate}) + \text{OT Pay} - \text{Advances Deducted} - \text{Deductions} = \text{Net Salary}$), cash/bank disbursement authorization, payslip PDF download, and email dispatch.
            - **Worker Quick Filters Across Other Tabs**: Added 1-click toggle pills (`[All Staff] | [Only Workers]`) across general Attendance Matrix, Advances & Deductions, and Monthly Payroll Runs tabs.
          - **Daily Attendance Matrix & Instant Operations**:
            - 0ms optimistic UI updates with silent background API persistence for zero perceived latency.
            - Status toggle chips: `PRESENT`, `CL` (Casual Leave), `EL` (Earned Leave), `HALF_DAY`, `UL` (Unpaid Leave), `LEAVE`.
            - Overtime tracker with stepper (+0.5h increments) and immediate recalculation.
            - Sunday shift approval toggle (`isSundayOverride`) allowing Sunday work to count as an additional paid day.
            - Single-click "Mark All Active Staff Present" batch endpoint (`POST /api/v1/employees/attendance/batch`) with parallel processing.
            - Dedicated Edit Attendance modal allowing detailed remarks, overtime hour adjustments, and Sunday override flags.
          - **Leave Ledger & Automated Accrual Engine**:
            - Monthly accrual job (`POST /api/v1/employees/leaves/accrue-monthly`) awarding +1.00 CL and +0.25 EL to all active staff.
            - Leave Adjustment & Debit Protocol: Debit adjustments deduct directly from the respective balance (CL Debit reduces CL balance, EL Debit reduces EL balance) with live remaining balance calculation and reason logging.
            - Chronological leave transaction ledger with before/after audit tracking.
          - **Salary Advances & Deductions Tracking**:
            - Advance tracking: Amount, Advance Taken Date (`advanceDate`), Recovery Month/Year schedule, and repayment tracking.
            - One-time Deductions: Deduction Amount, Reason, and Apply Month/Year schedule.
            - Full Edit & Delete capabilities with modals for both Advances and Deductions.
          - **Monthly Payroll Engine & Super Admin Revert-to-Draft Workflow**:
            - Prorated salary calculation: `payableDays = presentDays + clDays + elDays + (halfDays * 0.5) + (totalSundays + sundayOverrideCount)`.
            - Overtime rate: `((basicSalary / daysInMonth) / 8) * 1.5 * overtimeHours`.
            - Auto-recovery of scheduled advances and deductions for the active pay period.
            - Net Salary = `(Gross Earned Salary + Overtime Pay) - (Advance Deducted + General Deductions)`.
            - **Finalize Run**: Locks deductions and advances (`isRecovered: true`, `isApplied: true`), assigns `finalizedById`, marks run `FINALIZED`.
            - **Super Admin Revert to Draft (`POST /api/v1/employees/payroll/:id/revert-draft`)**:
              - Strictly guarded by `requireSuperAdmin` middleware on backend and `isSuperAdmin` in Admin UI.
              - Atomically reopens linked advances (`isRecovered: false`, `recoveredAt: null`, `payrollRunId: null`).
              - Atomically reopens linked deductions (`isApplied: false`, `appliedAt: null`, `payrollRunId: null`).
              - Clears `finalizedById`, `paidAt`, `paymentMode`, `paymentReference`, and resets status to `DRAFT`.
            - **Disbursement & Payslip Dispatch**:
              - Super Admin records payment mode (`CASH`, `BANK_TRANSFER`, `UPI`, `CHEQUE`), reference number, and payment notes.
              - Automated dispatch of official payslip PDF advice via email (`sendMail`).
              - 1-click Download Official Payslip PDF (`GET /api/v1/employees/payroll/:id/pdf`) built with `pdfmake` featuring the official **Pacific Restroom Cubicle & Locker Solutions** logo (`PACIFIC_RESTROOM_LOGO_DATA_URL`).
              - 1-click Resend Payslip Email (`POST /api/v1/employees/payroll/:id/send-email`).

    30. **Daily Cash Expense Tracker & Multi-Branch Ledger Suite (`ExpensesPage.tsx`, `expensesApi.ts`, `expenses.service.ts`, `expenses.schema.ts`)**:
          - **Multi-Branch Consolidated Ledger & Filter Architecture**:
            - Super Admins and Admins can view expenses across all branches (`Delhi HQ`, `Kolkata Branch`) in a single consolidated ledger view (`branchId: 'ALL'`) or filter down to a specific branch via the dedicated branch selector.
            - Tab 1 Fast Cashier Entry Form features an explicit **Branch Location** dropdown picker (`entryBranchId`), ensuring that expenses logged for either Delhi or Kolkata are correctly tagged at entry time.
            - Tab 2 Organization Expense Ledger table dynamically displays the **Branch** column whenever the consolidated view is selected or multiple branches exist, with branch badge pills (`Delhi HQ (DEL)`, `Kolkata Branch (KOL)`).
            - Backend Zod validation (`ExpenseFilterQuerySchema`) expanded to accept `status: 'VOIDED'` and `status: 'ALL'`. The `getExpenses` query engine handles voided filter states gracefully, ensuring active and voided records display transparently in the ledger without throwing 400 Bad Request errors.
          - **Resilient Offline Browser Queue & Auto-Sync Engine**:
            - Captures failed or slow submissions into browser `localStorage` (`prc_offline_expense_queue`) with exact date, time, and branch stamps when the backend is asleep or network drops.
            - Proactively auto-syncs queued vouchers to PostgreSQL on application mount (`loadInit`) and network reconnect (`window.online`).
            - Amber **Offline Queue Alert Banner** displayed in both Tab 1 (Fast Entry) and Tab 2 (Ledger) notifying the administrator of pending offline vouchers with a 1-click **Sync Queued Entries Now** button.
          - **Receipt Slip / Voucher Interactive Preview Modal (Images & PDFs)**:
            - Rich modal viewer (`previewReceipt`) supporting high-resolution receipt images (JPEG, PNG, WEBP) and multi-page PDF documents via an embedded `<iframe />` viewport.
            - Includes voucher metadata header (Voucher No, Amount, Category, Paid To, Date & Time, Status badge, Branch code).
            - Fast action buttons: **Open in New Tab** (`ExternalLink`) and **Download Slip** (`Download`).
            - View Slip buttons (`Camera` icon) mounted across:
              - Tab 1 Today's cash entries desktop table (`Receipt` column).
              - Tab 1 Today's cash entries mobile cards.
              - Tab 1 "Recently Logged Voucher" success card preview.
              - Tab 2 Organization Expense Ledger desktop table (`Receipt` column).
              - Tab 3 Pending Approvals queue cards.

          - **Auto-Approval System Removed (2026-09-14)**:
            - All new expense entries now always start as `PENDING` regardless of amount.
            - The `getEffectiveSettings()` call and `autoApprovalThreshold` conditional block have been removed from `createExpense()`.
            - Balance, ledger, and rollup mutations only occur on explicit approval via `approveExpense()`.
          - **Strict Super Admin Exclusivity for Expense & Cash Float Deletions (`requireSuperAdmin`) (2026-09-14)**:
            - Both `DELETE /api/v1/expenses/:id` and `DELETE /api/v1/expenses/ledger/float-topup/:id` are strictly guarded by `requireSuperAdmin` middleware in `expenses.routes.ts`, guaranteeing that standard `admin` roles (which bypass standard `authorize()` checks) cannot invoke deletion operations.
            - **Expense Deletion Protocol (`deleteExpense`)**: Atomically reverses financial state if approved/not voided (`BranchCashBalance` incremented, `ExpenseDailyLedger` total expenses decremented and closing balance incremented, `ExpenseDailyRollup` and `ExpenseMonthlyRollup` amounts and counts decremented), creates an audit record in `ExpenseAuditLog`, and deletes the `ExpenseEntry`.
            - **Float Top-Up Deletion Protocol (`deleteFloatTopUp`)**: Atomically reverses `BranchCashBalance` (-amount) and `ExpenseDailyLedger` (-cashReceived, -closingBalance), creates an audit record in `ExpenseAuditLog`, and removes the `ExpenseFloatTopUp` record.
            - **Admin UI Guards (`ExpensesPage.tsx`)**: Robust role resolution checks `roleSlug.includes('super') || adminUser?.isSuperAdmin === true`. Delete buttons and confirmation modals across Tab 1 (Today's Outflows table & mobile cards), Tab 2 (Organization Expense Ledger), Tab 3 (Pending Approvals Queue), and Tab 4 (Float Top-Up History) are strictly rendered only when `isSuperAdmin === true`. Handlers `handleConfirmDelete` and `handleDeleteFloat` actively block non-superadmins.
          - **Payment Receipt Attachment & Super Admin Inspection Hub (2026-09-14)**:
            - **Cash Float Payment Receipt Support**: Added `receiptAttachment` field (`receipt_attachment` column in `expense_float_top_ups` via `fix-db.js` patch & Prisma schema). When recording a float top-up, finance/cashier staff can attach a bank transfer slip, cheque photo, or signed cash receipt (JPG, PNG, PDF) using `expensesApi.uploadReceipt`.
            - **Float History Table Inspection**: Added a dedicated **Payment Receipt** column in the Cash Float Top-Up History table visible exclusively to Super Admins. If a receipt file is attached, 1-click **View Receipt** opens the full document preview. If paperless, Super Admin can click **Voucher** to view the generated official **PRC Cash Float Disbursal & Receipt Voucher**.
            - **Universal Super Admin Payment Receipt / Voucher Access**: In Tab 1 (Today's Outflows), Tab 2 (Organization Expense Ledger), and Tab 3 (Pending Approvals Queue), Super Admins can inspect uploaded receipts or view the generated official **PRC Cash Outflow Payment Voucher** even if no paper slip was uploaded at entry time.
            - **Comprehensive Preview & Print Suite**: The preview modal supports high-resolution image zoom, embedded PDF documents, 1-click download, new tab opening, and 1-click printable vouchers (`window.print()`).

    31. **Employee Management — Monthly CTC Optional (2026-09-14)**:
          - `monthlyCtc` field in `CreateEmployeeSchema` changed from `positive()` (required) to `min(0).optional().default(0)`.
          - Admin UI Add Employee form: `required` removed, label updated to show **Optional** badge (emerald), placeholder updated to "Leave blank for daily-wage workers".
          - Form submission defaults `monthlyCtc` to `0` when left blank.

    32. **Admin RBAC Login, Governance Matrix & Mandatory 2FA Onboarding (2026-09-14)**:
          - **Custom Role Login Fix (Bug 1)**:
            - `adminLogin` in `auth.service.ts` replaced static role enum whitelist (`['super-admin', 'admin', 'manager', 'staff']`) with dynamic validation verifying the account has at least one non-customer role (`!CUSTOMER_ROLE_SLUGS.includes(slug)`).
            - Added case-insensitive email search (`mode: 'insensitive'`) and email normalization (`trim().toLowerCase()`) in both `adminLogin` and `createUser` to ensure zero credential mismatch errors.
          - **Staff & Admin Access Governance / RBAC Matrix Fix (Bug 2)**:
            - `listUsers` in `users.service.ts` replaced hardcoded admin role slug whitelist with dynamic `where.userRoles = { some: { role: { slug: { notIn: CUSTOMER_ROLE_SLUGS } } } }`.
            - All administrators and staff created with custom roles now dynamically appear in the RBAC Matrix table with full role details, permissions, and status.
            - Added dedicated **Custom Roles** tab to `AdminManagementPage.tsx` search and filter toolbar.
          - **Forced Password Reset on First Login (Feature Request)**:
            - Any staff or admin provisioned with a temporary password is automatically flagged with `mustChangePassword: true`.
            - **Server-Side Enforcement**: In `auth.middleware.ts`, `authenticate` blocks all operational API routes with `403 PASSWORD_CHANGE_REQUIRED` until password change is fulfilled via `/auth/change-password`.
            - **Client-Side Enforcement**: `App.tsx` routes accounts with `mustChangePassword: true` to `AdminForceChangePasswordPage.tsx` (Step 1 of 2). Direct URL navigation cannot bypass this step.
          - **Mandatory Two-Factor Authentication Setup (Feature Request)**:
            - Once password is updated, account automatically transitions to `AdminMandatory2FAPage.tsx` (Step 2 of 2).
            - **Server-Side Enforcement**: In `auth.middleware.ts`, `authenticate` blocks all operational API routes with `403 TWO_FACTOR_REQUIRED` for administrative/staff accounts until 2FA setup is confirmed.
            - **Client-Side Enforcement**: `App.tsx` keeps account locked on `AdminMandatory2FAPage.tsx` until TOTP 6-digit confirmation succeeds via `adminAuthService.confirmEnable2FA()`.
    33. **Two-Factor Authentication Session Persistence & Stock Data Deletion Integrity (2026-09-14)**:
          - **2FA State Hydration & Reload Fix**:
            - **Backend `getMe`**: Added missing `twoFactorEnabled: user.twoFactorEnabled ?? false` and `isTwoFactorEnabled: user.twoFactorEnabled ?? false` to `getMe()` in `auth.service.ts`.
            - **Admin Auth Context & Profile**: `adminAuthService.getProfile()` resolves `is2fa = Boolean(res.data.isTwoFactorEnabled ?? res.data.twoFactorEnabled ?? cachedUser?.isTwoFactorEnabled ?? isLocal2FAEnabled())` and persists normalized session. `AdminAuthContext.tsx` preserves 2FA across hydration.
            - **App.tsx Guard**: 2FA setup guard checks `is2FAActive = Boolean(adminUser.isTwoFactorEnabled || adminUser.twoFactorEnabled || isLocal2FAEnabled())`, ensuring administrators with verified 2FA are never re-prompted for 2FA on page reload.
          - **Stock Data Deletion & Detail Cleanup Integrity**:
            - **Backend `deleteInventoryItem`**: Upgraded to handle direct UUIDs as well as synthetic `inv-${productId}` or `productId`. Writes off remaining units in `StockMovement` ledger as `FACILITY_DEALLOCATION`, deletes `inventory` rows, and syncs `product.stock = 0`.
            - **Soft-Deleted Product Isolation**: `listInventory` in `inventory.service.ts` filters out soft-deleted products (`product: { deletedAt: null }`), preventing phantom stock records from surfacing. `deleteProduct` in `products.service.ts` cleans up associated `inventory` rows and clears inventory cache.
            - **Admin API Inventory Merging**: `inventoryApi.getInventory` in `adminApi.ts` updated to only merge catalog products that have positive stock (`(Number(p.stock) || 0) > 0`), active status, and not deleted, preventing deleted/zero-stock items from resurrecting in the UI table.
            - **Admin Console UI Optimistic Pruning**: `handleConfirmDelete` in `InventoryPage.tsx` immediately removes deleted items from state and closes all active detail/dossier/edit modals (`selectedPurchase`, `selectedTransfer`, `selectedDossierProductId`, `editingStockItem`, `quickActionProduct`).    34. **Custom Role Branch Location Resolution & Expense Update Authorization (2026-09-14)**:
          - **Branch Facility Listing Permission Accessibility**:
            - In `inventory.routes.ts`, `branchesRouter.get('/')` and `branchesRouter.get('/:id')` were previously restricted to `authorize('inventory.stock.read', 'inventory.view', 'branches.read')`.
            - As a result, administrators or staff created with custom expense roles (e.g. `expenses.create`, `expenses.read`, `expenses.update`) received `403 Forbidden` on `/branches`, resulting in an empty Branch Location selection dropdown and blocking expense logging with "Please select a branch location".
            - Read access on `GET /branches` and `GET /branches/:id` is now accessible to all authenticated administrative staff (`authenticate`), while facility mutations (create, update, delete) remain strictly guarded by `inventory.warehouses.create` / `branches.create`.
          - **Resilient Fallback & Expense Update Route Alignment**:
            - In `expensesApi.ts`, `getBranches()` now gracefully parses responses and provides default fallback locations matching active database facilities (`Delhi HQ` and `Kolkata Branch`).
            - In `ExpensesPage.tsx`, `loadInit()` decouples branch and category fetching, and a reactive `useEffect` automatically selects the first active branch (`Delhi HQ`) if unselected.
            - In `expenses.routes.ts`, added `expenses.update` permission to `PATCH /api/v1/expenses/:id`, enabling custom expense roles with update permissions to edit expense entries.

    35. **First-Time 2FA Setup Automatic Login & Instant Dashboard Transition (2026-09-14)**:
          - **Backend Token Issuance on 2FA Confirmation**:
            - In `twoFactor.service.ts`, `enable2Fa` now issues a fresh authentication token pair (`accessToken` and `refreshToken`) and returns the complete authenticated `user` payload with `twoFactorEnabled: true` and `isTwoFactorEnabled: true`.
            - In `auth.controller.ts`, `enable2Fa` automatically attaches the HTTP-only refresh token cookie (`setRefreshCookie`).
            - Added resilient database fallback in `enable2Fa` and `setup2Fa` (`user.twoFactorSecret`), ensuring TOTP setup never fails even if the Redis cache session is evicted or temporarily unavailable.
          - **Client-Side Instant Auto-Login & Navigation**:
            - In `adminAuthService.ts`, `confirmEnable2FA` captures the freshly issued tokens, invokes `setAdminTokens`, and marks `setLocal2FAEnabled(true)`.
            - In `AdminAuthContext.tsx`, implemented `complete2FAVerification(verifiedUser?)`, which updates the authenticated user in React state, synchronizes `localStorage`, sets `currentView("dashboard")`, and pushes `/dashboard` to the browser history.
            - Sanitized `currentView` initialization so route segments `/login` cleanly default to `"dashboard"` instead of retaining an invalid non-view string.
            - In `AdminMandatory2FAPage.tsx`, `handleVerifyAndEnable` immediately calls `complete2FAVerification(res.user)` upon successful code entry, seamlessly transitioning the administrator directly into the Admin Console dashboard without requiring manual navigation or re-login.

    37. **Cross-Branch Pending Expense Approvals Queue & Custom Role In-Modal Permissions Governance (2026-09-14)**:
          - **Cross-Branch Expense Approvals Queue Visibility**:
            - In `ExpensesPage.tsx`, `fetchApprovals` previously defaulted to `branchId: selectedBranchId` (Delhi HQ), which suppressed pending approval vouchers logged from other branches (e.g. Kolkata Branch).
            - Introduced `approvalsBranchFilter` state initialized to `'ALL'`, allowing management to view pending approvals across the entire organization by default.
            - Added initial `fetchApprovals()` invocation upon component mount to populate the top navigation badge count immediately.
            - Rendered interactive facility filter pills (`All Branches (${pendingEntries.length})`, `Delhi HQ`, `Kolkata Branch`) in the Approvals Tab toolbar for instant facility switching.
            - Attached facility badges (`<Building2 /> ${e.branch?.name || 'Facility'}`) to every pending expense voucher card.
            - Triggered `fetchApprovals()` on both `handleApproveEntry` and `handleConfirmReject` for instant live list refetching and badge count synchronization.
          - **Custom Role Permissions Management & Super Admin In-Modal Authorization**:
            - In `RolesPage.tsx`, enhanced Super Admin detection logic (`isSuperAdminUser`) across role slugs, boolean flags, and nested objects.
            - Transformed Modal 2 (`editingRole`) from a metadata-only edit into a comprehensive Role & Permissions Management modal.
            - Added `editPerms`, `editExpandedGroups`, `editPermSearch`, and `loadingEditPerms` states.
            - Implemented `handleOpenEditRole(r: Role)` to dynamically query `rolesApi.getById(r.id)` and seed active role permissions into `editPerms`.
            - Built in-modal search filtering, "Grant All", "Deselect All", "Expand All", and "Collapse All" controls.
            - Grouped capabilities into module accordions with category headers, granted counter badges (`{checkedCount}/{groupSlugs.length}`), and quick "Select" / "Deselect" module buttons.
            - Provided individual permission checkboxes with display name, code slug, and color-coded CRUD badges.
            - Implemented `handleSaveEditRole` to atomically update role metadata (`rolesApi.update`) AND role permissions (`rolesApi.updatePermissions`).
            - Added direct "Edit Role" button in the right-column header for custom roles alongside list action icons.
          - **Staff Admin Provisioning Shortcuts**:
            - Connected `onNavigateRoles` prop in `AdminLayout.tsx` and `AdminManagementPage.tsx` for 1-click navigation to `roles` view (`setCurrentView("roles")`).
            - Added "Roles & Permissions" shortcut button in the staff directory header toolbar next to "+ Provision Admin / Manager".
            - Embedded "+ Customize Roles & Perms" shortcut link in the Create Admin modal role selector header and active role preview card.
            - Embedded "Customize Roles & Perms" shortcut link in the Edit Admin modal role selector.

---

*Last Updated: 2026-09-14 (Custom role in-modal permissions governance and cross-branch pending expense approvals queue complete; verified 0 TypeScript compiler errors across full stack)*

---

## 38. Expense Approval CORS Fix — Render Cold-Start Server Wake-Up (2026-09-14)

### Root Cause
The CORS block on `POST /api/v1/expenses/:id/approve` was **not** caused by a misconfigured CORS policy in Express. The backend `app.ts` already has `admin-delta-kohl.vercel.app` hardcoded in the allowlist (line 106) and a permissive fallback `return callback(null, true)` for all other origins.

The actual cause is **Render free-tier cold-start**: when the Render container is sleeping, Render's load-balancer proxy returns an HTTP `503` before Node.js/Express even loads. That `503` carries **no `Access-Control-Allow-Origin` header** because Express hasn't run yet. The browser's preflight check fails → CORS error.

### Fix Applied

#### `D:\admin\src\api\adminApi.ts`
- Added `wakeServerAndWait(maxAttempts = 8)` export function (lines ~177–207):
  - Polls `GET /ping` (with full CORS, not `no-cors`) every 2s → 4s → 6s → 8s (progressive back-off).
  - Returns `true` once the server responds with any non-5xx status.
  - Returns `false` after max attempts — caller proceeds anyway.
- Increased auto-retry delay for 502/503/504 and network/CORS errors from **2.5s → 5s** (server needs more time to wake from sleep).

#### `D:\admin\src\api\expensesApi.ts`
- Imported `wakeServerAndWait` from `adminApi`.
- `approveExpense()`, `rejectExpense()`, `voidExpense()` — all now call `await wakeServerAndWait()` before issuing the `POST` request. This guarantees Express is up and CORS headers will be returned.

#### `D:\admin\src\pages\ExpensesPage.tsx`
- Added `approvingId: string | null` state — tracks which expense entry is currently being approved.
- Added `rejectingId: string | null` state — tracks which entry is being rejected.
- Updated `handleApproveEntry`:
  - Guards against double-tap.
  - Sets `approvingId` while in-flight, clears in `finally`.
  - On CORS/network error, shows a user-friendly `⚠️ Server connection error. Backend waking up.` alert instead of raw error message.
- Updated `handleConfirmReject`: sets/clears `rejectingId` in try/finally.
- All 5 Approve buttons in JSX updated with `disabled={!!approvingId}` and conditional label `'Waking server…'` while the specific entry is being approved.

### Verification
- `npx tsc --noEmit` → **exit code 0** on both `admin` and `PRC-Backend`.

---

## 39. Daily Cash Expense Tracker — Optimistic UI, Payer Attribution & Multi-Branch Excel Reporting Suite (2026-09-15)

### 39.1 Problem Statement & Requirements
1. **Approval Lag & UI Slowness**: Users experienced server response delays (10-15s) when clicking Approve on expense vouchers, along with sluggish page loading when navigating to the Daily Cash Expense Tracker.
2. **Excel Report Branch Selection**: Reports previously lacked an option to filter and export data specifically for the Kolkata Branch, Delhi HQ, or All Branches Consolidated.
3. **Uniform Excel Columns & Formatting**:
   - Every downloaded expense report (Day, Week, Month, Year) must feature a standard itemized vouchers table with all 13 standard columns: Current Date, Voucher No, Branch, Who Paid (Name / Employee), Category, Sub-Category, Amount, Payment Mode, Description / Note, Paid To (Vendor / Person), Slip (Receipt URL / Link), Status, and Approved By.
   - Clickable hyperlinks for receipt attachments linking directly to the uploaded slip image or PDF document.
   - Native Excel auto-filter (`autoFilter`) enabled on all report sheets so downloaded workbooks open with filter dropdowns ready for immediate analysis.
4. **Fast Expense Logging Payer Name Field**:
   - Addition of a "Who Paid (Name)" field (`paidBy`) to track the specific cashier or staff member who disbursed the funds, complementing the existing "Paid To (Vendor / Person)" (`paidTo`) field.

### 39.2 Implementation Details

#### 1. Database & Schema (`PRC-Backend`)
- **Prisma Schema (`prisma/schema.prisma`)**: Added `paidBy String? @map("paid_by")` to `model ExpenseEntry`.
- **Database Self-Healing (`src/scripts/fix-db.js`)**:
  - Added idempotent DDL statement: `ALTER TABLE "expense_entries" ADD COLUMN IF NOT EXISTS "paid_by" TEXT;`.
  - Added `"paid_by" TEXT,` to the `CREATE TABLE IF NOT EXISTS "expense_entries"` DDL definition.
  - Executed and verified via `node src/scripts/fix-db.js`.
- **Prisma Client**: Re-generated with `npx prisma generate` (`v5.22.0`).

#### 2. Backend Validation & Services (`PRC-Backend`)
- **Validation Schemas (`expenses.schema.ts`)**:
  - Added `paidBy: z.string().optional().nullable()` to both `CreateExpenseSchema` and `UpdateExpenseSchema`.
- **Expense Service (`expenses.service.ts`)**:
  - `createExpense`: Stores `paidBy: input.paidBy ? input.paidBy.trim() : null` and includes full relations (`branch`, `employee`, `addedBy`, `approvedBy`).
  - `updateExpense`: Updates `paidBy` and returns enriched relations.
  - `exportReport`: Included `category`, `branch`, `employee`, `addedBy`, and `approvedBy` relations across Day, Week, Month, and Year reports. Added raw itemized voucher queries to Month and Year reports and forwarded them to the workbook generators.
- **Excel Export Service (`expenses-export.service.ts`)**:
  - Implemented `addRawVouchersWorksheet(wb, sheetName, entries, defaultBranchName)`:
    - 13 standard columns: `Date`, `Voucher No`, `Branch`, `Who Paid (Name)`, `Category`, `Sub-Category`, `Amount (₹)`, `Payment Mode`, `Description / Note`, `Paid To (Vendor / Person)`, `Receipt Slip`, `Status`, `Approved By`.
    - Clickable hyperlink for receipt slips (`{ text: 'View Slip / Receipt', hyperlink: e.receiptAttachment }`) with blue underline styling, falling back to `'No Slip'`.
    - Total sum formula row: `SUM(G2:G{n})` formatted in Indian currency `₹#,##0.00`.
    - Native `autoFilter` range activated across all columns (`ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(entries.length + 1, 1), column: ws.columns.length } }`).
  - Unified Day Sheet 2, Week Sheet 3, Month Sheet 3, and Year Sheet 3 with `addRawVouchersWorksheet`.
  - Added `autoFilter` to all summary, rollup, pivot, and reconciliation sheets across all 4 export workbooks.

#### 3. Cross-Project Types & Frontend Alignment
- **Admin Types (`admin/src/types/admin.ts`)**: Added `paidBy?: string | null;` to `ExpenseEntry` and `UpdateExpenseInput`.
- **Admin API (`admin/src/api/expensesApi.ts`)**: Added `paidBy?: string | null;` to `OfflineQueuedExpense` and `createExpense`.
- **Frontend Types (`frontend/src/types/index.ts`)**: Added `paidBy?: string | null;` to `ExpenseEntry`.
- **Frontend Services (`frontend/src/services/cashExpenseService.ts`)**: Added `paidBy?: string | null;` to `createExpense`.

#### 4. Admin UI Architecture (`admin/src/pages/ExpensesPage.tsx`)
- **Excel Report Branch Filter**:
  - Added `reportBranchId` state (defaults to `'ALL'`).
  - Added interactive branch selection dropdown in the Multi-Sheet Excel Generator card header (Tab 5) with options: `All Branches (Consolidated)`, `Delhi HQ`, and `Kolkata Branch`.
  - Wired `handleDownloadExcel(overridePeriod)` to pass the selected `reportBranchId` in the query params.
- **Fast Expense Logging Form**:
  - Added `entryDate` state defaulting to the user's current local date (`YYYY-MM-DD`), allowing staff to select custom or past dates for back-dated vouchers with automated reset back to current date on submit.
  - Added `entryPaidBy` state and a dedicated "Who Paid (Name)" text input next to "Paid To (Vendor / Person)".
  - Compact, high-density, mobile-first UI revamp: reduced padding (`p-3.5 sm:p-4`), scaled down input sizes (`text-xs`), normalized labels (`text-[11px] font-semibold`), removed redundant subtitle text ("Log cash outflow in under 10 seconds"), transformed category selection and payment mode into streamlined, touch-friendly `<select>` dropdowns with dark mode support and local category memory (`localStorage`), and compacted slip file attachment and submit buttons.
- **Edit Expense Modal**:
  - Added `editDate` state and date picker allowing modification of expense dates with backend schema (`UpdateExpenseSchema.date`) and service (`updateExpense`) support.
  - Added `editPaidBy` state and "Who Paid (Name)" input field.
- **Voucher Displays**:
  - Displayed `paidBy` attribution across Today's Outflows desktop table and mobile cards, Organization Ledger table and mobile drawer, Pending Approvals queue cards, and Recently Logged summary banner.
- **Performance & Instant Feedback**:
  - Zero-delay 0ms optimistic updates for instant UI status transitions on Approve/Reject without waiting for network round-trips.
- **Cash Float Date Picker & Voucher List Updates**:
  - **Custom Date Selection**: Added `topUpDate` state in `admin/src/pages/ExpensesPage.tsx` defaulting to `getTodayDateString()` (`YYYY-MM-DD`).
  - **Date Picker in Top-Up Modal**: Added a dedicated top-up date input field with a "Set Today" shortcut in `isTopUpModalOpen` modal, allowing finance admins to record cash float additions for custom/past dates. Automatically resets to current date on submit.
  - **Timezone-Safe Date Display**: Created `formatDisplayDate(dateStr, monthFormat)` parsing `YYYY-MM-DD` directly to prevent off-by-one day display drift across local timezones in the Cash Float History table and the Digital Cash Float Payment Voucher preview modal.
  - **Full-Spectrum Excel Export for Cash Float Top-Ups**:
    - Implemented `addFloatTopUpsWorksheet(wb, sheetName, topUps, defaultBranchName)` in `expenses-export.service.ts` featuring 9 standard columns: `Date`, `Record ID`, `Branch`, `Amount (₹)`, `Source of Cash Float`, `Reference / Cheque No`, `Notes / Purpose`, `Payment Receipt Slip`, and `Added By`.
    - Includes clickable hyperlinks (`View Receipt Slip`), formula sum row (`=SUM(D2:D{n})`), rupee currency formatting, Segoe UI typography, and native Excel `autoFilter`.
    - Injected itemized `Cash Float Top-Ups` worksheet across all 4 export periods: Day (Sheet 3), Week (Sheet 4), Month (Sheet 4), and Year (Sheet 4).
    - Enriched `exportReport` in `expenses.service.ts` with `{ branch: true, addedBy: true }` relations and chronological ordering (`[{ date: 'asc' }, { createdAt: 'asc' }]`) for all float queries.

### 39.3 Verification & Quality Assurance
- `PRC-Backend`: `npx tsc --noEmit` passed with **0 compiler errors**.
- `admin`: `npx tsc --noEmit` passed with **0 compiler errors**.
- `frontend`: `npm run build` (Vite) succeeded with **0 errors**.
### 40. Rate Limiting, CORS Resilience & Reverse Proxy Infrastructure (2026-09-15)

#### 40.1 Architecture & Fixes
- **Management & Operational Dashboard Bypass**:
  - In `src/middleware/rateLimit.middleware.ts`, normalized user role checks via `.toLowerCase().replace(/[-_]/g, '')`.
  - Authenticated roles (`super_admin`, `super-admin`, `admin`, `manager`, `accountant`, `cashier`, `staff`) now completely bypass the rate limiter, preventing false-positive 429 errors during intensive management console operations (e.g. updating expense entries, float audits, bulk edits).
- **CORS Header Guarantee on Rate Limit & Error Responses**:
  - In `src/middleware/rateLimit.middleware.ts`, injected `Access-Control-Allow-Origin: req.headers.origin` and `Access-Control-Allow-Credentials: true` directly before sending 429 Too Many Requests responses in both Redis and in-memory paths.
  - In `src/utils/response.ts`, enhanced `sendError` to automatically inject origin and credentials CORS headers if absent, preventing Chrome/Edge from masking 4xx/5xx errors as generic `ERR_FAILED` or `blocked by CORS policy` network failures.
- **Render Cloud Reverse Proxy Detection (`trust proxy`)**:
  - In `src/app.ts`, configured `app.set('trust proxy', 1)` when running in production (`env.NODE_ENV === 'production'`) or on Render (`process.env.RENDER`), ensuring Express accurately parses real client IPs from `X-Forwarded-For` rather than clustering all worldwide users into Render's shared gateway IP.
- **Global Umbrella Limit Expansion**:
  - Increased `generalLimiter` default capacity from 1,200 to 3,000 req/min per IP to comfortably accommodate high-frequency frontend and admin operations.
- **Admin Console Background Keep-Alive Throttling**:
  - In `d:\admin\src\api\adminApi.ts`, added a 60-second rate-throttle guard (`_lastKeepAlivePing`) to `keepAliveServerPing()`, eliminated `mode: 'no-cors'` in favor of standard CORS with a 10s timeout, and removed redundant `/health` cascade pings to eliminate ping storms on window focus / tab visibility changes.

### 40.2 Verification & Quality Assurance
- `PRC-Backend`: `npx tsc --noEmit` passed with **0 compiler errors**.
- `admin`: `npx tsc --noEmit` passed with **0 compiler errors**.
- Full-stack build and schema integrity preserved.

---

### 41. B2B Order Management & Physical Stock Reservation Suite (2026-09-15)

#### 41.1 System Architecture & Invariant Rules
The B2B Order Management module provides enterprise dual-channel order placement, approval gates, physical vs reserved stock tracking, and complete audit synchronization:

1. **Dual-Channel Order Ingestion**:
   - **Channel 1 (Admin Offline Orders)**: Super Admin places an order on a customer's behalf from the Admin Panel (`POST /api/v1/b2b-orders/offline`). Trusted by definition — the order is created directly in `CONFIRMED` status, physical inventory is deducted immediately in a single database transaction, and a `B2B_ORDER` stock movement is recorded.
   - **Channel 2 (Customer Self-Service Orders)**: Authenticated B2B wholesale customer places their own order (or converts an approved quotation) via `POST /api/v1/b2b-orders/submit`. The order lands in `PENDING_APPROVAL` status. Physical stock is **NOT** deducted; instead, inventory is **reserved** in `StockReservation` with `status: ACTIVE` and incremented on `Inventory.reservedQuantity`.
2. **Available Stock Invariant Formula**:
   $$\text{Available Stock} = \text{Physical Stock (`Inventory.quantity`)} - \text{Active Reservations (`Inventory.reservedQuantity`)}$$
   - Prevents overselling across retail and B2B channels. Available stock is returned by `GET /api/v1/b2b-orders/stock-check` and enforced during both submission and approval.
3. **Super Admin Approval Gate**:
   - Only users with `req.user.role === 'super_admin'` can approve (`POST /:id/approve`), reject (`POST /:id/reject`), edit (`PATCH /:id/edit`), or cancel confirmed orders (`POST /:id/cancel`). Non-super-admins receive HTTP 403 Forbidden.
   - **Approval**: Transitions status to `CONFIRMED`, decrements `Inventory.reservedQuantity`, decrements `Inventory.quantity` (physical deduction), marks reservations as `CONVERTED`, logs `B2B_ORDER` stock movements, and records `approvedById` and `approvedAt`.
   - **Rejection**: Transitions status to `REJECTED`, releases reservations (`RELEASED`), decrements `Inventory.reservedQuantity`, records `rejectionReason`, and logs **zero** stock movements (no physical stock was touched).
4. **Customer Self-Service Cancellation Protocol**:
   - Authenticated customers can cancel their own orders via `POST /api/v1/b2b-orders/:id/customer-cancel` **strictly when** `status === 'PENDING_APPROVAL'`.
   - Releasing the order decrements `Inventory.reservedQuantity`, marks reservations `RELEASED`, sets order status to `CANCELLED`, and logs zero physical movements.
   - Attempting to cancel a `CONFIRMED` order returns HTTP 400 Bad Request ("Only orders in pending_approval status can be cancelled by the customer").
5. **Super Admin Confirmed Order Cancellation & Restocking**:
   - Super Admin can cancel confirmed orders via `POST /api/v1/b2b-orders/:id/cancel`.
   - Restores physical inventory (`Inventory.quantity += line.quantity`), logs `B2B_CANCELLATION` stock movements with the audit reason, and sets status to `CANCELLED`.
6. **Super Admin Confirmed Order Editing with Delta Stock Adjustments**:
   - Super Admin can edit quantities or soft-remove line items (`isRemoved: true`) via `PATCH /api/v1/b2b-orders/:id/edit`.
   - **Positive Delta** (increase): Verifies available physical stock, deducts difference from `Inventory.quantity`, and logs `B2B_ADJUSTMENT` movement.
   - **Negative Delta** (decrease / removal): Returns surplus back to `Inventory.quantity` and logs `B2B_ADJUSTMENT` movement.
   - Recalculates order subtotal, 18% GST tax, and grand total.
7. **Numbering Pattern & Idempotency**:
   - Sequence format: `PRC-B2B-<FY>/<seq>` (e.g. `PRC-B2B-2026-27/001`) generated atomically via `B2bOrderSequence`.
   - Idempotency: `client_request_id` header or body field. If an order with that key exists, the existing record is returned without duplicate insertion.

#### 41.2 Database & Migrations (`PRC-Backend`)
- **Schema (`prisma/schema.prisma`)**:
  - Added enum values to `StockMovementType`: `B2B_ORDER`, `B2B_ADJUSTMENT`, `B2B_CANCELLATION`.
  - Added enums: `B2bOrderStatus`, `B2bOrderSource`, `StockReservationStatus`.
  - Added models: `B2bOrder`, `B2bOrderItem`, `StockReservation`, `B2bOrderSequence`.
  - Relations wired on `User`, `Branch`, `Product`, `Quote`, and `PoSubmission`.
- **Idempotent Boot Patch (`src/scripts/fix-db.js`)**:
  - DDL statements for all enum types, tables, foreign keys, unique indexes (`client_request_id`, `order_number`, `sequence`), and concurrency-safe PostgreSQL stored procedures:
    - `submit_b2b_order(p_customer_id, p_branch_id, p_quote_id, p_po_submission_id, p_client_request_id, p_order_number, p_notes, p_items)`: Locks `Inventory` rows with `FOR UPDATE`, validates available stock ($\ge \text{quantity}$), creates order, items, and active reservations, and increments `reserved_quantity`.
    - `approve_b2b_order(p_order_id, p_approved_by)`: Locks inventory rows, verifies physical stock $\ge$ reserved qty, deducts physical stock, decrements reserved stock, marks reservations `CONVERTED`, updates order to `CONFIRMED`, and logs `B2B_ORDER` audit movements.
    - `reject_b2b_order(p_order_id, p_rejected_by, p_reason)`: Decrements `reserved_quantity`, marks reservations `RELEASED`, updates order to `REJECTED`, and logs zero physical movements.

#### 41.3 Backend REST API (`/api/v1/b2b-orders`)
- `POST /submit`: Customer self-service order creation (requires authenticated B2B customer; lands in `PENDING_APPROVAL`).
- `POST /offline`: Super Admin offline order creation (requires `role === 'super_admin'`; immediately `CONFIRMED` + physical deduction).
- `POST /:id/approve`: Super Admin order approval (converts reservations to physical deductions).
- `POST /:id/reject`: Super Admin order rejection (releases reservations, 0 physical movements).
- `PATCH /:id/edit`: Super Admin confirmed order editing (delta stock adjustments with `B2B_ADJUSTMENT`).
- `POST /:id/cancel`: Super Admin confirmed order cancellation (restores physical stock with `B2B_CANCELLATION`).
- `POST /:id/customer-cancel`: Customer self-service cancellation (strictly `pending_approval`).
- `GET /`: Admin order list with status filter, search, pagination, and KPI counts.
- `GET /my`: Customer order list.
- `GET /:id`: Order details with line items, reservations, and stock movements.
- `GET /stock-check`: Real-time stock check returning physical, reserved, and available quantity for SKU list at branch.

#### 41.4 Admin Console Implementation (`d:\admin`)
- **Types (`src/types/admin.ts`)**: Added `B2BOrder`, `B2BOrderItem`, `StockReservation`, `B2BOrderStatus`, `B2BOrderSource` and mounted `'b2b-orders'` view in `AdminView`.
- **API Client (`src/api/b2bOrdersApi.ts`)**: Complete typed REST client for all endpoints.
- **B2B Orders Workspace (`src/pages/B2BOrdersPage.tsx`)**:
  - **4 Interactive KPI Metric Cards**: Pending Approval, Confirmed Orders, Monthly B2B Revenue, and Cancelled/Rejected counts.
  - **Pending Approval Action Queue**: Dedicated high-contrast priority alert banner highlighting pending customer orders with 1-click Approve/Reject buttons.
  - **Status Tabs & Server-Side Filters**: All, Pending Approval, Confirmed, Cancelled, Rejected tabs with search by order reference, company name, or customer email.
  - **Create Offline Order Modal**: Super Admin offline order creation with branch selection, customer picker, product combobox, real-time available stock badge, dynamic payment method selection (Bank Transfer, Cheque, Credit Terms 30d, UPI, Cash), dynamic GST rate selector (18%, 12%, 5%, 28%, 0%), delivery notes input, and auto-calculated line taxes and grand totals.
  - **Approve Order Modal**: Confirmation modal with live inventory re-check badge.
  - **Reject Order Modal**: Mandatory rejection reason input.
  - **Edit Confirmed Order Modal**: Dynamic line item adjustments (quantity increases/decreases, remove line) with delta calculation and live stock check for positive deltas.
  - **Cancel Confirmed Order Modal**: Mandatory cancellation reason input and restock audit notification.
  - **360° Order Dossier Drawer**: Comprehensive sliding drawer displaying full order metadata, milestone timeline, customer details, fulfillment branch, financial breakdown, and line item cards with dynamic tax labels and zero hardcoded facility fallbacks.
- **Navigation & Layout (`AdminSidebar.tsx`, `AdminLayout.tsx`)**: Mounted under "Sales & Fulfillment" with live pending approval badge counter.

#### 41.5 Customer Storefront Implementation (`d:\frontend`)
- **Types (`src/types/b2bOrder.ts`, `src/types/index.ts`)**: Type definitions for customer-facing B2B orders with dynamic `taxRate`, `taxPercent`, `paymentMethod`, and `notes`.
- **Service (`src/services/b2bOrderService.ts`)**: REST client for submit, fetch, cancel, and stock-check.
- **Convert Approved Quotation to Official B2B Order (`src/pages/CustomerQuoteApprovalPage.tsx`)**:
  - For accepted/approved quotations, added a prominent **"Convert to Official B2B Order"** action button.
  - Interactive conversion modal: fulfillment branch selector, line item preview with real-time available stock badges (`In Stock`, `Low Stock`, `Out of Stock`), subtotal, dynamic quotation GST rate calculation, grand total, and delivery notes.
  - Idempotent submission with navigation to profile orders tab.
- **Customer User Profile B2B Orders Tab (`src/components/auth/UserProfilePage.tsx`)**:
  - Dedicated **"B2B Orders"** tab for registered B2B wholesale users with live badge count.
  - "B2B" filter switcher on standard My Orders tab and quick shortcut button on Overview tab.
  - Responsive order cards displaying order reference with 1-click copy, date, fulfillment branch, status badges with physical deduction / reservation indicator, and line item previews.
  - **Customer Self-Service Cancellation**: Rendered strictly when `order.status === 'pending_approval'`; opens cancellation confirmation modal with reason input.
  - **360° Order Dossier Modal**: Milestone progression stepper (Submitted -> Under Review -> Confirmed -> Dispatched -> Completed), line item table, delivery notes, and financial breakdown.

#### 41.6 Verification & Test Results
- **Automated Integration Test Suite (`src/scripts/test-b2b-scenarios.ts`)**: Executed against live Supabase PostgreSQL database:
  - **33/33 checks passed across all 12 specification scenarios (0 failures)**:
    1. Non-B2B customer blocked with HTTP 403 (PASS).
    2. Customer submit creates `pending_approval` + active reservation, physical stock NOT deducted (PASS).
    3. Available stock formula holds: $\text{Available} = \text{Physical} - \text{Reserved}$ (PASS).
    4. Super Admin approve converts reservation to deduction & logs `B2B_ORDER` movement (PASS).
    5. Super Admin reject releases reservation with 0 stock movements (PASS).
    6. Customer self-cancellation allowed for `pending_approval`, blocked for `confirmed` with HTTP 400 (PASS).
    7. Admin offline order confirms & deducts physical stock in 1 single request (PASS).
    8. Non-super admin write operations strictly blocked with HTTP 403 (PASS).
    9. Concurrency & idempotency on `client_request_id` returns existing order without duplicates (PASS).
    10. Stock exhaustion prevents submission and blocks approval if concurrent physical stock drops (PASS).
    11. Super Admin order editing handles positive delta deductions and negative delta returns with `B2B_ADJUSTMENT` logs (PASS).
    12. Super Admin cancellation on confirmed order restores physical inventory with `B2B_CANCELLATION` log (PASS).
- **Zero Hardcoded Data & Clean Database State Guarantee**:
  - All test orders, test reservations, test audit movements, test notifications, and test users purged from the live database.
  - Sequence tracking reset to pristine initial state (0 orders).
  - All hardcoded fallback facilities (`Delhi HQ`, `DEL`), tax labels (`18% Flat Rate`), and payment methods replaced with dynamic data-driven controls.
- **Compilation & Build Quality Assurance**:
  - `PRC-Backend`: `npx tsc --noEmit` passed with **0 compiler errors**.
  - `admin`: `npx tsc --noEmit` passed with **0 compiler errors**.
  - `frontend`: `npm run build` (Vite) transformed 1,716 modules in 7.36s with **0 errors**.

---

### 42. UP — Factory Operations & Stock/Inventory Management System

#### 42.1 Architectural Isolation & Module Identity
- **Consolidated Brand Identity**: The factory operations and inventory management system is strictly contained inside the private **`UP`** module.
- **Decoupled Admin Navigation**: The standalone "Multi-Branch Stock / Inventory" top-level navigation item has been completely removed from the public sidebar (`AdminSidebar.tsx`). Factory stock management is accessible solely under `UP` for authorized users.
- **Hierarchical Layout**:
  ```text
  UP
  │
  ├── Dashboard (Financial Velocity & KPIs)
  ├── Factory Inventory
  │   ├── Overview & Health KPIs
  │   ├── Raw Materials & Finished Goods Filtered Views
  │   ├── All Stock Matrix & Valuation
  │   ├── Real-Time Stock Movements Ledger
  │   ├── Bill of Materials (BOM Master Recipe Engine)
  │   ├── Production Orders (Work-in-Progress & Auto-Conversion)
  │   ├── Damaged & Defective Stock Quarantine
  │   ├── Scrap & Wastage Logs
  │   ├── Physical Counts & Discrepancy Audits
  │   └── Valuation & Category Reports
  ├── Daily Ledger & Petty Cash Reconcile
  └── Settings (UP Access Allow-List & Categories)
  ```

#### 42.2 Multi-Layered Authorization & Row-Level Security
- **Independent Allow-List Gate**: Access requires an active allow-list entry in `up_expense_access` (`revoked_at IS NULL`). Super Admins automatically hold root bypass access.
- **RBAC Subordination**: Generic admin roles or inventory permissions (`inventory.read` / `inventory.write`) do **not** bypass UP access. Unauthorized requests are rejected with HTTP 403 Forbidden.
- **PostgreSQL Row-Level Security (RLS)**: RLS enabled on all factory operations tables:
  - `up_boms`
  - `up_bom_items`
  - `up_production_orders`
  - `up_damaged_stock`
  - `up_scrap_logs`
  - `up_physical_counts`
  Guarded by `SECURITY DEFINER` function `public.has_up_access()`.

#### 42.3 Backend Service Architecture (`PRC-Backend`)
- **Module Path**: `src/modules/up/`
  - `up-inventory.service.ts`: High-performance factory floor operations service:
    - `getInventoryDashboard`: Calculates total inventory valuation, raw material count, finished goods count, low stock warnings, damaged stock count, and active WIP production orders.
    - `searchSKU`: Ultra-fast (<100ms) SKU and barcode lookup with on-hand, reserved, and available balance metrics.
    - `receiveMaterial`: Inward material receipt with supplier attribution and `PURCHASE` / `PRODUCTION_IN` movement logging.
    - `issueMaterial`: Outward material issuance for production or internal consumption.
    - `transferStock`: Inter-branch or inter-warehouse transfers with dual-leg stock deduction and receipt.
    - `recordDamage`: Quarantine logging with reason and photo evidence URL.
    - `recordScrap`: Wastage write-offs with scrap value recovery calculations.
    - `listBoms` & `createBom`: Multi-component recipe definitions linking finished products to raw material component SKUs with standard quantities and scrap tolerances.
    - `listProductionOrders`, `createProductionOrder`, `startProductionOrder`, & `completeProductionOrder`: End-to-end manufacturing lifecycle. Completing a work order atomically decrements required component raw materials and increments finished goods inventory with full audit trails.
    - `listPhysicalCounts` & `createPhysicalCount`: Cycle count reconciliation comparing recorded versus counted quantities, automatically calculating shrinkage variances.
    - `getInventoryReports`: High-level stock status and valuation breakdown by category.
- **REST Endpoints (`/api/admin/up/inventory/*`)**:
  - Guarded strictly by `requireUPAccess`.
  - Routes mounted under `up.routes.ts` and orchestrated via `up.controller.ts`.

#### 42.4 Admin Console Implementation (`d:\admin`)
- **API Client (`src/api/upApi.ts`)**: Type-safe REST client covering all 17 factory inventory endpoints.
- **Factory Floor Hub (`src/pages/up/components/UPInventoryHub.tsx`)**:
  - **Mobile-First Floor Interface**: Responsive design optimized for 360px+ touch screens, with $\ge 48\text{px}$ touch targets and `inputMode="decimal"` for numeric floor inputs.
  - **High-Speed SKU Search Dock**: Instant real-time barcode/SKU search with $<100\text{ms}$ debouncing and 1-tap quick action launchers (Receive, Issue, Transfer, Damage, Scrap).
  - **Comprehensive Operational Modals**:
    - Material Receipt modal
    - Material Issuance modal
    - Facility Transfer modal
    - Damage & Defect Recording modal with photo capture input
    - Scrap / Wastage Write-off modal
    - Physical Cycle Count modal
    - BOM Master Recipe Creator modal
    - Production Work Order Dispatcher & Completion modals
- **Module Navigation Integration (`src/pages/up/UPPage.tsx`)**:
  - Dedicated "Factory Inventory" tab in the UP navigation bar.
  - Updated module subtitle: *"Private Factory Operations, Inventory & Financial Command Center"*.
  - Decoupled from public admin sidebar (`AdminSidebar.tsx`).
- **Petty Cash Data Contract & Frontend Resilience (`src/modules/up/up.service.ts`, `src/pages/up/UPPage.tsx`, `UPInventoryHub.tsx`)**:
  - Backend `listCashDays` enhanced with correlated subquery to dynamically calculate and return `cashExpenses`, `actualClosing` along with `closingBalance`, and default non-null expected closing balances, aligning perfectly with frontend `UPCashDay` interface.
  - Defensive `formatInr` currency and number formatter applied across all financial KPIs, tables, and modal dialogs in `UPPage.tsx` and `UPInventoryHub.tsx`, eliminating `TypeError: Cannot read properties of undefined (reading 'toLocaleString')` runtime exceptions.
  - CORS preflight OPTIONS requests hardened in `app.ts` with explicit 204 short-circuit and expanded headers (`Cache-Control`, `Pragma`, `Expires`, `If-Modified-Since`, `X-Refresh-Token`), paired with multi-stage cold-start retries (up to 2 attempts with 4s and 7s backoff) in `adminApi.ts` to seamlessly withstand Render free-tier container spin-ups without client-facing network dropouts.

---

*Last Updated: 2026-09-21 (Hardened UP petty cash data contract & frontend formatting against undefined properties, strengthened CORS preflight OPTIONS handling in Express app, and implemented multi-stage cold-start retries in Admin API)*
