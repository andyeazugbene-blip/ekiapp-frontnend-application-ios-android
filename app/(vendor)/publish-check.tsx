import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { FakeStatusBar } from "../../components/onboarding/FigmaNativeUI";
import { goBackOrReplace } from "../../utils/navigation";

const CHECKS = [
  { label: "Image added", done: true },
  { label: "Price added", done: false },
  { label: "Weight added", done: false },
  { label: "Delivery set", done: true },
  { label: "Stock available", done: true },
];

export default function PublishCheckScreen() {
  const router = useRouter();
  const allDone = CHECKS.every((item) => item.done);

  return (
    <View style={styles.container}>
      <View style={styles.backdrop}>
        <LinearGradient
          colors={["#076B51", "#064A38"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.backdropHeader}
        >
          <FakeStatusBar />
        </LinearGradient>
        <View style={styles.backdropCard}>
          <View style={styles.fakeUpload} />
          <View style={styles.fakeField} />
          <View style={styles.fakeField} />
          <View style={styles.fakeRow}>
            <View style={styles.fakeHalf} />
            <View style={styles.fakeHalf} />
          </View>
          <View style={styles.fakeField} />
        </View>
      </View>
      <View style={styles.dim} />

      <View style={styles.modal}>
        <View style={styles.iconBadge}>
          <Ionicons name="warning-outline" size={29} color="#076B51" />
        </View>

        <Text style={styles.title}>Before This Foodstuff{"\n"}Goes Live</Text>
        <Text style={styles.subtitle}>Review the checklist to ensure a perfect listing.</Text>

        <View style={styles.checkList}>
          {CHECKS.map((check) => (
            <View key={check.label} style={styles.checkRow}>
              <Text style={styles.checkLabel}>{check.label}</Text>
              <View style={[styles.stateBadge, check.done ? styles.doneBadge : styles.missingBadge]}>
                <Ionicons
                  name={check.done ? "checkmark" : "close"}
                  size={13}
                  color={check.done ? "#076B51" : "#FF5F5F"}
                />
              </View>
            </View>
          ))}
        </View>

        <View style={styles.warningBox}>
          <Ionicons name="warning-outline" size={17} color="#FF5F5F" />
          <Text style={styles.warningText}>
            Set delivery and add weight before buyers can order this foodstuff
          </Text>
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={allDone ? 0.86 : 1}
          disabled={!allDone}
          onPress={() => goBackOrReplace(router, "/(vendor)/foodstuff-add" as any)}
          style={[styles.publishButton, !allDone && styles.publishDisabled]}
        >
          <Text style={styles.publishText}>Publish</Text>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.86}
          onPress={() => goBackOrReplace(router, "/(vendor)/foodstuff-add" as any)}
          style={styles.fixButton}
        >
          <Ionicons name="arrow-back" size={16} color="#076B51" />
          <Text style={styles.fixText}>Fix Missing Info</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F4F4",
  },
  backdrop: {
    flex: 1,
    opacity: 0.42,
  },
  backdropHeader: {
    height: 217,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
  },
  backdropCard: {
    flex: 1,
    marginTop: 20,
    marginHorizontal: 8,
    borderRadius: 32,
    backgroundColor: "#FFFFFF",
    padding: 30,
  },
  fakeUpload: {
    height: 150,
    borderRadius: 16,
    backgroundColor: "#E6F0ED",
    marginBottom: 32,
  },
  fakeField: {
    height: 55,
    borderRadius: 14,
    backgroundColor: "#F4F4F4",
    marginBottom: 28,
  },
  fakeRow: {
    flexDirection: "row",
    gap: 18,
    marginBottom: 28,
  },
  fakeHalf: {
    flex: 1,
    height: 55,
    borderRadius: 14,
    backgroundColor: "#F4F4F4",
  },
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.38)",
  },
  modal: {
    position: "absolute",
    left: 17,
    right: 17,
    top: 60,
    bottom: 60,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 38,
    paddingTop: 31,
  },
  iconBadge: {
    alignSelf: "center",
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: "#E6F0ED",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: {
    color: "#282828",
    fontFamily: "Manrope-Bold",
    fontSize: 17,
    lineHeight: 24,
    textAlign: "center",
  },
  subtitle: {
    color: "#858585",
    fontFamily: "Outfit-Regular",
    fontSize: 14,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 12,
    marginBottom: 30,
  },
  checkList: {
    gap: 16,
  },
  checkRow: {
    height: 50,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "#F4F4F4",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 16,
    paddingRight: 15,
  },
  checkLabel: {
    color: "#282828",
    fontFamily: "Manrope-Bold",
    fontSize: 14,
  },
  stateBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  doneBadge: {
    backgroundColor: "#DCEBE7",
  },
  missingBadge: {
    backgroundColor: "#FFEAEA",
  },
  warningBox: {
    minHeight: 56,
    borderRadius: 9,
    backgroundColor: "#FFEAEA",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    marginTop: 16,
  },
  warningText: {
    flex: 1,
    color: "#FF5F5F",
    fontFamily: "Outfit-Regular",
    fontSize: 14,
    lineHeight: 18,
    marginLeft: 12,
  },
  publishButton: {
    height: 60,
    borderRadius: 12,
    backgroundColor: "#076B51",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 15,
  },
  publishDisabled: {
    backgroundColor: "#BBD8D0",
  },
  publishText: {
    color: "#FFFFFF",
    fontFamily: "Manrope-SemiBold",
    fontSize: 17,
  },
  fixButton: {
    height: 60,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#076B51",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 15,
  },
  fixText: {
    color: "#076B51",
    fontFamily: "Manrope-SemiBold",
    fontSize: 16,
    marginLeft: 15,
  },
});
