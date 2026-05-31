# Eki App — Frontend

Expo React Native · TypeScript · Expo Router · NativeWind · Zustand

## Setup

```bash
npm install
npx expo start
```

## Project Structure

```
app/
  _layout.tsx          # Root layout (GestureHandler + Stack)
  index.tsx            # Auth redirect guard
  (auth)/              # Onboarding, Login, Register
  (buyer)/             # Tab layout: Home, Explore, Cart, Orders, Profile
  (vendor)/            # Tab layout: Dashboard, Orders, Foodstuff, Buyers, Earnings
  (admin)/             # Tab layout: Dashboard, Vendors, Orders, Buyers, Settings

components/
  ui/                  # Button, Badge, Card, Input, Avatar
  shared/              # ProductCard, VendorCard, OrderCard, AlertRow, SectionHeader
  layout/              # ScreenWrapper, PlaceholderScreen

constants/             # colors.ts, typography.ts, spacing.ts
types/                 # auth.ts, product.ts, order.ts, vendor.ts
services/              # mockData.ts + authService, productService, orderService, vendorService
stores/                # authStore, cartStore, orderStore, vendorStore (Zustand)
hooks/                 # useAuth.ts
utils/                 # formatters.ts
```

## Roles

| Role   | Entry point   | Credentials (dev)            |
|--------|---------------|------------------------------|
| Buyer  | `/(buyer)`    | buyer@example.com / password123  |
| Vendor | `/(vendor)`   | vendor@example.com / password123 |
| Admin  | `/(admin)`    | admin@ekiapp.com / password123   |

## Notes

- All lint errors about missing modules (`zustand`, `react-native`, `expo-router`, etc.)
  are pre-install and will resolve after `npm install`.
- Screens are placeholder stubs — full implementation follows in subsequent iterations.
