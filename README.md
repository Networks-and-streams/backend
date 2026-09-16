# GraphSolver

## Architecture Overview

This is a NestJS 11 backend with Prisma 7 (PostgreSQL), Redis, JWT auth with OAuth (Google), and SWC-based build.

## Payment & Subscription System

### Overview

A provider-agnostic payment system that:

1. Creates an **inactive subscription** for every newly registered user.
2. Lets the user pay for a premium plan via a payment method (Google Pay today; card or Apple Pay in the future).
3. Processes the payment through a pluggable **PaymentGateway** abstraction (Stripe/LiqPay/WayForPay — whichever is configured).
4. Never trusts the frontend for payment success — the **backend is the source of truth**.
5. Handles PSP webhooks idempotently, so repeated deliveries never create duplicate state.

### Business Flow

```
User registers / OAuth login
        │
        ▼
User created + inactive Subscription (atomic)
        │
        ▼
GET /subscriptions/me  →  status: INACTIVE
        │
        ▼
POST /payments  →  PENDING payment created
        │          (amount/currency derived from plan, never from client)
        ▼
POST /payments/:id/google-pay  →  token sent to PSP
        │
        ├──── sync success  →  SUCCEEDED + subscription ACTIVE
        │
        ├──── sync processing  →  PROCESSING → webhook confirms later
        │
        └──── sync fail  →  FAILED (webhook will confirm)
        │
        ▼
POST /payments/webhook  →  PSP callback
        │                   (signature verified, idempotent)
        ▼
Payment SUCCEEDED  →  Subscription ACTIVATED atomically
```

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/subscriptions/me` | JWT | Current user's subscription |
| `POST` | `/payments` | JWT | Create a PENDING payment for a plan |
| `GET` | `/payments/:id` | JWT | Get a payment by ID (ownership enforced) |
| `POST` | `/payments/:id/google-pay` | JWT | Submit Google Pay token for processing |
| `POST` | `/payments/webhook` | PSP signature | Receive PSP webhook |

### Idempotency

- `POST /payments` returns the existing PENDING payment if one already exists for the subscription.
- `POST /payments/:id/google-pay` atomically claims the payment (`PENDING → PROCESSING` via `updateMany`), so only one request can win. Concurrent or duplicate attempts get `409 Conflict`.
- `POST /payments/webhook` is idempotent: already-terminal payments are no-ops.

### State Transitions

**Payment**

```
PENDING  →  PROCESSING  →  SUCCEEDED  →  REFUNDED
PENDING  →  FAILED
PENDING  →  CANCELLED
```

**Subscription**

```
INACTIVE  →  ACTIVE
ACTIVE    →  PAST_DUE  |  CANCELLED  |  EXPIRED
PAST_DUE  →  ACTIVE  |  CANCELLED  |  EXPIRED
```

Any transition not listed is rejected.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

| Variable | Required | Description |
|----------|----------|-------------|
| `FRONTEND_URL` | yes | Frontend origin for CORS |
| `CORS_ORIGINS` | yes | Comma-separated allowed origins |
| `NODE_ENV` | yes | `development`, `production`, or `test` |
| `COOKIE_DOMAIN` | yes | Domain for the refresh-token HttpOnly cookie |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `REDIS_URL` | yes | Redis connection string |
| `JWT_SECRET` | yes | Access-token signing secret |
| `JWT_REFRESH_SECRET` | yes | Refresh-token signing secret |
| `GOOGLE_CLIENT_ID` | yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | yes | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | yes | Google OAuth callback URL |
| `GOOGLE_PAY_MER_ID` | yes | Google Pay merchant ID |
| `PAYMENT_PROVIDER` | yes | Active PSP: `stripe`, `liqpay`, or `wayforpay` |
| `PAYMENT_CURRENCY` | no | Default currency (ISO-4217), defaults to `USD` |
| `PAYMENT_WEBHOOK_SECRET` | yes | Shared secret for PSP webhook signature verification |

---

## Adding a Payment Provider

1. Create a new gateway under `src/payments/providers/<provider>/`.
2. Implement the `PaymentGateway` interface (`src/payments/payment.gateway.ts`).
3. Register it in `PaymentsModule` by replacing the `PAYMENT_GATEWAY` token:

```ts
// src/payments/payments.module.ts
{
  provide: PAYMENT_GATEWAY,
  useClass: StripeGateway, // instead of StubPaymentGateway
}
```

No payment domain code changes are required.

---

## Testing

```bash
npm run lint
npm test
npx prisma validate
npx prisma generate
npm run typecheck
```

### Payment domain tests

```bash
npm test -- --testPathPattern payments
npm test -- --testPathPattern subscriptions
```
