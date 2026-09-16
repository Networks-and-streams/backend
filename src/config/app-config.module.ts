import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { appConfigModule } from './app.config';

@Global()
@Module({
  imports: [ConfigModule.forRoot(appConfigModule)],
})
export class AppConfigModule {}
