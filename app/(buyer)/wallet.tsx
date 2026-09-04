import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { walletService, type Wallet, type WalletTransaction } from "../../services/walletService";
import { referralService, type ReferralInfo } from "../../services/referralService";
import { isPaymentSheetAvailable, presentPayment } from "../../services/stripePayment";
import { getPublicReferralUrl } from "../../utils/shareLinks";
import { useAuthStore } from "../../stores/authStore";
import { useCurrencyStore } from "../../stores/currencyStore";
import { CurrencySelector } from "../../components/ui/CurrencySelector";
import { formatDisplayMoney } from "../../utils/currency";

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return value;
  }
}

export default function WalletScreen() {
  const router = useRouter();
  const userReferralCode = useAuthStore((state) => state.user?.referralCode ?? "");
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [referralInfo, setReferralInfo] = useState<ReferralInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [rewardOpen, setRewardOpen] = useState(true);
  const [referralOpen, setReferralOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const selectedCurrency = useCurrencyStore((state) => state.selectedCurrency);
  const ensureCurrency = useCurrencyStore((state) => state.ensureCurrency);
  const setSelectedCurrency = useCurrencyStore((state) => state.setSelectedCurrency);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextWallet, nextTransactions, nextReferralInfo] = await Promise.all([
        walletService.getWallet(),
        walletService.getTransactions(),
        referralService.getMyReferralInfo().catch(() => null),
      ]);
      setWallet(nextWallet);
      setTransactions(nextTransactions ?? []);
      setReferralInfo(nextReferralInfo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load wallet.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const currency = wallet?.currency ?? referralInfo?.currency ?? "GBP";
  const referralCode = referralInfo?.referralCode || userReferralCode || "";
  const referralUrl = referralCode ? getPublicReferralUrl(referralCode) : "";
  const creditTransactions = useMemo(
    () => transactions.filter((item) => item.type === "credit").slice(0, 3),
    [transactions],
  );

  React.useEffect(() => {
    ensureCurrency(currency).catch(() => undefined);
  }, [currency, ensureCurrency]);

  const handleTopUp = async () => {
    if (topUpLoading) return;
    const amount = Number(topUpAmount);
    if (!amount || amount <= 0) {
      Alert.alert("Enter an amount", "Please choose a valid wallet top-up amount.");
      return;
    }

    setTopUpLoading(true);
    try {
      if (!isPaymentSheetAvailable()) {
        setError("Stripe PaymentSheet is not available in Expo Go. Use a development build to test wallet top-ups.");
        return;
      }

      const intent = await walletService.topUp(amount);
      const result = await presentPayment({ clientSecret: intent.clientSecret, merchantDisplayName: "Eki Wallet" });

      if (result.status === "unsupported" || result.status === "failed") {
        setError(result.message);
        return;
      }

      if (result.status === "cancelled") {
        setError(result.message ?? "Wallet top-up cancelled.");
        return;
      }

      setTopUpAmount("");
      setShowTopUp(false);
      await load();
      Alert.alert("Payment submitted", "Your wallet balance will refresh after the payment provider confirms the top-up.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not top up wallet.");
    } finally {
      setTopUpLoading(false);
    }
  };

  const handleCopyReferral = async () => {
    if (!referralCode && !referralUrl) {
      Alert.alert("Referral unavailable", "Your referral code is not ready yet. Please refresh and try again.");
      return;
    }
    await Clipboard.setStringAsync([referralCode, referralUrl].filter(Boolean).join("\n"));
    Alert.alert("Copied", "Referral link copied to clipboard.");
  };

  const handleShareReferral = async () => {
    if (!referralCode) {
      Alert.alert("Referral unavailable", "Your referral code is not ready yet. Please refresh and try again.");
      return;
    }
    await Share.share({
      message: `Join Eki and use my referral link to get started.\n${referralUrl || referralCode}`,
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroWrap}>
          <LinearGradient colors={["#084E39", "#076B51", "#085F48"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroChip}>
                <Text style={styles.heroChipText}>Eki Wallet</Text>
              </View>
              <TouchableOpacity onPress={() => setCurrencyOpen(true)} activeOpacity={0.86} style={styles.currencyButton}>
                <Text style={styles.currencyButtonText}>{selectedCurrency}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.heroLabel}>Wallet Balance</Text>
            <Text style={styles.heroBalance}>
              {loading && !wallet ? "..." : formatDisplayMoney(wallet?.balance ?? 0, currency, selectedCurrency)}
            </Text>
            <Text style={styles.heroCaption}>
              Rewards come from completed referral bonuses and approved wallet credits on your live Eki account.
            </Text>
          </LinearGradient>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.sectionWrap}>
          {showTopUp ? (
            <View style={styles.topUpCard}>
              <Text style={styles.topUpTitle}>Add funds to wallet</Text>
              <TextInput
                value={topUpAmount}
                onChangeText={setTopUpAmount}
                placeholder={`Enter amount (${selectedCurrency})`}
                placeholderTextColor="#9AA3A0"
                keyboardType="decimal-pad"
                style={styles.topUpInput}
              />
              <View style={styles.topUpActions}>
                <TouchableOpacity onPress={() => setShowTopUp(false)} activeOpacity={0.86} style={styles.topUpCancel}>
                  <Text style={styles.topUpCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleTopUp}
                  activeOpacity={0.86}
                  disabled={topUpLoading}
                  style={[styles.topUpConfirm, topUpLoading && { opacity: 0.6 }]}
                >
                  {topUpLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.topUpConfirmText}>Top Up</Text>}
                </TouchableOpacity>
              </View>
              {!isPaymentSheetAvailable() ? (
                <Text style={styles.inlineHint}>
                  Card top-ups need a development build with Stripe PaymentSheet enabled.
                </Text>
              ) : null}
            </View>
          ) : (
            <TouchableOpacity onPress={() => setShowTopUp(true)} activeOpacity={0.86} style={styles.primaryAction}>
              <Text style={styles.primaryActionText}>Add Money to Wallet</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.sectionWrap}>
          <View style={styles.sectionCard}>
            <TouchableOpacity onPress={() => setRewardOpen((value) => !value)} activeOpacity={0.86} style={styles.sectionHeader}>
              <Text style={styles.rewardTitle}>Reward history</Text>
              <Ionicons name={rewardOpen ? "chevron-up" : "chevron-down"} size={20} color="#0A6C52" />
            </TouchableOpacity>

            {rewardOpen ? (
              <>
                {loading && creditTransactions.length === 0 ? (
                  <View style={styles.loaderRow}>
                    <ActivityIndicator color="#076B51" />
                  </View>
                ) : creditTransactions.length === 0 ? (
                  <Text style={styles.emptyText}>No rewards yet. Your earned credits will appear here after they are approved.</Text>
                ) : (
                  creditTransactions.map((transaction) => (
                    <View key={transaction.id} style={styles.transactionCard}>
                      <View style={styles.transactionIconWrap}>
                        <Ionicons name="gift-outline" size={26} color="#0A8C6A" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.transactionTitle}>{transaction.label}</Text>
                        <Text style={styles.transactionDescription}>{transaction.description || "Automatically added to your wallet"}</Text>
                      </View>
                      <Text style={styles.creditAmount}>+{formatDisplayMoney(transaction.amount, transaction.currency ?? currency, selectedCurrency)}</Text>
                    </View>
                  ))
                )}

                <TouchableOpacity
                  onPress={() => router.push({ pathname: "/(buyer)/explore", params: { view: "products" } } as any)}
                  activeOpacity={0.86}
                  style={styles.secondaryAction}
                >
                  <Text style={styles.secondaryActionText}>Browse Menu</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>

        <View style={styles.sectionWrap}>
          <View style={styles.sectionCard}>
            <TouchableOpacity onPress={() => setReferralOpen((value) => !value)} activeOpacity={0.86} style={styles.sectionHeader}>
              <Text style={styles.referralSectionTitle}>Referral Programme</Text>
              <Ionicons name={referralOpen ? "chevron-up" : "chevron-down"} size={20} color="#FB6363" />
            </TouchableOpacity>

            {referralOpen ? (
              <>
                <View style={styles.referralBanner}>
                  <View style={styles.referralBannerIcon}>
                    <Ionicons name="person-add-outline" size={24} color="#FB6363" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.referralBannerTitle}>Invite</Text>
                    <Text style={styles.referralBannerBody}>
                      Share your referral code. Credit is added after the invited buyer completes their first paid order.
                    </Text>
                  </View>
                  <Text style={styles.referralBannerAmount}>Live</Text>
                </View>

                <Text style={styles.codeLabel}>Your Referral Code</Text>
                <View style={styles.codeRow}>
                  <Text style={styles.codeValue} numberOfLines={1}>
                    {referralCode || "—"}
                  </Text>
                  <TouchableOpacity onPress={handleCopyReferral} activeOpacity={0.86} style={styles.copyButton}>
                    <Ionicons name="copy-outline" size={22} color="#5A5A5A" />
                  </TouchableOpacity>
                </View>

                <View style={styles.referralStatsRow}>
                  <View style={styles.referralStat}>
                    <Text style={styles.referralStatValue}>{referralInfo?.totalReferred ?? 0}</Text>
                    <Text style={styles.referralStatLabel}>Invited</Text>
                  </View>
                  <View style={styles.referralStat}>
                    <Text style={styles.referralStatValue}>{formatDisplayMoney(referralInfo?.totalEarned ?? 0, referralInfo?.currency ?? currency, selectedCurrency)}</Text>
                    <Text style={styles.referralStatLabel}>Earned</Text>
                  </View>
                </View>

                <TouchableOpacity onPress={handleShareReferral} activeOpacity={0.86} style={styles.shareButton}>
                  <Ionicons name="share-social-outline" size={20} color="#FB6363" />
                  <Text style={styles.shareButtonText}>Share Referral Link</Text>
                </TouchableOpacity>

                <View style={styles.rewardHintCard}>
                  <Ionicons name="shield-checkmark-outline" size={18} color="#076B51" />
                  <Text style={styles.rewardHintText}>
                    Referral codes, earned totals, and wallet credits on this screen are loaded from your real Eki account.
                  </Text>
                </View>
              </>
            ) : null}
          </View>
        </View>

        <View style={styles.sectionWrap}>
          <View style={styles.sectionCard}>
            <TouchableOpacity onPress={() => setHistoryOpen((value) => !value)} activeOpacity={0.86} style={styles.sectionHeader}>
              <Text style={styles.historyTitle}>Transaction History</Text>
              <Ionicons name={historyOpen ? "chevron-up" : "chevron-down"} size={20} color="#2B2B2B" />
            </TouchableOpacity>

            {historyOpen ? (
              <>
                {loading && transactions.length === 0 ? (
                  <View style={styles.loaderRow}>
                    <ActivityIndicator color="#076B51" />
                  </View>
                ) : transactions.length === 0 ? (
                  <Text style={styles.emptyText}>No transactions yet.</Text>
                ) : (
                  transactions.map((transaction) => {
                    const isCredit = transaction.type === "credit";
                    return (
                      <View key={transaction.id} style={styles.transactionCard}>
                        <View style={styles.transactionIconWrap}>
                          <Ionicons
                            name={isCredit ? "gift-outline" : "wallet-outline"}
                            size={24}
                            color={isCredit ? "#0A8C6A" : "#5C6670"}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.transactionTitle}>{transaction.label}</Text>
                          <Text style={styles.transactionDescription}>{formatDate(transaction.createdAt)}</Text>
                        </View>
                        <Text style={[styles.historyAmount, !isCredit && styles.debitAmount]}>
                          {isCredit ? "+" : "-"}{formatDisplayMoney(transaction.amount, transaction.currency ?? currency, selectedCurrency)}
                        </Text>
                      </View>
                    );
                  })
                )}
              </>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <CurrencySelector
        selectedCurrency={selectedCurrency}
        onChange={setSelectedCurrency}
        visible={currencyOpen}
        onClose={() => setCurrencyOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F5F0" },
  scrollContent: { paddingBottom: 120 },
  heroWrap: { paddingHorizontal: 16, paddingTop: 10 },
  heroCard: {
    borderRadius: 30,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 26,
  },
  heroChip: {
    alignSelf: "flex-start",
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 18,
  },
  heroChipText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Manrope-Bold",
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 18,
  },
  heroLabel: {
    color: "rgba(255,255,255,0.84)",
    fontSize: 15,
    fontFamily: "Outfit-Regular",
  },
  heroBalance: {
    color: "#FFFFFF",
    fontSize: 44,
    lineHeight: 52,
    fontFamily: "Manrope-ExtraBold",
    marginTop: 8,
  },
  heroCaption: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Outfit-Regular",
    marginTop: 28,
  },
  errorText: {
    color: "#FB6363",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Outfit-Regular",
    textAlign: "center",
    marginTop: 14,
    paddingHorizontal: 16,
  },
  sectionWrap: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  primaryAction: {
    height: 58,
    borderRadius: 18,
    backgroundColor: "#0A6C52",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryActionText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Manrope-Bold",
  },
  topUpCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 16,
  },
  topUpTitle: {
    color: "#2B2B2B",
    fontSize: 16,
    fontFamily: "Manrope-Bold",
    marginBottom: 12,
  },
  topUpInput: {
    height: 52,
    borderRadius: 16,
    backgroundColor: "#F3F4F4",
    paddingHorizontal: 14,
    color: "#2B2B2B",
    fontSize: 15,
    fontFamily: "Outfit-Regular",
  },
  topUpActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
  },
  topUpCancel: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#0A6C52",
    alignItems: "center",
    justifyContent: "center",
  },
  topUpCancelText: {
    color: "#0A6C52",
    fontSize: 14,
    fontFamily: "Manrope-Bold",
  },
  topUpConfirm: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#0A6C52",
    alignItems: "center",
    justifyContent: "center",
  },
  topUpConfirmText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Manrope-Bold",
  },
  inlineHint: {
    color: "#7A7F84",
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Outfit-Regular",
    marginTop: 12,
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  rewardTitle: {
    color: "#0A6C52",
    fontSize: 18,
    fontFamily: "Manrope-Bold",
  },
  referralSectionTitle: {
    color: "#FB6363",
    fontSize: 18,
    fontFamily: "Manrope-Bold",
  },
  historyTitle: {
    color: "#2B2B2B",
    fontSize: 18,
    fontFamily: "Manrope-Bold",
  },
  loaderRow: {
    paddingVertical: 20,
    alignItems: "center",
  },
  emptyText: {
    color: "#7E8489",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Outfit-Regular",
    textAlign: "center",
    paddingVertical: 18,
  },
  transactionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 14,
    shadowColor: "#182722",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
    marginBottom: 14,
  },
  transactionIconWrap: {
    width: 62,
    height: 62,
    borderRadius: 18,
    backgroundColor: "#EAF5F0",
    alignItems: "center",
    justifyContent: "center",
  },
  transactionTitle: {
    color: "#2B2B2B",
    fontSize: 17,
    lineHeight: 22,
    fontFamily: "Manrope-Bold",
  },
  transactionDescription: {
    color: "#7A7F84",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Outfit-Regular",
    marginTop: 4,
  },
  creditAmount: {
    color: "#0A8C6A",
    fontSize: 19,
    lineHeight: 24,
    fontFamily: "Manrope-ExtraBold",
  },
  historyAmount: {
    color: "#0A8C6A",
    fontSize: 19,
    lineHeight: 24,
    fontFamily: "Manrope-ExtraBold",
  },
  debitAmount: {
    color: "#5C6670",
  },
  secondaryAction: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#0A6C52",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  secondaryActionText: {
    color: "#0A6C52",
    fontSize: 16,
    fontFamily: "Manrope-Bold",
  },
  referralBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: "rgba(251,99,99,0.35)",
    backgroundColor: "#FFF5F5",
    padding: 14,
    marginBottom: 18,
  },
  referralBannerIcon: {
    width: 62,
    height: 62,
    borderRadius: 18,
    backgroundColor: "#FFEAEA",
    alignItems: "center",
    justifyContent: "center",
  },
  referralBannerTitle: {
    color: "#2B2B2B",
    fontSize: 18,
    fontFamily: "Manrope-Bold",
  },
  referralBannerBody: {
    color: "#6E7377",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Outfit-Regular",
    marginTop: 4,
  },
  referralBannerAmount: {
    color: "#FB6363",
    fontSize: 17,
    fontFamily: "Manrope-ExtraBold",
  },
  codeLabel: {
    color: "#2B2B2B",
    fontSize: 15,
    fontFamily: "Manrope-Bold",
    marginBottom: 10,
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    backgroundColor: "#F3F4F4",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  codeValue: {
    flex: 1,
    color: "#404040",
    fontSize: 16,
    fontFamily: "Outfit-Medium",
  },
  copyButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  referralStatsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
  },
  referralStat: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: "#F9F6F2",
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  referralStatValue: {
    color: "#2B2B2B",
    fontSize: 18,
    fontFamily: "Manrope-ExtraBold",
  },
  referralStatLabel: {
    color: "#7A7F84",
    fontSize: 13,
    fontFamily: "Outfit-Regular",
    marginTop: 4,
  },
  shareButton: {
    marginTop: 16,
    height: 54,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#FB6363",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  shareButtonText: {
    color: "#FB6363",
    fontSize: 16,
    fontFamily: "Manrope-Bold",
  },
  rewardHintCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#F3F8F5",
    borderRadius: 16,
    padding: 14,
    marginTop: 14,
  },
  rewardHintText: {
    flex: 1,
    color: "#24564A",
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Outfit-Regular",
  },
  currencyButton: {
    minWidth: 62,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  currencyButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Manrope-Bold",
  },
});
