import crypto from 'crypto';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';

export interface DocumentVerificationData {
  verificationToken: string;
  verificationId: string;
  documentHash: string;
  verificationUrl: string;
  qrCodeDataUrl: string;
}

/**
 * Computes SHA-256 hash for document tamper-proofing.
 */
export const calculateDocumentHash = (
  invoiceNumber: string,
  grandTotal: number,
  verificationToken: string,
  timestamp: string
): string => {
  const payload = `${invoiceNumber}:${grandTotal.toFixed(2)}:${verificationToken}:${timestamp}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
};

/**
 * Generates UUID token, Verification ID, SHA-256 document hash, and QR code Data-URI.
 */
export const generateDocumentVerification = async (
  invoiceNumber: string,
  grandTotal: number,
  createdAtIso: string = new Date().toISOString(),
  baseUrl: string = 'https://pacifichardware.com'
): Promise<DocumentVerificationData> => {
  const verificationToken = uuidv4();
  const verificationId = `VER-PRC-${Date.now().toString().slice(-8)}`;
  const documentHash = calculateDocumentHash(invoiceNumber, grandTotal, verificationToken, createdAtIso);

  const verificationUrl = `${baseUrl}/verify/${verificationToken}`;

  const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, {
    errorCorrectionLevel: 'H',
    margin: 1,
    width: 200,
    color: {
      dark: '#1e293b',
      light: '#ffffff',
    },
  });

  return {
    verificationToken,
    verificationId,
    documentHash,
    verificationUrl,
    qrCodeDataUrl,
  };
};
