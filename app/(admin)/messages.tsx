import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { adminService, type AdminUser } from "../../services/adminService";
import { messageService } from "../../services/messageService";
import type { VendorSummary } from "../../types/vendor";
import { RemoteImage } from "../../components/ui/RemoteImage";

type AudienceKey =
  | "individual_vendor"
  | "individual_buyer"
  | "all_vendors"
  | "all_buyers"
  | "inactive_vendors"
  | "vendors_no_first_sale"
  | "buyers_in_uk"
  | "vendors_expiring_plans";

type ChannelKey = "in_app" | "push" | "sms" | "email";

const AUDIENCES: { id: AudienceKey; label: string; description: string }[] = [
  { id: "individual_vendor", label: "Individual vendor", description: "Send message to a specific vendor" },
  { id: "individual_buyer", label: "Individual buyer", description: "Send message to a specific buyer" },
  { id: "all_vendors", label: "All vendors", description: "Send message to all active vendors" },
  { id: "all_buyers", label: "All buyers", description: "Send message to all buyers" },
  { id: "inactive_vendors", label: "Inactive vendors", description: "Send message to inactive vendors" },
  { id: "vendors_no_first_sale", label: "Vendors with no first sale", description: "Send message to vendors with no first sale" },
  { id: "buyers_in_uk", label: "Buyers in UK", description: "Send message to buyers in United Kingdom" },
  { id: "vendors_expiring_plans", label: "Vendors with expiring plans", description: "Send message to vendors with expiring plans" },
];

const CHANNELS: { id: ChannelKey; label: string; subtitle: string; icon: React.ComponentProps<typeof Ionicons>["name"] }[] = [
  { id: "in_app", label: "In-app", subtitle: "Send message inside the app", icon: "checkmark-done-outline" },
  { id: "push", label: "Push", subtitle: "Send push notification", icon: "notifications-outline" },
  { id: "sms", label: "WhatsApp / SMS", subtitle: "Send via WhatsApp or SMS", icon: "chatbubble-ellipses-outline" },
  { id: "email", label: "Email", subtitle: "Send via email", icon: "mail-outline" },
];

function computeVendorSegment(vendor: VendorSummary) {
  if (vendor.adminStatus === "suspended") return "inactive";
  if ((vendor.totalOrders ?? 0) === 0) return "no-first-sale";
  if (vendor.subscriptionPlan === "free") return "expiring";
  return "active";
}

function audienceRecipients(audience: AudienceKey, vendors: VendorSummary[], buyers: AdminUser[]) {
  switch (audience) {
    case "all_vendors":
      return vendors.filter((vendor) => vendor.adminStatus !== "suspended" && vendor.userId);
    case "all_buyers":
      return buyers.filter((buyer) => buyer.status === "active");
    case "inactive_vendors":
      return vendors.filter((vendor) => computeVendorSegment(vendor) === "inactive" && vendor.userId);
    case "vendors_no_first_sale":
      return vendors.filter((vendor) => computeVendorSegment(vendor) === "no-first-sale" && vendor.userId);
    case "buyers_in_uk":
      return buyers.filter((buyer) => buyer.status === "active" && buyer.email);
    case "vendors_expiring_plans":
      return vendors.filter((vendor) => computeVendorSegment(vendor) === "expiring" && vendor.userId);
    default:
      return [];
  }
}

