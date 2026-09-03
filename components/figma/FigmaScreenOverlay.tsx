import React from "react";
import { Image, StyleSheet, useWindowDimensions, View } from "react-native";
import type { ImageSourcePropType } from "react-native";
import { useLocalSearchParams, useSegments } from "expo-router";
import { FIGMA_ROUTE_SCREENS } from "../../constants/figmaRouteScreens";

const FIGMA_PARITY_ENABLED = true;
const FIGMA_FRAME_WIDTH = 402;
const FIGMA_FRAME_RATIO = 874 / 402;

const GROUP_INDEX_ROUTES = new Set(["(buyer)", "(vendor)", "(admin)", "(vendor-verification)"]);

export function FigmaScreenOverlay() {
  const segments = useSegments() as string[];
  const params = useLocalSearchParams<{ role?: string | string[] }>();
  const routeScreens = FIGMA_ROUTE_SCREENS as Record<string, ImageSourcePropType>;
  const source = routeScreens[getRouteKey(segments, params.role)];
  const { width, height } = useWindowDimensions();

  if (!FIGMA_PARITY_ENABLED || !source) {
    return null;
  }

  const resolved = Image.resolveAssetSource(source);
  const frameWidth = Math.min(width, FIGMA_FRAME_WIDTH);
  const frameHeight =
    resolved?.width && resolved?.height ? frameWidth * (resolved.height / resolved.width) : frameWidth * FIGMA_FRAME_RATIO;

  return (
    <View pointerEvents="none" style={styles.overlay}>
      <View style={[styles.stage, { minHeight: height }]}>
        <Image source={source} resizeMode="stretch" style={{ width: frameWidth, height: frameHeight }} />
      </View>
    </View>
  );
}

function getRouteKey(segments: string[], role?: string | string[]) {
  const cleanSegments = segments.filter(Boolean);
  let routeKey = cleanSegments.length > 0 ? cleanSegments.join("/") : "index";

  if (GROUP_INDEX_ROUTES.has(routeKey)) {
    routeKey = `${routeKey}/index`;
  }

  const roleParam = Array.isArray(role) ? role[0] : role;
  if (routeKey === "(auth)/login" && roleParam === "admin") {
    return "(auth)/login?role=admin";
  }

  return routeKey;
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    backgroundColor: "#F4F4F4",
    elevation: 999,
    zIndex: 999,
  },
  stage: {
    alignItems: "center",
    backgroundColor: "#F4F4F4",
    width: "100%",
  },
});