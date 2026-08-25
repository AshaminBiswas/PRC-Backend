import dns from 'dns';

// ─── Indian GST State Codes ───────────────────────────────────────────────────
export const GST_STATE_CODES: Record<string, string> = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '25': 'Daman & Diu',
  '26': 'Dadra & Nagar Haveli',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh (Old)',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
  '97': 'Other Territory',
  '99': 'Centre Jurisdiction',
};

// ─── PAN Entity Types (4th character of PAN) ──────────────────────────────────
export const PAN_ENTITY_TYPES: Record<string, string> = {
  C: 'Company',
  P: 'Individual / Proprietor',
  H: 'HUF (Hindu Undivided Family)',
  F: 'Partnership Firm / LLP',
  A: 'Association of Persons (AOP)',
  T: 'Trust',
  B: 'Body of Individuals (BOI)',
  L: 'Local Authority',
  J: 'Artificial Juridical Person',
  G: 'Government Entity',
};

// ─── Official GSTN Luhn Mod 36 Checksum Validation ───────────────────────────
const GST_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export interface GstValidationResult {
  isValid: boolean;
  error?: string;
  stateCode?: string;
  stateName?: string;
  pan?: string;
  entityType?: string;
}

export const validateGstin = (gstinRaw: string): GstValidationResult => {
  if (!gstinRaw || typeof gstinRaw !== 'string') {
    return { isValid: false, error: 'GSTIN is required' };
  }

  const gstin = gstinRaw.trim().toUpperCase();

  if (gstin.length !== 15) {
    return {
      isValid: false,
      error: `GSTIN must be exactly 15 characters long (currently ${gstin.length})`,
    };
  }

  // Regex structure: 2 digits + 5 letters + 4 digits + 1 letter + 1 char + 1 'Z' + 1 checksum char
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!gstinRegex.test(gstin)) {
    return {
      isValid: false,
      error: 'Invalid GSTIN format. Expected format: 22AAAAA0000A1Z5',
    };
  }

  // State Code Validation
  const stateCode = gstin.substring(0, 2);
  const stateName = GST_STATE_CODES[stateCode];
  if (!stateName) {
    return {
      isValid: false,
      error: `Invalid State Code '${stateCode}'. Please check the first 2 digits of the GSTIN.`,
    };
  }

  // PAN and Entity Type
  const pan = gstin.substring(2, 12);
  const entityChar = pan.charAt(3);
  const entityType = PAN_ENTITY_TYPES[entityChar] || 'Business Entity';

  // Official Luhn Mod 36 Checksum Algorithm
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const char = gstin[i];
    const codePoint = GST_CHARS.indexOf(char);
    if (codePoint === -1) {
      return { isValid: false, error: `Invalid character '${char}' in GSTIN` };
    }

    const factor = i % 2 === 0 ? 1 : 2;
    const product = codePoint * factor;
    const quotient = Math.floor(product / 36);
    const remainder = product % 36;
    sum += quotient + remainder;
  }

  const remainderMod = sum % 36;
  const checkCodePoint = (36 - remainderMod) % 36;
  const expectedCheckChar = GST_CHARS[checkCodePoint];
  const actualCheckChar = gstin[14];

  if (expectedCheckChar !== actualCheckChar) {
    return {
      isValid: false,
      error: `Invalid GSTIN checksum digit. Expected '${expectedCheckChar}', found '${actualCheckChar}'. Please re-check the number.`,
    };
  }

  return {
    isValid: true,
    stateCode,
    stateName,
    pan,
    entityType,
  };
};

// ─── Indian Phone Number Validation ───────────────────────────────────────────
export interface PhoneValidationResult {
  isValid: boolean;
  error?: string;
  normalized?: string;
}

const DUMMY_PHONE_NUMBERS = new Set([
  '0000000000',
  '1111111111',
  '2222222222',
  '3333333333',
  '4444444444',
  '5555555555',
  '6666666666',
  '7777777777',
  '8888888888',
  '9999999999',
  '1234567890',
  '9876543210',
  '0123456789',
]);

export const validatePhoneNumber = (phoneRaw: string): PhoneValidationResult => {
  if (!phoneRaw || typeof phoneRaw !== 'string') {
    return { isValid: false, error: 'Phone number is required' };
  }

  // Strip spaces, dashes, parentheses, plus
  let cleaned = phoneRaw.replace(/[\s\-\(\)\+]/g, '');

  // Strip international Indian prefixes (+91, 91, or leading 0)
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = cleaned.substring(1);
  }

  // Indian mobile numbers must be exactly 10 digits starting with 6, 7, 8, or 9
  if (!/^[6-9]\d{9}$/.test(cleaned)) {
    return {
      isValid: false,
      error: 'Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.',
    };
  }

  if (DUMMY_PHONE_NUMBERS.has(cleaned)) {
    return {
      isValid: false,
      error: 'Please enter a genuine, active personal or business contact number.',
    };
  }

  return {
    isValid: true,
    normalized: cleaned,
  };
};

// ─── Disposable / Temporary Email Domains Blocklist ───────────────────────────
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'tempmail.com',
  'temp-mail.org',
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.biz',
  'guerrillamail.org',
  '10minutemail.com',
  '10minutemail.net',
  'yopmail.com',
  'yopmail.fr',
  'trashmail.com',
  'trashmail.net',
  'sharklasers.com',
  'dispostable.com',
  'getairmail.com',
  'throwawaymail.com',
  'nada.ltd',
  'getnada.com',
  'mohmal.com',
  'crazymailing.com',
  'maildrop.cc',
  'inboxkitten.com',
  'burnermail.io',
  'tempail.com',
  'mytemp.email',
  'fakemailgenerator.com',
  'generator.email',
  'emailondeck.com',
  'zillamail.com',
  'tmail.ws',
  'disposablemail.com',
  'dropmail.me',
  'minuteinbox.com',
]);

export interface EmailValidationResult {
  isValid: boolean;
  error?: string;
  domain?: string;
}

export const validateEmailDeliverability = async (emailRaw: string): Promise<EmailValidationResult> => {
  if (!emailRaw || typeof emailRaw !== 'string') {
    return { isValid: false, error: 'Email address is required' };
  }

  const email = emailRaw.trim().toLowerCase();

  // Basic RFC 5322 structure
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) {
    return { isValid: false, error: 'Please enter a valid email address format (e.g. user@domain.com).' };
  }

  const parts = email.split('@');
  const domain = parts[1];

  if (!domain || domain.length < 4) {
    return { isValid: false, error: 'Invalid email domain.' };
  }

  // Check Disposable Email Blocklist
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return {
      isValid: false,
      error: 'Temporary or disposable email addresses are not allowed. Please use a permanent email address.',
    };
  }

  // DNS MX Record Verification (free, native in Node.js)
  try {
    const mxRecords = await dns.promises.resolveMx(domain);
    if (!mxRecords || mxRecords.length === 0) {
      return {
        isValid: false,
        error: `The email domain '@${domain}' does not have valid mail server (MX) records.`,
      };
    }
  } catch (err: any) {
    if (err?.code === 'ENOTFOUND' || err?.code === 'ENODATA' || err?.code === 'SERVFAIL') {
      return {
        isValid: false,
        error: `The domain '@${domain}' cannot receive emails. Please check the spelling.`,
      };
    }
  }

  return {
    isValid: true,
    domain,
  };
};
