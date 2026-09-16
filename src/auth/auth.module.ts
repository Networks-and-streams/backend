import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { LocalStrategy } from './strategies/local.strategy';
import { UsersModule } from '@/users/users.module';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { SessionsModule } from '@/sessions/sessions.module';
import { TokenService } from './services/token.service';
import { CookieService } from './services/cookie.service';
import { AuthMapper } from './mapper/auth.mapper';
import jwtConfig from '@/config/loaders/jwt.config';
import appConfig from '@/config/loaders/app.config';
import { JwtStrategy } from '@/auth/strategies/jwt.strategy';

@Module({
  imports: [
    JwtModule.register({}),
    UsersModule,
    PassportModule,
    SessionsModule,
    ConfigModule.forFeature(jwtConfig),
    ConfigModule.forFeature(appConfig),
  ],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, JwtStrategy, JwtRefreshStrategy, TokenService, CookieService, AuthMapper],
  exports: [AuthService, CookieService, TokenService],
})
export class AuthModule {}
