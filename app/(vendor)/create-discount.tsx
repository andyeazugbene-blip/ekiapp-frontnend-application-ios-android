import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuthStore } from "../../stores/authStore";
import { productService } from "../../services/productService";
import { marketingService } from "../../services/marketingService";
import { Product } from "../../types/product";
import { goBackOrReplace } from "../../utils/navigation";

export default function CreateDiscountScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const vendor = user?.role === "vendor" ? user : null;
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productId, setProductId] = useState<string>("__all__");
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dateTarget, setDateTarget] = useState<"start" | "end" | null>(null);
  const [pickerMonth, setPickerMonth] = useState(() => new Date());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!vendor) { setLoadingProducts(false); return; }
    productService
      .getMyVendorProducts()
      .then((list) => setProducts(list ?? []))
      .catch(() => {})
      .finally(() => setLoadingProducts(false));
  }, [vendor]);

  const handleSubmit = async () => {
    setError("");
    if (!name.trim()) {
      setError("Please enter a discount name.");
      return;
    }
    const rawValue = value.trim();
    const hasCurrencyMarker = /[£$€₦₵]|gbp|usd|eur|ngn|ghs|kes/i.test(rawValue);
    const cleanValue = rawValue.replace(/[£$€₦₵%]/g, "").replace(/\b(gbp|usd|eur|ngn|ghs|kes)\b/gi, "").trim();
    const numericValue = Number(cleanValue);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      setError("Please enter a valid discount percentage or amount.");
      return;
    }

    const selectedProductForReview = products.find((item) => item.id === productId);
    const discountLabel = hasCurrencyMarker ? `${rawValue}` : `${numericValue}%`;
    Alert.alert(
      "Review your discount",
      `Discount: ${discountLabel}\nApplies to: ${productId === "__all__" ? "All foodstuff" : selectedProductForReview?.name ?? "Selected product"}\nRuns from ${startDate || "today"} to ${endDate || "no end date"}`,
      [
        { text: "Edit", style: "cancel" },
        { text: "Publish discount", onPress: () => void submitDiscount(numericValue, hasCurrencyMarker) },
      ],
    );
  };

  const submitDiscount = async (numericValue: number, hasCurrencyMarker: boolean) => {
    setSubmitting(true);
    try {
      const created = await marketingService.createDiscount({
        productIds: productId === "__all__" ? [] : [productId],
        audience: "all",
        kind: hasCurrencyMarker ? "fixed_amount" : "percentage",
        value: numericValue,
        startsAt: startDate || undefined,
        endsAt: endDate || undefined,
      });
      const selectedProduct = products.find((item) => item.id === productId);
      router.push({
        pathname: "/(vendor)/promo-link",
        params: {
          promo: created.code ?? name.trim(),
          url: created.shareUrl ?? undefined,
          productId: productId !== "__all__" ? productId : undefined,
          productName: selectedProduct?.name,
          campaignType: "discount",
        },
      } as any);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create discount.");
    } finally {
      setSubmitting(false);
    }
  };

  const openDatePicker = (target: "start" | "end") => {
    setDateTarget(target);
    const current = target === "start" ? startDate : endDate;
    const parsed = parsePickerDate(current);
    setPickerMonth(parsed ?? new Date());
  };

  const handleDatePicked = (date: Date) => {
    const formatted = formatPickerDate(date);
    if (dateTarget === "start") setStartDate(formatted);
    if (dateTarget === "end") setEndDate(formatted);
    setDateTarget(null);
  };

  return (
    <View style={styles.scrim}>
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Card Modal matching Image 3 */}
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Create Discount</Text>

            {/* Discount name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Discount name</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g summer special"
                  placeholderTextColor="#858585"
                  style={styles.input}
                />
              </View>
            </View>

            {/* Percentage or amount */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Percentage or amount</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  value={value}
                  onChangeText={setValue}
                  placeholder="e.g 10% or £5"
                  placeholderTextColor="#858585"
                  style={styles.input}
                />
              </View>
            </View>

            {/* Start date & End date row */}
            <View style={styles.row}>
              <View style={[styles.fieldGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.fieldLabel}>Start date</Text>
                <TouchableOpacity onPress={() => openDatePicker("start")} activeOpacity={0.85} style={styles.inputWrap}>
                  <TextInput
                    value={startDate}
                    editable={false}
                    pointerEvents="none"
                    placeholder="Pick date"
                    placeholderTextColor="#858585"
                    style={styles.input}
                  />
                  <Ionicons name="calendar-outline" size={16} color="#858585" style={styles.inputIcon} />
                </TouchableOpacity>
              </View>
              <View style={[styles.fieldGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.fieldLabel}>End date</Text>
                <TouchableOpacity onPress={() => openDatePicker("end")} activeOpacity={0.85} style={styles.inputWrap}>
                  <TextInput
                    value={endDate}
                    editable={false}
                    pointerEvents="none"
                    placeholder="Pick date"
                    placeholderTextColor="#858585"
                    style={styles.input}
                  />
                  <Ionicons name="calendar-outline" size={16} color="#858585" style={styles.inputIcon} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Foodstuff to apply to */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Foodstuff to apply to</Text>
              <View style={styles.inputWrap}>
                {loadingProducts ? (
                  <ActivityIndicator color="#076B51" style={{ alignSelf: "flex-start", marginLeft: 15 }} />
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dropdownRow}>
                    <TouchableOpacity
                      onPress={() => setProductId("__all__")}
                      style={[styles.dropdownChip, productId === "__all__" && styles.dropdownChipActive]}
                    >
                      <Text style={[styles.dropdownChipText, productId === "__all__" && styles.dropdownChipTextActive]}>All Foodstuff</Text>
                    </TouchableOpacity>
                    {products.map((p) => (
                      <TouchableOpacity
                        key={p.id}
                        onPress={() => setProductId(p.id)}
                        style={[styles.dropdownChip, productId === p.id && styles.dropdownChipActive]}
                      >
                        <Text style={[styles.dropdownChipText, productId === p.id && styles.dropdownChipTextActive]}>{p.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
                <Ionicons name="time-outline" size={16} color="#858585" style={styles.inputIcon} />
              </View>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleSubmit}
              style={[styles.submitButton, submitting && { opacity: 0.6 }]}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Create Discount</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Centered Close Button below card matching mockup */}
          <TouchableOpacity 
            onPress={() => goBackOrReplace(router, "/(vendor)/grow-sales" as any)}
            activeOpacity={0.85} 
            style={styles.closeButton}
          >
            <Ionicons name="close" size={24} color="#282828" />
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>

      <DatePickerModal
        visible={dateTarget !== null}
        month={pickerMonth}
        title={dateTarget === "start" ? "Select start date" : "Select end date"}
        onClose={() => setDateTarget(null)}
        onMonthChange={setPickerMonth}
        onPick={handleDatePicked}
      />
    </View>
  );
}

function parsePickerDate(value: string): Date | null {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatPickerDate(date: Date): string {
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

function DatePickerModal({
  visible,
  title,
  month,
  onClose,
  onMonthChange,
  onPick,
}: {
  visible: boolean;
  title: string;
  month: Date;
  onClose: () => void;
  onMonthChange: (date: Date) => void;
  onPick: (date: Date) => void;
}) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  const shiftMonth = (delta: number) => onMonthChange(new Date(year, monthIndex + delta, 1));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.dateScrim}>
        <View style={styles.dateCard}>
          <Text style={styles.dateTitle}>{title}</Text>
          <View style={styles.dateHeader}>
            <TouchableOpacity onPress={() => shiftMonth(-1)} style={styles.dateArrow}>
              <Ionicons name="chevron-back" size={18} color="#076B51" />
            </TouchableOpacity>
            <Text style={styles.dateMonth}>
              {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </Text>
            <TouchableOpacity onPress={() => shiftMonth(1)} style={styles.dateArrow}>
              <Ionicons name="chevron-forward" size={18} color="#076B51" />
            </TouchableOpacity>
          </View>
          <View style={styles.weekRow}>
            {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
              <Text key={`${day}-${index}`} style={styles.weekText}>{day}</Text>
            ))}
          </View>
          <View style={styles.daysGrid}>
            {cells.map((day, index) => (
              <TouchableOpacity
                key={`${day ?? "blank"}-${index}`}
                disabled={!day}
                onPress={() => day && onPick(new Date(year, monthIndex, day))}
                style={[styles.dayCell, !day && styles.dayCellBlank]}
              >
                <Text style={styles.dayText}>{day ?? ""}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.dateCancel}>
            <Text style={styles.dateCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { 
    flex: 1, 
    backgroundColor: "rgba(11,78,60,0.88)" 
  },
  container: { 
    flex: 1 
  },
  scrollContent: { 
    flexGrow: 1, 
    justifyContent: "center", 
    alignItems: "center", 
    padding: 20 
  },
  modalCard: { 
    backgroundColor: "#FFFFFF", 
    borderRadius: 24, 
    padding: 24, 
    width: "100%", 
    maxWidth: 350,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8
  },
  modalTitle: { 
    fontSize: 18, 
    fontFamily: "Manrope-Bold", 
    color: "#282828", 
    textAlign: "center", 
    marginBottom: 20 
  },
  fieldGroup: { 
    marginBottom: 16,
    width: "100%"
  },
  fieldLabel: { 
    fontSize: 13, 
    fontFamily: "Outfit-Medium", 
    color: "#858585", 
    marginBottom: 8 
  },
  inputWrap: { 
    flexDirection: "row", 
    alignItems: "center", 
    backgroundColor: "#F4F4F4", 
    borderRadius: 12, 
    height: 50, 
    paddingHorizontal: 16,
    position: "relative"
  },
  input: { 
    flex: 1, 
    height: "100%", 
    fontSize: 14, 
    fontFamily: "Outfit-Regular", 
    color: "#282828" 
  },
  inputIcon: { 
    position: "absolute", 
    right: 16 
  },
  row: { 
    flexDirection: "row", 
    width: "100%" 
  },
  dropdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 24
  },
  dropdownChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#EAEAEA"
  },
  dropdownChipActive: {
    backgroundColor: "#076B51"
  },
  dropdownChipText: {
    fontSize: 12,
    fontFamily: "Outfit-Medium",
    color: "#858585"
  },
  dropdownChipTextActive: {
    color: "#FFFFFF"
  },
  submitButton: { 
    height: 52, 
    borderRadius: 14, 
    backgroundColor: "#076B51", 
    alignItems: "center", 
    justifyContent: "center", 
    marginTop: 10,
    width: "100%" 
  },
  submitButtonText: { 
    fontSize: 15, 
    fontFamily: "Manrope-SemiBold", 
    color: "#FFFFFF" 
  },
  errorText: { 
    fontSize: 12, 
    fontFamily: "Outfit-Regular", 
    color: "#FB6363", 
    textAlign: "center", 
    marginBottom: 12 
  },
  dateScrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", paddingHorizontal: 22 },
  dateCard: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 18 },
  dateTitle: { fontSize: 18, fontFamily: "Manrope-Bold", color: "#282828", textAlign: "center", marginBottom: 14 },
  dateHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  dateArrow: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#E8F4ED", alignItems: "center", justifyContent: "center" },
  dateMonth: { fontSize: 15, fontFamily: "Manrope-Bold", color: "#282828" },
  weekRow: { flexDirection: "row", marginBottom: 8 },
  weekText: { width: `${100 / 7}%`, textAlign: "center", fontSize: 12, fontFamily: "Outfit-Medium", color: "#858585" },
  daysGrid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: { width: `${100 / 7}%`, height: 42, alignItems: "center", justifyContent: "center" },
  dayCellBlank: { opacity: 0 },
  dayText: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#076B51" },
  dateCancel: { height: 48, borderRadius: 14, borderWidth: 1, borderColor: "#E4E7E5", alignItems: "center", justifyContent: "center", marginTop: 12 },
  dateCancelText: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#858585" },
  closeButton: { 
    width: 48, 
    height: 48, 
    borderRadius: 24, 
    backgroundColor: "#FFFFFF", 
    alignItems: "center", 
    justifyContent: "center", 
    marginTop: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3
  }
});
