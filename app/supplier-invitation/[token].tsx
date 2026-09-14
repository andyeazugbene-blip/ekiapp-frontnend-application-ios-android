import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  ErrorState,
  FloatingCard,
  IconAvatar,
  LoadingBlock,
  PremiumHeader,
  PrimaryButton,
  premiumStyles,
} from "../../components/shared/PremiumBlocks";
import { communityBuyService, type SupplierInvitation } from "../../services/communityBuyService";
import { ApiRequestError } from "../../services/api/client";

/**
 * Universal/app-link destination for a Community Buy supplier invitation
 * (Workstream 3, mandate item 7). Public by design — the invitee may have
 * no Eki account at all yet, so this screen never requires auth to view,
 * and only collects name+password when accept() itself reports one is
 * needed (mirrors invite/[code].tsx's "no dedicated pre-check screen, let
 * the real endpoint be the source of truth" pattern).
 */
export default function SupplierInvitationScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [invitation, setInvitation] = useState<SupplierInvitation | null>(null);

  const [needsAccount, setNeedsAccount] = useState(false);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [actionError, setActionError] = useState("");
  const [result, setResult] = useState<"accepted" | "declined" | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      setInvitation(await communityBuyService.getSupplierInvitation(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "This invitation could not be found.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleAccept = async () => {
    if (!token) return;
    setAccepting(true);
    setActionError("");
    try {
      await communityBuyService.acceptSupplierInvitation(token, needsAccount ? { name, password } : undefined);
      setResult("accepted");
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 400 && !needsAccount) {
        // No Eki account exists for this email yet — reveal the sign-up fields.
        setNeedsAccount(true);
      } else {
        setActionError(err instanceof Error ? err.message : "Could not accept this invitation.");
      }
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    if (!token) return;
    setDeclining(true);
    setActionError("");
    try {
      await communityBuyService.declineSupplierInvitation(token, declineReason.trim() || undefined);
      setResult("declined");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not decline this invitation.");
    } finally {
      setDeclining(false);
    }
  };

  const terms = invitation?.campaign as unknown as { title?: string } | undefined;

  return (
    <View style={premiumStyles.page}>
      <PremiumHeader title="Supplier invitation" onBack={() => router.replace("/(buyer)" as any)} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[premiumStyles.scrollContent, { paddingTop: 18 }]} showsVerticalScrollIndicator={false}>
        {loading ? (
          <LoadingBlock />
        ) : error ? (
          <View style={premiumStyles.block}><ErrorState message={error} onRetry={() => void load()} /></View>
        ) : !invitation ? null : result === "accepted" ? (
          <View style={premiumStyles.block}>
            <FloatingCard style={styles.introCard}>
              <IconAvatar icon="checkmark-circle" tone="success" size={52} />
              <Text style={styles.introTitle}>Invitation accepted</Text>
              <Text style={styles.introBody}>
                {needsAccount
                  ? "Your Eki account has been created. Log in to continue in Supplier Centre."
                  : "Log in to your Eki account to see this in Supplier Centre."}
              </Text>
              <PrimaryButton label="Go to log in" onPress={() => router.replace("/(auth)/login" as any)} style={{ marginTop: 8, alignSelf: "stretch" }} />
            </FloatingCard>
          </View>
        ) : result === "declined" ? (
          <View style={premiumStyles.block}>
            <FloatingCard style={styles.introCard}>
              <IconAvatar icon="close-circle-outline" tone="neutral" size={52} />
              <Text style={styles.introTitle}>Invitation declined</Text>
              <Text style={styles.introBody}>The organiser has been notified.</Text>
            </FloatingCard>
          </View>
        ) : invitation.status !== "PENDING" ? (
          <View style={premiumStyles.block}>
            <FloatingCard style={styles.introCard}>
              <IconAvatar icon="information-circle-outline" tone="warning" size={52} />
              <Text style={styles.introTitle}>
                {invitation.status === "EXPIRED" ? "This invitation has expired" : invitation.status === "ACCEPTED" ? "Already accepted" : invitation.status === "DECLINED" ? "Already declined" : "No longer available"}
              </Text>
              <Text style={styles.introBody}>Contact the organiser if you believe this is a mistake.</Text>
            </FloatingCard>
          </View>
        ) : (
          <View style={[premiumStyles.block, { gap: 14 }]}>
            <FloatingCard style={styles.introCard}>
              <IconAvatar icon="people-circle-outline" tone="success" size={52} />
              <Text style={styles.introTitle}>You're invited to supply{terms?.title ? ` "${terms.title}"` : " a Community Buy campaign"}</Text>
              <Text style={styles.introBody}>An organiser on Eki has invited you to supply this campaign. Accepting links (or creates) your Eki Supplier Centre account — no store or Vendor account is required.</Text>
            </FloatingCard>

            {needsAccount ? (
              <FloatingCard style={{ gap: 10 }}>
                <Text style={styles.formLabel}>Create your Eki account</Text>
                <Text style={styles.hint}>No account exists yet for {invitation.email} — enter a name and password to create one and accept.</Text>
                <TextInput style={styles.input} placeholder="Full name" placeholderTextColor="#8AA194" value={name} onChangeText={setName} accessibilityLabel="Full name" />
                <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#8AA194" value={password} onChangeText={setPassword} secureTextEntry accessibilityLabel="Password" />
              </FloatingCard>
            ) : null}

            {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}

            <PrimaryButton
              label={needsAccount ? "Create account and accept" : "Accept invitation"}
              onPress={() => void handleAccept()}
              loading={accepting}
              disabled={accepting || declining || (needsAccount && (!name.trim() || password.length < 8))}
            />
            {needsAccount ? <Text style={styles.hint}>Password must be at least 8 characters.</Text> : null}

            <TouchableOpacity
              onPress={() => setShowDeclineForm((v) => !v)}
              disabled={accepting || declining}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Decline invitation"
              accessibilityState={{ expanded: showDeclineForm }}
            >
              <Text style={styles.linkText}>{showDeclineForm ? "Cancel" : "Decline this invitation"}</Text>
            </TouchableOpacity>

            {showDeclineForm ? (
              <FloatingCard style={{ gap: 8 }}>
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  placeholder="Why are you declining? (optional)"
                  placeholderTextColor="#8AA194"
                  value={declineReason}
                  onChangeText={setDeclineReason}
                  multiline
                  accessibilityLabel="Reason for declining"
                />
                <TouchableOpacity
                  onPress={() => void handleDecline()}
                  disabled={declining}
                  activeOpacity={0.88}
                  style={styles.declineConfirmBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Confirm decline"
                  accessibilityState={{ busy: declining, disabled: declining }}
                >
                  {declining ? <ActivityIndicator size="small" color="#D6552F" /> : <Text style={styles.declineBtnText}>Confirm decline</Text>}
                </TouchableOpacity>
              </FloatingCard>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  introCard: { alignItems: "center", gap: 8 },
  introTitle: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#151E1B", textAlign: "center" },
  introBody: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#6A7B72", textAlign: "center", lineHeight: 19 },
  formLabel: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#151E1B" },
  hint: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#8AA194" },
  errorText: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#D6552F", textAlign: "center" },
  input: { backgroundColor: "#F4F6F5", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 13, fontFamily: "Outfit-Regular", color: "#151E1B" },
  inputMultiline: { minHeight: 60, textAlignVertical: "top" },
  linkText: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#076B51", textAlign: "center" },
  declineConfirmBtn: { minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: "#D6552F", alignItems: "center", justifyContent: "center" },
  declineBtnText: { fontSize: 12, fontFamily: "Manrope-Bold", color: "#D6552F" },
});
