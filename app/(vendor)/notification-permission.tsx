import React, { useCallback, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { goBackOrReplace } from "../../utils/navigation";
import { pushTokenService, type PushPermissionStatus } from "../../services/notificationService";
import { FloatingCard, IconAvatar, PremiumHeader, PrimaryButton, OutlineButton, premiumStyles } from "../../components/shared/PremiumBlocks";

export default function NotificationPermissionScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<PushPermissionStatus | null>(null);
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [checking, setChecking] = useState(true);
  const [requesting, setRequesting] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const result = await pushTokenService.getPermissionStatus();
      setStatus(result.status);
      setCanAskAgain(result.canAskAgain);
    } finally {
      setChecking(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { check(); }, [check]));

  const handleAllow = async () => {
    setRequesting(true);
    try {
      const token = await pushTokenService.registerPushToken();
      await check();
      if (token) router.back();
    } finally {
      setRequesting(false);
    }
  };

  return (
    <View style={premiumStyles.page}>
      <PremiumHeader title="Stay informed" onBack={() => goBackOrReplace(router, "/(vendor)/automation-center" as any)} />

      <View style={[premiumStyles.block, { paddingTop: 24 }]}>
        <FloatingCard style={styles.card}>
          <IconAvatar icon="notifications-outline" tone={status === "granted" ? "success" : "info"} size={64} />

          {checking ? (
            <ActivityIndicator color="#076B51" style={{ marginTop: 16 }} />
          ) : status === "granted" ? (
            <>
              <Text style={styles.title}>Notifications are on</Text>
              <Text style={styles.body}>Eki will notify you about new orders, low stock, upcoming renewals, and campaign activity.</Text>
              <PrimaryButton label="Done" onPress={() => router.back()} style={{ marginTop: 20, width: "100%" }} />
            </>
          ) : status === "denied" && !canAskAgain ? (
            <>
              <Text style={styles.title}>Notifications are off</Text>
              <Text style={styles.body}>You'll need to turn them on from your phone's Settings to get order, stock, renewal, and campaign alerts.</Text>
              <PrimaryButton label="Open Settings" onPress={() => void Linking.openSettings()} style={{ marginTop: 20, width: "100%" }} />
              <OutlineButton label="Not now" onPress={() => router.back()} style={{ marginTop: 10, width: "100%" }} />
            </>
          ) : status === "unsupported" ? (
            <>
              <Text style={styles.title}>Not available here</Text>
              <Text style={styles.body}>Push notifications need a development build or a real device — they aren't available in this preview.</Text>
              <OutlineButton label="Back" onPress={() => router.back()} style={{ marginTop: 20, width: "100%" }} />
            </>
          ) : (
            <>
              <Text style={styles.title}>Stay informed</Text>
              <Text style={styles.body}>Allow Eki to notify you about new orders, low stock, upcoming renewals and campaign activity.</Text>
              <PrimaryButton label="Allow notifications" onPress={() => void handleAllow()} loading={requesting} style={{ marginTop: 20, width: "100%" }} />
              <OutlineButton label="Not now" onPress={() => router.back()} disabled={requesting} style={{ marginTop: 10, width: "100%" }} />
            </>
          )}
        </FloatingCard>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: "center", paddingVertical: 32, paddingHorizontal: 24 },
  title: { fontSize: 18, fontFamily: "Manrope-ExtraBold", color: "#12221A", marginTop: 16, textAlign: "center" },
  body: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#6A7B72", textAlign: "center", lineHeight: 19, marginTop: 8 },
});
