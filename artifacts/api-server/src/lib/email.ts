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

export async function sendContentReportEmail(report: {
  id: number;
  gameId: number | null;
  questionId: number | null;
  reporterUserId: number | null;
  reason: string;
  note: string | null;
  createdAt: Date;
}): Promise<void> {
  const to = process.env["REPORT_RECIPIENT_EMAIL"];
  if (!to) {
    // Best-effort: log and return without throwing so a missing env var
    // does not fail the player's submission — the report is already saved.
    console.warn(
      "[email] REPORT_RECIPIENT_EMAIL is not set — content report notification skipped"
    );
    return;
  }

  // RESEND_API_KEY / EMAIL_FROM are validated inside getEmailClient/getFromAddress.
  // If they are missing the error is caught by the caller (.catch on the fire-and-forget call).
  const resend = getEmailClient();
  const from = getFromAddress();

  const reasonLabel: Record<string, string> = {
    hateful:    "Hateful or offensive content",
    sexual:     "Sexual content",
    harassment: "Harassment",
    spam:       "Spam or misleading",
    other:      "Other",
  };

  const { error } = await resend.emails.send({
    from,
    to,
    subject: `[Queen Trivia] Content report #${report.id} — ${reasonLabel[report.reason] ?? report.reason}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
        <h2 style="color:#ff2d8e">Queen Trivia — Content Report #${report.id}</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:6px 0;color:#666;width:140px">Reason</td><td style="padding:6px 0;font-weight:bold">${reasonLabel[report.reason] ?? report.reason}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Game ID</td><td style="padding:6px 0">${report.gameId ?? "—"}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Question ID</td><td style="padding:6px 0">${report.questionId ?? "—"}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Reporter user ID</td><td style="padding:6px 0">${report.reporterUserId ?? "—"}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Submitted at</td><td style="padding:6px 0">${report.createdAt.toISOString()}</td></tr>
          ${report.note ? `<tr><td style="padding:6px 0;color:#666;vertical-align:top">Note</td><td style="padding:6px 0">${report.note.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td></tr>` : ""}
        </table>
        <p style="color:#999;font-size:12px;margin-top:20px">
          Retrieve all reports: <code>GET /api/owner/reports</code> with your ADMIN_ACCESS_KEY.
        </p>
      </div>
    `,
  });

  if (error) {
    // Log but don't throw — the report is saved; the email is best-effort.
    console.error(
      `[email] Failed to send content report notification: ${error.name}`
    );
  }
}

export async function sendPasswordResetCodeEmail(
  to: string,
  code: string
): Promise<void> {
  const resend = getEmailClient();
  const from = getFromAddress();

  const { error } = await resend.emails.send({
    from,
    to,
    subject: "Your Queen Trivia password reset code",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#ff2d8e">Queen Trivia — Reset your password</h2>
        <p>Use the code below to set a new password in the app. This code expires in <strong>15 minutes</strong>.</p>
        <div style="margin:24px 0;text-align:center">
          <span style="display:inline-block;background:#f3f4f6;border-radius:12px;padding:16px 32px;font-size:36px;font-weight:bold;letter-spacing:8px;color:#111">${code}</span>
        </div>
        <p style="color:#666;font-size:13px">If you didn't request a password reset, you can safely ignore this email.</p>
      </div>
    `,
  });

  if (error) {
    throw new Error(
      `[email] Failed to send password reset code email: ${error.name}`
    );
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
