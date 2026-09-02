import React from "react";
import { ActivityIndicator, StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

const HERO_BG = "#076B51";
const PAGE_BG = "#F4F4F4";

/**
 * Shared visual language for every "new feature" screen (Vendor Marketing,
 * Automation, Regular Deliveries, Community Buy). Extends the existing
 * PremiumHeader/FloatingCard/Pill kit already live on delivery-tracking.tsx
 * and plan-active.tsx — never a separate design system.
 */

export type Tone = "success" | "warning" | "error" | "info" | "neutral";

const TONE_COLORS: Record<Tone, { fg: string; bg: string }> = {
  success: { fg: "#076B51", bg: "rgba(7,107,81,0.10)" },
  warning: { fg: "#B48A00", bg: "rgba(255,197,0,0.16)" },
  error: { fg: "#D6552F", bg: "rgba(214,85,47,0.12)" },
  info: { fg: "#2E6957", bg: "#E8F4ED" },
  neutral: { fg: "#6A7B72", bg: "#F0F0F0" },
};

export function StatusPill({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  const c = TONE_COLORS[tone];
  return (
    <View style={[pillStyles.base, { backgroundColor: c.bg }]}>
      <Text style={[pillStyles.text, { color: c.fg }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const pillStyles = StyleSheet.create({
  base: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, maxWidth: 180 },
  text: { fontSize: 11, fontFamily: "Manrope-Bold" },
});

export function IconAvatar({
  icon,
  tone = "success",
  size = 44,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  tone?: Tone;
  size?: number;
}) {
  const c = TONE_COLORS[tone];
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: c.bg, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name={icon} size={Math.round(size * 0.46)} color={c.fg} />
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  style?: StyleProp<ViewStyle>;
}) {
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.88}
      style={[btnStyles.primary, isDisabled && btnStyles.disabled, style]}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" size="small" />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={16} color="#FFFFFF" style={{ marginRight: 8 }} /> : null}
          <Text style={btnStyles.primaryText}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

export function OutlineButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  tone = "success",
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  tone?: "success" | "error";
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  style?: StyleProp<ViewStyle>;
}) {
  const isDisabled = disabled || loading;
  const color = tone === "error" ? "#D6552F" : "#076B51";
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.88}
      style={[btnStyles.outline, { borderColor: color }, isDisabled && btnStyles.disabled, style]}
    >
      {loading ? (
        <ActivityIndicator color={color} size="small" />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={16} color={color} style={{ marginRight: 8 }} /> : null}
          <Text style={[btnStyles.outlineText, { color }]}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const btnStyles = StyleSheet.create({
  primary: { flexDirection: "row", minHeight: 52, borderRadius: 16, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  primaryText: { color: "#FFFFFF", fontSize: 14, fontFamily: "Manrope-Bold" },
  outline: { flexDirection: "row", minHeight: 48, borderRadius: 16, borderWidth: 1.5, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  outlineText: { fontSize: 13, fontFamily: "Manrope-Bold" },
  disabled: { opacity: 0.5 },
});

export function EmptyState({
  icon = "file-tray-outline",
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={emptyStyles.wrap}>
      <View style={emptyStyles.iconWrap}>
        <Ionicons name={icon} size={30} color="#076B51" />
      </View>
      <Text style={emptyStyles.title}>{title}</Text>
      {body ? <Text style={emptyStyles.body}>{body}</Text> : null}
      {actionLabel && onAction ? (
        <TouchableOpacity onPress={onAction} activeOpacity={0.86} style={emptyStyles.action}>
          <Text style={emptyStyles.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  wrap: { alignItems: "center", paddingVertical: 48, paddingHorizontal: 28, gap: 6 },
  iconWrap: { width: 64, height: 64, borderRadius: 20, backgroundColor: "#E7F2EB", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  title: { color: "#102118", fontSize: 15, fontFamily: "Manrope-Bold", textAlign: "center" },
  body: { color: "#6A7B72", fontSize: 13, lineHeight: 19, fontFamily: "Outfit-Regular", textAlign: "center", marginTop: 2 },
  action: { marginTop: 14, minHeight: 42, borderRadius: 14, borderWidth: 1.5, borderColor: "#076B51", paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  actionText: { color: "#076B51", fontSize: 13, fontFamily: "Manrope-Bold" },
});

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={emptyStyles.wrap}>
      <View style={[emptyStyles.iconWrap, { backgroundColor: "rgba(214,85,47,0.12)" }]}>
        <Ionicons name="alert-circle-outline" size={30} color="#D6552F" />
      </View>
      <Text style={emptyStyles.title}>Something went wrong</Text>
      <Text style={emptyStyles.body}>{message}</Text>
      <TouchableOpacity onPress={onRetry} activeOpacity={0.86} style={emptyStyles.action}>
        <Text style={emptyStyles.actionText}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

/** Loading centered within the current scroll/page area. */
export function LoadingBlock() {
  return (
    <View style={{ paddingVertical: 56, alignItems: "center" }}>
      <ActivityIndicator color="#076B51" />
    </View>
  );
}

/** Segmented progress bar for min/goal/max-style ranges — three zones, one fill. */
export function RangeProgressBar({
  value,
  min,
  goal,
  max,
}: {
  value: number;
  min: number;
  goal: number;
  max: number;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const minPct = max > 0 ? Math.min(100, (min / max) * 100) : 0;
  const goalPct = max > 0 ? Math.min(100, (goal / max) * 100) : 0;
  const reachedMin = value >= min;
  return (
    <View style={progressStyles.wrap}>
      <View style={progressStyles.track}>
        <View style={[progressStyles.fill, { width: `${pct}%`, backgroundColor: reachedMin ? "#076B51" : "#B48A00" }]} />
        <View style={[progressStyles.marker, { left: `${minPct}%` }]} />
        <View style={[progressStyles.marker, { left: `${goalPct}%` }]} />
      </View>
      <View style={progressStyles.labelsRow}>
        <Text style={progressStyles.labelText}>Min {min}</Text>
        <Text style={progressStyles.labelText}>Goal {goal}</Text>
        <Text style={progressStyles.labelText}>Max {max}</Text>
      </View>
    </View>
  );
}

const progressStyles = StyleSheet.create({
  wrap: { gap: 6 },
  track: { height: 10, borderRadius: 5, backgroundColor: "#EEF1EF", overflow: "hidden", position: "relative" },
  fill: { height: 10, borderRadius: 5 },
  marker: { position: "absolute", top: 0, bottom: 0, width: 2, backgroundColor: "rgba(16,33,24,0.28)" },
  labelsRow: { flexDirection: "row", justifyContent: "space-between" },
  labelText: { fontSize: 10, fontFamily: "Outfit-Medium", color: "#8AA194" },
});

export function PremiumHeader({
  title,
  subtitle,
  onBack,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <SafeAreaView edges={["top"]} style={{ backgroundColor: HERO_BG }}>
      <View style={styles.hero}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroTitleWrap}>
            {onBack ? (
              <TouchableOpacity onPress={onBack} activeOpacity={0.82} style={styles.backButton}>
                <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            ) : null}
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>{title}</Text>
              {subtitle ? <Text style={styles.heroSubtitle}>{subtitle}</Text> : null}
            </View>
          </View>
          {right}
        </View>
        {children}
      </View>
    </SafeAreaView>
  );
}

export function PremiumSectionTitle({
  title,
  action,
}: {
  title: string;
  action?: string;
}) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? <Text style={styles.sectionAction}>{action}</Text> : null}
    </View>
  );
}

export function FloatingCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Pill({
  label,
  dark = false,
}: {
  label: string;
  dark?: boolean;
}) {
  return (
    <View style={[styles.pill, dark && styles.pillDark]}>
      <Text style={[styles.pillText, dark && styles.pillTextDark]}>{label}</Text>
    </View>
  );
}

export const premiumStyles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  scrollContent: {
    paddingBottom: 128,
  },
  block: {
    marginTop: 22,
    paddingHorizontal: 16,
  },
});

const styles = StyleSheet.create({
  hero: {
    backgroundColor: HERO_BG,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroTitleWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 28,
    lineHeight: 32,
    fontFamily: "Manrope-Bold",
  },
  heroSubtitle: {
    marginTop: 4,
    color: "rgba(255,255,255,0.72)",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Outfit-Medium",
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: "#12221A",
    fontSize: 20,
    fontFamily: "Manrope-ExtraBold",
  },
  sectionAction: {
    color: "#2E6957",
    fontSize: 13,
    fontFamily: "Manrope-Bold",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 30,
    padding: 16,
    shadowColor: "#282828",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
  },
  pill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#E8F4ED",
  },
  pillDark: {
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  pillText: {
    color: "#2E6957",
    fontSize: 11,
    fontFamily: "Manrope-Bold",
  },
  pillTextDark: {
    color: "#FFFFFF",
  },
});
