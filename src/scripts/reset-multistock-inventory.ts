import prisma from '../config/database';

async function resetMultistockInventory() {
  console.log('🚀 Starting Multi-Stock Inventory Database Reset...');

  const result = await prisma.$transaction(async (tx) => {
    // 1. Delete Stock Reservations
    const deletedReservations = await tx.stockReservation.deleteMany({});
    console.log(`✓ Deleted ${deletedReservations.count} stock reservations`);

    // 2. Delete Stock Movements
    const deletedMovements = await tx.stockMovement.deleteMany({});
    console.log(`✓ Deleted ${deletedMovements.count} stock movements`);

    // 3. Delete Stock Transfer Items & Stock Transfers
    const deletedTransferItems = await tx.stockTransferItem.deleteMany({});
    console.log(`✓ Deleted ${deletedTransferItems.count} stock transfer items`);

    const deletedTransfers = await tx.stockTransfer.deleteMany({});
    console.log(`✓ Deleted ${deletedTransfers.count} stock transfers`);

    // 4. Delete Purchase Items & Purchases
    const deletedPurchaseItems = await tx.purchaseItem.deleteMany({});
    console.log(`✓ Deleted ${deletedPurchaseItems.count} purchase items`);

    const deletedPurchases = await tx.purchase.deleteMany({});
    console.log(`✓ Deleted ${deletedPurchases.count} purchases`);

    // 5. Delete all Inventory rows (multi-branch stock allocations)
    const deletedInventories = await tx.inventory.deleteMany({});
    console.log(`✓ Deleted ${deletedInventories.count} multi-branch inventory rows`);

    // 6. Reset all Product stock counters to 0
    const updatedProducts = await tx.product.updateMany({
      data: {
        stock: 0,
      },
    });
    console.log(`✓ Reset stock to 0 for ${updatedProducts.count} products`);

    // 7. Permanently purge soft-deleted products that have no orders/invoices
    const softDeletedProds = await tx.product.findMany({
      where: { deletedAt: { not: null } },
      include: {
        orderItems: true,
        invoiceItems: true,
        quoteItems: true,
        proformaInvoiceItems: true,
        b2bOrderItems: true,
      },
    });

    let purgedCount = 0;
    for (const p of softDeletedProds) {
      if (
        p.orderItems.length === 0 &&
        p.invoiceItems.length === 0 &&
        p.quoteItems.length === 0 &&
        p.proformaInvoiceItems.length === 0 &&
        p.b2bOrderItems.length === 0
      ) {
        try {
          await tx.product.delete({ where: { id: p.id } });
          purgedCount++;
        } catch (e: any) {
          console.warn(`Could not hard-delete product ${p.sku}:`, e?.message);
        }
      }
    }
    console.log(`✓ Permanently purged ${purgedCount} soft-deleted test products from database`);

    return {
      deletedReservations: deletedReservations.count,
      deletedMovements: deletedMovements.count,
      deletedTransferItems: deletedTransferItems.count,
      deletedTransfers: deletedTransfers.count,
      deletedPurchaseItems: deletedPurchaseItems.count,
      deletedPurchases: deletedPurchases.count,
      deletedInventories: deletedInventories.count,
      updatedProducts: updatedProducts.count,
      purgedProducts: purgedCount,
    };
  });

  console.log('🎉 Multi-Stock Inventory Database successfully emptied!');
  console.log(JSON.stringify(result, null, 2));
}

resetMultistockInventory()
  .catch((err) => {
    console.error('❌ Failed to reset multi-stock inventory:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
