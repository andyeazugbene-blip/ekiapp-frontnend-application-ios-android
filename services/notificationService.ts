/**
 * Notification and push-token service.
 */
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { apiClient } from "./api";

const isExpoGo = Constants.appOwnership === "expo";

export interface AppNotification {
  id: string;
  type: "order" | "message" | "payout" | "stock" | "verification" | "system";
  title: string;
  body: string;
  read: boolean;
  data?: Record<string, string>;
  createdAt: string;
}

function normalizeNotificationType(type: unknown): AppNotification["type"] {
  const value = (type ?? "").toString().toUpperCase();
  if (value.startsWith("ORDER")) return "order";
  if (value.startsWith("PAYOUT")) return "payout";
  if (value.includes("MESSAGE")) return "message";
  if (value.includes("STOCK")) return "stock";
  if (value.includes("VERIFICATION")) return "verification";
  return "system";
}

function normalizeNotification(n: any): AppNotification {
  return {
    id: n.id,
    type: normalizeNotificationType(n.type),
    title: n.title ?? "",
    body: n.body ?? "",
    read: n.readAt != null || n.read === true,
    data: n.data ?? undefined,
    createdAt: n.createdAt ?? new Date().toISOString(),
  };
}

export const notificationService = {
  async getNotifications(): Promise<AppNotification[]> {
    const res = await apiClient.get<{ items?: any[]; notifications?: any[]; nextCursor?: string | null }>("/api/notifications");
    return (res.items ?? res.notifications ?? []).map(normalizeNotification);
  },

  async markAsRead(notificationId: string): Promise<void> {
    await apiClient.patch<void>(`/api/notifications/${notificationId}/read`, {});
  },

  async markAllAsRead(): Promise<void> {
    await apiClient.patch<void>("/api/notifications/read-all", {});
  },

  async getPreferences(): Promise<{ smsMarketing: boolean; smsTransactional: boolean }> {
    return apiClient.get("/api/notifications/preferences");
  },

  async updatePreferences(input: { smsMarketing?: boolean; smsTransactional?: boolean }): Promise<{ smsMarketing: boolean; smsTransactional: boolean }> {
    return apiClient.patch("/api/notifications/preferences", input);
  },
};

export const pushTokenService = {
  async registerPushToken(): Promise<string | null> {
    if (!Device.isDevice || isExpoGo) return null;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") return null;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId ?? undefined,
    });
    const token = tokenData.data;

    await apiClient.post("/api/push-tokens", {
      token,
      platform: Platform.OS,
      deviceName: Device.deviceName ?? undefined,
    });

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      } as Notifications.NotificationBehavior),
    });

    return token;
  },

  async unregisterPushToken(token: string): Promise<void> {
    await apiClient.delete(`/api/push-tokens/${encodeURIComponent(token)}`);
  },
};
