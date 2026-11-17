import cookieParser from 'cookie-parser';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ExpressAdapter } from '@nestjs/platform-express';
import request from 'supertest';

import { AppModule } from '@/app.module';
import { setupApiPrefix } from '@/bootstrap/setup-api-prefix';
import { setupPipes } from '@/bootstrap/setup-pipes';
import { setupInterceptors } from '@/bootstrap/setup-interceptors';

/** COMPUTE_ADDR exactly as loaded from `.env` (used when no override is given). */
const DEFAULT_COMPUTE_ADDR = process.env.COMPUTE_ADDR;

export interface TestAppOptions {
  /** `host:port` of the gRPC compute endpoint this app instance talks to. */
  computeAddr?: string;
}

/**
 * Boots the real `AppModule` in-process, mirroring `bootstrap/app.ts`
 * (cookie parser + global pipes + global interceptors) so the E2E specs
 * exercise the same request pipeline as production.
 *
 * The compute address is injected through `process.env` *before* the module
 * compiles: `computeConfig` parses the environment inside its factory, so the
 * value is read at instantiation time.
 */
export async function createTestApp(options: TestAppOptions = {}): Promise<INestApplication> {
  if (options.computeAddr) {
    process.env.COMPUTE_ADDR = options.computeAddr;
  } else if (DEFAULT_COMPUTE_ADDR !== undefined) {
    process.env.COMPUTE_ADDR = DEFAULT_COMPUTE_ADDR;
  }

  const builder = Test.createTestingModule({ imports: [AppModule] });

  // Desktop mode: @nestjs/serve-static chooses its loader (Express vs no-op)
  // while providers are instantiated — during compile(). The testing builder
  // only assigns the HTTP adapter later, in createNestApplication(), so the
  // factory would see no adapter and silently install NoopLoader (the SPA
  // would never be served). NestFactory sets the adapter before instantiation,
  // which is why production works — mirror that order here.
  let httpAdapter: ExpressAdapter | undefined;
  if (process.env.SERVE_STATIC_DIR) {
    httpAdapter = new ExpressAdapter();
    const withContainer = builder as unknown as { container: { setHttpAdapter: (adapter: ExpressAdapter) => void } };
    withContainer.container.setHttpAdapter(httpAdapter);
  }

  const moduleRef = await builder.compile();

  const app = httpAdapter ? moduleRef.createNestApplication(httpAdapter) : moduleRef.createNestApplication();
  // Desktop single-port mode (mirrors bootstrap/app.ts).
  if (process.env.SERVE_STATIC_DIR) {
    setupApiPrefix(app);
  }
  app.use(cookieParser());
  setupPipes(app);
  setupInterceptors(app);
  await app.init();

  return app;
}

/** A throwaway account with freshly issued tokens. */
export interface E2EUser {
  email: string;
  password: string;
  accessToken: string;
  refreshToken: string;
}

/** Collision-free email so specs can run repeatedly against `streams_test`. */
export function uniqueEmail(prefix = 'e2e'): string {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${stamp}@e2e.test`;
}

/** Normalises the `Set-Cookie` header (Node keeps it an array; types say string). */
export function setCookiesFrom(res: request.Response): string[] {
  const raw = res.headers['set-cookie'] as unknown;
  if (Array.isArray(raw)) return raw as string[];
  return typeof raw === 'string' && raw ? [raw] : [];
}

/** Pulls the raw value of the `refreshToken` cookie out of a Set-Cookie header. */
export function refreshCookieFrom(res: request.Response): string {
  const raw = setCookiesFrom(res).find((cookie) => cookie.startsWith('refreshToken='));
  if (!raw) {
    throw new Error(`response set no refreshToken cookie (got: ${setCookiesFrom(res).join(' | ') || 'none'})`);
  }
  return raw.split(';')[0].slice('refreshToken='.length);
}

/** Registers a user and returns both tokens (fails loudly on any other status). */
export async function registerUser(app: INestApplication, email = uniqueEmail()): Promise<E2EUser> {
  const password = 'e2e-password';

  const res = await request(app.getHttpServer()).post('/auth/register').send({ email, password });
  if (res.status !== 201) {
    throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  }

  return {
    email,
    password,
    accessToken: res.body.accessToken as string,
    refreshToken: refreshCookieFrom(res),
  };
}

/** `Authorization: Bearer …` header helper. */
export function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

/** Convenience wrapper: `request(app.getHttpServer())` is boilerplate everywhere. */
export function http(app: INestApplication): ReturnType<typeof request> {
  return request(app.getHttpServer());
}
