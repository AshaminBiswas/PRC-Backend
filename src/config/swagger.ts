import { Request, Response } from 'express';
import { env } from './env';

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Pacific Hardware Enterprise REST API',
    version: '1.0.0',
    description:
      'Enterprise-grade multi-venture hardware distribution, logistics, inventory management, offline POS, and GST invoicing API.',
    contact: {
      name: 'Pacific Hardware Engineering',
      email: 'tech@pacifichardware.com',
    },
  },
  servers: [
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
        description: 'Enter your JWT access token.',
      },
    },
    schemas: {
      ApiResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object' },
          message: { type: 'string' },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: { type: 'array', items: { type: 'object' } },
            },
          },
        },
      },
      OrderAllocationRequest: {
        type: 'object',
        required: ['pincode'],
        properties: {
          pincode: { type: 'string', example: '110001' },
          strategy: { type: 'string', enum: ['ROAD_DISTANCE', 'HAVERSINE', 'EWAY_BILL'], example: 'ROAD_DISTANCE' },
          reserveStock: { type: 'boolean', default: false },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                productId: { type: 'string' },
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
    '/health': {
      get: {
        summary: 'System Health Check',
        tags: ['System'],
        responses: {
          '200': {
            description: 'System is healthy',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiResponse' },
              },
            },
          },
        },
      },
    },
    '/ready': {
      get: {
        summary: 'System Readiness Check',
        tags: ['System'],
        responses: {
          '200': { description: 'System is ready to accept connections' },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'User Login',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'admin@pacifichardware.com' },
                  password: { type: 'string', example: 'Password@123' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Successfully authenticated, returns JWT tokens' },
          '401': { description: 'Invalid credentials' },
        },
      },
    },
    '/allocation/allocate': {
      post: {
        summary: 'Determine Optimal Warehouse Allocation',
        tags: ['Logistics & Allocation'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/OrderAllocationRequest' },
            },
          },
        },
        responses: {
          '200': { description: 'Allocated nearest warehouse based on requested strategy' },
        },
      },
    },
    '/invoices': {
      get: {
        summary: 'List Enterprise Invoices',
        tags: ['Invoices & GST'],
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Paginated invoice list with GST totals' },
        },
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
  <title>PRC Hardware API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    body { margin: 0; padding: 0; background: #0f172a; color: #f8fafc; font-family: sans-serif; }
    #swagger-ui { max-width: 1200px; margin: 0 auto; background: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    .header-banner { text-align: center; padding: 24px; background: linear-gradient(135deg, #1e293b, #0f172a); color: #38bdf8; border-bottom: 2px solid #0284c7; }
    .header-banner h1 { margin: 0; font-size: 24px; }
    .header-banner p { margin: 8px 0 0 0; color: #94a3b8; font-size: 14px; }
  </style>
</head>
<body>
  <div class="header-banner">
    <h1>Pacific Hardware Enterprise API Documentation</h1>
    <p>Interactive OpenAPI 3.0 Portal • Version 1.0.0</p>
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
        ]
      });
    };
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
};
