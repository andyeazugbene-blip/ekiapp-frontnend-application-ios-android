# Admin Web Panel - Culinary Tales Marketplace

Production-ready web admin panel for managing the marketplace.

## Features

- ✅ Admin authentication with role-based access control
- ✅ Dashboard with real-time metrics and charts
- ✅ Order management with refund capabilities
- ✅ Vendor approval/rejection/suspension
- ✅ User management
- ✅ Product listing
- ✅ Verification document review
- ✅ Dispute management
- ✅ Analytics and revenue tracking
- ✅ 2FA support for sensitive operations
- ✅ Responsive design

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **API**: REST API with typed services

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
cd admin-web
npm install
```

### Configuration

Create a `.env.local` file:

```env
NEXT_PUBLIC_API_URL=https://ekiapp-backend.vercel.app/api
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
npm run build
npm start
```

### Type Checking

```bash
npm run typecheck
```

### Linting

```bash
npm run lint
```

## Project Structure

```
admin-web/
├── src/
│   ├── app/                    # Next.js app router pages
│   │   ├── dashboard/          # Dashboard page
│   │   ├── orders/             # Orders management
│   │   ├── vendors/            # Vendor management
│   │   ├── users/              # User management
│   │   ├── products/           # Product listing
│   │   ├── verification/       # Document verification
│   │   ├── disputes/           # Dispute management
│   │   ├── analytics/          # Analytics & charts
│   │   ├── settings/           # Settings page
│   │   ├── login/              # Login page
│   │   └── forbidden/          # 403 page
│   ├── components/             # Reusable components
│   │   ├── AdminLayout.tsx     # Main admin layout
│   │   └── ProtectedRoute.tsx  # Auth guard
│   ├── contexts/               # React contexts
│   │   └── AuthContext.tsx     # Authentication context
│   ├── lib/                    # Core libraries
│   │   ├── api.ts              # API client
│   │   └── services/           # API service modules
│   │       ├── auth.api.ts
│   │       ├── admin.api.ts
│   │       ├── orders.api.ts
│   │       ├── vendors.api.ts
│   │       ├── users.api.ts
│   │       ├── products.api.ts
│   │       ├── verification.api.ts
│   │       └── disputes.api.ts
│   └── types/                  # TypeScript types
│       └── index.ts
├── .env.example                # Environment variables template
├── .env.local                  # Local environment (not in git)
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.mjs
```

## Authentication

### Login

- Navigate to `/login`
- Enter admin credentials
- Only users with `ADMIN` role can access the panel
- `BUYER` and `VENDOR` users are blocked with a 403 error

### Role Protection

All admin routes are protected by:
1. Authentication check (valid JWT token)
2. Role check (must be ADMIN)
3. Automatic redirect to `/login` if unauthenticated
4. Redirect to `/forbidden` if non-admin role

## API Integration

### Backend API

Base URL: `https://ekiapp-backend.vercel.app/api`

### Endpoints Used

- `POST /auth/login` - Admin login
- `GET /auth/me` - Get current user
- `GET /admin/dashboard` - Dashboard stats
- `GET /admin/analytics` - Analytics data
- `GET /admin/analytics/revenue` - Revenue series
- `GET /admin/orders` - List orders
- `GET /admin/orders/:id` - Order details
- `POST /admin/orders/:id/refund` - Issue refund
- `PATCH /admin/orders/:id/complete` - Complete order
- `GET /admin/vendors` - List vendors
- `PATCH /admin/vendors/:id/approve` - Approve vendor
- `PATCH /admin/vendors/:id/reject` - Reject vendor
- `PATCH /admin/vendors/:id/suspend` - Suspend vendor
- `PATCH /admin/vendors/:id/unsuspend` - Unsuspend vendor
- `GET /admin/users` - List users
- `GET /admin/products` - List products
- `GET /admin/verification-documents` - List verification docs
- `PATCH /admin/verification-documents/:id/review` - Review document
- `GET /admin/disputes` - List disputes

### Error Handling

- **400**: Validation errors
- **401**: Unauthenticated (redirects to login)
- **403**: Forbidden (shows 2FA modal or forbidden page)
- **404**: Not found
- **409**: Conflict (e.g., duplicate refund)
- **500**: Server error

### 2FA Support

Sensitive operations may require 2FA:
- Refunds
- Dispute resolution
- Verification document review
- Vendor suspension

When 2FA is required:
1. Backend returns `403` with `2FA_REQUIRED` code
2. Modal prompts for 2FA code
3. Code is sent in `x-2fa-code` header
4. Operation retries with code

## Security

- JWT tokens stored in `localStorage`
- Tokens cleared on logout or 401 errors
- No secrets or sensitive data exposed in UI
- Role-based access control enforced
- 2FA for destructive actions
- HTTPS-only API communication

## Deployment

### Vercel (Recommended)

```bash
npm run build
vercel --prod
```

### Environment Variables

Set in Vercel dashboard:
- `NEXT_PUBLIC_API_URL`

### Build Output

- Static pages pre-rendered where possible
- Dynamic pages use server-side rendering
- Optimized for production

## Testing

### Manual QA Checklist

- [ ] Admin can login
- [ ] Non-admin users blocked
- [ ] Dashboard loads with real data
- [ ] Orders page displays orders
- [ ] Order detail shows refund button
- [ ] Refund modal handles 2FA
- [ ] Vendors page shows vendors
- [ ] Vendor approval/rejection works
- [ ] Users page displays users
- [ ] Products page shows products
- [ ] Verification page lists documents
- [ ] Analytics page shows charts
- [ ] Settings page displays info
- [ ] Logout works correctly
- [ ] Build passes without errors

## Known Limitations

- Payouts page shows placeholder (backend endpoint not available)
- Some analytics fields may default to 0 if backend doesn't provide them
- Pagination not implemented (shows first 100 items)
- Search is client-side only

## Support

For issues or questions, contact the development team.

## License

Proprietary - Culinary Tales Marketplace
