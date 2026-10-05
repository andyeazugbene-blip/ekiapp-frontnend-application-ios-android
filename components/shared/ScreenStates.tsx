import React from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ClassifiedFailure } from "../../utils/disputeHelpers";

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <View style={styles.block} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator color="#076B51" />
      <Text style={styles.body}>{label}</Text>
    </View>
  );
}

const ICON: Record<ClassifiedFailure["kind"], React.ComponentProps<typeof Ionicons>["name"]> = {
  offline: "cloud-offline-outline",
  not_found: "search-outline",
  forbidden: "lock-closed-outline",
  auth: "log-in-outline",
  conflict: "alert-circle-outline",
  other: "alert-circle-outline",
};

/** Full-section failure view with retry. Not-found and forbidden are final, so retry is hidden for them. */
export function FailureState({
  failure,
  onRetry,
  actionLabel,
  onAction,
}: {
  failure: ClassifiedFailure;
  onRetry?: () => void;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const retryable = failure.kind !== "not_found" && failure.kind !== "forbidden";
  return (
    <View style={styles.block}>
      <Ionicons name={ICON[failure.kind]} size={44} color="#858585" />
      <Text style={styles.title}>
        {failure.kind === "offline" ? "You are offline" : failure.kind === "not_found" ? "Not found" : failure.kind === "forbidden" ? "No access" : "Something went wrong"}
      </Text>
      <Text style={styles.body}>{failure.message}</Text>
      {retryable && onRetry ? (
        <TouchableOpacity onPress={onRetry} activeOpacity={0.85} style={styles.button} accessibilityRole="button" accessibilityLabel="Try again">
          <Text style={styles.buttonText}>Try again</Text>
        </TouchableOpacity>
      ) : null}
      {actionLabel && onAction ? (
        <TouchableOpacity onPress={onAction} activeOpacity={0.85} style={styles.linkButton} accessibilityRole="button">
          <Text style={styles.linkText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { paddingVertical: 60, paddingHorizontal: 28, alignItems: "center", gap: 10 },
  title: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#282828", marginTop: 8 },
  body: { fontSize: 13, lineHeight: 19, fontFamily: "Outfit-Regular", color: "#687076", textAlign: "center" },
  button: { marginTop: 12, height: 44, borderRadius: 12, backgroundColor: "#076B51", paddingHorizontal: 24, alignItems: "center", justifyContent: "center" },
  buttonText: { fontSize: 14, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  linkButton: { marginTop: 6, paddingVertical: 8 },
  linkText: { fontSize: 14, fontFamily: "Manrope-SemiBold", color: "#076B51" },
});
