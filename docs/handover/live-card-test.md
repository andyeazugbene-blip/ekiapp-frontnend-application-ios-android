# Live card hold test

Community Buy has a second payment mode: verified card holds. It has been tested with a harness, but never against real Connect, because that needs a real hold on a real card. **This test moves real money.** The owner runs it, with their own card.

It covers known issue K12. The UK stays on pledge mode until this passes.

## What it costs

- The hold, and later the charge, on your card. Use the smallest price you can.
- Stripe's processing fee on the charge. Stripe may not return it when the payment is refunded.

## Before you start

1. Use real accounts, not demo accounts. Background jobs skip demo accounts, so holds would never be placed or captured on one.
2. You need three accounts: a supplier, an organiser and a buyer.
3. The supplier must finish Stripe Connect onboarding, because holds are placed on the supplier's connected account.

## Steps

1. In Admin → Community Buy markets → United Kingdom, set the payment mode to **Authorise then capture**. **Only new campaigns use this.** Live campaigns stay on pledges, but any other organiser's new campaign would use holds until you switch back in step 10, so do this at a quiet time.
2. As the supplier, publish a bulk offer at the smallest price, with a minimum of 1. Approve it in Admin → Approvals.
3. As the organiser, create a campaign from that offer with a goal of 1 and a deadline about 24 hours away. Holds start 48 hours before the deadline, so joining inside that window places the hold straight away. Approve it if it needs review.
4. As the buyer, join with your own card.
5. Check that the hold worked:
   - The app shows your card as held, and your banking app shows a pending amount.
   - In Stripe → Connected accounts → the supplier → Payments, the payment is **Uncaptured** for the full amount.
6. Wait for the deadline, plus the organiser's decision time if the campaign is below its minimum. The scheduler runs every 10 minutes.
7. Check that the capture worked:
   - Stripe shows the payment as **Succeeded**.
   - Your card shows the charge, once and for the right amount.
   - Admin → Community Campaigns shows the contribution as paid.
8. In Community Campaigns, open the contribution and press **Recheck provider**. It should agree with Stripe.
9. Refund it from Admin → Community refunds. Check Stripe, your card and the ledger.
10. **Set the UK back to its pledge mode,** unless you've decided to launch on holds.

## If something goes wrong

- Hold doesn't appear: check `GET /api/health/detailed`, and the supplier's onboarding status in Stripe.
- Hold is stuck: cancel the campaign. Holds are released, and a hold that's never captured expires on its own, usually within 7 days.
- Don't retry anything that may have moved money until you've checked Stripe. Treat it as Critical in `known-issues.md`.

## After it passes

Write the date and the result under K12 in `known-issues.md`. Moving the UK to holds for good is an owner decision, and it isn't part of any deploy.
