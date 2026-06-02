import React, { ReactNode, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";

const PROGRESS_STEPS = 8;

type HeaderProps = {
  title: string;
  subtitle?: string;
  activeSegments: number;
  /** Compact reduces vertical padding (used on the add-product step). */
  compact?: boolean;
};

type ButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
};

type OptionRowProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

/**
 * Top header band with green gradient, title (+ optional subtitle), and the
 * 8-segment progress indicator BELOW the title — exact match for the
 * screenshots. Only the bottom corners are rounded; the top is flush with
 * the device top edge.
 */
export function OnboardingHeader({
  title,
  subtitle,
  activeSegments,
  compact = false,
}: HeaderProps) {
  const { width } = useWindowDimensions();
  const isNarrow = width < 380;
  const isVeryNarrow = width < 350;
  const titleFontSize = compact
    ? isVeryNarrow
      ? 20
      : isNarrow
        ? 21
        : 22
    : isVeryNarrow
      ? 24
      : isNarrow
        ? 26
        : 28;
  const titleLineHeight = titleFontSize + (compact ? 5 : 6);

  return (
    <LinearGradient
      colors={["#0A8062", "#076B51"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.header, compact && styles.headerCompact]}
    >
      <SafeAreaView edges={["top"]}>
        <View
          style={[
            styles.headerBody,
            compact && styles.headerBodyCompact,
            isNarrow && styles.headerBodyNarrow,
          ]}
        >
          <Text
            style={[
              styles.headerTitle,
              compact && styles.headerTitleCompact,
              {
                fontSize: titleFontSize,
                lineHeight: titleLineHeight,
              },
            ]}
          >
            {title}
          </Text>
          {subtitle ? <Text style={[styles.headerSubtitle, isNarrow && styles.headerSubtitleNarrow]}>{subtitle}</Text> : null}
        </View>
        <View style={styles.progressRow}>
          {Array.from({ length: PROGRESS_STEPS }, (_, index) => (
            <View
              key={index}
              style={[
                styles.progressSegment,
                index < activeSegments && styles.progressSegmentActive,
              ]}
            />
          ))}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

/**
 * White card with TOP corners rounded only — matches the screenshots.
 */
export function FormCard({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[styles.formCard, style]}>{children}</View>;
}

export function PrimaryButton({ title, onPress, disabled }: ButtonProps) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.86}
      disabled={disabled}
      onPress={onPress}
      style={[styles.primaryButton, disabled && styles.disabled]}
    >
      <Text style={styles.primaryButtonText}>{title}</Text>
    </TouchableOpacity>
  );
}

export function OutlineButton({ title, onPress, disabled }: ButtonProps) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.86}
      disabled={disabled}
      onPress={onPress}
      style={[styles.outlineButton, disabled && styles.disabled]}
    >
      <Text style={styles.outlineButtonText}>{title}</Text>
    </TouchableOpacity>
  );
}

