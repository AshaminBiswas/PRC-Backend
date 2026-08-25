import { Request, Response } from 'express';
import { env } from './env';

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Pacific Hardware Enterprise REST API',
    version: '1.2.0',
    description:
      'Official REST API for Pacific Hardware Enterprise — covering endpoints across architectural hardware distribution, B2B customer custom pricing matrix, warehouse allocation, 2FA TOTP authentication, RBAC permissions, and GST invoicing.',
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
      "description": "List product variants catalog-wide or by product with search across SKU/name, stock filters, and pagination.",
      "tags": [
        "7. Products & Variants"
      ],
      "parameters": [
        {
          "name": "page",
          "in": "query",
          "required": false,
          "schema": { "type": "integer", "default": 1 },
          "description": "Page number"
        },
        {
          "name": "limit",
          "in": "query",
          "required": false,
          "schema": { "type": "integer", "default": 20 },
          "description": "Items per page"
        },
        {
          "name": "search",
          "in": "query",
          "required": false,
          "schema": { "type": "string" },
          "description": "Search query for SKU, variant name, or product name"
        },
        {
          "name": "productId",
          "in": "query",
          "required": false,
          "schema": { "type": "string", "format": "uuid" },
          "description": "Filter variants by parent product UUID"
        },
        {
          "name": "inStock",
          "in": "query",
          "required": false,
          "schema": { "type": "string", "enum": ["true", "false"] },
          "description": "Filter by stock availability"
        },
        {
          "name": "isAvailable",
          "in": "query",
          "required": false,
          "schema": { "type": "string", "enum": ["true", "false"] },
          "description": "Filter by catalog visibility status"
        }
      ],
      "responses": {
        "200": {
          "description": "Successful paginated list of variants"
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
      "summary": "Create Product Variant",
      "description": "Create a new variant SKU under a parent product.",
      "tags": [
        "7. Products & Variants"
      ],
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
              "required": ["productId", "sku", "price"],
              "properties": {
                "productId": { "type": "string", "format": "uuid" },
                "sku": { "type": "string", "example": "SS-HINGE-100-BLK" },
                "name": { "type": "string", "example": "100mm Matte Black Stainless" },
                "price": { "type": "number", "example": 499 },
                "salePrice": { "type": "number", "nullable": true, "example": 399 },
                "stock": { "type": "integer", "default": 0, "example": 25 },
                "attributes": { "type": "object", "example": { "size": "100mm", "finish": "Matte Black" } },
                "image": { "type": "string", "nullable": true },
                "isAvailable": { "type": "boolean", "default": true }
              }
            }
          }
        }
      },
      "responses": {
        "201": {
          "description": "Variant created successfully"
        },
        "400": {
          "description": "Validation or client error"
        },
        "409": {
          "description": "SKU Conflict - A variant with this SKU already exists"
        }
      }
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
      "summary": "List B2B RFQ Quotations (Admin)",
      "description": "Retrieve quotations with pagination, status tabs, search query, date ranges, and aggregated metrics.",
      "tags": [
        "14. B2B Quotes & RFQs"
      ],
      "parameters": [
        { "name": "page", "in": "query", "schema": { "type": "integer", "default": 1 }, "description": "Page number" },
        { "name": "limit", "in": "query", "schema": { "type": "integer", "default": 20 }, "description": "Page size" },
        { "name": "status", "in": "query", "schema": { "type": "string", "enum": ["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED", "CONVERTED", "EXPIRED"] }, "description": "Filter by status" },
        { "name": "search", "in": "query", "schema": { "type": "string" }, "description": "Search by reference number, company, email, or client" },
        { "name": "fromDate", "in": "query", "schema": { "type": "string", "format": "date" }, "description": "Filter start date (YYYY-MM-DD)" },
        { "name": "toDate", "in": "query", "schema": { "type": "string", "format": "date" }, "description": "Filter end date (YYYY-MM-DD)" }
      ],
      "responses": {
        "200": { "description": "Paginated list of quotations and metrics summary" },
        "401": { "description": "Unauthorized access" }
      },
      "security": [
        { "BearerAuth": [] }
      ]
    },
    "post": {
      "summary": "Submit B2B Quotation / RFQ Request",
      "description": "Submit a new commercial quotation request with line items, project details, and contact information. Only verified B2B accounts can submit.",
      "tags": [
        "14. B2B Quotes & RFQs"
      ],
      "requestBody": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": ["projectName", "firstName", "lastName", "companyName", "gstNo", "email", "phone", "items"],
              "properties": {
                "projectName": { "type": "string", "example": "DLF CyberCity Restroom Project" },
                "firstName": { "type": "string", "example": "Rahul" },
                "lastName": { "type": "string", "example": "Sharma" },
                "companyName": { "type": "string", "example": "Apex Infrastructure Pvt Ltd" },
                "gstNo": { "type": "string", "example": "27AAPCA1234F1Z5" },
                "email": { "type": "string", "example": "procurement@apexinfradev.com" },
                "phone": { "type": "string", "example": "9876543210" },
                "notes": { "type": "string", "example": "Require SS304 grade with matte black PVD finish." },
                "items": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "required": ["productId", "quantity"],
                    "properties": {
                      "productId": { "type": "string" },
                      "quantity": { "type": "integer", "minimum": 1 },
                      "rate": { "type": "number", "minimum": 0 },
                      "unit": { "type": "string", "default": "PCS" }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "responses": {
        "201": { "description": "Quotation submitted successfully with Indian FY reference number" },
        "400": { "description": "Validation error" }
      }
    }
  },
  "/quotes/track": {
    "get": {
      "summary": "Universal Quotation Tracking",
      "description": "Track quotation progress by ANY ONE of: Quotation Reference No (e.g. PRC-QT-2026-27/001), B2B Customer Email, GSTIN, or Phone.",
      "tags": [
        "14. B2B Quotes & RFQs"
      ],
      "parameters": [
        { "name": "query", "in": "query", "required": true, "schema": { "type": "string" }, "description": "Search identifier (Ref No, Email, GST, or Phone)" }
      ],
      "responses": {
        "200": { "description": "List of matching quotations with status, totals, and access tokens" },
        "400": { "description": "Missing search query parameter" }
      }
    }
  },
  "/quotes/public/{token}": {
    "get": {
      "summary": "Get Public Quotation for Customer Review",
      "description": "Retrieve official formatted quotation details, QR code seal, and cryptographic digital signature via secure token.",
      "tags": [
        "14. B2B Quotes & RFQs"
      ],
      "parameters": [
        { "name": "token", "in": "path", "required": true, "schema": { "type": "string" }, "description": "Secure access token" }
      ],
      "responses": {
        "200": { "description": "Formatted quotation document" },
        "404": { "description": "Quotation not found or invalid token" }
      }
    }
  },
  "/quotes/public/{token}/respond": {
    "post": {
      "summary": "Customer Accept / Decline Quotation",
      "description": "Record customer acceptance or declination for an approved quotation. Locks further responses once submitted.",
      "tags": [
        "14. B2B Quotes & RFQs"
      ],
      "parameters": [
        { "name": "token", "in": "path", "required": true, "schema": { "type": "string" }, "description": "Secure access token" }
      ],
      "requestBody": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": ["decision"],
              "properties": {
                "decision": { "type": "string", "enum": ["accepted", "declined"] },
                "notes": { "type": "string", "description": "Optional feedback or reason" }
              }
            }
          }
        }
      },
      "responses": {
        "200": { "description": "Response recorded successfully" },
        "400": { "description": "Quote already responded or not approved" }
      }
    }
  },
  "/quotes/verify-signature": {
    "post": {
      "summary": "Verify Quotation Digital Signature & QR Authenticity",
      "description": "Cryptographically verify the HMAC-SHA256 digital signature of any quotation issued by Pacific Products & Solutions.",
      "tags": [
        "14. B2B Quotes & RFQs"
      ],
      "requestBody": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": ["referenceNo"],
              "properties": {
                "referenceNo": { "type": "string", "example": "PRC-QT-2026-27/001" },
                "digitalSignature": { "type": "string", "description": "Optional SHA256 hash" }
              }
            }
          }
        }
      },
      "responses": {
        "200": { "description": "Signature verification result with signer metadata and tamper flag" }
      }
    }
  },
  "/quotes/{id}": {
    "get": {
      "summary": "Get RFQ Details by ID (Admin)",
      "description": "Retrieve complete quotation details including line items, client profile, and chronological activity audit trail.",
      "tags": [
        "14. B2B Quotes & RFQs"
      ],
      "parameters": [
        { "name": "id", "in": "path", "required": true, "schema": { "type": "string" }, "description": "Quotation UUID" }
      ],
      "responses": {
        "200": { "description": "Detailed quotation record with audit logs" },
        "404": { "description": "Quotation not found" }
      },
      "security": [
        { "BearerAuth": [] }
      ]
    },
    "delete": {
      "summary": "Soft-Delete Quotation (Admin)",
      "description": "Mark quotation as deleted while preserving history in compliance audit trail.",
      "tags": [
        "14. B2B Quotes & RFQs"
      ],
      "parameters": [
        { "name": "id", "in": "path", "required": true, "schema": { "type": "string" }, "description": "Quotation UUID" }
      ],
      "responses": {
        "200": { "description": "Quotation soft-deleted successfully" }
      },
      "security": [
        { "BearerAuth": [] }
      ]
    }
  },
  "/quotes/{id}/status": {
    "patch": {
      "summary": "Update RFQ Status (Admin)",
      "description": "Transition quotation status (UNDER_REVIEW, PENDING, REJECTED). Requires mandatory reason for PENDING and REJECTED.",
      "tags": [
        "14. B2B Quotes & RFQs"
      ],
      "parameters": [
        { "name": "id", "in": "path", "required": true, "schema": { "type": "string" }, "description": "Quotation UUID" }
      ],
      "requestBody": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": ["status"],
              "properties": {
                "status": { "type": "string", "enum": ["UNDER_REVIEW", "PENDING", "APPROVED", "REJECTED"] },
                "statusReason": { "type": "string", "description": "Mandatory explanation for PENDING and REJECTED" }
              }
            }
          }
        }
      },
      "responses": {
        "200": { "description": "Quotation status updated" }
      },
      "security": [
        { "BearerAuth": [] }
      ]
    }
  },
  "/quotes/{id}/items": {
    "patch": {
      "summary": "Revise Quotation Line Items & Shipping (Admin)",
      "description": "Edit quantities, unit rates, add/remove items, and set shipping cost with server-recalculated basic price, GST (18%), and grand total.",
      "tags": [
        "14. B2B Quotes & RFQs"
      ],
      "parameters": [
        { "name": "id", "in": "path", "required": true, "schema": { "type": "string" }, "description": "Quotation UUID" }
      ],
      "requestBody": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": ["items"],
              "properties": {
                "items": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "required": ["productId", "quantity", "rate"],
                    "properties": {
                      "productId": { "type": "string" },
                      "productNameSnapshot": { "type": "string" },
                      "unit": { "type": "string" },
                      "quantity": { "type": "integer" },
                      "rate": { "type": "number" }
                    }
                  }
                },
                "shippingCost": { "type": "number", "nullable": true },
                "adminNotes": { "type": "string" }
              }
            }
          }
        }
      },
      "responses": {
        "200": { "description": "Line items and pricing revised successfully" }
      },
      "security": [
        { "BearerAuth": [] }
      ]
    }
  },
  "/quotes/{id}/sign": {
    "post": {
      "summary": "Digitally Sign & Approve Quotation (Admin)",
      "description": "Generates HMAC-SHA256 digital signature seal, creates QR code data URI, updates status to APPROVED, and emails customer secure review link.",
      "tags": [
        "14. B2B Quotes & RFQs"
      ],
      "parameters": [
        { "name": "id", "in": "path", "required": true, "schema": { "type": "string" }, "description": "Quotation UUID" }
      ],
      "requestBody": {
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "properties": {
                "shippingCost": { "type": "number", "nullable": true },
                "adminNotes": { "type": "string" }
              }
            }
          }
        }
      },
      "responses": {
        "200": { "description": "Quotation digitally signed with HMAC-SHA256 and QR code generated" }
      },
      "security": [
        { "BearerAuth": [] }
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
    },
    "post": {
      "summary": "Broadcast or Send Targeted Notification",
      "description": "Send a direct in-app notification to a user or broadcast to all active customers/staff. Emits real-time event through EventBus & SSE.",
      "tags": [
        "21. Customer Notifications"
      ],
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
              "required": ["title", "message"],
              "properties": {
                "userId": { "type": "string", "format": "uuid", "description": "Target recipient user ID (omit if broadcast is true)" },
                "broadcast": { "type": "boolean", "default": false, "description": "Set true to broadcast to all active users" },
                "type": { "type": "string", "enum": ["ORDER", "PROMO", "GENERAL", "SYSTEM"], "default": "GENERAL" },
                "title": { "type": "string", "example": "Flash Sale Weekend" },
                "message": { "type": "string", "example": "Special discounts on SS-304 architectural hardware!" },
                "data": { "type": "object", "example": { "discountPercent": 15 } }
              }
            }
          }
        }
      },
      "responses": {
        "201": {
          "description": "Notification created and emitted successfully"
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
  "/events/stream": {
    "get": {
      "summary": "Real-Time Server-Sent Events (SSE) Stream",
      "description": "Establish a real-time HTTP/2 Server-Sent Events push stream for live orders, notifications, stock alerts, and quotation events. Accepts JWT in Authorization header or query parameter ?token=...",
      "tags": [
        "22. Real-Time Events & Webhooks"
      ],
      "parameters": [
        {
          "name": "token",
          "in": "query",
          "required": false,
          "schema": { "type": "string" },
          "description": "JWT access token for EventSource browser clients"
        }
      ],
      "responses": {
        "200": {
          "description": "Real-time SSE event stream (text/event-stream)"
        },
        "401": {
          "description": "Missing or invalid authentication token"
        }
      }
    }
  },
  "/events/metrics": {
    "get": {
      "summary": "Get Live SSE Connection Pool Metrics",
      "description": "Returns active connection count and distribution across user roles.",
      "tags": [
        "22. Real-Time Events & Webhooks"
      ],
      "responses": {
        "200": {
          "description": "SSE connection pool statistics"
        }
      }
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
  "/purchase-orders/eligible-quotations": {
    "get": {
      "summary": "Get Approved Quotations Eligible for Starting a PO",
      "tags": ["34. Purchase Orders (Customer)"],
      "responses": {
        "200": { "description": "List of approved eligible quotations" }
      },
      "security": [{ "BearerAuth": [] }]
    }
  },
  "/purchase-orders/quotation/{id}": {
    "get": {
      "summary": "Get Quotation Details for PO Pre-fill",
      "tags": ["34. Purchase Orders (Customer)"],
      "parameters": [
        { "name": "id", "in": "path", "required": true, "schema": { "type": "string", "format": "uuid" } }
      ],
      "responses": {
        "200": { "description": "Quotation details with pricing and calculated advance" }
      },
      "security": [{ "BearerAuth": [] }]
    }
  },
  "/purchase-orders": {
    "post": {
      "summary": "Create & Submit a Purchase Order against an Approved Quotation",
      "tags": ["34. Purchase Orders (Customer)"],
      "requestBody": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": ["quotationId", "billingAddress"],
              "properties": {
                "quotationId": { "type": "string", "format": "uuid" },
                "customerPoReferenceNumber": { "type": "string" },
                "billingAddress": { "type": "object" },
                "deliveryAddress": { "type": "object" },
                "sameAsBilling": { "type": "boolean" },
                "deliveryInstructions": { "type": "string" },
                "requestedDeliveryDate": { "type": "string", "format": "date" }
              }
            }
          }
        }
      },
      "responses": {
        "201": { "description": "Purchase Order created with sequential PO number" }
      },
      "security": [{ "BearerAuth": [] }]
    },
    "get": {
      "summary": "List Customer's Purchase Orders",
      "tags": ["34. Purchase Orders (Customer)"],
      "parameters": [
        { "name": "status", "in": "query", "schema": { "type": "string" } },
        { "name": "page", "in": "query", "schema": { "type": "integer" } },
        { "name": "limit", "in": "query", "schema": { "type": "integer" } }
      ],
      "responses": {
        "200": { "description": "List of purchase orders" }
      },
      "security": [{ "BearerAuth": [] }]
    }
  },
  "/purchase-orders/{id}": {
    "get": {
      "summary": "Get Purchase Order Detail & Bank Details",
      "tags": ["34. Purchase Orders (Customer)"],
      "parameters": [
        { "name": "id", "in": "path", "required": true, "schema": { "type": "string", "format": "uuid" } }
      ],
      "responses": {
        "200": { "description": "Full PO details with snapshot addresses and active bank account" }
      },
      "security": [{ "BearerAuth": [] }]
    }
  },
  "/purchase-orders/{id}/payment-receipt": {
    "post": {
      "summary": "Upload or Replace Advance Payment Receipt (Max 2MB, PDF/JPEG/PNG)",
      "tags": ["34. Purchase Orders (Customer)"],
      "parameters": [
        { "name": "id", "in": "path", "required": true, "schema": { "type": "string", "format": "uuid" } }
      ],
      "responses": {
        "200": { "description": "Receipt uploaded and SHA-256 hashed" }
      },
      "security": [{ "BearerAuth": [] }]
    },
    "put": {
      "summary": "Update Payment Receipt (while Pending Review or Rejected)",
      "tags": ["34. Purchase Orders (Customer)"],
      "parameters": [
        { "name": "id", "in": "path", "required": true, "schema": { "type": "string", "format": "uuid" } }
      ],
      "responses": {
        "200": { "description": "Receipt updated" }
      },
      "security": [{ "BearerAuth": [] }]
    }
  },
  "/purchase-orders/{id}/packing-list": {
    "get": {
      "summary": "Download Commercial Packing List PDF",
      "tags": ["34. Purchase Orders (Customer)"],
      "parameters": [
        { "name": "id", "in": "path", "required": true, "schema": { "type": "string", "format": "uuid" } }
      ],
      "responses": {
        "200": { "description": "Packing List PDF file stream", "content": { "application/pdf": {} } }
      },
      "security": [{ "BearerAuth": [] }]
    }
  },
  "/admin/purchase-orders": {
    "get": {
      "summary": "Admin List All Purchase Orders",
      "tags": ["35. Purchase Orders (Admin)"],
      "parameters": [
        { "name": "status", "in": "query", "schema": { "type": "string" } },
        { "name": "search", "in": "query", "schema": { "type": "string" } },
        { "name": "page", "in": "query", "schema": { "type": "integer" } },
        { "name": "limit", "in": "query", "schema": { "type": "integer" } }
      ],
      "responses": {
        "200": { "description": "List of all customer POs" }
      },
      "security": [{ "BearerAuth": [] }]
    }
  },
  "/admin/purchase-orders/{id}": {
    "get": {
      "summary": "Admin Get Purchase Order Detail & Audit Logs",
      "tags": ["35. Purchase Orders (Admin)"],
      "parameters": [
        { "name": "id", "in": "path", "required": true, "schema": { "type": "string", "format": "uuid" } }
      ],
      "responses": {
        "200": { "description": "Detailed PO with audit logs and receipts" }
      },
      "security": [{ "BearerAuth": [] }]
    }
  },
  "/admin/purchase-orders/{id}/payment-receipt/acknowledge": {
    "post": {
      "summary": "Admin Acknowledge Payment & Send Customer Email",
      "tags": ["35. Purchase Orders (Admin)"],
      "parameters": [
        { "name": "id", "in": "path", "required": true, "schema": { "type": "string", "format": "uuid" } }
      ],
      "requestBody": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": ["amountReceived", "paymentReference"],
              "properties": {
                "amountReceived": { "type": "number" },
                "paymentDate": { "type": "string", "format": "date" },
                "paymentReference": { "type": "string" },
                "paymentMethod": { "type": "string" },
                "remarks": { "type": "string" }
              }
            }
          }
        }
      },
      "responses": {
        "200": { "description": "Payment acknowledged" }
      },
      "security": [{ "BearerAuth": [] }]
    }
  },
  "/admin/purchase-orders/{id}/payment-receipt/verify": {
    "post": {
      "summary": "Admin Digitally Verify Receipt (Triggers Packing List PDF Generation)",
      "tags": ["35. Purchase Orders (Admin)"],
      "parameters": [
        { "name": "id", "in": "path", "required": true, "schema": { "type": "string", "format": "uuid" } }
      ],
      "requestBody": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": ["confirmVerifiedAgainstBank"],
              "properties": {
                "confirmVerifiedAgainstBank": { "type": "boolean" },
                "verificationNotes": { "type": "string" }
              }
            }
          }
        }
      },
      "responses": {
        "200": { "description": "Payment verified and packing list generated" }
      },
      "security": [{ "BearerAuth": [] }]
    }
  },
  "/admin/purchase-orders/{id}/payment-receipt/reject": {
    "post": {
      "summary": "Admin Reject Receipt",
      "tags": ["35. Purchase Orders (Admin)"],
      "parameters": [
        { "name": "id", "in": "path", "required": true, "schema": { "type": "string", "format": "uuid" } }
      ],
      "responses": {
        "200": { "description": "Receipt rejected" }
      },
      "security": [{ "BearerAuth": [] }]
    }
  },
  "/admin/purchase-orders/settings/advance-payment": {
    "get": {
      "summary": "Get Global Advance Payment Percentage Settings",
      "tags": ["35. Purchase Orders (Admin)"],
      "responses": { "200": { "description": "Advance payment configuration" } },
      "security": [{ "BearerAuth": [] }]
    },
    "put": {
      "summary": "Update Advance Payment Percentage",
      "tags": ["35. Purchase Orders (Admin)"],
      "responses": { "200": { "description": "Updated configuration" } },
      "security": [{ "BearerAuth": [] }]
    }
  },
  "/admin/purchase-orders/settings/bank-account": {
    "get": {
      "summary": "Get Bank Account Settings for Payment Emails",
      "tags": ["35. Purchase Orders (Admin)"],
      "responses": { "200": { "description": "Bank account details" } },
      "security": [{ "BearerAuth": [] }]
    },
    "put": {
      "summary": "Update Bank Account Settings",
      "tags": ["35. Purchase Orders (Admin)"],
      "responses": { "200": { "description": "Updated bank account" } },
      "security": [{ "BearerAuth": [] }]
    }
  },
  "/purchase-orders/{id}/invoice": {
    "get": {
      "summary": "Get PO Tax Invoice Metadata",
      "tags": ["34. Purchase Orders (Customer)"],
      "responses": {
        "200": { "description": "Tax invoice metadata including Quotation No, PO No, Advance Paid, and Balance Due" }
      },
      "security": [{ "BearerAuth": [] }],
      "parameters": [
        { "name": "id", "in": "path", "required": true, "schema": { "type": "string" }, "description": "Purchase Order UUID" }
      ]
    }
  },
  "/purchase-orders/{id}/invoice/download": {
    "get": {
      "summary": "Download Formal Tax Invoice PDF",
      "tags": ["34. Purchase Orders (Customer)"],
      "responses": {
        "200": { "description": "Stream of branded Tax Invoice PDF" }
      },
      "security": [{ "BearerAuth": [] }],
      "parameters": [
        { "name": "id", "in": "path", "required": true, "schema": { "type": "string" }, "description": "Purchase Order UUID" }
      ]
    }
  },
  "/admin/purchase-orders/{id}/dispatch": {
    "post": {
      "summary": "Record PO Dispatch & Trigger Automated Invoicing",
      "tags": ["35. Purchase Orders (Admin)"],
      "requestBody": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": ["carrierName"],
              "properties": {
                "carrierName": { "type": "string", "example": "BlueDart Express" },
                "trackingNumber": { "type": "string", "example": "BD123456789IN" },
                "dispatchedAt": { "type": "string", "format": "date-time" },
                "dispatchNotes": { "type": "string", "example": "Dispatched in 2 corrugated cartons" }
              }
            }
          }
        }
      },
      "responses": {
        "200": { "description": "PO marked as DISPATCHED and background invoice generation initiated" }
      },
      "security": [{ "BearerAuth": [] }],
      "parameters": [
        { "name": "id", "in": "path", "required": true, "schema": { "type": "string" }, "description": "Purchase Order UUID" }
      ]
    }
  },
  "/admin/purchase-orders/{id}/invoice/regenerate": {
    "post": {
      "summary": "Manually Re-trigger Invoice Generation for PO",
      "tags": ["35. Purchase Orders (Admin)"],
      "responses": {
        "200": { "description": "Invoice regeneration job executed" }
      },
      "security": [{ "BearerAuth": [] }],
      "parameters": [
        { "name": "id", "in": "path", "required": true, "schema": { "type": "string" }, "description": "Purchase Order UUID" }
      ]
    }
  },
  "/admin/purchase-orders/invoices/all": {
    "get": {
      "summary": "List & Search All Generated Tax Invoices",
      "tags": ["35. Purchase Orders (Admin)"],
      "parameters": [
        { "name": "page", "in": "query", "schema": { "type": "integer", "default": 1 } },
        { "name": "limit", "in": "query", "schema": { "type": "integer", "default": 20 } },
        { "name": "search", "in": "query", "schema": { "type": "string" }, "description": "Search by invoice number, PO number, or customer name" },
        { "name": "status", "in": "query", "schema": { "type": "string" } }
      ],
      "responses": {
        "200": { "description": "Paginated list of all PO invoices" }
      },
      "security": [{ "BearerAuth": [] }]
    }
  },
  "/po-submissions/next-po-number": {
    "get": {
      "summary": "Fetch Next Sequential PO Number (FY atomic generator)",
      "tags": ["36. Purchase Order Intake (Customer)"],
      "responses": {
        "200": { "description": "Next sequential PO reference number (e.g. PRC-PO-2026-27/001)" }
      }
    }
  },
  "/po-submissions": {
    "post": {
      "summary": "Submit Structured Commercial Purchase Order",
      "tags": ["36. Purchase Order Intake (Customer)"],
      "requestBody": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": ["lineItems", "billToAddress"],
              "properties": {
                "customerPoNumber": { "type": "string", "example": "PRC-PO-2026-27/001" },
                "currency": { "type": "string", "default": "INR" },
                "lineItems": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "required": ["description", "quantity", "unitPrice"],
                    "properties": {
                      "description": { "type": "string" },
                      "sku": { "type": "string" },
                      "quantity": { "type": "integer" },
                      "unitPrice": { "type": "number" },
                      "taxRate": { "type": "number", "default": 18 }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "responses": { "201": { "description": "PO Submission created with sequential POS number" } },
      "security": [{ "BearerAuth": [] }]
    },
    "get": {
      "summary": "List Customer's Purchase Order Submissions",
      "tags": ["36. Purchase Order Intake (Customer)"],
      "responses": { "200": { "description": "Paginated customer PO submissions" } },
      "security": [{ "BearerAuth": [] }]
    }
  },
  "/po-submissions/upload": {
    "post": {
      "summary": "Upload Native ERP Purchase Order PDF (SAP / Tally / Zoho ≤10MB)",
      "tags": ["36. Purchase Order Intake (Customer)"],
      "requestBody": {
        "required": true,
        "content": {
          "multipart/form-data": {
            "schema": {
              "type": "object",
              "required": ["file"],
              "properties": {
                "file": { "type": "string", "format": "binary", "description": "Native PO PDF (Max 10 MB)" },
                "customerPoNumber": { "type": "string" },
                "statedTotal": { "type": "number" }
              }
            }
          }
        }
      },
      "responses": { "201": { "description": "PDF PO successfully queued for catalog mapping" } },
      "security": [{ "BearerAuth": [] }]
    }
  },
  "/po-submissions/{id}": {
    "get": {
      "summary": "Get Purchase Order Intake Dossier by ID",
      "tags": ["36. Purchase Order Intake (Customer)"],
      "parameters": [{ "name": "id", "in": "path", "required": true, "schema": { "type": "string" } }],
      "responses": { "200": { "description": "PO Submission detail with line items and linked fulfillment PO" } },
      "security": [{ "BearerAuth": [] }]
    },
    "delete": {
      "summary": "Cancel / Delete Pending PO Submission",
      "tags": ["36. Purchase Order Intake (Customer)"],
      "parameters": [{ "name": "id", "in": "path", "required": true, "schema": { "type": "string" } }],
      "responses": { "200": { "description": "Submission cancelled" } },
      "security": [{ "BearerAuth": [] }]
    }
  },
  "/po-submissions/{id}/tracking": {
    "get": {
      "summary": "Get Unified 8-Stage Live Tracking Telemetry",
      "tags": ["36. Purchase Order Intake (Customer)"],
      "parameters": [{ "name": "id", "in": "path", "required": true, "schema": { "type": "string" } }],
      "responses": {
        "200": {
          "description": "8-stage tracking pipeline: Intake -> SKU Map -> Approval -> Acknowledgement -> Advance Payment -> Packing List -> E-Way Bill -> GST Tax Invoice"
        }
      },
      "security": [{ "BearerAuth": [] }]
    }
  },
  "/po-submissions/{id}/acknowledgement": {
    "get": {
      "summary": "Download Formal Order Acknowledgement PDF with QR Verification",
      "tags": ["36. Purchase Order Intake (Customer)"],
      "parameters": [{ "name": "id", "in": "path", "required": true, "schema": { "type": "string" } }],
      "responses": { "200": { "description": "Binding Order Acknowledgement PDF stream" } },
      "security": [{ "BearerAuth": [] }]
    }
  },
  "/admin/po-submissions": {
    "get": {
      "summary": "Admin Unified Purchase Order Intake Queue",
      "tags": ["37. PO Intake Desk (Admin)"],
      "responses": { "200": { "description": "Queue with filters and status aggregates" } },
      "security": [{ "BearerAuth": [] }]
    }
  },
  "/admin/po-submissions/{id}/map-items": {
    "put": {
      "summary": "Map Native PDF Line Items to Catalog SKUs and Set Rates",
      "tags": ["37. PO Intake Desk (Admin)"],
      "parameters": [{ "name": "id", "in": "path", "required": true, "schema": { "type": "string" } }],
      "responses": { "200": { "description": "Catalog items mapped and variance recomputed" } },
      "security": [{ "BearerAuth": [] }]
    }
  },
  "/admin/po-submissions/{id}/approve": {
    "post": {
      "summary": "Approve Intake PO and Automatically Promote to Fulfillment Engine",
      "tags": ["37. PO Intake Desk (Admin)"],
      "parameters": [{ "name": "id", "in": "path", "required": true, "schema": { "type": "string" } }],
      "responses": { "200": { "description": "PO approved, promoted to B2BPurchaseOrder in AWAITING_ADVANCE_PAYMENT" } },
      "security": [{ "BearerAuth": [] }]
    }
  },
  "/admin/po-submissions/{id}/issue-acknowledgement": {
    "post": {
      "summary": "Generate & Issue Formal Order Acknowledgement PDF with QR Code",
      "tags": ["37. PO Intake Desk (Admin)"],
      "parameters": [{ "name": "id", "in": "path", "required": true, "schema": { "type": "string" } }],
      "responses": { "200": { "description": "Acknowledgement PDF generated, emailed, and linked" } },
      "security": [{ "BearerAuth": [] }]
    }
  },
  "/admin/po-submissions/{id}/tracking": {
    "get": {
      "summary": "Admin 8-Stage Live Tracking Telemetry",
      "tags": ["37. PO Intake Desk (Admin)"],
      "parameters": [{ "name": "id", "in": "path", "required": true, "schema": { "type": "string" } }],
      "responses": { "200": { "description": "Complete milestone telemetry" } },
      "security": [{ "BearerAuth": [] }]
    }
  },
  "/admin/purchase-orders/{id}/generate-pi": {
    "post": {
      "summary": "Generate Proforma Invoice (PI) PDF before dispatch",
      "tags": ["38. PO Commercial Fulfillment (B2B)"],
      "parameters": [{ "name": "id", "in": "path", "required": true, "schema": { "type": "string" } }],
      "responses": { "200": { "description": "Proforma Invoice generated" } },
      "security": [{ "BearerAuth": [] }]
    }
  },
  "/purchase-orders/{id}/proforma-invoice/download": {
    "get": {
      "summary": "Download Proforma Invoice (PI) PDF",
      "tags": ["38. PO Commercial Fulfillment (B2B)"],
      "parameters": [{ "name": "id", "in": "path", "required": true, "schema": { "type": "string" } }],
      "responses": { "200": { "description": "Binary PDF stream" } },
      "security": [{ "BearerAuth": [] }]
    }
  },
  "/admin/purchase-orders/{id}/generate-tax-invoice-iris": {
    "post": {
      "summary": "Generate GST Tax E-Invoice via IRIS API (IRN, Signed QR Code)",
      "tags": ["38. PO Commercial Fulfillment (B2B)"],
      "parameters": [{ "name": "id", "in": "path", "required": true, "schema": { "type": "string" } }],
      "responses": { "200": { "description": "GST Tax Invoice generated via IRIS" } },
      "security": [{ "BearerAuth": [] }]
    }
  },
  "/admin/purchase-orders/{id}/generate-eway-bill-iris": {
    "post": {
      "summary": "Generate Official GST E-Way Bill via IRIS API (Part A + Part B Logistics)",
      "tags": ["38. PO Commercial Fulfillment (B2B)"],
      "parameters": [{ "name": "id", "in": "path", "required": true, "schema": { "type": "string" } }],
      "responses": { "200": { "description": "GST E-Way Bill generated via IRIS" } },
      "security": [{ "BearerAuth": [] }]
    }
  },
  "/purchase-orders/{id}/eway-bill/download": {
    "get": {
      "summary": "Download Official GST E-Way Bill PDF",
      "tags": ["38. PO Commercial Fulfillment (B2B)"],
      "parameters": [{ "name": "id", "in": "path", "required": true, "schema": { "type": "string" } }],
      "responses": { "200": { "description": "Binary PDF stream" } },
      "security": [{ "BearerAuth": [] }]
    }
  },
  "/admin/purchase-orders/{id}/generate-issue-list": {
    "post": {
      "summary": "Generate Itemized Product Issue List / Delivery Challan with Rates & Quantities",
      "tags": ["38. PO Commercial Fulfillment (B2B)"],
      "parameters": [{ "name": "id", "in": "path", "required": true, "schema": { "type": "string" } }],
      "responses": { "200": { "description": "Product Issue List generated" } },
      "security": [{ "BearerAuth": [] }]
    }
  },
  "/purchase-orders/{id}/issue-list/download": {
    "get": {
      "summary": "Download Product Issue List / Delivery Challan PDF",
      "tags": ["38. PO Commercial Fulfillment (B2B)"],
      "parameters": [{ "name": "id", "in": "path", "required": true, "schema": { "type": "string" } }],
      "responses": { "200": { "description": "Binary PDF stream" } },
      "security": [{ "BearerAuth": [] }]
    }
  },
  "/admin/purchase-orders/users/{id}/b2b-advance-percentage": {
    "patch": {
      "summary": "Configure Customer-Specific B2B Advance Deposit Percentage",
      "tags": ["38. PO Commercial Fulfillment (B2B)"],
      "parameters": [{ "name": "id", "in": "path", "required": true, "schema": { "type": "string" } }],
      "responses": { "200": { "description": "Customer advance percentage updated" } },
      "security": [{ "BearerAuth": [] }]
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

