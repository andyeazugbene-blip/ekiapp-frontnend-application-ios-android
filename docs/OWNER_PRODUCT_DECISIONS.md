# Owner Product Decisions (blocking activation)

Nothing here has been decided by engineering. No value, amount, window or rule below is implemented. "Recommended" marks the lowest-risk option for activation, not a business choice made on your behalf. Fill the last column; engineering then builds exactly that.

Classification key: **PD** product decision required - **TD** technical decision (engineering default, no business policy) - **MC** manual production configuration - **LV** live verification.

Already in the codebase and NOT blocked: a `FIRST_SALE` automation *nudge* (daily sweep: verified, unsuspended vendor with an active product and no paid order -> reminder, 7-day frequency cap, stops at first paid order) and a **buyer** `Referral` model (fixed `bonusAmount`, one referral per referred user). Handbook screen 09 (First Sale Campaign: "Start campaign", status Not started/Active/Completed, 4 guided steps) and screen 13 (Referrals: "New-buyer reward", "Minimum qualifying order", "qualifies only after the new buyer's first order is paid and completed") are the only handbook text; they name fields but give no values.

## A. First Sale Campaign Engine

| Feature | Decision Needed | Options | Recommended Option | Class | Owner Decision |
|---|---|---|---|---|---|
| Qualification | Which vendors may start the campaign | A) any vendor with 0 paid orders. B) A + store-ready checks (verified identity, Stripe payout-ready, >=1 active product, delivery configured). C) invite-only | B (matches the existing nudge preconditions) | PD | |
| First-sale definition | What counts as "first completed order" | A) first order reaching PAID. B) first order DELIVERED/COMPLETED. C) first COMPLETED and not refunded/disputed within N days | C (handbook says "completed"; N is yours) | PD | |
| Time window | Campaign length | A) none (until first sale). B) fixed days from start (state N). C) until trial end | B or C | PD | |
| Introductory offer type | What the "introductory offer" is | A) fixed-amount discount funded by vendor. B) % discount funded by vendor. C) Eki-funded credit to buyer. D) free delivery. E) no monetary offer (guided checklist only) | E for launch (no money moves) | PD | |
| Offer amount | Value / cap per order, per campaign | state amount or %, currency | none recommended | PD | |
| Funding | Who pays for the offer | vendor / Eki / split | vendor | PD | |
| Expiry | When the offer and campaign stop | fixed date, first sale, N days after start | first sale or N days | PD | |
| Maximum reward | Total cost cap per vendor and platform-wide | state caps | none recommended | PD | |
| Exclusions | Who is excluded | suspended; closed; sandbox/test; vendors re-registered after closure; self-purchase; same payment fingerprint as vendor | all listed | PD | |
| Fraud / abuse | Controls | A) block buyer==vendor owner. B) A + same Stripe payment-method fingerprint / device / address. C) B + manual admin review before reward | C | PD | |
| Idempotency, audit, kill-switch | One campaign per vendor, audited start/stop, admin disable | engineering default | as stated | TD | accepted by default |
| Campaign status storage / events (`campaign_created/launched`) | Table + events once rules exist | engineering | build after decisions | TD | |

## B. Vendor Referral Programme

| Feature | Decision Needed | Options | Recommended Option | Class | Owner Decision |
|---|---|---|---|---|---|
| Who can refer | Referrer | A) vendors only. B) buyers only (exists today). C) both | A (handbook "Reward buyers who introduce new customers to your store" is vendor-funded) | PD | |
| Referral subject | What is referred | A) new buyer to a vendor's store. B) new vendor to Eki. C) both | A per handbook screen 13 | PD | |
| Qualification | When a referral qualifies | A) referred buyer's first order PAID. B) first order COMPLETED (handbook wording). C) B and not refunded in N days | C (N is yours) | PD | |
| Minimum order | Minimum qualifying order value | state amount per currency / none | none recommended | PD | |
| Reward type | What is given | A) fixed credit. B) percentage credit. C) subscription discount. D) none | none recommended | PD | |
| Reward recipient | Who gets it | referrer / referred / both | per handbook "new-buyer reward": referred buyer | PD | |
| Reward amount / cap | Per referral and lifetime per referrer | state | none recommended | PD | |
| Reward timing | When released | immediately on qualification / after N-day hold / manual admin approval | N-day hold | PD | |
| Cancellation / refund | If the qualifying order is refunded | reverse reward / reverse only if before release / never reverse | reverse (a `reward_reversed` event exists in the canonical list) | PD | |
| Fraud prevention | Controls | self-referral block; same device/payment fingerprint/address; per-referrer velocity cap; admin review | all | PD | |
| Credit ledger behaviour | Where credit lives and what it can pay for | A) wallet balance (existing `Wallet`). B) separate non-withdrawable credit ledger. C) subscription-fee offset | B (append-only ledger, cannot be withdrawn) | PD | |
| Credit expiry | Does credit expire | none / N months | state | PD | |
| Ledger mechanics (append-only entries, idempotency key per referral, balance = sum, audit) | invariants | engineering | as stated | TD | accepted by default |
| Legal/tax treatment of credit | Are credits taxable/regulated in each market | counsel | - | MC | |

