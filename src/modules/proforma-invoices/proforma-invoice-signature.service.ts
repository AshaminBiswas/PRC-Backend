import crypto from 'crypto';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../../config/env';

const getSignatureSecret = (): string => {
  return (
    process.env.PROFORMA_SIGNING_SECRET ||
    process.env.QUOTATION_SIGNING_SECRET ||
    env.jwt.accessSecret ||
    env.jwt.refreshSecret ||
    crypto.createHash('sha256').update(String(process.env.DATABASE_URL || 'prc-backend-signature')).digest('hex')
  );
};

export interface ProformaSignaturePayload {
  piNumber: string;
  financialYear: string;
  customerName: string;
  companyName?: string | null;
  gstin?: string | null;
  grandTotal: number;
  advanceAmount: number;
  signedBy: string;
  signedAt: Date | string;
}

export interface ProformaVerificationResult {
  isValid: boolean;
  tamperDetected: boolean;
  piNumber: string;
  financialYear: string;
  customerName: string;
  companyName: string;
  gstin: string;
  grandTotal: number;
  advanceAmount: number;
  balanceDue: number;
  advancePercentage: number;
  signedBy: string;
  signedAt: string;
  digitalSignature: string;
  verificationId: string;
  documentHash: string;
  verificationToken: string;
  status: string;
  issuedAt: string;
  validUntil: string;
  itemsCount: number;
  message: string;
}

/**
 * Computes canonical SHA-256 document fingerprint to prevent tampering.
 */
export const calculateProformaDocumentHash = (
  piNumber: string,
  grandTotal: number,
  advanceAmount: number,
  verificationToken: string,
  createdAtIso: string
): string => {
  const payload = [
    `PI:${piNumber.trim().toUpperCase()}`,
    `TOTAL:${Number(grandTotal).toFixed(2)}`,
    `ADV:${Number(advanceAmount).toFixed(2)}`,
    `TOKEN:${verificationToken}`,
    `TIME:${createdAtIso}`,
  ].join('|');

  return crypto.createHash('sha256').update(payload).digest('hex');
};

/**
 * Computes HMAC-SHA256 cryptographic digital signature.
 */
export const computeProformaSignature = (payload: ProformaSignaturePayload): string => {
  const canonicalString = [
    `PI:${payload.piNumber.trim().toUpperCase()}`,
    `FY:${payload.financialYear}`,
    `CUSTOMER:${(payload.customerName || '').trim()}`,
    `COMPANY:${(payload.companyName || '').trim()}`,
    `GSTIN:${(payload.gstin || '').trim().toUpperCase()}`,
    `TOTAL:${Number(payload.grandTotal).toFixed(2)}`,
    `ADV:${Number(payload.advanceAmount).toFixed(2)}`,
    `SIGNER:${payload.signedBy.trim()}`,
    `TIME:${new Date(payload.signedAt).toISOString()}`,
  ].join('|');

  return crypto
    .createHmac('sha256', getSignatureSecret())
    .update(canonicalString)
    .digest('hex');
};

/**
 * Generates a high-resolution base64 PNG QR code data URI.
 * Error correction level 'H' (30% redundancy) ensures optimal camera readability even when printed or on screen.
 * Width 400px gives sharp output at A4 print DPI with the 70pt display size.
 */
export const generateProformaQrCode = async (verificationUrl: string): Promise<string> => {
  try {
    const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 400,
      color: {
        dark: '#000000',   // Pure black for maximum print contrast
        light: '#ffffff',
      },
    });
    return qrDataUrl;
  } catch (err: any) {
    console.error('[Proforma QR Generation Error]:', err?.message || err);
    return '';
  }
};


/**
 * Generates verification bundle (token, ID, hash, QR code) on PI creation.
 */
