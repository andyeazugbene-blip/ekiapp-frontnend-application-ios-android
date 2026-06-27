import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
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
import { vendorService } from "../../services/vendorService";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const DETAIL_TABS = ["Overview", "Products", "Orders", "Revenue"] as const;
type DetailTab = (typeof DETAIL_TABS)[number];

function formatCurrency(cents: number, currency = "GBP"): string {
  const symbols: Record<string, string> = { GBP: "£", USD: "$", EUR: "€", NGN: "₦" };
  const sym = symbols[currency] ?? currency + " ";
  const val = cents / 100;
  if (val >= 1_000_000) return `${sym}${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${sym}${(val / 1_000).toFixed(1)}K`;
  return `${sym}${val.toFixed(2)}`;
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function getVerificationLabel(status?: string): { label: string; color: string; bg: string } {
  switch (status) {
    case "VERIFIED": return { label: "Verified", color: "#076B51", bg: "rgba(7,107,81,0.10)" };
    case "REJECTED": return { label: "Rejected", color: "#E53935", bg: "rgba(229,57,53,0.10)" };
    case "PENDING": return { label: "Pending", color: "#2196F3", bg: "rgba(33,150,243,0.10)" };
    case "IN_REVIEW": return { label: "In Review", color: "#7B1FA2", bg: "rgba(123,31,162,0.10)" };
    default: return { label: status || "Unknown", color: "#858585", bg: "#F0F0F0" };
  }
}

function getOrderStatusColor(status: string): string {
  switch (status) {
    case "COMPLETED":
    case "DELIVERED": return "#076B51";
    case "PAID":
    case "CONFIRMED":
    case "PROCESSING": return "#2196F3";
    case "DISPATCHED":
    case "IN_TRANSIT": return "#7B1FA2";
    case "PENDING": return "#D97706";
    case "FAILED":
    case "CANCELLED": return "#E53935";
    default: return "#858585";
  }
}

export default function VendorDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [vendor, setVendor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>("Overview");
  const [editMode, setEditMode] = useState(false);
  const [editFields, setEditFields] = useState<Record<string, string>>({});

  const loadVendor = useCallback(async () => {
    if (!id) { setLoading(false); return; }
    try {
      const v = await vendorService.getVendorDetail(id);
      setVendor(v);
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Vendor not found.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      if (!id) { setLoading(false); return; }
      setLoading(true);
      loadVendor();
    }, [id, loadVendor])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadVendor();
    setRefreshing(false);
  }, [loadVendor]);

  const runAction = async (action: "approve" | "reject" | "suspend" | "unsuspend") => {
    if (!id) return;
    setSaving(true);
    try {
      if (action === "approve") await vendorService.approveVendor(id);
      if (action === "reject") await vendorService.rejectVendor(id);
      if (action === "suspend") await vendorService.suspendVendor(id);
      if (action === "unsuspend") await vendorService.unsuspendVendor(id);
      await loadVendor();
    } catch (err) {
      Alert.alert("Action failed", err instanceof Error ? err.message : "Could not update vendor.");
    } finally {
      setSaving(false);
    }
  };

  const confirmAction = (action: "approve" | "reject" | "suspend" | "unsuspend") => {
    const labels: Record<string, { title: string; style: "default" | "destructive" }> = {
      approve: { title: "Approve this vendor?", style: "default" },
      reject: { title: "Reject this vendor?", style: "destructive" },
      suspend: { title: "Suspend this vendor? Products will be deactivated.", style: "destructive" },
      unsuspend: { title: "Reactivate this vendor?", style: "default" },
    };
    const l = labels[action];
    Alert.alert(l.title, undefined, [
      { text: "Cancel", style: "cancel" },
      { text: action.charAt(0).toUpperCase() + action.slice(1), style: l.style, onPress: () => runAction(action) },
    ]);
  };

  const handleDelete = () => {
    if (!id) return;
    Alert.alert(
      "Delete vendor permanently?",
      "This cannot be undone. Vendors with order history cannot be deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setSaving(true);
            try {
              await vendorService.deleteVendor(id);
              router.back();
            } catch (err) {
              Alert.alert("Delete failed", err instanceof Error ? err.message : "Could not delete.");
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  const startEdit = () => {
    setEditFields({
      storeName: vendor?.storeName ?? "",
      description: vendor?.description ?? "",
      contactEmail: vendor?.contactEmail ?? "",
      contactPhone: vendor?.contactPhone ?? "",
      country: vendor?.country ?? "",
      city: vendor?.city ?? "",
    });
    setEditMode(true);
  };

  const saveEdit = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const data: Record<string, string> = {};
      for (const [k, v] of Object.entries(editFields)) {
        if (v !== (vendor?.[k] ?? "")) data[k] = v;
      }
      if (Object.keys(data).length > 0) {
        await vendorService.updateVendor(id, data);
        await loadVendor();
      }
      setEditMode(false);
    } catch (err) {
      Alert.alert("Save failed", err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  const displayStatus = vendor?.isSuspended
    ? "Suspended"
    : vendor?.verificationStatus === "VERIFIED"
      ? "Active"
      : vendor?.verificationStatus === "REJECTED"
        ? "Rejected"
        : "Pending";

  const statusColors: Record<string, { text: string; bg: string }> = {
    Active: { text: "#076B51", bg: "rgba(7,107,81,0.10)" },
    Suspended: { text: "#E53935", bg: "rgba(229,57,53,0.10)" },
    Rejected: { text: "#D97706", bg: "rgba(217,119,6,0.10)" },
    Pending: { text: "#2196F3", bg: "rgba(33,150,243,0.10)" },
  };
  const sc = statusColors[displayStatus] ?? statusColors.Pending;

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.loadingWrap}><ActivityIndicator color="#076B51" size="large" /></View>
      </SafeAreaView>
    );
  }

  if (!vendor) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.85}>
            <Ionicons name="chevron-back" size={20} color="#282828" />
          </TouchableOpacity>
          <Text style={styles.headerBarTitle}>Vendor not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const verification = getVerificationLabel(vendor.verificationStatus);
  const products = vendor.products ?? [];
  const recentOrders = vendor.recentOrders ?? [];
  const productCount = vendor._count?.products ?? products.length;

  const statCards = [
    { label: "Total Revenue", value: formatCurrency(vendor.totalRevenue ?? 0), icon: "trending-up" as const, color: "#076B51" },
    { label: "Avg Rating", value: vendor.avgRating ? Number(vendor.avgRating).toFixed(1) : "—", icon: "star" as const, color: "#F59E0B" },
    { label: "Reviews", value: String(vendor.totalReviews ?? 0), icon: "chatbubble-ellipses" as const, color: "#7B1FA2" },
    { label: "Products", value: String(productCount), icon: "cube" as const, color: "#2196F3" },
    { label: "Orders", value: String(recentOrders.length), icon: "cart" as const, color: "#F57C00" },
    { label: "Payout Methods", value: String(vendor._count?.payoutMethods ?? 0), icon: "wallet" as const, color: "#0277BD" },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.85}>
          <Ionicons name="chevron-back" size={20} color="#282828" />
        </TouchableOpacity>
        <Text style={styles.headerBarTitle}>Vendor Profile</Text>
        <View style={styles.headerBarRight}>
          {!editMode && (
            <TouchableOpacity onPress={startEdit} style={styles.headerAction} activeOpacity={0.85}>
              <Ionicons name="create-outline" size={18} color="#076B51" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleDelete} style={styles.headerAction} activeOpacity={0.85}>
            <Ionicons name="trash-outline" size={18} color="#E53935" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#076B51" colors={["#076B51"]} />}
      >
        {/* Profile Header Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileTop}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>
                {(vendor.storeName || "V").charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              {editMode ? (
                <TextInput
                  style={styles.editInput}
                  value={editFields.storeName}
                  onChangeText={(t) => setEditFields((p) => ({ ...p, storeName: t }))}
                  placeholder="Store name"
                />
              ) : (
                <Text style={styles.profileName}>{vendor.storeName || "Unnamed Store"}</Text>
              )}
              <View style={styles.profileOwnerRow}>
                <Ionicons name="person-outline" size={13} color="#858585" />
                <Text style={styles.profileOwnerName}>{vendor.user?.name || "—"}</Text>
              </View>
              <Text style={styles.profileEmail}>{vendor.user?.email || vendor.contactEmail || "—"}</Text>
            </View>
          </View>

          <View style={styles.profileBadges}>
            <View style={[styles.badge, { backgroundColor: sc.bg }]}>
              <Text style={[styles.badgeText, { color: sc.text }]}>{displayStatus}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: verification.bg }]}>
              <Ionicons name="shield-checkmark-outline" size={12} color={verification.color} />
              <Text style={[styles.badgeText, { color: verification.color }]}>{verification.label}</Text>
            </View>
            <View style={styles.badge}>
              <Ionicons name="ribbon-outline" size={12} color="#076B51" />
              <Text style={[styles.badgeText, { color: "#076B51" }]}>{vendor.subscriptionPlan ?? "FREE"}</Text>
            </View>
          </View>

          <View style={styles.profileMeta}>
            <View style={styles.metaRow}>
              <Ionicons name="calendar-outline" size={14} color="#858585" />
              <Text style={styles.metaText}>Joined {formatDate(vendor.createdAt)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={14} color="#858585" />
              {editMode ? (
                <View style={{ flexDirection: "row", gap: 8, flex: 1 }}>
                  <TextInput
                    style={[styles.editInputSmall, { flex: 1 }]}
                    value={editFields.city}
                    onChangeText={(t) => setEditFields((p) => ({ ...p, city: t }))}
                    placeholder="City"
                  />
                  <TextInput
                    style={[styles.editInputSmall, { flex: 1 }]}
                    value={editFields.country}
                    onChangeText={(t) => setEditFields((p) => ({ ...p, country: t }))}
                    placeholder="Country"
                  />
                </View>
              ) : (
                <Text style={styles.metaText}>
                  {[vendor.city, vendor.country].filter(Boolean).join(", ") || "No location"}
                </Text>
              )}
            </View>
            {(vendor.contactPhone || editMode) && (
              <View style={styles.metaRow}>
                <Ionicons name="call-outline" size={14} color="#858585" />
                {editMode ? (
                  <TextInput
                    style={[styles.editInputSmall, { flex: 1 }]}
                    value={editFields.contactPhone}
                    onChangeText={(t) => setEditFields((p) => ({ ...p, contactPhone: t }))}
                    placeholder="Phone"
                  />
                ) : (
                  <Text style={styles.metaText}>{vendor.contactPhone}</Text>
                )}
              </View>
            )}
          </View>

          {editMode ? (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.editLabel}>Description</Text>
              <TextInput
                style={[styles.editInput, { height: 70, textAlignVertical: "top" }]}
                value={editFields.description}
                onChangeText={(t) => setEditFields((p) => ({ ...p, description: t }))}
                placeholder="Store description"
                multiline
              />
              <View style={styles.editActions}>
                <TouchableOpacity onPress={() => setEditMode(false)} style={styles.editCancelBtn} activeOpacity={0.85}>
                  <Text style={styles.editCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={saveEdit} disabled={saving} style={styles.editSaveBtn} activeOpacity={0.85}>
                  <Text style={styles.editSaveText}>{saving ? "Saving..." : "Save Changes"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : vendor.description ? (
            <Text style={styles.profileDesc} numberOfLines={3}>{vendor.description}</Text>
          ) : null}
        </View>

        {/* Quick Action Buttons */}
        <View style={styles.quickActions}>
          {displayStatus === "Pending" && (
            <>
              <TouchableOpacity onPress={() => confirmAction("approve")} disabled={saving} style={styles.qaBtnPrimary} activeOpacity={0.85}>
                <Ionicons name="checkmark-circle" size={18} color="#FFF" />
                <Text style={styles.qaBtnPrimaryText}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => confirmAction("reject")} disabled={saving} style={styles.qaBtnDanger} activeOpacity={0.85}>
                <Ionicons name="close-circle" size={18} color="#E53935" />
                <Text style={styles.qaBtnDangerText}>Reject</Text>
              </TouchableOpacity>
            </>
          )}
          {displayStatus === "Active" && (
            <TouchableOpacity onPress={() => confirmAction("suspend")} disabled={saving} style={styles.qaBtnDanger} activeOpacity={0.85}>
              <Ionicons name="ban" size={16} color="#E53935" />
              <Text style={styles.qaBtnDangerText}>Suspend Vendor</Text>
            </TouchableOpacity>
          )}
          {displayStatus === "Suspended" && (
            <TouchableOpacity onPress={() => confirmAction("unsuspend")} disabled={saving} style={styles.qaBtnPrimary} activeOpacity={0.85}>
              <Ionicons name="refresh" size={16} color="#FFF" />
              <Text style={styles.qaBtnPrimaryText}>Reactivate</Text>
            </TouchableOpacity>
          )}
          {displayStatus === "Rejected" && (
            <TouchableOpacity onPress={() => confirmAction("approve")} disabled={saving} style={styles.qaBtnPrimary} activeOpacity={0.85}>
              <Ionicons name="checkmark-circle" size={18} color="#FFF" />
              <Text style={styles.qaBtnPrimaryText}>Approve</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          {statCards.map((s, i) => (
            <View key={i} style={styles.statCard}>
              <View style={[styles.statIconWrap, { backgroundColor: s.color + "14" }]}>
                <Ionicons name={s.icon as any} size={18} color={s.color} />
              </View>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Detail Tabs */}
        <View style={styles.detailTabs}>
          {DETAIL_TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.detailTab, activeTab === tab && styles.detailTabActive]}
              activeOpacity={0.85}
            >
              <Text style={[styles.detailTabText, activeTab === tab && styles.detailTabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        {activeTab === "Overview" && (
          <View style={styles.tabContent}>
            {/* Account Health Row */}
            <View style={styles.healthRow}>
              <View style={[styles.healthCard, { borderLeftColor: sc.text }]}>
                <View style={[styles.healthDot, { backgroundColor: sc.text }]} />
                <View>
                  <Text style={styles.healthLabel}>Account Status</Text>
                  <Text style={[styles.healthValue, { color: sc.text }]}>{displayStatus}</Text>
                </View>
              </View>
              <View style={[styles.healthCard, { borderLeftColor: verification.color }]}>
                <View style={[styles.healthDot, { backgroundColor: verification.color }]} />
                <View>
                  <Text style={styles.healthLabel}>Verification</Text>
                  <Text style={[styles.healthValue, { color: verification.color }]}>{verification.label}</Text>
                </View>
              </View>
            </View>

            {/* Subscription + Stripe Row */}
            <View style={styles.healthRow}>
              <View style={styles.connectionCard}>
                <View style={[styles.connectionIcon, { backgroundColor: "rgba(7,107,81,0.08)" }]}>
                  <Ionicons name="ribbon" size={18} color="#076B51" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.connectionLabel}>Seller Plan</Text>
                  <Text style={styles.connectionValue}>{vendor.subscriptionPlan ?? "FREE"}</Text>
                </View>
              </View>
              <View style={styles.connectionCard}>
                <View style={[styles.connectionIcon, { backgroundColor: vendor.stripeAccountId ? "rgba(99,91,255,0.08)" : "rgba(160,160,160,0.08)" }]}>
                  <Ionicons name="card" size={18} color={vendor.stripeAccountId ? "#635BFF" : "#A0A0A0"} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.connectionLabel}>Stripe</Text>
                  <Text style={[styles.connectionValue, { color: vendor.stripeAccountId ? "#635BFF" : "#A0A0A0" }]}>
                    {vendor.stripeAccountId ? "Connected" : "Not linked"}
                  </Text>
                </View>
              </View>
            </View>

            {/* Description */}
            {vendor.description ? (
              <View style={styles.descCard}>
                <View style={styles.descHeader}>
                  <Ionicons name="document-text-outline" size={16} color="#858585" />
                  <Text style={styles.descHeaderText}>Store Description</Text>
                </View>
                <Text style={styles.descBody}>{vendor.description}</Text>
              </View>
            ) : null}

            {/* Contact Info Card */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconWrap}>
                  <Ionicons name="people" size={16} color="#076B51" />
                </View>
                <Text style={styles.sectionTitle}>Contact Details</Text>
              </View>
              <View style={styles.contactGrid}>
                <ContactTile icon="person" label="Owner" value={vendor.user?.name} color="#076B51" />
                <ContactTile icon="mail" label="Email" value={vendor.user?.email || vendor.contactEmail} color="#2196F3" />
                <ContactTile icon="call" label="Phone" value={vendor.contactPhone} color="#7B1FA2" />
                <ContactTile icon="location" label="Location" value={[vendor.city, vendor.country].filter(Boolean).join(", ")} color="#F57C00" />
              </View>
            </View>

            {/* Business Details Card */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconWrap}>
                  <Ionicons name="briefcase" size={16} color="#076B51" />
                </View>
                <Text style={styles.sectionTitle}>Business Details</Text>
              </View>
              <View style={styles.detailGrid}>
                <DetailTile label="Store Name" value={vendor.storeName} />
                <DetailTile label="Business Type" value={vendor.businessType} />
                <DetailTile label="Seller Region" value={vendor.sellerRegion} />
                <DetailTile label="Currency" value={vendor.currency} />
                <DetailTile label="Joined" value={formatDate(vendor.createdAt)} />
                <DetailTile label="Last Updated" value={formatDate(vendor.updatedAt)} />
              </View>
            </View>

            {/* Suspension Info */}
            {vendor.isSuspended && (
              <View style={styles.alertCard}>
                <View style={styles.alertIconWrap}>
                  <Ionicons name="warning" size={20} color="#E53935" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertTitle}>Account Suspended</Text>
                  <Text style={styles.alertBody}>{vendor.suspendedReason || "No reason provided"}</Text>
                </View>
              </View>
            )}

            {/* Performance Snapshot */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconWrap}>
                  <Ionicons name="analytics" size={16} color="#076B51" />
                </View>
                <Text style={styles.sectionTitle}>Performance Snapshot</Text>
              </View>
              <View style={styles.perfGrid}>
                <PerfBar label="Revenue" value={formatCurrency(vendor.totalRevenue ?? 0)} percent={Math.min(100, ((vendor.totalRevenue ?? 0) / 10_000_00) * 100)} color="#076B51" />
                <PerfBar label="Rating" value={vendor.avgRating ? `${Number(vendor.avgRating).toFixed(1)}/5` : "—"} percent={vendor.avgRating ? (Number(vendor.avgRating) / 5) * 100 : 0} color="#F59E0B" />
                <PerfBar label="Products" value={String(productCount)} percent={Math.min(100, (productCount / 50) * 100)} color="#2196F3" />
                <PerfBar label="Reviews" value={String(vendor.totalReviews ?? 0)} percent={Math.min(100, ((vendor.totalReviews ?? 0) / 20) * 100)} color="#7B1FA2" />
              </View>
            </View>
          </View>
        )}

        {activeTab === "Products" && (
          <View style={styles.tabContent}>
            {products.length === 0 ? (
              <View style={styles.emptyTab}>
                <Ionicons name="cube-outline" size={32} color="#C5C5C5" />
                <Text style={styles.emptyTabText}>No products yet</Text>
              </View>
            ) : (
              products.map((p: any) => (
                <View key={p.id} style={styles.productRow}>
                  <View style={styles.productThumb}>
                    <Ionicons name="cube" size={20} color="#858585" />
                  </View>
                  <View style={styles.productInfo}>
                    <Text style={styles.productName} numberOfLines={1}>{p.title || "Untitled"}</Text>
                    <Text style={styles.productMeta}>
                      {formatCurrency(p.priceInCents ?? 0, p.currency)} · Stock: {p.stock ?? 0}
                    </Text>
                  </View>
                  <View style={[styles.productStatus, { backgroundColor: p.isActive ? "rgba(7,107,81,0.10)" : "rgba(229,57,53,0.10)" }]}>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: p.isActive ? "#076B51" : "#E53935" }}>
                      {p.isActive ? "Active" : "Disabled"}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === "Orders" && (
          <View style={styles.tabContent}>
            {recentOrders.length === 0 ? (
              <View style={styles.emptyTab}>
                <Ionicons name="receipt-outline" size={32} color="#C5C5C5" />
                <Text style={styles.emptyTabText}>No orders yet</Text>
              </View>
            ) : (
              recentOrders.map((o: any) => (
                <View key={o.id} style={styles.orderRow}>
                  <View style={styles.orderLeft}>
                    <Text style={styles.orderNumber}>#{o.orderNumber || o.id.slice(0, 8)}</Text>
                    <Text style={styles.orderDate}>{formatDate(o.createdAt)}</Text>
                  </View>
                  <View style={styles.orderRight}>
                    <Text style={styles.orderAmount}>{formatCurrency(o.totalAmount ?? 0, o.currency)}</Text>
                    <View style={[styles.orderStatusPill, { backgroundColor: getOrderStatusColor(o.status) + "18" }]}>
                      <Text style={[styles.orderStatusText, { color: getOrderStatusColor(o.status) }]}>{o.status}</Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === "Revenue" && (
          <View style={styles.tabContent}>
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Revenue Summary</Text>
              <View style={styles.revenueHighlight}>
                <Text style={styles.revenueAmount}>{formatCurrency(vendor.totalRevenue ?? 0)}</Text>
                <Text style={styles.revenueLabel}>Total lifetime revenue</Text>
              </View>
              <View style={styles.revenueDivider} />
              <InfoRow icon="star-outline" label="Avg Rating" value={vendor.avgRating ? `${Number(vendor.avgRating).toFixed(1)} / 5.0` : "No ratings"} />
              <InfoRow icon="chatbubbles-outline" label="Total Reviews" value={String(vendor.totalReviews ?? 0)} />
              <InfoRow icon="cart-outline" label="Orders (recent)" value={String(recentOrders.length)} />
              <InfoRow icon="cube-outline" label="Products Listed" value={String(productCount)} />
              <InfoRow icon="wallet-outline" label="Payout Methods" value={String(vendor._count?.payoutMethods ?? 0)} />
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value?: string | null }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoRowLeft}>
        <Ionicons name={icon as any} size={16} color="#858585" />
        <Text style={styles.infoRowLabel}>{label}</Text>
      </View>
      <Text style={styles.infoRowValue}>{value || "—"}</Text>
    </View>
  );
}

function ContactTile({ icon, label, value, color }: { icon: string; label: string; value?: string | null; color: string }) {
  return (
    <View style={styles.contactTile}>
      <View style={[styles.contactTileIcon, { backgroundColor: color + "10" }]}>
        <Ionicons name={icon as any} size={16} color={color} />
      </View>
      <Text style={styles.contactTileLabel}>{label}</Text>
      <Text style={styles.contactTileValue} numberOfLines={2}>{value || "—"}</Text>
    </View>
  );
}

function DetailTile({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={styles.detailTile}>
      <Text style={styles.detailTileLabel}>{label}</Text>
      <Text style={styles.detailTileValue} numberOfLines={1}>{value || "—"}</Text>
    </View>
  );
}

function PerfBar({ label, value, percent, color }: { label: string; value: string; percent: number; color: string }) {
  return (
    <View style={styles.perfBarRow}>
      <View style={styles.perfBarLabelWrap}>
        <Text style={styles.perfBarLabel}>{label}</Text>
        <Text style={styles.perfBarValue}>{value}</Text>
      </View>
      <View style={styles.perfBarTrack}>
        <View style={[styles.perfBarFill, { width: `${Math.max(2, Math.min(100, percent))}%` as any, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6FA" },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },

  // Header Bar
  headerBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#F0F0F0", alignItems: "center", justifyContent: "center" },
  headerBarTitle: { flex: 1, fontSize: 20, fontWeight: "700", color: "#1A1A1A" },
  headerBarRight: { flexDirection: "row", gap: 8 },
  headerAction: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F0F0F0",
    alignItems: "center",
    justifyContent: "center",
  },

  // Profile Card
  profileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    ...Platform.select({ ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10 }, android: { elevation: 3 } }),
  },
  profileTop: { flexDirection: "row", gap: 14, marginBottom: 14 },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#076B51",
    alignItems: "center",
    justifyContent: "center",
  },
  profileAvatarText: { fontSize: 24, fontWeight: "700", color: "#FFFFFF" },
  profileInfo: { flex: 1, justifyContent: "center" },
  profileName: { fontSize: 20, fontWeight: "700", color: "#1A1A1A" },
  profileOwnerRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  profileOwnerName: { fontSize: 13, color: "#858585" },
  profileEmail: { fontSize: 12, color: "#A0A0A0", marginTop: 2 },

  profileBadges: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#F5F5F5",
  },
  badgeText: { fontSize: 11, fontWeight: "600", color: "#858585" },

  profileMeta: { gap: 8 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  metaText: { fontSize: 13, color: "#858585" },
  profileDesc: { fontSize: 13, color: "#858585", lineHeight: 20, marginTop: 12 },

  // Edit mode
  editInput: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#282828",
    backgroundColor: "#FAFAFA",
  },
  editInputSmall: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    color: "#282828",
    backgroundColor: "#FAFAFA",
  },
  editLabel: { fontSize: 12, fontWeight: "600", color: "#858585", marginBottom: 6, marginTop: 4 },
  editActions: { flexDirection: "row", gap: 10, marginTop: 12 },
  editCancelBtn: { flex: 1, height: 42, borderRadius: 10, borderWidth: 1, borderColor: "#E0E0E0", alignItems: "center", justifyContent: "center" },
  editCancelText: { fontSize: 14, fontWeight: "600", color: "#282828" },
  editSaveBtn: { flex: 1.5, height: 42, borderRadius: 10, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  editSaveText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },

  // Quick Actions
  quickActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  qaBtnPrimary: {
    flex: 1,
    flexDirection: "row",
    height: 46,
    borderRadius: 12,
    backgroundColor: "#076B51",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...Platform.select({ ios: { shadowColor: "#076B51", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 }, android: { elevation: 3 } }),
  },
  qaBtnPrimaryText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  qaBtnDanger: {
    flex: 1,
    flexDirection: "row",
    height: 46,
    borderRadius: 12,
    backgroundColor: "rgba(229,57,53,0.06)",
    borderWidth: 1,
    borderColor: "rgba(229,57,53,0.2)",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  qaBtnDangerText: { fontSize: 14, fontWeight: "600", color: "#E53935" },

  // Stats Grid
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 16,
  },
  statCard: {
    width: (SCREEN_WIDTH - 52) / 3,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    alignItems: "center",
  },
  statIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  statValue: { fontSize: 18, fontWeight: "700", color: "#1A1A1A" },
  statLabel: { fontSize: 10, fontWeight: "500", color: "#858585", marginTop: 4, textAlign: "center" },

  // Detail Tabs
  detailTabs: {
    flexDirection: "row",
    marginTop: 20,
    marginBottom: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  detailTab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  detailTabActive: { backgroundColor: "#076B51" },
  detailTabText: { fontSize: 13, fontWeight: "500", color: "#858585" },
  detailTabTextActive: { color: "#FFFFFF", fontWeight: "600" },

  // Tab Content
  tabContent: { gap: 12 },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  sectionIconWrap: { width: 30, height: 30, borderRadius: 8, backgroundColor: "rgba(7,107,81,0.08)", alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#1A1A1A" },

  // Info Row
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F8F8F8" },
  infoRowLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  infoRowLabel: { fontSize: 13, color: "#858585" },
  infoRowValue: { fontSize: 13, fontWeight: "600", color: "#282828", maxWidth: "50%" as any, textAlign: "right" },

  // Products
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  productThumb: { width: 44, height: 44, borderRadius: 10, backgroundColor: "#F5F5F5", alignItems: "center", justifyContent: "center" },
  productInfo: { flex: 1 },
  productName: { fontSize: 14, fontWeight: "600", color: "#1A1A1A" },
  productMeta: { fontSize: 12, color: "#858585", marginTop: 2 },
  productStatus: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },

  // Orders
  orderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  orderLeft: {},
  orderNumber: { fontSize: 14, fontWeight: "600", color: "#1A1A1A" },
  orderDate: { fontSize: 12, color: "#858585", marginTop: 2 },
  orderRight: { alignItems: "flex-end" },
  orderAmount: { fontSize: 14, fontWeight: "700", color: "#1A1A1A" },
  orderStatusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 4 },
  orderStatusText: { fontSize: 10, fontWeight: "600" },

  // Revenue
  revenueHighlight: { alignItems: "center", paddingVertical: 16 },
  revenueAmount: { fontSize: 36, fontWeight: "700", color: "#076B51" },
  revenueLabel: { fontSize: 13, color: "#858585", marginTop: 4 },
  revenueDivider: { height: 1, backgroundColor: "#F0F0F0", marginVertical: 12 },

  // Empty tab
  emptyTab: { alignItems: "center", paddingVertical: 40 },
  emptyTabText: { fontSize: 14, color: "#858585", marginTop: 8 },

  // Overview — Health Row
  healthRow: { flexDirection: "row", gap: 10 },
  healthCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    borderLeftWidth: 3,
  },
  healthDot: { width: 10, height: 10, borderRadius: 5 },
  healthLabel: { fontSize: 11, fontWeight: "500", color: "#858585" },
  healthValue: { fontSize: 15, fontWeight: "700", marginTop: 2 },

  // Overview — Connection Cards
  connectionCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  connectionIcon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  connectionLabel: { fontSize: 11, fontWeight: "500", color: "#858585" },
  connectionValue: { fontSize: 14, fontWeight: "700", color: "#1A1A1A", marginTop: 2 },

  // Overview — Description Card
  descCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  descHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  descHeaderText: { fontSize: 13, fontWeight: "600", color: "#858585" },
  descBody: { fontSize: 14, color: "#444", lineHeight: 22 },

  // Overview — Contact Grid
  contactGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  contactTile: {
    width: (SCREEN_WIDTH - 74) / 2,
    backgroundColor: "#FAFBFC",
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  contactTileIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  contactTileLabel: { fontSize: 11, fontWeight: "500", color: "#A0A0A0", marginTop: 2 },
  contactTileValue: { fontSize: 13, fontWeight: "600", color: "#1A1A1A" },

  // Overview — Detail Grid
  detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: 0 },
  detailTile: {
    width: "50%" as any,
    paddingVertical: 12,
    paddingRight: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  detailTileLabel: { fontSize: 11, fontWeight: "500", color: "#A0A0A0" },
  detailTileValue: { fontSize: 14, fontWeight: "600", color: "#1A1A1A", marginTop: 4 },

  // Overview — Alert Card
  alertCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(229,57,53,0.04)",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(229,57,53,0.15)",
  },
  alertIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(229,57,53,0.10)", alignItems: "center", justifyContent: "center" },
  alertTitle: { fontSize: 14, fontWeight: "700", color: "#E53935" },
  alertBody: { fontSize: 13, color: "#858585", marginTop: 4, lineHeight: 18 },

  // Overview — Performance Bars
  perfGrid: { gap: 14 },
  perfBarRow: { gap: 6 },
  perfBarLabelWrap: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  perfBarLabel: { fontSize: 13, fontWeight: "500", color: "#858585" },
  perfBarValue: { fontSize: 13, fontWeight: "700", color: "#1A1A1A" },
  perfBarTrack: { height: 8, backgroundColor: "#F0F0F0", borderRadius: 4, overflow: "hidden" },
  perfBarFill: { height: 8, borderRadius: 4 },
});
