import React from "react";
import { StyleSheet, View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "../../constants/colors";
import { FontFamily } from "../../constants/typography";

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightSlot?: React.ReactNode;
  /**
   * Full-bleed dark green hero header (Figma spec) that extends into the safe-area top.
   * Rounded bottom corners give it a banner feel.
   */
  children?: React.ReactNode;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  subtitle,
  onBack,
  rightSlot,
  children,
}) => (
  <SafeAreaView edges={["top"]} className="bg-primary-500">
    <View
      className="bg-primary-500 px-5 pt-2 pb-6"
      style={{ borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}
    >
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center flex-1">
          {onBack && (
            <TouchableOpacity
              onPress={onBack}
              className="w-9 h-9 rounded-full bg-white items-center justify-center mr-3"
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-back" size={18} color={Colors.primary.DEFAULT} />
            </TouchableOpacity>
          )}
          <View className="flex-1">
            <Text className="text-white" style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {subtitle && (
              <Text className="text-white/80 mt-0.5" style={styles.subtitle} numberOfLines={2}>
                {subtitle}
              </Text>
            )}
          </View>
        </View>
        {rightSlot}
      </View>
      {children}
    </View>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  title: {
    fontFamily: FontFamily.headingBold,
    fontSize: 24,
    letterSpacing: -0.4,
    lineHeight: 29,
  },
  subtitle: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    lineHeight: 20,
  },
});
