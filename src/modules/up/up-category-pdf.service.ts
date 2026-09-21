import path from 'path';
import { Response } from 'express';
import { prisma } from '../../config/database';
import { PACIFIC_LOGO_DATA_URL } from '../../assets/pacific_logo.base64';
const pdfmake = require('pdfmake');
import type { TDocumentDefinitions, Content, TableCell, Alignment, StyleDictionary } from 'pdfmake/interfaces';
import type { ListUpExpensesQuery } from './up.schema';

// ── Configure Roboto Fonts from pdfmake package ──────────────────────────────
try {
  const pdfmakeDir = path.dirname(require.resolve('pdfmake/package.json'));
  pdfmake.addFonts({
    Roboto: {
      normal: path.join(pdfmakeDir, 'fonts/Roboto/Roboto-Regular.ttf'),
      bold: path.join(pdfmakeDir, 'fonts/Roboto/Roboto-Medium.ttf'),
      italics: path.join(pdfmakeDir, 'fonts/Roboto/Roboto-Italic.ttf'),
      bolditalics: path.join(pdfmakeDir, 'fonts/Roboto/Roboto-MediumItalic.ttf'),
    },
  });
} catch (e: any) {
  console.warn('[UP Category PDF] Font initialization warning:', e?.message || e);
}

// ── Color Palette ────────────────────────────────────────────────────────────
const COLOR_PRIMARY = '#1E1B4B'; // Deep Indigo
const COLOR_ACCENT = '#4338CA'; // Indigo 700
const COLOR_SUBACCENT = '#6366F1'; // Indigo 500
const COLOR_LIGHT_BG = '#F8FAFC'; // Slate 50
const COLOR_ALT_ROW = '#F1F5F9'; // Slate 100
const COLOR_BORDER = '#CBD5E1'; // Slate 300
const COLOR_DARK = '#0F172A'; // Slate 900
const COLOR_MUTED = '#64748B'; // Slate 500
const COLOR_VERIFIED = '#059669'; // Emerald 600
const COLOR_PENDING = '#D97706'; // Amber 600

function formatINR(value: number | null | undefined): string {
  const n = Number(value || 0);
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(date).slice(0, 10);
  }
}

