import { BadRequestException, ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'node:crypto';

import appConfig from '@/config/loaders/app.config';
import type { Language } from '@/common/types/language';
import { PrismaContextService } from '@/core/prisma';
import { RedisService } from '@/core/redis/redis.service';
import { MailService } from '@/core/mail/mail.service';
import { emailChangedMail, linkMail } from '@/core/mail/mail.templates';
import { ChangeEmailDto } from './dto/change-email.dto';

const TOKEN_TTL_SECONDS = 24 * 60 * 60;

/** What a link token proves, stored server-side (the token itself is never stored). */
interface EmailToken {
  purpose: 'verify' | 'change';
  userId: string;
  /** Address the link was sent to: the current email (verify) or the new one (change). */
  email: string;
}

export interface EmailConfirmation {
  purpose: EmailToken['purpose'];
  email: string;
}

/**
 * Email ownership: verification links and email changes.
 *
 * Tokens are 32 random bytes sent only by email; Redis keeps their SHA-256
 * hash for 24 h and they are single-use (read-and-delete).
 */
@Injectable()
export class AccountEmailService {
  private readonly logger = new Logger(AccountEmailService.name);

  constructor(
    private readonly db: PrismaContextService,
    private readonly redis: RedisService,
    private readonly mail: MailService,
    @Inject(appConfig.KEY) private readonly app: ConfigType<typeof appConfig>,
  ) {}

  /** Sends a link proving the user owns their current email. */
  async sendVerification(userId: string, lang: Language): Promise<void> {
    const user = await this.db.client.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.emailVerifiedAt) throw new BadRequestException('Email is already verified');

    const link = await this.createLink({ purpose: 'verify', userId, email: user.email });
    await this.mail.send(user.email, linkMail('verifyEmail', lang, link));
  }

  /**
   * Starts an email change: after re-checking the password, sends a link to
   * the new address. Nothing changes until that link is opened.
   */
  async requestChange(userId: string, dto: ChangeEmailDto, lang: Language): Promise<void> {
    const user = await this.db.client.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.password) {
      throw new BadRequestException('Set a password first: it is needed to confirm an email change');
    }
    if (!(await bcrypt.compare(dto.password, user.password))) {
      throw new BadRequestException('Password is incorrect');
    }

    const newEmail = dto.newEmail.trim();
    if (newEmail.toLowerCase() === user.email.toLowerCase()) {
      throw new BadRequestException('This is already your email');
    }
    if (await this.db.client.user.findUnique({ where: { email: newEmail } })) {
      throw new ConflictException('This email is already used by another account');
    }

    const link = await this.createLink({ purpose: 'change', userId, email: newEmail });
    await this.mail.send(newEmail, linkMail('confirmEmailChange', lang, link));
  }

  /** Applies a link token: marks the email verified, or switches to the new email. */
  async confirm(token: string, lang: Language): Promise<EmailConfirmation> {
    const raw = await this.redis.getDel(tokenKey(token));
    if (!raw) throw new BadRequestException('This link is invalid or has expired');
    const payload = JSON.parse(raw) as EmailToken;

    const user = await this.db.client.user.findUnique({ where: { id: payload.userId } });
    if (!user) throw new BadRequestException('This link is invalid or has expired');

    if (payload.purpose === 'verify') {
      // The email changed since the link was sent: the link no longer proves anything.
      if (user.email !== payload.email) throw new BadRequestException('This link is invalid or has expired');
      if (!user.emailVerifiedAt) {
        await this.db.client.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
        this.logger.log(`User ${user.id} verified email`);
      }
      return { purpose: 'verify', email: user.email };
    }

    if (await this.db.client.user.findUnique({ where: { email: payload.email } })) {
      throw new ConflictException('This email is already used by another account');
    }
    const oldEmail = user.email;
    await this.db.client.user.update({
      where: { id: user.id },
      data: { email: payload.email, emailVerifiedAt: new Date() },
    });
    this.logger.log(`User ${user.id} changed email`);
    // Tell the previous address, so a hijack does not go unnoticed.
    await this.mail
      .send(oldEmail, emailChangedMail(lang, payload.email))
      .catch((error) => this.logger.error(`Could not notify old email of user ${user.id}`, error));
    return { purpose: 'change', email: payload.email };
  }

  private async createLink(payload: EmailToken): Promise<string> {
    const token = crypto.randomBytes(32).toString('base64url');
    await this.redis.set(tokenKey(token), JSON.stringify(payload), TOKEN_TTL_SECONDS);
    return `${this.app.frontendUrl.replace(/\/$/, '')}/confirm-email?token=${token}`;
  }
}

function tokenKey(token: string): string {
  return `email-token:${crypto.createHash('sha256').update(token).digest('hex')}`;
}
