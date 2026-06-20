import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { useAuthStore } from "../../stores/authStore";
import { VendorProfile } from "../../types/auth";

interface MenuEntry {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  route: string;
}

const MENU_ITEMS: MenuEntry[] = [
  { icon: "cart-outline", label: "Add foodstuff", route: "/(vendor)/foodstuff-add" },
  { icon: "car-outline", label: "Edit delivery", route: "/(vendor)/delivery" },
  { icon: "link-outline", label: "Share store", route: "/(vendor)/promo-link" },
  { icon: "eye-outline", label: "View orders", route: "/(vendor)/orders" },
  { icon: "cash-outline", label: "Withdraw payout", route: "/(vendor)/earnings" },
];

interface DrawerProps {
  visible: boolean;
  onClose: () => void;
}

function getGreeting(date: Date) {
  const h = date.getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

/**
 * Vendor side-menu — pixel-matched to the provided screenshot.
 *
 * Real data only:
 *  • Avatar  → useAuthStore().user.avatar
 *  • Name    → useAuthStore().user.name (first name only)
 *  • Greeting changes by device clock (Good Morning / Afternoon / Evening)
 *  • Active route highlight derived from usePathname()
 *  • Logout → useAuthStore().logout() (real backend call)
 *
 * Layout:
 *  • Wide left menu (figma_036) while the live dashboard shrinks and peeks on the right
 *  • Big translucent round close button on top-right
 *  • Active item has a translucent pill background; others are flat rows
 *  • Logout sits below a vertical gap to mirror the screenshot
 */
export function VendorDrawer({ visible, onClose }: DrawerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const vendor = user as VendorProfile | null;
  const insets = useSafeAreaInsets();
  const screenWidth = Dimensions.get("window").width;
  const drawerWidth = screenWidth * 0.72;

  const [mounted, setMounted] = useState(visible);
  const opacity = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(-32)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(slide, { toValue: 0, tension: 90, friction: 13, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(slide, { toValue: -32, duration: 180, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [opacity, slide, visible]);

  const greeting = useMemo(() => getGreeting(new Date()), [visible]);

  if (!mounted) return null;

  const firstName = vendor?.name?.split(" ")[0] || "Vendor";

  const navigate = (route: string) => {
    onClose();
    setTimeout(() => router.push(route as any), 180);
  };

  const handleLogout = async () => {
    onClose();
    await logout();
    router.replace("/(auth)/role-select" as any);
  };

  const matchedRoute = MENU_ITEMS.find((m) => {
    if (m.route === "/(vendor)") {
      return pathname === "/" || pathname === "/(vendor)" || pathname === "/vendor";
    }
    return pathname?.includes(m.route.replace("/(vendor)", ""));
  })?.route;
  const activeRoute = matchedRoute ?? MENU_ITEMS[0].route;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFillObject, { opacity }]}
    >
      {/* Solid green wash behind the panel only (drawer width). */}
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.panelWrap,
          { width: drawerWidth, transform: [{ translateX: slide }] },
        ]}
      >
        <LinearGradient
          colors={["#076B51", "#096F55", "#0B8E6B"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />

        <SafeAreaView edges={["top", "bottom"]} style={styles.panel}>
          {/* ── Header: avatar + greeting + close ─────────────────────── */}
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              {vendor?.avatar ? (
                <Image source={{ uri: vendor.avatar }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitial}>{firstName.charAt(0).toUpperCase()}</Text>
                </View>
              )}
            </View>
            <View style={styles.profileText}>
              <Text style={styles.greeting}>{greeting}</Text>
              <Text style={styles.name} numberOfLines={1}>
                {firstName}
              </Text>
            </View>
          </View>

          {/* ── Menu items ─────────────────────────────────────────────── */}
          <View style={styles.menuList}>
            {MENU_ITEMS.map((item) => {
              const isActive = item.route === activeRoute;
              return (
                <TouchableOpacity
                  key={item.label}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  activeOpacity={0.78}
                  onPress={() => navigate(item.route)}
                  style={[styles.menuItem, isActive && styles.menuItemActive]}
                >
                  <Ionicons name={item.icon} size={21} color="#FFFFFF" />
                  <Text style={styles.menuLabel}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Logout (extra spacing above) ───────────────────────────── */}
          <View style={styles.logoutWrap}>
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.78}
              onPress={handleLogout}
              style={styles.menuItem}
            >
              <Ionicons name="log-out-outline" size={21} color="#FFFFFF" />
              <Text style={styles.menuLabel}>Logout</Text>
            </TouchableOpacity>
          </View>

          <View style={{ flex: 1 }} />
        </SafeAreaView>
      </Animated.View>

      {/* Tap-outside-to-close (anywhere outside the drawer panel). */}
      <Pressable
        onPress={onClose}
        style={[
          styles.outsideTap,
          { left: drawerWidth },
        ]}
      />

      <TouchableOpacity
        accessibilityLabel="Close menu"
        accessibilityRole="button"
        activeOpacity={0.78}
        onPress={onClose}
        style={[styles.closeButton, { top: insets.top + 8 }]}
      >
        <Ionicons name="close" size={22} color="#FFFFFF" />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panelWrap: {
    flex: 1,
    overflow: "hidden",
  },
  panel: {
    flex: 1,
    paddingHorizontal: 20,
  },

  // ── Profile header ─────────────────────────────────────────────────
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 8,
    paddingRight: 8,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  avatarImage: { width: "100%", height: "100%" },
  avatarFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  avatarInitial: {
    color: "#FFFFFF",
    fontFamily: "Manrope-Bold",
    fontSize: 22,
  },
  profileText: {
    marginLeft: 12,
    flex: 1,
  },
  greeting: {
    color: "rgba(255,255,255,0.78)",
    fontFamily: "Outfit-Regular",
    fontSize: 13,
  },
  name: {
    color: "#FFFFFF",
    fontFamily: "Manrope-ExtraBold",
    fontSize: 26,
    marginTop: 2,
  },

  // Close button (absolute)
  closeButton: {
    position: "absolute",
    right: 16,
    zIndex: 5,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Menu list ──────────────────────────────────────────────────────
  menuList: {
    marginTop: 36,
    gap: 14,
  },
  menuItem: {
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  menuItemActive: {
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  menuLabel: {
    flex: 1,
    color: "#FFFFFF",
    fontFamily: "Manrope-SemiBold",
    fontSize: 17,
  },

  // ── Logout ─────────────────────────────────────────────────────────
  logoutWrap: { marginTop: 28 },

  // ── Outside tap area ───────────────────────────────────────────────
  outsideTap: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    zIndex: 2,
  },
});
