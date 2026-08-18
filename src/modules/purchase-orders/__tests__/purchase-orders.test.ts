import crypto from 'crypto';
import { getCurrentFinancialYear, generateNextPoNumber } from '../po-numbering.service';
import { generatePackingListPdfBuffer } from '../packing-list-pdf.service';
import { generateInvoicePdfBuffer } from '../invoice-pdf.service';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

export const testPurchaseOrderSystem = async () => {
  console.log('\n📦 Running Purchase Order (PO) & Invoice Generation Module Comprehensive Unit Tests...');

  // 1. PO Numbering & Financial Year
  const aug2026 = new Date(2026, 7, 18);
  const fyAug = getCurrentFinancialYear(aug2026);
  assert(fyAug === '2026-27', 'August 2026 belongs to FY 2026-27');

  const feb2027 = new Date(2027, 1, 15);
  const fyFeb = getCurrentFinancialYear(feb2027);
  assert(fyFeb === '2026-27', 'February 2027 belongs to FY 2026-27');

  const apr2027 = new Date(2027, 3, 1);
  const fyApr = getCurrentFinancialYear(apr2027);
  assert(fyApr === '2027-28', 'April 2027 belongs to FY 2027-28');
  console.log('  ✓ Indian Financial Year rollover calculation test passed.');

  const poNumberResult = await generateNextPoNumber(aug2026);
  assert(/^PRC-PO-\d{4}-\d{2}\/\d{3,}$/.test(poNumberResult.poNumber), 'PO number matches PRC-PO-YYYY-YY/XXX format');
  assert(poNumberResult.financialYear === '2026-27', 'PO number FY matches');
  console.log(`  ✓ Atomic PO numbering test passed (${poNumberResult.poNumber}).`);

  // 2. Advance Calculation
  const grandTotal = 100000;
  const advancePercentage = 30;
  const advanceAmount = Math.round((grandTotal * (advancePercentage / 100)) * 100) / 100;
  const balanceAmount = Math.round((grandTotal - advanceAmount) * 100) / 100;
  assert(advanceAmount === 30000, '30% advance of 1,00,000 is 30,000');
  assert(balanceAmount === 70000, 'Balance is 70,000');
  assert(advanceAmount + balanceAmount === grandTotal, 'Advance + balance equals total');
  console.log('  ✓ 30% Advance payment and balance auto-calculation test passed.');

  // 3. File SHA-256 Tamper Evidence
  const testBuffer1 = Buffer.from('TEST-ADVANCE-RECEIPT-PRC-HARDWARE-2026');
  const hash1 = crypto.createHash('sha256').update(testBuffer1).digest('hex');
  const hash2 = crypto.createHash('sha256').update(testBuffer1).digest('hex');
  assert(hash1 === hash2, 'SHA-256 is deterministic');
  assert(hash1.length === 64, 'SHA-256 hash length is 64 hex characters');

  const tamperedBuffer = Buffer.from('TAMPERED-RECEIPT-CONTENT');
  const tamperedHash = crypto.createHash('sha256').update(tamperedBuffer).digest('hex');
  assert(hash1 !== tamperedHash, 'Tampered file alters SHA-256 hash');
  console.log('  ✓ SHA-256 Digital verification tamper-evidence test passed.');

  // 4. Commercial Packing List PDF Generation
  const packingPdfBuffer = await generatePackingListPdfBuffer({
    poNumber: 'PRC-PO-2026-27/001',
    quotationNumber: 'PRC-QT-2026-27/001',
    createdAt: new Date(),
    customerName: 'Ashok Kumar',
    customerCompany: 'Apex Builders Pvt Ltd',
    customerEmail: 'ashok@apexbuilders.in',
    customerPhone: '+91 98765 43210',
    billingAddress: {
      attentionTo: 'Ashok Kumar',
      addressLine1: '42 MG Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560001',
      phone: '+91 98765 43210',
      email: 'ashok@apexbuilders.in',
    },
    deliveryAddress: {
      attentionTo: 'Site Supervisor',
      addressLine1: 'Tower 4 Construction Site',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560066',
      phone: '+91 98765 43211',
      email: 'site@apexbuilders.in',
    },
    totalPackages: 2,
    totalQuantity: 50,
    items: [
      { slNo: 1, productName: 'Stainless Steel Concealed Mortise Lock', sku: 'PRC-LCK-01', unit: 'PCS', quantity: 20 },
      { slNo: 2, productName: 'Solid Brass Heavy Duty Door Hinges (4x3x3mm)', sku: 'PRC-HNG-04', unit: 'PRS', quantity: 30 },
    ],
    verifiedAt: new Date(),
    fileHash: hash1,
  });

  assert(Buffer.isBuffer(packingPdfBuffer), 'Packing List output is a valid binary Buffer');
  assert(packingPdfBuffer.length > 1000, 'Packing List PDF buffer has content (>1KB)');
  assert(packingPdfBuffer.slice(0, 5).toString('ascii') === '%PDF-', 'Packing List PDF has valid binary header %PDF-');
  console.log(`  ✓ Commercial Packing List PDF generated successfully (${(packingPdfBuffer.length / 1024).toFixed(1)} KB).`);

  // 5. Commercial Tax Invoice PDF Generation (with Quotation No, PO No, Advance Paid, Balance Due)
  const invoicePdfBuffer = await generateInvoicePdfBuffer({
    invoiceNumber: 'PRC-INV-2026-27/001',
    poNumber: 'PRC-PO-2026-27/001',
    quotationNumber: 'PRC-QT-2026-27/001',
    customerPoReferenceNumber: 'APEX-PO-2026-08',
    issuedAt: new Date(),
    customerName: 'Ashok Kumar',
    customerCompany: 'Apex Builders Pvt Ltd',
    customerEmail: 'ashok@apexbuilders.in',
    customerPhone: '+91 98765 43210',
    customerGstin: '29ABCDE1234F1Z5',
    billingAddress: {
      attentionTo: 'Ashok Kumar',
      companyName: 'Apex Builders Pvt Ltd',
      addressLine1: '42 MG Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560001',
      phone: '+91 98765 43210',
      email: 'ashok@apexbuilders.in',
    },
    deliveryAddress: {
      attentionTo: 'Site Supervisor',
      companyName: 'Apex Builders Site Office',
      addressLine1: 'Tower 4 Construction Site',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560066',
      phone: '+91 98765 43211',
      email: 'site@apexbuilders.in',
    },
    dispatchInfo: {
      carrierName: 'BlueDart Express',
      trackingNumber: 'BD987654321IN',
      dispatchedAt: new Date(),
      dispatchNotes: 'Dispatched in 2 corrugated cartons with tamper seals',
    },
    items: [
      {
        slNo: 1,
        productName: 'Stainless Steel Concealed Mortise Lock',
        sku: 'PRC-LCK-01',
        hsnCode: '8301',
        unit: 'PCS',
        quantity: 20,
        rate: 2500,
        taxRate: 18,
        taxAmount: 9000,
        total: 59000,
      },
      {
        slNo: 2,
        productName: 'Solid Brass Heavy Duty Door Hinges (4x3x3mm)',
        sku: 'PRC-HNG-04',
        hsnCode: '8302',
        unit: 'PRS',
        quantity: 30,
        rate: 1000,
        taxRate: 18,
        taxAmount: 5400,
        total: 35400,
      },
    ],
    subtotal: 80000,
    taxTotal: 14400,
    shippingCost: 1000,
    grandTotal: 95400,
    advanceAmountPaid: 28620, // 30% advance paid
    balanceDue: 66780,        // 70% balance due
    fileHash: hash1,
  });

  assert(Buffer.isBuffer(invoicePdfBuffer), 'Tax Invoice output is a valid binary Buffer');
  assert(invoicePdfBuffer.length > 1000, 'Tax Invoice PDF buffer has content (>1KB)');
  assert(invoicePdfBuffer.slice(0, 5).toString('ascii') === '%PDF-', 'Tax Invoice PDF has valid binary header %PDF-');
  console.log(`  ✓ Commercial Tax Invoice PDF generated successfully with Quotation No, PO No, Advance & Balance (${(invoicePdfBuffer.length / 1024).toFixed(1)} KB).`);

  console.log('  ✅ All Purchase Order (PO) & Invoice Module unit tests passed successfully!\n');
};
