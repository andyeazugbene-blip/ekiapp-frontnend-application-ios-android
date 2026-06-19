import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";

import { useAuthStore } from "../../stores/authStore";
import { useOnboardingStore } from "../../stores/onboardingStore";
import { productService } from "../../services/productService";
import { deliveryService } from "../../services/deliveryService";
import { getPublicStoreUrl } from "../../utils/shareLinks";
import { uploadService } from "../../services/uploadService";
import { vendorService } from "../../services/vendorService";

interface ChecklistItem {
  id: "foodstuff" | "delivery" | "verify" | "share";
  label: string;
  done: boolean;
}

type VerifyModal = "intro" | "why" | "identity" | "upload" | "face" | "submitted" | "verified" | "failed" | null;

/**
 * "Get your first order" activation screen — pixel-matched to screenshots
 * 8, 13–18.
 *
 * Sections:
 *  - Green hero with title, subtitle, and progress bar with 4 dots
 *  - White card with 4-step checklist (Add foodstuff / Set delivery /
 *    Verify your account / Share your store link)
 *  - Bottom green "Complete Next Step" button
 *  - Modals for Verify (intro / why / submitted / verified / failed),
 *    Share-store-link, and Verification CTA
 */
export default function ActivationScreen() {
  const router = useRouter();

  const [introShown, setIntroShown] = useState(false);
  const [verifyModal, setVerifyModal] = useState<VerifyModal>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasFoodstuff, setHasFoodstuff] = useState(false);
  const [hasDelivery, setHasDelivery] = useState(false);
  const [copied, setCopied] = useState(false);
  const [frontUri, setFrontUri] = useState<string | null>(null);
  const [backUri, setBackUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const user = useAuthStore((s) => s.user);
  const vendor = user?.role === "vendor" ? user : null;
  const { hasSharedLink, setHasSharedLink } = useOnboardingStore();

  const storeUrl = getPublicStoreUrl({
    shareUrl: vendor?.shareUrl,
    storeSlug: vendor?.storeSlug,
    storeName: vendor?.storeName,
  });

  const isVerified = vendor?.verificationStatus === "verified";
  const verificationStatus = vendor?.verificationStatus ?? "pending_docs";

  const checklist: ChecklistItem[] = [
    { id: "foodstuff", label: "Add your first foodstuff", done: hasFoodstuff },
    { id: "delivery", label: "Set delivery", done: hasDelivery },
    { id: "verify", label: "Verify your account", done: isVerified },
    { id: "share", label: "Share your store link", done: hasSharedLink },
  ];

  const doneCount = checklist.filter((c) => c.done).length;
  const progress = (doneCount / checklist.length) * 100;

  const refresh = useCallback(async () => {
    if (!vendor) return;
    setRefreshing(true);
    try {
      await useAuthStore.getState().checkAuth().catch(() => null);
      const [products, zones] = await Promise.all([
        productService.getMyVendorProducts().catch(() => []),
        deliveryService.listZones().catch(() => []),
      ]);
      setHasFoodstuff((products ?? []).length > 0);
      setHasDelivery((zones ?? []).length > 0);
    } finally {
      setRefreshing(false);
    }
  }, [vendor]);


  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const handleStepPress = (id: ChecklistItem["id"]) => {
    if (id === "share") setShowShareModal(true);
    else if (id === "verify") {
      // Pick the modal based on current backend status.
      if (verificationStatus === "verified") setVerifyModal("verified");
      else if (verificationStatus === "under_review") setVerifyModal("submitted");
      else if (verificationStatus === "rejected") setVerifyModal("failed");
      else setVerifyModal("intro");
    } else if (id === "foodstuff") router.push("/(vendor)/foodstuff-add" as any);
    else if (id === "delivery") router.push("/(vendor)/delivery" as any);
  };

  const handleNextStep = () => {
    const next = checklist.find((c) => !c.done);
    if (next) handleStepPress(next.id);
  };

  const handleShareWhatsApp = async () => {
    try {
      const result = await Share.share({
        message: `Check out my store on Eki! ${storeUrl}`,
      });
      if (result.action === Share.sharedAction) setHasSharedLink(true);
    } catch {
      /* ignored */
    }
  };

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(storeUrl);
      setCopied(true);
      setHasSharedLink(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignored */
    }
  };

  const pickFront = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!r.canceled && r.assets[0]) setFrontUri(r.assets[0].uri);
  };

  const pickBack = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!r.canceled && r.assets[0]) setBackUri(r.assets[0].uri);
  };

  const handleSubmitVerification = async () => {
    if (!frontUri) {
      Alert.alert("Missing ID", "Please upload the front of your ID.");
      return;
    }
    setUploading(true);
    try {
      const fileUrl = await uploadService.uploadImage(
        frontUri,
        "id-front.jpg",
        "image/jpeg",
        "verification"
      );
      const backUrl = backUri
        ? await uploadService.uploadImage(backUri, "id-back.jpg", "image/jpeg", "verification")
        : undefined;
      await vendorService.submitVerificationDocument({ type: "id", fileUrl, backUrl });
      await useAuthStore.getState().checkAuth().catch(() => null);
      setVerifyModal("submitted");

    } catch (err) {
      Alert.alert("Upload failed", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setUploading(false);
    }
  };

  if (!introShown) {
    return (
      <SafeAreaView style={styles.introContainer} edges={["top", "bottom"]}>
        <StatusBar style="dark" />

        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85} style={[styles.backButton, { backgroundColor: "#F4F4F4", alignSelf: "flex-start", marginLeft: 4 }]}>
          <Ionicons name="arrow-back" size={20} color="#282828" />
        </TouchableOpacity>
        <View style={styles.introTop}>
          <View style={styles.introIconWrap}>
            <Ionicons name="cube-outline" size={56} color="#076B51" />
          </View>
          <Text style={styles.introTitle}>Your Store Is Ready</Text>
          <Text style={styles.introSubtitle}>
            Your foodstuff is now set up and your{"\n"}store is ready for activation
          </Text>
        </View>

        <View style={styles.introBottom}>
          <Text style={styles.introBottomTitle}>{"Let's help you get\nyour first order"}</Text>
          <Text style={styles.introBottomSub}>
            Complete these steps so buyers can find you{"\n"}and place orders easily
          </Text>
          <TouchableOpacity
            activeOpacity={0.86}
            onPress={() => setIntroShown(true)}
            style={styles.introContinueBtn}
          >
            <Text style={styles.introContinueBtnText}>Continue</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" style={{ transform: [{ rotate: "-45deg" }] }} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      {/* ── Green hero ─────────────────────────────────────────────────── */}
      <LinearGradient
        colors={["#064E3B", "#076B51"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <SafeAreaView edges={["top"]}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.heroTitle}>Get your first order</Text>
          <Text style={styles.heroSubtitle}>Complete the steps below to start receiving buyers</Text>

          <View style={styles.progressRow}>
            <Text style={styles.progressText}>
              {doneCount} of {checklist.length} steps completed
            </Text>
            <Text style={styles.progressPercent}>{progress.toFixed(0)}%</Text>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
            <View style={styles.progressDots}>
              {checklist.map((item, i) => (
                <View key={i} style={[styles.progressDot, item.done && styles.progressDotDone]} />
              ))}
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Your first order</Text>

          {refreshing ? (
            <View style={styles.refreshingRow}>
              <ActivityIndicator color="#076B51" size="small" />
            </View>
          ) : null}

          <View style={styles.checklist}>
            {checklist.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => handleStepPress(item.id)}
                activeOpacity={0.85}
                style={styles.checkRow}
              >
                <View style={[styles.checkbox, item.done && styles.checkboxDone]}>
                  {item.done ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
                </View>
                <Text style={[styles.checkLabel, !item.done && styles.checkLabelMuted]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <SafeAreaView edges={["bottom"]} style={styles.bottomBar}>
        <TouchableOpacity
          onPress={handleNextStep}
          activeOpacity={0.86}
          style={styles.nextStepBtn}
        >
          <Text style={styles.nextStepBtnText}>Complete Next Step</Text>
        </TouchableOpacity>
      </SafeAreaView>

      {/* ── Share store link modal ─────────────────────────────────────── */}
      <Modal visible={showShareModal} transparent animationType="fade" onRequestClose={() => setShowShareModal(false)}>
        <ModalScrim onClose={() => setShowShareModal(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Send Your Store Link To{"\n"}Your Buyers</Text>
            <Text style={styles.modalBody}>
              Bring your existing buyers into Eki and{"\n"}manage orders in one place
            </Text>

            <View style={styles.linkRow}>
              <Text style={styles.linkText} numberOfLines={1}>
                {storeUrl}
              </Text>
              <TouchableOpacity onPress={handleCopy} activeOpacity={0.7}>
                <Ionicons name={copied ? "checkmark" : "copy-outline"} size={18} color="#858585" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={handleShareWhatsApp} activeOpacity={0.85} style={styles.shareDarkBtn}>
              <Text style={styles.shareDarkBtnText}>Share to WhatsApp</Text>
              <View style={styles.shareIconCircle}>
                <Ionicons name="logo-whatsapp" size={14} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleShareWhatsApp} activeOpacity={0.85} style={styles.shareDarkBtn}>
              <Text style={styles.shareDarkBtnText}>Share to Instagram</Text>
              <View style={styles.shareIconCircle}>
                <Ionicons name="logo-instagram" size={14} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            <View style={styles.infoNote}>
              <Text style={styles.infoNoteText}>
                Orders placed on Eki are easier to track{"\n"}and protected for both you and your buyer
              </Text>
            </View>

            <TouchableOpacity onPress={() => setShowShareModal(false)} activeOpacity={0.86} style={styles.doneBtn}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </ModalScrim>
      </Modal>

      {/* ── Verify modal — intro ───────────────────────────────────────── */}
      <Modal visible={verifyModal === "intro"} transparent animationType="fade" onRequestClose={() => setVerifyModal(null)}>
        <ModalScrim onClose={() => setVerifyModal(null)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Verify Your Account To{"\n"}Receive Orders</Text>
            <Text style={styles.modalBody}>
              This helps protect your payment, build{"\n"}buyer trust, and keep the platform secure
            </Text>

            <TouchableOpacity
              onPress={() => setVerifyModal("why")}
              activeOpacity={0.86}
              style={styles.primaryModalBtn}
            >
              <Text style={styles.primaryModalText}>Verify Now</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setVerifyModal(null)}
              activeOpacity={0.86}
              style={styles.outlineModalBtn}
            >
              <Text style={styles.outlineModalText}>Do This Later</Text>
            </TouchableOpacity>

            <View style={styles.warningNote}>
              <Text style={styles.warningNoteText}>
                Your dashboard will still work, but buyers cannot place orders until your account is verified.
              </Text>
            </View>
          </View>
        </ModalScrim>
      </Modal>

      {/* ── Verify modal — why ─────────────────────────────────────────── */}
      <Modal visible={verifyModal === "why"} transparent animationType="fade" onRequestClose={() => setVerifyModal(null)}>
        <ModalScrim onClose={() => setVerifyModal(null)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Why Verification Matters</Text>

            <View style={styles.whyList}>
              <WhyRow icon="home-outline" label="Receive orders safely" />
              <WhyRow icon="wallet-outline" label="Get paid securely" />
              <WhyRow icon="person-outline" label="Show buyers your store is trusted" />
            </View>

            <TouchableOpacity
              onPress={() => setVerifyModal("identity")}
              activeOpacity={0.86}
              style={styles.primaryModalBtn}
            >
              <Text style={styles.primaryModalText}>Continue to Verification</Text>
            </TouchableOpacity>
          </View>
        </ModalScrim>
      </Modal>

      {/* ── Verify modal — identity (figma_027) ───────────────────────── */}
      <Modal visible={verifyModal === "identity"} transparent animationType="fade" onRequestClose={() => setVerifyModal(null)}>
        <ModalScrim onClose={() => setVerifyModal(null)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Secure Identity Check</Text>
            <Text style={styles.modalBody}>
              You'll need a valid ID and a quick face scan.
            </Text>

            <TouchableOpacity
              onPress={() => setVerifyModal("upload")}
              activeOpacity={0.86}
              style={styles.primaryModalBtn}
            >
              <Text style={styles.primaryModalText}>Start Verification Now</Text>
            </TouchableOpacity>

            <View style={styles.timerNote}>
              <Ionicons name="time-outline" size={14} color="#856B0E" />
              <Text style={styles.timerNoteText}>This usually takes only a few minutes</Text>
            </View>
          </View>
        </ModalScrim>
      </Modal>

      {/* ── Verify modal — upload ID (figma_028) ──────────────────────── */}
      <Modal visible={verifyModal === "upload"} transparent animationType="fade" onRequestClose={() => setVerifyModal(null)}>
        <ModalScrim onClose={() => setVerifyModal(null)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Upload Front Of ID</Text>
            <Text style={styles.modalBody}>
              Use a clear photo of your government-issued ID
            </Text>

            <TouchableOpacity onPress={pickFront} activeOpacity={0.85} style={[styles.uploadZone, !!frontUri && styles.uploadZoneDone]}>
              <Ionicons name="cloud-upload-outline" size={22} color="#076B51" />
              <Text style={styles.uploadZoneText}>{frontUri ? "Front of ID ✓" : "Upload Front of ID"}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={pickBack} activeOpacity={0.85} style={[styles.uploadZone, !!backUri && styles.uploadZoneDone]}>
              <Ionicons name="cloud-upload-outline" size={22} color="#076B51" />
              <Text style={styles.uploadZoneText}>{backUri ? "Back of ID ✓" : "Upload Back of ID"}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                if (!frontUri) {
                  Alert.alert("Missing ID", "Please upload the front of your ID.");
                  return;
                }
                setVerifyModal("face");
              }}
              activeOpacity={0.86}
              style={[styles.primaryModalBtn, { marginTop: 6 }]}
            >
              <Text style={styles.primaryModalText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </ModalScrim>
      </Modal>

      {/* ── Verify modal — face scan (figma_029) ──────────────────────── */}
      <Modal visible={verifyModal === "face"} transparent={false} animationType="slide" onRequestClose={() => setVerifyModal("upload")}>
        <View style={styles.faceScreen}>
          <StatusBar style="light" />
          <View style={styles.faceFrameWrap}>
            <View style={styles.faceFrame}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
              <View style={styles.scanLine} />
            </View>
          </View>
          <View style={styles.faceFooter}>
            <Text style={styles.faceTitleText}>Confirm Your Identity</Text>
            <Text style={styles.faceBodyText}>Take a quick face scan so we can match it to your ID.</Text>
            <TouchableOpacity
              onPress={handleSubmitVerification}
              disabled={uploading}
              activeOpacity={0.86}
              style={[styles.faceContinueBtn, uploading && { opacity: 0.6 }]}
            >
              <Text style={styles.faceContinueBtnText}>{uploading ? "Submitting..." : "Continue"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Verify modal — submitted (Verification Submitted) ─────────── */}
      <Modal visible={verifyModal === "submitted"} transparent animationType="fade" onRequestClose={() => setVerifyModal(null)}>
        <ModalScrim onClose={() => setVerifyModal(null)}>
          <View style={styles.modalCard}>
            <View style={styles.statusIcon}>
              <Ionicons name="time-outline" size={28} color="#076B51" />
            </View>
            <Text style={styles.modalTitle}>Verification Submitted</Text>
            <Text style={styles.modalBody}>
              We're reviewing your details. We'll notify you{"\n"}as soon as your account is approved.
            </Text>

            <TouchableOpacity
              onPress={() => setVerifyModal(null)}
              activeOpacity={0.86}
              style={styles.primaryModalBtn}
            >
              <Text style={styles.primaryModalText}>Go to Dashboard</Text>
            </TouchableOpacity>
          </View>
        </ModalScrim>
      </Modal>

      {/* ── Verify modal — verified ────────────────────────────────────── */}
      <Modal visible={verifyModal === "verified"} transparent animationType="fade" onRequestClose={() => setVerifyModal(null)}>
        <ModalScrim onClose={() => setVerifyModal(null)}>
          <View style={styles.modalCard}>
            <View style={styles.statusIcon}>
              <Ionicons name="checkmark-circle-outline" size={28} color="#076B51" />
            </View>
            <Text style={styles.modalTitle}>You're Verified</Text>
            <Text style={styles.modalBody}>Your store can now receive orders and payouts.</Text>

            <TouchableOpacity
              onPress={() => {
                setVerifyModal(null);
                router.replace("/(vendor)" as any);
              }}
              activeOpacity={0.86}
              style={styles.primaryModalBtn}
            >
              <Text style={styles.primaryModalText}>Start Selling</Text>
            </TouchableOpacity>
          </View>
        </ModalScrim>
      </Modal>

      {/* ── Verify modal — failed ──────────────────────────────────────── */}
      <Modal visible={verifyModal === "failed"} transparent animationType="fade" onRequestClose={() => setVerifyModal(null)}>
        <ModalScrim onClose={() => setVerifyModal(null)}>
          <View style={styles.modalCard}>
            <View style={styles.statusIcon}>
              <Ionicons name="information-circle-outline" size={28} color="#076B51" />
            </View>
            <Text style={styles.modalTitle}>We Couldn't Complete{"\n"}Your Verification</Text>
            <Text style={styles.modalBody}>Please recheck your ID photo or try again</Text>

            <TouchableOpacity
              onPress={() => setVerifyModal("identity")}
              activeOpacity={0.86}
              style={styles.primaryModalBtn}
            >
              <Text style={styles.primaryModalText}>Try Again</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setVerifyModal(null)}
              activeOpacity={0.86}
              style={styles.outlineModalBtn}
            >
              <Ionicons name="help-circle-outline" size={16} color="#076B51" />
              <Text style={[styles.outlineModalText, { marginLeft: 6 }]}>Contact Support</Text>
            </TouchableOpacity>
          </View>
        </ModalScrim>
      </Modal>
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────

function WhyRow({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.whyRow}>
      <View style={styles.whyIcon}>
        <Ionicons name={icon} size={18} color="#076B51" />
      </View>
      <Text style={styles.whyLabel}>{label}</Text>
    </View>
  );
}

function ModalScrim({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <View style={styles.modalOverlay}>
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      <View style={styles.modalInner}>
        {children}
        <TouchableOpacity onPress={onClose} activeOpacity={0.86} style={styles.closeCircle}>
          <Ionicons name="close" size={18} color="#1A1A1A" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F4F4F4" },

  // ── Intro phase (figma_021) ───────────────────────────────────────────
  introContainer: { flex: 1, backgroundColor: "#F4F4F4" },
  introTop: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  introIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  introTitle: {
    fontSize: 26,
    fontFamily: "Manrope-Bold",
    color: "#1A1A1A",
    textAlign: "center",
    marginBottom: 10,
  },
  introSubtitle: {
    fontSize: 14,
    fontFamily: "Outfit-Regular",
    color: "#858585",
    textAlign: "center",
    lineHeight: 21,
  },
  introBottom: {
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  introBottomTitle: {
    fontSize: 28,
    fontFamily: "Manrope-Bold",
    color: "#1A1A1A",
    lineHeight: 34,
    marginBottom: 10,
  },
  introBottomSub: {
    fontSize: 13,
    fontFamily: "Outfit-Regular",
    color: "#858585",
    lineHeight: 19,
    marginBottom: 22,
  },
  introContinueBtn: {
    height: 56,
    borderRadius: 16,
    backgroundColor: "#076B51",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  introContinueBtnText: { fontSize: 16, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },

  hero: {
    paddingHorizontal: 22,
    paddingBottom: 26,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 28,
    fontFamily: "Manrope-ExtraBold",
    color: "#FFFFFF",
    lineHeight: 34,
  },
  heroSubtitle: {
    fontSize: 13,
    fontFamily: "Outfit-Regular",
    color: "rgba(255,255,255,0.78)",
    marginTop: 6,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 22,
  },
  progressText: { fontSize: 12, fontFamily: "Outfit-Medium", color: "rgba(255,255,255,0.85)" },
  progressPercent: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.20)",
    marginTop: 10,
    overflow: "hidden",
    position: "relative",
    justifyContent: "center",
  },
  progressFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  progressDots: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 14,
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.45)",
  },
  progressDotDone: { backgroundColor: "#FFFFFF" },

  scrollContent: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 90 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  sectionTitle: { fontSize: 17, fontFamily: "Manrope-Bold", color: "#1A1A1A", marginBottom: 14 },
  refreshingRow: { paddingBottom: 8 },
  checklist: { gap: 10 },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F4F4F4",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: "#C5C5C5",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxDone: { backgroundColor: "#076B51", borderColor: "#076B51" },
  checkLabel: { flex: 1, fontSize: 14, fontFamily: "Manrope-SemiBold", color: "#1A1A1A" },
  checkLabelMuted: { color: "#858585", fontFamily: "Outfit-Medium" },

  bottomBar: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12 },
  nextStepBtn: {
    height: 56,
    borderRadius: 16,
    backgroundColor: "#076B51",
    alignItems: "center",
    justifyContent: "center",
  },
  nextStepBtnText: { fontSize: 15, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },

  // ── Modals ────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 22,
  },
  modalInner: { width: "100%", alignItems: "center" },
  modalCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 22,
    alignItems: "center",
  },
  statusIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "rgba(7,107,81,0.10)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Manrope-Bold",
    color: "#1A1A1A",
    textAlign: "center",
    lineHeight: 24,
  },
  modalBody: {
    fontSize: 13,
    fontFamily: "Outfit-Regular",
    color: "#858585",
    textAlign: "center",
    marginTop: 10,
    lineHeight: 18,
    marginBottom: 18,
  },

  // Share modal
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    backgroundColor: "#F4F4F4",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  linkText: { flex: 1, fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585" },
  shareDarkBtn: {
    width: "100%",
    height: 50,
    borderRadius: 14,
    backgroundColor: "#1A1A1A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 10,
  },
  shareDarkBtnText: { fontSize: 14, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  shareIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  infoNote: {
    width: "100%",
    backgroundColor: "#E8F4ED",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  infoNoteText: {
    fontSize: 12,
    fontFamily: "Outfit-Regular",
    color: "#076B51",
    lineHeight: 17,
    textAlign: "center",
  },
  doneBtn: {
    width: "100%",
    height: 50,
    borderRadius: 14,
    backgroundColor: "#076B51",
    alignItems: "center",
    justifyContent: "center",
  },
  doneBtnText: { fontSize: 15, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },

  // Verify modals
  primaryModalBtn: {
    width: "100%",
    height: 50,
    borderRadius: 14,
    backgroundColor: "#076B51",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  primaryModalText: { fontSize: 15, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  outlineModalBtn: {
    width: "100%",
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#076B51",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  outlineModalText: { fontSize: 15, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  warningNote: {
    width: "100%",
    backgroundColor: "#FFF6E0",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 14,
  },
  warningNoteText: {
    fontSize: 12,
    fontFamily: "Outfit-Regular",
    color: "#856B0E",
    lineHeight: 17,
    textAlign: "center",
  },

  // Why list
  whyList: { width: "100%", gap: 8, marginTop: 6, marginBottom: 14 },
  whyRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F4F4F4",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  whyIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  whyLabel: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#1A1A1A" },

  closeCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },

  // ── Identity modal (figma_027) ─────────────────────────────────────────
  timerNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    width: "100%",
    backgroundColor: "#FFF6E0",
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    marginTop: 12,
  },
  timerNoteText: {
    fontSize: 12,
    fontFamily: "Outfit-Regular",
    color: "#856B0E",
    flex: 1,
  },

  // ── Upload modal (figma_028) ───────────────────────────────────────────
  uploadZone: {
    width: "100%",
    height: 80,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#C5EBD8",
    borderStyle: "dashed",
    backgroundColor: "#F0FAF5",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 10,
  },
  uploadZoneDone: {
    borderColor: "#076B51",
    backgroundColor: "#E8F5EE",
  },
  uploadZoneText: {
    fontSize: 13,
    fontFamily: "Manrope-SemiBold",
    color: "#076B51",
  },

  // ── Face scan screen (figma_029) ───────────────────────────────────────
  faceScreen: {
    flex: 1,
    backgroundColor: "#1A1A1A",
    justifyContent: "flex-end",
  },
  faceFrameWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  faceFrame: {
    width: 260,
    height: 320,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  corner: {
    position: "absolute",
    width: 28,
    height: 28,
    borderColor: "#FFFFFF",
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 4 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 4 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 4 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 4 },
  scanLine: {
    position: "absolute",
    width: "100%",
    height: 1.5,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  faceFooter: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 36,
    alignItems: "center",
  },
  faceTitleText: {
    fontSize: 20,
    fontFamily: "Manrope-Bold",
    color: "#1A1A1A",
    marginBottom: 8,
    textAlign: "center",
  },
  faceBodyText: {
    fontSize: 13,
    fontFamily: "Outfit-Regular",
    color: "#858585",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 22,
  },
  faceContinueBtn: {
    width: "100%",
    height: 54,
    borderRadius: 14,
    backgroundColor: "#076B51",
    alignItems: "center",
    justifyContent: "center",
  },
  faceContinueBtnText: {
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
    color: "#FFFFFF",
  },
});
