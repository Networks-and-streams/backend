import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { PrismaContextService } from './prisma-context.service';
import databaseConfig from '@/config/loaders/database.config';

@Global()
@Module({
  imports: [ConfigModule.forFeature(databaseConfig)],
  providers: [PrismaService, PrismaContextService],
  exports: [PrismaService, PrismaContextService],
})
export class PrismaModule {}
