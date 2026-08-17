import crypto from 'crypto';
import QRCode from 'qrcode';
import { env } from '../../config/env';

const SIGNATURE_SECRET = process.env.QUOTATION_SIGNING_SECRET || env.jwt.accessSecret || 'prc-hardware-digital-signature-secret-key-2026';

export interface DigitalSignaturePayload {
  referenceNo: string;
  financialYear: string;
  projectName: string;
  companyName: string;
  gstNo: string;
  grandTotal: number;
  signedBy: string;
  signedAt: Date;
}

export interface VerificationResult {
  isValid: boolean;
  tamperDetected: boolean;
  referenceNo: string;
  companyName: string;
  gstNo: string;
  projectName: string;
  grandTotal: number;
  signedBy: string;
  signedAt: string;
  digitalSignature: string;
  message: string;
}

/**
 * Computes a cryptographic HMAC-SHA256 digital signature string for a quotation.
 */
export const computeQuotationSignature = (payload: DigitalSignaturePayload): string => {
  const canonicalString = [
    `REF:${payload.referenceNo}`,
    `FY:${payload.financialYear}`,
    `PROJECT:${payload.projectName.trim()}`,
    `COMPANY:${payload.companyName.trim()}`,
    `GSTIN:${payload.gstNo.trim().toUpperCase()}`,
    `TOTAL:${Number(payload.grandTotal).toFixed(2)}`,
    `SIGNER:${payload.signedBy.trim()}`,
    `TIME:${payload.signedAt.toISOString()}`,
  ].join('|');

  return crypto
    .createHmac('sha256', SIGNATURE_SECRET)
    .update(canonicalString)
    .digest('hex');
};

/**
 * Generates a high-resolution base64 PNG QR code data URI.
 */
export const generateQuotationQrCode = async (verificationUrl: string): Promise<string> => {
  try {
    const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 280,
      color: {
        dark: '#1e293b',
        light: '#ffffff',
      },
    });
    return qrDataUrl;
  } catch (err: any) {
    console.error('[Quotation QR Generation Error]:', err?.message || err);
    return '';
  }
};

/**
 * Verifies the digital signature and authenticity of a quotation against stored record.
 */
export const verifyQuotationSignature = (
  quote: {
    referenceNo: string | null;
    financialYear: string | null;
    projectName: string | null;
    companyName: string | null;
    gstNo: string | null;
    grandTotal: any;
    signedBy: string | null;
    signedAt: Date | null;
    digitalSignature: string | null;
  }
): VerificationResult => {
  if (!quote.digitalSignature || !quote.signedBy || !quote.signedAt) {
    return {
      isValid: false,
      tamperDetected: false,
      referenceNo: quote.referenceNo || 'N/A',
      companyName: quote.companyName || 'N/A',
      gstNo: quote.gstNo || 'N/A',
      projectName: quote.projectName || 'N/A',
      grandTotal: Number(quote.grandTotal || 0),
      signedBy: quote.signedBy || 'Unsigned',
      signedAt: quote.signedAt ? quote.signedAt.toISOString() : 'N/A',
      digitalSignature: quote.digitalSignature || '',
      message: 'Quotation has not been digitally signed yet by PRC Hardware authority.',
    };
  }

  const payload: DigitalSignaturePayload = {
    referenceNo: quote.referenceNo || '',
    financialYear: quote.financialYear || '',
    projectName: quote.projectName || '',
    companyName: quote.companyName || '',
    gstNo: quote.gstNo || '',
    grandTotal: Number(quote.grandTotal || 0),
    signedBy: quote.signedBy,
    signedAt: quote.signedAt,
  };

  const expectedSignature = computeQuotationSignature(payload);
  const isValid = crypto.timingSafeEqual(
    Buffer.from(quote.digitalSignature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );

  return {
    isValid,
    tamperDetected: !isValid,
    referenceNo: quote.referenceNo || '',
    companyName: quote.companyName || '',
    gstNo: quote.gstNo || '',
    projectName: quote.projectName || '',
    grandTotal: Number(quote.grandTotal || 0),
    signedBy: quote.signedBy,
    signedAt: quote.signedAt.toISOString(),
    digitalSignature: quote.digitalSignature,
    message: isValid
      ? 'Authentic & Valid. Cryptographically verified by PRC Hardware Authority.'
      : 'Tamper Detected! Digital signature does not match quotation record.',
  };
};
