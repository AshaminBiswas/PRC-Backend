import { PoClassification, PoPriority, PoClassificationResult, EmailAttachmentPayload } from './po.types';

// High-confidence PO subject keywords (broadened for Indian commercial B2B procurement)
const HIGH_PO_SUBJECT_REGEX = /\b(purchase\s*order|p\.?\s*o\.?\s*#?|p\.o\b|new\s*po|po\s*submission|po\s*attached|po\s*number|po\s*no|supply\s*order|work\s*order|order\s*form|material\s*order|formal\s*order|commercial\s*order|hardware\s*order|fittings?\s*order|order\s*for\s*(?:site|dlf|project|material|fittings|hardware)|purchase\s*indent|material\s*indent|site\s*order|boq\s*(?:&|and)?\s*order|rate\s*contract\s*order|quotation\s*approval|approved\s*quotation|pi\s*approval|proforma\s*approval|order\s*booking|order\s*placement|confirmed\s*order|release\s*of\s*po|issuance\s*of\s*po)\b/i;

// Medium-confidence order keywords
const MEDIUM_PO_SUBJECT_REGEX = /\b(order\s*confirmation|order\s*booking|quotation\s*approved|quote\s*approval|hardware\s*order|order\s*request|purchase\s*request|procurement|supply\s*required|material\s*required|material\s*requirement|fittings?\s*requirement|boq|indent|dispatch\s*request|order|supply|hardware|fittings|proforma)\b/i;

// High-confidence PO body keywords & procurement terms
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
  'please supply',
  'kindly supply',
  'dispatch material',
  'arrange dispatch',
  'deliver to site',
  'site delivery',
  'bill of quantities',
  'boq',
  'rate contract',
  'po copy',
  'advance payment',
  'proforma invoice',
  'pi approved',
  'material requirement',
  'purchase indent',
  'formal order',
  'approved quote',
  'proforma accepted',
  'kindly arrange',
  'order placement',
  'commercial terms',
  'scope of supply',
  'architectural hardware',
  'door handles',
  'mortise lock',
  'patch fittings',
  'floor spring',
  'door closer',
  'transporter',
  'e-way bill',
  'challan',
];

// Attachment filename PO patterns (expanded for real-world document names)
const PO_ATTACHMENT_REGEX = /\b(po|purchase[_\s-]?order|order[_\s-]?form|customer[_\s-]?po|work[_\s-]?order|po[_\s-]?\d+|quotation[_\s-]?approved|boq|indent|order|commercial|invoice|proforma|fitting[_\s-]?list|material[_\s-]?list)\b/i;

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
  let hasGenericDocAttachment = false;

  for (const att of attachments) {
    const isDocOrSheet =
      att.fileType.includes('pdf') ||
      att.fileType.includes('spreadsheet') ||
      att.fileType.includes('excel') ||
      /\.(pdf|xlsx|xls|docx|doc)$/i.test(att.fileName);

    if (isDocOrSheet && PO_ATTACHMENT_REGEX.test(att.fileName)) {
      score += 0.45;
      hasPoPdfOrExcel = true;
      reasons.push(`Attachment "${att.fileName}" matches Purchase Order document naming`);
      break;
    } else if (isDocOrSheet) {
      score += 0.25;
      hasGenericDocAttachment = true;
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
    score += 0.45;
    reasons.push(`Email body contains ${bodyMatches} commercial procurement terms`);
  } else if (bodyMatches >= 1) {
    score += 0.3;
    reasons.push(`Email body mentions procurement phrase "${HIGH_PO_BODY_TERMS.find((t) => cleanBody.includes(t))}"`);
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
        score += 0.45;
        hasPoPdfOrExcel = true;
        reasons.push(`Attachment content scan confirmed Purchase Order document`);
        break;
      }
    }
  }

  // Normalize final confidence score between 0.0 and 1.0
  const finalScore = Math.min(1.0, Math.max(0.0, Number(score.toFixed(2))));

  // Extract Customer PO Number if pattern matches
  const extractedCustomerPoNumber = extractCustomerPoNumber(cleanSubject, plainTextBody);

  // Determine classification:
  // Direct PO if score >= 0.4, or has document attachment with order keywords, or PO number extracted
  let classification: PoClassification = PoClassification.GENERAL_EMAIL;
  if (
    finalScore >= 0.4 ||
    (hasPoPdfOrExcel && finalScore >= 0.3) ||
    (hasGenericDocAttachment && bodyMatches >= 1) ||
    Boolean(extractedCustomerPoNumber)
  ) {
    classification = PoClassification.PO_DETECTED;
  } else if (finalScore >= 0.2 || hasGenericDocAttachment || bodyMatches >= 1) {
    classification = PoClassification.POSSIBLE_PO;
  }

  // Determine Priority (Urgent / High / Medium)
  const URGENT_REGEX = /\b(urgent|urgently|asap|rush\s*order|immediate\s*delivery|emergency|critical|high\s*priority|fast\s*track|immediate\s*dispatch|same\s*day|urgent\s*po)\b/i;
  const HIGH_PRIORITY_REGEX = /\b(priority|express|priority\s*order|prompt\s*action|quick\s*dispatch)\b/i;

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
    /(?:P\.?O\.?|Purchase\s*Order|Work\s*Order|Supply\s*Order|Commercial\s*Order|Material\s*Order)\s*(?:No\.?|Number|Num|#|Ref)?\s*[:=\-]?\s*([A-Za-z0-9\/\-_.]{2,40})/i,
    /\b(?:PO\s*#\s*|PO#|PO\s*-\s*|PO\s*:\s*|PO\s*No\.?\s*|PO\s*Num\.?\s*)([A-Za-z0-9\/\-_.]{2,40})\b/i,
    /\b(?:WO\s*#\s*|WO#|WO\s*-\s*|WO\s*:\s*|WO\s*No\.?\s*)([A-Za-z0-9\/\-_.]{2,40})\b/i,
    /\b([A-Za-z0-9\/\-_.]{2,15}\/(?:PO|WO)\/[A-Za-z0-9\/\-_.]{2,25})\b/i,
    /\b(PO-[A-Za-z0-9\/\-_]{3,30})\b/i,
    /\b(WO-[A-Za-z0-9\/\-_]{3,30})\b/i,
    /\b(?:Order\s*(?:No\.?|Number|#|Id))\s*[:=\-]?\s*([A-Za-z0-9\/\-_.]{2,40})/i,
    /\b(?:Indent\s*(?:No\.?|Number|#))\s*[:=\-]?\s*([A-Za-z0-9\/\-_.]{2,40})/i,
    /\b(?:Ref\s*(?:No\.?|#)?)\s*[:=\-]?\s*([A-Za-z0-9\/\-_.]{3,40})/i,
    /\b(?:Customer\s*PO\s*(?:No\.?|#)?)\s*[:=\-]?\s*([A-Za-z0-9\/\-_.]{2,40})/i,
    /\b(?:Our\s*PO\s*(?:No\.?|#)?)\s*[:=\-]?\s*([A-Za-z0-9\/\-_.]{2,40})/i,
  ];

  const stopWords = /^(attached|details|request|form|submission|pdf|xlsx|docx|new|the|for|copy|file|document|order|number|no|po|purchase|please|here|our|your|approved|confirmation)$/i;

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
    /\b([A-Za-z0-9\s.,&'-]{3,45}\s+(?:Constructions?|Infra(?:structure)?|Interiors?|Builders?|Developers?|Architects?|Designers?|Engineers?|Traders?|Trading|Projects?|Glass))\b/i,
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
