import React from "react";
import { StyleSheet, View } from "react-native";

const TOTAL_STEPS = 8;

interface OnboardingProgressProps {
  currentStep: number;
}

export default function OnboardingProgress({ currentStep }: OnboardingProgressProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <View
          key={i}
          style={[styles.dot, i < currentStep && styles.dotActive]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 6,
    marginTop: 18,
  },
  dot: {
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  dotActive: {
    backgroundColor: "#FFFFFF",
  },
});
