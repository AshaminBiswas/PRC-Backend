import fs from 'fs';
import path from 'path';

const postmanPath = path.join(__dirname, '../../postman/PRC_Hardware_API.json');

const allocationFolder = {
  name: "Warehouse Allocation Engine",
  item: [
    {
      name: "Allocate Order Warehouse",
      request: {
        method: "POST",
        url: "{{baseUrl}}/allocation/allocate",
        header: [
          {
            key: "Content-Type",
            value: "application/json"
          }
        ],
        body: {
          mode: "raw",
          raw: JSON.stringify({
            pincode: "700091",
            strategy: "HAVERSINE"
          }, null, 2)
        }
      },
      event: [
        {
          listen: "test",
          script: {
            exec: [
              "pm.test('Haversine Allocate - status 200', function () {",
              "    pm.response.to.have.status(200);",
              "});",
              "pm.test('Haversine Allocate - success true', function () {",
              "    var jsonData = pm.response.json();",
              "    pm.expect(jsonData.success).to.be.true;",
              "    pm.expect(jsonData.selectedWarehouse).to.exist;",
              "    pm.expect(jsonData.allWarehouses).to.be.an('array');",
              "});"
            ],
            type: "text/javascript"
          }
        }
      ]
    },
    {
      name: "Allocate Order Warehouse (Logistics & Inventory)",
      request: {
        method: "POST",
        url: "{{baseUrl}}/allocation/order-allocate",
        header: [
          {
            key: "Content-Type",
            value: "application/json"
          }
        ],
        body: {
          mode: "raw",
          raw: JSON.stringify({
            pincode: "110001",
            reserveStock: true,
            items: [
              {
                productId: "prod-uuid-1",
                sku: "BSH-GSB-600",
                quantity: 2
              }
            ]
          }, null, 2)
        }
      },
      event: [
        {
          listen: "test",
          script: {
            exec: [
              "pm.test('Allocate warehouse - status 200', function () {",
              "    pm.response.to.have.status(200);",
              "});",
              "pm.test('Allocate warehouse - success true', function () {",
              "    var jsonData = pm.response.json();",
              "    pm.expect(jsonData.success).to.be.true;",
              "    pm.expect(jsonData.data.allocatedWarehouse).to.exist;",
              "});"
            ],
            type: "text/javascript"
          }
        }
      ]
    },
    {
      name: "Get PIN Code Details",
      request: {
        method: "GET",
        url: "{{baseUrl}}/allocation/pincodes/110001",
        header: []
      },
      event: [
        {
          listen: "test",
          script: {
            exec: [
              "pm.test('Get PIN code details - status 200', function () {",
              "    pm.response.to.have.status(200);",
              "});"
            ],
            type: "text/javascript"
          }
        }
      ]
    },
    {
      name: "List PIN Codes",
      request: {
        method: "GET",
        url: {
          raw: "{{baseUrl}}/allocation/pincodes?page=1&limit=20&search=Delhi",
          host: ["{{baseUrl}}"],
          path: ["allocation", "pincodes"],
          query: [
            { key: "page", value: "1" },
            { key: "limit", value: "20" },
            { key: "search", value: "Delhi" }
          ]
        },
        header: []
      }
    },
    {
      name: "Get Nearest Warehouses",
      request: {
        method: "GET",
        url: {
          raw: "{{baseUrl}}/allocation/warehouses/nearest?pincode=110001&limit=5",
          host: ["{{baseUrl}}"],
          path: ["allocation", "warehouses", "nearest"],
          query: [
            { key: "pincode", value: "110001" },
            { key: "limit", value: "5" }
          ]
        },
        header: []
      }
    }
  ]
};

