import { InvoiceItemInput } from '../invoices.schema';

export interface CalculatedInvoiceItem {
  productId?: string;
  sku: string;
  productName: string;
  description?: string;
  hsnCode: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxableValue: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  cessRate: number;
  cessAmount: number;
  lineTotal: number;
}

export interface GSTCalculationResult {
  items: CalculatedInvoiceItem[];
  subtotal: number;
  discount: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  roundOff: number;
  grandTotal: number;
  amountInWords: string;
  isInterState: boolean;
  hsnSummary: Array<{
    hsnCode: string;
    taxableValue: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    cessAmount: number;
    totalTax: number;
  }>;
}

/**
 * Calculates Indian GST particulars (Rule 46), Intra-state / Inter-state tax splits, HSN summaries, and Amount in Words.
 */
export const calculateGST = (
  rawItems: Array<Partial<InvoiceItemInput> & { sku: string; productName: string; quantity: number; unitPrice: number }>,
  supplierState: string = 'Karnataka',
  placeOfSupply: string = 'Karnataka'
): GSTCalculationResult => {
  const isInterState = supplierState.trim().toLowerCase() !== placeOfSupply.trim().toLowerCase();

  let subtotal = 0;
  let totalDiscount = 0;
  let totalTaxable = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;
  let totalCess = 0;

  const hsnMap = new Map<string, { taxableValue: number; cgst: number; sgst: number; igst: number; cess: number }>();

  const items: CalculatedInvoiceItem[] = rawItems.map((item) => {
    const qty = Number(item.quantity);
    const price = Number(item.unitPrice);
    const disc = Number(item.discount || 0);

    const gross = price * qty;
    const taxable = Math.max(0, gross - disc);
    const taxRate = Number(item.taxRate || 18);
    const cessRate = Number(item.cessRate || 0);

    let cgstRate = 0;
    let sgstRate = 0;
    let igstRate = 0;

    if (isInterState) {
      igstRate = taxRate;
    } else {
      cgstRate = taxRate / 2;
      sgstRate = taxRate / 2;
    }

    const cgstAmount = Number(((taxable * cgstRate) / 100).toFixed(2));
    const sgstAmount = Number(((taxable * sgstRate) / 100).toFixed(2));
    const igstAmount = Number(((taxable * igstRate) / 100).toFixed(2));
    const cessAmount = Number(((taxable * cessRate) / 100).toFixed(2));

    const lineTotal = Number((taxable + cgstAmount + sgstAmount + igstAmount + cessAmount).toFixed(2));

    subtotal += gross;
    totalDiscount += disc;
    totalTaxable += taxable;
    totalCgst += cgstAmount;
    totalSgst += sgstAmount;
    totalIgst += igstAmount;
    totalCess += cessAmount;

    // HSN Accumulation
    const hsn = item.hsnCode || '8467';
    const currentHsn = hsnMap.get(hsn) || { taxableValue: 0, cgst: 0, sgst: 0, igst: 0, cess: 0 };
    hsnMap.set(hsn, {
      taxableValue: currentHsn.taxableValue + taxable,
      cgst: currentHsn.cgst + cgstAmount,
      sgst: currentHsn.sgst + sgstAmount,
      igst: currentHsn.igst + igstAmount,
      cess: currentHsn.cess + cessAmount,
    });

    return {
      productId: item.productId,
      sku: item.sku,
      productName: item.productName,
      description: item.description,
      hsnCode: hsn,
      unit: item.unit || 'PCS',
      quantity: qty,
      unitPrice: price,
      discount: disc,
      taxableValue: Number(taxable.toFixed(2)),
      cgstRate,
      cgstAmount,
      sgstRate,
      sgstAmount,
      igstRate,
      igstAmount,
      cessRate,
      cessAmount,
      lineTotal,
    };
  });

  const rawGrandTotal = totalTaxable + totalCgst + totalSgst + totalIgst + totalCess;
  const roundedGrandTotal = Math.round(rawGrandTotal);
  const roundOff = Number((roundedGrandTotal - rawGrandTotal).toFixed(2));

  const hsnSummary = Array.from(hsnMap.entries()).map(([hsnCode, vals]) => ({
    hsnCode,
    taxableValue: Number(vals.taxableValue.toFixed(2)),
    cgstAmount: Number(vals.cgst.toFixed(2)),
    sgstAmount: Number(vals.sgst.toFixed(2)),
    igstAmount: Number(vals.igst.toFixed(2)),
    cessAmount: Number(vals.cess.toFixed(2)),
    totalTax: Number((vals.cgst + vals.sgst + vals.igst + vals.cess).toFixed(2)),
  }));

  return {
    items,
    subtotal: Number(subtotal.toFixed(2)),
    discount: Number(totalDiscount.toFixed(2)),
    taxableAmount: Number(totalTaxable.toFixed(2)),
    cgst: Number(totalCgst.toFixed(2)),
    sgst: Number(totalSgst.toFixed(2)),
    igst: Number(totalIgst.toFixed(2)),
    cess: Number(totalCess.toFixed(2)),
    roundOff,
    grandTotal: roundedGrandTotal,
    amountInWords: numberToWordsIndianRupees(roundedGrandTotal),
    isInterState,
    hsnSummary,
  };
};

/**
 * Converts numbers into Indian Rupee words (e.g. 15450 -> "Rupees Fifteen Thousand Four Hundred Fifty Only")
 */
export const numberToWordsIndianRupees = (num: number): string => {
  if (num === 0) return 'Rupees Zero Only';

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertThreeDigit = (n: number): string => {
    let str = '';
    if (n > 99) {
      str += a[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n > 19) {
      str += b[Math.floor(n / 10)] + ' ';
      n %= 10;
    }
    if (n > 0) {
      str += a[n] + ' ';
    }
    return str;
  };

  let result = '';
  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  const remaining = num;

  if (crore > 0) result += convertThreeDigit(crore) + 'Crore ';
  if (lakh > 0) result += convertThreeDigit(lakh) + 'Lakh ';
  if (thousand > 0) result += convertThreeDigit(thousand) + 'Thousand ';
  if (remaining > 0) result += convertThreeDigit(remaining);

  return `Rupees ${result.trim()} Only`;
};
