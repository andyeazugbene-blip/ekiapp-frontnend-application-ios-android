# End-to-end journeys

These scripts drive the real API against a throwaway database. Each one refuses to run unless `DATABASE_URL` points at `localhost:5544/eki_verify`, and those that touch payments also refuse anything but a Stripe test key. Don't remove those checks.

## Run them

1. Start the database, migrate and seed it, as in `../environment-guide.md`.
2. Start the backend on port 4177, with `DATABASE_URL` set to the local database and `PORT=4177`.
3. Run a journey with the same `DATABASE_URL`:

```bash
node docs/handover/journeys/e2e.cjs
```

The scripts look for the backend in a folder called `ekiapp-backend-main` beside this repository. If yours is elsewhere, set `EKI_BACKEND_DIR`.

Journeys create their own data, so a database that has already been used can give different results. Start from a fresh one if a result looks wrong.

## What each one covers

| Script | Covers |
|---|---|
| `e2e.cjs` | Full regression: sign-up, orders, payments, refunds, roles |
| `e2e_p1.cjs` | Phase 1: account, routing, Community Buy |
| `e2e_settings.cjs` | Launch settings |
| `e2e_entry.cjs` | Partner codes, guest browsing, web page |
| `e2e_ext.cjs` | Extension requests and supplier reconfirmation |
| `e2e_cb4.cjs` | Community Buy flags, notify me, receipts, operations |
| `e2e_rd5.cjs` | Regular Delivery: remove item, receipts, S58, S59 |
| `e2e_hb6.cjs` | Account close checks, dashboard state, automations |
| `e2e_a.cjs` | Subscription screens: offer steps, stock allocation, recheck, support cases |
| `e2e_b.cjs` | Supplier actions: CB65, CB67, CB69 |
| `e2e_c.cjs` | Growth: referrals, credit release and reversal, First Sale |
| `e2e_d.cjs` | Discovery, demand matching, recommendations |
| `e2e_e.cjs` | Events, Resend webhook, attribution. Needs `RESEND_WEBHOOK_SECRET` set to the local server's value |
| `e2e_hold.cjs` | Harness for two-stage payment. It doesn't replace a real Stripe Connect run |
| `seed_vendor_ui.cjs` | Creates a local vendor for checking screens |
