import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { processInboundEmail } from './po-email-ingestion.service';
import { InboundEmailPayload, EmailAttachmentPayload } from './po.types';

/**
 * Parse a raw MIME email buffer or string into an InboundEmailPayload
 */
export async function parseRawEmail(rawBuffer: Buffer | string): Promise<InboundEmailPayload> {
  const parsed = await simpleParser(rawBuffer);

  const attachments: EmailAttachmentPayload[] = [];
  if (parsed.attachments && Array.isArray(parsed.attachments)) {
    for (const att of parsed.attachments) {
      attachments.push({
        fileName: att.filename || 'attachment',
        fileType: att.contentType || 'application/octet-stream',
        fileSize: att.size || att.content.length,
        buffer: att.content,
      });
    }
  }

  const senderObj = Array.isArray(parsed.from?.value) ? parsed.from?.value[0] : parsed.from?.value;
  const recipientObj = Array.isArray(parsed.to)
    ? parsed.to[0]?.value
      ? parsed.to[0]?.value[0]
      : null
    : (parsed.to as any)?.value?.[0];

  const senderEmail =
    senderObj?.address ||
    (typeof parsed.from?.text === 'string' ? parsed.from.text : 'unknown@sender.com');
  const senderName = senderObj?.name || undefined;
  const recipientEmail = recipientObj?.address || 'po@pacifichardware.com';

  const ccEmails = parsed.cc
    ? Array.isArray(parsed.cc)
      ? parsed.cc.flatMap((c: any) => c.value?.map((v: any) => v.address) || [])
      : (parsed.cc as any)?.value?.map((v: any) => v.address) || []
    : [];

  const rawReferences = parsed.references
    ? Array.isArray(parsed.references)
      ? parsed.references
      : [String(parsed.references)]
    : [];

  return {
    messageId:
      parsed.messageId ||
      `<gen-${Date.now()}-${Math.random().toString(36).slice(2)}@inbound.prchardware.com>`,
    inReplyTo: parsed.inReplyTo || undefined,
    references: rawReferences,
    senderName,
    senderEmail,
    recipientEmail,
    cc: ccEmails,
    subject: parsed.subject || 'No Subject',
    plainTextBody: parsed.text || '',
    htmlBody:
      parsed.html ||
      (parsed.textAsHtml ? String(parsed.textAsHtml) : `<p>${parsed.text || ''}</p>`),
    receivedAt: parsed.date || new Date(),
    attachments,
  };
}

/**
 * Trigger manual or scheduled email synchronization via IMAP
 */
export async function syncInboundEmails(): Promise<{
  syncedCount: number;
  duplicateCount: number;
  results: any[];
  message: string;
}> {
  logger.info('[PO Sync] Initiating inbound email synchronization check...');

  const imapHost = env.imap.host;
  const imapUser = env.imap.user;
  const imapPass = env.imap.pass;
  const imapPort = env.imap.port || 993;
  const imapTls = env.imap.tls ?? true;
  const mailbox = env.imap.mailbox || 'INBOX';

  if (!imapHost || !imapUser || !imapPass) {
    logger.warn(
      '[PO Sync] IMAP credentials (IMAP_HOST, IMAP_USER, IMAP_PASS) not configured in .env. Skipping mailbox sync.'
    );
    return {
      syncedCount: 0,
      duplicateCount: 0,
      results: [],
      message:
        'IMAP credentials (IMAP_HOST, IMAP_USER, IMAP_PASS) not configured in .env. If using webhooks, emails are ingested automatically on arrival.',
    };
  }

  const config: imaps.ImapSimpleOptions = {
    imap: {
      user: imapUser,
      password: imapPass,
      host: imapHost,
      port: imapPort,
      tls: imapTls,
      authTimeout: 10000,
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

    // Fetch unread messages
    const searchCriteria = ['UNSEEN'];
    const fetchOptions = {
      bodies: ['HEADER', 'TEXT', ''],
      struct: true,
      markSeen: true,
    };

    const messages = await connection.search(searchCriteria, fetchOptions);
    logger.info(`[PO Sync] Found ${messages.length} unread email(s) in ${mailbox}.`);

    for (const item of messages) {
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
    logger.error('[PO Sync] IMAP sync failed with error:', err?.message || err);
    throw new Error(`IMAP mailbox synchronization failed: ${err?.message || err}`);
  }
}
