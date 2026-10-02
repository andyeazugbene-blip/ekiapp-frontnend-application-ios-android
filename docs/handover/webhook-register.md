# Webhook Register (Handbook L96, §16–18)

| Provider | Endpoint | Signature | Idempotency | Owner of endpoint secret |
|---|---|---|---|---|
| Stripe | `POST /api/stripe/webhook` | `stripe.webhooks.constructEvent` with `STRIPE_WEBHOOK_SECRET`, raw body | `WebhookEvent.stripeEventId` unique + serialisable txn; identity + connect events use the same path | TO CONFIRM |
| Paystack | `POST /api/paystack/webhook` | HMAC-SHA512 `x-paystack-signature` | transaction reference | TO CONFIRM |

## Stripe events the backend handles (subscribe the endpoint to exactly these)
`payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `payment_intent.amount_capturable_updated`,
`charge.refunded`, `charge.refund.updated`, `charge.dispute.created`, `charge.dispute.closed`, `checkout.session.completed`,
`customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.trial_will_end`, `invoice.payment_failed`,
`account.updated`, `account.application.deauthorized`, `payout.paid`, `payout.failed`, `payout.canceled`,
`identity.verification_session.verified`, `identity.verification_session.requires_input` (+ `processing`, `canceled`, `redacted` handled as non-terminal).

## Operating rules
- Failed handler => non-2xx so Stripe retries (identity handler fixed to rethrow).
- Admin visibility: payment and order detail show webhook receipt / outcome (`GET /admin/webhook-events`).
- Rolling back application code across a payments change must check webhook-handler compatibility first (see FINAL_TECHNICAL_HANDOVER.md §21).
- Retry/alerting owner: TO CONFIRM (Sentry / Stripe dashboard alerts).
