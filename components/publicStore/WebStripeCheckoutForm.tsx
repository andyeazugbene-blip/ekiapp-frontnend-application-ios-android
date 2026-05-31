import React from "react";
import { Text, View } from "react-native";

interface WebStripeCheckoutFormProps {
  amountLabel: string;
  disabled?: boolean;
  billingEmail: string;
  billingName: string;
  onBeforeConfirm: () => Promise<string>;
  onSuccess: (paymentId: string | null) => Promise<void>;
  onError: (message: string) => void;
}

export function WebStripeCheckoutForm(_props: WebStripeCheckoutFormProps) {
  return (
    <View
      style={{
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "#E7EAE8",
        backgroundColor: "#F7F8F7",
        padding: 16,
      }}
    >
      <Text style={{ color: "#687076", fontSize: 13, lineHeight: 19, fontFamily: "Outfit-Regular" }}>
        Card payments are available on the web storefront.
      </Text>
    </View>
  );
}
