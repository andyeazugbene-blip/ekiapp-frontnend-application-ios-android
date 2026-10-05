import React, { useCallback, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { disputeService, type PartyDispute } from "../../services/disputeService";
import { orderService } from "../../services/orderService";
import type { Order } from "../../types/order";
import { useAssetUpload } from "../../hooks/useAssetUpload";
import { goBackOrReplace } from "../../utils/navigation";
import { formatDisplayMoney } from "../../utils/currency";
import {
  DISPUTE_EVIDENCE_MAX_BYTES,
  canAddToDispute,
  canShowAppeal,
  classifyFailure,
  deadlineCopy,
  disputeStatusLabel,
  disputeTypeLabel,
  formatBytes,
  partyLabel,
  type ClassifiedFailure,
} from "../../utils/disputeHelpers";
import { FailureState, LoadingState } from "./ScreenStates";
import { PhotoAttach } from "./PhotoAttach";
import { ProofImage } from "./DeliveryProofList";

interface Props {
  /** Where the back arrow goes when there is no history (e.g. opened from a notification). */
  fallbackRoute: string;
  /** Buyer only: route used to open a new dispute when none exists for the order. */
  reportIssueRoute?: string;
}

/**
 * Shared dispute case view for buyer and vendor. The backend decides the caller's role (yourRole),
 * whether evidence/messages are still accepted, and whether an appeal is allowed; this screen only
 * reflects that. Route params: `disputeId` or `orderId`.
 */
export function DisputeCaseScreen({ fallbackRoute, reportIssueRoute }: Props) {
  const router = useRouter();
  const params = useLocalSearchParams<{ disputeId?: string; orderId?: string }>();
  const disputeId = typeof params.disputeId === "string" && params.disputeId ? params.disputeId : undefined;
  const orderIdParam = typeof params.orderId === "string" && params.orderId ? params.orderId : undefined;

  const [dispute, setDispute] = useState<PartyDispute | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failure, setFailure] = useState<ClassifiedFailure | null>(null);

  const [evidenceNote, setEvidenceNote] = useState("");
  const [evidenceText, setEvidenceText] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<null | "photo" | "text" | "message" | "appeal">(null);
  const [actionError, setActionError] = useState<{ scope: "photo" | "text" | "message" | "appeal"; text: string } | null>(null);
  const [appealOpen, setAppealOpen] = useState(false);
  const [appealReason, setAppealReason] = useState("");

  const upload = useAssetUpload("dispute_evidence", DISPUTE_EVIDENCE_MAX_BYTES);

  const load = useCallback(
    async (mode: "initial" | "refresh" | "silent" = "initial") => {
      if (!disputeId && !orderIdParam) {
        setFailure({ kind: "not_found", message: "No dispute was specified." });
        setLoading(false);
        return;
      }
      if (mode === "initial") setLoading(true);
      if (mode === "refresh") setRefreshing(true);
      try {
        const next = disputeId ? await disputeService.getById(disputeId) : await disputeService.getByOrder(orderIdParam as string);
        setDispute(next);
        setFailure(null);
        // Names/number come from the order; a failure here must not hide the dispute itself.
        orderService[next.yourRole === "BUYER" ? "getBuyerOrderById" : "getVendorOrderById"](next.orderId)
          .then(setOrder)
          .catch(() => undefined);
      } catch (err) {
        const f = classifyFailure(err, "This dispute could not be found. It may not exist, or it belongs to a different account.");
        // Keep showing stale data on silent/refresh failures; only replace the screen on a first load.
        if (mode === "initial" || !dispute) setFailure(f);
        else setActionError({ scope: "message", text: f.message });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [disputeId, orderIdParam],
  );

  useFocusEffect(
    useCallback(() => {
      void load(dispute ? "silent" : "initial");
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load]),
  );

  const names = useMemo(() => ({ buyer: order?.buyerName, vendor: order?.vendorName }), [order]);
  const editable = dispute ? canAddToDispute(dispute) : false;
  const appealAllowed = dispute ? canShowAppeal(dispute) : false;
  const deadline = deadlineCopy(dispute?.deadline);

  const afterWrite = async (err: unknown, scope: "photo" | "text" | "message" | "appeal") => {
    const f = classifyFailure(err);
    setActionError({ scope, text: f.message });
    // A 409 means the dispute state changed under us (closed / appeal filed): resync.
    if (f.kind === "conflict") await load("silent");
  };

  const submitPhoto = async () => {
    if (!dispute || upload.state.status !== "done" || !upload.state.assetId) return;
    setBusy("photo");
    setActionError(null);
    try {
      await disputeService.addEvidence(dispute.id, { kind: "PHOTO", uploadAssetId: upload.state.assetId, note: evidenceNote.trim() || undefined });
      upload.reset();
      setEvidenceNote("");
      await load("silent");
    } catch (err) {
      await afterWrite(err, "photo");
    } finally {
      setBusy(null);
    }
  };

  const submitText = async () => {
    if (!dispute) return;
    const text = evidenceText.trim();
    if (text.length < 5) {
      setActionError({ scope: "text", text: "Written evidence needs at least 5 characters." });
      return;
    }
    setBusy("text");
    setActionError(null);
    try {
      await disputeService.addEvidence(dispute.id, { kind: "TEXT", text });
      setEvidenceText("");
      await load("silent");
    } catch (err) {
      await afterWrite(err, "text");
    } finally {
      setBusy(null);
    }
  };

  const sendMessage = async () => {
    if (!dispute) return;
    const body = message.trim();
    if (body.length < 2) {
      setActionError({ scope: "message", text: "Write a message first." });
      return;
    }
    setBusy("message");
    setActionError(null);
    try {
      await disputeService.addMessage(dispute.id, body);
      setMessage("");
      await load("silent");
    } catch (err) {
      await afterWrite(err, "message");
    } finally {
      setBusy(null);
    }
  };

  const submitAppeal = async () => {
    if (!dispute) return;
    const reason = appealReason.trim();
    if (reason.length < 10) {
      setActionError({ scope: "appeal", text: "Please explain your appeal in at least 10 characters." });
      return;
    }
    setBusy("appeal");
    setActionError(null);
    try {
      await disputeService.requestAppeal(dispute.id, reason);
      setAppealOpen(false);
      setAppealReason("");
      await load("silent");
    } catch (err) {
      await afterWrite(err, "appeal");
    } finally {
      setBusy(null);
    }
  };

  const back = () => goBackOrReplace(router, fallbackRoute as never);
  const errorFor = (scope: "photo" | "text" | "message" | "appeal") =>
    actionError?.scope === scope ? <Text style={styles.errorInline}>{actionError.text}</Text> : null;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={back} activeOpacity={0.85} accessibilityLabel="Go back" accessibilityRole="button" style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#282828" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Dispute</Text>
          {order ? <Text style={styles.headerSub}>Order {order.orderNumber}</Text> : null}
        </View>
      </View>

      {loading ? (
        <LoadingState label="Loading dispute..." />
      ) : failure || !dispute ? (
        <FailureState
          failure={failure ?? { kind: "other", message: "Could not load this dispute." }}
          onRetry={() => void load("initial")}
          actionLabel={failure?.kind === "not_found" && reportIssueRoute && orderIdParam ? "Report an issue with this order" : undefined}
          onAction={reportIssueRoute && orderIdParam ? () => router.replace({ pathname: reportIssueRoute, params: { orderId: orderIdParam } } as never) : undefined}
        />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load("refresh")} tintColor="#076B51" />}
          >
            {/* Status */}
            <View style={styles.card}>
              <View style={styles.statusRow}>
                <Text style={styles.statusPill}>{disputeStatusLabel(dispute.status)}</Text>
                <Text style={styles.typeText}>{disputeTypeLabel(dispute.type)}</Text>
              </View>
              <Text style={styles.label}>Reported issue</Text>
              <Text style={styles.value}>{dispute.reason}</Text>
              {dispute.claim ? (
                <>
                  <Text style={styles.label}>Claim</Text>
                  <Text style={styles.value}>{dispute.claim}</Text>
                </>
              ) : null}
              <Text style={styles.metaText}>
                Opened {new Date(dispute.createdAt).toLocaleDateString()}
                {order ? ` - ${dispute.yourRole === "BUYER" ? order.vendorName : order.buyerName}` : ""}
              </Text>
              {deadline ? (
                <View style={[styles.banner, dispute.deadline.state === "OVERDUE" && styles.bannerWarn]}>
                  <Ionicons name="time-outline" size={16} color={dispute.deadline.state === "OVERDUE" ? "#B42318" : "#92400E"} />
                  <Text style={styles.bannerText}>{deadline}</Text>
                </View>
              ) : null}
              {dispute.evidenceRequestedAt && dispute.status === "OPEN" ? (
                <View style={styles.banner}>
                  <Ionicons name="document-text-outline" size={16} color="#92400E" />
                  <Text style={styles.bannerText}>
                    Eki support asked for more evidence
                    {dispute.evidenceRequestedFrom === dispute.yourRole ? " from you" : ` from the ${dispute.evidenceRequestedFrom === "BUYER" ? "buyer" : "seller"}`}.
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Decision / closed */}
            {dispute.status !== "OPEN" ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Decision</Text>
                <Text style={styles.value}>{disputeStatusLabel(dispute.status)}</Text>
                {dispute.decisionReason ? <Text style={styles.value}>{dispute.decisionReason}</Text> : dispute.resolution ? <Text style={styles.value}>{dispute.resolution}</Text> : null}
                {dispute.refundAmount != null && order ? (
                  <Text style={styles.metaText}>Refund amount: {formatDisplayMoney(dispute.refundAmount / 100, order.currency, order.currency)}</Text>
                ) : null}
                {dispute.resolvedAt ? <Text style={styles.metaText}>Decided {new Date(dispute.resolvedAt).toLocaleDateString()}</Text> : null}
              </View>
            ) : null}

            {/* Appeal */}
            {dispute.appealStatus !== "NONE" || appealAllowed ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Appeal</Text>
                {dispute.appealStatus === "REQUESTED" ? (
                  <Text style={styles.value}>An appeal has been filed and is under review. You can still add evidence and messages.</Text>
                ) : dispute.appealStatus === "UPHELD" ? (
                  <Text style={styles.value}>The appeal was reviewed and the original decision was upheld.</Text>
                ) : dispute.appealStatus === "OVERTURNED" ? (
                  <Text style={styles.value}>The appeal was reviewed and the original decision was overturned.</Text>
                ) : (
                  <Text style={styles.value}>
                    If you disagree with the decision you can ask for it to be reviewed
                    {dispute.appeal.appealWindowEndsAt ? ` until ${new Date(dispute.appeal.appealWindowEndsAt).toLocaleDateString()}` : ""}.
                  </Text>
                )}
                {dispute.appealReason ? <Text style={styles.metaText}>Appeal reason: {dispute.appealReason}</Text> : null}
                {dispute.appealDecisionReason ? <Text style={styles.metaText}>Review note: {dispute.appealDecisionReason}</Text> : null}
                {appealAllowed ? (
                  <TouchableOpacity onPress={() => { setActionError(null); setAppealOpen(true); }} activeOpacity={0.85} style={styles.primaryBtn} accessibilityRole="button">
                    <Text style={styles.primaryBtnText}>Appeal this decision</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}

            {/* Evidence */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Evidence</Text>
              {dispute.evidence.length === 0 ? (
                <Text style={styles.emptyText}>No evidence has been added yet.</Text>
              ) : (
                dispute.evidence.map((item) => (
                  <View key={item.id} style={styles.evidenceRow}>
                    {item.kind === "TEXT" ? (
                      <View style={styles.textEvidenceIcon}>
                        <Ionicons name="document-text-outline" size={22} color="#076B51" />
                      </View>
                    ) : item.contentType === "application/pdf" ? (
                      <View style={styles.textEvidenceIcon}>
                        <Ionicons name="document-outline" size={22} color="#076B51" />
                      </View>
                    ) : (
                      <ProofImage uri={item.url} label="evidence photo" />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.evidenceWho}>{partyLabel(item.submitterRole, dispute.yourRole, names)}</Text>
                      {item.text ? <Text style={styles.value}>{item.text}</Text> : null}
                      {item.note ? <Text style={styles.value}>{item.note}</Text> : null}
                      {item.kind === "DOCUMENT" ? <Text style={styles.metaText}>Document attached</Text> : null}
                      <Text style={styles.metaText}>{new Date(item.createdAt).toLocaleString()}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* Add evidence */}
            {editable ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Add evidence</Text>
                <PhotoAttach
                  state={upload.state}
                  onPick={(s) => { setActionError(null); void upload.pick(s); }}
                  onRetry={() => void upload.retry()}
                  onRemove={upload.reset}
                  maxLabel={`Up to ${formatBytes(DISPUTE_EVIDENCE_MAX_BYTES)}.`}
                  disabled={busy !== null}
                />
                {upload.state.previewUri ? (
                  <>
                    <TextInput
                      value={evidenceNote}
                      onChangeText={setEvidenceNote}
                      placeholder="Add a note about this photo (optional)"
                      placeholderTextColor="#8A8F94"
                      maxLength={1000}
                      style={styles.input}
                    />
                    {errorFor("photo")}
                    <TouchableOpacity
                      onPress={submitPhoto}
                      disabled={upload.state.status !== "done" || busy !== null}
                      activeOpacity={0.85}
                      style={[styles.primaryBtn, (upload.state.status !== "done" || busy !== null) && styles.disabled]}
                      accessibilityRole="button"
                    >
                      <Text style={styles.primaryBtnText}>{busy === "photo" ? "Submitting..." : actionError?.scope === "photo" ? "Retry submit" : "Submit photo"}</Text>
                    </TouchableOpacity>
                  </>
                ) : null}

                <Text style={[styles.label, { marginTop: 16 }]}>Or describe what happened</Text>
                <TextInput
                  value={evidenceText}
                  onChangeText={setEvidenceText}
                  multiline
                  textAlignVertical="top"
                  placeholder="Written evidence (at least 5 characters)"
                  placeholderTextColor="#8A8F94"
                  maxLength={4000}
                  style={[styles.input, styles.multiline]}
                />
                {errorFor("text")}
                <TouchableOpacity
                  onPress={submitText}
                  disabled={busy !== null || evidenceText.trim().length === 0}
                  activeOpacity={0.85}
                  style={[styles.secondaryBtn, (busy !== null || evidenceText.trim().length === 0) && styles.disabled]}
                  accessibilityRole="button"
                >
                  <Text style={styles.secondaryBtnText}>{busy === "text" ? "Adding..." : "Add written evidence"}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[styles.banner, { marginHorizontal: 0 }]}>
                <Ionicons name="lock-closed-outline" size={16} color="#687076" />
                <Text style={styles.bannerText}>This dispute is closed. Evidence and messages can no longer be added.</Text>
              </View>
            )}

            {/* Messages */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Messages</Text>
              {dispute.messages.length === 0 ? (
                <Text style={styles.emptyText}>No messages yet.</Text>
              ) : (
                dispute.messages.map((m) => {
                  const mine = m.authorRole === dispute.yourRole;
                  return (
                    <View key={m.id} style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                      <Text style={styles.bubbleWho}>{partyLabel(m.authorRole, dispute.yourRole, names)}</Text>
                      <Text style={styles.bubbleBody}>{m.body}</Text>
                      <Text style={styles.bubbleTime}>{new Date(m.createdAt).toLocaleString()}</Text>
                    </View>
                  );
                })
              )}
              {editable ? (
                <View style={{ marginTop: 12, gap: 8 }}>
                  <TextInput
                    value={message}
                    onChangeText={setMessage}
                    multiline
                    textAlignVertical="top"
                    placeholder="Write a message"
                    placeholderTextColor="#8A8F94"
                    maxLength={4000}
                    style={[styles.input, styles.multiline]}
                  />
                  {errorFor("message")}
                  <TouchableOpacity
                    onPress={sendMessage}
                    disabled={busy !== null || message.trim().length === 0}
                    activeOpacity={0.85}
                    style={[styles.primaryBtn, (busy !== null || message.trim().length === 0) && styles.disabled]}
                    accessibilityRole="button"
                  >
                    <Text style={styles.primaryBtnText}>{busy === "message" ? "Sending..." : "Send message"}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      <Modal visible={appealOpen} transparent animationType="fade" onRequestClose={() => setAppealOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionTitle}>Appeal this decision</Text>
            <Text style={styles.value}>Explain why you think the decision should be reviewed. An appeal can only be filed once.</Text>
            <TextInput
              value={appealReason}
              onChangeText={setAppealReason}
              multiline
              textAlignVertical="top"
              placeholder="Reason for appeal (at least 10 characters)"
              placeholderTextColor="#8A8F94"
              maxLength={2000}
              style={[styles.input, styles.multiline]}
            />
            {errorFor("appeal")}
            <TouchableOpacity onPress={submitAppeal} disabled={busy === "appeal"} activeOpacity={0.85} style={[styles.primaryBtn, busy === "appeal" && styles.disabled]} accessibilityRole="button">
              <Text style={styles.primaryBtnText}>{busy === "appeal" ? "Submitting..." : "Submit appeal"}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setAppealOpen(false)} activeOpacity={0.85} style={styles.linkBtn} accessibilityRole="button">
              <Text style={styles.linkText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  statusPill: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#076B51", backgroundColor: "rgba(7,107,81,0.08)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, overflow: "hidden", flexShrink: 1 },
  typeText: { fontSize: 12, fontFamily: "Outfit-Medium", color: "#687076" },
  sectionTitle: { fontSize: 17, fontFamily: "Manrope-Bold", color: "#282828" },
  label: { fontSize: 12, fontFamily: "Manrope-Bold", color: "#687076", marginTop: 6 },
  value: { fontSize: 14, lineHeight: 20, fontFamily: "Outfit-Regular", color: "#282828" },
  metaText: { fontSize: 12, lineHeight: 18, fontFamily: "Outfit-Regular", color: "#8A8F94" },
  emptyText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585" },
  banner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF3C7", borderRadius: 12, padding: 12, marginTop: 6 },
  bannerWarn: { backgroundColor: "#FEE4E2" },
  bannerText: { flex: 1, fontSize: 12, lineHeight: 18, fontFamily: "Outfit-Medium", color: "#444" },
  evidenceRow: { flexDirection: "row", gap: 12, paddingVertical: 8, alignItems: "flex-start" },
  textEvidenceIcon: { width: 96, height: 96, borderRadius: 12, backgroundColor: "#F0F7F4", alignItems: "center", justifyContent: "center" },
  evidenceWho: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#282828" },
  input: { backgroundColor: "#F6F7F7", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: "Outfit-Regular", color: "#282828", marginTop: 8 },
  multiline: { minHeight: 90 },
  errorInline: { fontSize: 12, fontFamily: "Outfit-Medium", color: "#FB6363", marginTop: 6 },
  primaryBtn: { marginTop: 10, height: 48, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  primaryBtnText: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  secondaryBtn: { marginTop: 10, height: 46, borderRadius: 14, borderWidth: 1.5, borderColor: "#076B51", alignItems: "center", justifyContent: "center" },
  secondaryBtnText: { fontSize: 14, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  disabled: { opacity: 0.5 },
  bubble: { borderRadius: 16, padding: 12, marginTop: 8, maxWidth: "88%" },
  bubbleMine: { alignSelf: "flex-end", backgroundColor: "#E6F2EE" },
  bubbleOther: { alignSelf: "flex-start", backgroundColor: "#F4F4F4" },
  bubbleWho: { fontSize: 11, fontFamily: "Manrope-Bold", color: "#687076" },
  bubbleBody: { fontSize: 14, lineHeight: 20, fontFamily: "Outfit-Regular", color: "#282828", marginTop: 2 },
  bubbleTime: { fontSize: 10, fontFamily: "Outfit-Regular", color: "#8A8F94", marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: { width: "100%", backgroundColor: "#FFFFFF", borderRadius: 24, padding: 20, gap: 8 },
  linkBtn: { alignItems: "center", paddingVertical: 10 },
  linkText: { fontSize: 14, fontFamily: "Manrope-SemiBold", color: "#687076" },
});
