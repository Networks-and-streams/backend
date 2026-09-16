import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import cryptoConfig from '@/config/loaders/crypto.config';
import { EncryptionService } from './encryption.service';

@Global()
@Module({
  imports: [ConfigModule.forFeature(cryptoConfig)],
  providers: [EncryptionService],
  exports: [EncryptionService],
})
export class CryptoModule {}