const logisticsFolder = {
  name: "Logistics & Lowest Shipping Cost Engine",
  item: [
    {
      name: "Calculate Shipping Cost",
      request: {
        method: "POST",
        url: "{{baseUrl}}/logistics/calculate",
        header: [
          {
            key: "Content-Type",
            value: "application/json"
          }
        ],
        body: {
          mode: "raw",
          raw: JSON.stringify({
            pincode: "110001",
            weight: 2.5,
            orderAmount: 1500,
            isCod: false
          }, null, 2)
        }
      },
      event: [
        {
          listen: "test",
          script: {
            exec: [
              "pm.test('Calculate shipping cost - status 200', function () {",
              "    pm.response.to.have.status(200);",
              "});",
              "pm.test('Calculate shipping cost - returns best option', function () {",
              "    var jsonData = pm.response.json();",
              "    pm.expect(jsonData.success).to.be.true;",
              "    pm.expect(jsonData.data.bestOption).to.exist;",
              "});"
            ],
            type: "text/javascript"
          }
        }
      ]
    },
    {
      name: "List Shipping Zones",
      request: {
        method: "GET",
        url: "{{baseUrl}}/logistics/zones",
        header: []
      },
      event: [
        {
          listen: "test",
          script: {
            exec: [
              "pm.test('List zones - status 200', function () {",
              "    pm.response.to.have.status(200);",
              "});"
            ],
            type: "text/javascript"
          }
        }
      ]
    },
    {
      name: "List Courier Rates",
      request: {
        method: "GET",
        url: "{{baseUrl}}/logistics/rates",
        header: []
      },
      event: [
        {
          listen: "test",
          script: {
            exec: [
              "pm.test('List rates - status 200', function () {",
              "    pm.response.to.have.status(200);",
              "});"
            ],
            type: "text/javascript"
          }
        }
      ]
    },
    {
      name: "Create Courier Rate (Admin)",
      request: {
        method: "POST",
        url: "{{baseUrl}}/logistics/admin/shipping-rate",
        auth: {
          type: "bearer",
          bearer: [
            {
              key: "token",
              value: "{{accessToken}}",
              type: "string"
            }
          ]
        },
        header: [
          {
            key: "Content-Type",
            value: "application/json"
          }
        ],
        body: {
          mode: "raw",
          raw: JSON.stringify({
            courierId: "courier-uuid",
            zoneId: "zone-uuid",
            weightFrom: 0,
            weightTo: 10,
            baseRate: 60.0,
            additionalRate: 15.0,
            fuelSurcharge: 5.0,
            handlingCharge: 10.0,
            codCharge: 25.0,
            estimatedDeliveryDays: 2
          }, null, 2)
        }
      }
    },
    {
      name: "Create Warehouse Zone Mapping (Admin)",
      request: {
        method: "POST",
        url: "{{baseUrl}}/logistics/admin/warehouse-zone",
        auth: {
          type: "bearer",
          bearer: [
            {
              key: "token",
              value: "{{accessToken}}",
              type: "string"
            }
          ]
        },
        header: [
          {
            key: "Content-Type",
            value: "application/json"
          }
        ],
        body: {
          mode: "raw",
          raw: JSON.stringify({
            warehouseId: "delhi-wh-uuid",
            zoneId: "zone-north-uuid",
            pinStart: "110000",
            pinEnd: "349999"
          }, null, 2)
        }
      }
    },
    {
      name: "Get Order Allocation Breakdown",
      request: {
        method: "GET",
        url: "{{baseUrl}}/orders/order-uuid/allocation",
        auth: {
          type: "bearer",
          bearer: [
            {
              key: "token",
              value: "{{accessToken}}",
              type: "string"
            }
          ]
        },
        header: []
      }
    }
  ]
};

