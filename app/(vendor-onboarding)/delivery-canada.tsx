import React from "react";
import { useRouter } from "expo-router";
import DeliveryCountryForm from "../../components/vendor/DeliveryCountryForm";
import { goBackOrReplace } from "../../utils/navigation";

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
      onBack={() => goBackOrReplace(router, "/(vendor-onboarding)/delivery-countries" as any)}
      afterCountry="Canada"
    />
  );
}
