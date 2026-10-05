import React, { useCallback, useState } from "react";
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { disputeService, type DeliveryProofItem, type DeliveryProofKind } from "../../services/disputeService";
import { orderService } from "../../services/orderService";
import type { Order } from "../../types/order";
import { useAssetUpload } from "../../hooks/useAssetUpload";
import { goBackOrReplace } from "../../utils/navigation";
import {
  DELIVERY_PROOF_MAX_BYTES,
  canAddDeliveryProof,
  classifyFailure,
  formatBytes,
  type ClassifiedFailure,
} from "../../utils/disputeHelpers";
import { FailureState, LoadingState } from "../../components/shared/ScreenStates";
import { PhotoAttach } from "../../components/shared/PhotoAttach";
import { DeliveryProofList } from "../../components/shared/DeliveryProofList";

const KINDS: { id: Exclude<DeliveryProofKind, "SIGNATURE">; label: string; hint: string }[] = [
  { id: "DELIVERY_PHOTO", label: "Delivery photo", hint: "A photo of the goods at delivery." },
  { id: "PICKUP_CONFIRMATION", label: "Pickup confirmation", hint: "A photo or note confirming the buyer collected the order." },
  { id: "NOTE", label: "Note only", hint: "A written note (at least 5 characters)." },
];