const invoicesFolder = {
  name: "Enterprise Invoice Management System",
  item: [
    {
      name: "Create Invoice Draft",
      request: {
        method: "POST",
        url: "{{baseUrl}}/invoices",
        auth: {
          type: "bearer",
          bearer: [{ key: "token", value: "{{accessToken}}", type: "string" }]
        },
        header: [{ key: "Content-Type", value: "application/json" }],
        body: {
          mode: "raw",
          raw: JSON.stringify({
            invoiceType: "TAX_INVOICE",
            placeOfSupply: "Karnataka",
            supplierState: "Karnataka",
            items: [
              {
                sku: "BSH-GSB-600",
                productName: "Bosch Professional Impact Drill",
                hsnCode: "8467",
                unit: "PCS",
                quantity: 2,
                unitPrice: 3000,
                discount: 0,
                taxRate: 18,
                cessRate: 0
              }
            ]
          }, null, 2)
        }
      }
    },
    {
      name: "List Invoices",
      request: {
        method: "GET",
        url: "{{baseUrl}}/invoices?page=1&limit=20&invoiceType=TAX_INVOICE",
        auth: {
          type: "bearer",
          bearer: [{ key: "token", value: "{{accessToken}}", type: "string" }]
        }
      }
    },
    {
      name: "Get Invoice Details",
      request: {
        method: "GET",
        url: "{{baseUrl}}/invoices/invoice-uuid",
        auth: {
          type: "bearer",
          bearer: [{ key: "token", value: "{{accessToken}}", type: "string" }]
        }
      }
    },
    {
      name: "Approve Invoice",
      request: {
        method: "POST",
        url: "{{baseUrl}}/invoices/invoice-uuid/approve",
        auth: {
          type: "bearer",
          bearer: [{ key: "token", value: "{{accessToken}}", type: "string" }]
        }
      }
    },
    {
      name: "Cancel Invoice",
      request: {
        method: "POST",
        url: "{{baseUrl}}/invoices/invoice-uuid/cancel",
        auth: {
          type: "bearer",
          bearer: [{ key: "token", value: "{{accessToken}}", type: "string" }]
        },
        header: [{ key: "Content-Type", value: "application/json" }],
        body: {
          mode: "raw",
          raw: JSON.stringify({ reason: "Order cancelled by customer" }, null, 2)
        }
      }
    },
    {
      name: "Digitally Sign Invoice",
      request: {
        method: "POST",
        url: "{{baseUrl}}/invoices/invoice-uuid/sign",
        auth: {
          type: "bearer",
          bearer: [{ key: "token", value: "{{accessToken}}", type: "string" }]
        },
        header: [{ key: "Content-Type", value: "application/json" }],
        body: {
          mode: "raw",
          raw: JSON.stringify({ signedBy: "John Admin", designation: "Finance Manager" }, null, 2)
        }
      }
    },
    {
      name: "Email Invoice",
      request: {
        method: "POST",
        url: "{{baseUrl}}/invoices/invoice-uuid/email",
        auth: {
          type: "bearer",
          bearer: [{ key: "token", value: "{{accessToken}}", type: "string" }]
        },
        header: [{ key: "Content-Type", value: "application/json" }],
        body: {
          mode: "raw",
          raw: JSON.stringify({ email: "client@example.com" }, null, 2)
        }
      }
    },
    {
      name: "Print Invoice HTML",
      request: {
        method: "POST",
        url: "{{baseUrl}}/invoices/invoice-uuid/print",
        auth: {
          type: "bearer",
          bearer: [{ key: "token", value: "{{accessToken}}", type: "string" }]
        }
      }
    },
    {
      name: "Download Invoice PDF/HTML",
      request: {
        method: "GET",
        url: "{{baseUrl}}/invoices/invoice-uuid/download",
        auth: {
          type: "bearer",
          bearer: [{ key: "token", value: "{{accessToken}}", type: "string" }]
        }
      }
    },
    {
      name: "Get Invoice Audit Trail",
      request: {
        method: "GET",
        url: "{{baseUrl}}/invoices/invoice-uuid/audit",
        auth: {
          type: "bearer",
          bearer: [{ key: "token", value: "{{accessToken}}", type: "string" }]
        }
      }
    },
    {
      name: "Public Invoice Verification",
      request: {
        method: "GET",
        url: "{{baseUrl}}/invoices/verify/verification-token-uuid"
      }
    },
    {
      name: "Create Proforma Invoice",
      request: {
        method: "POST",
        url: "{{baseUrl}}/invoices/proforma",
        auth: { type: "bearer", bearer: [{ key: "token", value: "{{accessToken}}", type: "string" }] },
        header: [{ key: "Content-Type", value: "application/json" }],
        body: { mode: "raw", raw: JSON.stringify({ orderId: "order-uuid-123", notes: "Proforma requested by customer" }, null, 2) }
      }
    },
    {
      name: "Create Quotation",
      request: {
        method: "POST",
        url: "{{baseUrl}}/invoices/quotation",
        auth: { type: "bearer", bearer: [{ key: "token", value: "{{accessToken}}", type: "string" }] },
        header: [{ key: "Content-Type", value: "application/json" }],
        body: {
          mode: "raw",
          raw: JSON.stringify({
            invoiceType: "QUOTATION",
            placeOfSupply: "Karnataka",
            items: [{ sku: "BSH-GSB-600", productName: "Bosch Drill", quantity: 5, unitPrice: 3000, taxRate: 18 }]
          }, null, 2)
        }
      }
    },
    {
      name: "Create Delivery Challan",
      request: {
        method: "POST",
        url: "{{baseUrl}}/invoices/delivery-challan",
        auth: { type: "bearer", bearer: [{ key: "token", value: "{{accessToken}}", type: "string" }] },
        header: [{ key: "Content-Type", value: "application/json" }],
        body: { mode: "raw", raw: JSON.stringify({ orderId: "order-uuid-123", notes: "Delivery Challan for goods dispatch" }, null, 2) }
      }
    },
    {
      name: "Create Packing Slip",
      request: {
        method: "POST",
        url: "{{baseUrl}}/invoices/packing-slip",
        auth: { type: "bearer", bearer: [{ key: "token", value: "{{accessToken}}", type: "string" }] },
        header: [{ key: "Content-Type", value: "application/json" }],
        body: { mode: "raw", raw: JSON.stringify({ orderId: "order-uuid-123", notes: "Warehouse packing manifest" }, null, 2) }
      }
    },
    {
      name: "Create Purchase Order",
      request: {
        method: "POST",
        url: "{{baseUrl}}/invoices/purchase-order",
        auth: { type: "bearer", bearer: [{ key: "token", value: "{{accessToken}}", type: "string" }] },
        header: [{ key: "Content-Type", value: "application/json" }],
        body: {
          mode: "raw",
          raw: JSON.stringify({
            invoiceType: "PURCHASE_ORDER",
            placeOfSupply: "Maharashtra",
            items: [{ sku: "RAW-STEEL-500", productName: "Raw Steel Rods 10mm", quantity: 100, unitPrice: 450, taxRate: 18 }]
          }, null, 2)
        }
      }
    },
    {
      name: "Create Credit Note",
      request: {
        method: "POST",
        url: "{{baseUrl}}/invoices/credit-note",
        auth: { type: "bearer", bearer: [{ key: "token", value: "{{accessToken}}", type: "string" }] },
        header: [{ key: "Content-Type", value: "application/json" }],
        body: {
          mode: "raw",
          raw: JSON.stringify({
            originalInvoiceId: "invoice-uuid-123",
            reason: "Sales Return - Damaged during transit",
            items: [{ sku: "BSH-GSB-600", productName: "Bosch Impact Drill", quantity: 1, unitPrice: 3000, taxRate: 18 }]
          }, null, 2)
        }
      }
    },
    {
      name: "Create Debit Note",
      request: {
        method: "POST",
        url: "{{baseUrl}}/invoices/debit-note",
        auth: { type: "bearer", bearer: [{ key: "token", value: "{{accessToken}}", type: "string" }] },
        header: [{ key: "Content-Type", value: "application/json" }],
        body: {
          mode: "raw",
          raw: JSON.stringify({
            originalInvoiceId: "invoice-uuid-123",
            reason: "Price escalation adjustment",
            items: [{ sku: "BSH-GSB-600", productName: "Price difference", quantity: 1, unitPrice: 500, taxRate: 18 }]
          }, null, 2)
        }
      }
    },
    {
      name: "Create Commercial Invoice",
      request: {
        method: "POST",
        url: "{{baseUrl}}/invoices/commercial",
        auth: { type: "bearer", bearer: [{ key: "token", value: "{{accessToken}}", type: "string" }] },
        header: [{ key: "Content-Type", value: "application/json" }],
        body: { mode: "raw", raw: JSON.stringify({ orderId: "order-uuid-123", notes: "Export Commercial Invoice" }, null, 2) }
      }
    }
  ]
};

