import { Stack } from "expo-router";

export default function VendorVerificationLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="upload-id" />
      <Stack.Screen name="face-scan" />
      <Stack.Screen name="upload-business" />
      <Stack.Screen name="pending" options={{ animation: "fade" }} />
      <Stack.Screen name="approved" options={{ animation: "fade" }} />
      <Stack.Screen name="rejected" />
    </Stack>
  );
}
