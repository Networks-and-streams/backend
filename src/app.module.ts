import { Module } from '@nestjs/common';

import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AppConfigModule } from './config/app-config.module';
import { CoreModule } from './core/core.module';
import { GraphModule } from './graph/graph.module';
import { SavedGraphsModule } from './saved-graphs/saved-graphs.module';
import { SessionsModule } from './sessions/sessions.module';
import { OauthModule } from './oauth/oauth.module';
import { PaymentsModule } from './payments/payments.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';

@Module({
  imports: [
    // Core
    AppConfigModule,
    CoreModule,

    // Auth
    AuthModule,
    OauthModule,
    UsersModule,
    SessionsModule,

    // Domain
    SubscriptionsModule,
    PaymentsModule,

    // Graph
    GraphModule,
    SavedGraphsModule,
  ],
})
export class AppModule {}
