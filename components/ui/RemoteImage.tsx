/**
 * RemoteImage — Renders an image from a backend URL with neutral fallback.
 * Use for product images, vendor avatars, user avatars.
 */
import React, { useEffect, useState } from "react";
import { Image, StyleSheet, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface RemoteImageProps {
  uri?: string | null;
  style?: ViewStyle;
  fallbackIcon?: React.ComponentProps<typeof Ionicons>["name"];
  fallbackColor?: string;
  fallbackBg?: string;
  borderRadius?: number;
}

export function RemoteImage({
  uri,
  style,
  fallbackIcon = "image-outline",
  fallbackColor = "#B0B0B0",
  fallbackBg = "#F0E6D4",
  borderRadius = 12,
}: RemoteImageProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  if (!uri || failed) {
    return (
      <View style={[styles.fallback, { backgroundColor: fallbackBg, borderRadius }, style]}>
        <Ionicons name={fallbackIcon} size={24} color={fallbackColor} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={[{ borderRadius, width: "100%", height: "100%" }, style] as any}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: "center",
    justifyContent: "center",
  },
});