export const generateProformaVerificationBundle = async (
  piNumber: string,
  grandTotal: number,
  advanceAmount: number,
  createdAtIso: string = new Date().toISOString(),
  baseUrl?: string
): Promise<{
  verificationToken: string;
  verificationId: string;
  documentHash: string;
  verificationUrl: string;
  qrCodeDataUrl: string;
}> => {
  const verificationToken = uuidv4();
  const verificationId = `VER-PI-${Date.now().toString().slice(-8)}`;
  const documentHash = calculateProformaDocumentHash(
    piNumber,
    grandTotal,
    advanceAmount,
    verificationToken,
    createdAtIso
  );

  const domain = (baseUrl || env.frontend.url || 'https://pacifichardware.com').replace(/\/$/, '');
  const verificationUrl = `${domain}/verify/pi/${verificationToken}`;
  const qrCodeDataUrl = await generateProformaQrCode(verificationUrl);

  return {
    verificationToken,
    verificationId,
    documentHash,
    verificationUrl,
    qrCodeDataUrl,
  };
};

/**
 * Verifies the digital signature and authenticity of a Proforma Invoice record.
 */
export const verifyProformaSignatureRecord = (pi: {
  piNumber: string;
  financialYear: string;
  customerName: string;
  companyName?: string | null;
  gstin?: string | null;
  grandTotal: any;
  advanceAmount: any;
  balanceDue: any;
  advancePercentage: any;
  status: string;
  verificationToken: string;
  verificationId: string;
  documentHash: string;
  digitalSignature?: string | null;
  signedBy?: string | null;
  signedAt?: Date | null;
  createdAt: Date;
  validUntil?: Date | null;
  items?: any[];
}): ProformaVerificationResult => {
  if (!pi.digitalSignature || !pi.signedBy || !pi.signedAt) {
    return {
      isValid: false,
      tamperDetected: false,
      piNumber: pi.piNumber,
      financialYear: pi.financialYear,
      customerName: pi.customerName,
      companyName: pi.companyName || 'N/A',
      gstin: pi.gstin || 'N/A',
      grandTotal: Number(pi.grandTotal || 0),
      advanceAmount: Number(pi.advanceAmount || 0),
      balanceDue: Number(pi.balanceDue || 0),
      advancePercentage: Number(pi.advancePercentage || 30),
      signedBy: 'Unsigned',
      signedAt: 'N/A',
      digitalSignature: '',
      verificationId: pi.verificationId,
      documentHash: pi.documentHash,
      verificationToken: pi.verificationToken,
      status: pi.status,
      issuedAt: pi.createdAt.toISOString(),
      validUntil: pi.validUntil ? pi.validUntil.toISOString() : 'N/A',
      itemsCount: pi.items?.length || 0,
      message: 'Proforma Invoice is currently unsigned or awaiting administrative verification seal.',
    };
  }

  const payload: ProformaSignaturePayload = {
    piNumber: pi.piNumber,
    financialYear: pi.financialYear,
    customerName: pi.customerName,
    companyName: pi.companyName,
    gstin: pi.gstin,
    grandTotal: Number(pi.grandTotal || 0),
    advanceAmount: Number(pi.advanceAmount || 0),
    signedBy: pi.signedBy,
    signedAt: pi.signedAt,
  };

  const expectedSignature = computeProformaSignature(payload);
  let isSignatureValid = false;
  try {
    isSignatureValid = crypto.timingSafeEqual(
      Buffer.from(pi.digitalSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch {
    isSignatureValid = false;
  }

  return {
    isValid: isSignatureValid,
    tamperDetected: !isSignatureValid,
    piNumber: pi.piNumber,
    financialYear: pi.financialYear,
    customerName: pi.customerName,
    companyName: pi.companyName || 'N/A',
    gstin: pi.gstin || 'N/A',
    grandTotal: Number(pi.grandTotal || 0),
    advanceAmount: Number(pi.advanceAmount || 0),
    balanceDue: Number(pi.balanceDue || 0),
    advancePercentage: Number(pi.advancePercentage || 30),
    signedBy: pi.signedBy,
    signedAt: pi.signedAt.toISOString(),
    digitalSignature: pi.digitalSignature,
    verificationId: pi.verificationId,
    documentHash: pi.documentHash,
    verificationToken: pi.verificationToken,
    status: pi.status,
    issuedAt: pi.createdAt.toISOString(),
    validUntil: pi.validUntil ? pi.validUntil.toISOString() : 'N/A',
    itemsCount: pi.items?.length || 0,
    message: isSignatureValid
      ? 'Authentic & Valid. Cryptographically verified by PRC Hardware Authority.'
      : 'Tamper Detected! Digital signature does not match stored Proforma Invoice ledger.',
  };
};
