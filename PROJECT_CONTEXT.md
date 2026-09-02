# PRC Hardware - Comprehensive Architecture & Project Context

> **CRITICAL PROTOCOL FOR ALL AI AGENTS & DEVELOPERS**:
> 1. **Read this file FIRST** before planning or executing any tasks across `PRC-Backend`, `admin`, or `frontend`.
> 2. **Update this file** whenever you add, modify, or delete any models, API routes, modules, UI pages, services, or system workflows.
> 3. Ensure all changes maintain strict end-to-end consistency across the Backend API, Admin Console, and Customer Storefront.

---

## 1. System Ecosystem Overview

The PRC Hardware platform consists of three core sub-projects located under `D:\`:

```
D:\
├── PRC-Backend/    # Express + TypeScript + Prisma REST API Backend (Port 5000)
├── admin/          # React + Vite + Tailwind Admin Console Dashboard (Port 5173/5174)
└── frontend/       # React + Vite + Tailwind Customer E-Commerce Storefront (Port 5175/3000)
```

---

## 2. Technology Stack & Infrastructure

### 2.1 Backend (`PRC-Backend`)
- **Runtime & Language**: Node.js (>= 18), TypeScript (Strict mode), Express.js.
- **ORM & Database**: Prisma Client `v5.22.0`, PostgreSQL (Hosted on Supabase).
- **Database Connection Architecture**:
  - `DATABASE_URL`: Supabase Transaction Pooler via PgBouncer on port `6543` (`?pgbouncer=true`). Used for application queries.
  - `DIRECT_URL`: Supabase Direct Session Pooler on port `5432`. Required for DDL migrations and schema changes.
- **Database Self-Healing**: `src/scripts/fix-db.js` runs automatically on `npm start` to idempotently patch missing columns and indexes before Express boots.
- **Caching & KV**: Upstash Redis (REST HTTP client) and `ioredis`.
- **Background Jobs & Queues**: BullMQ worker queues for async jobs, emails, and batch processing (`src/queues/bullmq.worker.ts`).
- **Real-Time Communication**: Server-Sent Events (SSE) at `/api/v1/notifications/stream` and internal `eventBus` (`src/events/eventBus.ts`).
- **Authentication**: JWT (Access + Refresh tokens), 2FA TOTP (Speakeasy + QR codes), Email OTP, RBAC with granular permissions.
- **Payments**: Razorpay SDK and PhonePe Gateway integration with webhook signature verification.
- **Invoicing & GST**: Indian GST tax engine (Intrastate CGST+SGST, Interstate IGST), HSN/SAC code mapping, IRN / E-Invoice readiness.

### 2.2 Admin Console (`D:\admin`)
- **Framework**: React 18, Vite 6, TypeScript.
- **Styling**: Tailwind CSS, Radix UI primitives, Lucide React icons.
- **Mobile Native App & PWA Architecture**:
  - Viewport-fit cover, theme color `#18181B`, standalone mobile web app capability (`apple-mobile-web-app-capable`).
  - Persistent Mobile Bottom Navigation Dock (`AdminLayout.tsx`) with 5 core tabs (Dashboard, Orders, Products, Quotes, All Views Drawer) and safe-area padding (`pb-24 sm:pb-6`).
  - Dual-mode responsive view architecture across all core operational hubs (`sm:hidden` touch cards + `hidden sm:block` full tables):
    - **Dashboard (`DashboardPage.tsx`)**: 2x2 mobile metric cards, responsive charts, live recent order cards.
    - **Orders Management (`OrdersPage.tsx`)**: Mobile order cards with customer details, order type badges, amount, and responsive modals.
    - **Products Hub (`ProductsPage.tsx`)**: Mobile product cards with thumbnail, SKU, live stock badge, selling price, and quick action drawer triggers.
    - **B2B Quotations Pipeline (`QuotesPage.tsx`)**: Mobile RFQ cards with reference numbers, company info, totals, status pills, and 1-tap PDF downloads.
    - **B2B Custom Pricing Matrix (`B2BPricingPage.tsx`)**: Mobile touch override cards with standard MRP vs custom B2B rate input, MOQ stepper, and live margin badges.
    - **GST Tax Invoice Hub (`InvoiceListView.tsx`)**: Mobile invoice stream with legal name, GSTIN, tax breakdown, and instant PDF action buttons.
    - **PO Management & Email Workspace (`POManagementPage.tsx`, `PODetailPage.tsx`)**: Inbound email pipeline, 4 classification tabs, and dedicated full-page email dossier with interactive HTML viewer, threaded customer replies, attachment galleries, and timeline audit logs.
    - **Customer Accounts Directory (`UsersPage.tsx`)**: Mobile customer cards with contact chips, B2B enterprise details, and role badges.
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

