import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';

import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AppConfigModule } from './config/app-config.module';
import { CoreModule } from './core/core.module';
import { SessionsModule } from './sessions/sessions.module';
import { OauthModule } from './oauth/oauth.module';
import { PaymentsModule } from './payments/payments.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { SavedGraphsModule } from './saved-graphs/saved-graphs.module';
import { GraphModule } from './graph/graph.module';
import { HealthModule } from './health/health.module';

/**
 * Desktop build (Electron): `SERVE_STATIC_DIR` points at the built frontend,
 * so one port (3100) serves both the API and the SPA — no separate static
 * server and no `/api` proxy. The module registers AFTER the Nest router
 * (ServeStaticModule does its work in `onModuleInit`), so real API routes win
 * over the SPA fallback; only unmatched GETs render `index.html`.
 *
 * Dev/Docker leave the variable unset and keep the current behaviour
 * (Vite/Nginx in front of the API).
 */
const serveStaticImports = process.env.SERVE_STATIC_DIR
  ? [
      ServeStaticModule.forRoot({
        rootPath: process.env.SERVE_STATIC_DIR,
        // Express 5 / path-to-regexp v8 wildcard: any unmatched GET → index.html.
        renderPath: '{*any}',
      }),
    ]
  : [];

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
    SavedGraphsModule,
    GraphModule,

    // Ops
    HealthModule,

    // Desktop-only static serving of the frontend dist
    ...serveStaticImports,
  ],
})
export class AppModule {}
