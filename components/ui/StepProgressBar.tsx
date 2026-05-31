import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface StepProgressBarProps {
  current: number;
  total: number;
}

export const StepProgressBar: React.FC<StepProgressBarProps> = ({ current, total }) => {
  const pct = Math.min(current / total, 1);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.copy}>Step {current} of {total}</Text>
        <Text style={styles.copy}>{Math.round(pct * 100)}%</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%` }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 2,
    paddingBottom: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  copy: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 11,
    fontWeight: "700",
  },
  track: {
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#D8E9DF",
  },
});
