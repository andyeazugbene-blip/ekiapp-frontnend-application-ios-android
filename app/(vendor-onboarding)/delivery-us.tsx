import React from "react";
import { useRouter } from "expo-router";
import DeliveryCountryForm from "../../components/vendor/DeliveryCountryForm";

export default function DeliveryUSScreen() {
  const router = useRouter();
  return (
    <DeliveryCountryForm
      countryCode="US"
      countryLabel="United States"
      currencySymbol="$"
      title="Set US delivery"
      saveLabel="Save US Delivery"
      onSaved={(next) => router.push(next as any)}
      onBack={() => router.replace("/(vendor-onboarding)/delivery-countries" as any)}
      afterCountry="US"
    />
  );
}
