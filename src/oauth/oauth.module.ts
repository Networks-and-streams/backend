import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { AuthModule } from '@/auth/auth.module';
import { UsersModule } from '@/users/users.module';

import { OauthService } from './oauth.service';
import { OauthController } from './oauth.controller';
import { GoogleStrategy } from './strategies/google.strategy';
import { ConfigModule } from '@nestjs/config';
import googleConfig from '@/config/loaders/google.config';
import appConfig from '@/config/loaders/app.config';

@Module({
  imports: [
    ConfigModule.forFeature(appConfig),
    ConfigModule.forFeature(googleConfig),
    PassportModule,
    AuthModule,
    UsersModule,
  ],
  controllers: [OauthController],
  providers: [OauthService, GoogleStrategy],
})
export class OauthModule {}
