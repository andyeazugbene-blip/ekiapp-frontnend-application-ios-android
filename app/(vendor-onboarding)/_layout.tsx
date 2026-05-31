import { Stack } from "expo-router";

export default function VendorOnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="otp" />
      <Stack.Screen name="setup-store" />
      <Stack.Screen name="business-info" />
      <Stack.Screen name="add-product" />
      <Stack.Screen name="delivery-intro" />
      <Stack.Screen name="delivery-countries" />
      <Stack.Screen name="delivery-uk" />
      <Stack.Screen name="delivery-us" />
      <Stack.Screen name="delivery-canada" />
      <Stack.Screen name="delivery-europe" />
      <Stack.Screen name="delivery-summary" />
      <Stack.Screen name="store-ready" options={{ presentation: "transparentModal", animation: "fade" }} />
    </Stack>
  );
}
