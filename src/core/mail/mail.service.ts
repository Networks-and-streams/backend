import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import mailConfig from '@/config/loaders/mail.config';
import type { MailContent } from './mail.templates';

/**
 * Sends transactional email over SMTP. Without SMTP configured it logs the
 * message instead, so local development works without a mailbox.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport: Transporter | null;

  constructor(@Inject(mailConfig.KEY) private readonly config: ConfigType<typeof mailConfig>) {
    this.transport = config.host
      ? createTransport({
          host: config.host,
          port: config.port,
          secure: config.secure,
          auth: config.user ? { user: config.user, pass: config.pass } : undefined,
        })
      : null;
    if (!this.transport) {
      this.logger.warn('SMTP_HOST is not set: emails are written to the log instead of being sent');
    }
  }

  async send(to: string, mail: MailContent): Promise<void> {
    if (!this.transport) {
      this.logger.log(`[mail to ${to}] ${mail.subject}\n${mail.text}`);
      return;
    }
    await this.transport.sendMail({ from: this.config.from, to, subject: mail.subject, text: mail.text });
    this.logger.log(`Email "${mail.subject}" sent to ${to}`);
  }
}
