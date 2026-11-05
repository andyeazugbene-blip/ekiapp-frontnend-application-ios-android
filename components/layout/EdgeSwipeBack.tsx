import React, { useMemo } from "react";
import { Platform, View } from "react-native";
import { useRouter, useSegments } from "expo-router";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

/**
 * iOS swipe-back for screens that live inside a Tabs navigator. Tabs has no
 * native back gesture, so without this an iPhone user's left-edge swipe on a
 * detail screen does nothing. Screens with a visible tab bar are excluded:
 * they are destinations, not drill-downs.
 */
export function EdgeSwipeBack({
  tabScreens,
  children,
}: {
  tabScreens: readonly string[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const segments = useSegments() as string[];
  const current = segments[segments.length - 1] ?? "";
  const isDetailScreen = segments.length > 1 && !tabScreens.includes(current);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(isDetailScreen)
        .runOnJS(true)
        .hitSlop({ left: 0, width: 24 })
        .activeOffsetX(16)
        .failOffsetY([-24, 24])
        .onEnd((event) => {
          if (event.translationX > 70 && router.canGoBack()) router.back();
        }),
    [isDetailScreen, router],
  );

  if (Platform.OS !== "ios") return <>{children}</>;

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ flex: 1 }} collapsable={false}>{children}</View>
    </GestureDetector>
  );
}
