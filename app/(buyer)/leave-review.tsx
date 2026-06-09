import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { reviewService } from "../../services/reviewService";
import { goBackOrReplace } from "../../utils/navigation";

export default function LeaveReviewScreen() {
  const router = useRouter();
  const { orderId, vendorId, productId } = useLocalSearchParams<{
    orderId?: string;
    vendorId?: string;
    productId?: string;
  }>();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    if (rating === 0) {
      setError("Please select a rating.");
      return;
    }
    if (!comment.trim()) {
      setError("Please write a short review.");
      return;
    }
    if (!orderId) {
      setError("Missing order reference.");
      return;
    }

    setSubmitting(true);
    try {
      await reviewService.submitReview({
        orderId,
        vendorId: vendorId || undefined,
        productId: productId || undefined,
        rating,
        comment: comment.trim(),
      });
      Alert.alert("Review Submitted", "Thank you for your feedback!", [
        { text: "OK", onPress: () => goBackOrReplace(router, "/(buyer)/orders" as any) },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not submit review.";
      const lower = msg.toLowerCase();
      if (lower.includes("already") || msg.includes("409")) {
        setError("You have already reviewed this order.");
      } else if (msg.includes("403") || lower.includes("not eligible") || lower.includes("forbidden")) {
        setError("Reviews are only allowed after delivery is confirmed.");
      } else if (msg.includes("401") || lower.includes("session expired")) {
        setError("Please log in again to leave a review.");
      } else if (msg.includes("400") || lower.includes("rating") || lower.includes("invalid")) {
        setError("Please pick a rating between 1 and 5 and add a comment.");
      } else if (msg.includes("404") || lower.includes("not found")) {
        setError("Reviews are not yet available on this server.");
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(buyer)/orders" as any)} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#282828" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Leave a Review</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>How was your experience?</Text>

          {/* Star rating */}
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => setRating(star)} activeOpacity={0.7}>
                <Ionicons
                  name={star <= rating ? "star" : "star-outline"}
                  size={36}
                  color={star <= rating ? "#D97706" : "#E0E0E0"}
                />
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.ratingLabel}>
            {rating === 0 ? "Tap to rate" : rating <= 2 ? "Could be better" : rating <= 3 ? "Good" : rating <= 4 ? "Great" : "Excellent!"}
          </Text>

          {/* Comment */}
          <Text style={styles.fieldLabel}>Your review</Text>
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="Share your experience with this order..."
            placeholderTextColor="#858585"
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            style={styles.textArea}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>

        <TouchableOpacity
          onPress={handleSubmit}
          activeOpacity={0.85}
          style={[styles.submitBtn, (submitting || rating === 0) && { opacity: 0.6 }]}
          disabled={submitting || rating === 0}
        >
          <Text style={styles.submitBtnText}>{submitting ? "Submitting..." : "Submit Review"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F9F9" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16, gap: 12 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#F4F4F4", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 22, fontFamily: "Manrope-Bold", color: "#282828" },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 24, marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontFamily: "Manrope-Bold", color: "#282828", marginBottom: 16, textAlign: "center" },
  starsRow: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 8 },
  ratingLabel: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", textAlign: "center", marginBottom: 24 },
  fieldLabel: { fontSize: 14, fontFamily: "Outfit-Medium", color: "#858585", marginBottom: 8 },
  textArea: { backgroundColor: "#F4F4F4", borderRadius: 12, minHeight: 120, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, fontFamily: "Outfit-Regular", color: "#282828" },
  errorText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#FB6363", textAlign: "center", marginTop: 12 },
  submitBtn: { height: 56, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  submitBtnText: { fontSize: 16, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
});
