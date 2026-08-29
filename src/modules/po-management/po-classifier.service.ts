import { PoClassification, PoPriority, PoClassificationResult, EmailAttachmentPayload } from './po.types';

// High-confidence PO subject keywords
const HIGH_PO_SUBJECT_REGEX = /\b(purchase\s*order|p\.?\s*o\.?\s*#?|p\.o\b|new\s*po|po\s*submission|po\s*attached|po\s*number|po\s*no|supply\s*order|work\s*order|order\s*form|material\s*order|formal\s*order|commercial\s*order)\b/i;

// Medium-confidence order keywords
const MEDIUM_PO_SUBJECT_REGEX = /\b(order\s*confirmation|order\s*booking|quotation\s*approved|quote\s*approval|hardware\s*order|order\s*request|purchase\s*request|procurement|po)\b/i;

// High-confidence PO body keywords
const HIGH_PO_BODY_TERMS = [
  'purchase order',
  'po number',
  'po no',
  'p.o. no',
  'p.o.',
  'po date',
  'po attached',
  'attached po',
  'find attached po',
  'billing address',
  'shipping address',
  'delivery schedule',
  'authorized signatory',
  'payment terms',
  'gstin',
  'hsn code',
  'grand total',
  'total amount',
  'unit price',
  'quantity',
  'item description',
  'work order',
  'supply order',
];

// Attachment filename PO patterns
const PO_ATTACHMENT_REGEX = /\b(po|purchase[_\s-]?order|order[_\s-]?form|customer[_\s-]?po|work[_\s-]?order|po[_\s-]?\d+|quotation[_\s-]?approved)\b/i;

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
    score += 0.75;
    reasons.push('Subject explicitly specifies Purchase Order / Commercial Order keywords');
  } else if (MEDIUM_PO_SUBJECT_REGEX.test(cleanSubject)) {
    score += 0.45;
    reasons.push('Subject contains commercial order terms');
  }

  // 2. Evaluate Attachment File Names & Types
  let hasPoPdfOrExcel = false;
  for (const att of attachments) {
    const isDocOrSheet =
      att.fileType.includes('pdf') ||
      att.fileType.includes('spreadsheet') ||
      att.fileType.includes('excel') ||
      /\.(pdf|xlsx|xls|docx|doc)$/i.test(att.fileName);

    if (isDocOrSheet && PO_ATTACHMENT_REGEX.test(att.fileName)) {
      score += 0.45;
      hasPoPdfOrExcel = true;
      reasons.push(`Attachment "${att.fileName}" matches standard Purchase Order document naming`);
      break;
    } else if (isDocOrSheet) {
      score += 0.2;
      hasPoPdfOrExcel = true;
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
    score += 0.4;
    reasons.push(`Email body contains ${bodyMatches} commercial purchase terms`);
  } else if (bodyMatches >= 1) {
    score += 0.25;
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
        score += 0.4;
        reasons.push(`Attachment content scan confirmed Purchase Order document`);
        break;
      }
    }
  }

  // Normalize final confidence score between 0.0 and 1.0
  const finalScore = Math.min(1.0, Math.max(0.0, Number(score.toFixed(2))));

  // Extract Customer PO Number if pattern matches
  const extractedCustomerPoNumber = extractCustomerPoNumber(cleanSubject, plainTextBody);

  // Determine classification (lowered threshold for direct detection)
  let classification: PoClassification = PoClassification.GENERAL_EMAIL;
  if (finalScore >= 0.5 || (hasPoPdfOrExcel && finalScore >= 0.4) || extractedCustomerPoNumber) {
    classification = PoClassification.PO_DETECTED;
  } else if (finalScore >= 0.2) {
    classification = PoClassification.POSSIBLE_PO;
  }

  // Determine Priority (Urgent / High / Medium)
  const URGENT_REGEX = /\b(urgent|urgently|asap|rush\s*order|immediate\s*delivery|emergency|critical|high\s*priority|fast\s*track|immediate\s*dispatch)\b/i;
  const HIGH_PRIORITY_REGEX = /\b(priority|express|priority\s*order|same\s*day|urgent\s*po)\b/i;

  let suggestedPriority: PoPriority = PoPriority.MEDIUM;
  if (URGENT_REGEX.test(cleanSubject) || URGENT_REGEX.test(cleanBody)) {
    suggestedPriority = PoPriority.URGENT;
    reasons.push('Detected urgent keywords in subject or message body');
  } else if (HIGH_PRIORITY_REGEX.test(cleanSubject) || HIGH_PRIORITY_REGEX.test(cleanBody)) {
    suggestedPriority = PoPriority.HIGH;
  }

  return {
    classification,
    confidenceScore: finalScore,
    reasons,
    extractedCustomerPoNumber,
    suggestedPriority,
  };
}

