import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface BrevoEmailPayload {
  sender: { name: string; email: string };
  to: { email: string }[];
  replyTo?: { email: string };
  subject: string;
  htmlContent: string;
  textContent?: string;
}

interface EmailLayout {
  /** Inbox preview line shown after the subject in most clients. */
  preheader: string;
  /** Plain text; escaped here. */
  heading: string;
  /** Already-escaped HTML — build it with escapeHtml() around user values. */
  introHtml: string;
  /** Large code shown under the intro (OTP emails). */
  code?: string;
  /** Primary button with a copy-paste fallback link (invite emails). */
  action?: { label: string; url: string };
  /** Small print under the divider. Plain text; escaped here. */
  notes: string[];
}

/**
 * Escape a value for interpolation into HTML. Names, business names and emails
 * are user-supplied, so without this a business named `<a href=…>` would render
 * as live markup inside a Dexxify-branded email.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Colours are the product's neutral ramp (dexxify-frontend globals.css), so
 * email matches the app. Hex literals because email clients don't support CSS
 * variables.
 */
const C = {
  page: '#E9ECEF', // n-100
  card: '#FFFFFF', // n-0
  border: '#DEE2E6', // n-200
  heading: '#212529', // n-900
  body: '#343A40', // n-700
  muted: '#6C757D', // n-500
  pageDark: '#212529', // n-900
  borderDark: '#343A40', // n-700
  textDark: '#F8F9FA', // n-50
  mutedDark: '#ADB5BD', // n-400
};

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly brevoApiUrl = 'https://api.brevo.com/v3/smtp/email';
  private readonly fromName: string;
  private readonly fromEmail: string;
  private readonly apiKey: string;
  private readonly replyToEmail: string;
  private readonly otpExpiryMinutes: number;
  private readonly logoUrl: string | null;

  constructor(private readonly config: ConfigService) {
    this.fromName = this.config.get<string>('smtp.fromName') || 'Dexxify';
    this.fromEmail =
      this.config.get<string>('smtp.fromEmail') || 'hello@dexxify.com';
    this.apiKey = this.config.get<string>('smtp.apiKey') || '';
    this.replyToEmail = this.config.get<string>('smtp.replyToEmail') || '';

    // Read from the same key AuthService uses to set the OTP's expires_at, so
    // the minutes printed in the email can't drift from the real expiry.
    this.otpExpiryMinutes = this.config.get<number>('otp.expiryMinutes') || 10;

    // The icon is served by the frontend. Email clients fetch images through
    // their own proxies, so this only renders when FRONTEND_URL is a public
    // URL — on localhost the tile falls back to its "D" monogram text.
    const frontendUrl = this.config.get<string>('frontend.url');
    this.logoUrl = frontendUrl
      ? `${frontendUrl.replace(/\/$/, '')}/dexxify_icon.jpg`
      : null;

    if (!this.apiKey) {
      this.logger.warn(
        'Brevo API key not configured — emails will be logged to console instead of sent.',
      );
    }
  }

  private get otpExpiryText(): string {
    const m = this.otpExpiryMinutes;
    return `${m} minute${m === 1 ? '' : 's'}`;
  }

  async sendOtpEmail(to: string, otp: string, name?: string): Promise<boolean> {
    const subject = `${otp} is your Dexxify verification code`;

    const html = this.renderEmail({
      preheader: `Your Dexxify verification code is ${otp}.`,
      heading: 'Verify your email',
      introHtml: `We need to verify your email address <span style="color: ${C.heading};">${escapeHtml(to)}</span> before you can access your account. Enter the code below in your open browser window.`,
      code: otp,
      notes: [
        `This code expires in ${this.otpExpiryText}.`,
        "If you didn't sign up for Dexxify, you can safely ignore this email. Someone else might have typed your email address by mistake.",
      ],
    });

    const text = [
      `Hi${name ? ` ${name}` : ''},`,
      '',
      `Your Dexxify verification code is: ${otp}`,
      '',
      `Enter it in your open browser window to verify ${to}.`,
      `This code expires in ${this.otpExpiryText}.`,
      '',
      "If you didn't sign up for Dexxify, you can safely ignore this email.",
    ].join('\n');

    return await this.send(to, subject, html, text);
  }

  async sendPasswordResetEmail(
    to: string,
    otp: string,
    name?: string,
  ): Promise<void> {
    const subject = `${otp} is your Dexxify password reset code`;

    const html = this.renderEmail({
      preheader: `Your Dexxify password reset code is ${otp}.`,
      heading: 'Reset your password',
      introHtml: `We received a request to reset the password for <span style="color: ${C.heading};">${escapeHtml(to)}</span>. Enter the code below in your open browser window to choose a new password.`,
      code: otp,
      notes: [
        `This code expires in ${this.otpExpiryText}.`,
        "If you didn't request a password reset, you can safely ignore this email. Your password won't be changed.",
      ],
    });

    const text = [
      `Hi${name ? ` ${name}` : ''},`,
      '',
      `Your Dexxify password reset code is: ${otp}`,
      '',
      `This code expires in ${this.otpExpiryText}.`,
      "If you didn't request this, you can safely ignore this email. Your password won't be changed.",
    ].join('\n');

    await this.send(to, subject, html, text);
  }

  async sendTeamInviteEmail(
    to: string,
    inviterName: string,
    businessName: string,
    role: string,
    acceptUrl: string,
  ): Promise<boolean> {
    const subject = `You've been invited to join ${businessName} on Dexxify`;

    const html = this.renderEmail({
      preheader: `${inviterName} invited you to join ${businessName} on Dexxify.`,
      heading: `Join ${businessName} on Dexxify`,
      introHtml: `<span style="color: ${C.heading};">${escapeHtml(inviterName)}</span> invited you to join <span style="color: ${C.heading};">${escapeHtml(businessName)}</span> on Dexxify as ${escapeHtml(role)}. Accept the invitation to set up your account.`,
      action: { label: 'Accept invitation', url: acceptUrl },
      // 7 days matches teams.service.ts, which sets invite_expires_at to now + 7d.
      notes: [
        'This invitation expires in 7 days.',
        "If you weren't expecting this invitation, you can safely ignore this email.",
      ],
    });

    const text = [
      `${inviterName} invited you to join ${businessName} on Dexxify as ${role}.`,
      '',
      `Accept your invitation: ${acceptUrl}`,
      '',
      'This invitation expires in 7 days.',
      "If you weren't expecting this invitation, you can safely ignore this email.",
    ].join('\n');

    return this.send(to, subject, html, text);
  }

  /**
   * Shared card layout, modelled on a single centred card: logo tile, heading,
   * intro, then either a large code or a button, a divider and small print.
   *
   * Built with tables and inline styles because Gmail and Outlook strip most
   * modern CSS. The <style> block only carries the dark-mode overrides, for the
   * clients that honour prefers-color-scheme (Apple Mail, iOS Mail); Gmail
   * applies its own automatic inversion instead.
   */
  private renderEmail(layout: EmailLayout): string {
    const logo = this.logoUrl
      ? `<img src="${escapeHtml(this.logoUrl)}" width="36" height="36" alt="Dexxify" style="display: block; width: 36px; height: 36px; border: 0; border-radius: 8px;" />`
      : `<span class="dx-heading" style="display: block; width: 36px; line-height: 36px; text-align: center; font-family: ${FONT}; font-size: 18px; font-weight: 700; color: ${C.heading};">D</span>`;

    const codeBlock = layout.code
      ? `<tr>
          <td class="dx-heading" style="padding: 28px 0 0; font-family: ${FONT}; font-size: 36px; font-weight: 400; letter-spacing: 2px; line-height: 44px; color: ${C.heading};">
            ${escapeHtml(layout.code)}
          </td>
        </tr>`
      : '';

    const safeUrl = layout.action ? escapeHtml(layout.action.url) : '';
    const actionBlock = layout.action
      ? `<tr>
          <td style="padding: 28px 0 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td class="dx-btn" bgcolor="${C.heading}" style="border-radius: 8px; background: ${C.heading};">
                  <a class="dx-btn-text" href="${safeUrl}" style="display: inline-block; padding: 12px 22px; font-family: ${FONT}; font-size: 15px; font-weight: 600; color: #FFFFFF; text-decoration: none; border-radius: 8px;">${escapeHtml(layout.action.label)}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td class="dx-muted" style="padding: 16px 0 0; font-family: ${FONT}; font-size: 13px; line-height: 20px; color: ${C.muted};">
            Or paste this link into your browser:<br />
            <a class="dx-heading" href="${safeUrl}" style="color: ${C.heading}; word-break: break-all;">${safeUrl}</a>
          </td>
        </tr>`
      : '';

    const notes = layout.notes
      .map(
        (note, i) =>
          `<p class="dx-muted" style="margin: ${i === 0 ? '0' : '12px 0 0'}; font-family: ${FONT}; font-size: 13px; line-height: 20px; color: ${C.muted};">${escapeHtml(note)}</p>`,
      )
      .join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${escapeHtml(layout.heading)}</title>
  <style>
    @media (prefers-color-scheme: dark) {
      .dx-page { background: ${C.pageDark} !important; }
      .dx-card { background: ${C.pageDark} !important; border-color: ${C.borderDark} !important; }
      .dx-logo { background: #FFFFFF !important; }
      .dx-heading { color: ${C.textDark} !important; }
      .dx-body { color: ${C.textDark} !important; }
      .dx-muted { color: ${C.mutedDark} !important; }
      .dx-divider { border-color: ${C.borderDark} !important; }
      .dx-btn { background: ${C.textDark} !important; }
      .dx-btn-text { color: ${C.heading} !important; }
    }
    @media (max-width: 600px) {
      .dx-card-pad { padding: 32px 24px !important; }
    }
  </style>
</head>
<body class="dx-page" style="margin: 0; padding: 0; background: ${C.page};">
  <span style="display: none; max-height: 0; overflow: hidden; opacity: 0; color: transparent;">${escapeHtml(layout.preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="dx-page" bgcolor="${C.page}" style="background: ${C.page};">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="dx-card" bgcolor="${C.card}" style="max-width: 560px; background: ${C.card}; border: 1px solid ${C.border}; border-radius: 12px;">
          <tr>
            <td class="dx-card-pad" style="padding: 44px 48px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td class="dx-logo" bgcolor="#FFFFFF" style="padding: 10px; background: #FFFFFF; border: 1px solid ${C.border}; border-radius: 12px;">
                          ${logo}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td class="dx-heading" style="padding: 28px 0 0; font-family: ${FONT}; font-size: 26px; font-weight: 600; line-height: 34px; color: ${C.heading};">
                    ${escapeHtml(layout.heading)}
                  </td>
                </tr>
                <tr>
                  <td class="dx-body" style="padding: 14px 0 0; font-family: ${FONT}; font-size: 16px; line-height: 26px; color: ${C.body};">
                    ${layout.introHtml}
                  </td>
                </tr>
                ${codeBlock}
                ${actionBlock}
                <tr>
                  <td style="padding: 32px 0 0;">
                    <div class="dx-divider" style="border-top: 1px solid ${C.border}; font-size: 0; line-height: 0;">&nbsp;</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 24px 0 0;">
                    ${notes}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  private async send(
    to: string,
    subject: string,
    html: string,
    text: string,
  ): Promise<boolean> {
    if (!this.apiKey) {
      // Fallback: log to console in development
      this.logger.log(`── EMAIL (not sent — Brevo API key not configured) ──`);
      this.logger.log(`To: ${to}`);
      this.logger.log(`Subject: ${subject}`);
      this.logger.log(`Body: ${text}`);
      return false;
    }

    try {
      const payload: BrevoEmailPayload = {
        sender: {
          name: this.fromName,
          email: this.fromEmail,
        },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        // Plain-text part for clients that don't render HTML. Previously built
        // but never sent.
        textContent: text,
      };

      if (this.replyToEmail) {
        payload.replyTo = { email: this.replyToEmail };
      }

      const response = await fetch(this.brevoApiUrl, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'api-key': this.apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody: unknown = await response.json();
        this.logger.error(
          `Failed to send email to ${to}: [${response.status}] ${JSON.stringify(errorBody)}`,
        );
        return false;
      }

      this.logger.log(`✅ Email sent to ${to}: ${subject}`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send email to ${to}:`, message);
      return false;
    }
  }
}
