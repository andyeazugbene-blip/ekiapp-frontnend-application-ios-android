import { Alert } from "react-native";

/**
 * Eki carries one cart per currency (not one cart total) — adding a product
 * priced in a different currency never fails and never clears anything, it
 * just makes that currency's cart the active one. This is a brief,
 * single-button, non-destructive notice about that switch (shown only when
 * a switch actually happened, not on every add), replacing the old blocking
 * "Different currency / Start new cart" dialog that used to destroy the
 * buyer's existing cart. Same notice, used identically from Home, Explore,
 * Vendor Detail and Product Detail.
 */
export function showCurrencySwitchNotice(previousCurrency: string, newCurrency: string): void {
  Alert.alert(
    "Switched cart",
    `Added to your ${newCurrency} cart. Your ${previousCurrency} cart is saved — switch back anytime from Cart.`,
  );
}
