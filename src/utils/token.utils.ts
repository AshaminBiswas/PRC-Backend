import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AccessTokenPayload {
  userId: string;
  email: string;
  roleSlug: string;
}

export interface DecodedAccessToken extends AccessTokenPayload {
  iat: number;
  exp: number;
}

// ─── Access Token ─────────────────────────────────────────────────────────────

export const generateAccessToken = (payload: AccessTokenPayload): string => {
  return jwt.sign(payload, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpiresIn as jwt.SignOptions['expiresIn'],
  });
};

export const verifyAccessToken = (token: string): DecodedAccessToken => {
  return jwt.verify(token, env.jwt.accessSecret) as DecodedAccessToken;
};

// ─── Refresh Token ────────────────────────────────────────────────────────────

export const generateRefreshToken = (): string => {
  return crypto.randomBytes(64).toString('hex');
};

// ─── One-Time Tokens (email verify, password reset) ──────────────────────────

export const generateSecureToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

export const getRefreshTokenExpiry = (): Date => {
  return new Date(Date.now() + env.jwt.refreshExpiresInMs);
};

export const getEmailVerificationExpiry = (): Date => {
  return new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
};

export const getPasswordResetExpiry = (): Date => {
  return new Date(Date.now() + 60 * 60 * 1000); // 1 hour
};