---

## 3. Database Schema & Prisma Models (`prisma/schema.prisma`)

### Core Models Registry (60 Active Models):

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
    - `Inventory`: Branch-wise physical and reserved quantity per SKU with reorder thresholds (`quantity`, `reservedQuantity`, `reorderLevel`). `@@unique([productId, branchId])`.
    - `Purchase` & `PurchaseItem`: Stock-in procurement ledger ("Kahan Se Kharida") capturing supplier, invoice number, purchase date, unit costs, and total procurement spend.
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
    - `ProformaInvoice` & `ProformaInvoiceItem`: Commercial advance demand invoices (`piNumber`, `financialYear`, `sequenceNo`, `status`, `subtotal`, `taxableAmount`, `cgst`, `sgst`, `igst`, `grandTotal`, `advancePercentage`, `advanceAmount`, `balanceDue`, `paymentTerms`, `deliveryTimeline`, `validUntil`, `verificationToken`, `verificationId`, `documentHash`, `digitalSignature`, `signedBy`, `signedAt`, `qrCodeDataUrl`, `bankDetails`).
    - `ProformaInvoiceHistory` & `ProformaInvoiceSequence`: Atomic annual sequence tracking (`PRC/PI/2026-27/0001`) and chronological state transitions audit trail.

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
| `banners` | `/api/v1/banners` | Promotional hero banners, position targeting, CTR metrics |
| `cart` | `/api/v1/cart` | Shopping cart sync, item mutations, stock availability |
| `categories` | `/api/v1/categories` | Hierarchical category taxonomy & bestseller flags |
| `checkout` | `/api/v1/checkout` | Order calculation, tax computation, address validation |
| `cms` | `/api/v1/cms` | Dynamic pages, blogs, and FAQ content |
| `coupons` | `/api/v1/coupons` | Promo code validation, discounts, defensive self-healing |
| `dashboard` | `/api/v1/dashboard` | Admin executive analytics, revenue KPIs, growth rates |
| `enquiries` | `/api/v1/enquiries` | Customer tickets, contact queries, resolution workflow |
| `homepage` | `/api/v1/homepage` | Dynamic storefront layout sections & module ordering |
| `inventory` | `/api/v1/inventory` | Multi-branch stock tracking (Delhi/Kolkata), reserved quantities, threshold alerts |
| `branches` | `/api/v1/branches` | Physical facility registration, codes, addresses, activation status |
| `suppliers` | `/api/v1/suppliers` | Vendor directory, GSTIN tracking, contact dossiers |
| `purchases` | `/api/v1/purchases` | Stock-in procurement ledger ("Kahan Se Kharida"), unit pricing, purchase orders |
| `transfers` | `/api/v1/transfers` | Inter-branch transfers with reservation, dispatch, and receiving stages |
| `stock-adjustments` | `/api/v1/stock-adjustments` | Cycle count adjustments, damages, returns with mandatory reason audit |
| `stock-movements` | `/api/v1/stock-movements` | Immutable audit ledger of every inventory mutation across facilities |
| `invoices` | `/api/v1/invoices` | GST tax invoices, IRN generation, E-Invoicing, PDF export |
| `logistics` | `/api/v1/logistics` | Courier integration, waybill generation, SLA tracking |
| `notifications` | `/api/v1/notifications` | Real-time SSE event stream, user inbox, admin alerts |
| `orders` | `/api/v1/orders` | Full order lifecycle, status transitions, cancellation restock |
| `payments` | `/api/v1/payments` | Razorpay & PhonePe checkouts, webhooks, refund processing |
| `po-management` | `/api/v1/po-management` | Inbound business email ingestion, PO multi-factor classification, atomic sequence generator (`PRC-PO-YYYY-XXXXXX`), email threading, PO dossier management, customer storefront submissions (`POST /customer-submit` for Quotation-linked POs, Custom Form line-item composer, and Direct PO document uploads). |
| `proforma-invoices` | `/api/v1/proforma-invoices` | Dedicated B2B Proforma Invoice (PI) lifecycle suite — **Admin-Only Generation** (from scratch, Quotation, PO, or Order), atomic sequence generator (`PRC/PI/YYYY-YY/XXXX`), automated Indian GST computation, advance payment terms schedule, HMAC-SHA256 digital signing, high-density vector QR code generation, vector-branded A4 PDF export, public anti-tamper QR verification resolver, **Customer Self-Service API** (`GET /customer/my-proformas`), **Customer Storefront Portal** (`/pi/:token` & `/proforma/:token`), and **B2B Profile Proforma Section** (`UserProfilePage.tsx` tab) allowing verified B2B customers to review all their issued PIs, inspect commercial milestones, download official signed PDFs, and submit feedback/advance payment UTR references (customers cannot generate or request PIs from storefront). |
| `products` | `/api/v1/products` | Hardware SKU catalog, prices, specs, tags, filters |
| `quotes` | `/api/v1/quotes` | B2B bulk quotations, negotiations, approvals, PDF quotes |
| `reports` | `/api/v1/reports` | Financial & sales data exports (CSV, XLSX, PDF) |
| `reviews` | `/api/v1/reviews` | Product reviews, star ratings, moderation workflow |
| `roles` | `/api/v1/roles` | RBAC role definitions, permission matrix assignment |
| `search` | `/api/v1/search` | Search indexing, fuzzy matching, query analytics |
| `settings` | `/api/v1/settings` | System-wide configuration, company GSTIN, maintenance |
| `shipping` | `/api/v1/shipping` | Shipping zone calculation, pincode validation |
| `upload` | `/api/v1/upload` | Media asset upload manager, image optimization |
| `users` | `/api/v1/users` | Customer profiles, admin staff management, addresses |
| `variants` | `/api/v1/variants` | Product variant matrix (color, size, finish), SKUs |
| `wishlist` | `/api/v1/wishlist` | Customer saved wishlists & demand forecast tracking |
| `ai-agent` | `/api/v1/ai-agent` | **NVIDIA NIM AI Copilot** — `POST /chat` (admin copilot), `POST /draft-reply` (PO email drafter with stock context), `POST /report` (business analytics report generator). Model: `meta/llama-3.2-90b-vision-instruct`. Requires `NVIDIA_API_KEY` env var. Admin-only (`authenticate` + `authorize` guard). |

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
  1. **Full Permission CRUD Endpoints**:
     - `POST /api/v1/roles/permissions`: Create new discrete permissions with display name, module categorization, auto/custom key slug, and scope description.
     - `GET /api/v1/roles/permissions`: List all registered permissions grouped by module.
     - `PATCH /api/v1/roles/permissions/:id`: Update permission metadata (name, module, slug, description).
     - `DELETE /api/v1/roles/permissions/:id`: Permanently delete custom permissions and automatically cascade-revoke from assigned role junction tables.
  2. **Dual-Tab RBAC Command Center (`RolesPage.tsx`)**:
     - **Tab 1 ("Security Roles & Access Matrix")**: Select role, view assigned permissions count, toggle discrete or batch CRUD actions (All Create, All Read, All Update, All Delete), clone role templates, and quickly register new custom permissions directly via an in-matrix shortcut button without losing place.
     - **Tab 2 ("System & Custom Permissions Directory")**: Full searchable and filterable directory of all permissions with module chips, CRUD badges, code snippets with 1-click clipboard copy, and inline Edit & Delete modals for custom permissions.
