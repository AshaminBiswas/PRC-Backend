import { Request, Response } from 'express';
import { env } from './env';

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Pacific Hardware Enterprise REST API',
    version: '1.2.0',
    description:
      'Official REST API for Pacific Hardware Enterprise — covering multi-venture architectural hardware distribution, B2B customer custom pricing matrix, inventory logistics, warehouse allocation, 2FA TOTP authentication, RBAC permissions, offline POS registers, and GST invoicing.',
    contact: {
      name: 'Pacific Hardware Engineering & Cloud Infrastructure',
      email: 'tech@pacifichardware.com',
      url: 'https://pacifichardware.com',
    },
  },
  servers: [
    {
      url: 'https://prc-backend-6sw7.onrender.com/api/v1',
      description: 'Render Cloud Production Server',
    },
    {
      url: `http://localhost:${env.PORT}${env.API_PREFIX}`,
      description: 'Local Development Server',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT access token obtained from /auth/login or /auth/admin/login.',
      },
    },
    schemas: {
      ApiResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'object' },
          message: { type: 'string', example: 'Operation completed successfully' },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string', example: 'Invalid parameter or schema validation failed' },
              details: { type: 'array', items: { type: 'object' } },
            },
          },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          phone: { type: 'string', nullable: true },
          companyName: { type: 'string', nullable: true },
          gstin: { type: 'string', nullable: true },
          status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'] },
          role: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              slug: { type: 'string' },
            },
          },
        },
      },
      B2BCustomerPriceItem: {
        type: 'object',
        properties: {
          productId: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          sku: { type: 'string' },
          thumbnail: { type: 'string', nullable: true },
          categoryName: { type: 'string' },
          standardPrice: { type: 'number', example: 1200 },
          hasCustomPrice: { type: 'boolean', example: true },
          customPrice: { type: 'number', example: 980 },
          minQuantity: { type: 'integer', example: 10 },
          notes: { type: 'string', nullable: true },
          discountPercent: { type: 'number', example: 18.33 },
        },
      },
      OrderAllocationRequest: {
        type: 'object',
        required: ['pincode'],
        properties: {
          pincode: { type: 'string', example: '560058' },
          strategy: { type: 'string', enum: ['ROAD_DISTANCE', 'HAVERSINE', 'EWAY_BILL'], default: 'ROAD_DISTANCE' },
          reserveStock: { type: 'boolean', default: false },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                productId: { type: 'string', format: 'uuid' },
                sku: { type: 'string' },
                quantity: { type: 'integer', example: 1 },
              },
            },
          },
        },
      },
    },
  },
  paths: {
    // ─── 1. System & Health ──────────────────────────────────────────────────
    '/health': {
      get: {
        summary: 'System Health Check',
        tags: ['1. System & Diagnostics'],
        responses: {
          '200': { description: 'API server is healthy and operational' },
        },
      },
    },
    '/ready': {
      get: {
        summary: 'Database & Service Readiness Probe',
        tags: ['1. System & Diagnostics'],
        responses: {
          '200': { description: 'Prisma database and Redis connections are ready' },
        },
      },
    },
    '/metrics': {
      get: {
        summary: 'Prometheus Exposition Metrics',
        tags: ['1. System & Diagnostics'],
        responses: {
          '200': { description: 'Prometheus metrics text format' },
        },
      },
    },

    // ─── 2. Authentication & 2FA ─────────────────────────────────────────────
    '/auth/register': {
      post: {
        summary: 'Register New Customer Account (B2C Retail or B2B Wholesale Client)',
        tags: ['2. Authentication & Security'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'confirmPassword', 'firstName', 'lastName', 'phone'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'client@contracting.com' },
                  password: { type: 'string', minLength: 8, example: 'SecurePass@123' },
                  confirmPassword: { type: 'string', example: 'SecurePass@123' },
                  firstName: { type: 'string', example: 'Vikram' },
                  lastName: { type: 'string', example: 'Mehta' },
                  phone: { type: 'string', example: '9876543210' },
                  accountType: { type: 'string', enum: ['B2C', 'B2B'], default: 'B2C' },
                  companyName: { type: 'string', example: 'Mehta Hardware & Builders Ltd' },
                  gstin: { type: 'string', example: '29ABCDE1234F1Z5' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Registration successful. OTP verification code sent to email.' },
          '409': { description: 'Email address already in use.' },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Customer & User Login',
        tags: ['2. Authentication & Security'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'customer@gmail.com' },
                  password: { type: 'string', example: 'Password@123' },
                  rememberMe: { type: 'boolean', default: false },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Successfully authenticated, returns accessToken and refreshToken.' },
          '401': { description: 'Invalid email or password.' },
        },
      },
    },
    '/auth/admin/login': {
      post: {
        summary: 'Executive Admin & Staff Login (with 2FA TOTP Verification)',
        tags: ['2. Authentication & Security'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'admin@pacifichardware.com' },
                  password: { type: 'string', example: 'AdminPassword123!' },
                  twoFactorCode: { type: 'string', example: '123456', description: 'Optional 6-digit TOTP code' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Admin login successful or returns requires2FA with temporary mfaToken.' },
          '401': { description: 'Invalid admin credentials or invalid 2FA code.' },
        },
      },
    },
    '/auth/2fa/login': {
      post: {
        summary: 'Complete 2FA Login with Temporary mfaToken & TOTP Code',
        tags: ['2. Authentication & Security'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['mfaToken', 'code'],
                properties: {
                  mfaToken: { type: 'string', description: 'Temporary token issued during admin login' },
                  code: { type: 'string', example: '584920', description: '6-digit authenticator TOTP code' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: '2FA code verified, admin session tokens issued.' },
        },
      },
    },
    '/auth/2fa/setup': {
      post: {
        summary: 'Generate 2FA TOTP Secret Key & QR Code Data URL',
        tags: ['2. Authentication & Security'],
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Returns base32 secret, otpauth URI, and QR code image URL.' },
        },
      },
    },
    '/auth/2fa/verify': {
      post: {
        summary: 'Verify and Activate 2FA TOTP Protection for Account',
        tags: ['2. Authentication & Security'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['code'],
                properties: { code: { type: 'string', example: '584920' } },
              },
            },
          },
        },
        responses: {
          '200': { description: '2FA protection activated successfully.' },
        },
      },
    },
    '/auth/2fa/disable': {
      post: {
        summary: 'Disable Two-Factor Authentication',
        tags: ['2. Authentication & Security'],
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: '2FA disabled successfully.' },
        },
      },
    },
    '/auth/2fa/status': {
      get: {
        summary: 'Get 2FA Activation Status for Authenticated User',
        tags: ['2. Authentication & Security'],
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Returns isTwoFactorEnabled flag and configuration details.' },
        },
      },
    },
    '/auth/me': {
      get: {
        summary: 'Get Current Authenticated User Profile',
        tags: ['2. Authentication & Security'],
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Current user profile with role permissions.' },
        },
      },
    },
    '/auth/refresh-token': {
      post: {
        summary: 'Refresh Expired JWT Access Token',
        tags: ['2. Authentication & Security'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refreshToken'],
                properties: { refreshToken: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          '200': { description: 'New JWT access token issued.' },
        },
      },
    },
    '/auth/logout': {
      post: {
        summary: 'Logout and Invalidate Session Tokens',
        tags: ['2. Authentication & Security'],
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Logged out successfully.' },
        },
      },
    },

    // ─── 3. B2B Customer Custom Pricing Matrix ────────────────────────────────
    '/b2b-pricing/customer/{userId}': {
      get: {
        summary: 'Get Complete Catalog with Custom B2B Rates for Customer',
        tags: ['3. B2B Customer Custom Pricing'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'userId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, description: 'B2B Customer User ID' },
        ],
        responses: {
          '200': {
            description: 'Returns products catalog with standard price, custom B2B rate, and discount %',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } },
          },
        },
      },
      post: {
        summary: 'Set / Update Single Product Custom B2B Price',
        tags: ['3. B2B Customer Custom Pricing'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'userId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['productId', 'price'],
                properties: {
                  productId: { type: 'string', format: 'uuid' },
                  price: { type: 'number', example: 850 },
                  minQuantity: { type: 'integer', default: 1, example: 5 },
                  notes: { type: 'string', example: 'Contract rate Q3 2026' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Custom product rate saved.' },
        },
      },
    },
    '/b2b-pricing/customer/{userId}/bulk': {
      post: {
        summary: 'Bulk Set Multiple Product Custom Prices for B2B Client',
        tags: ['3. B2B Customer Custom Pricing'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'userId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['prices'],
                properties: {
                  prices: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['productId', 'price'],
                      properties: {
                        productId: { type: 'string', format: 'uuid' },
                        price: { type: 'number', example: 750 },
                        minQuantity: { type: 'integer', default: 1 },
                        notes: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Bulk custom prices updated successfully.' },
        },
      },
    },
    '/b2b-pricing/customer/{userId}/discount': {
      post: {
        summary: 'Apply Flat Percentage Discount Across Catalog or Category',
        tags: ['3. B2B Customer Custom Pricing'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'userId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['discountPercent'],
                properties: {
                  discountPercent: { type: 'number', example: 15, description: '% discount off standard retail catalog' },
                  categoryId: { type: 'string', format: 'uuid', description: 'Optional: target specific category only' },
                  minQuantity: { type: 'integer', default: 1 },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Flat discount calculated and applied to all products.' },
        },
      },
    },
    '/b2b-pricing/customer/{userId}/{productId}': {
      delete: {
        summary: 'Remove Custom Price (Reverts Product Back to Standard Retail)',
        tags: ['3. B2B Customer Custom Pricing'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'userId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'productId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': { description: 'Custom price removed. Product reverted to retail catalog price.' },
        },
      },
    },
    '/b2b-pricing/my-pricing': {
      get: {
        summary: 'Get Negotiated Contract Prices (For Logged-In B2B Client)',
        tags: ['3. B2B Customer Custom Pricing'],
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Returns active custom rates for current logged-in B2B account.' },
        },
      },
    },

    // ─── 4. Users & Customer Management ──────────────────────────────────────
    '/users': {
      get: {
        summary: 'List All Users & Customers (Paginated, Search, Filters)',
        tags: ['4. Users & Customer Management'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'role', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'] } },
        ],
        responses: {
          '200': { description: 'Paginated user list with role & company details.' },
        },
      },
      post: {
        summary: 'Create New User, Staff Admin, or B2B Customer Account',
        tags: ['4. Users & Customer Management'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'firstName', 'lastName', 'roleId'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                  firstName: { type: 'string' },
                  lastName: { type: 'string' },
                  phone: { type: 'string' },
                  companyName: { type: 'string' },
                  gstin: { type: 'string' },
                  roleId: { type: 'string', format: 'uuid' },
                  status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'User account created.' },
        },
      },
    },
    '/users/{id}': {
      get: {
        summary: 'Get User Account Profile by ID',
        tags: ['4. Users & Customer Management'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'User profile details.' } },
      },
      patch: {
        summary: 'Update User Details, Company, GSTIN, and Role',
        tags: ['4. Users & Customer Management'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  firstName: { type: 'string' },
                  lastName: { type: 'string' },
                  phone: { type: 'string' },
                  companyName: { type: 'string' },
                  gstin: { type: 'string' },
                  roleId: { type: 'string', format: 'uuid' },
                  status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'] },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'User profile updated.' } },
      },
      delete: {
        summary: 'Delete User Account',
        tags: ['4. Users & Customer Management'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'User account deleted.' } },
      },
    },

    // ─── 5. Roles & RBAC Matrix ──────────────────────────────────────────────
    '/roles': {
      get: {
        summary: 'List All Roles with User Counts',
        tags: ['5. Roles & RBAC Matrix'],
        security: [{ BearerAuth: [] }],
        responses: { '200': { description: 'List of all system and custom roles.' } },
      },
      post: {
        summary: 'Create New Custom System Role',
        tags: ['5. Roles & RBAC Matrix'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', example: 'Contract Estimator' },
                  description: { type: 'string', example: 'Calculates bulk pricing and approves quotes' },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Role created.' } },
      },
    },
    '/roles/{id}': {
      get: {
        summary: 'Get Role Details and Assigned Permissions',
        tags: ['5. Roles & RBAC Matrix'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Role details with permissions array.' } },
      },
      patch: {
        summary: 'Update Role Name and Description',
        tags: ['5. Roles & RBAC Matrix'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Role updated.' } },
      },
      delete: {
        summary: 'Delete Custom Role',
        tags: ['5. Roles & RBAC Matrix'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Role deleted.' } },
      },
    },
    '/roles/{id}/permissions': {
      patch: {
        summary: 'Replace Role Assigned Permissions Set',
        tags: ['5. Roles & RBAC Matrix'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['permissions'],
                properties: {
                  permissions: {
                    type: 'array',
                    items: { type: 'string' },
                    example: ['products.read', 'quotes.read', 'quotes.create'],
                  },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Permissions saved to role.' } },
      },
    },
    '/roles/permissions': {
      get: {
        summary: 'List All Available System Permissions Grouped by Module',
        tags: ['5. Roles & RBAC Matrix'],
        security: [{ BearerAuth: [] }],
        responses: { '200': { description: 'All permission definitions grouped by module.' } },
      },
    },

    // ─── 6. Categories & Products ────────────────────────────────────────────
    '/categories': {
      get: {
        summary: 'List Categories Catalog',
        tags: ['6. Categories Catalog'],
        responses: { '200': { description: 'List of product categories.' } },
      },
      post: {
        summary: 'Create New Category',
        tags: ['6. Categories Catalog'],
        security: [{ BearerAuth: [] }],
        responses: { '201': { description: 'Category created.' } },
      },
    },
    '/products': {
      get: {
        summary: 'List Hardware Products Catalog (Filterable & Searchable)',
        tags: ['7. Products Catalog'],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'categoryId', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'DRAFT'] } },
        ],
        responses: { '200': { description: 'Hardware products list.' } },
      },
      post: {
        summary: 'Create New Hardware Product',
        tags: ['7. Products Catalog'],
        security: [{ BearerAuth: [] }],
        responses: { '201': { description: 'Product created.' } },
      },
    },
    '/products/{id}': {
      get: {
        summary: 'Get Product Details by ID or Slug',
        tags: ['7. Products Catalog'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Product details.' } },
      },
      patch: {
        summary: 'Update Product Information and Pricing',
        tags: ['7. Products Catalog'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Product updated.' } },
      },
      delete: {
        summary: 'Delete Product',
        tags: ['7. Products Catalog'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Product deleted.' } },
      },
    },

    // ─── 8. Orders, Cart & Quotes ────────────────────────────────────────────
    '/orders': {
      get: {
        summary: 'List Customer Orders (Paginated & Filterable)',
        tags: ['8. Orders & Fulfillment'],
        security: [{ BearerAuth: [] }],
        responses: { '200': { description: 'Orders list.' } },
      },
      post: {
        summary: 'Place New Customer Order',
        tags: ['8. Orders & Fulfillment'],
        security: [{ BearerAuth: [] }],
        responses: { '201': { description: 'Order created.' } },
      },
    },
    '/quotes': {
      get: {
        summary: 'List B2B Request for Quotations (RFQs)',
        tags: ['9. B2B Quotes Engine'],
        security: [{ BearerAuth: [] }],
        responses: { '200': { description: 'Quotations list.' } },
      },
      post: {
        summary: 'Submit B2B Bulk Price Quotation Request',
        tags: ['9. B2B Quotes Engine'],
        security: [{ BearerAuth: [] }],
        responses: { '201': { description: 'Quote request submitted.' } },
      },
    },

    // ─── 10. Storefront CMS & Banners ────────────────────────────────────────
    '/banners': {
      get: {
        summary: 'List Storefront Hero Banners & Promotional Sliders',
        tags: ['10. Storefront Banners & CMS'],
        responses: { '200': { description: 'Banners list ordered by position.' } },
      },
      post: {
        summary: 'Create New Storefront Hero Banner',
        tags: ['10. Storefront Banners & CMS'],
        security: [{ BearerAuth: [] }],
        responses: { '201': { description: 'Banner created.' } },
      },
    },
    '/banners/{id}': {
      get: {
        summary: 'Get Banner Details by ID',
        tags: ['10. Storefront Banners & CMS'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Banner details.' } },
      },
      patch: {
        summary: 'Update Banner Images, Titles, Links, and Status',
        tags: ['10. Storefront Banners & CMS'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Banner updated.' } },
      },
      delete: {
        summary: 'Delete Banner',
        tags: ['10. Storefront Banners & CMS'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Banner deleted.' } },
      },
    },

    // ─── 11. Invoices & GST Finance ──────────────────────────────────────────
    '/invoices': {
      get: {
        summary: 'List Automated GST Tax Invoices',
        tags: ['11. Invoices & GST Finance'],
        security: [{ BearerAuth: [] }],
        responses: { '200': { description: 'Invoices list with financial breakdowns.' } },
      },
      post: {
        summary: 'Generate New GST Tax Invoice / Commercial Document',
        tags: ['11. Invoices & GST Finance'],
        security: [{ BearerAuth: [] }],
        responses: { '201': { description: 'Invoice generated.' } },
      },
    },

    // ─── 12. Warehouse Logistics & Stock Allocation ──────────────────────────
    '/allocation/allocate': {
      post: {
        summary: 'Determine Nearest Fulfillment Warehouse for PIN Code',
        tags: ['12. Warehouse Logistics & Allocation'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/OrderAllocationRequest' } } },
        },
        responses: { '200': { description: 'Allocated nearest warehouse based on requested strategy.' } },
      },
    },
  },
};

export const serveDocsJson = (_req: Request, res: Response): void => {
  res.setHeader('Content-Type', 'application/json');
  res.json(openApiSpec);
};

export const serveDocsUi = (_req: Request, res: Response): void => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Pacific Hardware Enterprise API Portal</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    body { margin: 0; padding: 0; background: #0f172a; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .header-banner { text-align: center; padding: 28px 20px; background: linear-gradient(135deg, #1e293b, #09090b); color: #a855f7; border-bottom: 2px solid #8b5cf6; }
    .header-banner h1 { margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
    .header-banner p { margin: 8px 0 0 0; color: #94a3b8; font-size: 13px; font-weight: 500; }
    #swagger-ui { max-width: 1280px; margin: 20px auto; background: #ffffff; padding: 24px; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3); }
    .swagger-ui .topbar { display: none; }
  </style>
</head>
<body>
  <div class="header-banner">
    <h1>Pacific Hardware Enterprise API Documentation</h1>
    <p>OpenAPI 3.0 Interactive Developer Portal • Version 1.2.0 • Render Cloud Gateway & Local Dev</p>
  </div>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: '${env.API_PREFIX}/docs.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout"
      });
    };
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
};
