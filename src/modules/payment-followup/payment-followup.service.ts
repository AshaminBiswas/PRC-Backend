/**
 * payment-followup.service.ts
 *
 * Core business logic for the Payment Follow-up & Dues Recovery module.
 * Aggregates live and historical outstanding balances, computes real-time aging,
 * manages old customer onboarding, touchpoint notes, dispute workflows, and bulk operations.
 */

import bcrypt from 'bcryptjs';
import prisma from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import {
  CustomerDueSummary,
  CustomerDuesDetail,
  TraceableDueItem,
  DuesDashboardMetrics,
  AgingBucket,
  DueSourceType,
  AddOldCustomerInput,
  DuplicateWarningMatch,
  LogFollowupInput,
  DeclineDisputeInput,
  BulkActionPreviewResult,
  BulkActionResult,
  FollowupProfileStatus,
  AddCustomerBalanceEntryInput,
  SendCustomerCommunicationInput,
  SelectableDocumentItem,
  StatementLedgerRow,
} from './payment-followup.types';
import { CustomerLedgerPdfInput, generateCustomerLedgerPdfBuffer } from './customer-ledger-pdf.service';
import { paymentFollowupResendService } from './payment-followup-resend.service';
import { smsReminderService } from './sms-reminder.service';
import { paymentAllocationService } from './payment-allocation.service';
import { generateProformaPdf } from '../proforma-invoices/proforma-invoice-pdf.service';
import { generatePurchaseOrderPdfBuffer } from '../inventory/purchase-order-pdf.service';
import { generateQuotationPdf } from '../quotes/quotation-pdf.service';

export class PaymentFollowupService {
  /**
   * Helper to compute days difference between two dates.
   */
  private computeDaysDifference(dueDate: Date | string, now: Date = new Date()): number {
    const due = new Date(dueDate).getTime();
    const current = now.getTime();
    if (current <= due) return 0;
    return Math.floor((current - due) / (1000 * 60 * 60 * 24));
  }

  /**
   * Helper to determine aging bucket from days overdue.
   */
  private getAgingBucket(daysOverdue: number): AgingBucket {
    if (daysOverdue <= 30) return '0_30';
    if (daysOverdue <= 60) return '31_60';
    if (daysOverdue <= 90) return '61_90';
    return '90_PLUS';
  }

  /**
   * Checks for potential duplicate customer accounts before onboarding.
   */
  public async checkDuplicateCustomer(input: {
    phone?: string;
    email?: string;
    gstin?: string;
    companyName?: string;
  }): Promise<DuplicateWarningMatch[]> {
    const orConditions: any[] = [];

    const cleanPhone = input.phone ? input.phone.replace(/\D/g, '').slice(-10) : '';
    if (cleanPhone) {
      orConditions.push({ phone: { contains: cleanPhone } });
    }

    if (input.email && input.email.trim()) {
      orConditions.push({ email: { equals: input.email.trim().toLowerCase(), mode: 'insensitive' } });
    }

    if (input.gstin && input.gstin.trim()) {
      orConditions.push({ gstin: { equals: input.gstin.trim().toUpperCase(), mode: 'insensitive' } });
    }

    if (input.companyName && input.companyName.trim().length >= 4) {
      orConditions.push({ companyName: { contains: input.companyName.trim(), mode: 'insensitive' } });
    }

    if (orConditions.length === 0) return [];

    const matches = await prisma.user.findMany({
      where: {
        OR: orConditions,
        deletedAt: null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        companyName: true,
        phone: true,
        email: true,
        gstin: true,
      },
      take: 5,
    });

    const results: DuplicateWarningMatch[] = [];

    for (const m of matches) {
      const matchedFields: string[] = [];
      const mPhone = (m.phone || '').replace(/\D/g, '').slice(-10);

      if (cleanPhone && mPhone && (mPhone === cleanPhone || mPhone.includes(cleanPhone))) {
        matchedFields.push('phone');
      }
      if (input.email && m.email && m.email.toLowerCase() === input.email.trim().toLowerCase()) {
        matchedFields.push('email');
      }
      if (input.gstin && m.gstin && m.gstin.toUpperCase() === input.gstin.trim().toUpperCase()) {
        matchedFields.push('gstin');
      }
      if (
        input.companyName &&
        m.companyName &&
        m.companyName.toLowerCase().includes(input.companyName.trim().toLowerCase())
      ) {
        matchedFields.push('companyName');
      }

      if (matchedFields.length > 0) {
        results.push({
          id: m.id,
          name: `${m.firstName} ${m.lastName}`.trim(),
          companyName: m.companyName,
          phone: m.phone,
          email: m.email,
          gstin: m.gstin,
          matchedFields,
        });
      }
    }

    return results;
  }

  /**
   * Onboards a legacy historical customer with legitimate opening balance (no fake invoices).
   */
  public async addOldCustomer(userId: string | undefined, input: AddOldCustomerInput) {
    if (!input.customerName || !input.customerName.trim()) {
      throw new AppError('BAD_REQUEST', 'Customer name is required', 400);
    }

    const openingDue = Number(input.openingDueBalance || 0);
    if (openingDue < 0) {
      throw new AppError('BAD_REQUEST', 'Opening due balance cannot be negative', 400);
    }

    const refDate = input.referenceDate ? new Date(input.referenceDate) : new Date();
    const nameParts = input.customerName.trim().split(' ');
    const firstName = nameParts[0] || 'Customer';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Generate unique internal email placeholder if email not provided
    const userEmail = input.email && input.email.trim()
      ? input.email.trim().toLowerCase()
      : `legacy_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@internal.prc`;

    const dummyPasswordHash = await bcrypt.hash(`PrcOldCust#${Date.now()}`, 10);

    return await prisma.$transaction(async (tx) => {
      // 1. Create User
      const user = await tx.user.create({
        data: {
          firstName,
          lastName,
          companyName: input.companyName?.trim() || null,
          email: userEmail,
          phone: input.phone?.trim() || null,
          gstin: input.gstin?.trim().toUpperCase() || null,
          passwordHash: dummyPasswordHash,
          source: 'OLD_CUSTOMER',
          status: 'ACTIVE',
        },
      });

      // 2. Create Address if provided
      if (input.billingAddress || input.shippingAddress) {
        await tx.address.create({
          data: {
            userId: user.id,
            type: 'BILLING',
            addressLine1: input.billingAddress || input.shippingAddress || 'Headquarters',
            city: 'Delhi',
            state: 'Delhi',
            postalCode: '110093',
            country: 'India',
            isDefault: true,
          },
        });
      }

      // 3. Create Opening Balance Entry
      let openingBalanceEntry = null;
      if (openingDue > 0) {
        openingBalanceEntry = await tx.openingBalanceEntry.create({
          data: {
            customerId: user.id,
            customerName: input.customerName.trim(),
            companyName: input.companyName?.trim() || null,
            openingAmount: openingDue,
            paidAmount: 0,
            remainingBalance: openingDue,
            referenceDate: refDate,
            referenceNote: input.notes || 'Historical legacy opening dues balance',
            sourceType: 'OLD_CUSTOMER',
            status: 'PENDING',
            createdById: userId || 'system',
          },
        });
      }

      // 4. Initialize Payment Followup Profile
      const initialProfile = await tx.paymentFollowupProfile.create({
        data: {
          customerId: user.id,
          status: openingDue > 0 ? 'ACTIVE' : 'PAID',
          notes: input.notes || null,
        },
      });

      // 5. Log audit entry
      await tx.paymentFollowupEntry.create({
        data: {
          customerId: user.id,
          followupType: 'NOTE',
          outcome: 'CALL_MADE',
          notes: `Legacy customer onboarded. Opening Due: \u20B9${openingDue.toLocaleString('en-IN')} as of ${refDate.toLocaleDateString('en-IN')}.${input.notes ? ` Notes: ${input.notes}` : ''}`,
          performedById: userId || 'system',
          performedByName: 'Admin Operations',
        },
      });

      return {
        customer: user,
        openingBalance: openingBalanceEntry,
        profile: initialProfile,
      };
    });
  }

