import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Order, OrderStatus } from "../../types/order";
import { Badge } from "../ui/Badge";

interface OrderCardProps {
  order: Order;
  onPress?: () => void;
  perspective?: "buyer" | "vendor" | "admin";
}

const statusConfig: Record<
  OrderStatus,
  { label: string; variant: "success" | "warning" | "error" | "info" | "default" }
> = {
  pending: { label: "Pending", variant: "warning" },
  confirmed: { label: "Confirmed", variant: "info" },
  processing: { label: "Processing", variant: "info" },
  dispatched: { label: "Dispatched", variant: "info" },
  disputed: { label: "Disputed", variant: "error" },
  in_transit: { label: "In Transit", variant: "info" },
  delivered: { label: "Delivered", variant: "success" },
  cancelled: { label: "Cancelled", variant: "error" },
  refunded: { label: "Refunded", variant: "default" },
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  onPress,
  perspective = "buyer",
}) => {
  const cfg = statusConfig[order.status];
  const displayName =
    perspective === "buyer" ? order.vendorName : order.buyerName;
  const itemCount = order.items.reduce((s, i) => s + i.quantity, 0);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      className="bg-white rounded-2xl p-4 mb-3 shadow-sm"
    >
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1 mr-2">
          <Text className="text-xs text-gray-400 mb-0.5">{order.orderNumber}</Text>
          <Text className="text-sm font-semibold text-gray-900" numberOfLines={1}>
            {displayName}
          </Text>
        </View>
        <Badge label={cfg.label} variant={cfg.variant} size="sm" dot />
      </View>

      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Ionicons name="cube-outline" size={14} color="#858585" />
          <Text className="text-xs text-gray-500 ml-1">
            {itemCount} item{itemCount !== 1 ? "s" : ""} · {order.deliveryDetails.country}
          </Text>
        </View>
        <Text className="text-base font-bold text-primary-500">
          £{order.total.toFixed(2)}
        </Text>
      </View>

      <View className="flex-row items-center mt-2 pt-2 border-t border-gray-100">
        <Ionicons name="time-outline" size={12} color="#858585" />
        <Text className="text-xs text-gray-400 ml-1">{formatDate(order.createdAt)}</Text>
        <View className="flex-1" />
        <Ionicons name="chevron-forward" size={14} color="#858585" />
      </View>
    </TouchableOpacity>
  );
};
