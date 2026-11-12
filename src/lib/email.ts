import nodemailer, { type Transporter } from 'nodemailer';

let cachedTransporter: Transporter | null = null;
let cachedConfigKey = '';

export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST?.trim() && process.env.SMTP_FROM?.trim());
}

function getTransporter(): Transporter | null {
  if (!isEmailConfigured()) return null;

  const host = process.env.SMTP_HOST!.trim();
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER?.trim() ?? '';
  const pass = process.env.SMTP_PASS ?? '';
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const configKey = [host, port, user, pass, secure].join('|');

  if (!cachedTransporter || cachedConfigKey !== configKey) {
    cachedTransporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user ? { user, pass } : undefined,
    });
    cachedConfigKey = configKey;
  }

  return cachedTransporter;
}

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Best-effort delivery: callers must handle `false` instead of assuming delivery. */
export async function sendEmail(message: OutgoingEmail): Promise<boolean> {
  const transporter = getTransporter();
  const from = process.env.SMTP_FROM?.trim();
  if (!transporter || !from) {
    console.warn(`[email] SMTP is not configured; skipped "${message.subject}" to ${message.to}`);
    return false;
  }

  try {
    await transporter.sendMail({ from, ...message });
    return true;
  } catch (error) {
    console.error(`[email] Failed to send "${message.subject}" to ${message.to}:`, error);
    return false;
  }
}
