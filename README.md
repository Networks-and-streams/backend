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
- `POST /payments/webhook` is idempotent at three levels:
  1. **Persistent event dedup** — every processed PSP event is recorded in `PaymentWebhookEvent` with a DB unique constraint on `(provider, eventId)`. A redelivered Stripe event is acknowledged without re-processing.
  2. **State-transition checks** — already-terminal payments never transition again.
  3. **DB race guard** — the transaction re-reads the payment before updating; a concurrent delivery that already flipped the state is skipped.

### Stripe TEST-mode Integration

The active PSP is **Stripe in TEST mode** — no real money is ever moved.

```
Frontend (Google Pay TEST)
        │  payment token
        ▼
POST /payments/:id/google-pay   (JWT)
        │  token passed to adapter
        ▼
StripeGateway
        │  1. creates a PaymentMethod from the Google Pay token
        │  2. creates + confirms a PaymentIntent (amount/currency from the server-side Payment record)
        ▼
Stripe TEST API
        │
        │  webhook (payment_intent.succeeded, ...)
        ▼
POST /payments/webhook          (public — signature verified via STRIPE_WEBHOOK_SECRET)
        │  raw body + stripe-signature header
        ▼
StripeGateway.verifyWebhook  →  normalized WebhookEvent
        │
        ▼
PaymentsService (transaction)
        │  Payment → SUCCEEDED
        ▼  Subscription → ACTIVE
```

**Key principles**

- The **backend derives amount/currency** from the server-side plan pricing — the client can never override them.
- **Google Pay is only a payment method** — Stripe is the payment processor (`PaymentProvider = STRIPE`, `PaymentMethod = GOOGLE_PAY`).
- **Only the `StripeGateway` adapter** imports the Stripe SDK. The core payment domain sees only the generic `PaymentGateway` contract.
- The **webhook is the source of truth** for the final payment state. A synchronous gateway response may optimistically mark a payment SUCCEEDED, but a verified Stripe webhook is authoritative.

### Stripe CLI — local webhook testing

1. Authenticate the CLI:

```bash
stripe login
```

2. Forward real-ish Stripe TEST events to your local backend and print the webhook signing secret:

```bash
stripe listen --forward-to localhost:3000/payments/webhook
# → whsec_...   (this is your STRIPE_WEBHOOK_SECRET)
```

3. Start the backend with Stripe TEST keys:

```bash
STRIPE_SECRET_KEY=sk_test_... STRIPE_WEBHOOK_SECRET=whsec_... npm run start:dev
```

4. Trigger a payment from the frontend (Google Pay TEST sheet) or via the Stripe Dashboard/Kli in TEST mode. Stripe CLI forwards the events to the backend, which verifies the signature and updates the payment/subscription.

### Manual end-to-end flow (Google Pay TEST)

1. Start PostgreSQL (`docker compose up -d graph_db` or similar) and apply migrations.
2. Configure Stripe TEST keys in `.env` (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`).
3. Start `stripe listen --forward-to localhost:3000/payments/webhook`.
4. Start the NestJS backend.
5. Start the frontend and register a test user (creates an inactive subscription).
6. `POST /payments` with `{ "plan": "PREMIUM", "paymentMethod": "GOOGLE_PAY" }` → PENDING payment.
7. Open the Google Pay TEST sheet, select a test payment method.
8. Submit the payment → frontend sends the Google Pay token to `POST /payments/:id/google-pay`.
9. Stripe processes the TEST transaction and emits webhook events.
10. Stripe CLI forwards the events; the backend verifies the signature.
11. `GET /payments/:id` → `SUCCEEDED`; `GET /subscriptions/me` → `ACTIVE`.

> **Note:** The Google Pay TEST sheet must be implemented in the frontend. This repository contains only the backend `POST /payments/:id/google-pay` contract — the token payload is the raw Google Pay `PaymentData.tokenizationData` object. Until the frontend integration exists, the flow ends at step 6/7 and cannot be fully exercised end-to-end.

### Environment Variables

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
| `PAYMENT_WEBHOOK_SECRET` | yes | Shared secret for PSP webhook signature verification (legacy; use `STRIPE_WEBHOOK_SECRET` for Stripe) |
| `STRIPE_SECRET_KEY` | yes (Stripe) | Stripe **TEST** secret key (`sk_test_...`) — never a live key |
| `STRIPE_WEBHOOK_SECRET` | yes (Stripe) | Stripe webhook signing secret (`whsec_...`) from `stripe listen` or the Dashboard |
| `STRIPE_API_VERSION` | no | Pin a specific Stripe API version (e.g. `2025-08-27.basil`) |

> ⚠️ **Stripe keys are secrets.** Never commit real `sk_live_...` keys. Keep them in `.env` (gitignored).

---

## State Transitions

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
3. Register it in `PaymentsModule` by replacing the `PAYMENT_GATEWAY` factory:

```ts
// src/payments/payments.module.ts
{
  provide: PAYMENT_GATEWAY,
  inject: [paymentConfig.KEY],
  useFactory: (payment: ConfigType<typeof paymentConfig>) => {
    if (payment.provider === 'stripe') {
      return new StripeGateway(payment.stripeSecretKey, payment.stripeWebhookSecret);
    }
    if (payment.provider === 'liqpay') {
      return new LiqPayGateway(/* ... */);
    }
    // ...
  },
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