export default function AdminMessagesScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [vendors, setVendors] = useState<VendorSummary[]>([]);
  const [buyers, setBuyers] = useState<AdminUser[]>([]);
  const [audience, setAudience] = useState<AudienceKey>("individual_vendor");
  const [query, setQuery] = useState("");
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [selectedBuyerId, setSelectedBuyerId] = useState("");
  const [message, setMessage] = useState("");
  const [selectedChannels, setSelectedChannels] = useState<ChannelKey[]>(["in_app", "sms"]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextVendors, nextBuyers] = await Promise.all([
        adminService.getVendors(),
        adminService.getUsers({ role: "buyer" }),
      ]);
      setVendors(nextVendors);
      setBuyers(nextBuyers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load admin communication recipients.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const filteredVendors = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return vendors;
    return vendors.filter((vendor) =>
      [vendor.storeName, vendor.ownerName, vendor.country, vendor.city].join(" ").toLowerCase().includes(needle),
    );
  }, [query, vendors]);

  const filteredBuyers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return buyers;
    return buyers.filter((buyer) =>
      [buyer.name, buyer.email, buyer.role, buyer.status].join(" ").toLowerCase().includes(needle),
    );
  }, [buyers, query]);

  const selectedVendor = vendors.find((vendor) => vendor.id === selectedVendorId) ?? null;
  const selectedBuyer = buyers.find((buyer) => buyer.id === selectedBuyerId) ?? null;

  const selectedTargetLabel =
    audience === "individual_vendor"
      ? selectedVendor?.storeName
      : audience === "individual_buyer"
        ? selectedBuyer?.name || selectedBuyer?.email
        : AUDIENCES.find((item) => item.id === audience)?.label;

  const toggleChannel = (channel: ChannelKey) => {
    setSelectedChannels((current) =>
      current.includes(channel) ? current.filter((item) => item !== channel) : [...current, channel],
    );
  };

  const sendDirectMessage = async (participantId: string, body: string) => {
    const conversation = await messageService.createConversation(participantId);
    await messageService.sendMessage(conversation.id, { text: body });
  };

  const handleSend = async () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      Alert.alert("Message missing", "Write the message first.");
      return;
    }
    if (selectedChannels.length === 0) {
      Alert.alert("Select channel", "Choose at least one delivery channel.");
      return;
    }

    setSending(true);
    try {
      if (audience === "individual_vendor") {
        if (!selectedVendor?.userId) throw new Error("Select a vendor with a linked user account.");
        await sendDirectMessage(selectedVendor.userId, trimmedMessage);
      } else if (audience === "individual_buyer") {
        if (!selectedBuyer?.id) throw new Error("Select a buyer first.");
        await sendDirectMessage(selectedBuyer.id, trimmedMessage);
      } else if (audience === "all_vendors" || audience === "all_buyers") {
        const broadcastAudience = audience === "all_vendors" ? "vendors" : "buyers";
        const channel =
          selectedChannels.includes("in_app") && selectedChannels.includes("push")
            ? "in_app_push"
            : selectedChannels.includes("push")
              ? "push"
              : "in_app";
        await adminService.sendBroadcast({
          audience: broadcastAudience,
          channel,
          subject: "Message from Eki Admin",
          body: trimmedMessage,
        });
      } else {
        const recipients = audienceRecipients(audience, vendors, buyers);
        if (!recipients.length) {
          throw new Error("No recipients matched this audience yet.");
        }

        for (const recipient of recipients) {
          const participantId = "userId" in recipient ? recipient.userId : recipient.id;
          if (!participantId) continue;
          await sendDirectMessage(participantId, trimmedMessage);
        }
      }

      Alert.alert("Message sent", `${selectedTargetLabel || "Audience"} has been updated.`, [
        { text: "OK" },
      ]);
      setMessage("");
    } catch (err) {
      Alert.alert("Send failed", err instanceof Error ? err.message : "Could not send this message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#0A6C52" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Communication center</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#0A6C52" />
          </View>
        ) : (
          <>
            {!!error && <Text style={styles.errorText}>{error}</Text>}

            <Text style={styles.sectionTitle}>Select Target</Text>

            <View style={styles.audienceList}>
              {AUDIENCES.map((item) => {
                const selected = audience === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => setAudience(item.id)}
                    activeOpacity={0.85}
                    style={[styles.audienceItem, selected && styles.audienceItemSelected]}
                  >
                    <View style={[styles.radio, selected && styles.radioSelected]}>
                      {selected ? <View style={styles.radioDot} /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.audienceTitle}>{item.label}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {(audience === "individual_vendor" || audience === "individual_buyer") ? (
              <View style={styles.selectorCard}>
                <View style={styles.searchRow}>
                  <Ionicons name="search-outline" size={20} color="#A4A8AB" />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder={audience === "individual_vendor" ? "Mama Chi.." : "Search buyer..."}
                    placeholderTextColor="#A4A8AB"
                    style={styles.searchInput}
                  />
                </View>

                <View style={{ gap: 12 }}>
                  {(audience === "individual_vendor" ? filteredVendors : filteredBuyers).slice(0, 6).map((entry) => {
                    const isVendor = audience === "individual_vendor";
                    const selected = isVendor ? selectedVendorId === (entry as VendorSummary).id : selectedBuyerId === (entry as AdminUser).id;
                    const title = isVendor ? (entry as VendorSummary).storeName : (entry as AdminUser).name || (entry as AdminUser).email;
                    const subtitle = isVendor
                      ? [(entry as VendorSummary).city, (entry as VendorSummary).country].filter(Boolean).join(", ")
                      : (entry as AdminUser).email;

                    return (
                      <TouchableOpacity
                        key={entry.id}
                        onPress={() => (isVendor ? setSelectedVendorId(entry.id) : setSelectedBuyerId(entry.id))}
                        activeOpacity={0.85}
                        style={[styles.recipientCard, selected && styles.recipientCardSelected]}
                      >
                        {isVendor ? (
                          <RemoteImage
                            uri={(entry as VendorSummary).avatar || (entry as VendorSummary).coverImage}
                            style={styles.recipientAvatar}
                            borderRadius={18}
                            fallbackIcon="storefront-outline"
                          />
                        ) : (
                          <View style={styles.buyerAvatar}>
                            <Text style={styles.buyerAvatarText}>{title.charAt(0).toUpperCase()}</Text>
                          </View>
                        )}

                        <View style={{ flex: 1 }}>
                          <Text style={styles.recipientTitle}>{title}</Text>
                          <Text style={styles.recipientSubtitle}>{subtitle || "No extra details yet"}</Text>
                        </View>

                        {selected ? (
                          <View style={styles.recipientCheck}>
                            <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                          </View>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <Text style={styles.sectionTitle}>Select Channel</Text>
            <View style={styles.channelRow}>
              {CHANNELS.map((channel) => {
                const active = selectedChannels.includes(channel.id);
                return (
                  <TouchableOpacity
                    key={channel.id}
                    onPress={() => toggleChannel(channel.id)}
                    activeOpacity={0.85}
                    style={styles.channelChip}
                  >
                    <View style={[styles.channelCheckbox, active && styles.channelCheckboxActive]}>
                      {active ? <Ionicons name="checkmark" size={16} color="#FFFFFF" /> : null}
                    </View>
                    <Text style={[styles.channelLabel, !active && styles.channelLabelMuted]}>{channel.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.composerCard}>
              <TextInput
                value={message}
                onChangeText={setMessage}
                multiline
                placeholder="Write your message here..."
                placeholderTextColor="#9CA3AF"
                textAlignVertical="top"
                style={styles.messageInput}
              />
              <TouchableOpacity
                onPress={handleSend}
                activeOpacity={0.85}
                disabled={sending}
                style={[styles.sendButton, sending && styles.sendButtonDisabled]}
              >
                <Text style={styles.sendButtonText}>{sending ? "Sending..." : "Send Message"}</Text>
                <Ionicons name="send" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F4F4" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
  },
  backButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#ECEFEC",
  },
  headerTitle: {
    flex: 1,
    fontSize: 30,
    lineHeight: 36,
    fontFamily: "Manrope-ExtraBold",
    color: "#282828",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 118,
  },
  loadingWrap: {
    paddingVertical: 48,
    alignItems: "center",
  },
  errorText: {
    color: "#D92D20",
    fontSize: 13,
    fontFamily: "Outfit-Regular",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 19,
    lineHeight: 24,
    fontFamily: "Manrope-ExtraBold",
    color: "#282828",
    marginTop: 18,
    marginBottom: 14,
  },
  audienceList: {
    gap: 12,
  },
  audienceItem: {
    backgroundColor: "#ECECEC",
    borderRadius: 22,
    paddingHorizontal: 18,
    minHeight: 88,
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  audienceItemSelected: {
    borderWidth: 1.5,
    borderColor: "#0A6C52",
    backgroundColor: "#F0F4F2",
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#BCC0C3",
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    borderColor: "#0A6C52",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#0A6C52",
  },
  audienceTitle: {
    color: "#2A2A2A",
    fontSize: 17,
    lineHeight: 22,
    fontFamily: "Manrope-Bold",
  },
  selectorCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    padding: 16,
    marginTop: 18,
  },
  searchRow: {
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E8E6",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    color: "#2B2B2B",
    fontSize: 16,
    fontFamily: "Outfit-Regular",
  },
  recipientCard: {
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: "#0A6C52",
    padding: 12,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  recipientCardSelected: {
    backgroundColor: "#F6FBF8",
  },
  recipientAvatar: {
    width: 82,
    height: 82,
    backgroundColor: "#E7ECE9",
  },
  buyerAvatar: {
    width: 62,
    height: 62,
    borderRadius: 18,
    backgroundColor: "#EAF6F0",
    alignItems: "center",
    justifyContent: "center",
  },
  buyerAvatarText: {
    color: "#0A6C52",
    fontSize: 20,
    fontFamily: "Manrope-ExtraBold",
  },
  recipientTitle: {
    color: "#282828",
    fontSize: 18,
    lineHeight: 24,
    fontFamily: "Manrope-Bold",
  },
  recipientSubtitle: {
    color: "#5F666B",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Outfit-Regular",
    marginTop: 4,
  },
  recipientCheck: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#0A6C52",
    alignItems: "center",
    justifyContent: "center",
  },
  channelRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 18,
  },
  channelChip: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  channelCheckbox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#B7BCC0",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  channelCheckboxActive: {
    borderColor: "#0A6C52",
    backgroundColor: "#0A6C52",
  },
  channelLabel: {
    color: "#282828",
    fontSize: 16,
    fontFamily: "Manrope-Bold",
  },
  channelLabelMuted: {
    color: "#969BA0",
    fontFamily: "Outfit-Medium",
  },
  composerCard: {
    marginTop: 22,
    gap: 14,
  },
  messageInput: {
    minHeight: 186,
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    paddingVertical: 18,
    color: "#282828",
    fontSize: 16,
    lineHeight: 22,
    fontFamily: "Outfit-Regular",
  },
  sendButton: {
    minHeight: 68,
    borderRadius: 22,
    backgroundColor: "#0A6C52",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontFamily: "Manrope-Bold",
  },
});
