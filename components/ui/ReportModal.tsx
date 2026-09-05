import React, { useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  reportService,
  type ReportReason,
  type ReportTargetType,
} from "../../services/reportService";

const REASONS: { key: ReportReason; label: string; icon: string }[] = [
  { key: "inappropriate", label: "Inappropriate content", icon: "alert-circle-outline" },
  { key: "spam", label: "Spam or misleading", icon: "megaphone-outline" },
  { key: "harassment", label: "Harassment or bullying", icon: "hand-left-outline" },
  { key: "fraud", label: "Fraud or scam", icon: "warning-outline" },
  { key: "other", label: "Other", icon: "ellipsis-horizontal-circle-outline" },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
  targetLabel?: string;
}

export function ReportModal({ visible, onClose, targetType, targetId, targetLabel }: Props) {
  const [selected, setSelected] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setSelected(null);
    setDetails("");
    setSubmitting(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!selected) {
      Alert.alert("Select a reason", "Please select why you are reporting this content.");
      return;
    }
    setSubmitting(true);
    try {
      await reportService.submitReport(targetType, targetId, selected, details.trim() || undefined);
      Alert.alert(
        "Report submitted",
        "Thank you for helping keep Eki safe. We will review this report shortly.",
        [{ text: "OK", onPress: handleClose }],
      );
    } catch {
      Alert.alert("Could not submit report", "Please try again later.");
    } finally {
      setSubmitting(false);
    }
  };

  const typeLabel =
    targetType === "review" ? "Review" :
    targetType === "message" ? "Message" :
    targetType === "product" ? "Product" :
    "Store";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Report {typeLabel}</Text>
            <TouchableOpacity onPress={handleClose} activeOpacity={0.7} accessibilityLabel="Close report dialog" accessibilityRole="button" style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#282828" />
            </TouchableOpacity>
          </View>

          {targetLabel ? (
            <Text style={styles.targetLabel} numberOfLines={2}>{targetLabel}</Text>
          ) : null}

          <Text style={styles.subtitle}>Why are you reporting this?</Text>

          <ScrollView style={styles.scroll} bounces={false} showsVerticalScrollIndicator={false}>
            {REASONS.map((r) => (
              <TouchableOpacity
                key={r.key}
                activeOpacity={0.7}
                onPress={() => setSelected(r.key)}
                style={[styles.reasonRow, selected === r.key && styles.reasonRowSelected]}
              >
                <Ionicons
                  name={r.icon as any}
                  size={20}
                  color={selected === r.key ? "#076B51" : "#858585"}
                />
                <Text style={[styles.reasonLabel, selected === r.key && styles.reasonLabelSelected]}>
                  {r.label}
                </Text>
                {selected === r.key && (
                  <Ionicons name="checkmark-circle" size={20} color="#076B51" />
                )}
              </TouchableOpacity>
            ))}

            <TextInput
              style={styles.detailsInput}
              placeholder="Add more details (optional)"
              placeholderTextColor="#B0B0B0"
              value={details}
              onChangeText={setDetails}
              multiline
              maxLength={500}
            />
          </ScrollView>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleSubmit}
            disabled={!selected || submitting}
            style={[styles.submitBtn, (!selected || submitting) && styles.submitBtnDisabled]}
          >
            <Text style={styles.submitText}>
              {submitting ? "Submitting..." : "Submit Report"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 34,
    maxHeight: "80%",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E0E0E0",
    marginTop: 12,
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 20,
    fontFamily: "Manrope-Bold",
    color: "#1A1A1A",
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F4F4F4",
    alignItems: "center",
    justifyContent: "center",
  },
  targetLabel: {
    fontSize: 13,
    fontFamily: "Outfit-Regular",
    color: "#858585",
    marginTop: 6,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Outfit-Medium",
    color: "#555555",
    marginTop: 18,
    marginBottom: 12,
  },
  scroll: {
    maxHeight: 340,
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 6,
    backgroundColor: "#F9F9F9",
  },
  reasonRowSelected: {
    backgroundColor: "#E8F4ED",
    borderWidth: 1,
    borderColor: "#076B51",
  },
  reasonLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Outfit-Regular",
    color: "#282828",
  },
  reasonLabelSelected: {
    fontFamily: "Outfit-Medium",
    color: "#076B51",
  },
  detailsInput: {
    marginTop: 12,
    minHeight: 80,
    borderRadius: 14,
    backgroundColor: "#F4F4F4",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    fontSize: 14,
    fontFamily: "Outfit-Regular",
    color: "#282828",
    textAlignVertical: "top",
  },
  submitBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: "#D32F2F",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitText: {
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
    color: "#FFFFFF",
  },
});
