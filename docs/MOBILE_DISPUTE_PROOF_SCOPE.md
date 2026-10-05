# Mobile dispute evidence / appeal and delivery proof: scope

Source handbook: `ITALIAN APP/You are right (1).md` (3724 lines). Line numbers below refer to that file.

## 1. What the handbook actually says

The handbook does **not** define buyer or vendor screens for order dispute evidence, appeals, or delivery proof for standard (marketplace) orders. Searching for Dispute, Report, delivery, proof, evidence, appeal and "Order issue" gives only:

| Line | Screen | What it says | Relevance |
|---|---|---|---|
| 961 | Screen 32, Paid Renewal Order (vendor, Regular Delivery) | `Button: Report a problem` | Entry point only. No destination screen is specified. |
| 1364 | Screen 54, Renewal Delivered (buyer, Regular Delivery) | `Button: Confirm delivery`, `Review your order`, `Report a problem` | Entry point only. No destination screen is specified. |
| 1517, 1537 | Screens 60 and 61 (admin) | `Button: Add evidence`, "Supporting evidence" field | Admin only. Out of scope for mobile buyer/vendor. |
| 2999 | Screen 122, Packing and Preparation (Community Buy supplier) | `Upload supporting photo or document` | Community Buy supplier fulfilment, not marketplace delivery proof. |
| 3074 | Admin Community Buy operations | "Supplier fulfilment issues" counter | Admin only. |
| 3282, 3344, 3376 | Screens 130/133 (admin) | "Disputes {number}", Community Buy support case with an Evidence field | Admin only. |
| 3523 | Section 11 Supplier-Order Rules | Supplier payment on hold until "fulfilment and dispute conditions are met" | Business rule for Community Buy; no UI. |

The handbook defines no copy, deadlines, appeal windows or evidence categories for buyer/vendor order disputes. The backend comments cite "Handbook 11 L453/454", but that citation does not match this file (line 3515 is "11. Supplier-Order Rules"). It probably refers to a different handbook revision, which I could not locate in the repo. This was not used to invent product rules.

Conclusion: the only handbook-required mobile surface is a **"Report a problem" entry point** on delivered/active Regular Delivery orders (lines 961, 1364). Everything else was built because the task asked for it against the existing backend endpoints. Copy there is neutral and functional, and no business rules were added. All rules (7-day appeal window, 5-day response deadline, who may appeal, closed-dispute behaviour) come from the backend responses and are enforced there; the app only reflects what the backend returns.

## 2. What was built

Endpoint to screen mapping:

| Endpoint | Used by |
|---|---|
| `POST /api/orders/:id/dispute` (now sends `type` and `claim`) | `app/(buyer)/report-issue.tsx`, the modal in `app/(buyer)/track-order.tsx` |
| `GET /api/disputes/order/:orderId`, `GET /api/disputes/:id` | `components/shared/DisputeCaseScreen.tsx`, via `app/(buyer)/dispute-detail.tsx` and `app/(vendor)/dispute-detail.tsx` |
| `POST /api/disputes/:id/evidence` (PHOTO, TEXT) | `DisputeCaseScreen` (add photo, add written evidence) |
| `POST /api/disputes/:id/messages` | `DisputeCaseScreen` (message thread) |
| `POST /api/disputes/:id/appeal` | `DisputeCaseScreen` (appeal modal, shown only when `appeal.canAppeal` and `yourRole` is in `appeal.allowedParties`) |
| `POST /api/uploads/request-url`, PUT presigned URL, `POST /api/uploads/complete` with category `dispute_evidence` / `delivery_proof` | `uploadService.uploadPrivateAsset` via `hooks/useAssetUpload.ts` |
| `POST` / `GET /api/vendors/me/orders/:id/delivery-proof` | `app/(vendor)/delivery-proof.tsx` |
| `GET /api/orders/:id/delivery-proof` | Delivery proof card in `app/(buyer)/track-order.tsx` |

Files added:
- `services/disputeService.ts` (API client and types, mirroring backend response shapes)
- `utils/disputeHelpers.ts` (pure helpers: labels, gating, error classification)
- `hooks/useAssetUpload.ts` (camera/library permission, pick, upload with progress, retry)
- `components/shared/DisputeCaseScreen.tsx`, `PhotoAttach.tsx`, `ScreenStates.tsx`, `DeliveryProofList.tsx`
- `app/(buyer)/dispute-detail.tsx`, `app/(vendor)/dispute-detail.tsx`, `app/(vendor)/delivery-proof.tsx`

Files changed: `services/uploadService.ts`, `services/orderService.ts`, `app/(buyer)/report-issue.tsx`, `app/(buyer)/track-order.tsx`, `app/(buyer)/orders.tsx`, `app/(vendor)/order-detail.tsx`, `app/(vendor)/orders.tsx`, and both `_layout.tsx` files (route registration).

Entry points:
- Buyer: My Orders ("View dispute" on disputed orders), Track Order ("View dispute" replaces "Open Dispute" once one exists), Report an issue (redirects to the dispute after submission; a 409 offers "View existing dispute").
- Vendor: Orders list, "Disputed" tab ("View Dispute"); Order Detail ("View Dispute", and "Delivery Proof" when status is dispatched, in transit or delivered).
- The vendor "dispute list" is the existing Disputed tab. The backend has no list endpoint for parties (only by order or by id).

States covered: loading, empty (no evidence, no messages, no proof), error with retry, offline/network error message, upload progress, upload failure with retry (the picked file is kept), permission denied for camera and library (with "Open settings" when it cannot be asked again), 404 friendly "not found" (the backend returns 404 for non-parties), 403 and 409 messages (a 409 triggers a resync), closed dispute (read-only banner, no composers), pull to refresh. Order numbers and party names are shown instead of raw IDs (report-issue previously showed the raw order ID).

Internal notes: never requested. The party endpoints omit them server-side.

## 3. What was not built, and why

- **Document (PDF) evidence upload.** The backend allows `DOCUMENT`/PDF, but the request was for photo and text. Existing PDF evidence is displayed as "Document attached".
- **SIGNATURE delivery proof.** It needs a signature-capture control that no existing component provides. Delivery proof supports DELIVERY_PHOTO, PICKUP_CONFIRMATION and NOTE.
- **Dispute timeline view.** The backend returns `timeline`; the screen shows evidence and messages, which carry the same information, and does not render the separate timeline.
- **Push-notification deep links** to the new dispute screens. The backend sends `disputeId`/`orderId` in notification data, but notification routing was not changed.
- **A dispute entry for non-escrow orders on Track Order.** The existing `canBuyerOpenDispute` gating (escrow only) was left unchanged. The Report an issue screen is unchanged in that respect and the backend decides eligibility.
- **Handbook "Report a problem" on Regular Delivery screens (lines 961, 1364).** These screens were not changed. The Regular Delivery flows were not part of this task; the buttons could be pointed at `report-issue` later.
- **Automated tests.** There is no test runner in `package.json` (no jest or similar), so none were added.

## 4. Verification performed

- `npx tsc --noEmit`: clean (exit 0).
- `npm run check:no-mock-data`, `check:no-screenshot-ui`, `check:tab-registration`: pass.
- `npx expo export --platform android`: succeeded (Hermes bundle produced) without credentials.
- Not verified: behaviour on a real device or simulator, the live upload flow against real storage, or the backend (read only, not run). Signed read URLs live about 5 minutes, so an image left open longer shows an "Unavailable" tile until the screen is refocused or refreshed.