  /**
   * Retrieves high-level dues dashboard metrics across all customers.
   */
  public async getDuesDashboardMetrics(): Promise<DuesDashboardMetrics> {
    const listResult = await this.listCustomerDues({ limit: 5000 });
    const customers = listResult.items;

    let totalOutstanding = 0;
    let overdueAmount = 0;
    let bucket0_30Count = 0;
    let bucket0_30Amount = 0;
    let bucket31_60Count = 0;
    let bucket31_60Amount = 0;
    let bucket61_90Count = 0;
    let bucket61_90Amount = 0;
    let bucket90_plusCount = 0;
    let bucket90_plusAmount = 0;
    let todayFollowupsCount = 0;
    let declinedDisputedCount = 0;
    let declinedDisputedAmount = 0;

    const todayStr = new Date().toISOString().slice(0, 10);

    for (const c of customers) {
      if (c.totalOutstanding <= 0) continue;

      totalOutstanding += c.totalOutstanding;
      overdueAmount += c.overdueAmount;

      if (c.followupStatus === 'DECLINED' || c.followupStatus === 'DISPUTED') {
        declinedDisputedCount++;
        declinedDisputedAmount += c.totalOutstanding;
      }

      if (c.nextActionDate && c.nextActionDate.slice(0, 10) === todayStr) {
        todayFollowupsCount++;
      }

      switch (c.agingBucket) {
        case '0_30':
          bucket0_30Count++;
          bucket0_30Amount += c.totalOutstanding;
          break;
        case '31_60':
          bucket31_60Count++;
          bucket31_60Amount += c.totalOutstanding;
          break;
        case '61_90':
          bucket61_90Count++;
          bucket61_90Amount += c.totalOutstanding;
          break;
        case '90_PLUS':
          bucket90_plusCount++;
          bucket90_plusAmount += c.totalOutstanding;
          break;
      }
    }

    return {
      totalOutstanding: Math.round(totalOutstanding * 100) / 100,
      overdueAmount: Math.round(overdueAmount * 100) / 100,
      customersWithDuesCount: customers.filter((c) => c.totalOutstanding > 0).length,
      bucket0_30Count,
      bucket0_30Amount: Math.round(bucket0_30Amount * 100) / 100,
      bucket31_60Count,
      bucket31_60Amount: Math.round(bucket31_60Amount * 100) / 100,
      bucket61_90Count,
      bucket61_90Amount: Math.round(bucket61_90Amount * 100) / 100,
      bucket90_plusCount,
      bucket90_plusAmount: Math.round(bucket90_plusAmount * 100) / 100,
      todayFollowupsCount,
      declinedDisputedCount,
      declinedDisputedAmount: Math.round(declinedDisputedAmount * 100) / 100,
    };
  }

