import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

/**
 * Welcome screen — pixel-matched to the provided screenshot.
 *
 * Layout (top → bottom):
 *  • Top half: light-green gradient with a tilted 2×2 grid of marketing
 *    tiles (Create discount circle, Create bundle, Flash sale dark,
 *    Share store) and a floating white "Sales this month" card with a
 *    small green arc decoration on its left edge.
 *  • Bottom half: "Welcome to Eki" headline + body + Create Account
 *    (filled green) + Login (outline) + Change role link.
 */
export default function WelcomeScreen() {
  const router = useRouter();
  const { role, ref } = useLocalSearchParams<{ role?: string; ref?: string }>();
  const resolvedRole = role ?? "vendor";
  const alternateRole = resolvedRole === "buyer" ? "vendor" : "buyer";
  const otherRoleLabel = resolvedRole === "vendor" ? "Buyer" : "Vendor";
  const sharedParams = typeof ref === "string" && ref.trim() ? { ref } : {};

  const goCreate = () =>
    router.push({ pathname: "/(auth)/register", params: { role: resolvedRole, ...sharedParams } });
  const goLogin = () =>
    router.push({ pathname: "/(auth)/login", params: { role: resolvedRole, ...sharedParams } });
  const goSwitch = () =>
    router.replace({ pathname: "/(auth)/welcome", params: { role: alternateRole, ...sharedParams } });

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* ── Top hero with tilted tiles + floating card ─────────────────── */}
      <LinearGradient
        colors={["#A7E5C7", "#C8EAD7", "#E4F4EA", "#F4F9F5"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.hero}
      >
        <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
          {/* Tilted tile collage (decorative) */}
          <View pointerEvents="none" style={styles.tilesPlate}>
            <View style={styles.tilesRow}>
              {/* Round discount tile (left) */}
              <View style={[styles.tile, styles.discountTile]}>
                <View style={styles.discountInner}>
                  <Ionicons name="pricetag-outline" size={34} color="rgba(7,107,81,0.62)" />
                </View>
              </View>
              {/* Create bundle (right, dark green) */}
              <View style={[styles.tile, styles.tileDark]}>
                <View style={styles.tileCenterIcon}>
                  <Ionicons name="cube-outline" size={38} color="rgba(255,255,255,0.78)" />
                </View>
                <Text style={styles.tileLabelDark}>Create bundle</Text>
              </View>
            </View>
            <View style={styles.tilesRow}>
              {/* Flash sale (left, near-black) */}
              <View style={[styles.tile, styles.tileBlack]}>
                <View style={styles.tileCenterIcon}>
                  <Ionicons name="flash-outline" size={38} color="rgba(255,255,255,0.78)" />
                </View>
                <Text style={styles.tileLabelDark}>Flash sale</Text>
              </View>
              {/* Share store (right, mid green) */}
              <View style={[styles.tile, styles.tileMid]}>
                <View style={styles.tileCenterIcon}>
                  <Ionicons name="share-social-outline" size={38} color="rgba(255,255,255,0.78)" />
                </View>
                <Text style={styles.tileLabelDark}>Share store</Text>
              </View>
            </View>
          </View>

          {/* Floating "Sales this month" card */}
          <View style={styles.salesCard}>
            <View style={styles.salesIconWrap}>
              {/* Decorative quarter-arc on the upper-left of the icon */}
              <View style={styles.salesArc} />
              <View style={styles.salesIconCircle}>
                <Ionicons name="calendar-outline" size={20} color="#076B51" />
              </View>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.salesLabel}>Sales this month</Text>
              <Text style={styles.salesValue}>$2,160</Text>
              <Text style={styles.salesSub}>≈ ₦3,240,000</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* ── Bottom area ────────────────────────────────────────────────── */}
      <SafeAreaView edges={["bottom"]} style={styles.bottomWrap}>
        <Text style={styles.headline}>Welcome to Eki</Text>
        <Text style={styles.subhead}>Buy or sell African foodstuff with confidence</Text>

        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.86}
          onPress={goCreate}
          style={styles.primaryBtn}
        >
          <Text style={styles.primaryBtnText}>Create Account</Text>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.86}
          onPress={goLogin}
          style={styles.outlineBtn}
        >
          <Text style={styles.outlineBtnText}>Login</Text>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.7}
          onPress={goSwitch}
          style={styles.changeRoleBtn}
        >
          <Text style={styles.changeRoleText}>Change role - ({otherRoleLabel})</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },

  // ── Hero ─────────────────────────────────────────────────────────────
  hero: {
    height: "57%",
    overflow: "hidden",
  },

  // The plate that holds the 2×2 tile collage; tilted -8° + scaled up so
  // the edges of the tiles bleed past the screen sides.
  tilesPlate: {
    flex: 1,
    paddingTop: 28,
    transform: [{ rotate: "-8deg" }, { scale: 1.18 }, { translateX: -6 }],
  },
  tilesRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 14,
    marginBottom: 14,
  },

  // Generic tile shape
  tile: {
    flex: 1,
    height: 140,
    borderRadius: 26,
    overflow: "hidden",
  },
  tileCenterIcon: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 76,
    height: 76,
    marginTop: -38,
    marginLeft: -38,
    borderRadius: 38,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  tileLabelDark: {
    position: "absolute",
    bottom: 16,
    left: 16,
    fontSize: 17,
    fontFamily: "Manrope-Bold",
    color: "rgba(255,255,255,0.85)",
  },

  // Variants
  discountTile: {
    backgroundColor: "rgba(199,232,212,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  discountInner: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(255,255,255,0.62)",
    alignItems: "center",
    justifyContent: "center",
  },
  tileMid: { backgroundColor: "rgba(7,107,81,0.55)" },
  tileDark: { backgroundColor: "rgba(7,107,81,0.78)" },
  tileBlack: { backgroundColor: "#1F2A24" },

  // Floating "Sales this month" card
  salesCard: {
    position: "absolute",
    left: 22,
    right: 36,
    top: "30%",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    paddingVertical: 16,
    paddingLeft: 18,
    paddingRight: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 6,
  },
  salesIconWrap: {
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  // The quarter-circle arc behind the icon (matches the screenshot detail)
  salesArc: {
    position: "absolute",
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2.5,
    borderColor: "transparent",
    borderTopColor: "#076B51",
    borderLeftColor: "#076B51",
    transform: [{ rotate: "-30deg" }],
  },
  salesIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(7,107,81,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  salesLabel: {
    color: "#1A1A1A",
    fontSize: 15,
    fontFamily: "Manrope-SemiBold",
    textAlign: "center",
  },
  salesValue: {
    color: "#1A1A1A",
    fontSize: 26,
    fontFamily: "Manrope-ExtraBold",
    marginTop: 2,
    textAlign: "center",
  },
  salesSub: {
    color: "#9AA3A0",
    fontSize: 12,
    fontFamily: "Outfit-Regular",
    textDecorationLine: "line-through",
    marginTop: 2,
    textAlign: "center",
  },

  // ── Bottom area ──────────────────────────────────────────────────────
  bottomWrap: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 22,
    alignItems: "center",
  },
  headline: {
    fontSize: 28,
    fontFamily: "Manrope-ExtraBold",
    color: "#1A1A1A",
  },
  subhead: {
    fontSize: 13,
    fontFamily: "Outfit-Regular",
    color: "#858585",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 22,
  },

  primaryBtn: {
    width: "100%",
    height: 54,
    borderRadius: 14,
    backgroundColor: "#076B51",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  primaryBtnText: { color: "#FFFFFF", fontSize: 16, fontFamily: "Manrope-SemiBold" },

  outlineBtn: {
    width: "100%",
    height: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#076B51",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  outlineBtnText: { color: "#076B51", fontSize: 16, fontFamily: "Manrope-SemiBold" },

  changeRoleBtn: {
    marginTop: 14,
    paddingVertical: 6,
  },
  changeRoleText: {
    fontSize: 13,
    fontFamily: "Outfit-Medium",
    color: "#1A1A1A",
    textDecorationLine: "underline",
  },
});
