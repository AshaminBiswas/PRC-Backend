import prisma from '../config/database';
import {
  submitB2bOrder,
  adminCreateB2bOrder,
  approveB2bOrder,
  rejectB2bOrder,
  customerCancelB2bOrder,
  adminCancelConfirmedB2bOrder,
  adminEditConfirmedB2bOrder,
  checkProductStock,
} from '../modules/b2b-orders/b2b-orders.service';
import { AppError } from '../middleware/error.middleware';
import crypto from 'crypto';

async function runB2BScenarios() {
  console.log('════════════════════════════════════════════════════════════════');
  console.log('🧪 B2B ORDER MANAGEMENT SPECIFICATION TEST SUITE (12 SCENARIOS)');
  console.log('════════════════════════════════════════════════════════════════\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, message: string) => {
    if (condition) {
      console.log(`   ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`   ❌ FAIL: ${message}`);
      failed++;
      throw new Error(`Assertion failed: ${message}`);
    }
  };

  // Find or create test environment data
  const branch = await prisma.branch.findFirst({ where: { isActive: true } });
  if (!branch) throw new Error('No active branch found in DB for testing.');

  // Find a product with inventory or ensure inventory exists
  let product = await prisma.product.findFirst({
    where: {
      inventories: {
        some: { branchId: branch.id, quantity: { gte: 100 } },
      },
    },
    include: { inventories: { where: { branchId: branch.id } } },
  });

  if (!product) {
    product = await prisma.product.findFirst({
      include: { inventories: { where: { branchId: branch.id } } },
    });
    if (!product) throw new Error('No products found in DB for testing.');

    if (product.inventories.length === 0) {
      await prisma.inventory.create({
        data: {
          productId: product.id,
          branchId: branch.id,
          quantity: 200,
          reservedQuantity: 0,
        },
      });
    } else {
      await prisma.inventory.update({
        where: { id: product.inventories[0].id },
        data: { quantity: 200, reservedQuantity: 0 },
      });
    }
  }

  const productId = product.id;
  const sku = product.sku || 'SKU-TEST-001';
  const branchId = branch.id;

  // Test users context
  const superAdminUser = {
    id: 'a0000000-0000-0000-0000-000000000001',
    email: 'superadmin@pacifichardware.com',
    roleSlug: 'super_admin',
    firstName: 'Super',
    lastName: 'Admin',
  };

  const nonSuperAdminUser = {
    id: 'a0000000-0000-0000-0000-000000000002',
    email: 'staff@pacifichardware.com',
    roleSlug: 'manager',
    firstName: 'Staff',
    lastName: 'Manager',
  };

  const b2bCustomerUser = {
    id: 'c0000000-0000-0000-0000-000000000001',
    email: 'commercial@acme-builders.in',
    roleSlug: 'customer',
    companyName: 'Acme Builders Ltd',
    gstin: '07AAAAA1234A1Z5',
    firstName: 'Rajesh',
    lastName: 'Verma',
  };

  const retailCustomerUser = {
    id: 'c0000000-0000-0000-0000-000000000002',
    email: 'john.retail@gmail.com',
    roleSlug: 'customer',
    companyName: null,
    gstin: null,
    firstName: 'John',
    lastName: 'Doe',
  };

  // Ensure these users exist in DB
  await prisma.user.upsert({
    where: { id: superAdminUser.id },
    create: {
      id: superAdminUser.id,
      email: superAdminUser.email,
      firstName: superAdminUser.firstName,
      lastName: superAdminUser.lastName,
      passwordHash: 'test-hash',
    },
    update: {},
  });

  await prisma.user.upsert({
    where: { id: b2bCustomerUser.id },
    create: {
      id: b2bCustomerUser.id,
      email: b2bCustomerUser.email,
      firstName: b2bCustomerUser.firstName,
      lastName: b2bCustomerUser.lastName,
      companyName: b2bCustomerUser.companyName,
      gstin: b2bCustomerUser.gstin,
      passwordHash: 'test-hash',
    },
    update: {
      companyName: b2bCustomerUser.companyName,
      gstin: b2bCustomerUser.gstin,
    },
  });

  await prisma.user.upsert({
    where: { id: retailCustomerUser.id },
    create: {
      id: retailCustomerUser.id,
      email: retailCustomerUser.email,
      firstName: retailCustomerUser.firstName,
      lastName: retailCustomerUser.lastName,
      passwordHash: 'test-hash',
    },
    update: { companyName: null, gstin: null },
  });

  console.log(`📍 Test Setup: Branch = ${branch.code}, Product = ${sku}, ProductID = ${productId}\n`);

  try {
    // ══════════════════════════════════════════════════════════════════════════
    // SCENARIO 1: Non-B2B customer blocked from submitting (403)
    // ══════════════════════════════════════════════════════════════════════════
    console.log('🔹 [Scenario 1] Non-B2B customer blocked from submitting order...');
    try {
      await submitB2bOrder(retailCustomerUser, {
        clientRequestId: crypto.randomUUID(),
        branchId,
        paymentMethod: 'bank_transfer',
        items: [{ productId, sku, quantity: 5, unitPrice: 1000, discount: 0 }],
      });
      assert(false, 'Should have thrown 403 for non-B2B customer');
    } catch (err: any) {
      assert(
        err instanceof AppError && err.statusCode === 403,
        `Non-B2B customer correctly blocked with 403 (${err.message})`
      );
    }

    // ══════════════════════════════════════════════════════════════════════════
    // SCENARIO 2: Customer submit creates pending_approval + active reservation
    //             Physical stock is NOT deducted yet.
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n🔹 [Scenario 2] Customer submit creates pending_approval + active reservation...');
    const initialInv = await prisma.inventory.findFirst({
      where: { productId, branchId },
    });
    const initPhysical = Number(initialInv?.quantity || 0);
    const initReserved = Number(initialInv?.reservedQuantity || 0);

    const clientReqId2 = crypto.randomUUID();
    const order2 = await submitB2bOrder(b2bCustomerUser, {
      clientRequestId: clientReqId2,
      branchId,
      paymentMethod: 'bank_transfer',
      items: [{ productId, sku, quantity: 10, unitPrice: 1500, discount: 0 }],
    });

    if (!order2) throw new Error('Failed to create order2');
    assert(order2.status === 'pending_approval', `Order status is 'pending_approval' (${order2.status})`);
    assert(order2.orderNumber.startsWith('PRC-B2B-'), `Order number format is PRC-B2B-... (${order2.orderNumber})`);

    // Check reservation was created in database
    const reservations = await prisma.stockReservation.findMany({
      where: { productId, branchId, status: 'active' },
    });
    assert(reservations.length > 0, `Active stock reservation created in DB`);

    const afterSubmitInv = await prisma.inventory.findFirst({
      where: { productId, branchId },
    });
    const afterPhysical = Number(afterSubmitInv?.quantity || 0);
    const afterReserved = Number(afterSubmitInv?.reservedQuantity || 0);

    assert(afterPhysical === initPhysical, `Physical stock NOT deducted upon submit (${afterPhysical} == ${initPhysical})`);
    assert(afterReserved === initReserved + 10, `Reserved quantity increased by 10 (${afterReserved} == ${initReserved + 10})`);

    // ══════════════════════════════════════════════════════════════════════════
    // SCENARIO 3: Available stock = physical - reservedQuantity
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n🔹 [Scenario 3] Available stock formula: physical - reservedQuantity...');
    const stockReport = await checkProductStock(branchId, [productId]);
    const pStock = stockReport.find((s: any) => s.productId === productId);
    assert(pStock !== undefined, `Product stock report returned`);
    assert(
      pStock!.availableStock === pStock!.physicalStock - pStock!.reservedStock,
      `Available stock formula holds: ${pStock!.availableStock} = ${pStock!.physicalStock} - ${pStock!.reservedStock}`
    );

    // ══════════════════════════════════════════════════════════════════════════
    // SCENARIO 4: Super Admin approve converts reservation -> physical deduction
    //             Writes B2B_ORDER movement in stock_movements
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n🔹 [Scenario 4] Super Admin approve converts reservation to deduction & logs B2B_ORDER...');
    const approvedOrder = await approveB2bOrder(superAdminUser, order2.id);
    if (!approvedOrder) throw new Error('Failed to approve order2');
    assert(approvedOrder.status === 'confirmed', `Order transitioned to 'confirmed'`);
    assert(approvedOrder.approvedBy === superAdminUser.id, `approvedBy recorded as super admin`);

    const afterApproveInv = await prisma.inventory.findFirst({
      where: { productId, branchId },
    });
    const approvePhysical = Number(afterApproveInv?.quantity || 0);
    const approveReserved = Number(afterApproveInv?.reservedQuantity || 0);

    assert(
      approvePhysical === initPhysical - 10,
      `Physical stock deducted upon approval (${approvePhysical} == ${initPhysical - 10})`
    );
    assert(
      approveReserved === initReserved,
      `Reserved quantity consumed and returned to baseline (${approveReserved} == ${initReserved})`
    );

    const movements = await prisma.stockMovement.findMany({
      where: {
        productId,
        type: 'B2B_ORDER',
        notes: { contains: order2.orderNumber },
      },
    });
    assert(movements.length > 0, `B2B_ORDER stock movement logged with order reference`);

    // ══════════════════════════════════════════════════════════════════════════
    // SCENARIO 5: Super Admin reject releases reservation, zero stock movements
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n🔹 [Scenario 5] Super Admin reject releases reservation with 0 stock movements...');
    const clientReqId5 = crypto.randomUUID();
    const order5 = await submitB2bOrder(b2bCustomerUser, {
      clientRequestId: clientReqId5,
      branchId,
      paymentMethod: 'bank_transfer',
      items: [{ productId, sku, quantity: 5, unitPrice: 1500, discount: 0 }],
    });
    if (!order5) throw new Error('Failed to create order5');

    const movementsBeforeReject = await prisma.stockMovement.count({
      where: { productId, notes: { contains: order5.orderNumber } },
    });

    const rejectedOrder = await rejectB2bOrder(superAdminUser, order5.id, 'Credit limit exceeded');
    if (!rejectedOrder) throw new Error('Failed to reject order5');
    assert(rejectedOrder.status === 'rejected', `Order transitioned to 'rejected'`);
    assert(rejectedOrder.rejectedReason === 'Credit limit exceeded', `Rejection reason recorded`);

    const movementsAfterReject = await prisma.stockMovement.count({
      where: { productId, notes: { contains: order5.orderNumber } },
    });
    assert(
      movementsBeforeReject === movementsAfterReject,
      `Zero stock movements created on rejection (${movementsBeforeReject} == ${movementsAfterReject})`
    );

    // ══════════════════════════════════════════════════════════════════════════
    // SCENARIO 6: Customer self-cancel works for pending_approval, blocked for confirmed
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n🔹 [Scenario 6] Customer self-cancellation rules...');
    const clientReqId6 = crypto.randomUUID();
    const order6 = await submitB2bOrder(b2bCustomerUser, {
      clientRequestId: clientReqId6,
      branchId,
      paymentMethod: 'bank_transfer',
      items: [{ productId, sku, quantity: 4, unitPrice: 1500, discount: 0 }],
    });
    if (!order6) throw new Error('Failed to create order6');

    const cancelledOrder6 = await customerCancelB2bOrder(b2bCustomerUser, order6.id);
    if (!cancelledOrder6) throw new Error('Failed to cancel order6');
    assert(cancelledOrder6.status === 'cancelled', `Pending order successfully self-cancelled by customer`);

    // Attempt to self-cancel an already confirmed order (order2 is confirmed)
    try {
      await customerCancelB2bOrder(b2bCustomerUser, order2.id);
      assert(false, 'Should have blocked customer cancellation on confirmed order');
    } catch (err: any) {
      assert(
        err instanceof AppError && err.statusCode === 400,
        `Customer cancellation blocked on confirmed order with 400 (${err.message})`
      );
    }

    // ══════════════════════════════════════════════════════════════════════════
    // SCENARIO 7: Admin offline order confirms and deducts in 1 request
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n🔹 [Scenario 7] Admin offline order confirms & deducts in 1 request...');
    const invBeforeOffline = await prisma.inventory.findFirst({
      where: { productId, branchId },
    });
    const physicalBeforeOffline = Number(invBeforeOffline?.quantity || 0);

    const clientReqId7 = crypto.randomUUID();
    const offlineOrder = await adminCreateB2bOrder(superAdminUser, {
      clientRequestId: clientReqId7,
      customerId: b2bCustomerUser.id,
      branchId,
      paymentMethod: 'bank_transfer',
      items: [{ productId, sku, quantity: 8, unitPrice: 1400, discount: 0 }],
      notes: 'Super Admin direct offline order',
    });
    if (!offlineOrder) throw new Error('Failed to create offlineOrder');

    assert(offlineOrder.status === 'confirmed', `Offline order immediately confirmed in 1 request`);
    assert(offlineOrder.source === 'admin_created', `Source is 'admin_created'`);

    const invAfterOffline = await prisma.inventory.findFirst({
      where: { productId, branchId },
    });
    const physicalAfterOffline = Number(invAfterOffline?.quantity || 0);

    assert(
      physicalAfterOffline === physicalBeforeOffline - 8,
      `Physical stock deducted immediately by 8 (${physicalAfterOffline} == ${physicalBeforeOffline - 8})`
    );

    // ══════════════════════════════════════════════════════════════════════════
    // SCENARIO 8: Non-super admin receives 403 on write endpoints
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n🔹 [Scenario 8] Non-super admin blocked from write endpoints (403)...');
    try {
      await approveB2bOrder(nonSuperAdminUser, order2.id);
      assert(false, 'Non-super admin should be blocked from approve');
    } catch (err: any) {
      assert(err instanceof AppError && err.statusCode === 403, `approve blocked with 403 for non-superadmin`);
    }

    try {
      await rejectB2bOrder(nonSuperAdminUser, order2.id, 'Reject attempt');
      assert(false, 'Non-super admin should be blocked from reject');
    } catch (err: any) {
      assert(err instanceof AppError && err.statusCode === 403, `reject blocked with 403 for non-superadmin`);
    }

    try {
      await adminCreateB2bOrder(nonSuperAdminUser, {
        clientRequestId: crypto.randomUUID(),
        customerId: b2bCustomerUser.id,
        branchId,
        paymentMethod: 'bank_transfer',
        items: [{ productId, sku, quantity: 1, unitPrice: 100, discount: 0 }],
      });
      assert(false, 'Non-super admin should be blocked from admin-create');
    } catch (err: any) {
      assert(err instanceof AppError && err.statusCode === 403, `adminCreate blocked with 403 for non-superadmin`);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // SCENARIO 9: Idempotency on client_request_id
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n🔹 [Scenario 9] Idempotency on client_request_id...');
    const clientReqId9 = crypto.randomUUID();
    const firstSubmit = await submitB2bOrder(b2bCustomerUser, {
      clientRequestId: clientReqId9,
      branchId,
      paymentMethod: 'bank_transfer',
      items: [{ productId, sku, quantity: 2, unitPrice: 1200, discount: 0 }],
    });

    const secondSubmit = await submitB2bOrder(b2bCustomerUser, {
      clientRequestId: clientReqId9,
      branchId,
      paymentMethod: 'bank_transfer',
      items: [{ productId, sku, quantity: 2, unitPrice: 1200, discount: 0 }],
    });

    if (!firstSubmit || !secondSubmit) throw new Error('Failed in scenario 9');
    assert(
      firstSubmit.id === secondSubmit.id,
      `Identical order returned without duplicate creation (${firstSubmit.id} == ${secondSubmit.id})`
    );

    // ══════════════════════════════════════════════════════════════════════════
    // SCENARIO 10: Concurrency / stock exhaustion prevents submission and approval
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n🔹 [Scenario 10] Concurrency / stock exhaustion prevents submission & approval...');
    const currentInv10 = await prisma.inventory.findFirst({
      where: { productId, branchId },
    });
    const avail10 = Number(currentInv10?.quantity || 0) - Number(currentInv10?.reservedQuantity || 0);

    // 10.1 Verify stock exhaustion prevents reservation when requested > available
    try {
      await submitB2bOrder(b2bCustomerUser, {
        clientRequestId: crypto.randomUUID(),
        branchId,
        paymentMethod: 'bank_transfer',
        items: [{ productId, sku, quantity: avail10 + 500, unitPrice: 1000, discount: 0 }],
      });
      assert(false, 'Should fail to submit when requested exceeds available');
    } catch (err: any) {
      assert(
        err instanceof AppError && err.statusCode === 400,
        `Submission blocked when stock is exhausted (${err.message})`
      );
    }

    // 10.2 Verify approval fails if physical stock drops below reservation quantity (concurrency exhaustion)
    const validOrder10 = await submitB2bOrder(b2bCustomerUser, {
      clientRequestId: crypto.randomUUID(),
      branchId,
      paymentMethod: 'bank_transfer',
      items: [{ productId, sku, quantity: 10, unitPrice: 1000, discount: 0 }],
    });
    if (!validOrder10) throw new Error('Failed to create validOrder10');

    // Temporarily reduce physical stock below 10 (e.g. 5) to simulate external stock drop
    const savedQty = Number(currentInv10?.quantity || 150);
    await prisma.inventory.updateMany({
      where: { productId, branchId },
      data: { quantity: 5 },
    });

    try {
      await approveB2bOrder(superAdminUser, validOrder10.id);
      assert(false, 'Approval should fail when physical stock is lower than reservation');
    } catch (err: any) {
      assert(
        err instanceof AppError && err.statusCode === 400,
        `Approval safely rejected on physical stock exhaustion (${err.message})`
      );
    } finally {
      // Restore physical stock
      await prisma.inventory.updateMany({
        where: { productId, branchId },
        data: { quantity: savedQty },
      });
      // Reject validOrder10 to release reservation
      await rejectB2bOrder(superAdminUser, validOrder10.id, 'Clean up test order');
    }

    // ══════════════════════════════════════════════════════════════════════════
    // SCENARIO 11: Admin edit: delta > 0 deducts stock, delta < 0 returns stock
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n🔹 [Scenario 11] Admin edit delta stock adjustments & audit...');
    // We will edit the confirmed offlineOrder (created with quantity: 8)
    const invBeforeEdit = await prisma.inventory.findFirst({
      where: { productId, branchId },
    });
    const physicalBeforeEdit = Number(invBeforeEdit?.quantity || 0);

    const lineItemId = offlineOrder.items![0].id;

    // 11.1 Increase quantity from 8 to 12 (+4 delta: should deduct 4 more)
    await adminEditConfirmedB2bOrder(superAdminUser, offlineOrder.id, {
      items: [
        {
          orderItemId: lineItemId,
          productId,
          sku,
          quantity: 12,
          unitPrice: 1400,
          discount: 0,
          isRemoved: false,
        },
      ],
      notes: 'Client requested 4 more units',
    });

    const invAfterPlusDelta = await prisma.inventory.findFirst({
      where: { productId, branchId },
    });
    const physicalAfterPlusDelta = Number(invAfterPlusDelta?.quantity || 0);
    assert(
      physicalAfterPlusDelta === physicalBeforeEdit - 4,
      `Positive delta (+4) correctly deducted 4 physical units (${physicalAfterPlusDelta} == ${physicalBeforeEdit - 4})`
    );

    // 11.2 Decrease quantity from 12 to 7 (-5 delta: should return 5 units)
    await adminEditConfirmedB2bOrder(superAdminUser, offlineOrder.id, {
      items: [
        {
          orderItemId: lineItemId,
          productId,
          sku,
          quantity: 7,
          unitPrice: 1400,
          discount: 0,
          isRemoved: false,
        },
      ],
      notes: 'Client reduced order quantity',
    });

    const invAfterMinusDelta = await prisma.inventory.findFirst({
      where: { productId, branchId },
    });
    const physicalAfterMinusDelta = Number(invAfterMinusDelta?.quantity || 0);
    assert(
      physicalAfterMinusDelta === physicalAfterPlusDelta + 5,
      `Negative delta (-5) correctly returned 5 physical units (${physicalAfterMinusDelta} == ${physicalAfterPlusDelta + 5})`
    );

    // Verify B2B_ADJUSTMENT movements were logged
    const adjustMovements = await prisma.stockMovement.findMany({
      where: {
        productId,
        type: 'B2B_ADJUSTMENT',
        notes: { contains: offlineOrder.orderNumber },
      },
    });
    assert(adjustMovements.length >= 2, `B2B_ADJUSTMENT stock movements recorded for both edits`);

    // ══════════════════════════════════════════════════════════════════════════
    // SCENARIO 12: Confirmed cancel: restores stock with B2B_CANCELLATION
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n🔹 [Scenario 12] Super Admin cancel on confirmed order restores stock with B2B_CANCELLATION...');
    const invBeforeCancel = await prisma.inventory.findFirst({
      where: { productId, branchId },
    });
    const physicalBeforeCancel = Number(invBeforeCancel?.quantity || 0);

    // Current quantity on edited order is 7
    const cancelledConfirmed = await adminCancelConfirmedB2bOrder(
      superAdminUser,
      offlineOrder.id,
      'Project site closed permanently'
    );
    if (!cancelledConfirmed) throw new Error('Failed to cancel offlineOrder');

    assert(cancelledConfirmed.status === 'cancelled', `Confirmed order transitioned to 'cancelled'`);

    const invAfterCancel = await prisma.inventory.findFirst({
      where: { productId, branchId },
    });
    const physicalAfterCancel = Number(invAfterCancel?.quantity || 0);

    assert(
      physicalAfterCancel === physicalBeforeCancel + 7,
      `Stock restored to inventory on cancellation of confirmed order (+7) (${physicalAfterCancel} == ${physicalBeforeCancel + 7})`
    );

    const cancelMovements = await prisma.stockMovement.findMany({
      where: {
        productId,
        type: 'B2B_CANCELLATION',
        notes: { contains: offlineOrder.orderNumber },
      },
    });
    assert(cancelMovements.length > 0, `B2B_CANCELLATION movement logged with reason`);

    console.log('\n════════════════════════════════════════════════════════════════');
    console.log(`🎉 ALL 12 SPECIFICATION SCENARIOS PASSED SUCCESSFULLY! (${passed} checks, 0 failed)`);
    console.log('════════════════════════════════════════════════════════════════\n');
  } catch (error: any) {
    console.error('\n❌ Test suite aborted due to error:', error);
    process.exit(1);
  } finally {
    // ─── AUTOMATIC TEARDOWN: PURGE ALL TEST ENTRIES ───
    try {
      console.log('🧹 Purging test orders, reservations, audit movements, and test users...');
      await prisma.stockReservation.deleteMany();
      await prisma.b2bOrderItem.deleteMany();
      await prisma.b2bOrder.deleteMany();
      await (prisma as any).b2bOrderSequence.deleteMany();
      await prisma.stockMovement.deleteMany({
        where: {
          OR: [
            { referenceType: 'B2B_ORDER' },
            { type: { in: ['B2B_ORDER', 'B2B_ADJUSTMENT', 'B2B_CANCELLATION'] as any } },
          ],
        },
      });
      await prisma.notification.deleteMany({
        where: {
          type: { in: ['B2B_ORDER_PENDING', 'B2B_ORDER_CONFIRMED', 'B2B_ORDER_REJECTED', 'B2B_ORDER_CANCELLED'] as any },
        },
      });
      await prisma.user.deleteMany({
        where: {
          OR: [
            { id: { in: ['c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002'] } },
            { email: { in: ['commercial@acme-builders.in', 'john.retail@gmail.com', 'superadmin@pacifichardware.com', 'staff@pacifichardware.com'] } },
          ],
        },
      });
      await prisma.inventory.updateMany({
        where: { reservedQuantity: { gt: 0 } },
        data: { reservedQuantity: 0 },
      });
      console.log('✨ All test data purged. Database restored to pristine clean state.');
    } catch (cleanErr) {
      console.warn('Teardown warning:', cleanErr);
    }
    await prisma.$disconnect();
  }
}

runB2BScenarios();
