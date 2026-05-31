import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { VendorSummary } from "../../types/vendor";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

interface VendorCardProps {
  vendor: VendorSummary;
  onPress?: () => void;
  variant?: "buyer" | "admin";
  onApprove?: () => void;
  onReject?: () => void;
}

export const VendorCard: React.FC<VendorCardProps> = ({
  vendor,
  onPress,
  variant = "buyer",
  onApprove,
  onReject,
}) => {
  const statusVariant = vendor.adminStatus === "active"
    ? "active"
    : vendor.adminStatus === "suspended"
    ? "suspended"
    : "pending";

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      className="bg-white rounded-2xl p-4 mb-3 shadow-sm"
    >
      <View className="flex-row items-center">
        <Avatar
          uri={vendor.avatar}
          name={vendor.storeName}
          size="md"
        />

        <View className="flex-1 ml-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-semibold text-gray-900 flex-1 mr-2" numberOfLines={1}>
              {vendor.storeName}
            </Text>
            <Badge
              label={vendor.adminStatus.charAt(0).toUpperCase() + vendor.adminStatus.slice(1)}
              variant={statusVariant}
              size="sm"
              dot
            />
          </View>

          <Text className="text-sm text-gray-500 mt-0.5">
            {vendor.ownerName}
          </Text>
          <Text className="text-xs text-gray-400 mt-0.5">
            {vendor.city}, {vendor.country}
          </Text>

          {variant === "buyer" && vendor.rating > 0 && (
            <View className="flex-row items-center mt-1">
              <Ionicons name="star" size={12} color="#F59E0B" />
              <Text className="text-xs text-gray-600 ml-1">
                {vendor.rating.toFixed(1)} · {vendor.totalProducts} products
              </Text>
            </View>
          )}
        </View>
      </View>

      {variant === "admin" && vendor.adminStatus === "pending" && (
        <View className="flex-row mt-3 gap-x-3">
          <View className="flex-1">
            <Button
              title="Reject"
              variant="danger"
              size="sm"
              fullWidth
              onPress={onReject}
            />
          </View>
          <View className="flex-1">
            <Button
              title="Approve"
              variant="primary"
              size="sm"
              fullWidth
              onPress={onApprove}
            />
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
};
