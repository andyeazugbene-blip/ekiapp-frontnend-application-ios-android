import React from "react";
import { useRouter } from "expo-router";
import DeliveryCountryForm from "../../components/vendor/DeliveryCountryForm";
import { goBackOrReplace } from "../../utils/navigation";

export default function DeliveryEuropeScreen() {
  const router = useRouter();

  return (
    <DeliveryCountryForm
      countryCode="EU"
      countryLabel="Europe"
      currencySymbol="€"
      title="Set Europe delivery"
      saveLabel="Save Europe Delivery"
      onSaved={(next) => router.push(next as any)}
      onBack={() => goBackOrReplace(router, "/(vendor-onboarding)/delivery-countries" as any)}
      afterCountry="Europe"
    />
  );
}
