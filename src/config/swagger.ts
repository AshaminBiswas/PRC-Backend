import { Request, Response } from 'express';
import { env } from './env';

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Pacific Hardware Enterprise REST API',
    version: '1.2.0',
    description:
      'Official REST API for Pacific Hardware Enterprise — covering 216 endpoints across multi-venture architectural hardware distribution, B2B customer custom pricing matrix, inventory logistics, warehouse allocation, 2FA TOTP authentication, RBAC permissions, offline POS registers, and GST invoicing.',
    contact: {
      name: 'Pacific Hardware Engineering',
      email: 'tech@pacifichardware.com',
      url: 'https://pacifichardware.com',
    },
  },
  servers: [
    {
      url: env.API_PREFIX,
      description: 'Current API Gateway Server (Relative)',
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
              message: { type: 'string', example: 'Invalid input parameters' },
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
  "/health": {
    "get": {
      "summary": "System Health Check Probe",
      "tags": [
        "1. System & Diagnostics"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      }
    }
  },
  "/ready": {
    "get": {
      "summary": "Database & Service Readiness Probe",
      "tags": [
        "1. System & Diagnostics"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      }
    }
  },
  "/metrics": {
    "get": {
      "summary": "Prometheus Metrics Output",
      "tags": [
        "1. System & Diagnostics"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      }
    }
  },
  "/auth/register": {
    "post": {
      "summary": "Register New Customer (B2C or B2B)",
      "tags": [
        "2. Authentication & Security"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "requestBody": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "email",
                "password",
                "firstName",
                "lastName",
                "phone"
              ],
              "properties": {
                "email": {
                  "type": "string",
                  "format": "email"
                },
                "password": {
                  "type": "string",
                  "minLength": 8
                },
                "confirmPassword": {
                  "type": "string"
                },
                "firstName": {
                  "type": "string"
                },
                "lastName": {
                  "type": "string"
                },
                "phone": {
                  "type": "string"
                },
                "accountType": {
                  "type": "string",
                  "enum": [
                    "B2C",
                    "B2B"
                  ],
                  "default": "B2C"
                },
                "companyName": {
                  "type": "string"
                },
                "gstin": {
                  "type": "string"
                }
              }
            }
          }
        }
      }
    }
  },
  "/auth/login": {
    "post": {
      "summary": "Customer & User Login",
      "tags": [
        "2. Authentication & Security"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "requestBody": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "email",
                "password"
              ],
              "properties": {
                "email": {
                  "type": "string",
                  "format": "email"
                },
                "password": {
                  "type": "string"
                },
                "rememberMe": {
                  "type": "boolean"
                }
              }
            }
          }
        }
      }
    }
  },
  "/auth/admin/login": {
    "post": {
      "summary": "Admin & Executive Staff Login with 2FA Check",
      "tags": [
        "2. Authentication & Security"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "requestBody": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "email",
                "password"
              ],
              "properties": {
                "email": {
                  "type": "string",
                  "format": "email"
                },
                "password": {
                  "type": "string"
                },
                "twoFactorCode": {
                  "type": "string"
                }
              }
            }
          }
        }
      }
    }
  },
  "/auth/2fa/login": {
    "post": {
      "summary": "Complete 2FA Login with Temporary mfaToken",
      "tags": [
        "2. Authentication & Security"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "requestBody": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "mfaToken",
                "code"
              ],
              "properties": {
                "mfaToken": {
                  "type": "string"
                },
                "code": {
                  "type": "string"
                }
              }
            }
          }
        }
      }
    }
  },
  "/auth/2fa/setup": {
    "post": {
      "summary": "Generate 2FA Secret Key & QR Code",
      "tags": [
        "2. Authentication & Security"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/auth/2fa/verify": {
    "post": {
      "summary": "Verify and Enable 2FA Protection",
      "tags": [
        "2. Authentication & Security"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "requestBody": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "code"
              ],
              "properties": {
                "code": {
                  "type": "string"
                }
              }
            }
          }
        }
      }
    }
  },
  "/auth/2fa/disable": {
    "post": {
      "summary": "Disable 2FA Protection",
      "tags": [
        "2. Authentication & Security"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/auth/2fa/status": {
    "get": {
      "summary": "Get 2FA Activation Status",
      "tags": [
        "2. Authentication & Security"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/auth/me": {
    "get": {
      "summary": "Get Current User Profile & Session",
      "tags": [
        "2. Authentication & Security"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/auth/refresh-token": {
    "post": {
      "summary": "Refresh JWT Access Token",
      "tags": [
        "2. Authentication & Security"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "requestBody": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "refreshToken"
              ],
              "properties": {
                "refreshToken": {
                  "type": "string"
                }
              }
            }
          }
        }
      }
    }
  },
  "/auth/logout": {
    "post": {
      "summary": "Logout and Invalidate Session Tokens",
      "tags": [
        "2. Authentication & Security"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/auth/change-password": {
    "post": {
      "summary": "Change Current User Password",
      "tags": [
        "2. Authentication & Security"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "requestBody": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "oldPassword",
                "newPassword"
              ],
              "properties": {
                "oldPassword": {
                  "type": "string"
                },
                "newPassword": {
                  "type": "string"
                }
              }
            }
          }
        }
      }
    }
  },
  "/auth/forgot-password": {
    "post": {
      "summary": "Request Password Reset Email",
      "tags": [
        "2. Authentication & Security"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "requestBody": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "email"
              ],
              "properties": {
                "email": {
                  "type": "string",
                  "format": "email"
                }
              }
            }
          }
        }
      }
    }
  },
  "/auth/reset-password": {
    "post": {
      "summary": "Reset Password with Reset Token",
      "tags": [
        "2. Authentication & Security"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "requestBody": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "token",
                "password"
              ],
              "properties": {
                "token": {
                  "type": "string"
                },
                "password": {
                  "type": "string"
                }
              }
            }
          }
        }
      }
    }
  },
  "/auth/verify-email": {
    "post": {
      "summary": "Verify Email Address Token",
      "tags": [
        "2. Authentication & Security"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "requestBody": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "token"
              ],
              "properties": {
                "token": {
                  "type": "string"
                }
              }
            }
          }
        }
      }
    }
  },
  "/auth/verify-otp": {
    "post": {
      "summary": "Verify OTP Code",
      "tags": [
        "2. Authentication & Security"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "requestBody": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "email",
                "otp"
              ],
              "properties": {
                "email": {
                  "type": "string"
                },
                "otp": {
                  "type": "string"
                }
              }
            }
          }
        }
      }
    }
  },
  "/auth/resend-verification": {
    "post": {
      "summary": "Resend Email Verification OTP",
      "tags": [
        "2. Authentication & Security"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "requestBody": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "email"
              ],
              "properties": {
                "email": {
                  "type": "string",
                  "format": "email"
                }
              }
            }
          }
        }
      }
    }
  },
  "/b2b-pricing/customer/{userId}": {
    "get": {
      "summary": "Get Customer Custom Pricing Matrix",
      "tags": [
        "3. B2B Custom Pricing"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "userId",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter userId"
        }
      ]
    },
    "post": {
      "summary": "Set Customer Product Custom Price",
      "tags": [
        "3. B2B Custom Pricing"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "requestBody": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "productId",
                "price"
              ],
              "properties": {
                "productId": {
                  "type": "string",
                  "format": "uuid"
                },
                "price": {
                  "type": "number"
                },
                "minQuantity": {
                  "type": "integer",
                  "default": 1
                },
                "notes": {
                  "type": "string"
                }
              }
            }
          }
        }
      },
      "parameters": [
        {
          "name": "userId",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter userId"
        }
      ]
    }
  },
  "/b2b-pricing/customer/{userId}/bulk": {
    "post": {
      "summary": "Bulk Set Customer Custom Prices",
      "tags": [
        "3. B2B Custom Pricing"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "requestBody": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "prices"
              ],
              "properties": {
                "prices": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "required": [
                      "productId",
                      "price"
                    ],
                    "properties": {
                      "productId": {
                        "type": "string",
                        "format": "uuid"
                      },
                      "price": {
                        "type": "number"
                      },
                      "minQuantity": {
                        "type": "integer"
                      },
                      "notes": {
                        "type": "string"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "parameters": [
        {
          "name": "userId",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter userId"
        }
      ]
    }
  },
  "/b2b-pricing/customer/{userId}/discount": {
    "post": {
      "summary": "Apply Flat Percentage Discount",
      "tags": [
        "3. B2B Custom Pricing"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "requestBody": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "discountPercent"
              ],
              "properties": {
                "discountPercent": {
                  "type": "number"
                },
                "categoryId": {
                  "type": "string",
                  "format": "uuid"
                },
                "minQuantity": {
                  "type": "integer"
                }
              }
            }
          }
        }
      },
      "parameters": [
        {
          "name": "userId",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter userId"
        }
      ]
    }
  },
  "/b2b-pricing/customer/{userId}/{productId}": {
    "delete": {
      "summary": "Remove Product Custom Price Override",
      "tags": [
        "3. B2B Custom Pricing"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "userId",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter userId"
        },
        {
          "name": "productId",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter productId"
        }
      ]
    }
  },
  "/b2b-pricing/my-pricing": {
    "get": {
      "summary": "Get Logged-In B2B Client Custom Prices",
      "tags": [
        "3. B2B Custom Pricing"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/users": {
    "get": {
      "summary": "List All Users (Paginated & Filterable)",
      "tags": [
        "4. Users & Customers"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    },
    "post": {
      "summary": "Create User / Admin / B2B Customer Account",
      "tags": [
        "4. Users & Customers"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "requestBody": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "email",
                "password",
                "firstName",
                "lastName",
                "roleId"
              ],
              "properties": {
                "email": {
                  "type": "string",
                  "format": "email"
                },
                "password": {
                  "type": "string"
                },
                "firstName": {
                  "type": "string"
                },
                "lastName": {
                  "type": "string"
                },
                "phone": {
                  "type": "string"
                },
                "companyName": {
                  "type": "string"
                },
                "gstin": {
                  "type": "string"
                },
                "roleId": {
                  "type": "string",
                  "format": "uuid"
                },
                "status": {
                  "type": "string",
                  "enum": [
                    "ACTIVE",
                    "INACTIVE"
                  ]
                }
              }
            }
          }
        }
      }
    }
  },
  "/users/profile": {
    "patch": {
      "summary": "Update Current User Profile",
      "tags": [
        "4. Users & Customers"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/users/avatar": {
    "patch": {
      "summary": "Update Current User Avatar URL",
      "tags": [
        "4. Users & Customers"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/users/activity": {
    "get": {
      "summary": "Get Current User Activity Logs",
      "tags": [
        "4. Users & Customers"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/users/orders": {
    "get": {
      "summary": "Get Current User Order History",
      "tags": [
        "4. Users & Customers"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/users/quotes": {
    "get": {
      "summary": "Get Current User Submitted Quotes",
      "tags": [
        "4. Users & Customers"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/users/reviews": {
    "get": {
      "summary": "Get Current User Product Reviews",
      "tags": [
        "4. Users & Customers"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/users/{id}": {
    "get": {
      "summary": "Get User Details by ID",
      "tags": [
        "4. Users & Customers"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    },
    "patch": {
      "summary": "Update User Details, Company, GSTIN & Status",
      "tags": [
        "4. Users & Customers"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    },
    "delete": {
      "summary": "Delete User Account",
      "tags": [
        "4. Users & Customers"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    }
  },
  "/users/{id}/roles": {
    "get": {
      "summary": "Get User Assigned Roles",
      "tags": [
        "4. Users & Customers"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    },
    "patch": {
      "summary": "Update User Assigned Roles",
      "tags": [
        "4. Users & Customers"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    }
  },
  "/roles": {
    "get": {
      "summary": "List All System Roles with Counts",
      "tags": [
        "5. Roles & RBAC"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    },
    "post": {
      "summary": "Create New Custom Role",
      "tags": [
        "5. Roles & RBAC"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "requestBody": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "name"
              ],
              "properties": {
                "name": {
                  "type": "string"
                },
                "description": {
                  "type": "string"
                }
              }
            }
          }
        }
      }
    }
  },
  "/roles/permissions": {
    "get": {
      "summary": "List All Available System Permissions",
      "tags": [
        "5. Roles & RBAC"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/roles/{id}": {
    "get": {
      "summary": "Get Role Details by ID",
      "tags": [
        "5. Roles & RBAC"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    },
    "patch": {
      "summary": "Update Role Name & Description",
      "tags": [
        "5. Roles & RBAC"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    },
    "delete": {
      "summary": "Delete Custom Role",
      "tags": [
        "5. Roles & RBAC"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    }
  },
  "/roles/{id}/permissions": {
    "patch": {
      "summary": "Update Role Assigned Permissions Set",
      "tags": [
        "5. Roles & RBAC"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "requestBody": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "permissions"
              ],
              "properties": {
                "permissions": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                }
              }
            }
          }
        }
      },
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    }
  },
  "/categories": {
    "get": {
      "summary": "List Product Categories",
      "tags": [
        "6. Categories Catalog"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      }
    },
    "post": {
      "summary": "Create New Category",
      "tags": [
        "6. Categories Catalog"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/categories/{id}": {
    "get": {
      "summary": "Get Category Details by ID",
      "tags": [
        "6. Categories Catalog"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    },
    "patch": {
      "summary": "Update Category Details",
      "tags": [
        "6. Categories Catalog"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    },
    "delete": {
      "summary": "Delete Category",
      "tags": [
        "6. Categories Catalog"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    }
  },
  "/products": {
    "get": {
      "summary": "List Products Catalog (Paginated & Filterable)",
      "tags": [
        "7. Products & Variants"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      }
    },
    "post": {
      "summary": "Create New Hardware Product",
      "tags": [
        "7. Products & Variants"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/products/{id}": {
    "get": {
      "summary": "Get Product Details by ID or Slug",
      "tags": [
        "7. Products & Variants"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    },
    "patch": {
      "summary": "Update Product Information",
      "tags": [
        "7. Products & Variants"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    },
    "delete": {
      "summary": "Delete Product",
      "tags": [
        "7. Products & Variants"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    }
  },
  "/products/{productId}/variants": {
    "get": {
      "summary": "List Product Variants",
      "tags": [
        "7. Products & Variants"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "parameters": [
        {
          "name": "productId",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter productId"
        }
      ]
    },
    "post": {
      "summary": "Create Product Variant",
      "tags": [
        "7. Products & Variants"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "productId",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter productId"
        }
      ]
    }
  },
  "/variants": {
    "get": {
      "summary": "List All System Variants",
      "tags": [
        "7. Products & Variants"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/variants/{id}": {
    "get": {
      "summary": "Get Variant by ID",
      "tags": [
        "7. Products & Variants"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    },
    "patch": {
      "summary": "Update Variant Information",
      "tags": [
        "7. Products & Variants"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    },
    "delete": {
      "summary": "Delete Variant",
      "tags": [
        "7. Products & Variants"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    }
  },
  "/wishlist": {
    "get": {
      "summary": "Get Current User Saved Wishlist",
      "tags": [
        "8. Customer Wishlist"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    },
    "post": {
      "summary": "Add Product Item to Wishlist",
      "tags": [
        "8. Customer Wishlist"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "requestBody": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "productId"
              ],
              "properties": {
                "productId": {
                  "type": "string",
                  "format": "uuid"
                }
              }
            }
          }
        }
      }
    }
  },
  "/wishlist/clear": {
    "delete": {
      "summary": "Clear Entire Wishlist",
      "tags": [
        "8. Customer Wishlist"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/wishlist/{itemId}": {
    "delete": {
      "summary": "Remove Item from Wishlist",
      "tags": [
        "8. Customer Wishlist"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "itemId",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter itemId"
        }
      ]
    }
  },
  "/cart": {
    "get": {
      "summary": "Get Active Shopping Cart",
      "tags": [
        "9. Shopping Cart"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      }
    },
    "post": {
      "summary": "Add Product Item to Cart",
      "tags": [
        "9. Shopping Cart"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      }
    },
    "patch": {
      "summary": "Update Cart Item Quantity",
      "tags": [
        "9. Shopping Cart"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      }
    },
    "delete": {
      "summary": "Clear Shopping Cart",
      "tags": [
        "9. Shopping Cart"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      }
    }
  },
  "/cart/items/{itemId}": {
    "delete": {
      "summary": "Remove Specific Item from Cart",
      "tags": [
        "9. Shopping Cart"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "parameters": [
        {
          "name": "itemId",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter itemId"
        }
      ]
    }
  },
  "/coupons": {
    "get": {
      "summary": "List Active Promotional Coupons",
      "tags": [
        "10. Coupons & Discounts"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    },
    "post": {
      "summary": "Create New Discount Coupon",
      "tags": [
        "10. Coupons & Discounts"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/coupons/validate": {
    "post": {
      "summary": "Validate Coupon Code at Checkout",
      "tags": [
        "10. Coupons & Discounts"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      }
    }
  },
  "/coupons/{id}": {
    "get": {
      "summary": "Get Coupon Details by ID",
      "tags": [
        "10. Coupons & Discounts"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    },
    "patch": {
      "summary": "Update Coupon Settings",
      "tags": [
        "10. Coupons & Discounts"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    },
    "delete": {
      "summary": "Delete Coupon",
      "tags": [
        "10. Coupons & Discounts"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    }
  },
  "/shipping/calculate": {
    "post": {
      "summary": "Calculate Shipping Rate for Order",
      "tags": [
        "11. Shipping & Logistics"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      }
    }
  },
  "/shipping/zones": {
    "get": {
      "summary": "List Delivery Zones",
      "tags": [
        "11. Shipping & Logistics"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      }
    }
  },
  "/shipping/zones/{id}/rates": {
    "get": {
      "summary": "Get Zone Delivery Rates",
      "tags": [
        "11. Shipping & Logistics"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    }
  },
  "/checkout/initiate": {
    "post": {
      "summary": "Initiate Checkout Session",
      "tags": [
        "12. Checkout & Orders"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      }
    }
  },
  "/checkout/summary": {
    "get": {
      "summary": "Get Checkout Cart Breakdown",
      "tags": [
        "12. Checkout & Orders"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      }
    }
  },
  "/orders": {
    "get": {
      "summary": "List Customer Orders",
      "tags": [
        "12. Checkout & Orders"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    },
    "post": {
      "summary": "Place New Hardware Order",
      "tags": [
        "12. Checkout & Orders"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/orders/{id}": {
    "get": {
      "summary": "Get Order Details by ID",
      "tags": [
        "12. Checkout & Orders"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    }
  },
  "/orders/{id}/status": {
    "patch": {
      "summary": "Update Order Processing Status",
      "tags": [
        "12. Checkout & Orders"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    }
  },
  "/orders/{id}/cancel": {
    "post": {
      "summary": "Cancel Customer Order",
      "tags": [
        "12. Checkout & Orders"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    }
  },
  "/payments/create-order": {
    "post": {
      "summary": "Create Razorpay Payment Order",
      "tags": [
        "13. Payments & Gateways"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/payments/verify": {
    "post": {
      "summary": "Verify Razorpay Payment Signature",
      "tags": [
        "13. Payments & Gateways"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/payments/webhook": {
    "post": {
      "summary": "Razorpay Webhook Event Ingestion Handler",
      "tags": [
        "13. Payments & Gateways"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      }
    }
  },
  "/quotes": {
    "get": {
      "summary": "List B2B RFQ Quotations",
      "tags": [
        "14. B2B Quotes & RFQs"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    },
    "post": {
      "summary": "Submit B2B Bulk Price RFQ Request",
      "tags": [
        "14. B2B Quotes & RFQs"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      }
    }
  },
  "/quotes/{id}": {
    "get": {
      "summary": "Get RFQ Details by ID",
      "tags": [
        "14. B2B Quotes & RFQs"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    },
    "patch": {
      "summary": "Update RFQ Status & Notes",
      "tags": [
        "14. B2B Quotes & RFQs"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    }
  },
  "/quotes/{id}/approve": {
    "post": {
      "summary": "Approve Quotation and Issue Contract Rate",
      "tags": [
        "14. B2B Quotes & RFQs"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    }
  },
  "/quotes/{id}/reject": {
    "post": {
      "summary": "Reject Quotation Request",
      "tags": [
        "14. B2B Quotes & RFQs"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    }
  },
  "/reviews": {
    "get": {
      "summary": "List Approved Product Reviews",
      "tags": [
        "15. Customer Reviews"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      }
    },
    "post": {
      "summary": "Submit Product Review & Rating",
      "tags": [
        "15. Customer Reviews"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/reviews/{id}": {
    "get": {
      "summary": "Get Review by ID",
      "tags": [
        "15. Customer Reviews"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    },
    "delete": {
      "summary": "Delete Review",
      "tags": [
        "15. Customer Reviews"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    }
  },
  "/reviews/{id}/status": {
    "patch": {
      "summary": "Approve / Reject Review (Admin)",
      "tags": [
        "15. Customer Reviews"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    }
  },
  "/enquiries": {
    "get": {
      "summary": "List Customer Inquiries",
      "tags": [
        "16. Customer Inquiries"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    },
    "post": {
      "summary": "Submit Customer Product / Trade Inquiry",
      "tags": [
        "16. Customer Inquiries"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      }
    }
  },
  "/enquiries/{id}": {
    "get": {
      "summary": "Get Inquiry Details by ID",
      "tags": [
        "16. Customer Inquiries"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    }
  },
  "/enquiries/{id}/status": {
    "patch": {
      "summary": "Update Inquiry Resolution Status",
      "tags": [
        "16. Customer Inquiries"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    }
  },
  "/banners": {
    "get": {
      "summary": "List Active Storefront Hero Banners",
      "tags": [
        "17. Storefront Banners & CMS"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      }
    },
    "post": {
      "summary": "Create Hero Banner Slider",
      "tags": [
        "17. Storefront Banners & CMS"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/banners/{id}": {
    "get": {
      "summary": "Get Banner Details by ID",
      "tags": [
        "17. Storefront Banners & CMS"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    },
    "patch": {
      "summary": "Update Banner Images, Titles & Links",
      "tags": [
        "17. Storefront Banners & CMS"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    },
    "delete": {
      "summary": "Delete Hero Banner",
      "tags": [
        "17. Storefront Banners & CMS"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    }
  },
  "/homepage/layout": {
    "get": {
      "summary": "Get Homepage Layout Configuration",
      "tags": [
        "17. Storefront Banners & CMS"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      }
    },
    "put": {
      "summary": "Update Homepage Layout Configuration",
      "tags": [
        "17. Storefront Banners & CMS"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/cms/pages": {
    "get": {
      "summary": "List CMS Content Pages",
      "tags": [
        "17. Storefront Banners & CMS"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      }
    },
    "post": {
      "summary": "Create CMS Content Page",
      "tags": [
        "17. Storefront Banners & CMS"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/cms/pages/{slug}": {
    "get": {
      "summary": "Get CMS Content Page by Slug",
      "tags": [
        "17. Storefront Banners & CMS"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "parameters": [
        {
          "name": "slug",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter slug"
        }
      ]
    },
    "patch": {
      "summary": "Update CMS Page Content",
      "tags": [
        "17. Storefront Banners & CMS"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "slug",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter slug"
        }
      ]
    },
    "delete": {
      "summary": "Delete CMS Page",
      "tags": [
        "17. Storefront Banners & CMS"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "slug",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter slug"
        }
      ]
    }
  },
  "/appointments": {
    "get": {
      "summary": "List Service & Repair Appointments",
      "tags": [
        "18. Hardware Service Appointments"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    },
    "post": {
      "summary": "Book Hardware Installation / Service Appointment",
      "tags": [
        "18. Hardware Service Appointments"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      }
    }
  },
  "/appointments/{id}": {
    "get": {
      "summary": "Get Appointment by ID",
      "tags": [
        "18. Hardware Service Appointments"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    }
  },
  "/appointments/{id}/status": {
    "patch": {
      "summary": "Update Appointment Status",
      "tags": [
        "18. Hardware Service Appointments"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    }
  },
  "/search": {
    "get": {
      "summary": "Search Catalog Products, Categories, SKUs",
      "tags": [
        "19. Search & Autocomplete"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      }
    }
  },
  "/search/suggestions": {
    "get": {
      "summary": "Get Instant Typeahead Suggestions",
      "tags": [
        "19. Search & Autocomplete"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      }
    }
  },
  "/upload/avatar": {
    "post": {
      "summary": "Upload User Profile Avatar Image",
      "tags": [
        "20. Media Uploads"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/upload/product": {
    "post": {
      "summary": "Upload Single Product Image Asset",
      "tags": [
        "20. Media Uploads"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/upload/product/multiple": {
    "post": {
      "summary": "Upload Multiple Product Gallery Images",
      "tags": [
        "20. Media Uploads"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/upload/category": {
    "post": {
      "summary": "Upload Category Thumbnail",
      "tags": [
        "20. Media Uploads"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/notifications": {
    "get": {
      "summary": "List Customer Notifications",
      "tags": [
        "21. Customer Notifications"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/notifications/unread-count": {
    "get": {
      "summary": "Get Unread Notification Count",
      "tags": [
        "21. Customer Notifications"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/notifications/{id}/read": {
    "patch": {
      "summary": "Mark Notification as Read",
      "tags": [
        "21. Customer Notifications"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    }
  },
  "/notifications/read-all": {
    "patch": {
      "summary": "Mark All Notifications as Read",
      "tags": [
        "21. Customer Notifications"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/settings/public": {
    "get": {
      "summary": "Get Public Store Settings & Branding",
      "tags": [
        "22. Store & System Settings"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      }
    }
  },
  "/settings": {
    "get": {
      "summary": "Get Full System Settings (Admin)",
      "tags": [
        "22. Store & System Settings"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    },
    "patch": {
      "summary": "Update System Settings",
      "tags": [
        "22. Store & System Settings"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/dashboard/metrics": {
    "get": {
      "summary": "Get Executive Dashboard Summary Metrics",
      "tags": [
        "23. Dashboard & Reports"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/dashboard/sales-trend": {
    "get": {
      "summary": "Get Monthly Sales Revenue Trends",
      "tags": [
        "23. Dashboard & Reports"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/dashboard/top-products": {
    "get": {
      "summary": "Get Best Selling Product Leaderboard",
      "tags": [
        "23. Dashboard & Reports"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/dashboard/low-stock": {
    "get": {
      "summary": "Get Urgent Low Stock Warning Items",
      "tags": [
        "23. Dashboard & Reports"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/reports/sales": {
    "get": {
      "summary": "Generate Sales Revenue Report",
      "tags": [
        "23. Dashboard & Reports"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/reports/inventory": {
    "get": {
      "summary": "Generate Inventory Valuation Report",
      "tags": [
        "23. Dashboard & Reports"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/reports/tax": {
    "get": {
      "summary": "Generate GST Tax Liability Report",
      "tags": [
        "23. Dashboard & Reports"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/invoices": {
    "get": {
      "summary": "List Enterprise GST Tax Invoices",
      "tags": [
        "24. Automated GST Invoices"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    },
    "post": {
      "summary": "Generate New GST Tax Invoice",
      "tags": [
        "24. Automated GST Invoices"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/invoices/{id}": {
    "get": {
      "summary": "Get Invoice Details by ID",
      "tags": [
        "24. Automated GST Invoices"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    }
  },
  "/invoices/{id}/pdf": {
    "post": {
      "summary": "Generate Invoice PDF Asset",
      "tags": [
        "24. Automated GST Invoices"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    }
  },
  "/invoices/{id}/download": {
    "get": {
      "summary": "Download Invoice PDF Document",
      "tags": [
        "24. Automated GST Invoices"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    }
  },
  "/invoices/{id}/email": {
    "post": {
      "summary": "Email Invoice PDF to Customer",
      "tags": [
        "24. Automated GST Invoices"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    }
  },
  "/invoices/{id}/print": {
    "post": {
      "summary": "Generate Thermal / Laser Print Layout",
      "tags": [
        "24. Automated GST Invoices"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    }
  },
  "/invoices/{id}/history": {
    "get": {
      "summary": "Get Invoice Version History",
      "tags": [
        "24. Automated GST Invoices"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    }
  },
  "/invoices/{id}/audit": {
    "get": {
      "summary": "Get Invoice Audit Trail",
      "tags": [
        "24. Automated GST Invoices"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    }
  },
  "/invoices/{id}/verification": {
    "get": {
      "summary": "Get Invoice Digital Signature Status",
      "tags": [
        "24. Automated GST Invoices"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    }
  },
  "/invoices/verify/{token}": {
    "get": {
      "summary": "Public Invoice Authenticity Verification",
      "tags": [
        "24. Automated GST Invoices"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "parameters": [
        {
          "name": "token",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter token"
        }
      ]
    }
  },
  "/allocation/allocate": {
    "post": {
      "summary": "Determine Nearest Fulfillment Warehouse for PIN Code",
      "tags": [
        "25. Warehouse Logistics & Allocation"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/allocation/rules": {
    "get": {
      "summary": "Get Active Warehouse Allocation Rules",
      "tags": [
        "25. Warehouse Logistics & Allocation"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/logistics/zones": {
    "get": {
      "summary": "List Logistics Shipping Zones",
      "tags": [
        "25. Warehouse Logistics & Allocation"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/logistics/rates": {
    "get": {
      "summary": "Get Logistics Express Delivery Rates",
      "tags": [
        "25. Warehouse Logistics & Allocation"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/ventures": {
    "get": {
      "summary": "List All Venture Units",
      "tags": [
        "26. Multi-Venture Units"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    },
    "post": {
      "summary": "Create New Venture Unit",
      "tags": [
        "26. Multi-Venture Units"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/ventures/{id}": {
    "get": {
      "summary": "Get Venture Unit Details",
      "tags": [
        "26. Multi-Venture Units"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    },
    "patch": {
      "summary": "Update Venture Unit",
      "tags": [
        "26. Multi-Venture Units"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    },
    "delete": {
      "summary": "Delete Venture Unit",
      "tags": [
        "26. Multi-Venture Units"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    }
  },
  "/ventures/{id}/users": {
    "post": {
      "summary": "Assign User to Venture Unit",
      "tags": [
        "26. Multi-Venture Units"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    }
  },
  "/ventures/{id}/users/{userId}": {
    "delete": {
      "summary": "Remove User from Venture Unit",
      "tags": [
        "26. Multi-Venture Units"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        },
        {
          "name": "userId",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter userId"
        }
      ]
    }
  },
  "/inventory/warehouses": {
    "get": {
      "summary": "List All Warehouses",
      "tags": [
        "27. Warehouses & Storage"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    },
    "post": {
      "summary": "Create New Warehouse Hub",
      "tags": [
        "27. Warehouses & Storage"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/inventory/warehouses/{id}": {
    "get": {
      "summary": "Get Warehouse Details",
      "tags": [
        "27. Warehouses & Storage"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    },
    "patch": {
      "summary": "Update Warehouse Information",
      "tags": [
        "27. Warehouses & Storage"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    },
    "delete": {
      "summary": "Delete Warehouse",
      "tags": [
        "27. Warehouses & Storage"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    }
  },
  "/inventory/warehouses/{id}/products": {
    "get": {
      "summary": "Get Products Stored in Warehouse",
      "tags": [
        "27. Warehouses & Storage"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    }
  },
  "/inventory/warehouses/{id}/stock": {
    "get": {
      "summary": "Get Stock Levels in Warehouse",
      "tags": [
        "27. Warehouses & Storage"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    }
  },
  "/inventory/stock": {
    "get": {
      "summary": "Get Global Real-Time Inventory Stock",
      "tags": [
        "28. Inventory Stock Management"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/inventory/stock/levels": {
    "get": {
      "summary": "Get Stock Level Alert Summaries",
      "tags": [
        "28. Inventory Stock Management"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/inventory/stock/history": {
    "get": {
      "summary": "Get Stock Adjustment History",
      "tags": [
        "28. Inventory Stock Management"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/inventory/stock/movement": {
    "get": {
      "summary": "Get Stock Inward/Outward Movements",
      "tags": [
        "28. Inventory Stock Management"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/inventory/stock/{productId}": {
    "get": {
      "summary": "Get Product Stock across Warehouses",
      "tags": [
        "28. Inventory Stock Management"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "productId",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter productId"
        }
      ]
    }
  },
  "/inventory/stock/increase": {
    "post": {
      "summary": "Increase Product Stock Level",
      "tags": [
        "28. Inventory Stock Management"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/inventory/stock/decrease": {
    "post": {
      "summary": "Decrease Product Stock Level",
      "tags": [
        "28. Inventory Stock Management"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/inventory/stock/update": {
    "post": {
      "summary": "Update Product Stock Threshold",
      "tags": [
        "28. Inventory Stock Management"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/inventory/stock/adjustment": {
    "post": {
      "summary": "Record Inventory Reconciliation Adjustment",
      "tags": [
        "28. Inventory Stock Management"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/inventory/stock/reconciliation": {
    "post": {
      "summary": "Execute Batch Inventory Reconciliation",
      "tags": [
        "28. Inventory Stock Management"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/inventory/suppliers": {
    "get": {
      "summary": "List Hardware Suppliers & Vendors",
      "tags": [
        "29. Suppliers & Vendors"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    },
    "post": {
      "summary": "Create New Supplier Profile",
      "tags": [
        "29. Suppliers & Vendors"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/inventory/suppliers/{id}": {
    "get": {
      "summary": "Get Supplier Details",
      "tags": [
        "29. Suppliers & Vendors"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    },
    "patch": {
      "summary": "Update Supplier Information",
      "tags": [
        "29. Suppliers & Vendors"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    },
    "delete": {
      "summary": "Delete Supplier",
      "tags": [
        "29. Suppliers & Vendors"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    }
  },
  "/inventory/suppliers/{id}/ledger": {
    "get": {
      "summary": "Get Supplier Financial Ledger",
      "tags": [
        "29. Suppliers & Vendors"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    }
  },
  "/inventory/suppliers/{id}/purchase-history": {
    "get": {
      "summary": "Get Supplier Purchase Order History",
      "tags": [
        "29. Suppliers & Vendors"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    }
  },
  "/inventory/suppliers/{id}/payment-history": {
    "get": {
      "summary": "Get Supplier Payment Disbursement History",
      "tags": [
        "29. Suppliers & Vendors"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    }
  },
  "/inventory/suppliers/{id}/outstanding": {
    "get": {
      "summary": "Get Supplier Outstanding Balance Due",
      "tags": [
        "29. Suppliers & Vendors"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    }
  },
  "/inventory/purchases": {
    "get": {
      "summary": "List Procurement Purchase Orders",
      "tags": [
        "30. Purchase Orders"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    },
    "post": {
      "summary": "Create New Purchase Order",
      "tags": [
        "30. Purchase Orders"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/inventory/purchases/{id}": {
    "get": {
      "summary": "Get Purchase Order Details",
      "tags": [
        "30. Purchase Orders"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    },
    "patch": {
      "summary": "Update Purchase Order Details",
      "tags": [
        "30. Purchase Orders"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    }
  },
  "/inventory/purchases/{id}/receive": {
    "post": {
      "summary": "Receive Inward Shipment against Purchase Order",
      "tags": [
        "30. Purchase Orders"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    }
  },
  "/inventory/transfers": {
    "get": {
      "summary": "List Inter-Warehouse Stock Transfers",
      "tags": [
        "31. Stock Transfers & Dispatches"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    },
    "post": {
      "summary": "Initiate Stock Transfer Request",
      "tags": [
        "31. Stock Transfers & Dispatches"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/inventory/transfers/{id}": {
    "get": {
      "summary": "Get Transfer Details",
      "tags": [
        "31. Stock Transfers & Dispatches"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    },
    "patch": {
      "summary": "Update Transfer Details",
      "tags": [
        "31. Stock Transfers & Dispatches"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    }
  },
  "/inventory/transfers/{id}/approve": {
    "post": {
      "summary": "Approve and Dispatch Stock Transfer",
      "tags": [
        "31. Stock Transfers & Dispatches"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    }
  },
  "/inventory/dispatches": {
    "get": {
      "summary": "List Outward Stock Dispatches",
      "tags": [
        "31. Stock Transfers & Dispatches"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    },
    "post": {
      "summary": "Create Outward Dispatch Waybill",
      "tags": [
        "31. Stock Transfers & Dispatches"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/inventory/dispatches/{id}": {
    "get": {
      "summary": "Get Dispatch Details",
      "tags": [
        "31. Stock Transfers & Dispatches"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    },
    "patch": {
      "summary": "Update Dispatch Tracking",
      "tags": [
        "31. Stock Transfers & Dispatches"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    }
  },
  "/inventory/dispatches/{id}/deliver": {
    "post": {
      "summary": "Confirm Dispatch Delivery",
      "tags": [
        "31. Stock Transfers & Dispatches"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    }
  },
  "/inventory/pos/registers": {
    "get": {
      "summary": "List Active POS Counter Registers",
      "tags": [
        "32. Point of Sale & Barcodes"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    },
    "post": {
      "summary": "Open New POS Register Shift",
      "tags": [
        "32. Point of Sale & Barcodes"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/inventory/pos/sales": {
    "post": {
      "summary": "Process In-Store Counter POS Sale",
      "tags": [
        "32. Point of Sale & Barcodes"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/inventory/pos/receipts/{id}": {
    "get": {
      "summary": "Get POS Printed Thermal Receipt",
      "tags": [
        "32. Point of Sale & Barcodes"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter id"
        }
      ]
    }
  },
  "/inventory/barcodes/{sku}": {
    "get": {
      "summary": "Generate EAN-13 / Code-128 Barcode Image",
      "tags": [
        "32. Point of Sale & Barcodes"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "sku",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter sku"
        }
      ]
    }
  },
  "/inventory/qr/{sku}": {
    "get": {
      "summary": "Generate Product QR Code Asset",
      "tags": [
        "32. Point of Sale & Barcodes"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "sku",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "Path parameter sku"
        }
      ]
    }
  },
  "/inventory/reports/valuation": {
    "get": {
      "summary": "Get FIFO/LIFO Inventory Valuation",
      "tags": [
        "33. Inventory Analytics & Audit"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/inventory/reports/turnover": {
    "get": {
      "summary": "Get Stock Turnover Ratio Analysis",
      "tags": [
        "33. Inventory Analytics & Audit"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/inventory/analytics/demand-forecast": {
    "get": {
      "summary": "Get AI-Assisted Demand Forecasting",
      "tags": [
        "33. Inventory Analytics & Audit"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/inventory/analytics/slow-moving": {
    "get": {
      "summary": "List Slow Moving & Dead Stock Items",
      "tags": [
        "33. Inventory Analytics & Audit"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/inventory/audit": {
    "get": {
      "summary": "Get Immutable Inventory Audit Trail Logs",
      "tags": [
        "33. Inventory Analytics & Audit"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  },
  "/inventory/search": {
    "get": {
      "summary": "Unified Search across Stock, Purchases & Warehouses",
      "tags": [
        "33. Inventory Analytics & Audit"
      ],
      "responses": {
        "200": {
          "description": "Successful response"
        },
        "400": {
          "description": "Validation or client error"
        },
        "401": {
          "description": "Unauthorized access"
        }
      },
      "security": [
        {
          "BearerAuth": []
        }
      ]
    }
  }
}
};

export const serveDocsJson = (_req: Request, res: Response): void => {
  res.setHeader('Content-Type', 'application/json');
  res.json(openApiSpec);
};

const swaggerHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Pacific Hardware Enterprise API Portal (160 Routes)</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; padding: 0; background: #0f172a; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; overflow-x: hidden; }
    .header-banner { text-align: center; padding: 24px 16px; background: linear-gradient(135deg, #1e293b, #09090b); color: #a855f7; border-bottom: 2px solid #8b5cf6; }
    .header-banner h1 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
    .header-banner p { margin: 6px 0 0 0; color: #94a3b8; font-size: 12.5px; font-weight: 500; }
    #swagger-ui { max-width: 1300px; margin: 15px auto; background: #ffffff; padding: 20px; border-radius: 12px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3); overflow-x: auto; }
    .swagger-ui .topbar { display: none; }
    @media (max-width: 768px) {
      #swagger-ui { padding: 10px; margin: 10px; }
      .header-banner h1 { font-size: 18px; }
    }
  </style>
</head>
<body>
  <div class="header-banner">
    <h1>Pacific Hardware Enterprise API Documentation</h1>
    <p>OpenAPI 3.0 Interactive Developer Portal • 216 Endpoints • Relative Cloud Gateway & Local Dev</p>
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

export const serveDocsUi = (_req: Request, res: Response): void => {
  res.setHeader('Content-Type', 'text/html');
  res.removeHeader('Content-Security-Policy');
  res.setHeader(
    'Content-Security-Policy',
    "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdn.jsdelivr.net; script-src-elem * 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net; style-src * 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net https://fonts.googleapis.com; style-src-elem * 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net https://fonts.googleapis.com; connect-src * https: http:; font-src * data: https://fonts.gstatic.com;"
  );
  res.send(swaggerHtml);
};
