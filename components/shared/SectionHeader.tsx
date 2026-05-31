import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  actionLabel = "See all",
  onAction,
}) => (
  <View className="flex-row items-center justify-between mb-3">
    <View className="flex-1">
      <Text className="text-lg font-bold text-gray-900">{title}</Text>
      {subtitle && <Text className="text-xs text-gray-500 mt-0.5">{subtitle}</Text>}
    </View>

    {onAction && (
      <TouchableOpacity
        onPress={onAction}
        className="flex-row items-center"
        activeOpacity={0.7}
      >
        <Text className="text-sm font-semibold text-primary-500 mr-0.5">{actionLabel}</Text>
        <Ionicons name="chevron-forward" size={14} color="#076B51" />
      </TouchableOpacity>
    )}
  </View>
);