export function OptionRow({ label, selected, onPress }: OptionRowProps) {
  return (
    <TouchableOpacity
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      activeOpacity={0.78}
      onPress={onPress}
      style={[styles.optionRow, selected && styles.optionRowSelected]}
    >
      <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
        {selected ? <View style={styles.radioInner} /> : null}
      </View>
      <Text style={[styles.optionText, !selected && styles.optionTextMuted]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

export function SelectBox({
  label,
  value,
  options,
  onChange,
  placeholder,
  onPress,
  title,
  disabled,
}: {
  /** Display label when no value/options are provided (legacy mode). */
  label?: string;
  /** Currently selected value. */
  value?: string;
  /** Selectable options (renders a modal picker on tap). */
  options?: string[];
  /** Called with the picked value. */
  onChange?: (value: string) => void;
  /** Placeholder when nothing is selected. */
  placeholder?: string;
  /** Optional override for the modal title. */
  title?: string;
  /** Legacy: a custom onPress (used when caller manages its own picker). */
  onPress?: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const display = value ?? label ?? placeholder ?? "Select";
  const isPlaceholder = !value && !label;

  const handlePress = () => {
    if (disabled) return;
    if (onPress) {
      onPress();
      return;
    }
    if (options && options.length > 0) setOpen(true);
  };

  return (
    <>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled }}
        activeOpacity={0.76}
        disabled={disabled}
        onPress={handlePress}
        style={[styles.selectBox, disabled && { opacity: 0.6 }]}
      >
        <Text style={[styles.selectText, isPlaceholder && styles.selectPlaceholder]}>
          {display}
        </Text>
        <Ionicons name="chevron-down" size={20} color="#334653" />
      </TouchableOpacity>

      <Modal animationType="fade" transparent visible={open} onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalScrim} onPress={() => setOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={() => undefined}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{title || `Select ${label || "option"}`}</Text>
            <ScrollView style={styles.modalList} keyboardShouldPersistTaps="handled">
              {(options ?? []).map((opt) => {
                const selected = opt === value;
                return (
                  <TouchableOpacity
                    key={opt}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    activeOpacity={0.78}
                    onPress={() => {
                      onChange?.(opt);
                      setOpen(false);
                    }}
                    style={[styles.modalRow, selected && styles.modalRowSelected]}
                  >
                    <Text style={[styles.modalRowText, selected && styles.modalRowTextSelected]}>
                      {opt}
                    </Text>
                    {selected ? <Ionicons name="checkmark" size={18} color="#076B51" /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.86}
              onPress={() => setOpen(false)}
              style={styles.modalCancel}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

/**
 * Fake iOS-style status bar for full-screen designs that hide the real one.
 * Kept for compatibility with screens (publish-check, vendor order-detail)
 * that still render their own header chrome.
 */
export function FakeStatusBar() {
  return (
    <View style={styles.statusBar}>
      <Text style={styles.statusTime}>9:41</Text>
      <View style={styles.statusIcons}>
        <View style={styles.signalWrap}>
          {[8, 11, 14, 17].map((height, index) => (
            <View key={height} style={[styles.signalBar, { height, opacity: index === 0 ? 0.92 : 1 }]} />
          ))}
        </View>
        <Ionicons name="wifi" size={16} color="#FFFFFF" />
        <View style={styles.battery}>
          <View style={styles.batteryFill} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingBottom: 30,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: "hidden",
  },
  headerCompact: {
    paddingBottom: 22,
  },
  headerBody: {
    paddingHorizontal: 24,
    paddingTop: 18,
  },
  headerBodyNarrow: {
    paddingHorizontal: 20,
  },
  headerBodyCompact: {
    paddingTop: 12,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontFamily: "Manrope-Bold",
    fontSize: 28,
    lineHeight: 34,
    flexShrink: 1,
    maxWidth: "100%",
  },
  headerTitleCompact: {
    fontSize: 22,
    lineHeight: 28,
  },
  headerSubtitle: {
    color: "rgba(255,255,255,0.85)",
    fontFamily: "Outfit-Regular",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    flexShrink: 1,
  },
  headerSubtitleNarrow: {
    fontSize: 13,
    lineHeight: 18,
  },
  progressRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 22,
    paddingHorizontal: 24,
  },
  progressSegment: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  progressSegmentActive: {
    backgroundColor: "#FFFFFF",
  },

  formCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    marginTop: -18,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 24,
  },

  primaryButton: {
    height: 54,
    borderRadius: 14,
    backgroundColor: "#076B51",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontFamily: "Manrope-SemiBold",
    fontSize: 16,
  },
  outlineButton: {
    height: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#076B51",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  outlineButtonText: {
    color: "#076B51",
    fontFamily: "Manrope-SemiBold",
    fontSize: 16,
  },
  disabled: {
    opacity: 0.62,
  },

  optionRow: {
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "transparent",
    backgroundColor: "#F4F4F4",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  optionRowSelected: {
    borderColor: "#076B51",
    backgroundColor: "rgba(7,107,81,0.04)",
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#BEBEBE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  radioOuterSelected: {
    borderColor: "#076B51",
  },
  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#076B51",
  },
  optionText: {
    color: "#282828",
    fontFamily: "Manrope-SemiBold",
    fontSize: 14,
  },
  optionTextMuted: {
    color: "#858585",
  },

  fieldLabel: {
    color: "#858585",
    fontFamily: "Manrope-SemiBold",
    fontSize: 13,
    marginBottom: 8,
  },
  selectBox: {
    height: 50,
    borderRadius: 12,
    backgroundColor: "#F4F4F4",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectText: {
    color: "#282828",
    fontFamily: "Outfit-Regular",
    fontSize: 14,
  },
  selectPlaceholder: {
    color: "#858585",
  },

  // Picker modal
  modalScrim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.42)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 22,
    maxHeight: "70%",
  },
  modalHandle: {
    alignSelf: "center",
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E0E0E0",
    marginBottom: 12,
  },
  modalTitle: {
    color: "#1A1A1A",
    fontFamily: "Manrope-Bold",
    fontSize: 16,
    marginBottom: 12,
    paddingHorizontal: 6,
  },
  modalList: {
    maxHeight: 360,
  },
  modalRow: {
    minHeight: 50,
    paddingHorizontal: 14,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  modalRowSelected: {
    backgroundColor: "rgba(7,107,81,0.06)",
  },
  modalRowText: {
    color: "#1A1A1A",
    fontFamily: "Manrope-SemiBold",
    fontSize: 14,
  },
  modalRowTextSelected: {
    color: "#076B51",
  },
  modalCancel: {
    height: 50,
    borderRadius: 14,
    backgroundColor: "#F4F4F4",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  modalCancelText: {
    color: "#1A1A1A",
    fontFamily: "Manrope-SemiBold",
    fontSize: 14,
  },

  // Fake status bar (rarely used; kept for compatibility)
  statusBar: {
    height: 36,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusTime: {
    color: "#FFFFFF",
    fontFamily: "Manrope-ExtraBold",
    fontSize: 14,
  },
  statusIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  signalWrap: {
    width: 16,
    height: 18,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
  },
  signalBar: {
    width: 3,
    borderRadius: 1.5,
    backgroundColor: "#FFFFFF",
  },
  battery: {
    width: 22,
    height: 11,
    borderRadius: 3,
    borderWidth: 1.2,
    borderColor: "#FFFFFF",
    padding: 1.5,
  },
  batteryFill: {
    flex: 1,
    borderRadius: 1.5,
    backgroundColor: "#FFFFFF",
  },
});
