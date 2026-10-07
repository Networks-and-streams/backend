import { ConfigModule } from '@nestjs/config';
import appConfig from '@/config/loaders/app.config';
import { AccountEmailService } from './account-email.service';
import { SessionsModule } from '@/sessions/sessions.module';
import { UsersController } from './users.controller';
import { Module } from '@nestjs/common';
import { UsersService } from './users.service';

@Module({
  imports: [SessionsModule, ConfigModule.forFeature(appConfig)],
  controllers: [UsersController],
  providers: [UsersService, AccountEmailService],
  exports: [UsersService, AccountEmailService],
})
export class UsersModule {}
