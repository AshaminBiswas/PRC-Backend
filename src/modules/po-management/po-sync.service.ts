import imaps from 'imap-simple';
import { simpleParser, ParsedMail } from 'mailparser';
import prisma from '../../config/database';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { eventBus } from '../../events/eventBus';
import { InboundEmailPayload } from './po.types';
import { processInboundEmail } from './po-email-ingestion.service';

/**
 * Normalizes email Message-ID for consistent set comparison
 */
function normalizeMessageId(id?: string | null): string {
  if (!id) return '';
  return id.trim().replace(/^<|>$/g, '').toLowerCase();
}

/**
 * Extracts raw Message-ID string from an IMAP header part body
 */
function extractMessageIdFromHeader(partBody: any): string | null {
  if (!partBody) return null;
  if (typeof partBody === 'object') {
    const raw = partBody['message-id'] || partBody['Message-ID'] || partBody['Message-Id'];
    if (Array.isArray(raw)) return raw[0] ? String(raw[0]) : null;
    if (typeof raw === 'string') return raw;
  }
  if (typeof partBody === 'string') {
    const match = partBody.match(/(?:^|\r?\n)message-id:\s*([^\r\n]+)/i);
    if (match && match[1]) return match[1].trim();
  }
  return null;
}

/**
 * Parses raw RFC 822 MIME message source into structured InboundEmailPayload
 */
export async function parseRawEmail(rawSource: string | Buffer): Promise<InboundEmailPayload> {
  const parsed: ParsedMail = await simpleParser(rawSource);

  // Extract Clean From / Sender
  const fromObj = parsed.from?.value?.[0];
  const senderEmail = (fromObj?.address || '').toLowerCase().trim();
  const senderName = fromObj?.name || '';

  // Extract Recipients
  const toAddresses: string[] = [];
  if (Array.isArray(parsed.to)) {
    parsed.to.forEach((t) => t.value.forEach((v) => v.address && toAddresses.push(v.address.toLowerCase().trim())));
  } else if (parsed.to?.value) {
    parsed.to.value.forEach((v) => v.address && toAddresses.push(v.address.toLowerCase().trim()));
  }
  const recipientEmail = toAddresses[0] || env.smtp.fromEmail;

  // Extract CC
  const ccAddresses: string[] = [];
  if (Array.isArray(parsed.cc)) {
    parsed.cc.forEach((c) => c.value.forEach((v) => v.address && ccAddresses.push(v.address.toLowerCase().trim())));
  } else if (parsed.cc?.value) {
    parsed.cc.value.forEach((v) => v.address && ccAddresses.push(v.address.toLowerCase().trim()));
  }

  // Extract Message-ID and In-Reply-To
  const messageId = parsed.messageId || `<generated-${Date.now()}-${Math.random().toString(36).substring(2, 9)}@pacifichardware.internal>`;
  const inReplyTo = parsed.inReplyTo || undefined;
  const references: string[] = Array.isArray(parsed.references)
    ? parsed.references
    : parsed.references
    ? [parsed.references]
    : [];

  // Extract Subject and Body
  const subject = parsed.subject || 'No Subject';
  const plainText = parsed.text || '';
  const htmlBody = parsed.html ? (parsed.html as string) : undefined;

  // Extract Attachments
  const attachments: InboundEmailPayload['attachments'] = [];
  if (parsed.attachments && parsed.attachments.length > 0) {
    for (const att of parsed.attachments) {
      attachments.push({
        fileName: att.filename || `attachment-${Date.now()}`,
        fileType: att.contentType || 'application/octet-stream',
        fileSize: att.size || att.content.length,
        buffer: att.content,
      });
    }
  }

  return {
    messageId,
    inReplyTo,
    references,
    senderName,
    senderEmail,
    recipientEmail,
    cc: ccAddresses,
    subject,
    plainTextBody: plainText,
    htmlBody,
    receivedAt: parsed.date || new Date(),
    attachments,
  };
}

let isSyncing = false;
let autoSyncTimer: NodeJS.Timeout | null = null;

/**
 * Synchronize inbound emails from the configured IMAP Mailbox (e.g. Gmail / Outlook / Exchange)
 * Automatically detects new emails and reconciles deleted emails from the mail client.
 */
