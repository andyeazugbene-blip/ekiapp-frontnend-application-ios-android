import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { StripeProvider } from "../components/providers/StripeProvider";
import { useAuthStore } from "../stores/authStore";
import { initMonitoring } from "../services/monitoring";
import "../global.css";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    "JosefinSans-Bold": require("../assets/fonts/JosefinSans-Bold.ttf"),
    "JosefinSans-Medium": require("../assets/fonts/JosefinSans-Medium.ttf"),
    "JosefinSans-Regular": require("../assets/fonts/JosefinSans-Regular.ttf"),
    "JosefinSans-SemiBold": require("../assets/fonts/JosefinSans-SemiBold.ttf"),
    "Manrope-Bold": require("../assets/fonts/Manrope-Bold.ttf"),
    "Manrope-ExtraBold": require("../assets/fonts/Manrope-ExtraBold.ttf"),
    "Manrope-Medium": require("../assets/fonts/Manrope-Medium.ttf"),
    "Manrope-Regular": require("../assets/fonts/Manrope-Regular.ttf"),
    "Manrope-SemiBold": require("../assets/fonts/Manrope-SemiBold.ttf"),
    "Outfit-Light": require("../assets/fonts/Outfit-Light.ttf"),
    "Outfit-Medium": require("../assets/fonts/Outfit-Medium.ttf"),
    "Outfit-Regular": require("../assets/fonts/Outfit-Regular.ttf"),
  });

  useEffect(() => {
    initMonitoring();
    useAuthStore.getState().checkAuth().catch(() => {});
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F4F4F4" }}>
        <ActivityIndicator size="small" color="#076B51" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <StripeProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(buyer)" />
            <Stack.Screen name="(vendor)" />
            <Stack.Screen name="(admin)" />
            <Stack.Screen name="terms" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="privacy" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="support" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="how-eki-works" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="vendor/subscription" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="(vendor-onboarding)" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="(vendor-verification)" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="store/[slug]" options={{ animation: "slide_from_right" }} />
          </Stack>
        </StripeProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
