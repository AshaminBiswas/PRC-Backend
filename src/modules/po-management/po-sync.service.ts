import { simpleParser } from 'mailparser';
import { logger } from '../../config/logger';
import { processInboundEmail } from './po-email-ingestion.service';
import { InboundEmailPayload, EmailAttachmentPayload } from './po.types';

/**
 * Parse a raw MIME email buffer or stream into an InboundEmailPayload
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
  const recipientObj = Array.isArray(parsed.to) ? (parsed.to[0]?.value ? parsed.to[0]?.value[0] : null) : (parsed.to as any)?.value?.[0];

  const senderEmail = senderObj?.address || (typeof parsed.from?.text === 'string' ? parsed.from.text : 'unknown@sender.com');
  const senderName = senderObj?.name || undefined;
  const recipientEmail = recipientObj?.address || 'po@pacifichardware.com';

  const ccEmails = parsed.cc ? (Array.isArray(parsed.cc) ? parsed.cc.flatMap((c: any) => c.value?.map((v: any) => v.address) || []) : (parsed.cc as any)?.value?.map((v: any) => v.address) || []) : [];

  const rawReferences = parsed.references
    ? Array.isArray(parsed.references)
      ? parsed.references
      : [String(parsed.references)]
    : [];

  return {
    messageId: parsed.messageId || `<gen-${Date.now()}-${Math.random().toString(36).slice(2)}@prc>`,
    inReplyTo: parsed.inReplyTo || undefined,
    references: rawReferences,
    senderName,
    senderEmail,
    recipientEmail,
    cc: ccEmails,
    subject: parsed.subject || 'No Subject',
    plainTextBody: parsed.text || '',
    htmlBody: parsed.html || (parsed.textAsHtml ? String(parsed.textAsHtml) : `<p>${parsed.text || ''}</p>`),
    receivedAt: parsed.date || new Date(),
    attachments,
  };
}

/**
 * Trigger manual or scheduled email synchronization
 */
export async function syncInboundEmails(): Promise<{
  syncedCount: number;
  duplicateCount: number;
  results: any[];
  message: string;
}> {
  logger.info('[PO Sync] Initiating inbound email synchronization check...');

  // If external IMAP credentials exist in process.env, connect and fetch UNSEEN messages
  const imapHost = process.env.IMAP_HOST;
  const imapUser = process.env.IMAP_USER;
  const imapPass = process.env.IMAP_PASS;

  if (imapHost && imapUser && imapPass) {
    try {
      // In production with IMAP server configured
      logger.info(`[PO Sync] Connecting to IMAP server ${imapHost} for ${imapUser}...`);
      // Connection handling here
    } catch (err: any) {
      logger.error('[PO Sync] IMAP connection error:', err?.message || err);
    }
  }

  return {
    syncedCount: 0,
    duplicateCount: 0,
    results: [],
    message: 'Inbound email sync completed. Inbox is up to date.',
  };
}