export async function syncInboundEmails() {
  if (isSyncing) {
    logger.info('[PO Sync] IMAP synchronization is already in progress. Skipping concurrent run.');
    return {
      syncedCount: 0,
      deletedCount: 0,
      duplicateCount: 0,
      results: [],
      message: 'Sync already in progress.',
    };
  }

  const imapHost = env.imap.host;
  const imapUser = env.imap.user;
  const imapPass = env.imap.pass;
  const imapPort = env.imap.port || 993;
  const imapTls = env.imap.tls ?? true;
  const mailbox = env.imap.mailbox || 'INBOX';

  if (!imapHost || !imapUser || !imapPass) {
    logger.warn(
      '[PO Sync] IMAP credentials (IMAP_HOST, IMAP_USER, IMAP_PASS) not configured in environment. Skipping mailbox sync.'
    );
    return {
      syncedCount: 0,
      deletedCount: 0,
      duplicateCount: 0,
      results: [],
      message:
        'IMAP credentials (IMAP_HOST, IMAP_USER, IMAP_PASS) not configured. Please set them in Render Environment Variables.',
    };
  }

  isSyncing = true;

  const config: imaps.ImapSimpleOptions = {
    imap: {
      user: imapUser,
      password: imapPass,
      host: imapHost,
      port: imapPort,
      tls: imapTls,
      authTimeout: 15000,
      tlsOptions: { rejectUnauthorized: false },
    },
  };

  let connection: imaps.ImapSimple | null = null;
  let syncedCount = 0;
  let deletedCount = 0;
  let duplicateCount = 0;
  const results: any[] = [];

  try {
    logger.info(`[PO Sync] Connecting to IMAP server ${imapHost}:${imapPort} for ${imapUser}...`);
    connection = await imaps.connect(config);
    await connection.openBox(mailbox);

    // ─── STEP 1: RECONCILE DELETED EMAILS FROM MAIL APP ───────────────────────
    // Fetch all active message headers currently residing in the IMAP INBOX
    try {
      const allHeaderMessages = await connection.search(['ALL'], {
        bodies: ['HEADER'],
        struct: false,
      });

      const activeInboxMsgIds = new Set<string>();
      for (const item of allHeaderMessages) {
        const headerPart = item.parts.find((p) => p.which === 'HEADER');
        if (headerPart && headerPart.body) {
          const extractedMsgId = extractMessageIdFromHeader(headerPart.body);
          if (extractedMsgId) {
            activeInboxMsgIds.add(normalizeMessageId(extractedMsgId));
          }
        }
      }

      logger.info(`[PO Sync] Active IMAP Inbox contains ${activeInboxMsgIds.size} message(s) for reconciliation.`);

      // Query all incoming email records from our database created via email
      const dbEmails = await prisma.poEmailMessage.findMany({
        where: {
          direction: 'INCOMING',
          poSubmission: {
            source: 'EMAIL',
          },
        },
        select: {
          id: true,
          messageId: true,
          poSubmissionId: true,
          poSubmission: {
            select: {
              id: true,
              poSubmissionId: true,
              subject: true,
              _count: {
                select: { emails: true },
              },
            },
          },
        },
      });

      const processedSubmissionDeletes = new Set<string>();

      for (const dbEmail of dbEmails) {
        const normDbId = normalizeMessageId(dbEmail.messageId);
        // Skip synthetic / manually generated message IDs
        if (!normDbId || normDbId.startsWith('generated-')) continue;

        // If the email Message-ID is no longer in the user's IMAP Inbox, it was deleted in the Mail App!
        if (!activeInboxMsgIds.has(normDbId)) {
          if (dbEmail.poSubmissionId && !processedSubmissionDeletes.has(dbEmail.poSubmissionId)) {
            const submission = dbEmail.poSubmission;
            const emailCount = submission?._count?.emails || 1;

            if (emailCount <= 1) {
              // Delete entire PO submission if it only consisted of this deleted email
              processedSubmissionDeletes.add(dbEmail.poSubmissionId);
              try {
                await prisma.poSubmission.delete({
                  where: { id: dbEmail.poSubmissionId },
                });
                eventBus.emitEvent('po.deleted', {
                  id: dbEmail.poSubmissionId,
                  poSubmissionId: submission?.poSubmissionId || null,
                  reason: 'EMAIL_DELETED_IN_MAILBOX',
                });
                logger.info(
                  `[PO Sync] Pruned deleted email PO Submission: ${submission?.poSubmissionId || dbEmail.poSubmissionId} (${submission?.subject || dbEmail.messageId})`
                );
                deletedCount++;
              } catch (delErr: any) {
                logger.warn(`[PO Sync] Failed to delete pruned PO Submission ${dbEmail.poSubmissionId}:`, delErr?.message || delErr);
              }
            } else {
              // Delete individual email message from threaded submission
              try {
                await prisma.poEmailMessage.delete({
                  where: { id: dbEmail.id },
                });
                logger.info(`[PO Sync] Pruned single deleted message from thread: ${dbEmail.messageId}`);
                deletedCount++;
              } catch (delErr: any) {
                logger.warn(`[PO Sync] Failed to delete pruned email message ${dbEmail.id}:`, delErr?.message || delErr);
              }
            }
          }
        }
      }
    } catch (reconcileErr: any) {
      logger.warn('[PO Sync] Deletion reconciliation pass notice:', reconcileErr?.message || reconcileErr);
    }

    // ─── STEP 2: INGEST NEW / UNSEEN INBOUND EMAILS ───────────────────────────
    const fetchOptions = {
      bodies: ['HEADER', 'TEXT', ''],
      struct: true,
      markSeen: false, // Preserves read state in user inbox
    };

    // 1. First search for unread emails
    let messages = await connection.search(['UNSEEN'], fetchOptions);
    logger.info(`[PO Sync] Found ${messages.length} unread email(s) in ${mailbox}.`);

    // 2. If no unread emails, fetch recent emails so existing inbox emails are ingested
    if (messages.length === 0) {
      logger.info(`[PO Sync] Searching for recent emails in ${mailbox}...`);
      messages = await connection.search(['ALL'], fetchOptions);
      logger.info(`[PO Sync] Found ${messages.length} total email(s) in ${mailbox}.`);
    }

    // Process newest messages first (last 50 in reverse order)
    const messagesToProcess = messages.slice(-50).reverse();

    for (const item of messagesToProcess) {
      const allParts = item.parts.find((part) => part.which === '');
      const rawSource = allParts ? allParts.body : '';

      if (rawSource) {
        try {
          const parsedPayload = await parseRawEmail(rawSource);
          const ingestionResult = await processInboundEmail(parsedPayload);

          if (ingestionResult.duplicate) {
            duplicateCount++;
          } else {
            syncedCount++;
            results.push({
              messageId: parsedPayload.messageId,
              subject: parsedPayload.subject,
              sender: parsedPayload.senderEmail,
              poSubmissionId: ingestionResult.poSubmission?.poSubmissionId,
              classification: ingestionResult.poSubmission?.classification,
            });
          }
        } catch (err: any) {
          logger.error(`[PO Sync] Failed to parse and ingest message UID ${item.attributes.uid}:`, err?.message || err);
        }
      }
    }

    connection.end();
    logger.info(
      `[PO Sync] IMAP Sync completed: ${syncedCount} new ingested, ${deletedCount} pruned, ${duplicateCount} duplicate(s) skipped.`
    );

    return {
      syncedCount,
      deletedCount,
      duplicateCount,
      results,
      message: `Successfully synchronized inbox: ${syncedCount} new ingested, ${deletedCount} deleted email(s) removed, ${duplicateCount} duplicate(s) skipped.`,
    };
  } catch (err: any) {
    if (connection) {
      try {
        connection.end();
      } catch {}
    }
    logger.error('[PO Sync] IMAP sync error:', err?.message || err);
    throw new Error(`IMAP mailbox synchronization failed: ${err?.message || err}`);
  } finally {
    isSyncing = false;
  }
}

