import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { useAuthStore } from "../../stores/authStore";
import { formatDate, capitalize } from "../../utils/formatters";
import { AdminProfile } from "../../types/auth";

interface SettingRowProps {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  description?: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
}

function SettingRow({ icon, label, description, value, onPress, danger }: SettingRowProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      className="flex-row items-center px-4 py-4 border-b border-gray-50"
    >
      <View className={[
        "w-9 h-9 rounded-xl items-center justify-center mr-3",
        danger ? "bg-red-50" : "bg-primary-50",
      ].join(" ")}>
        <Ionicons name={icon} size={18} color={danger ? "#FB6363" : "#076B51"} />
      </View>
      <View className="flex-1 mr-2">
        <Text className={["text-sm font-semibold", danger ? "text-red-500" : "text-gray-800"].join(" ")}>
          {label}
        </Text>
        {description && (
          <Text className="text-xs text-muted mt-0.5">{description}</Text>
        )}
      </View>
      {value && <Text className="text-xs text-muted mr-2">{value}</Text>}
      {!danger && <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />}
    </TouchableOpacity>
  );
}

export default function AdminSettingsScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const admin = user as AdminProfile | null;
  const [signingOut, setSigningOut] = useState(false);

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out of the admin panel?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          setSigningOut(true);
          await logout();
          router.replace("/(auth)/role-select");
        },
      },
    ]);
  };

  const handleUnavailable = (title: string, message: string) => {
    Alert.alert(title, message);
  };

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View className="px-4 pt-4 pb-2">
          <Text className="text-xl font-bold text-gray-900">Settings</Text>
        </View>

        {/* Admin profile card */}
        <View className="mx-4 mt-2 bg-white rounded-2xl p-5 shadow-sm">
          <View className="flex-row items-center">
            <View className="relative">
              <Avatar name={admin?.name ?? "A"} size="lg" />
              <View className="absolute -bottom-1 -right-1 w-5 h-5 bg-primary-500 rounded-full items-center justify-center border-2 border-white">
                <Ionicons name="shield-checkmark" size={10} color="white" />
              </View>
            </View>
            <View className="ml-4 flex-1">
              <Text className="text-lg font-bold text-gray-900">{admin?.name ?? "Admin"}</Text>
              <Text className="text-sm text-muted">{admin?.email ?? ""}</Text>
              <View className="flex-row items-center mt-1.5">
                <Badge label="Administrator" variant="active" size="sm" dot />
                {admin?.createdAt && (
                  <Text className="text-[11px] text-muted ml-2">
                    Since {formatDate(admin.createdAt)}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Permissions */}
          {admin?.permissions && admin.permissions.length > 0 && (
            <View className="mt-4 pt-4 border-t border-gray-50">
              <Text className="text-xs font-bold text-muted uppercase tracking-wider mb-2">
                Permissions
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {admin.permissions.map((p) => (
                  <View key={p} className="bg-primary-50 rounded-full px-2.5 py-1">
                    <Text className="text-[11px] text-primary-500 font-semibold">
                      {capitalize(p)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Platform section */}
        <Text className="text-xs font-bold text-muted uppercase tracking-wider px-4 mt-6 mb-2">
          Platform
        </Text>
        <View className="mx-4 bg-white rounded-2xl overflow-hidden shadow-sm">
          <SettingRow
            icon="people-outline"
            label="User Management"
            description="View and manage all users"
            onPress={() => router.push("/(admin)/buyers")}
          />
          <SettingRow
            icon="storefront-outline"
            label="Vendor Approvals"
            description="Review pending vendor applications"
            onPress={() => router.push("/(admin)/vendors")}
          />
          <SettingRow
            icon="bar-chart-outline"
            label="Analytics & Reports"
            description="Platform-wide metrics and exports"
            onPress={() => router.push("/(admin)/analytics")}
          />
          <SettingRow
            icon="shield-outline"
            label="Resolution Centre"
            description="Review disputes and payment decisions"
            onPress={() => router.push("/(admin)/disputes" as any)}
          />
        </View>

        {/* Configuration section */}
        <Text className="text-xs font-bold text-muted uppercase tracking-wider px-4 mt-5 mb-2">
          Configuration
        </Text>
        <View className="mx-4 bg-white rounded-2xl overflow-hidden shadow-sm">
          <SettingRow
            icon="gift-outline"
            label="Reward Rules"
            description="Referral and spend-based buyer rewards"
            onPress={() => router.push("/(admin)/reward-rules" as any)}
          />
          <SettingRow
            icon="cash-outline"
            label="Payout Settings"
            description="Global payout rules and schedules"
            onPress={() => handleUnavailable("Payout settings unavailable", "Global payout configuration is only available in the web admin for now.")}
          />
          <SettingRow
            icon="mail-outline"
            label="Admin Communications"
            description="Send in-app and push broadcasts"
            onPress={() => router.push("/(admin)/create-message" as any)}
          />
          <SettingRow
            icon="card-outline"
            label="Seller Plans"
            description="Stripe web plans, commission tiers, limits, and withdrawal fees"
            onPress={() => router.push("/(admin)/seller-plans" as any)}
          />
          <SettingRow
            icon="information-circle-outline"
            label="App Version"
            value="v1.0.1"
            onPress={() => Alert.alert("App Version", "Eki mobile admin build v1.0.1")}
          />
        </View>

        {/* Sign out */}
        <View className="mx-4 mt-4 bg-white rounded-2xl overflow-hidden shadow-sm">
          <TouchableOpacity
            onPress={handleLogout}
            disabled={signingOut}
            className="flex-row items-center px-4 py-4"
            activeOpacity={0.75}
          >
            <View className="w-9 h-9 rounded-xl items-center justify-center mr-3 bg-red-50">
              {signingOut
                ? <ActivityIndicator size="small" color="#FB6363" />
                : <Ionicons name="log-out-outline" size={18} color="#FB6363" />
              }
            </View>
            <Text className="text-sm font-semibold text-red-500">Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