## C. State-aware Vendor Dashboard

Backend already derives these inputs: Stripe Connect readiness (`NOT_STARTED / PENDING / REQUIREMENTS_DUE / RESTRICTED / VERIFIED`, pending-on provider or vendor), identity state, vendor subscription lifecycle (trial / active / past due / cancelled, from the 14-day trial), suspension, market availability.

| Feature | Decision Needed | Options | Recommended Option | Class | Owner Decision |
|---|---|---|---|---|---|
| Exact vendor states | Final list and precedence when several apply | A) one primary state by priority (suggested order: closed > suspended > identity needed > payout setup needed > requirements due > market unavailable > trial ending > ready). B) multiple stacked banners | A with stacked secondary banners | PD | |
| Required action per state | CTA label and destination for each state | use handbook copy where it exists; owner supplies the rest | - | PD | |
| Payment-readiness messaging | Wording; can vendor list products / receive orders before payout-ready | A) block listing. B) allow listing, block ordering. C) allow all, warn | B (current server gate is off by default; switch exists) | PD | |
| Subscription / trial messaging | Wording and thresholds | days-before-trial-end to warn (state N) | N=3 | PD | |
| Onboarding states | Step names and order | owner supplies | - | PD | |
| Verification states | Wording for Stripe-managed states | use derived states above | as derived | TD | |
| Blocked states | Suspended / closed copy and appeal route | owner supplies | - | PD | |
| Market availability states | Copy when vendor's market not open for payments | owner supplies | - | PD | |
| Implementation | Add `state` + `nextAction` to `GET /vendor/dashboard` (additive) | engineering | build after copy approved | TD | |

## D. Attribution Metrics

Handbook screen 08 shows "Sales influenced, Carts recovered, Buyers brought back, Reviews requested". Honest-metrics rule in force: no incremental-lift claims.

| Feature | Decision Needed | Options | Recommended Option | Class | Owner Decision |
|---|---|---|---|---|---|
| Attribution source | What counts as a touch | A) message delivered. B) message opened. C) link clicked | C (open tracking is unreliable) | PD | |
| Window | Days from touch to order | state N (e.g. per automation type) | N per automation | PD | |
| First vs last touch | Which touch gets the order | first / last / linear | last | PD | |
| Campaign attribution | Does a First Sale/offer campaign claim the order | yes / no | yes if offer code used | PD | |
| Referral attribution | Order from referred buyer attributed to referral | yes / no, for how long | yes for qualifying order only | PD | |
| Metric label | "Sales influenced" naming | keep / rename "Automation-assisted sales" | rename (no causal claim) | PD | |
| Event requirements | Needs `message_delivered`, `message_clicked` (click tracking links), `order_*`, `payment_succeeded` | engineering | click tracking must be built after source decision | TD | |
| Reporting dimensions | Vendor, automation type, market, period, currency | engineering | as listed, per-currency never summed | TD | accepted by default |

## E. Other items (non-business)
| Item | Class |
|---|---|
| Overdue-dispute proactive processing | TD (decided in code report; no new cron - single daily sweep only) |
| S3 signed URLs for evidence/proof | LV |
| Stripe webhook endpoints/events registration | MC |
| Preview vs Production database split | MC |
| Resend domain, Expo push credentials | MC then LV |