/**
 * Starts automatic background IMAP email polling service (every 60 seconds)
 */
export function startPoAutoSync(intervalMs = 60000): void {
  if (autoSyncTimer) return;

  const imapHost = env.imap.host;
  const imapUser = env.imap.user;
  const imapPass = env.imap.pass;

  if (!imapHost || !imapUser || !imapPass) {
    logger.info('[PO Auto-Sync] IMAP credentials not configured. Auto-sync is inactive until credentials are provided.');
    return;
  }

  logger.info(`[PO Auto-Sync] Starting background IMAP email polling every ${Math.round(intervalMs / 1000)}s for ${imapUser}...`);

  // Initial trigger after 5 seconds to let server boot
  setTimeout(async () => {
    try {
      await syncInboundEmails();
    } catch (err: any) {
      logger.warn('[PO Auto-Sync] Initial sync pass notice:', err?.message || err);
    }
  }, 5000);

  // Periodic recurring background sync
  autoSyncTimer = setInterval(async () => {
    try {
      await syncInboundEmails();
    } catch (err: any) {
      logger.warn('[PO Auto-Sync] Periodic sync pass notice:', err?.message || err);
    }
  }, intervalMs);
}

/**
 * Stops the automatic background IMAP email polling service
 */
export function stopPoAutoSync(): void {
  if (autoSyncTimer) {
    clearInterval(autoSyncTimer);
    autoSyncTimer = null;
    logger.info('[PO Auto-Sync] Background IMAP polling stopped.');
  }
}
