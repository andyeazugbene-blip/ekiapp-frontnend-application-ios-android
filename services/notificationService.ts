/**
 * Notification and push-token service.
 */
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { apiClient } from "./api";
import { API_BASE_URL } from "./api/config";
import { tokenStorage } from "./api/tokenStorage";

const isExpoGo = Constants.appOwnership === "expo";

export interface AppNotification {
  id: string;
  type: "order" | "message" | "payout" | "stock" | "verification" | "subscription" | "campaign" | "automation" | "system";
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
  if (value.includes("SUBSCRIPTION")) return "subscription";
  if (value.includes("COMMUNITY_CAMPAIGN")) return "campaign";
  if (value.includes("AUTOMATION")) return "automation";
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

export type PushPermissionStatus = "granted" | "denied" | "undetermined" | "unsupported";

export const pushTokenService = {
  /** Read-only status check — never triggers the native OS prompt. Used by the branded lead-in screen (spec §16) to decide what to show before asking. */
  async getPermissionStatus(): Promise<{ status: PushPermissionStatus; canAskAgain: boolean }> {
    if (!Device.isDevice || isExpoGo) return { status: "unsupported", canAskAgain: false };
    const current = (await Notifications.getPermissionsAsync()) as unknown as { status: PushPermissionStatus; canAskAgain: boolean };
    return { status: current.status, canAskAgain: current.canAskAgain };
  },

  async registerPushToken(authToken?: string): Promise<string | null> {
    if (!Device.isDevice || isExpoGo) return null;

    // expo-notifications@55's NotificationPermissionsStatus type extends
    // PermissionResponse, but that base type doesn't resolve through this
    // SDK's package layout — the `status` field is present at runtime.
    const existingPermissions = (await Notifications.getPermissionsAsync()) as Notifications.NotificationPermissionsStatus & { status: string };
    let finalStatus = existingPermissions.status;

    if (finalStatus !== "granted") {
      const requestedPermissions = (await Notifications.requestPermissionsAsync()) as Notifications.NotificationPermissionsStatus & { status: string };
      finalStatus = requestedPermissions.status;
    }

    if (finalStatus !== "granted") return null;

    // Must match app.json's extra.eas.projectId — a wrong/mismatched id
    // silently mints a token for the wrong Expo project, so pushes are
    // never delivered. Only fall back if the config truly isn't present.
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.warn("[PushToken] no EAS projectId in app config — skipping push token registration");
      return null;
    }

    let pushToken: string;
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      pushToken = tokenData.data;
    } catch (err) {
      console.warn("[PushToken] getExpoPushTokenAsync failed", err instanceof Error ? err.message : err);
      return null;
    }

    const savedToken = authToken ?? await tokenStorage.getToken();
    try {
      const res = await fetch(`${API_BASE_URL}/api/push-tokens`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(savedToken ? { Authorization: `Bearer ${savedToken}` } : {}),
        },
        body: JSON.stringify({ token: pushToken, platform: Platform.OS }),
      });
      if (!res.ok) console.warn("[PushToken] register failed", res.status);
    } catch (err) {
      console.warn("[PushToken] register request failed", err instanceof Error ? err.message : err);
    }

    return pushToken;
  },

  async unregisterPushToken(token: string): Promise<void> {
    const savedToken = await tokenStorage.getToken();
    if (savedToken) {
      await fetch(`${API_BASE_URL}/api/push-tokens/${encodeURIComponent(token)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${savedToken}` },
      });
    }
  },
};