function updatePostmanCollection() {
  const content = fs.readFileSync(postmanPath, 'utf8');
  const collection = JSON.parse(content);

  // 1. Update Allocation Folder
  const existingAllocIndex = collection.item.findIndex((i: any) => i.name === 'Warehouse Allocation Engine');
  if (existingAllocIndex >= 0) {
    collection.item[existingAllocIndex] = allocationFolder;
  } else {
    collection.item.push(allocationFolder);
  }

  // 2. Update Logistics Folder
  const existingLogisticsIndex = collection.item.findIndex((i: any) => i.name === 'Logistics & Lowest Shipping Cost Engine');
  if (existingLogisticsIndex >= 0) {
    collection.item[existingLogisticsIndex] = logisticsFolder;
  } else {
    collection.item.push(logisticsFolder);
  }

  // 3. Update Invoice Folder
  const existingInvoiceIndex = collection.item.findIndex((i: any) => i.name === 'Enterprise Invoice Management System');
  if (existingInvoiceIndex >= 0) {
    collection.item[existingInvoiceIndex] = invoicesFolder;
  } else {
    collection.item.push(invoicesFolder);
  }

  fs.writeFileSync(postmanPath, JSON.stringify(collection, null, 2), 'utf8');
  console.log('Successfully updated postman/PRC_Hardware_API.json with Enterprise Invoice endpoints!');
}

updatePostmanCollection();
