import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Delete data from tables while preserving users and related auth data
  // Order matters due to foreign key constraints
  await prisma.wishlistItem.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.quoteItem.deleteMany();
  await prisma.couponUsage.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.orderStatusHistory.deleteMany();
  await prisma.order.deleteMany();
  await prisma.quote.deleteMany();
  await prisma.review.deleteMany();
  await prisma.enquiry.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.wishlist.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.courierRate.deleteMany();
  await prisma.shippingRate.deleteMany();
  await prisma.warehouseZoneMapping.deleteMany();
  await prisma.shippingZone.deleteMany();
  await prisma.courier.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.staffAvailability.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.address.deleteMany();
  // Users and auth-related tables (refreshTokens, emailVerifications, passwordResets, activityLogs) are preserved.
  console.log('Database cleaned, preserved users and auth data.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