- **Multi-Branch Live Stock, Concurrency-Guarded Sales & Catalog Search Engine (`inventory.service.ts`, `checkout.service.ts`, `orders.service.ts`, `ProductPicker.tsx`, `ProductsPage.tsx`, `InventoryPage.tsx`)**:
  1. **Atomic Concurrency-Guarded Sales Mutation (`recordSale`)**: Every customer order checkout automatically decrements branch stock with atomic guard conditions (`updateMany({ where: { productId, branchId, quantity: { gte: qty } } })`), rolls back the checkout transaction on stock exhaustion, creates immutable `StockMovement` records (`SALE_OUT`), synchronizes catalog totals (`syncProductStock`), and emits real-time `inventory.low_stock` alerts.
  2. **Order Cancellation & Return Restock (`recordRestock`)**: When orders are cancelled or returned, line items are automatically credited back to the fulfilling facility ledger as `RETURN_IN` movements with full audit rationale.
  3. **Single Source of Truth Stock Status (`getStockStatus`)**: Standardized calculation across backend API, Excel/PDF export services, and Admin UI views with consistent thresholds (`OUT_OF_STOCK`, `LOW_STOCK`, `IN_STOCK`).
  4. **Reusable Combobox (`ProductPicker.tsx`)**: Debounced server-side product lookup (300ms) with thumbnail, SKU, price, cross-branch total stock, and live facility-specific available-to-transfer check (`GET /inventory/product/:productId`) wired into Procurement (`PurchaseModal`), Transfers (`TransferModal` with pre-submit quantity validation), and Adjustments (`AdjustmentModal`).
  5. **Server-Side Catalog Search & Filtering (`ProductsPage.tsx`)**: Server-side pagination, debounced query search, quick filter pills (`All`, `In Stock`, `Out of Stock`, `Featured`, `Bestsellers`, `Offers`, `New Arrivals`), and real-time stock health badges.
  6. **Harmonized Admin Inventory UI Design System (`InventoryPage.tsx`)**: Modernized and aligned color palette and layout tokens to match the global Admin Console (`#8B5CF6` primary violet accent, `dark:bg-[#18181B]` surfaces, `dark:border-[#27272A]`, `dark:bg-[#09090B]` canvas, rounded-2xl cards, standard breadcrumbs, unified badge hierarchy, and styled modal forms).
  7. **Fulfillment Facilities & Branch Management (`InventoryPage.tsx`, `inventory.service.ts`, `fix-db.js`, `database.ts`)**: Added a 6th dedicated tab ("Fulfillment Facilities") in the Inventory Hub and "+ Add Facility" / "+ New Facility" action controls. Admins can view all physical branch depots, register new facilities (name, 2-6 char uppercase code, city, state, full address, active status toggle), edit facility details, and auto-initialize 0-quantity catalog inventory records across all active products. Database auto-healers (`fix-db.js` and `database.ts`) maintain both camelCase and snake_case column aliases (`isActive`, `createdAt`, `updatedAt`, `deletedAt`) to ensure zero-downtime database synchronization.
  8. **Quick Stock Entry & Flexible Line Items (`InventoryPage.tsx`, `inventory.service.ts`, `inventory.routes.ts`)**:
     - `POST /api/v1/inventory/quick-stock`: Direct entry point to register brand new items by SKU, Name, Quantity, Facility (supporting `PRC_STOCK` central master allocation), Unit Cost, Selling Price, and Reorder Level in one step.
     - `Stock Matrix Tab`: Features a dedicated **Total Product Stock Sum** column calculating consolidated cross-branch stock product-by-product alongside branch-specific allocations. Includes a multi-field real-time filter toolbar (Product Name filter, SKU filter, Destination Facility dropdown, Stock Health Status dropdown, Category dropdown, Low-Stock toggle, and Clear Filters control).
     - `Seamless Catalog Merging`: Both backend (`listInventory`) and client API (`inventoryApi.getInventory`) seamlessly cross-reference the Product catalog so all newly created SKUs and products immediately display in the Stock Matrix even before branch ledger rows are created.
     - `QuickStockModal`: Enhanced with `PRC STOCK (Central Allocation)` facility option, live SKU lookup, and dynamic **Product-Wise Total Stock Sum** calculation card showing existing warehouse stock + incoming quantity with instant optimistic state insertion.
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
  16. **Inventory Retention & Multi-Branch Excel Export System (`inventory.service.ts`, `inventory-export.service.ts`, `adminApi.ts`)**:
         - **Catalog Deletion Decoupling**: Soft-deleting or delisting a product from the catalog storefront no longer removes or hides physical stock from the Inventory Management Hub (`/inventory`). Warehouse stock balances, physical facility counts, purchase receipts, and historical audit ledger movements remain intact and fully manageable.
         - **Enterprise Excel (XLSX) Export Engine**:
           - Real binary `.xlsx` generation using `ExcelJS` on backend (`/inventory/export/excel`, `/purchases/export/excel`, `/stock-movements/export/excel`, `/reports/stock`, `/reports/purchases`, `/reports/movements`).
           - Stock Matrix Excel report features styled header bands, frozen panes, alternating row zebra striping, currency formatting (`₹#,##0.00`), stock status color-coding, and complete asset valuation columns: SKU, Product Name, Category, Facility / Branch, On-Hand Stock, Available Qty, Reserved Qty, Reorder Level, Unit Price (₹), Stock Value (₹), and Status.
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
    - `GET /verify/:token`: Public cryptographic verification resolver with multi-identifier resolution (supports token UUID, verification ID, PI number, document hash, or full URL).
    - `POST /validate-tamper`: Comprehensive Document Tamper Analysis Engine. Evaluates physical paper claims against database records and digital signatures, returning structured integrity verdicts (`AUTHENTIC`, `MANIPULATED`, `UNSIGNED_DRAFT`, `DOCUMENT_NOT_FOUND`).
    - `POST /public/:token/upload-receipt`: Public customer endpoint to upload bank payment screenshot (PNG, JPG, WEBP) or payment receipt PDF (up to 10MB) via `uploadAttachmentFile` cloud storage fallback pipeline.
    - `POST /public/:token/feedback`: Public customer acceptance & payment submission with UTR reference, contact phone, notes, and uploaded receipt URL.
    - `DELETE /:id`: Exclusive super admin void/delete endpoint for proforma records.
  - **Admin Console (`D:\admin`)**:
    - `QRDocumentValidatorPage.tsx` (`/qr-validator`): Full-featured QR Scanner & Document Tamper Validation Hub:
      - Live Camera Scanner (`navigator.mediaDevices` + `jsQR`) with viewfinder crosshair radar.
      - Image / Screenshot drag-and-drop QR decoding.
      - Physical Paper Forgery Inspector matrix (compares printed Total, Advance, GSTIN, Customer Name, and Item Count against database).
      - System-wide QR Registry of all issued commercial invoices with high-res 400px QR modal, print badges, and PDF download.
      - Real-time scan verification audit trail.
    - `ProformaInvoicesPage.tsx`: Full operational pipeline with 4 KPI cards (including Customer Accepted / Advance Remitted metrics), multi-facility routing, direct server binary PDF download, status filtering (`ACCEPTED`, `ADVANCE_RECEIVED`, `APPROVED`, `SENT`, `DRAFT`, `CONVERTED_TO_INVOICE`, `CANCELLED`), table status tags with customer acceptance indicators, quick QR Scanner launcher button, super admin delete action, and print view.
    - `ProformaInvoiceCreateView.tsx`: Enterprise creation form with B2B customer search, live customer custom pricing lookup, automatic customer address fetching, and GST calculation (CGST 9% + SGST 9% for Delhi; IGST 18% for other states).
    - `ProformaInvoiceDetailView.tsx`: Full PI dossier featuring live customer acceptance & advance remittance banner (`CheckCircle2`/`Landmark` dossier with UTR reference, customer comments, phone number, timestamp), payment proof preview card (with image thumbnail, direct PDF download, and full-screen image lightbox modal), complete immutable activity audit trail (`ProformaInvoiceHistory` timeline with receipt links), customer details, items breakdown, direct PDF download, super admin delete action, and SMTP email dispatch modal.
    - `proformaService.ts`: Robust API integration, server-side data mapping (`transformBackendInvoiceToPI` with `history`, `notes`, `termsAndConditions`), binary PDF streaming, and tamper validation.
  - **Storefront (`D:\frontend`)**:
    - `UserProfilePage.tsx`: Integrated B2B Proforma Invoices tab with search, status filters, financial breakdown, and 1-tap PDF downloads.
    - `CustomerProformaViewPage.tsx`: Public/authenticated verification and acceptance page (`/proforma/:token`) allowing clients to accept terms, submit bank advance transaction reference (UTR / IMPS / RTGS), upload payment screenshot or bank receipt PDF (up to 10MB with live preview), submit site remarks, and download official monochrome PDFs.
    - `VerifyProformaInvoicePage.tsx`: Public QR-code scan verification landing portal (`/verify/pi/:token`) checking cryptographic signature, tamper status, item summary, and financial authenticity.
    - `proformaInvoiceService.ts`: Direct client API service for fetching customer PIs, uploading payment receipt attachments, verifying QR scan tokens, and streaming PDFs.

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

---

*Last Updated: 2026-09-01 (Fixed PO services inbound email ingestion so automated alert emails are not sent to admin accounts like ejaj@pacificproduct.in; in-app notifications and real-time SSE events remain fully active for Admin Console)*


