import * as zod from "zod";

// POST /api/auth/email/register
export const EmailRegisterBody = zod.object({
  email: zod.string().email(),
  password: zod.string().min(8).max(128),
});
export const EmailRegisterResponse = zod.object({
  ok: zod.boolean(),
  message: zod.string(),
});

// POST /api/auth/email/verify
export const EmailVerifyBody = zod.object({
  token: zod.string().min(1),
});
export const EmailVerifyResponse = zod.object({
  ok: zod.boolean(),
  message: zod.string(),
});

// POST /api/auth/email/login
export const EmailLoginBody = zod.object({
  email: zod.string().email(),
  password: zod.string().min(1),
  rememberMe: zod.boolean().optional().default(false),
});
export const EmailLoginResponse = zod.object({
  ok: zod.boolean(),
  email: zod.string(),
});

// POST /api/auth/email/forgot-password
export const EmailForgotPasswordBody = zod.object({
  email: zod.string().email(),
});
export const EmailForgotPasswordResponse = zod.object({
  ok: zod.boolean(),
  message: zod.string(),
});

// POST /api/auth/email/reset-password
export const EmailResetPasswordBody = zod.object({
  token: zod.string().min(1),
  password: zod.string().min(8).max(128),
});
export const EmailResetPasswordResponse = zod.object({
  ok: zod.boolean(),
  message: zod.string(),
});

// POST /api/auth/email/mobile-forgot-password
export const MobileForgotPasswordBody = zod.object({
  email: zod.string().email(),
});

// POST /api/auth/email/mobile-reset-password
export const MobileResetPasswordBody = zod.object({
  email: zod.string().email(),
  code: zod.string().length(6),
  password: zod.string().min(8).max(128),
});
export const MobileResetPasswordResponse = zod.object({
  ok: zod.boolean(),
  adminToken: zod.string(),
});

// POST /api/auth/email/change-password
export const EmailChangePasswordBody = zod.object({
  currentPassword: zod.string().min(1),
  newPassword: zod.string().min(8).max(128),
});
export const EmailChangePasswordResponse = zod.object({
  ok: zod.boolean(),
  message: zod.string(),
  /** Fresh bearer token for mobile clients to replace the now-revoked old token. */
  newAdminToken: zod.string().optional(),
});
