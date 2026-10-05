import React, { useState } from "react";
import { Image, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { DeliveryProofItem } from "../../services/disputeService";

const KIND_LABEL: Record<string, string> = {
  DELIVERY_PHOTO: "Delivery photo",
  PICKUP_CONFIRMATION: "Pickup confirmation",
  SIGNATURE: "Signature",
  NOTE: "Note",
};

/** Tappable thumbnail of a short-lived signed URL. Falls back to a neutral tile if the link has expired. */
export function ProofImage({ uri, size = 96, label }: { uri: string | null; size?: number; label: string }) {
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  if (!uri || failed) {
    return (
      <View style={[styles.fallback, { width: size, height: size }]} accessibilityLabel={`${label} unavailable`}>
        <Ionicons name="image-outline" size={22} color="#B0B0B0" />
        <Text style={styles.fallbackText}>Unavailable</Text>
      </View>
    );
  }
  return (
    <>
      <TouchableOpacity onPress={() => setOpen(true)} activeOpacity={0.85} accessibilityRole="imagebutton" accessibilityLabel={`Open ${label}`}>
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: 12, backgroundColor: "#F0E6D4" }} onError={() => setFailed(true)} />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.viewer}>
          <Image source={{ uri }} style={styles.viewerImage} resizeMode="contain" onError={() => { setOpen(false); setFailed(true); }} />
          <TouchableOpacity onPress={() => setOpen(false)} style={styles.viewerClose} accessibilityRole="button" accessibilityLabel="Close photo">
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

/** Read-only list of delivery proof items (used by buyer tracking and the vendor proof screen). */
export function DeliveryProofList({ items, byLabel = "Seller" }: { items: DeliveryProofItem[]; byLabel?: string }) {
  return (
    <View style={{ gap: 14 }}>
      {items.map((item) => (
        <View key={item.id} style={styles.row}>
          {item.uploadAssetId ? <ProofImage uri={item.url} label={KIND_LABEL[item.kind] ?? "Proof"} /> : null}
          <View style={{ flex: 1 }}>
            <Text style={styles.kind}>{KIND_LABEL[item.kind] ?? "Proof"}</Text>
            {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
            <Text style={styles.meta}>
              Added by {item.submitterRole === "ADMIN" ? "Eki support" : item.submitterRole === "COURIER" ? "Courier" : byLabel} - {new Date(item.createdAt).toLocaleString()}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  kind: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#282828" },
  note: { fontSize: 13, lineHeight: 19, fontFamily: "Outfit-Regular", color: "#444", marginTop: 4 },
  meta: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#8A8F94", marginTop: 4 },
  fallback: { borderRadius: 12, backgroundColor: "#F4F4F4", alignItems: "center", justifyContent: "center", gap: 4 },
  fallbackText: { fontSize: 10, fontFamily: "Outfit-Regular", color: "#8A8F94" },
  viewer: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" },
  viewerImage: { width: "100%", height: "80%" },
  viewerClose: { position: "absolute", top: 50, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
});
