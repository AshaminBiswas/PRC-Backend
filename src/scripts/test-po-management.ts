import prisma from '../config/database';
import { processInboundEmail } from '../modules/po-management/po-email-ingestion.service';
import {
  listPoSubmissions,
  getPoSubmissionById,
  updatePoStatus,
  updatePoPriority,
  updatePoClassification,
  addInternalNote,
} from '../modules/po-management/po-management.service';
import { PoClassification, PoPriority, PoStatus } from '../modules/po-management/po.types';

async function runPoTests() {
  console.log('🧪 Starting PO Management End-to-End Test Suite...\n');

  const testYear = new Date().getFullYear();
  const testMessageId1 = `<test-po-001-${Date.now()}@customer.com>`;
  const testMessageId2 = `<test-reply-002-${Date.now()}@customer.com>`;
  const testMessageId3 = `<test-general-003-${Date.now()}@inquirer.com>`;

  let createdPoSubmissionId: string | null = null;
  let createdPoRecordId: string | null = null;

  try {
    // ─── TEST 1: Inbound PO Email Ingestion ──────────────────────────────────
    console.log('🔹 Test 1: Inbound Email with Purchase Order content...');
    const res1 = await processInboundEmail({
      messageId: testMessageId1,
      senderName: 'Rajesh Sharma',
      senderEmail: 'rajesh.sharma@infraprojects.in',
      recipientEmail: 'po@pacifichardware.com',
      subject: 'Purchase Order - Infra Projects Ltd [PO-INFRA-2026-9901]',
      plainTextBody: `Dear Team,
Please find attached our official Purchase Order PO-INFRA-2026-9901 for 500 units of SS Mortise Locks.
PO Number: PO-INFRA-2026-9901
Delivery Address: Sector 62, Noida, UP
Payment Terms: 30 days credit
Authorized Signatory: Rajesh Sharma`,
      attachments: [
        {
          fileName: 'Purchase_Order_INFRA_2026.pdf',
          fileType: 'application/pdf',
          fileSize: 1048576,
        },
      ],
    });

    console.log('   ✅ Email processed:', {
      isReply: res1.isReply,
      poSubmissionId: res1.poSubmission?.poSubmissionId,
      classification: res1.poSubmission?.classification,
      confidenceScore: res1.poSubmission?.confidenceScore,
      customerPoNumber: res1.poSubmission?.customerPoNumber,
    });

    if (res1.poSubmission?.classification !== PoClassification.PO_DETECTED) {
      throw new Error(`Expected PO_DETECTED but got ${res1.poSubmission?.classification}`);
    }

    if (!res1.poSubmission?.poSubmissionId?.startsWith(`PRC-PO-${testYear}-`)) {
      throw new Error(`Invalid PO Submission ID format: ${res1.poSubmission?.poSubmissionId}`);
    }

    createdPoRecordId = res1.poSubmission.id;
    createdPoSubmissionId = res1.poSubmission.poSubmissionId;

    // ─── TEST 2: Duplicate Prevention (Idempotency) ───────────────────────────
    console.log('\n🔹 Test 2: Duplicate Email Submission (Idempotent Check)...');
    const res2 = await processInboundEmail({
      messageId: testMessageId1,
      senderEmail: 'rajesh.sharma@infraprojects.in',
      recipientEmail: 'po@pacifichardware.com',
      subject: 'Purchase Order - Infra Projects Ltd [PO-INFRA-2026-9901]',
      plainTextBody: 'Duplicate submission attempt',
    });

    console.log('   ✅ Duplicate skipped as expected:', { duplicate: res2.duplicate });
    if (!res2.duplicate) {
      throw new Error('Duplicate check failed — email was inserted twice!');
    }

    // ─── TEST 3: Email Threading (Customer Reply) ─────────────────────────────
    console.log('\n🔹 Test 3: Customer Reply to Existing Thread...');
    const res3 = await processInboundEmail({
      messageId: testMessageId2,
      inReplyTo: testMessageId1,
      senderEmail: 'rajesh.sharma@infraprojects.in',
      recipientEmail: 'po@pacifichardware.com',
      subject: `Re: Purchase Order - Infra Projects Ltd [${createdPoSubmissionId}]`,
      plainTextBody: 'Adding updated delivery schedule to the previous PO.',
    });

    console.log('   ✅ Reply attached to existing PO:', {
      isReply: res3.isReply,
      targetPoId: res3.poSubmission?.poSubmissionId,
      emailId: res3.emailMessage?.id,
    });

    if (!res3.isReply || res3.poSubmission?.id !== createdPoRecordId) {
      throw new Error('Email threading failed — reply was not attached to existing PO record!');
    }

    // ─── TEST 4: General Inquiry Classification (Non-PO) ──────────────────────
    console.log('\n🔹 Test 4: General Inbound Email (Non-PO)...');
    const res4 = await processInboundEmail({
      messageId: testMessageId3,
      senderEmail: 'ananya@designstudio.com',
      recipientEmail: 'contact@pacifichardware.com',
      subject: 'Showroom timings on weekends',
      plainTextBody: 'Hi, what are your showroom opening hours this Saturday?',
    });

    console.log('   ✅ General inquiry processed:', {
      classification: res4.poSubmission?.classification,
      poSubmissionId: res4.poSubmission?.poSubmissionId,
    });

    if (res4.poSubmission?.classification !== PoClassification.GENERAL_EMAIL) {
      throw new Error(`Expected GENERAL_EMAIL but got ${res4.poSubmission?.classification}`);
    }

    if (res4.poSubmission?.poSubmissionId !== null) {
      throw new Error(`General email should not receive a PO ID, but got: ${res4.poSubmission?.poSubmissionId}`);
    }

    // ─── TEST 5: Status, Priority, Note & Audit Updates ───────────────────────
    console.log('\n🔹 Test 5: Status, Priority, and Internal Notes...');
    if (createdPoRecordId) {
      await updatePoStatus(createdPoRecordId, PoStatus.UNDER_REVIEW, undefined, 'Review started by sales desk');
      await updatePoPriority(createdPoRecordId, PoPriority.URGENT);

      // Find an admin user for note author
      const adminUser = await prisma.user.findFirst({
        where: { status: 'ACTIVE', deletedAt: null },
      });

      if (adminUser) {
        await addInternalNote(createdPoRecordId, adminUser.id, 'Verified customer GSTIN and stock availability.');
      }

      const dossier = await getPoSubmissionById(createdPoRecordId);
      console.log('   ✅ Full PO Dossier verified:', {
        id: dossier.poSubmissionId,
        status: dossier.status,
        priority: dossier.priority,
        emailsCount: dossier.emails.length,
        attachmentsCount: dossier.attachments.length,
        notesCount: dossier.internalNotes.length,
        activityLogsCount: dossier.activityLogs.length,
      });

      if (dossier.status !== PoStatus.UNDER_REVIEW || dossier.priority !== PoPriority.URGENT) {
        throw new Error('Status / Priority update failed');
      }

      if (dossier.emails.length < 2) {
        throw new Error(`Expected at least 2 emails in thread, found ${dossier.emails.length}`);
      }
    }

    console.log('\n🎉 ALL 5 PO MANAGEMENT AUTOMATED TESTS PASSED SUCCESSFULLY!');
  } catch (error: any) {
    console.error('\n❌ Test Suite Failed:', error.message || error);
    process.exit(1);
  } finally {
    // Cleanup test records
    if (createdPoRecordId) {
      await prisma.poSubmission.deleteMany({
        where: {
          customerEmail: { in: ['rajesh.sharma@infraprojects.in', 'ananya@designstudio.com'] },
        },
      }).catch(() => {});
    }
    await prisma.$disconnect();
    process.exit(0);
  }
}

runPoTests();
