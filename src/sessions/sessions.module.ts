import { Module } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { SessionsMapper } from '@/sessions/sessions.mapper';

@Module({
  controllers: [SessionsController],
  providers: [SessionsService, SessionsMapper],
  exports: [SessionsService],
})
export class SessionsModule {}
