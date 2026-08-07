import prisma from '../config/database';

async function main() {
  console.log('🗑️ Removing Mumbai Warehouse from active allocation pool...\n');

  const wh = await prisma.warehouse.findFirst({
    where: {
      OR: [
        { id: '0041a217-99de-48f1-8779-13fee119ff58' },
        { code: 'MUMBAI-WH-01' },
      ],
    },
  });

  if (wh) {
    await prisma.warehouse.update({
      where: { id: wh.id },
      data: {
        isActive: false,
        status: 'INACTIVE',
        deletedAt: new Date(),
      },
    });
    console.log(`✅ Warehouse '${wh.name}' (${wh.code}) marked INACTIVE and soft deleted.`);
  } else {
    console.log('ℹ️ Mumbai Warehouse not found or already deleted.');
  }
}

main()
  .catch((e) => {
    console.error('Error removing warehouse:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