export const generateCategoryExpensePdf = async (query: ListUpExpensesQuery, res: Response): Promise<void> => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  let rangeStart = '';
  let rangeEnd = '';
  let periodTitle = '';

  // Determine date bounds
  if (query.month && query.month.length === 7 && query.month.includes('-')) {
    const [yStr, mStr] = query.month.split('-');
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);
    rangeStart = new Date(Date.UTC(y, m - 1, 1)).toISOString().split('T')[0];
    rangeEnd = new Date(Date.UTC(y, m, 0)).toISOString().split('T')[0];
    const monthDate = new Date(y, m - 1, 1);
    periodTitle = monthDate.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  } else if (query.startDate && query.startDate.length === 7 && query.startDate.includes('-') && !query.endDate) {
    const [yStr, mStr] = query.startDate.split('-');
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);
    rangeStart = new Date(Date.UTC(y, m - 1, 1)).toISOString().split('T')[0];
    rangeEnd = new Date(Date.UTC(y, m, 0)).toISOString().split('T')[0];
    const monthDate = new Date(y, m - 1, 1);
    periodTitle = monthDate.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  } else if (query.startDate && query.endDate) {
    rangeStart = query.startDate.slice(0, 10);
    rangeEnd = query.endDate.slice(0, 10);
    periodTitle = `${rangeStart} to ${rangeEnd}`;
  } else {
    // Current month default
    rangeStart = new Date(Date.UTC(currentYear, currentMonth, 1)).toISOString().split('T')[0];
    rangeEnd = new Date(Date.UTC(currentYear, currentMonth + 1, 0)).toISOString().split('T')[0];
    periodTitle = now.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  }

  const sDate = new Date(`${rangeStart}T00:00:00Z`);
  const eDate = new Date(`${rangeEnd}T00:00:00Z`);
  const diffDays = Math.max(1, Math.round((eDate.getTime() - sDate.getTime()) / 86400000) + 1);

  // 1. Fetch Overarching KPI Data
  const kpis = await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      COALESCE(SUM(amount), 0)::numeric as "totalSpend",
      COALESCE(SUM(CASE WHEN verified = true THEN amount ELSE 0 END), 0)::numeric as "verifiedSpend",
      COALESCE(SUM(CASE WHEN verified = false THEN amount ELSE 0 END), 0)::numeric as "unverifiedSpend",
      COUNT(id)::int as "totalCount",
      COALESCE(MAX(amount), 0)::numeric as "highestExpense"
    FROM "up_expenses"
    WHERE "deleted_at" IS NULL
      AND expense_date >= '${rangeStart}'::date
      AND expense_date <= '${rangeEnd}'::date
      ${query.categoryId ? `AND category_id = '${query.categoryId}'` : ''}
      ${query.paymentMode ? `AND payment_mode = '${query.paymentMode}'` : ''}
      ${query.verified === 'true' ? 'AND verified = true' : query.verified === 'false' ? 'AND verified = false' : ''};
  `);

  const kpiData = kpis[0] || {};
  const totalSpend = Number(kpiData.totalSpend || 0);
  const verifiedSpend = Number(kpiData.verifiedSpend || 0);
  const unverifiedSpend = Number(kpiData.unverifiedSpend || 0);
  const totalCount = Number(kpiData.totalCount || 0);
  const highestExpense = Number(kpiData.highestExpense || 0);
  const avgDailySpend = totalCount > 0 ? Number((totalSpend / diffDays).toFixed(2)) : 0;
  const verifiedPct = totalSpend > 0 ? ((verifiedSpend / totalSpend) * 100).toFixed(1) : '0';

  // 2. Fetch Peak Expense Detail
  const peakRows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      e.amount,
      e.expense_date as "date",
      e.paid_to as "paidTo",
      c.name as "categoryName"
    FROM "up_expenses" e
    LEFT JOIN "up_expense_categories" c ON c.id = e.category_id
    WHERE e.deleted_at IS NULL
      AND e.expense_date >= '${rangeStart}'::date
      AND e.expense_date <= '${rangeEnd}'::date
    ORDER BY e.amount DESC
    LIMIT 1;
  `);
  const peakItem = peakRows[0] || null;

  // 3. Fetch Category Aggregates
  const categorySummaryRows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      c.id,
      c.name,
      COALESCE(SUM(e.amount), 0)::numeric as "totalAmount",
      COALESCE(SUM(CASE WHEN e.verified = true THEN e.amount ELSE 0 END), 0)::numeric as "verifiedAmount",
      COALESCE(SUM(CASE WHEN e.verified = false THEN e.amount ELSE 0 END), 0)::numeric as "unverifiedAmount",
      COUNT(e.id)::int as "voucherCount"
    FROM "up_expense_categories" c
    LEFT JOIN "up_expenses" e ON e.category_id = c.id
      AND e.deleted_at IS NULL
      AND e.expense_date >= '${rangeStart}'::date
      AND e.expense_date <= '${rangeEnd}'::date
      ${query.paymentMode ? `AND e.payment_mode = '${query.paymentMode}'` : ''}
      ${query.verified === 'true' ? 'AND e.verified = true' : query.verified === 'false' ? 'AND e.verified = false' : ''}
    WHERE c.active = true
      ${query.categoryId ? `AND c.id = '${query.categoryId}'` : ''}
    GROUP BY c.id, c.name, c.sort_order
    HAVING COUNT(e.id) > 0 OR c.id = '${query.categoryId || ''}'
    ORDER BY c.sort_order ASC, "totalAmount" DESC;
  `);

  // 4. Fetch All Itemized Expenses Grouped by Category
  const expenseRows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      e.id,
      e.amount,
      e.expense_date as "expenseDate",
      e.paid_to as "paidTo",
      e.note,
      e.payment_mode as "paymentMode",
      e.verified,
      e.created_at as "createdAt",
      c.id as "categoryId",
      c.name as "categoryName",
      u.first_name as "createdByName"
    FROM "up_expenses" e
    JOIN "up_expense_categories" c ON c.id = e.category_id
    LEFT JOIN "users" u ON u.id = e.created_by
    WHERE e.deleted_at IS NULL
      AND e.expense_date >= '${rangeStart}'::date
      AND e.expense_date <= '${rangeEnd}'::date
      ${query.categoryId ? `AND e.category_id = '${query.categoryId}'` : ''}
      ${query.paymentMode ? `AND e.payment_mode = '${query.paymentMode}'` : ''}
      ${query.verified === 'true' ? 'AND e.verified = true' : query.verified === 'false' ? 'AND e.verified = false' : ''}
    ORDER BY c.sort_order ASC, c.name ASC, e.expense_date ASC, e.created_at ASC;
  `);

  // Group itemized expenses by categoryId
  const expensesByCategory = new Map<string, any[]>();
  for (const exp of expenseRows) {
    const list = expensesByCategory.get(exp.categoryId) || [];
    list.push(exp);
    expensesByCategory.set(exp.categoryId, list);
  }

  // ── Construct PDF Content ──────────────────────────────────────────────────
  const content: Content[] = [];

  // ── Page 1: Header ─────────────────────────────────────────────────────────
  content.push({
    columns: [
      {
        width: 140,
        stack: [
          PACIFIC_LOGO_DATA_URL
            ? { image: PACIFIC_LOGO_DATA_URL, width: 130, height: 38, fit: [130, 38] }
            : { text: 'PRC HARDWARE', fontSize: 16, bold: true, color: COLOR_PRIMARY },
        ],
      },
      {
        width: '*',
        stack: [
          { text: 'PACIFIC PRODUCTS & SOLUTIONS', fontSize: 13, bold: true, color: COLOR_PRIMARY, alignment: 'right' },
          { text: 'UP MANUFACTURING FACILITY • PETTY CASH & EXPENSE DIVISION', fontSize: 8.5, color: COLOR_MUTED, alignment: 'right', margin: [0, 2, 0, 0] },
          { text: `Reporting Period: ${periodTitle.toUpperCase()}`, fontSize: 9.5, bold: true, color: COLOR_ACCENT, alignment: 'right', margin: [0, 3, 0, 0] },
        ],
      },
    ],
    margin: [0, 0, 0, 12],
  });

  content.push({
    canvas: [{ type: 'line', x1: 0, y1: 0, x2: 523, y2: 0, lineWidth: 2, lineColor: COLOR_ACCENT }],
    margin: [0, 0, 0, 14],
  });

  // Title Banner
  content.push({
    table: {
      widths: ['*'],
      body: [
        [
          {
            fillColor: COLOR_PRIMARY,
            text: 'UP FACTORY — MONTHLY & CATEGORY-WISE EXPENSE AUDIT REPORT',
            fontSize: 12,
            bold: true,
            color: '#FFFFFF',
            alignment: 'center',
            margin: [0, 6, 0, 6],
          },
        ],
      ],
    },
    layout: 'noBorders',
    margin: [0, 0, 0, 14],
  });

  // Executive KPI Deck (4-box layout)
  content.push({
    columns: [
      {
        width: '25%',
        table: {
          widths: ['*'],
          body: [
            [
              {
                fillColor: COLOR_LIGHT_BG,
                stack: [
                  { text: 'TOTAL PERIOD OUTFLOW', fontSize: 7.5, bold: true, color: COLOR_MUTED },
                  { text: formatINR(totalSpend), fontSize: 13, bold: true, color: COLOR_PRIMARY, margin: [0, 3, 0, 1] },
                  { text: `${totalCount} Vouchers Booked`, fontSize: 7, color: COLOR_MUTED },
                ],
                margin: [8, 6, 8, 6],
              },
            ],
          ],
        },
        layout: { hLineColor: () => COLOR_BORDER, vLineColor: () => COLOR_BORDER },
      },
      {
        width: '25%',
        table: {
          widths: ['*'],
          body: [
            [
              {
                fillColor: COLOR_LIGHT_BG,
                stack: [
                  { text: 'VERIFIED SPEND', fontSize: 7.5, bold: true, color: COLOR_MUTED },
                  { text: formatINR(verifiedSpend), fontSize: 13, bold: true, color: COLOR_VERIFIED, margin: [0, 3, 0, 1] },
                  { text: `${verifiedPct}% Approved by Super Admin`, fontSize: 7, color: COLOR_MUTED },
                ],
                margin: [8, 6, 8, 6],
              },
            ],
          ],
        },
        layout: { hLineColor: () => COLOR_BORDER, vLineColor: () => COLOR_BORDER },
      },
      {
        width: '25%',
        table: {
          widths: ['*'],
          body: [
            [
              {
                fillColor: COLOR_LIGHT_BG,
                stack: [
                  { text: 'PENDING AUDIT', fontSize: 7.5, bold: true, color: COLOR_MUTED },
                  { text: formatINR(unverifiedSpend), fontSize: 13, bold: true, color: COLOR_PENDING, margin: [0, 3, 0, 1] },
                  { text: `${(100 - Number(verifiedPct)).toFixed(1)}% Awaiting Verification`, fontSize: 7, color: COLOR_MUTED },
                ],
                margin: [8, 6, 8, 6],
              },
            ],
          ],
        },
        layout: { hLineColor: () => COLOR_BORDER, vLineColor: () => COLOR_BORDER },
      },
      {
        width: '25%',
        table: {
          widths: ['*'],
          body: [
            [
              {
                fillColor: COLOR_LIGHT_BG,
                stack: [
                  { text: 'DAILY RUN RATE & PEAK', fontSize: 7.5, bold: true, color: COLOR_MUTED },
                  { text: formatINR(avgDailySpend), fontSize: 13, bold: true, color: COLOR_DARK, margin: [0, 3, 0, 1] },
                  {
                    text: peakItem ? `Peak: ${formatINR(highestExpense)} (${formatDate(peakItem.date).slice(0, 6)})` : 'Peak: ₹0',
                    fontSize: 7,
                    color: COLOR_MUTED,
                    noWrap: true,
                  },
                ],
                margin: [8, 6, 8, 6],
              },
            ],
          ],
        },
        layout: { hLineColor: () => COLOR_BORDER, vLineColor: () => COLOR_BORDER },
      },
    ],
    columnGap: 8,
    margin: [0, 0, 0, 18],
  });

  // Category Summary Table Header
  content.push({
    text: 'EXECUTIVE CATEGORY ALLOCATION MATRIX',
    fontSize: 10,
    bold: true,
    color: COLOR_PRIMARY,
    margin: [0, 0, 0, 6],
  });

  const catSummaryBody: TableCell[][] = [
    [
      { text: '#', bold: true, fontSize: 8, color: '#FFFFFF', fillColor: COLOR_PRIMARY, alignment: 'center' },
      { text: 'Category Description', bold: true, fontSize: 8, color: '#FFFFFF', fillColor: COLOR_PRIMARY },
      { text: 'Vouchers', bold: true, fontSize: 8, color: '#FFFFFF', fillColor: COLOR_PRIMARY, alignment: 'center' },
      { text: 'Verified (₹)', bold: true, fontSize: 8, color: '#FFFFFF', fillColor: COLOR_PRIMARY, alignment: 'right' },
      { text: 'Pending (₹)', bold: true, fontSize: 8, color: '#FFFFFF', fillColor: COLOR_PRIMARY, alignment: 'right' },
      { text: 'Total Outflow (₹)', bold: true, fontSize: 8, color: '#FFFFFF', fillColor: COLOR_PRIMARY, alignment: 'right' },
      { text: 'Share (%)', bold: true, fontSize: 8, color: '#FFFFFF', fillColor: COLOR_PRIMARY, alignment: 'center' },
    ],
  ];

  categorySummaryRows.forEach((cat, idx) => {
    const isEven = idx % 2 === 0;
    const rowBg = isEven ? COLOR_LIGHT_BG : '#FFFFFF';
    const cTotal = Number(cat.totalAmount || 0);
    const cVerified = Number(cat.verifiedAmount || 0);
    const cUnverified = Number(cat.unverifiedAmount || 0);
    const cCount = Number(cat.voucherCount || 0);
    const share = totalSpend > 0 ? ((cTotal / totalSpend) * 100).toFixed(1) : '0.0';

    catSummaryBody.push([
      { text: String(idx + 1), fontSize: 8, alignment: 'center', fillColor: rowBg },
      { text: cat.name, fontSize: 8, bold: true, fillColor: rowBg },
      { text: String(cCount), fontSize: 8, alignment: 'center', fillColor: rowBg },
      { text: formatINR(cVerified), fontSize: 8, alignment: 'right', fillColor: rowBg, color: COLOR_VERIFIED },
      { text: formatINR(cUnverified), fontSize: 8, alignment: 'right', fillColor: rowBg, color: cUnverified > 0 ? COLOR_PENDING : COLOR_MUTED },
      { text: formatINR(cTotal), fontSize: 8, bold: true, alignment: 'right', fillColor: rowBg },
      { text: `${share}%`, fontSize: 8, bold: true, alignment: 'center', fillColor: rowBg, color: COLOR_ACCENT },
    ]);
  });

  // Totals Row
  catSummaryBody.push([
    { text: '', fillColor: COLOR_PRIMARY },
    { text: 'TOTAL OPERATIONAL EXPENDITURE', bold: true, fontSize: 8.5, color: '#FFFFFF', fillColor: COLOR_PRIMARY },
    { text: String(totalCount), bold: true, fontSize: 8.5, color: '#FFFFFF', fillColor: COLOR_PRIMARY, alignment: 'center' },
    { text: formatINR(verifiedSpend), bold: true, fontSize: 8.5, color: '#FFFFFF', fillColor: COLOR_PRIMARY, alignment: 'right' },
    { text: formatINR(unverifiedSpend), bold: true, fontSize: 8.5, color: '#FFFFFF', fillColor: COLOR_PRIMARY, alignment: 'right' },
    { text: formatINR(totalSpend), bold: true, fontSize: 9, color: '#FFFFFF', fillColor: COLOR_PRIMARY, alignment: 'right' },
    { text: '100.0%', bold: true, fontSize: 8.5, color: '#FFFFFF', fillColor: COLOR_PRIMARY, alignment: 'center' },
  ]);

  content.push({
    table: {
      headerRows: 1,
      widths: [20, '*', 45, 75, 75, 80, 50],
      body: catSummaryBody,
    },
    layout: {
      hLineColor: () => COLOR_BORDER,
      vLineColor: () => COLOR_BORDER,
      paddingLeft: () => 5,
      paddingRight: () => 5,
      paddingTop: () => 4,
      paddingBottom: () => 4,
    },
    margin: [0, 0, 0, 16],
  });

  // Summary Note on Page 1
  content.push({
    text: `Report generated on ${now.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} at ${now.toLocaleTimeString('en-IN')}. Contains ${categorySummaryRows.length} active cost categories and ${totalCount} audit records for ${periodTitle}. Detailed category-by-category itemized vouchers continue on the next page.`,
    fontSize: 7.5,
    italics: true,
    color: COLOR_MUTED,
    margin: [0, 4, 0, 0],
  });

  // ── Page 2+: Detailed Category-by-Category Itemized Ledgers ─────────────────
  content.push({ text: '', pageBreak: 'before' });

  content.push({
    text: `ITEMIZED CATEGORY VOUCHERS — ${periodTitle.toUpperCase()}`,
    fontSize: 12,
    bold: true,
    color: COLOR_PRIMARY,
    margin: [0, 0, 0, 12],
  });

  categorySummaryRows.forEach((cat, catIndex) => {
    const items = expensesByCategory.get(cat.id) || [];
    const cTotal = Number(cat.totalAmount || 0);
    const cCount = items.length;
    const share = totalSpend > 0 ? ((cTotal / totalSpend) * 100).toFixed(1) : '0';

    // Category Header Banner
    content.push({
      table: {
        widths: ['*', 'auto'],
        body: [
          [
            {
              fillColor: COLOR_ALT_ROW,
              stack: [
                { text: `CATEGORY ${catIndex + 1}: ${cat.name.toUpperCase()}`, fontSize: 9.5, bold: true, color: COLOR_PRIMARY },
                { text: `${cCount} Vouchers Booked • Comprises ${share}% of Period Budget`, fontSize: 7.5, color: COLOR_MUTED, margin: [0, 1, 0, 0] },
              ],
              margin: [8, 5, 8, 5],
            },
            {
              fillColor: COLOR_ALT_ROW,
              text: `Subtotal: ${formatINR(cTotal)}`,
              fontSize: 10,
              bold: true,
              color: COLOR_ACCENT,
              alignment: 'right',
              margin: [8, 8, 8, 5],
            },
          ],
        ],
      },
      layout: {
        hLineColor: () => COLOR_ACCENT,
        vLineColor: () => COLOR_ACCENT,
        hLineWidth: () => 1,
        vLineWidth: () => 1,
      },
      margin: [0, catIndex > 0 ? 16 : 0, 0, 6],
    });

    if (items.length === 0) {
      content.push({
        text: 'No individual expenses recorded in this category for the period.',
        fontSize: 8,
        italics: true,
        color: COLOR_MUTED,
        margin: [8, 4, 0, 8],
      });
      return;
    }

    const catVouchersBody: TableCell[][] = [
      [
        { text: 'Date', bold: true, fontSize: 7.5, color: '#FFFFFF', fillColor: COLOR_ACCENT, alignment: 'center' },
        { text: 'Voucher ID', bold: true, fontSize: 7.5, color: '#FFFFFF', fillColor: COLOR_ACCENT, alignment: 'center' },
        { text: 'Paid To / Vendor', bold: true, fontSize: 7.5, color: '#FFFFFF', fillColor: COLOR_ACCENT },
        { text: 'Mode', bold: true, fontSize: 7.5, color: '#FFFFFF', fillColor: COLOR_ACCENT, alignment: 'center' },
        { text: 'Note / Particulars', bold: true, fontSize: 7.5, color: '#FFFFFF', fillColor: COLOR_ACCENT },
        { text: 'Audit Status', bold: true, fontSize: 7.5, color: '#FFFFFF', fillColor: COLOR_ACCENT, alignment: 'center' },
        { text: 'Amount (₹)', bold: true, fontSize: 7.5, color: '#FFFFFF', fillColor: COLOR_ACCENT, alignment: 'right' },
      ],
    ];

    items.forEach((item, vIdx) => {
      const isEven = vIdx % 2 === 0;
      const vBg = isEven ? '#FFFFFF' : COLOR_LIGHT_BG;
      const amount = Number(item.amount || 0);

      catVouchersBody.push([
        { text: formatDate(item.expenseDate), fontSize: 7.5, alignment: 'center', fillColor: vBg },
        { text: String(item.id).slice(0, 8).toUpperCase(), fontSize: 7, font: 'Roboto', alignment: 'center', fillColor: vBg, color: COLOR_MUTED },
        { text: item.paidTo || '—', fontSize: 7.5, bold: true, fillColor: vBg },
        { text: (item.paymentMode || 'cash').toUpperCase(), fontSize: 7, alignment: 'center', fillColor: vBg },
        { text: item.note || '—', fontSize: 7.5, fillColor: vBg, color: item.note ? COLOR_DARK : COLOR_MUTED },
        {
          text: item.verified ? 'VERIFIED' : 'PENDING',
          fontSize: 7,
          bold: true,
          alignment: 'center',
          fillColor: vBg,
          color: item.verified ? COLOR_VERIFIED : COLOR_PENDING,
        },
        { text: formatINR(amount), fontSize: 7.5, bold: true, alignment: 'right', fillColor: vBg },
      ]);
    });

    // Category Total line
    catVouchersBody.push([
      { text: '', colSpan: 5, fillColor: COLOR_ALT_ROW },
      {}, {}, {}, {},
      { text: `${cat.name} Total:`, bold: true, fontSize: 8, alignment: 'right', fillColor: COLOR_ALT_ROW },
      { text: formatINR(cTotal), bold: true, fontSize: 8.5, color: COLOR_PRIMARY, alignment: 'right', fillColor: COLOR_ALT_ROW },
    ]);

    content.push({
      table: {
        headerRows: 1,
        widths: [55, 50, 105, 45, '*', 55, 70],
        body: catVouchersBody,
      },
      layout: {
        hLineColor: () => COLOR_BORDER,
        vLineColor: () => COLOR_BORDER,
        paddingLeft: () => 4,
        paddingRight: () => 4,
        paddingTop: () => 3.5,
        paddingBottom: () => 3.5,
      },
      margin: [0, 0, 0, 8],
    });
  });

  // ── Final Sign-Off & Audit Block ────────────────────────────────────────────
  content.push({
    unbreakable: true,
    stack: [
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 523, y2: 0, lineWidth: 1, lineColor: COLOR_BORDER }],
        margin: [0, 16, 0, 12],
      },
      {
        text: 'FINANCIAL COMPLIANCE & AUTHORIZATION DISCLOSURE',
        fontSize: 8.5,
        bold: true,
        color: COLOR_PRIMARY,
        margin: [0, 0, 0, 4],
      },
      {
        text: 'This document represents the immutable operational expense ledger of Pacific Products & Solutions (UP Factory Division). Every recorded transaction is logged with timestamps, actor IDs, and receipts under factory accounting rules. Verification statuses have been checked against the central audit trail.',
        fontSize: 7,
        color: COLOR_MUTED,
        margin: [0, 0, 0, 24],
      },
      {
        columns: [
          {
            width: '33%',
            stack: [
              { canvas: [{ type: 'line', x1: 10, y1: 0, x2: 150, y2: 0, lineWidth: 1, lineColor: COLOR_DARK }] },
              { text: 'Prepared By', fontSize: 8, bold: true, alignment: 'center', margin: [0, 4, 0, 1] },
              { text: 'Accounts & Float Officer\nUP Manufacturing Facility', fontSize: 6.5, color: COLOR_MUTED, alignment: 'center' },
            ],
          },
          {
            width: '33%',
            stack: [
              { canvas: [{ type: 'line', x1: 10, y1: 0, x2: 150, y2: 0, lineWidth: 1, lineColor: COLOR_DARK }] },
              { text: 'Verified By', fontSize: 8, bold: true, alignment: 'center', margin: [0, 4, 0, 1] },
              { text: 'UP Works Manager\nPlant Operations Head', fontSize: 6.5, color: COLOR_MUTED, alignment: 'center' },
            ],
          },
          {
            width: '34%',
            stack: [
              { canvas: [{ type: 'line', x1: 10, y1: 0, x2: 150, y2: 0, lineWidth: 1, lineColor: COLOR_DARK }] },
              { text: 'Authorized By', fontSize: 8, bold: true, alignment: 'center', margin: [0, 4, 0, 1] },
              { text: 'Super Administrator\nManaging Director', fontSize: 6.5, color: COLOR_MUTED, alignment: 'center' },
            ],
          },
        ],
      },
    ],
    margin: [0, 8, 0, 0],
  });

  // ── Document Definition ────────────────────────────────────────────────────
  const docDefinition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: [36, 40, 36, 40],
    content,
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        {
          text: `Pacific Products & Solutions • UP Factory Expense Ledger • ${periodTitle}`,
          fontSize: 7,
          color: COLOR_MUTED,
          margin: [36, 0, 0, 0],
        },
        {
          text: `Page ${currentPage} of ${pageCount}`,
          fontSize: 7,
          color: COLOR_MUTED,
          alignment: 'right',
          margin: [0, 0, 36, 0],
        },
      ],
    }),
    styles: {
      header: {
        fontSize: 14,
        bold: true,
      },
    } as StyleDictionary,
    defaultStyle: {
      font: 'Roboto',
      fontSize: 8,
      color: COLOR_DARK,
    },
  };

  const pdfDoc = pdfmake.createPdf(docDefinition);

  const safePeriod = periodTitle.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `UP_Category_Expense_Report_${safePeriod}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  pdfDoc.getBuffer((buffer: any) => {
    res.send(Buffer.from(buffer));
  });
};
