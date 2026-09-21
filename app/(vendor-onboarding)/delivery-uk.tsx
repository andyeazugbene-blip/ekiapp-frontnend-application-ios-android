import React from "react";
import { useRouter } from "expo-router";
import DeliveryCountryForm from "../../components/vendor/DeliveryCountryForm";
import { goBackOrReplace } from "../../utils/navigation";

export default function DeliveryUKScreen() {
  const router = useRouter();
  return (
    <DeliveryCountryForm
      countryCode="UK"
      countryLabel="United Kingdom"
      currencySymbol="£"
      title="Set UK delivery"
      saveLabel="Save UK Delivery"
      onSaved={(next) => router.push(next as any)}
      onBack={() => goBackOrReplace(router, "/(vendor-onboarding)/delivery-countries" as any)}
      afterCountry="UK"
    />
  );
}