/**
 * Extract customer's own PO number from subject or body
 * Examples: ABC/PO/2026/091, PO-998812, PO# 44102, Purchase Order No: PO/IN/2910, PO: 12345
 */
export function extractCustomerPoNumber(subject: string, body: string): string | undefined {
  const sources = [subject, body];
  const patterns = [
    /(?:P\.?O\.?|Purchase\s*Order|Work\s*Order|Supply\s*Order)\s*(?:No\.?|Number|Num|#|Ref)?\s*[:\-]?\s*([A-Za-z0-9\/\-_.]{2,40})/i,
    /\b(?:PO\s*#\s*|PO#|PO\s*-\s*|PO\s*:\s*|PO\s*No\.?\s*|PO\s*Num\.?\s*)([A-Za-z0-9\/\-_.]{2,40})\b/i,
    /\b(?:Order\s*(?:No\.?|Number|#|Id))\s*[:\-]?\s*([A-Za-z0-9\/\-_.]{2,40})/i,
    /\b(?:Ref\s*(?:No\.?|#)?)\s*[:\-]?\s*([A-Za-z0-9\/\-_.]{3,40})/i,
    /\b(?:Customer\s*PO\s*(?:No\.?|#)?)\s*[:\-]?\s*([A-Za-z0-9\/\-_.]{2,40})/i,
    /\b(?:Our\s*PO\s*(?:No\.?|#)?)\s*[:\-]?\s*([A-Za-z0-9\/\-_.]{2,40})/i,
  ];

  const stopWords = /^(attached|details|request|form|submission|pdf|xlsx|docx|new|the|for|copy|file|document|order|number|no|po|purchase|please|here|our|your)$/i;

  for (const text of sources) {
    if (!text) continue;
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const candidate = match[1].trim();
        if (!stopWords.test(candidate) && candidate.length >= 2) {
          return candidate;
        }
      }
    }
  }

  return undefined;
}

/**
 * Automatically extracts Company Name, Sender Name, and Phone number from email body/signatures
 */
export function extractSenderProfileDetails(body: string = '') {
  if (!body) return {};

  let extractedCompany: string | undefined;
  let extractedName: string | undefined;
  let extractedPhone: string | undefined;

  // 1. Company extraction
  const companyPatterns = [
    /(?:Company|Organization|Firm|Enterprise|Business)\s*[:\-]?\s*([A-Za-z0-9\s.,&'-]{3,60})/i,
    /(?:M\/s\.?|M\/S)\s+([A-Za-z0-9\s.,&'-]{3,60})/i,
    /\b([A-Za-z0-9\s.,&'-]{3,45}\s+(?:Pvt\.?\s*Ltd\.?|Private\s*Limited|Ltd\.?|LLP|Inc\.?|Corp\.?|Corporation|Enterprises|Industries|Hardware|Suppliers))\b/i,
  ];

  for (const pat of companyPatterns) {
    const m = body.match(pat);
    if (m && m[1]) {
      const cand = m[1].trim().replace(/[\r\n]+/g, ' ');
      if (cand.length >= 3 && cand.length <= 60) {
        extractedCompany = cand;
        break;
      }
    }
  }

  // 2. Sender Name extraction from sign-off
  const namePatterns = [
    /(?:Thanks\s*(?:&|and)\s*Regards|Regards|Best\s*Regards|Sincerely|Warm\s*Regards)\s*[,:\-]?\s*\n+([A-Za-z\s.]{3,35})/i,
    /(?:Contact\s*Person|Name)\s*[:\-]?\s*([A-Za-z\s.]{3,35})/i,
  ];

  for (const pat of namePatterns) {
    const m = body.match(pat);
    if (m && m[1]) {
      const cand = m[1].trim();
      if (cand.length >= 3 && !/^(thanks|regards|team|sales|support|admin|pacifichardware)$/i.test(cand)) {
        extractedName = cand;
        break;
      }
    }
  }

  // 3. Phone Number extraction
  const phonePattern = /(?:Phone|Mobile|Contact|Tel|Cell|WhatsApp|Mo\.)\s*(?:No\.?|Number|#)?\s*[:\-]?\s*(\+?[0-9\s\-()]{10,18})/i;
  const phoneMatch = body.match(phonePattern);
  if (phoneMatch && phoneMatch[1]) {
    const cand = phoneMatch[1].trim();
    if (cand.replace(/[^0-9]/g, '').length >= 10) {
      extractedPhone = cand;
    }
  }

  return {
    extractedCompany,
    extractedName,
    extractedPhone,
  };
}
