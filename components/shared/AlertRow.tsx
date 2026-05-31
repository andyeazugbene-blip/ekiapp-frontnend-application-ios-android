import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { DashboardAlert } from "../../types/vendor";

type AlertIcon = keyof typeof Ionicons.glyphMap;

const alertIconMap: Record<DashboardAlert["type"], AlertIcon> = {
  order_action: "receipt-outline",
  low_stock: "warning-outline",
  message: "chatbubble-outline",
  payout: "cash-outline",
};

interface AlertRowProps {
  alert: DashboardAlert;
  onPress?: () => void;
}

export const AlertRow: React.FC<AlertRowProps> = ({ alert, onPress }) => {
  const iconName = alertIconMap[alert.type];

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      className="flex-row items-center bg-white rounded-2xl px-4 py-3 mb-2 shadow-sm"
    >
      <View className="w-11 h-11 rounded-xl bg-primary-50 items-center justify-center mr-3">
        <Ionicons name={iconName} size={22} color="#076B51" />
      </View>

      <Text className="flex-1 text-sm font-medium text-gray-800">{alert.label}</Text>

      <View className="w-6 h-6 rounded-full bg-red-500 items-center justify-center mr-2">
        <Text className="text-white text-xs font-bold">{alert.count}</Text>
      </View>

      <View className="w-8 h-8 rounded-xl bg-primary-50 items-center justify-center">
        <Ionicons name="arrow-forward" size={16} color="#076B51" />
      </View>
    </TouchableOpacity>
  );
};
