import { Resend } from "resend";

function getEmailClient(): Resend {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) {
    throw new Error(
      "[email] RESEND_API_KEY is not set — configure it in environment secrets"
    );
  }
  return new Resend(apiKey);
}

function getFromAddress(): string {
  const from = process.env["EMAIL_FROM"];
  if (!from) {
    throw new Error(
      "[email] EMAIL_FROM is not set — configure it in environment secrets"
    );
  }
  return from;
}

export async function sendVerificationEmail(
  to: string,
  verificationUrl: string
): Promise<void> {
  const resend = getEmailClient();
  const from = getFromAddress();

  const { error } = await resend.emails.send({
    from,
    to,
    subject: "Verify your Queen Trivia account",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#ff2d8e">Queen Trivia — Verify your email</h2>
        <p>Click the link below to verify your email address. This link expires in <strong>24 hours</strong>.</p>
        <p>
          <a href="${verificationUrl}"
             style="display:inline-block;background:#ff2d8e;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">
            Verify email
          </a>
        </p>
        <p style="color:#666;font-size:13px">If you didn't create a Queen Trivia account, you can safely ignore this email.</p>
      </div>
    `,
  });

  if (error) {
    // Log the error type/code but never the token or recipient in plain text
    throw new Error(`[email] Failed to send verification email: ${error.name}`);
  }
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string
): Promise<void> {
  const resend = getEmailClient();
  const from = getFromAddress();

  const { error } = await resend.emails.send({
    from,
    to,
    subject: "Reset your Queen Trivia password",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#ff2d8e">Queen Trivia — Reset your password</h2>
        <p>Click the link below to set a new password. This link expires in <strong>1 hour</strong>.</p>
        <p>
          <a href="${resetUrl}"
             style="display:inline-block;background:#ff2d8e;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">
            Reset password
          </a>
        </p>
        <p style="color:#666;font-size:13px">If you didn't request a password reset, you can safely ignore this email.</p>
      </div>
    `,
  });

  if (error) {
    throw new Error(
      `[email] Failed to send password reset email: ${error.name}`
    );
  }
}
