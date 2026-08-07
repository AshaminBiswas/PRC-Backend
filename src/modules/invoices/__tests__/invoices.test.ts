import { getCurrentFinancialYear } from '../services/numbering.service';
import { calculateGST, numberToWordsIndianRupees } from '../services/gst.service';
import { calculateDocumentHash } from '../services/qr.service';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

export const testInvoiceSystem = () => {
  console.log('\n🧾 Running Enterprise Invoice Management Engine Unit Tests...');

  // 1. Financial Year Calculation Test
  const dateApril = new Date('2026-04-15');
  const dateJan = new Date('2026-02-10');

  const fyApril = getCurrentFinancialYear(dateApril);
  const fyJan = getCurrentFinancialYear(dateJan);

  assert(fyApril === '2026-27', 'April 2026 belongs to FY 2026-27');
  assert(fyJan === '2025-26', 'February 2026 belongs to FY 2025-26');
  console.log('  ✓ Financial Year sequence calculation test passed.');

  // 2. Intra-State GST Split (CGST + SGST)
  const itemsIntra = [
    {
      sku: 'BSH-GSB-600',
      productName: 'Bosch Professional Impact Drill',
      hsnCode: '8467',
      unit: 'PCS',
      quantity: 2,
      unitPrice: 3000,
      discount: 0,
      taxRate: 18,
      cessRate: 0,
    },
  ];

  const gstIntra = calculateGST(itemsIntra, 'Karnataka', 'Karnataka');

  assert(gstIntra.isInterState === false, 'Same state is Intra-State');
  assert(gstIntra.subtotal === 6000, 'Subtotal is 6000');
  assert(gstIntra.taxableAmount === 6000, 'Taxable amount is 6000');
  assert(gstIntra.cgst === 540, 'CGST is 9% (540)');
  assert(gstIntra.sgst === 540, 'SGST is 9% (540)');
  assert(gstIntra.igst === 0, 'IGST is 0 for intra-state');
  assert(gstIntra.grandTotal === 7080, 'Grand Total is 7080');
  console.log('  ✓ Intra-State GST calculation (CGST + SGST) test passed.');

  // 3. Inter-State GST (IGST)
  const gstInter = calculateGST(itemsIntra, 'Karnataka', 'Delhi');

  assert(gstInter.isInterState === true, 'Different states is Inter-State');
  assert(gstInter.cgst === 0, 'CGST is 0 for inter-state');
  assert(gstInter.sgst === 0, 'SGST is 0 for inter-state');
  assert(gstInter.igst === 1080, 'IGST is 18% (1080)');
  assert(gstInter.grandTotal === 7080, 'Grand Total is 7080');
  console.log('  ✓ Inter-State GST calculation (IGST) test passed.');

  // 4. Amount in Words Test
  const words = numberToWordsIndianRupees(7080);
  assert(words.includes('Seven Thousand Eighty'), 'Rupees in words contains Seven Thousand Eighty');
  console.log('  ✓ Number to Indian Rupee Words conversion test passed.');

  // 5. SHA-256 Document Hash Test
  const hash1 = calculateDocumentHash('INV/2026-27/MAIN/000001', 7080, 'token-123', '2026-08-06T12:00:00Z');
  const hash2 = calculateDocumentHash('INV/2026-27/MAIN/000001', 7080, 'token-123', '2026-08-06T12:00:00Z');
  const hash3 = calculateDocumentHash('INV/2026-27/MAIN/000001', 7081, 'token-123', '2026-08-06T12:00:00Z');

  assert(hash1 === hash2, 'Identical document data produces identical SHA-256 hash');
  assert(hash1 !== hash3, 'Tampered amount produces completely different SHA-256 hash');
  console.log('  ✓ SHA-256 Document Hashing tamper-proof test passed.');

  console.log('  ✅ All Enterprise Invoice Management Engine unit tests passed successfully!\n');
};

if (require.main === module) {
  testInvoiceSystem();
}
