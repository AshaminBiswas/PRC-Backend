import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';
import { sendSuccess, sendMessage } from '../../utils/response';

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await authService.register(req.body);
    sendSuccess(res, data, 'Registration successful. Please verify your email.', 201);
  } catch (error) { next(error); }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await authService.login(req.body);
    sendSuccess(res, data);
  } catch (error) { next(error); }
};

export const adminLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await authService.adminLogin(req.body);
    sendSuccess(res, data);
  } catch (error) { next(error); }
};

export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await authService.getMe(req.user!.id);
    sendSuccess(res, data);
  } catch (error) { next(error); }
};

export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.logout(req.body?.refreshToken);
    sendMessage(res, 'Logged out successfully');
  } catch (error) { next(error); }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await authService.refreshTokens(req.body.refreshToken);
    sendSuccess(res, data);
  } catch (error) { next(error); }
};

export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.forgotPassword(req.body.email);
    sendMessage(res, 'Password reset instructions sent to your email');
  } catch (error) { next(error); }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.resetPassword(req.body);
    sendMessage(res, 'Password reset successful');
  } catch (error) { next(error); }
};

export const changePassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.changePassword(req.user!.id, req.body);
    sendMessage(res, 'Password changed successfully');
  } catch (error) { next(error); }
};

export const verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.verifyEmail(req.body.token);
    sendMessage(res, 'Email verified successfully');
  } catch (error) { next(error); }
};

export const resendVerification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.resendVerification(req.body.email);
    sendMessage(res, 'Verification email sent');
  } catch (error) { next(error); }
};
