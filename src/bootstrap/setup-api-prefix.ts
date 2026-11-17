import type { INestApplication } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const API_PREFIX = '/api';
/** Swagger is mounted at `/api/docs/...` — its path must NOT be rewritten. */
const SWAGGER_PREFIX = '/api/docs';

/**
 * Desktop-only (see `SERVE_STATIC_DIR`): the frontend calls the API under
 * `/api` (Nginx/Vite strip that prefix in dev). The Electron build serves the
 * SPA and the API from ONE port, so the prefix is stripped here instead —
 * this mirrors `infra/nginx` and `vite.config.ts`.
 *
 * Must be registered before any route middleware (including Swagger and the
 * raw-body JSON parser) so every downstream layer sees the canonical path.
 */
export function setupApiPrefix(app: INestApplication): void {
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const url = req.url;

    if (!/^\/api(?:\/|\?|$)/.test(url) || url.startsWith(SWAGGER_PREFIX)) {
      next();
      return;
    }

    const rest = url.slice(API_PREFIX.length);
    req.url = rest.startsWith('/') ? rest : `/${rest}`;
    next();
  });
}
