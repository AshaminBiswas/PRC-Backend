import imaps from 'imap-simple';
import { simpleParser, ParsedMail } from 'mailparser';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { InboundEmailPayload } from './po.types';
import { processInboundEmail } from './po-email-ingestion.service';

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
 */
export async function syncInboundEmails() {
  if (isSyncing) {
    logger.info('[PO Sync] IMAP synchronization is already in progress. Skipping concurrent run.');
    return {
      syncedCount: 0,
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
  let duplicateCount = 0;
  const results: any[] = [];

  try {
    logger.info(`[PO Sync] Connecting to IMAP server ${imapHost}:${imapPort} for ${imapUser}...`);
    connection = await imaps.connect(config);
    await connection.openBox(mailbox);

    const fetchOptions = {
      bodies: ['HEADER', 'TEXT', ''],
      struct: true,
      markSeen: false, // Preserves read state in user inbox
    };

    // 1. First search for unread emails
    let messages = await connection.search(['UNSEEN'], fetchOptions);
    logger.info(`[PO Sync] Found ${messages.length} unread email(s) in ${mailbox}.`);

    // 2. If no unread emails, fetch all recent emails so existing inbox emails are ingested
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
      `[PO Sync] IMAP Sync completed: ${syncedCount} new email(s) ingested, ${duplicateCount} duplicate(s) skipped.`
    );

    return {
      syncedCount,
      duplicateCount,
      results,
      message: `Successfully synchronized inbox: ${syncedCount} new email(s) ingested, ${duplicateCount} duplicate(s) skipped.`,
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
