import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { FloatingCard, PremiumHeader, premiumStyles } from "../../components/shared/PremiumBlocks";
import { orderService, Shipment } from "../../services/orderService";
import { goBackOrReplace } from "../../utils/navigation";

type FilterTab = "all" | "in_transit" | "delivered" | "delayed" | "processing";

const TABS: { label: string; key: FilterTab }[] = [
  { label: "All", key: "all" },
  { label: "In Transit", key: "in_transit" },
  { label: "Delivered", key: "delivered" },
  { label: "Delayed", key: "delayed" },
];

export default function DeliveryTrackingScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<FilterTab>("all");
  const [query, setQuery] = useState("");
  const [allShipments, setAllShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      orderService.getVendorShipments()
        .then((data) => { if (!cancelled) setAllShipments(data ?? []); })
        .catch(() => { if (!cancelled) setAllShipments([]); })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, [])
  );

  const shipments = useMemo(() => {
    return allShipments.filter((item) => {
      if (tab !== "all" && item.status !== tab) return false;
      const q = query.toLowerCase();
      if (query && !(item.orderNumber || "").toLowerCase().includes(q) && !(item.trackingNumber || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [query, tab, allShipments]);

  const daysInTransit = (s: Shipment) => {
    try { return Math.max(0, Math.floor((Date.now() - new Date(s.createdAt).getTime()) / 86400000)); }
    catch { return 0; }
  };

  const formatEst = (iso?: string) => {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" }); }
    catch { return iso; }
  };

  return (
    <View style={premiumStyles.page}>
      <PremiumHeader title="Shipment tracking" subtitle={`${allShipments.length} total shipments`} onBack={() => goBackOrReplace(router, "/(vendor)/orders" as any)} />
      <FlatList
        data={shipments}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        ListHeaderComponent={
          <View>
            <View style={premiumStyles.block}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {TABS.map((item) => {
                  const active = item.key === tab;
                  return (
                    <TouchableOpacity key={item.key} onPress={() => setTab(item.key)} activeOpacity={0.86} style={{ borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: active ? "#076B51" : "#FFFFFF", shadowColor: "#282828", shadowOffset: { width: 0, height: 8 }, shadowOpacity: active ? 0 : 0.06, shadowRadius: 14, elevation: active ? 0 : 4 }}>
                      <Text style={{ color: active ? "#FFFFFF" : "#516A60", fontSize: 12, fontFamily: "Manrope-Bold" }}>{item.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <View style={{ marginTop: 14, minHeight: 52, borderRadius: 20, backgroundColor: "#FFFFFF", paddingHorizontal: 14, justifyContent: "center", shadowColor: "#282828", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 14, elevation: 4 }}>
                <TextInput value={query} onChangeText={setQuery} placeholder="Search buyer, order, tracking" placeholderTextColor="#8AA194" style={{ color: "#102118", fontSize: 14, fontFamily: "Manrope-SemiBold" }} />
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color="#076B51" style={{ marginTop: 40 }} />
          ) : (
            <Text style={{ textAlign: "center", color: "#8AA194", marginTop: 40, fontSize: 14 }}>No shipments found</Text>
          )
        }
        renderItem={({ item, index }) => {
          const days = daysInTransit(item);
          return (
            <View style={{ paddingHorizontal: 16, marginTop: index === 0 ? 0 : 12 }}>
              <FloatingCard>
                <Text style={{ color: "#102118", fontSize: 15, fontFamily: "Manrope-Bold" }}>{item.orderNumber || item.orderId.slice(0, 8)}</Text>
                <Text style={{ color: "#516A60", fontSize: 12, fontFamily: "Manrope-Bold", marginTop: 10 }}>{item.trackingNumber || "No tracking yet"}</Text>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 14 }}>
                  <Text style={{ color: "#72857D", fontSize: 12 }}>{item.carrier ?? "Standard"}</Text>
                  <Text style={{ color: "#076B51", fontSize: 12, fontFamily: "Manrope-Bold" }}>{(item.status || "").replace("_", " ")}</Text>
                </View>
                <Text style={{ color: "#72857D", fontSize: 12, marginTop: 8 }}>Estimated {formatEst(item.estimatedDelivery)} - {days} days in transit</Text>
              </FloatingCard>
            </View>
          );
        }}
      />
    </View>
  );
}
