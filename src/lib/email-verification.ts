import { db } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import {
  VERIFICATION_TOKEN_TTL_MS,
  buildVerificationUrl,
  createVerificationTokenValue,
  hashVerificationToken,
  isVerificationTokenExpired,
} from '@/lib/verification-token';

export type VerificationPurpose = 'signup' | 'purchase_claim';

export interface VerificationRecipient {
  id: string;
  name: string;
  email: string;
}

export type VerificationStatus = 'verified' | 'invalid' | 'expired' | 'already_used';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildMessage(recipient: VerificationRecipient, url: string, purpose: VerificationPurpose) {
  const isPurchase = purpose === 'purchase_claim';
  const subject = isPurchase
    ? 'Confirmez votre email pour recevoir vos crédits WordFusion'
    : 'Confirmez votre adresse email WordFusion';
  const intro = isPurchase
    ? `Une commande a bien été enregistrée pour ${recipient.email}, mais votre adresse doit être confirmée avant de créditer votre compte.`
    : 'Confirmez votre adresse email pour sécuriser votre compte WordFusion et vos achats.';
  const name = escapeHtml(recipient.name);

  const text = [
    `Bonjour ${recipient.name},`,
    '',
    intro,
    '',
    url,
    '',
    'Connectez-vous au compte WordFusion lié à cette adresse, puis ouvrez ce lien pour confirmer votre email.',
    'Ce lien expire dans 24 heures.',
    "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.",
  ].join('\n');

  const html = `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px">
      <p style="margin:0 0 20px;font-size:13px;font-weight:bold;letter-spacing:.14em;color:#123b66">WORDFUSION</p>
      <p style="margin:0 0 12px">Bonjour ${name},</p>
      <p style="margin:0 0 20px">${escapeHtml(intro)}</p>
      <p style="margin:0 0 20px">
        <a href="${escapeHtml(url)}" style="display:inline-block;background:#123b66;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none">Confirmer mon adresse</a>
      </p>
      <p style="margin:0 0 8px;font-size:12px;color:#64748b">Connectez-vous au compte WordFusion lié à cette adresse, puis ouvrez ce lien.</p>
      <p style="margin:0 0 8px;font-size:12px;color:#64748b">Ce lien expire dans 24 heures.</p>
      <p style="margin:0 0 8px;font-size:12px;color:#64748b">Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
      <p style="margin:16px 0 0;font-size:11px;color:#94a3b8;word-break:break-all">${escapeHtml(url)}</p>
    </div>
  </body>
</html>`;

  return { subject, text, html };
}

/**
 * Issues a fresh verification link (invalidating previous ones for the same
 * purpose) and tries to deliver it. Never returns the token to API callers.
 */
export async function issueEmailVerification(
  recipient: VerificationRecipient,
  purpose: VerificationPurpose,
): Promise<{ sent: boolean }> {
  await db.emailVerificationToken.deleteMany({
    where: { userId: recipient.id, purpose },
  });

  const rawToken = createVerificationTokenValue();
  await db.emailVerificationToken.create({
    data: {
      userId: recipient.id,
      tokenHash: hashVerificationToken(rawToken),
      purpose,
      expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
    },
  });

  const url = buildVerificationUrl(rawToken);
  const sent = await sendEmail({ to: recipient.email, ...buildMessage(recipient, url, purpose) });
  if (!sent && process.env.NODE_ENV !== 'production') {
    console.info(`[email] Verification link for ${recipient.email}: ${url}`);
  }

  return { sent };
}

export async function inspectVerificationToken(
  rawToken: string,
): Promise<{ status: VerificationStatus | 'pending'; userId?: string }> {
  if (!rawToken.trim()) return { status: 'invalid' };

  const record = await db.emailVerificationToken.findUnique({
    where: { tokenHash: hashVerificationToken(rawToken) },
    select: { userId: true, usedAt: true, expiresAt: true },
  });

  if (!record) return { status: 'invalid' };
  if (record.usedAt) return { status: 'already_used' };
  if (isVerificationTokenExpired(record.expiresAt)) return { status: 'expired' };
  return { status: 'pending', userId: record.userId };
}

export async function consumeVerificationToken(
  rawToken: string,
): Promise<{ status: VerificationStatus; userId?: string }> {
  if (!rawToken.trim()) return { status: 'invalid' };

  const record = await db.emailVerificationToken.findUnique({
    where: { tokenHash: hashVerificationToken(rawToken) },
    select: { id: true, userId: true, usedAt: true, expiresAt: true },
  });

  if (!record) return { status: 'invalid' };
  if (record.usedAt) return { status: 'already_used' };
  if (isVerificationTokenExpired(record.expiresAt)) {
    await db.emailVerificationToken.deleteMany({ where: { id: record.id, usedAt: null } });
    return { status: 'expired' };
  }

  const verified = await db.$transaction(async (tx) => {
    const claimed = await tx.emailVerificationToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) return false;

    await tx.user.update({
      where: { id: record.userId },
      data: { emailVerified: new Date() },
    });
    await tx.emailVerificationToken.updateMany({
      where: { userId: record.userId, usedAt: null },
      data: { usedAt: new Date() },
    });
    return true;
  });

  return verified ? { status: 'verified', userId: record.userId } : { status: 'already_used' };
}
