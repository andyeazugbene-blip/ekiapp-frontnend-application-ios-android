# Event Inventory (Handbook §12)

Store: `Event` table (migration `20261002141100`). Producer: `eventsService.emit` (`src/modules/events/events.service.ts`) - fire-and-forget, never throws, at-least-once; consumers dedupe on `payload.stripeEventId`. Canonical list: `EVENT_NAMES`. Tests: `src/tests/event-emission.test.ts`.
Admin consumers: Automation Centre run history (`/automation`), vendor trial-ending detector. **No dashboard reads an event that is not emitted** (no metric is shown for the NOT EMITTED rows).

## Emitted (producer exists, persisted)
| Event | Producer (file) | Payload / entity | Admin / system consumer |
|---|---|---|---|
| merchant_registered | auth.service.ts (vendor register) | User; country | Event table |
| verification_completed | verification/stripe-identity.service.ts | Vendor; sessionId | Event table |
| product_published | products.service.ts (create, live) | Product; vendorId | Event table |
| item_added_to_cart | cart.service.ts addItem | Product; quantity | Event table |
| checkout_started, order_created | payments.service.ts | Checkout/Order | Event table |
| payment_succeeded, payment_failed | stripe.service.ts (webhook) | Order/Checkout; stripeEventId | Event table (deduped by stripeEventId) |
| order_accepted/dispatched/delivered/completed | orders.service.ts (vendor transitions) | Order; fromStatus | Event table |
| order_refunded | stripe.service.ts (charge.refunded) | Order; stripeEventId | Event table |
| subscription_created/paused/resumed/cancelled/skipped/renewed/payment_failed, payment_retry | buyer-subscriptions.service.ts recordAction | BuyerSubscription; action | Event table |
| community_buy_created/approved/published | community-campaigns.service.ts | CommunityCampaign | Event table |
| community_buy_joined | campaign-contributions / campaign-authorisation | CampaignContribution; campaignId; amount | Event table |
| automation_triggered/actioned/suppressed | automation.service.ts, automation.detectors.ts | AutomationRule | Automation Centre |
| message_test_sent | automation-rules.service.ts | rule | Automation Centre |
| vendor_trial_ending | automation/vendor-trial-ending.ts | Vendor | Automation Centre |

## NOT EMITTED (do not build metrics on these)
cart_created, store_ready, delivery_configured, campaign_created/approved/launched/impression (merchant First Sale campaigns do not exist), store_viewed, product_viewed (public-store views live in AuditLog, not Event), automation_eligible, automation_clicked, referral_* / invitation_opened / reward_* (vendor referral not built), renewal_due, order_generated, community_buy_target_reached/target_failed/refund_started/fulfilled/completed, message_drafted/queued/delivered/failed/opened/clicked/opted_out.

Reason: these require either the unbuilt features above or per-site wiring into 20+ state-transition call sites (community-buy target/fulfilment), left unemitted rather than half-wired. Classification: handbook lists them as canonical names; acceptance of dashboards/attribution depends on them -> see `CODE_SIDE_BLOCKERS_CLOSED.md` (open items).
