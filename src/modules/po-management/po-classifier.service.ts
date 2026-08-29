import { PoClassification, PoClassificationResult, EmailAttachmentPayload } from './po.types';

// High-confidence PO subject keywords
const HIGH_PO_SUBJECT_REGEX = /\b(purchase\s*order|p\.?\s*o\.?\s*#?|p\.o|new\s*po|po\s*submission|po\s*attached|po\s*number|supply\s*order|work\s*order)\b/i;

// Medium-confidence order keywords
const MEDIUM_PO_SUBJECT_REGEX = /\b(order\s*confirmation|order\s*booking|quotation\s*approved|quote\s*approval|hardware\s*order|material\s*order|formal\s*order)\b/i;

// High-confidence PO body keywords
const HIGH_PO_BODY_TERMS = [
  'purchase order',
  'po number',
  'po no',
  'p.o. no',
  'po date',
  'billing address',
  'shipping address',
  'delivery schedule',
  'authorized signatory',
  'payment terms',
  'gstin',
  'hsn code',
  'grand total',
];

// Attachment filename PO patterns
const PO_ATTACHMENT_REGEX = /\b(po|purchase[_\s-]?order|order[_\s-]?form|customer[_\s-]?po|work[_\s-]?order|po[_\s-]?\d+)\b/i;

export function classifyInboundEmail(
  subject: string,
  plainTextBody: string = '',
  attachments: EmailAttachmentPayload[] = []
): PoClassificationResult {
  let score = 0;
  const reasons: string[] = [];
  const cleanSubject = (subject || '').trim();
  const cleanBody = (plainTextBody || '').toLowerCase();

  // 1. Evaluate Subject Line
  if (HIGH_PO_SUBJECT_REGEX.test(cleanSubject)) {
    score += 0.55;
    reasons.push('Subject contains explicit Purchase Order keywords');
  } else if (MEDIUM_PO_SUBJECT_REGEX.test(cleanSubject)) {
    score += 0.35;
    reasons.push('Subject contains commercial order terms');
  }

  // 2. Evaluate Attachment File Names & Types
  let hasPoPdfOrExcel = false;
  for (const att of attachments) {
    const isDocOrSheet =
      att.fileType.includes('pdf') ||
      att.fileType.includes('spreadsheet') ||
      att.fileType.includes('excel') ||
      /\.(pdf|xlsx|xls)$/i.test(att.fileName);

    if (isDocOrSheet && PO_ATTACHMENT_REGEX.test(att.fileName)) {
      score += 0.4;
      hasPoPdfOrExcel = true;
      reasons.push(`Attachment "${att.fileName}" matches standard PO file naming`);
      break;
    } else if (isDocOrSheet) {
      score += 0.15;
      reasons.push(`Contains document attachment "${att.fileName}"`);
      break;
    }
  }

  // 3. Evaluate Body Text Keywords
  let bodyMatches = 0;
  for (const term of HIGH_PO_BODY_TERMS) {
    if (cleanBody.includes(term)) {
      bodyMatches++;
    }
  }

  if (bodyMatches >= 3) {
    score += 0.3;
    reasons.push(`Email body contains ${bodyMatches} commercial purchase terms`);
  } else if (bodyMatches >= 1) {
    score += 0.15;
    reasons.push(`Email body mentions "${HIGH_PO_BODY_TERMS.find((t) => cleanBody.includes(t))}"`);
  }

  // 4. Inspect buffer text of PDF/text attachments if extractedText is available
  for (const att of attachments) {
    if (att.extractedText) {
      const lowerAttText = att.extractedText.toLowerCase();
      let attMatches = 0;
      for (const term of HIGH_PO_BODY_TERMS) {
        if (lowerAttText.includes(term)) attMatches++;
      }
      if (attMatches >= 2) {
        score += 0.3;
        reasons.push(`Attachment content scan confirmed Purchase Order document`);
        break;
      }
    }
  }

  // Normalize final confidence score between 0.0 and 1.0
  const finalScore = Math.min(1.0, Math.max(0.0, Number(score.toFixed(2))));

  // Extract Customer PO Number if pattern matches
  const extractedCustomerPoNumber = extractCustomerPoNumber(cleanSubject, cleanBody);

  // Determine classification
  let classification: PoClassification = PoClassification.GENERAL_EMAIL;
  if (finalScore >= 0.65 || (hasPoPdfOrExcel && finalScore >= 0.5)) {
    classification = PoClassification.PO_DETECTED;
  } else if (finalScore >= 0.3) {
    classification = PoClassification.POSSIBLE_PO;
  }

  return {
    classification,
    confidenceScore: finalScore,
    reasons,
    extractedCustomerPoNumber,
  };
}

/**
 * Extract customer's own PO number from subject or body
 * Examples: ABC/PO/2026/091, PO-998812, PO# 44102, Purchase Order No: PO/IN/2910
 */
export function extractCustomerPoNumber(subject: string, body: string): string | undefined {
  const sources = [subject, body];
  const patterns = [
    /(?:P\.?O\.?|Purchase\s*Order|Work\s*Order)\s*(?:No\.?|Number|#)?\s*[:\-]?\s*([A-Za-z0-9\/\-_]{3,35})/i,
    /\b(?:PO\s*#\s*|PO#)([A-Za-z0-9\/\-_]{3,35})\b/i,
    /\b(?:Order\s*(?:No\.?|Number|#))\s*[:\-]?\s*([A-Za-z0-9\/\-_]{3,35})/i,
  ];

  for (const text of sources) {
    if (!text) continue;
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const candidate = match[1].trim();
        // Ignore generic common words captured accidentally
        if (!/^(attached|details|request|form|submission|pdf|xlsx|new|the|for)$/i.test(candidate)) {
          return candidate;
        }
      }
    }
  }

  return undefined;
}
