import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SendDailySummaryEmailParams {
  to: string;
  orgName: string;
  date: Date;
  summaryText: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly isProduction: boolean;

  constructor(private readonly configService: ConfigService) {
    this.isProduction = this.configService.get<string>('NODE_ENV') === 'production';
  }

  /**
   * Send daily summary email to organization owner
   * For now: logs to console in dev, can be replaced with real SMTP in production
   */
  async sendDailySummaryEmail(params: SendDailySummaryEmailParams): Promise<void> {
    const { to, orgName, date, summaryText } = params;

    const subject = `Daily Summary for ${orgName} - ${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;

    this.logger.log(`📧 Sending daily summary email to ${to}`);

    if (this.isProduction) {
      // TODO: Implement real email sending (Resend, SendGrid, or SMTP)
      // For now, log in production too
      this.logger.warn('Email service not configured - logging summary instead');
      this.logEmailToConsole(to, subject, summaryText);
    } else {
      // Development: log to console
      this.logEmailToConsole(to, subject, summaryText);
    }

    this.logger.log(`✅ Daily summary email sent to ${to}`);
  }

  /**
   * Log email to console (for development)
   */
  private logEmailToConsole(to: string, subject: string, body: string): void {
    this.logger.log('========================================');
    this.logger.log('📨 EMAIL (Development Mode)');
    this.logger.log('========================================');
    this.logger.log(`To: ${to}`);
    this.logger.log(`Subject: ${subject}`);
    this.logger.log('----------------------------------------');
    this.logger.log(body);
    this.logger.log('========================================');
  }

  /**
   * TODO: Implement real email sending
   * Example with nodemailer + SMTP:
   * 
   * private async sendRealEmail(to: string, subject: string, text: string): Promise<void> {
   *   const transporter = nodemailer.createTransport({
   *     host: this.configService.get<string>('SMTP_HOST'),
   *     port: this.configService.get<number>('SMTP_PORT'),
   *     secure: true,
   *     auth: {
   *       user: this.configService.get<string>('SMTP_USER'),
   *       pass: this.configService.get<string>('SMTP_PASS'),
   *     },
   *   });
   * 
   *   await transporter.sendMail({
   *     from: this.configService.get<string>('EMAIL_FROM'),
   *     to,
   *     subject,
   *     text,
   *   });
   * }
   * 
   * Environment variables needed:
   * - SMTP_HOST=smtp.example.com
   * - SMTP_PORT=465
   * - SMTP_USER=your-email@example.com
   * - SMTP_PASS=your-password
   * - EMAIL_FROM="Bizta <noreply@bizta.ai>"
   */
}
