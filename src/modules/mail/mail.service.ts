import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;
  private readonly fromName: string;
  private readonly fromEmail: string;

  constructor(private readonly config: ConfigService) {
    this.fromName = this.config.get<string>('smtp.fromName') || 'Dexxify';
    this.fromEmail =
      this.config.get<string>('smtp.fromEmail') || 'noreply@dexxify.com';

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

  async sendOtpEmail(to: string, otp: string, name?: string): Promise<void> {
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

    await this.send(to, subject, html, text);
  }

  private async send(
    to: string,
    subject: string,
    html: string,
    text: string,
  ): Promise<void> {
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
      return;
    }

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email sent to ${to}: ${info.messageId}`);
    } catch (err: any) {
      this.logger.error(`Failed to send email to ${to}: ${err.message}`);
      throw err;
    }
  }
}