  /**
   * Lists customers with dues, dynamic aging calculation, and status filters.
   */
  public async listCustomerDues(query: {
    page?: number;
    limit?: number;
    search?: string;
    agingBucket?: string;
    followupStatus?: string;
    missingInfo?: string; // 'EMAIL' | 'PHONE' | 'GSTIN'
    sortBy?: 'aging' | 'amount' | 'lastFollowup' | 'customer';
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ items: CustomerDueSummary[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(5000, Math.max(1, Number(query.limit || 50)));

    // Fetch users with existing dues indicators
    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        OR: [
          { openingBalances: { some: { remainingBalance: { gt: 0 } } } },
          { invoices: { some: { status: { notIn: ['PAID', 'CANCELLED', 'ARCHIVED'] } } } },
          { b2bOrdersCustomer: { some: { dueAmount: { gt: 0 }, status: { notIn: ['cancelled', 'rejected'] } } } },
          { proformaInvoices: { some: { balanceDue: { gt: 0 }, status: { notIn: ['CANCELLED', 'EXPIRED'] } } } },
          { paymentFollowupProfile: { isNot: null } },
        ],
      },
      include: {
        openingBalances: { where: { remainingBalance: { gt: 0 } } },
        invoices: { where: { status: { notIn: ['PAID', 'CANCELLED', 'ARCHIVED'] } } },
        b2bOrdersCustomer: { where: { dueAmount: { gt: 0 }, status: { notIn: ['cancelled', 'rejected'] } } },
        proformaInvoices: { where: { balanceDue: { gt: 0 }, status: { notIn: ['CANCELLED', 'EXPIRED'] } } },
        paymentFollowupProfile: true,
        paymentFollowupEntries: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    const now = new Date();
    const customerSummaries: CustomerDueSummary[] = [];

    for (const u of users) {
      let totalOutstanding = 0;
      let overdueAmount = 0;
      let maxDaysOverdue = 0;
      let oldestDueDate: string | null = null;
      let oldestDueTime = Infinity;
      let invoicesCount = 0;

      // 1. Opening balances
      for (const ob of u.openingBalances) {
        const bal = Number(ob.remainingBalance || 0);
        if (bal > 0) {
          totalOutstanding += bal;
          invoicesCount++;
          const days = this.computeDaysDifference(ob.referenceDate, now);
          if (days > maxDaysOverdue) maxDaysOverdue = days;
          if (days > 0) overdueAmount += bal;

          const obTime = new Date(ob.referenceDate).getTime();
          if (obTime < oldestDueTime) {
            oldestDueTime = obTime;
            oldestDueDate = ob.referenceDate.toISOString();
          }
        }
      }

      // 2. Invoices
      for (const inv of u.invoices) {
        const invTotal = Number(inv.grandTotal || 0);
        // Note: Check prior allocations
        const priorAllocations = await prisma.paymentAllocation.aggregate({
          where: { targetType: 'TAX_INVOICE', targetId: inv.id },
          _sum: { allocatedAmount: true },
        });
        const prevPaid = Number(priorAllocations._sum.allocatedAmount || 0);
        const remBal = Math.max(0, Math.round((invTotal - prevPaid) * 100) / 100);

        if (remBal > 0) {
          totalOutstanding += remBal;
          invoicesCount++;
          const dueDate = inv.dueDate || inv.createdAt;
          const days = this.computeDaysDifference(dueDate, now);
          if (days > maxDaysOverdue) maxDaysOverdue = days;
          if (days > 0) overdueAmount += remBal;

          const invTime = new Date(dueDate).getTime();
          if (invTime < oldestDueTime) {
            oldestDueTime = invTime;
            oldestDueDate = new Date(dueDate).toISOString();
          }
        }
      }

      // 3. B2B Orders
      for (const ord of u.b2bOrdersCustomer) {
        const due = Number(ord.dueAmount || 0);
        if (due > 0) {
          totalOutstanding += due;
          invoicesCount++;
          const days = this.computeDaysDifference(ord.createdAt, now);
          if (days > maxDaysOverdue) maxDaysOverdue = days;
          if (days > 0) overdueAmount += due;

          const ordTime = new Date(ord.createdAt).getTime();
          if (ordTime < oldestDueTime) {
            oldestDueTime = ordTime;
            oldestDueDate = ord.createdAt.toISOString();
          }
        }
      }

      // 4. Proforma Invoices
      for (const pi of u.proformaInvoices) {
        const due = Number(pi.balanceDue || 0);
        if (due > 0) {
          totalOutstanding += due;
          invoicesCount++;
          const dueDate = pi.validUntil || pi.createdAt;
          const days = this.computeDaysDifference(dueDate, now);
          if (days > maxDaysOverdue) maxDaysOverdue = days;
          if (days > 0) overdueAmount += due;

          const piTime = new Date(dueDate).getTime();
          if (piTime < oldestDueTime) {
            oldestDueTime = piTime;
            oldestDueDate = new Date(dueDate).toISOString();
          }
        }
      }

      totalOutstanding = Math.round(totalOutstanding * 100) / 100;
      overdueAmount = Math.round(overdueAmount * 100) / 100;

      const profile = u.paymentFollowupProfile;
      const lastEntry = u.paymentFollowupEntries[0];

      const rawEmail = (u.email || '').trim();
      const isPlaceholderEmail = rawEmail.includes('@internal.prc') || rawEmail.startsWith('legacy_');
      const missingEmail = !rawEmail || isPlaceholderEmail;
      const missingPhone = !u.phone || u.phone.trim().length < 10;
      const missingGstin = !u.gstin || u.gstin.trim().length < 15;

      const agingBucket = this.getAgingBucket(maxDaysOverdue);
      let followupStatus = (profile?.status as FollowupProfileStatus) || 'ACTIVE';
      if (followupStatus === 'ACTIVE' && maxDaysOverdue > 0) {
        followupStatus = 'OVERDUE';
      }

      customerSummaries.push({
        customerId: u.id,
        customerName: `${u.firstName} ${u.lastName}`.trim(),
        companyName: u.companyName,
        phone: u.phone,
        email: isPlaceholderEmail ? null : u.email,
        gstin: u.gstin,
        source: u.source || 'ORGANIC',
        missingEmail,
        missingPhone,
        missingGstin,
        totalOutstanding,
        overdueAmount,
        oldestDueDate,
        maxDaysOverdue,
        agingBucket,
        invoicesCount,
        followupStatus,
        declineReason: profile?.declineReason,
        declinedAt: profile?.declinedAt ? profile.declinedAt.toISOString() : null,
        declinedByName: null,
        lastFollowupDate: profile?.lastFollowupAt ? profile.lastFollowupAt.toISOString() : null,
        lastFollowupChannel: lastEntry?.followupType || null,
        lastFollowupOutcome: lastEntry?.outcome || null,
        lastPaymentDate: profile?.lastPaymentAt ? profile.lastPaymentAt.toISOString() : null,
        nextActionDate: profile?.nextActionDate ? profile.nextActionDate.toISOString() : null,
        ptpDate: profile?.ptpDate ? profile.ptpDate.toISOString() : null,
        ptpAmount: profile?.ptpAmount ? Number(profile.ptpAmount) : null,
        totalRemindersSent: profile?.totalRemindersSent || 0,
      });
    }

    // Apply Filters
    let filtered = customerSummaries;

    // Search filter
    if (query.search && query.search.trim()) {
      const q = query.search.trim().toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.customerName.toLowerCase().includes(q) ||
          (c.companyName && c.companyName.toLowerCase().includes(q)) ||
          (c.phone && c.phone.includes(q)) ||
          (c.email && c.email.toLowerCase().includes(q)) ||
          (c.gstin && c.gstin.toLowerCase().includes(q))
      );
    }

    // Aging Bucket filter
    if (query.agingBucket && query.agingBucket !== 'ALL') {
      filtered = filtered.filter((c) => c.agingBucket === query.agingBucket);
    }

    // Followup Status filter
    if (query.followupStatus && query.followupStatus !== 'ALL') {
      if (query.followupStatus === 'DISPUTED_OR_DECLINED') {
        filtered = filtered.filter((c) => c.followupStatus === 'DISPUTED' || c.followupStatus === 'DECLINED');
      } else {
        filtered = filtered.filter((c) => c.followupStatus === query.followupStatus);
      }
    }

    // Missing Info filter
    if (query.missingInfo) {
      if (query.missingInfo === 'EMAIL') filtered = filtered.filter((c) => c.missingEmail);
      if (query.missingInfo === 'PHONE') filtered = filtered.filter((c) => c.missingPhone);
      if (query.missingInfo === 'GSTIN') filtered = filtered.filter((c) => c.missingGstin);
    }

    // Sort
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    filtered.sort((a, b) => {
      if (query.sortBy === 'amount') {
        return (a.totalOutstanding - b.totalOutstanding) * sortOrder;
      }
      if (query.sortBy === 'customer') {
        return a.customerName.localeCompare(b.customerName) * sortOrder;
      }
      if (query.sortBy === 'lastFollowup') {
        const dateA = a.lastFollowupDate ? new Date(a.lastFollowupDate).getTime() : 0;
        const dateB = b.lastFollowupDate ? new Date(b.lastFollowupDate).getTime() : 0;
        return (dateA - dateB) * sortOrder;
      }
      // default: aging (days overdue)
      return (a.maxDaysOverdue - b.maxDaysOverdue) * sortOrder;
    });

    const total = filtered.length;
    const paginated = filtered.slice((page - 1) * limit, page * limit);

    return {
      items: paginated,
      total,
      page,
      limit,
    };
  }

  /**
   * Retrieves complete 360-degree dues detail for a specific customer.
   */
  public async getCustomerDuesDetail(customerId: string): Promise<CustomerDuesDetail> {
    const customer = await prisma.user.findUnique({
      where: { id: customerId, deletedAt: null },
      include: {
        addresses: { take: 2 },
        paymentFollowupProfile: true,
        paymentFollowupEntries: { orderBy: { createdAt: 'desc' }, take: 50 },
        paymentFollowupEmailLogs: { orderBy: { createdAt: 'desc' }, take: 20 },
        paymentFollowupSmsLogs: { orderBy: { createdAt: 'desc' }, take: 20 },
        paymentAllocations: { orderBy: { paymentDate: 'desc' }, take: 50 },
      },
    });

    if (!customer) {
      throw new AppError('NOT_FOUND', 'Customer not found', 404);
    }

    const rawEmail = (customer.email || '').trim();
    const isPlaceholderEmail = rawEmail.includes('@internal.prc') || rawEmail.startsWith('legacy_');

    const billingAddr = customer.addresses.find((a) => a.type === 'BILLING') || customer.addresses[0];
    const shippingAddr = customer.addresses.find((a) => a.type === 'SHIPPING') || customer.addresses[1] || billingAddr;

    const billingStr = billingAddr
      ? `${billingAddr.addressLine1}, ${billingAddr.city}, ${billingAddr.state} - ${billingAddr.postalCode}`
      : null;
    const shippingStr = shippingAddr
      ? `${shippingAddr.addressLine1}, ${shippingAddr.city}, ${shippingAddr.state} - ${shippingAddr.postalCode}`
      : null;

    const billingDetails = billingAddr
      ? {
          addressLine1: billingAddr.addressLine1,
          addressLine2: billingAddr.addressLine2 || undefined,
          city: billingAddr.city,
          state: billingAddr.state,
          postalCode: billingAddr.postalCode,
          country: billingAddr.country || 'India',
        }
      : null;
    const shippingDetails = shippingAddr
      ? {
          addressLine1: shippingAddr.addressLine1,
          addressLine2: shippingAddr.addressLine2 || undefined,
          city: shippingAddr.city,
          state: shippingAddr.state,
          postalCode: shippingAddr.postalCode,
          country: shippingAddr.country || 'India',
        }
      : billingDetails;

    // Fetch active dues
    const openingBalances = await prisma.openingBalanceEntry.findMany({
      where: { customerId },
      orderBy: { referenceDate: 'desc' },
    });

    const taxInvoices = await prisma.invoice.findMany({
      where: { customerId, status: { notIn: ['CANCELLED', 'ARCHIVED'] } },
      orderBy: { createdAt: 'desc' },
    });

    const b2bOrders = await (prisma as any).b2bOrder.findMany({
      where: { customerId, status: { notIn: ['cancelled', 'rejected'] } },
      orderBy: { createdAt: 'desc' },
    });

    const proformas = await prisma.proformaInvoice.findMany({
      where: { customerId, deletedAt: null, status: { notIn: ['CANCELLED', 'EXPIRED'] } },
      orderBy: { createdAt: 'desc' },
    });

    const quotes = await prisma.quote.findMany({
      where: {
        OR: [
          { userId: customerId },
          ...(customer.email ? [{ email: customer.email }] : []),
          ...(customer.companyName ? [{ companyName: { contains: customer.companyName, mode: 'insensitive' as const } }] : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const poSubmissions = await prisma.poSubmission.findMany({
      where: {
        OR: [
          ...(customer.email ? [{ customerEmail: customer.email }] : []),
          ...(customer.companyName ? [{ companyName: { contains: customer.companyName, mode: 'insensitive' as const } }] : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const now = new Date();
    const duesList: TraceableDueItem[] = [];

    // Opening balances
    for (const ob of openingBalances) {
      const remBal = Number(ob.remainingBalance || 0);
      const days = this.computeDaysDifference(ob.referenceDate, now);
      duesList.push({
        id: ob.id,
        sourceType: 'OPENING_BALANCE',
        documentNumber: `OB-${ob.id.slice(0, 8).toUpperCase()}`,
        referenceDate: ob.referenceDate.toISOString(),
        dueDate: ob.referenceDate.toISOString(),
        totalAmount: Number(ob.openingAmount),
        paidAmount: Number(ob.paidAmount),
        balanceDue: remBal,
        paymentTerms: 'Historical Opening Balance',
        daysOverdue: days,
        agingBucket: this.getAgingBucket(days),
        status: ob.status,
        notes: ob.referenceNote,
        rawDoc: ob,
      });
    }

    // Tax Invoices
    for (const inv of taxInvoices) {
      const priorAllocations = await prisma.paymentAllocation.aggregate({
        where: { targetType: 'TAX_INVOICE', targetId: inv.id },
        _sum: { allocatedAmount: true },
      });
      const prevPaid = Number(priorAllocations._sum.allocatedAmount || 0);
      const remBal = Math.max(0, Math.round((Number(inv.grandTotal) - prevPaid) * 100) / 100);
      const dueDate = inv.dueDate || inv.createdAt;
      const days = this.computeDaysDifference(dueDate, now);

      duesList.push({
        id: inv.id,
        sourceType: 'TAX_INVOICE',
        documentNumber: inv.invoiceNumber,
        referenceDate: inv.createdAt.toISOString(),
        dueDate: new Date(dueDate).toISOString(),
        deliveryDate: inv.signedAt ? inv.signedAt.toISOString() : null,
        totalAmount: Number(inv.grandTotal),
        paidAmount: prevPaid,
        balanceDue: remBal,
        paymentTerms: inv.paymentTerms || '30 Days Credit',
        daysOverdue: days,
        agingBucket: this.getAgingBucket(days),
        status: inv.status,
        notes: inv.notes,
        rawDoc: inv,
      });
    }

    // B2B Orders
    for (const ord of b2bOrders) {
      const due = Number(ord.dueAmount || 0);
      const days = this.computeDaysDifference(ord.createdAt, now);
      duesList.push({
        id: ord.id,
        sourceType: 'B2B_ORDER',
        documentNumber: ord.orderNumber,
        referenceDate: ord.createdAt.toISOString(),
        dueDate: ord.createdAt.toISOString(),
        totalAmount: Number(ord.grandTotal),
        paidAmount: Number(ord.paidAmount),
        balanceDue: due,
        paymentTerms: ord.paymentMethod || 'Commercial Terms',
        daysOverdue: days,
        agingBucket: this.getAgingBucket(days),
        status: ord.status,
        rawDoc: ord,
      });
    }

    // Proforma Invoices
    for (const pi of proformas) {
      const due = Number(pi.balanceDue || 0);
      const dueDate = pi.validUntil || pi.createdAt;
      const days = this.computeDaysDifference(dueDate, now);
      duesList.push({
        id: pi.id,
        sourceType: 'PROFORMA_INVOICE',
        documentNumber: pi.piNumber,
        referenceDate: pi.createdAt.toISOString(),
        dueDate: new Date(dueDate).toISOString(),
        totalAmount: Number(pi.grandTotal),
        paidAmount: Number(pi.advanceAmount),
        balanceDue: due,
        paymentTerms: pi.paymentTerms || 'Advance Deposit',
        daysOverdue: days,
        agingBucket: this.getAgingBucket(days),
        status: pi.status,
        notes: pi.notes,
        rawDoc: pi,
      });
    }

    const totalOutstanding = Math.round(duesList.reduce((sum, d) => sum + d.balanceDue, 0) * 100) / 100;
    const overdueAmount = Math.round(duesList.filter((d) => d.daysOverdue > 0).reduce((sum, d) => sum + d.balanceDue, 0) * 100) / 100;
    const maxDaysOverdue = Math.max(0, ...duesList.map((d) => d.daysOverdue));

    let oldestDueDate: string | null = null;
    let minTime = Infinity;
    for (const d of duesList) {
      const t = new Date(d.dueDate).getTime();
      if (t < minTime) {
        minTime = t;
        oldestDueDate = d.dueDate;
      }
    }

    // Financial totals
    const totalBilledAmount = Math.round(
      (openingBalances.reduce((sum, ob) => sum + Number(ob.openingAmount), 0) +
        taxInvoices.reduce((sum, inv) => sum + Number(inv.grandTotal), 0) +
        b2bOrders.reduce((sum: number, ord: any) => sum + Number(ord.grandTotal), 0) +
        proformas.reduce((sum, pi) => sum + Number(pi.grandTotal), 0)) * 100
    ) / 100;

    const totalAdvancePaid = Math.round(
      proformas.reduce((sum, pi) => sum + Number(pi.advanceAmount || 0), 0) * 100
    ) / 100;

    const totalPaymentsCollected = Math.round(
      customer.paymentAllocations.reduce((sum, a) => sum + Number(a.allocatedAmount || 0), 0) * 100
    ) / 100;

    const netBalanceDue = totalOutstanding;

    // Aging breakdown
    const bucket0_30 = duesList.filter((d) => d.agingBucket === '0_30').reduce((sum, d) => sum + d.balanceDue, 0);
    const bucket31_60 = duesList.filter((d) => d.agingBucket === '31_60').reduce((sum, d) => sum + d.balanceDue, 0);
    const bucket61_90 = duesList.filter((d) => d.agingBucket === '61_90').reduce((sum, d) => sum + d.balanceDue, 0);
    const bucket90_plus = duesList.filter((d) => d.agingBucket === '90_PLUS').reduce((sum, d) => sum + d.balanceDue, 0);

    // Build chronological ledger entries
    const allEvents: Array<{
      date: Date;
      refNo: string;
      description: string;
      debit: number;
      credit: number;
    }> = [];

    for (const d of duesList) {
      allEvents.push({
        date: new Date(d.referenceDate),
        refNo: d.documentNumber,
        description: d.sourceType === 'OPENING_BALANCE' ? 'Historical Opening Dues' : `${d.sourceType} Billing`,
        debit: d.totalAmount,
        credit: 0,
      });
    }

    for (const a of customer.paymentAllocations) {
      allEvents.push({
        date: new Date(a.paymentDate),
        refNo: a.transactionRef ? `REF-${a.transactionRef}` : 'PAYMENT',
        description: `Payment via ${a.paymentMode} against ${a.targetDocumentNumber || a.targetType}`,
        debit: 0,
        credit: Number(a.allocatedAmount),
      });
    }

    allEvents.sort((a, b) => a.date.getTime() - b.date.getTime());

    let runningBal = 0;
    const ledgerEntries: StatementLedgerRow[] = allEvents.map((ev) => {
      runningBal += ev.debit - ev.credit;
      return {
        date: ev.date.toISOString(),
        refNo: ev.refNo,
        description: ev.description,
        debit: ev.debit,
        credit: ev.credit,
        balance: Math.round(runningBal * 100) / 100,
      };
    });

    const selectableDocuments = {
      proformas: proformas.map((pi) => ({
        id: pi.id,
        type: 'PROFORMA_INVOICE' as const,
        documentNumber: pi.piNumber,
        date: pi.createdAt.toISOString(),
        amount: Number(pi.grandTotal),
        balanceDue: Number(pi.balanceDue || 0),
        status: pi.status,
        viewUrl: `/proforma-invoices/view/${pi.id}`,
      })),
      purchaseOrders: poSubmissions.map((po) => ({
        id: po.id,
        type: 'PURCHASE_ORDER' as const,
        documentNumber: po.customerPoNumber || po.poSubmissionId || `PO-${po.id.slice(0, 8)}`,
        date: po.createdAt.toISOString(),
        amount: 0,
        status: po.status,
        viewUrl: `/po-management/${po.id}`,
      })),
      quotations: quotes.map((q) => ({
        id: q.id,
        type: 'QUOTATION' as const,
        documentNumber: q.quoteNumber,
        date: q.createdAt.toISOString(),
        amount: Number(q.grandTotal || q.subtotal || 0),
        status: q.status,
        viewUrl: `/quotes/${q.id}`,
      })),
      invoices: taxInvoices.map((inv) => ({
        id: inv.id,
        type: 'TAX_INVOICE' as const,
        documentNumber: inv.invoiceNumber,
        date: inv.createdAt.toISOString(),
        amount: Number(inv.grandTotal),
        balanceDue: inv.status === 'PAID' ? 0 : Number(inv.grandTotal),
        status: inv.status,
      })),
    };

    const profile = customer.paymentFollowupProfile;

    return {
      customer: {
        id: customer.id,
        name: `${customer.firstName} ${customer.lastName}`.trim(),
        companyName: customer.companyName,
        phone: customer.phone,
        email: isPlaceholderEmail ? null : customer.email,
        gstin: customer.gstin,
        source: customer.source || 'ORGANIC',
        billingAddress: billingStr,
        shippingAddress: shippingStr,
        billingAddressDetails: billingDetails,
        shippingAddressDetails: shippingDetails,
        missingEmail: !customer.email || isPlaceholderEmail,
        missingPhone: !customer.phone || customer.phone.length < 10,
        missingGstin: !customer.gstin || customer.gstin.length < 15,
      },
      summary: {
        totalOutstanding,
        overdueAmount,
        maxDaysOverdue,
        oldestDueDate,
        agingBucket: this.getAgingBucket(maxDaysOverdue),
        lastPaymentDate: profile?.lastPaymentAt ? profile.lastPaymentAt.toISOString() : null,
        nextActionDate: profile?.nextActionDate ? profile.nextActionDate.toISOString() : null,
        ptpDate: profile?.ptpDate ? profile.ptpDate.toISOString() : null,
        ptpAmount: profile?.ptpAmount ? Number(profile.ptpAmount) : null,
        followupStatus: (profile?.status as FollowupProfileStatus) || (maxDaysOverdue > 0 ? 'OVERDUE' : 'ACTIVE'),
        declineReason: profile?.declineReason,
        declinedAt: profile?.declinedAt ? profile.declinedAt.toISOString() : null,
        totalBilledAmount,
        totalAdvancePaid,
        totalPaymentsCollected,
        netBalanceDue,
      },
      agingBreakdown: {
        bucket0_30: Math.round(bucket0_30 * 100) / 100,
        bucket31_60: Math.round(bucket31_60 * 100) / 100,
        bucket61_90: Math.round(bucket61_90 * 100) / 100,
        bucket90_plus: Math.round(bucket90_plus * 100) / 100,
      },
      dues: duesList,
      paymentAllocations: customer.paymentAllocations.map((a) => ({
        id: a.id,
        paymentAmount: Number(a.paymentAmount),
        paymentDate: a.paymentDate.toISOString(),
        paymentMode: a.paymentMode,
        transactionRef: a.transactionRef,
        allocationMode: a.allocationMode as any,
        targetType: a.targetType as any,
        targetId: a.targetId,
        targetDocumentNumber: a.targetDocumentNumber,
        allocatedAmount: Number(a.allocatedAmount),
        notes: a.notes,
        recordedByName: null,
        createdAt: a.createdAt.toISOString(),
      })),
      followupHistory: customer.paymentFollowupEntries.map((e) => ({
        id: e.id,
        followupType: e.followupType as any,
        outcome: e.outcome as any,
        notes: e.notes,
        ptpDate: e.ptpDate ? e.ptpDate.toISOString() : null,
        ptpAmount: e.ptpAmount ? Number(e.ptpAmount) : null,
        nextActionDate: e.nextActionDate ? e.nextActionDate.toISOString() : null,
        performedByName: e.performedByName,
        createdAt: e.createdAt.toISOString(),
      })),
      ledgerEntries,
      selectableDocuments,
      emailLogs: customer.paymentFollowupEmailLogs.map((l) => ({
        id: l.id,
        recipientEmail: l.recipientEmail,
        subject: l.subject,
        body: l.body,
        attachmentName: l.attachmentName,
        outstandingAmount: Number(l.outstandingAmount),
        status: l.status,
        errorMessage: l.errorMessage,
        createdAt: l.createdAt.toISOString(),
      })),
      smsLogs: customer.paymentFollowupSmsLogs.map((s) => ({
        id: s.id,
        phoneNumber: s.phoneNumber,
        message: s.message,
        templateUsed: s.templateUsed,
        outstandingAmount: Number(s.outstandingAmount),
        status: s.status,
        errorMessage: s.errorMessage,
        createdAt: s.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Logs a follow-up touchpoint (Call, SMS, Email, Note) and updates profile state.
   */
  public async logFollowupTouchpoint(
    customerId: string,
    userId: string | undefined,
    input: LogFollowupInput
  ) {
    if (!input.notes || !input.notes.trim()) {
      throw new AppError('BAD_REQUEST', 'Follow-up remarks or notes are required', 400);
    }

    const ptpDate = input.ptpDate ? new Date(input.ptpDate) : null;
    const nextActionDate = input.nextActionDate ? new Date(input.nextActionDate) : null;

    return await prisma.$transaction(async (tx) => {
      const entry = await tx.paymentFollowupEntry.create({
        data: {
          customerId,
          targetDocumentId: input.targetDocumentId || null,
          targetDocumentNumber: input.targetDocumentNumber || null,
          followupType: input.channel || 'CALL',
          outcome: input.outcome || 'CALL_MADE',
          notes: input.notes.trim(),
          ptpDate,
          ptpAmount: input.ptpAmount ? Number(input.ptpAmount) : null,
          nextActionDate,
          performedById: userId || 'system',
          performedByName: 'Collections Officer',
        },
      });

      const newStatus = input.outcome === 'PAYMENT_PROMISED' ? 'PAYMENT_PROMISED' : undefined;

      await tx.paymentFollowupProfile.upsert({
        where: { customerId },
        update: {
          lastFollowupAt: new Date(),
          ptpDate,
          ptpAmount: input.ptpAmount ? Number(input.ptpAmount) : null,
          nextActionDate,
          ...(newStatus && { status: newStatus }),
        },
        create: {
          customerId,
          status: newStatus || 'ACTIVE',
          lastFollowupAt: new Date(),
          ptpDate,
          ptpAmount: input.ptpAmount ? Number(input.ptpAmount) : null,
          nextActionDate,
        },
      });

      return entry;
    });
  }

  /**
   * Marks a customer follow-up as DECLINED or DISPUTED with mandatory reason.
   * SAFETY RULE: Does NOT delete or hide customer or alter balances.
   */
  public async declineOrDisputeCustomer(
    customerId: string,
    userId: string | undefined,
    input: DeclineDisputeInput
  ) {
    if (!input.reason || !input.reason.trim()) {
      throw new AppError('BAD_REQUEST', 'A mandatory reason is required to decline or dispute follow-up', 400);
    }

    return await prisma.$transaction(async (tx) => {
      const profile = await tx.paymentFollowupProfile.upsert({
        where: { customerId },
        update: {
          status: input.status,
          declineReason: input.reason.trim(),
          declinedById: userId || 'system',
          declinedAt: new Date(),
        },
        create: {
          customerId,
          status: input.status,
          declineReason: input.reason.trim(),
          declinedById: userId || 'system',
          declinedAt: new Date(),
        },
      });

      await tx.paymentFollowupEntry.create({
        data: {
          customerId,
          followupType: 'NOTE',
          outcome: input.status === 'DISPUTED' ? 'DISPUTED' : 'REFUSED',
          notes: `Follow-up transitioned to ${input.status}. Reason: ${input.reason.trim()}`,
          performedById: userId || 'system',
          performedByName: 'Admin Authority',
        },
      });

      return profile;
    });
  }

  /**
   * Resumes active follow-up for an account previously declined or disputed.
   */
  public async resumeCustomerFollowup(customerId: string, userId: string | undefined) {
    return await prisma.$transaction(async (tx) => {
      const profile = await tx.paymentFollowupProfile.update({
        where: { customerId },
        data: {
          status: 'ACTIVE',
          resumedById: userId || 'system',
          resumedAt: new Date(),
        },
      });

      await tx.paymentFollowupEntry.create({
        data: {
          customerId,
          followupType: 'NOTE',
          outcome: 'OTHER',
          notes: 'Follow-up resumed and reactivated into active collections queue.',
          performedById: userId || 'system',
          performedByName: 'Admin Authority',
        },
      });

      return profile;
    });
  }

  /**
   * Helper to record reminder dispatch touchpoints.
   */
  public async recordReminderTouchpoint(
    customerId: string,
    channel: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'CALL' | 'NOTE',
    note: string
  ) {
    await prisma.paymentFollowupProfile.upsert({
      where: { customerId },
      update: {
        lastFollowupAt: new Date(),
        totalRemindersSent: { increment: 1 },
      },
      create: {
        customerId,
        status: 'ACTIVE',
        lastFollowupAt: new Date(),
        totalRemindersSent: 1,
      },
    });

    const followupType = channel === 'EMAIL' ? 'LEDGER_EMAIL' : channel === 'WHATSAPP' ? 'OTHER' : channel;

    await prisma.paymentFollowupEntry.create({
      data: {
        customerId,
        followupType,
        outcome: 'CALL_MADE',
        notes: note,
        performedById: 'system',
        performedByName: 'Automated Remittance Dispatch',
      },
    });
  }

  /**
   * Transforms CustomerDuesDetail into CustomerLedgerPdfInput.
   */
  public buildLedgerPdfInput(detail: CustomerDuesDetail): CustomerLedgerPdfInput {
    const transactions: StatementLedgerRow[] = [];
    let runningBalance = 0;

    // Sort all dues and payments chronologically
    const allEvents: Array<{
      date: Date;
      refNo: string;
      description: string;
      debit: number;
      credit: number;
    }> = [];

    for (const d of detail.dues) {
      allEvents.push({
        date: new Date(d.referenceDate),
        refNo: d.documentNumber,
        description: d.sourceType === 'OPENING_BALANCE' ? 'Historical Opening Dues' : `${d.sourceType} Billing`,
        debit: d.totalAmount,
        credit: 0,
      });
    }

    for (const a of detail.paymentAllocations) {
      allEvents.push({
        date: new Date(a.paymentDate),
        refNo: a.transactionRef ? `REF-${a.transactionRef}` : 'PAYMENT',
        description: `Payment via ${a.paymentMode} against ${a.targetDocumentNumber || a.targetType}`,
        debit: 0,
        credit: a.allocatedAmount,
      });
    }

    allEvents.sort((a, b) => a.date.getTime() - b.date.getTime());

    let totalDebit = 0;
    let totalCredit = 0;

    for (const ev of allEvents) {
      totalDebit += ev.debit;
      totalCredit += ev.credit;
      runningBalance += ev.debit - ev.credit;

      transactions.push({
        date: ev.date.toISOString(),
        refNo: ev.refNo,
        description: ev.description,
        debit: ev.debit,
        credit: ev.credit,
        balance: Math.round(runningBalance * 100) / 100,
      });
    }

    return {
      customer: {
        name: detail.customer.name,
        companyName: detail.customer.companyName,
        phone: detail.customer.phone,
        email: detail.customer.email,
        gstin: detail.customer.gstin,
        billingAddress: detail.customer.billingAddress,
      },
      statementDate: new Date().toISOString(),
      transactions,
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      closingBalance: Math.max(0, Math.round(runningBalance * 100) / 100),
      agingBreakdown: detail.agingBreakdown,
    };
  }

  /**
   * Previews bulk action recipients and identifies skipped records.
   */
  public async previewBulkAction(
    customerIds: string[],
    actionType: 'SEND_LEDGER' | 'SEND_SMS'
  ): Promise<BulkActionPreviewResult> {
    const listResult = await this.listCustomerDues({ limit: 5000 });
    const selectedCustomers = listResult.items.filter((c) => customerIds.includes(c.customerId));

    let eligibleCount = 0;
    let missingPhoneCount = 0;
    let missingEmailCount = 0;
    let declinedDisputedCount = 0;
    let totalEligibleAmount = 0;

    const items = selectedCustomers.map((c) => {
      let isEligible = true;
      let skipReason: string | undefined;

      if (c.followupStatus === 'DECLINED' || c.followupStatus === 'DISPUTED') {
        isEligible = false;
        skipReason = 'DECLINED_OR_DISPUTED';
        declinedDisputedCount++;
      } else if (actionType === 'SEND_LEDGER' && c.missingEmail) {
        isEligible = false;
        skipReason = 'MISSING_EMAIL';
        missingEmailCount++;
      } else if (actionType === 'SEND_SMS' && c.missingPhone) {
        isEligible = false;
        skipReason = 'MISSING_PHONE';
        missingPhoneCount++;
      }

      if (isEligible) {
        eligibleCount++;
        totalEligibleAmount += c.totalOutstanding;
      }

      return {
        customerId: c.customerId,
        customerName: c.customerName,
        companyName: c.companyName,
        phone: c.phone,
        email: c.email,
        outstandingAmount: c.totalOutstanding,
        agingBucket: c.agingBucket,
        invoicesCount: c.invoicesCount,
        isEligible,
        skipReason,
      };
    });

    return {
      totalSelected: customerIds.length,
      eligibleCount,
      missingPhoneCount,
      missingEmailCount,
      declinedDisputedCount,
      alreadyRemindedCount: 0,
      totalEligibleAmount: Math.round(totalEligibleAmount * 100) / 100,
      items,
    };
  }

  /**
   * Dispatches bulk ledger emails with resilient error isolation.
   */
  public async executeBulkSendLedger(
    userId: string | undefined,
    customerIds: string[],
    templates?: { subject?: string; body?: string }
  ): Promise<BulkActionResult> {
    const preview = await this.previewBulkAction(customerIds, 'SEND_LEDGER');
    let successful = 0;
    let failed = 0;
    let skipped = 0;
    const details: BulkActionResult['details'] = [];

    const subjectTemplate =
      templates?.subject || 'Outstanding Commercial Statement — {{customer_name}} [₹{{outstanding_amount}}]';
    const bodyTemplate =
      templates?.body ||
      'Dear {{customer_name}},\n\nPlease find attached the updated Statement of Account regarding your pending balance of \u20B9{{outstanding_amount}} with Pacific Products & Solutions.\n\nKindly arrange payment and share the bank UTR reference.\n\nCommercial Accounts Desk\nPacific Products & Solutions';

    for (const item of preview.items) {
      if (!item.isEligible) {
        skipped++;
        details.push({
          customerId: item.customerId,
          customerName: item.customerName,
          status: 'SKIPPED',
          reason: item.skipReason,
        });
        continue;
      }

      try {
        const duesDetail = await this.getCustomerDuesDetail(item.customerId);
        const ledgerPdfInput = this.buildLedgerPdfInput(duesDetail);

        const res = await paymentFollowupResendService.sendFollowupEmail({
          customerId: item.customerId,
          recipientEmail: item.email!,
          subjectTemplate,
          bodyTemplate,
          outstandingAmount: item.outstandingAmount,
          templateVariables: {
            customer_name: item.customerName,
            company_name: item.companyName || item.customerName,
            outstanding_amount: item.outstandingAmount.toLocaleString('en-IN'),
            statement_date: new Date().toLocaleDateString('en-IN'),
          },
          attachLedgerPdf: true,
          ledgerInput: ledgerPdfInput,
          dispatchedById: userId || 'system',
        });

        if (res.success) {
          successful++;
          await this.recordReminderTouchpoint(item.customerId, 'EMAIL', 'Bulk Statement email dispatched.');
          details.push({
            customerId: item.customerId,
            customerName: item.customerName,
            status: 'SUCCESS',
          });
        } else {
          failed++;
          details.push({
            customerId: item.customerId,
            customerName: item.customerName,
            status: 'FAILED',
            reason: res.error,
          });
        }
      } catch (err: any) {
        failed++;
        details.push({
          customerId: item.customerId,
          customerName: item.customerName,
          status: 'FAILED',
          reason: err?.message || String(err),
        });
      }
    }

    return {
      totalSelected: customerIds.length,
      successful,
      failed,
      skipped,
      details,
    };
  }

  /**
   * Dispatches bulk SMS reminders with resilient error isolation.
   */
  public async executeBulkSendSms(
    userId: string | undefined,
    customerIds: string[],
    template?: string
  ): Promise<BulkActionResult> {
    const preview = await this.previewBulkAction(customerIds, 'SEND_SMS');
    let successful = 0;
    let failed = 0;
    let skipped = 0;
    const details: BulkActionResult['details'] = [];

    const defaultTemplate =
      template ||
      'Dear {{customer_name}}, your outstanding payment of \u20B9{{outstanding_amount}} is pending with PRC Hardware. Please arrange payment at the earliest. — Pacific Products & Solutions';

    for (const item of preview.items) {
      if (!item.isEligible) {
        skipped++;
        details.push({
          customerId: item.customerId,
          customerName: item.customerName,
          status: 'SKIPPED',
          reason: item.skipReason,
        });
        continue;
      }

      try {
        const res = await smsReminderService.sendSmsReminder({
          customerId: item.customerId,
          phoneNumber: item.phone!,
          template: defaultTemplate,
          templateVariables: {
            customer_name: item.customerName,
            outstanding_amount: item.outstandingAmount.toLocaleString('en-IN'),
          },
          outstandingAmount: item.outstandingAmount,
          templateName: 'BULK_PAYMENT_REMINDER',
          dispatchedById: userId || 'system',
        });

        if (res.success) {
          successful++;
          await this.recordReminderTouchpoint(item.customerId, 'SMS', 'Bulk SMS reminder sent.');
          details.push({
            customerId: item.customerId,
            customerName: item.customerName,
            status: 'SUCCESS',
          });
        } else {
          failed++;
          details.push({
            customerId: item.customerId,
            customerName: item.customerName,
            status: 'FAILED',
            reason: res.error,
          });
        }
      } catch (err: any) {
        failed++;
        details.push({
          customerId: item.customerId,
          customerName: item.customerName,
          status: 'FAILED',
          reason: err?.message || String(err),
        });
      }
    }

    return {
      totalSelected: customerIds.length,
      successful,
      failed,
      skipped,
      details,
    };
  }

  /**
   * Adds an opening dues balance (Debit) or records a past payment (Credit) with custom date.
   */
  public async addBalanceEntry(
    userId: string | undefined,
    customerId: string,
    input: AddCustomerBalanceEntryInput
  ) {
    const amount = Number(input.amount);
    if (!amount || amount <= 0) {
      throw new AppError('BAD_REQUEST', 'Amount must be greater than zero', 400);
    }

    const customer = await prisma.user.findUnique({
      where: { id: customerId, deletedAt: null },
    });
    if (!customer) {
      throw new AppError('NOT_FOUND', 'Customer account not found', 404);
    }

    if (input.entryType === 'CREDIT') {
      const allocResult = await paymentAllocationService.recordAndAllocatePayment(userId, {
        customerId,
        amount,
        paymentDate: input.referenceDate || new Date().toISOString().split('T')[0],
        paymentMode: input.paymentMode || 'BANK_TRANSFER',
        transactionRef: input.referenceNumber,
        allocationMode: 'OLDEST_DUE_FIRST',
        notes: input.notes || 'Historical payment entry (Credit)',
      });

      return {
        success: true,
        message: `Payment entry of ₹${amount.toLocaleString('en-IN')} recorded and allocated successfully.`,
        allocResult,
      };
    }

    // DEBIT: Add opening dues balance
    const refDate = input.referenceDate ? new Date(input.referenceDate) : new Date();
    const entry = await prisma.openingBalanceEntry.create({
      data: {
        customerId,
        customerName: `${customer.firstName} ${customer.lastName}`.trim(),
        companyName: customer.companyName || null,
        openingAmount: amount,
        paidAmount: 0,
        remainingBalance: amount,
        referenceDate: refDate,
        referenceNote: input.referenceNumber
          ? `Ref #${input.referenceNumber}: ${input.notes || 'Past balance addition (Debit)'}`
          : input.notes || 'Historical balance addition (Debit)',
        status: 'PARTIAL',
        createdById: userId,
      },
    });

    // Ensure customer followup profile is ACTIVE
    await prisma.paymentFollowupProfile.upsert({
      where: { customerId },
      update: { status: 'ACTIVE' },
      create: {
        customerId,
        status: 'ACTIVE',
      },
    });

    // Timeline entry
    await prisma.paymentFollowupEntry.create({
      data: {
        customerId,
        performedById: userId || 'system',
        performedByName: 'Collections Officer',
        followupType: 'NOTE',
        outcome: 'NOTE_ADDED',
        notes: `Added past dues balance: ₹${amount.toLocaleString('en-IN')} (Ref: ${input.referenceNumber || 'N/A'}, Date: ${input.referenceDate}). ${input.notes || ''}`.trim(),
      },
    });

    return {
      success: true,
      message: `Debit balance entry of ₹${amount.toLocaleString('en-IN')} added successfully.`,
      entry,
    };
  }

  /**
   * Retrieves structured ledger / Statement of Account data with optional date range filtering.
   */
  public async getCustomerLedgerJson(
    customerId: string,
    fromDate?: string,
    toDate?: string
  ) {
    const detail = await this.getCustomerDuesDetail(customerId);
    let rows = detail.ledgerEntries || [];

    if (fromDate) {
      const fromTime = new Date(fromDate).getTime();
      rows = rows.filter((r) => new Date(r.date).getTime() >= fromTime);
    }
    if (toDate) {
      const toTime = new Date(toDate).getTime() + (24 * 60 * 60 * 1000 - 1);
      rows = rows.filter((r) => new Date(r.date).getTime() <= toTime);
    }

    const totalDebit = Math.round(rows.reduce((sum, r) => sum + r.debit, 0) * 100) / 100;
    const totalCredit = Math.round(rows.reduce((sum, r) => sum + r.credit, 0) * 100) / 100;
    const closingBalance = Math.round((detail.summary.totalOutstanding || (totalDebit - totalCredit)) * 100) / 100;

    const billingStr = detail.customer.billingAddressDetails
      ? `${detail.customer.billingAddressDetails.addressLine1}${detail.customer.billingAddressDetails.addressLine2 ? ', ' + detail.customer.billingAddressDetails.addressLine2 : ''}, ${detail.customer.billingAddressDetails.city}, ${detail.customer.billingAddressDetails.state} - ${detail.customer.billingAddressDetails.postalCode}`
      : detail.customer.billingAddress || null;

    return {
      customer: {
        name: detail.customer.name,
        companyName: detail.customer.companyName,
        phone: detail.customer.phone,
        email: detail.customer.email,
        gstin: detail.customer.gstin,
        billingAddress: billingStr,
      },
      statementDate: new Date().toISOString(),
      periodStart: fromDate,
      periodEnd: toDate,
      openingBalance: 0,
      transactions: rows,
      totalDebit,
      totalCredit,
      closingBalance,
      agingBreakdown: detail.agingBreakdown,
    };
  }

  /**
   * Compiles and renders the strict monochrome Statement of Account vector PDF buffer.
   */
  public async getCustomerLedgerPdf(
    customerId: string,
    fromDate?: string,
    toDate?: string
  ): Promise<Buffer> {
    const ledgerData = await this.getCustomerLedgerJson(customerId, fromDate, toDate);

    return await generateCustomerLedgerPdfBuffer({
      customer: ledgerData.customer,
      statementDate: ledgerData.statementDate,
      periodStart: ledgerData.periodStart,
      periodEnd: ledgerData.periodEnd,
      openingBalance: ledgerData.openingBalance,
      transactions: ledgerData.transactions,
      totalDebit: ledgerData.totalDebit,
      totalCredit: ledgerData.totalCredit,
      closingBalance: ledgerData.closingBalance,
      agingBreakdown: ledgerData.agingBreakdown,
    });
  }

  /**
   * Dispatches unified customer communication across Email, SMS, and/or WhatsApp
   * with dynamic multi-attachment support (Ledger PDF, PIs, Quotes, POs).
   */
  public async sendCustomerCommunication(
    userId: string | undefined,
    customerId: string,
    input: SendCustomerCommunicationInput
  ) {
    const customer = await prisma.user.findUnique({
      where: { id: customerId, deletedAt: null },
    });
    if (!customer) {
      throw new AppError('NOT_FOUND', 'Customer not found', 404);
    }

    const detail = await this.getCustomerDuesDetail(customerId);
    const attachments: Array<{ filename: string; content: Buffer }> = [];
    const docSummaries: string[] = [];

    // 1. Generate Ledger PDF if requested
    if (input.attachLedgerPdf) {
      try {
        const ledgerBuffer = await this.getCustomerLedgerPdf(customerId);
        const safeName = (customer.companyName || customer.firstName || 'Customer').replace(/[^a-zA-Z0-9_-]/g, '_');
        attachments.push({
          filename: `Statement-of-Account-${safeName}.pdf`,
          content: ledgerBuffer,
        });
        docSummaries.push('Statement of Account (Ledger PDF)');
      } catch (err) {
        console.error('[sendCustomerCommunication] Failed to generate Ledger PDF:', err);
      }
    }

    // 2. Load & Generate attachments for selectedDocumentIds
    if (input.selectedDocumentIds && input.selectedDocumentIds.length > 0) {
      for (const doc of input.selectedDocumentIds) {
        const docId = doc.id;
        // Check Proforma Invoice
        const pi = await prisma.proformaInvoice.findUnique({
          where: { id: docId },
          include: { items: true },
        });
        if (pi) {
          try {
            const piBuffer = await generateProformaPdf(pi as any);
            attachments.push({
              filename: `${pi.piNumber}.pdf`,
              content: piBuffer,
            });
            docSummaries.push(`Proforma Invoice ${pi.piNumber}`);
            continue;
          } catch (err) {
            console.error(`[sendCustomerCommunication] Failed to generate PI PDF for ${pi.piNumber}:`, err);
          }
        }

        // Check Quotation
        const quote = await prisma.quote.findUnique({
          where: { id: docId },
          include: { items: true },
        });
        if (quote) {
          try {
            const quoteBuffer = await generateQuotationPdf(quote as any);
            attachments.push({
              filename: `Quote-${quote.quoteNumber}.pdf`,
              content: quoteBuffer,
            });
            docSummaries.push(`Quotation #${quote.quoteNumber}`);
            continue;
          } catch (err) {
            console.error(`[sendCustomerCommunication] Failed to generate Quote PDF for ${quote.quoteNumber}:`, err);
          }
        }

        // Check PO Submission
        const po = await prisma.poSubmission.findUnique({
          where: { id: docId },
        });
        if (po) {
          docSummaries.push(`Purchase Order #${po.customerPoNumber || po.poSubmissionId || docId.slice(0, 8)}`);
        }
      }
    }

    let emailSent = false;
    let smsSent = false;
    let whatsappUrl: string | undefined;

    // 3. Email Channel
    if (input.channels.includes('EMAIL')) {
      const rawEmail = (customer.email || '').trim();
      const isPlaceholder = rawEmail.includes('@internal.prc') || rawEmail.startsWith('legacy_');
      if (!rawEmail || isPlaceholder) {
        throw new AppError('BAD_REQUEST', 'Customer does not have a valid email address on file', 400);
      }

      const emailRes = await paymentFollowupResendService.sendFollowupEmail({
        customerId,
        recipientEmail: rawEmail,
        subjectTemplate: input.emailSubject || 'Outstanding Commercial Statement — {{customer_name}} [₹{{outstanding_amount}}]',
        bodyTemplate:
          input.emailBody ||
          'Dear {{customer_name}},\n\nPlease find attached the official Statement of Account and commercial documents.\n\nRegards,\nCommercial Accounts Desk\nPacific Products & Solutions',
        outstandingAmount: detail.summary.totalOutstanding,
        templateVariables: {
          customer_name: detail.customer.name,
          company_name: detail.customer.companyName || detail.customer.name,
          outstanding_amount: detail.summary.totalOutstanding.toLocaleString('en-IN'),
          statement_date: new Date().toLocaleDateString('en-IN'),
        },
        dispatchedById: userId,
        attachLedgerPdf: false,
        additionalAttachments: attachments,
      });

      if (emailRes.success) {
        emailSent = true;
        const docNote = docSummaries.length > 0 ? ` with docs: ${docSummaries.join(', ')}` : '';
        await this.recordReminderTouchpoint(customerId, 'EMAIL', `Communication email sent${docNote}.`);
      } else {
        throw new AppError('INTERNAL_SERVER_ERROR', `Failed to send email: ${emailRes.error}`, 500);
      }
    }

    // 4. SMS Channel
    if (input.channels.includes('SMS')) {
      const phone = (customer.phone || '').trim();
      if (!phone || phone.length < 10) {
        throw new AppError('BAD_REQUEST', 'Customer does not have a valid phone number on file', 400);
      }

      const defaultSms =
        input.smsMessage ||
        'Dear {{customer_name}}, your outstanding balance of ₹{{outstanding_amount}} is pending with PRC Hardware. Please arrange payment at the earliest. — Pacific Products';
      const smsRes = await smsReminderService.sendSmsReminder({
        customerId,
        phoneNumber: phone,
        template: defaultSms,
        templateVariables: {
          customer_name: detail.customer.name,
          outstanding_amount: detail.summary.totalOutstanding.toLocaleString('en-IN'),
        },
        outstandingAmount: detail.summary.totalOutstanding,
        templateName: 'CUSTOM_COMMUNICATION',
        dispatchedById: userId || 'system',
      });

      if (smsRes.success) {
        smsSent = true;
        await this.recordReminderTouchpoint(customerId, 'SMS', 'Custom SMS communication sent.');
      } else {
        throw new AppError('INTERNAL_SERVER_ERROR', `Failed to send SMS: ${smsRes.error}`, 500);
      }
    }

    // 5. WhatsApp Channel
    if (input.channels.includes('WHATSAPP')) {
      const rawPhone = (customer.phone || '').trim().replace(/[^0-9]/g, '');
      const cleanPhone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;

      const defaultMsg =
        input.whatsappMessage ||
        `Hello ${customer.firstName || 'Customer'},\n\nThis is a follow-up from *PRC Hardware (Pacific Products & Solutions)* regarding your account.\n\n*Total Outstanding Balance:* \u20B9${detail.summary.totalOutstanding.toLocaleString('en-IN')}\n${
          docSummaries.length > 0 ? `*Referenced Documents:* ${docSummaries.join(', ')}\n` : ''
        }\n*Bank Details for RTGS/NEFT/UPI:*\nBank: HDFC Bank Ltd.\nA/C: 50200088991122\nIFSC: HDFC0001234\nUPI: prchardware@hdfcbank\n\nPlease find the documents/statement attached or contact our accounts team for any queries.\nThank you!`;

      whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(defaultMsg)}`;

      await this.recordReminderTouchpoint(
        customerId,
        'WHATSAPP',
        `Prepared WhatsApp communication with ${docSummaries.length} document references.`
      );
    }

    return {
      success: true,
      emailSent,
      smsSent,
      whatsappUrl,
      whatsappMessage: input.whatsappMessage,
      attachmentsCount: attachments.length,
      message: 'Customer communication processed successfully.',
    };
  }
}

export const paymentFollowupService = new PaymentFollowupService();
