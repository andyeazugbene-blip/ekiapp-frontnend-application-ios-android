import React from "react";
import { useRouter } from "expo-router";
import DeliveryCountryForm from "../../components/vendor/DeliveryCountryForm";

export default function DeliveryCanadaScreen() {
  const router = useRouter();
  return (
    <DeliveryCountryForm
      countryCode="CA"
      countryLabel="Canada"
      currencySymbol="C$"
      title="Set Canada delivery"
      saveLabel="Save Canada Delivery"
      onSaved={(next) => router.push(next as any)}
      onBack={() => router.back()}
      afterCountry="Canada"
    />
  );
}
