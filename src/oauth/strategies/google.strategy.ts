import googleConfig from '@/config/loaders/google.config';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-google-oauth20';
import { OAuthProvider } from '@/generated/prisma/client';
import { NormalizedOAuthProfile } from '../interfaces/normalized-oauth-profile.interface';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);
  constructor(@Inject(googleConfig.KEY) private readonly config: ConfigType<typeof googleConfig>) {
    super({
      clientID: config.clientId,
      clientSecret: config.clientSecret,
      callbackURL: config.callbackUrl || '/oauth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  validate(accessToken: string, refreshToken: string, profile: Profile): Promise<NormalizedOAuthProfile> {
    const { id, emails, name, photos } = profile;

    this.logger.log(`Google OAuth profile received for ${emails?.[0]?.value}`);

    return Promise.resolve({
      provider: OAuthProvider.GOOGLE,
      providerAccountId: id,
      email: emails?.[0]?.value ?? '',
      firstName: name?.givenName ?? null,
      lastName: name?.familyName ?? null,
      avatar: photos?.[0]?.value ?? null,
    });
  }
}
