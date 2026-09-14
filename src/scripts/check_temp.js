require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const { ExpensesService } = require('../modules/expenses/expenses.service');
    
    // 1. All branches
    const all = await ExpensesService.getExpenses({});
    console.log('--- GET EXPENSES (ALL BRANCHES) --- count:', all.totalCount, 'entries:', all.entries.length);
    for (const e of all.entries) {
      console.log(`[ALL] ${e.entryNumber} | Branch: ${e.branch?.name} | Rs ${e.amount/100}`);
    }

    // 2. Delhi only
    const delhi = await ExpensesService.getExpenses({ branchId: 'b1000000-0000-0000-0000-000000000001' });
    console.log('--- GET EXPENSES (DELHI ONLY) --- count:', delhi.totalCount, 'entries:', delhi.entries.length);
    for (const e of delhi.entries) {
      console.log(`[DELHI] ${e.entryNumber} | Branch: ${e.branch?.name} | Rs ${e.amount/100}`);
    }

    // 3. Kolkata only
    const kolkata = await ExpensesService.getExpenses({ branchId: 'b2000000-0000-0000-0000-000000000002' });
    console.log('--- GET EXPENSES (KOLKATA ONLY) --- count:', kolkata.totalCount, 'entries:', kolkata.entries.length);
    for (const e of kolkata.entries) {
      console.log(`[KOLKATA] ${e.entryNumber} | Branch: ${e.branch?.name} | Rs ${e.amount/100}`);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}
check();