export default function VendorDeliveryProofScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const orderId = typeof id === "string" && id ? id : undefined;

  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<DeliveryProofItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failure, setFailure] = useState<ClassifiedFailure | null>(null);
  const [kind, setKind] = useState<(typeof KINDS)[number]["id"]>("DELIVERY_PHOTO");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const upload = useAssetUpload("delivery_proof", DELIVERY_PROOF_MAX_BYTES);

  const load = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (!orderId) {
        setFailure({ kind: "not_found", message: "No order was specified." });
        setLoading(false);
        return;
      }
      if (mode === "initial") setLoading(true);
      else setRefreshing(true);
      try {
        const [nextOrder, nextItems] = await Promise.all([
          orderService.getVendorOrderById(orderId),
          disputeService.listDeliveryProofAsVendor(orderId),
        ]);
        setOrder(nextOrder);
        setItems(nextItems);
        setFailure(null);
      } catch (err) {
        setFailure(classifyFailure(err, "This order could not be found in your store."));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [orderId],
  );

  useFocusEffect(
    useCallback(() => {
      void load("initial");
    }, [load]),
  );

  const needsPhoto = kind === "DELIVERY_PHOTO";
  const photoOptional = kind === "PICKUP_CONFIRMATION";
  const showPhoto = kind !== "NOTE";
  const photoReady = upload.state.status === "done" && Boolean(upload.state.assetId);
  const photoBlocking = upload.state.status === "uploading" || upload.state.status === "failed";
  const noteOk = note.trim().length >= 5;
  const canSubmit =
    !submitting &&
    !photoBlocking &&
    (kind === "NOTE" ? noteOk : needsPhoto ? photoReady : photoReady || noteOk);

  const submit = async () => {
    if (!orderId || !canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    setSaved(false);
    try {
      const trimmed = note.trim() || undefined;
      if (kind === "NOTE") {
        await disputeService.addDeliveryProofAsVendor(orderId, { kind: "NOTE", note: trimmed as string });
      } else {
        await disputeService.addDeliveryProofAsVendor(orderId, {
          kind,
          uploadAssetId: photoReady ? (upload.state.assetId as string) : undefined,
          note: trimmed,
        });
      }
      upload.reset();
      setNote("");
      setSaved(true);
      await load("refresh");
    } catch (err) {
      const f = classifyFailure(err);
      setSubmitError(
        f.kind === "conflict"
          ? f.message
          : f.kind === "not_found"
            ? "This order could not be found in your store."
            : f.message,
      );
    } finally {
      setSubmitting(false);
    }
  };

  const allowed = canAddDeliveryProof(order?.status);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => goBackOrReplace(router, (orderId ? { pathname: "/(vendor)/order-detail", params: { id: orderId } } : "/(vendor)/orders") as never)}
          activeOpacity={0.85}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={20} color="#282828" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Delivery proof</Text>
          {order ? <Text style={styles.headerSub}>Order {order.orderNumber}</Text> : null}
        </View>
      </View>

      {loading ? (
        <LoadingState label="Loading delivery proof..." />
      ) : failure ? (
        <FailureState failure={failure} onRetry={() => void load("initial")} />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load("refresh")} tintColor="#076B51" />}
          >
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Uploaded proof</Text>
              {items.length === 0 ? (
                <Text style={styles.empty}>No delivery proof has been added for this order yet.</Text>
              ) : (
                <DeliveryProofList items={items} byLabel="You" />
              )}
            </View>

            {allowed ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Add proof</Text>
                <Text style={styles.empty}>Proof is shown to the buyer and may be used if a dispute is opened.</Text>
                <View style={{ gap: 8, marginTop: 6 }}>
                  {KINDS.map((k) => {
                    const active = k.id === kind;
                    return (
                      <TouchableOpacity
                        key={k.id}
                        onPress={() => { setKind(k.id); setSubmitError(null); setSaved(false); }}
                        activeOpacity={0.85}
                        style={[styles.kindRow, active && styles.kindRowActive]}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.kindTitle, active && { color: "#076B51" }]}>{k.label}</Text>
                          <Text style={styles.kindHint}>{k.hint}</Text>
                        </View>
                        <Ionicons name={active ? "radio-button-on" : "radio-button-off"} size={18} color={active ? "#076B51" : "#A8B0B6"} />
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {showPhoto ? (
                  <View style={{ marginTop: 14 }}>
                    <PhotoAttach
                      state={upload.state}
                      onPick={(s) => { setSubmitError(null); setSaved(false); void upload.pick(s); }}
                      onRetry={() => void upload.retry()}
                      onRemove={upload.reset}
                      maxLabel={`Up to ${formatBytes(DELIVERY_PROOF_MAX_BYTES)}.${photoOptional ? " A photo is optional if you add a note." : ""}`}
                      disabled={submitting}
                    />
                  </View>
                ) : null}

                <TextInput
                  value={note}
                  onChangeText={(v) => { setNote(v); setSaved(false); }}
                  multiline
                  textAlignVertical="top"
                  placeholder={kind === "NOTE" ? "Write your note" : "Add a note (optional)"}
                  placeholderTextColor="#8A8F94"
                  maxLength={1000}
                  style={styles.input}
                />

                {submitError ? <Text style={styles.error}>{submitError}</Text> : null}
                {saved ? <Text style={styles.success}>Proof added.</Text> : null}

                <TouchableOpacity
                  onPress={submit}
                  disabled={!canSubmit}
                  activeOpacity={0.85}
                  style={[styles.primaryBtn, !canSubmit && styles.disabled]}
                  accessibilityRole="button"
                >
                  <Text style={styles.primaryBtnText}>{submitting ? "Submitting..." : submitError ? "Retry submit" : "Submit proof"}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.notice}>
                <Ionicons name="information-circle-outline" size={18} color="#92400E" />
                <Text style={styles.noticeText}>Delivery proof can be added once the order has been dispatched.</Text>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAF9F5" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#F4F4F4", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 22, fontFamily: "Manrope-Bold", color: "#282828" },
  headerSub: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#687076" },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 48, gap: 14 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 18, gap: 8 },
  sectionTitle: { fontSize: 17, fontFamily: "Manrope-Bold", color: "#282828" },
  empty: { fontSize: 13, lineHeight: 19, fontFamily: "Outfit-Regular", color: "#687076" },
  kindRow: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 14, padding: 12 },
  kindRowActive: { borderColor: "#076B51", backgroundColor: "#F0F7F4" },
  kindTitle: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#282828" },
  kindHint: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#687076", marginTop: 2 },
  input: { backgroundColor: "#F6F7F7", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, minHeight: 80, fontSize: 14, fontFamily: "Outfit-Regular", color: "#282828", marginTop: 10 },
  error: { fontSize: 12, fontFamily: "Outfit-Medium", color: "#FB6363", marginTop: 6 },
  success: { fontSize: 12, fontFamily: "Outfit-Medium", color: "#076B51", marginTop: 6 },
  primaryBtn: { marginTop: 12, height: 50, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  primaryBtnText: { fontSize: 15, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  disabled: { opacity: 0.5 },
  notice: { flexDirection: "row", gap: 8, alignItems: "center", backgroundColor: "#FEF3C7", borderRadius: 14, padding: 14 },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 19, fontFamily: "Outfit-Medium", color: "#92400E" },
});
