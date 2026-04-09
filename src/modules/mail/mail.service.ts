import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

interface BrevoEmailPayload {
  sender: { name: string; email: string };
  to: { email: string }[];
  replyTo?: { email: string };
  subject: string;
  htmlContent: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;
  private readonly brevoApiUrl = 'https://api.brevo.com/v3/smtp/email';
  private readonly fromName: string;
  private readonly fromEmail: string;
  private readonly apiKey: string;
  private readonly replyToEmail: string;

  constructor(private readonly config: ConfigService) {
    this.fromName = this.config.get<string>('smtp.fromName') || 'Dexxify';
    this.fromEmail =
      this.config.get<string>('smtp.fromEmail') || 'hello@dexxify.com';
    this.apiKey = this.config.get<string>('smtp.apiKey') || '';
    this.replyToEmail = this.config.get<string>('smtp.replyToEmail') || '';
    const host = this.config.get<string>('smtp.host');
    const port = this.config.get<number>('smtp.port');
    const user = this.config.get<string>('smtp.user');
    const pass = this.config.get<string>('smtp.password');

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: port || 587,
        secure: port === 465,
        auth: { user, pass },
      });
    } else {
      this.logger.warn(
        'SMTP not configured — emails will be logged to console instead of sent.',
      );
    }
  }

  async sendOtpEmail(to: string, otp: string, name?: string): Promise<boolean> {
    const subject = `${otp} is your Dexxify verification code`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Verify your email</h2>
        <p>Hi${name ? ` ${name}` : ''},</p>
        <p>Use the code below to verify your Dexxify account:</p>
        <div style="
          background: #f4f4f5;
          border-radius: 8px;
          padding: 24px;
          text-align: center;
          margin: 24px 0;
        ">
          <span style="
            font-size: 32px;
            font-weight: 700;
            letter-spacing: 6px;
            color: #1a1a1a;
          ">${otp}</span>
        </div>
        <p style="color: #6b7280; font-size: 14px;">
          This code expires in 10 minutes. If you didn't create a Dexxify account, 
          you can safely ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">
          Dexxify - Crypto Infrastructure API
        </p>
      </div>
    `;

    const text = `Your Dexxify verification code is: ${otp}\n\nThis code expires in 10 minutes.`;

    return await this.send(to, subject, html, text);
  }

  async sendPasswordResetEmail(
    to: string,
    otp: string,
    name?: string,
  ): Promise<void> {
    const subject = `${otp} is your Dexxify password reset code`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Reset your password</h2>
        <p>Hi${name ? ` ${name}` : ''},</p>
        <p>We received a request to reset your Dexxify account password. Use the code below:</p>
        <div style="
          background: #f4f4f5;
          border-radius: 8px;
          padding: 24px;
          text-align: center;
          margin: 24px 0;
        ">
          <span style="
            font-size: 32px;
            font-weight: 700;
            letter-spacing: 6px;
            color: #1a1a1a;
          ">${otp}</span>
        </div>
        <p style="color: #6b7280; font-size: 14px;">
          This code expires in 10 minutes. If you didn't request a password reset, 
          you can safely ignore this email — your password will not be changed.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">
          Dexxify - Crypto Infrastructure API
        </p>
      </div>
    `;

    const text = `Your Dexxify password reset code is: ${otp}\n\nThis code expires in 10 minutes. If you didn't request this, ignore this email.`;

    await this.send(to, subject, html, text);
  }

  private async send(
    to: string,
    subject: string,
    html: string,
    text: string,
  ): Promise<boolean> {
    const mailOptions = {
      from: `"${this.fromName}" <${this.fromEmail}>`,
      to,
      subject,
      html,
      text,
    };

    if (!this.transporter) {
      // Fallback: log to console in development
      this.logger.log(`── EMAIL (not sent — SMTP not configured) ──`);
      this.logger.log(`To: ${to}`);
      this.logger.log(`Subject: ${subject}`);
      this.logger.log(`Body: ${text}`);
      return false;
    }

    try {
      //   const info = await this.transporter.sendMail(mailOptions);
      //   this.logger.log(`Email sent to ${to}: ${info.messageId}`);

      const payload: BrevoEmailPayload = {
        sender: {
          name: this.fromName,
          email: this.fromEmail,
        },
        to: [{ email: to }],
        subject,
        htmlContent: html,
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
        const errorBody = await response.json();
        this.logger.error(
          `Failed to send email to ${to}: [${response.status}] ${JSON.stringify(errorBody)}`,
        );
        return false;
      }

      this.logger.log(`✅ Email sent to ${to}: ${subject}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}:`, error.message);
      return false;
    }
    // } catch (err: any) {
    //   this.logger.error(`Failed to send email to ${to}: ${err.message}`);
    //   throw err;
    // }
  }
}
