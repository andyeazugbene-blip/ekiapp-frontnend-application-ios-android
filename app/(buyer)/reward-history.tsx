import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { walletService, type Wallet, type WalletTransaction } from "../../services/walletService";
import { useCurrencyStore } from "../../stores/currencyStore";
import { CurrencySelector } from "../../components/ui/CurrencySelector";
import { formatDisplayMoney } from "../../utils/currency";
import { goBackOrReplace } from "../../utils/navigation";

export default function RewardHistoryScreen() {
  const router = useRouter();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const selectedCurrency = useCurrencyStore((state) => state.selectedCurrency);
  const ensureCurrency = useCurrencyStore((state) => state.ensureCurrency);
  const setSelectedCurrency = useCurrencyStore((state) => state.setSelectedCurrency);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      Promise.all([
        walletService.getWallet(),
        walletService.getTransactions(),
      ]).then(([w, txs]) => {
        if (cancelled) return;
        setWallet(w);
        setTransactions(txs);
      }).catch(() => {
        if (cancelled) return;
        setWallet(null);
        setTransactions([]);
      }).finally(() => {
        if (!cancelled) setLoading(false);
      });
      return () => { cancelled = true; };
    }, [])
  );

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" });
    } catch { return iso; }
  };

  React.useEffect(() => {
    ensureCurrency(wallet?.currency).catch(() => undefined);
  }, [ensureCurrency, wallet?.currency]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(buyer)/wallet" as any)} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reward History</Text>
        <TouchableOpacity onPress={() => setCurrencyOpen(true)} activeOpacity={0.85} style={styles.currencyButton}>
          <Text style={styles.currencyButtonText}>{selectedCurrency}</Text>
        </TouchableOpacity>
        <Text style={styles.headerSubtitle}>Your earnings and spending</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Balance summary */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Total Balance</Text>
          <Text style={styles.balanceValue}>{formatDisplayMoney(wallet?.balance ?? 0, wallet?.currency, selectedCurrency)}</Text>
        </View>

        {loading ? (
          <View style={{ paddingVertical: 30, alignItems: "center" }}>
            <ActivityIndicator color="#076B51" />
          </View>
        ) : transactions.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Transaction History</Text>
            <View style={{ alignItems: "center", paddingVertical: 20 }}>
              <Ionicons name="receipt-outline" size={32} color="#C5C5C5" />
              <Text style={{ fontSize: 14, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 8 }}>No transactions yet</Text>
            </View>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Transaction History</Text>
            {transactions.map((tx, index) => {
              const isCredit = tx.type === "credit" || tx.amount > 0;
              return (
                <View key={tx.id} style={[styles.rewardItem, index < transactions.length - 1 && styles.rewardBorder]}>
                  <View style={[styles.rewardIcon, !isCredit && styles.rewardIconDebit]}>
                    <Ionicons name={isCredit ? "arrow-down" : "arrow-up"} size={16} color={isCredit ? "#076B51" : "#FB6363"} />
                  </View>
                  <View style={styles.rewardInfo}>
                    <Text style={styles.rewardLabel}>{tx.description || tx.type}</Text>
                    <Text style={styles.rewardDate}>{formatDate(tx.createdAt)}</Text>
                  </View>
                  <Text style={[styles.rewardAmount, !isCredit && { color: "#FB6363" }]}>
                    {isCredit ? "+" : "-"}{formatDisplayMoney(Math.abs(tx.amount), tx.currency ?? wallet?.currency, selectedCurrency)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
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
  container: { flex: 1, backgroundColor: "#F4F4F4" },
  header: { backgroundColor: "#076B51", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30, borderBottomLeftRadius: 35, borderBottomRightRadius: 35, gap: 4 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  headerTitle: { fontSize: 28, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  currencyButton: { position: "absolute", right: 20, top: 18, minWidth: 58, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  currencyButtonText: { fontSize: 12, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  headerSubtitle: { fontSize: 14, fontFamily: "Outfit-Light", color: "rgba(255,255,255,0.8)" },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 },
  balanceCard: { backgroundColor: "#076B51", borderRadius: 20, padding: 20, alignItems: "center", marginBottom: 16 },
  balanceLabel: { fontSize: 13, fontFamily: "Outfit-Regular", color: "rgba(255,255,255,0.7)" },
  balanceValue: { fontSize: 32, fontFamily: "Manrope-Bold", color: "#FFFFFF", marginTop: 4 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 30, padding: 20 },
  sectionTitle: { fontSize: 18, fontFamily: "Manrope-Bold", color: "#282828", marginBottom: 16 },
  rewardItem: { flexDirection: "row", alignItems: "center", paddingVertical: 14 },
  rewardBorder: { borderBottomWidth: 1, borderBottomColor: "#F4F4F4" },
  rewardIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: "rgba(7,107,81,0.1)", alignItems: "center", justifyContent: "center", marginRight: 12 },
  rewardIconDebit: { backgroundColor: "rgba(251,99,99,0.1)" },
  rewardInfo: { flex: 1 },
  rewardLabel: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#282828" },
  rewardDesc: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 2 },
  rewardDate: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#B0B0B0", marginTop: 2 },
  rewardAmount: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#076B51" },
});
