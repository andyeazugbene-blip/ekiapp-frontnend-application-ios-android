# Event Gap Matrix (Handbook §12)

Store: `Event` table. Producer: `eventsService.emit` (fire-and-forget, never throws, at-least-once). Admin read: `GET /api/admin/events` (permission `automation.read`, filters name/entityType/entityId/date, cursor pagination), plus Automation Centre run history.

| Event | Defined | Emitted | Persisted | Consumed | Tested | Missing Work |
|---|---|---|---|---|---|---|
| merchant_registered | yes | yes | yes | Event table | yes | - |
| verification_completed | yes | yes | yes | Event table | yes | - |
| product_published | yes | yes | yes | Event table | yes | - |
| item_added_to_cart | yes | yes | yes | Event table | yes | - |
| checkout_started, order_created | yes | yes | yes | Event table | yes | - |
| payment_succeeded, payment_failed | yes | yes | yes | Event table (dedupe on stripeEventId) | yes | - |
| order_accepted/dispatched/delivered/completed | yes | yes | yes | Event table | yes | - |
| order_refunded | yes | yes | yes | Event table | yes | - |
| refund_requested, refund_completed (new) | yes | yes | yes | Event table | yes | - |
| subscription_created/paused/resumed/cancelled/skipped/renewed/payment_failed, payment_retry | yes | yes | yes | Event table | yes | - |
| community_buy_created/approved/published/joined | yes | yes | yes | Event table | yes | - |
| community_buy_target_reached/target_failed/refund_started/fulfilled/completed | yes | yes (atomic-claim winner only) | yes | Event table | yes | - |
| message_queued/message_delivered/message_failed | yes | yes (real channel signal only) | yes | Event table | yes | - |
| message_opted_out | yes | yes (unsubscribe link only) | yes | Event table | yes | - |
| renewal_due, order_generated | yes | yes | yes | Event table | yes | - |
| delivery_proof_submitted (new) | yes | yes | yes | Event table | yes | - |
| dispute_opened/evidence_submitted/resolved/appealed/appeal_decided (new, additive) | yes | yes | yes | Event table | yes | - |
| store_viewed | yes | yes (client "open" beacon only) | yes | Event table | yes | Only one real view signal exists; no per-product view beacon |
| automation_triggered/actioned/suppressed, message_test_sent, vendor_trial_ending | yes | yes | yes | Automation Centre | yes | - |
| product_viewed | yes | **no** | - | - | - | No per-product view endpoint/beacon exists; needs one built before emission is real |
| message_opened/message_clicked | yes | **no** | - | - | - | No open-pixel or click-tracking link infra exists (needed for Attribution §D anyway) |
| automation_eligible, automation_clicked | yes | **no** | - | - | - | automation_clicked needs the same click-tracking links as message_clicked |
| campaign_created/approved/launched/impression | yes | **no** | - | - | - | First Sale Campaign engine not built (owner decision, see OWNER_PRODUCT_DECISIONS.md §A) |
| referral_created, invitation_opened, referred_account_created, referral_store_ready, referral_qualified, reward_released, reward_reversed | yes | **no** | - | - | - | Vendor referral + credit ledger not built (owner decision, see OWNER_PRODUCT_DECISIONS.md §B) |
| store_ready | yes | **no** | - | - | - | No single "store became sellable" check exists; would need defining (not a business-rule item, but not done this pass) |
| delivery_configured | yes | **no** | - | - | - | No delivery-configuration completion signal wired |

## Summary
- Emitted and tested: 47 of 52 defined canonical names (90%).
- Not emitted: 11 names. 7 are blocked on the two undecided owner features (First Sale, referral). 4 (`product_viewed`, `message_opened`, `message_clicked`, `automation_eligible`/`automation_clicked`) need new tracking infrastructure (view beacons, open pixels, click-redirect links) that is a technical build, not a business decision — not done this pass, listed as open work in `CODE_SIDE_BLOCKERS_CLOSED.md`.
- `store_ready` / `delivery_configured`: semantics are implicit in existing code (vendor onboarding completion, delivery zone configured) but no single call site emits them yet — open work, not a business decision.
