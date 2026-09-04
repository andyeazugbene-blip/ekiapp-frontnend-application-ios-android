import { Alert } from "react-native";
import type { CurrencyMismatchError } from "../stores/cartStore";

/**
 * Eki doesn't mix currencies in one cart (a real business rule, not a
 * bug) — but the previous copy ("Your cart has USD items. Replace with
 * this EUR product?") rendered the currency code where an item count
 * belonged and never said what Replace actually does. Same dialog, used
 * identically from Home, Explore, Vendor Detail and Product Detail.
 */
export function showCurrencyMismatchAlert(error: CurrencyMismatchError, onReplaceCart: () => void): void {
  Alert.alert(
    "Different currency",
    `Your cart currently uses ${error.existing}.\nThis product is priced in ${error.incoming}.\n\nTo add it, you need to start a new ${error.incoming} cart. Your current ${error.existing} cart will be cleared.`,
    [
      { text: "Cancel", style: "cancel" },
      { text: "Start new cart", style: "destructive", onPress: onReplaceCart },
    ],
  );
}
