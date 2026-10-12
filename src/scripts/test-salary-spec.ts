import { simulateSalaryCalculation } from '../modules/employee-management/employee-management.service';

async function runTests() {
  console.log('================================================================');
  console.log('RUNNING PAYROLL SALARY, ATTENDANCE & OVERTIME ACCEPTANCE TESTS');
  console.log('================================================================\n');

  // ─── Acceptance Test 1 ──────────────────────────────────────────────────────
  console.log('--- TEST CASE 1: Standard Base Spec ---');
  const test1 = await simulateSalaryCalculation({
    month: 9,
    year: 2026,
    monthlyCtc: 23500,
    standardPayableDays: 26,
    standardWorkingHours: 8,
    regularPayableDays: 26,
    additionalSundayDutyCredits: 1,
    additionalDoubleDutyCredits: 1,
    approvedOvertimeHours: 0,
    overtimeMultiplier: 1.0,
    partialDeductions: 0,
    additionalAllowances: 0,
    saveToPayroll: false,
  });

  console.log('Monthly Salary Base:', test1.monthlySalaryBase);
  console.log('Standard Payable Days:', test1.standardPayableDays);
  console.log('Per-Day Salary:', test1.perDaySalary);
  console.log('Per-Hour Salary:', test1.perHourSalary);
  console.log('Regular Attendance:', test1.regularPayableAttendance);
  console.log('Sunday Duty Credit:', test1.additionalSundayDutyCredit);
  console.log('Double Duty Credit:', test1.additionalDoubleDutyCredit);
  console.log('Total Payable Day Equivalents:', test1.totalPayableDayEquivalents);
  console.log('Base Payable Salary:', test1.basePayableSalary);
  console.log('Overtime Pay:', test1.overtimePay);
  console.log('Partial Deductions:', test1.partialDeductions);
  console.log('Gross Earnings:', test1.grossEarnings);
  console.log('FINAL PAYABLE SALARY:', test1.finalPayableSalary);

  const test1Pass =
    test1.perDaySalary === 903.85 &&
    test1.perHourSalary === 112.98 &&
    test1.payableDays === 26 &&
    test1.paidDays === 28 &&
    test1.totalPayableDayEquivalents === 28 &&
    test1.basePayableSalary === 25307.69 &&
    test1.overtimePay === 0.0 &&
    test1.partialDeductions === 0.0 &&
    test1.finalPayableSalary === 25307.69;

  console.log(`Test Case 1 Verification: ${test1Pass ? '✅ PASS' : '❌ FAIL'}\n`);

  // ─── Acceptance Test 2 ──────────────────────────────────────────────────────
  console.log('--- TEST CASE 2: Overtime (4 hrs) + Partial Deduction (₹500) ---');
  const test2 = await simulateSalaryCalculation({
    month: 9,
    year: 2026,
    monthlyCtc: 23500,
    standardPayableDays: 26,
    standardWorkingHours: 8,
    regularPayableDays: 26,
    additionalSundayDutyCredits: 1,
    additionalDoubleDutyCredits: 1,
    approvedOvertimeHours: 4,
    overtimeMultiplier: 1.0,
    partialDeductions: 500,
    additionalAllowances: 0,
    saveToPayroll: false,
  });

  console.log('Approved Overtime Hours:', test2.approvedOvertimeHours);
  console.log('Payable Days (Fixed):', test2.payableDays);
  console.log('Paid Days (Total Present):', test2.paidDays);
  console.log('Overtime Pay:', test2.overtimePay);
  console.log('Partial Deductions:', test2.partialDeductions);
  console.log('Gross Earnings:', test2.grossEarnings);
  console.log('FINAL PAYABLE SALARY:', test2.finalPayableSalary);

  const test2Pass =
    test2.perDaySalary === 903.85 &&
    test2.perHourSalary === 112.98 &&
    test2.payableDays === 26 &&
    test2.paidDays === 28 &&
    test2.totalPayableDayEquivalents === 28 &&
    test2.overtimePay === 451.92 &&
    test2.partialDeductions === 500.0 &&
    test2.finalPayableSalary === 25259.61;

  console.log(`Test Case 2 Verification: ${test2Pass ? '✅ PASS' : '❌ FAIL'}\n`);

  console.log('--- Step-by-Step Calculation History (7 Steps) ---');
  test2.calculationHistory.forEach((h) => {
    console.log(`Step ${h.step}: ${h.title} => ${h.calculation} = ${h.result}`);
  });

  if (test1Pass && test2Pass) {
    console.log('\n🎉 ALL ACCEPTANCE SPECIFICATION TESTS PASSED WITH 100% PRECISION!');
    process.exit(0);
  } else {
    console.error('\n❌ ACCEPTANCE TESTS FAILED');
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error in tests:', err);
  process.exit(1);
});
