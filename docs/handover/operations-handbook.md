# Operations handbook (Handbook §17)

## Daily checks

| Where (admin) | Look for |
|---|---|
| Approvals | Anything overdue. Offers, Community Buys and extensions are all decided here |
| Community Buy operations (Community Campaigns) | At-risk campaigns, payment exceptions, refunds needing attention |
| Regular Delivery operations (Foodstuff Subscriptions) | Failed payments, payments under review, exceptions |
| Growth programmes | Referral credits due for release, First Sale Campaigns where checkouts aren't completing |
| Payment anomalies, Stripe disputes, Refunds | Anything new |
| Automation Center | Failed or paused rules |

## Recurring jobs

Everything runs from one Vercel cron, once a day at 12:00 UTC: `/api/internal/jobs/daily-sweep`. Each job can also be run alone at `/api/internal/jobs/<name>`, with `Authorization: Bearer <CRON_SECRET>`.

Jobs: `verification-proof-cleanup`, `event-outbox`, `notification-deliveries`, `run-scheduled-communications`, `automation-sweep`, `renewals-sweep`, `community-buy-sweep`, `community-buy-authorisation-sweep`, `privacy-expiry-sweep`, `escrow-sweep`, `escrow-balance-check`, `cart-cleanup`, `reconciliation-sweep`, `payment-anomaly-scan`, `fulfilment-delay-scan`, `order-unacknowledged-sweep`, `order-dispatch-due-sweep`, `community-buy-capture-pending-review-sweep`, `membership-capabilities-paused-sweep`, `push-receipt-check`, `support-retention-sweep`, `suspension-expiry`, `first-sale-campaign-sweep`, `demand-matching`, `demand-digest`, `vendor-trial-ending-events`.

A GitHub workflow (`automation-scheduler.yml`) also runs the time-sensitive jobs every 10 minutes, using the `CRON_SECRET` repository secret. It must match the Vercel value.

These jobs skip demo campaigns and demo subscriptions, so a demo can never be closed, charged or refunded, and its status stays as seeded.

## Health checks

| Route | Who | Returns |
|---|---|---|
| `GET /api/health` | Anyone | Whether the API is up |
| `GET /api/health/detailed` | Anyone | Each dependency's status, cached for 60 seconds. 503 if the database, Stripe or storage fails |
| `GET /api/health/detailed` with `Authorization: Bearer <CRON_SECRET>` | Operators | A fresh check with error text, latency and the Stripe mode |
| `GET /api/health/sentry-test` with the same header | Operators | Raises a test error in Sentry |

## Common recovery actions

| Situation | What to do |
|---|---|
| A renewal is stuck on "processing" | Foodstuff Subscriptions → the subscription → Renewal details → **Recheck provider**. It asks Stripe and applies the real outcome. It can't create a second order or charge a card |
| A failed renewal payment | Same place → Retry payment, within the retry limit |
| Stock can't cover every renewal | The vendor sees "Stock is limited" on their renewals tab and chooses. Support can open a case on the subscription |
| A supplier says stock is gone | The organiser is told automatically. Check the campaign's supplier inventory status, then decide on campaign controls |
| An extension request | Approvals. It can't be approved until an offer's supplier confirms. A supplier's "no" closes it |
| Closing an account | Users → Close account. Refused until open orders, disputes and unpaid payouts are resolved. Financial history is kept and the person is anonymised |
| A referral credit is due | Growth programmes → Release credit. **This adds a real Stripe balance credit.** Reverse takes back that referral's share on the next invoice |
| Stop First Sale messages | One campaign: Growth programmes → Stop. All new ones: Settings → Launch decisions |
| A Community Buy refund fails | Community refunds → requery or escalate |
| A Community Buy is disputed | Community Campaigns → the campaign → Mark as disputed, with a reason. Fulfilment carries on. Supplier and organiser money can't be released until you Resolve dispute |
| A participant reports a money or delivery problem | Their open case holds supplier and organiser money automatically. Close it in Community Support Cases to lift the hold |
| You need someone's email or phone | Open their record → Reveal contact details, with a reason. It's recorded in the audit log as `pii.reveal`. Lists and exports stay masked |
| A demo account needs test data | Users → the demo account → Fill demo data. It opens the supplier account and adds every Community Buy, supplier, order and subscription status. Running it again only adds what's missing. It's refused on a real account. New full-feature demo accounts get this automatically |
| Someone needs a receipt | They open it in the app. Links last 15 minutes, so ask them to open it again if it has expired |

## Escalation

Severity follows `known-issues.md`: Blocker, Critical, Major, Minor. Anything that may have moved money wrongly is Critical. Don't retry it until you've checked Stripe.
