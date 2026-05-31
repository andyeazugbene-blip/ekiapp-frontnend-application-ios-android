import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Avatar } from "../../components/ui/Avatar";
import { orderService } from "../../services/orderService";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { Order } from "../../types/order";

interface BuyerRow {
  buyerId: string;
  buyerName: string;
  orderCount: number;
  totalSpent: number;
  vendorCount: number;
  lastOrderDate: string;
}

function deriveBuyers(orders: Order[]): BuyerRow[] {
  const map = new Map<string, BuyerRow & { vendorIds: Set<string> }>();
  for (const o of orders) {
    const existing = map.get(o.buyerId);
    if (existing) {
      existing.orderCount += 1;
      existing.totalSpent += o.total;
      existing.vendorIds.add(o.vendorId);
      if (o.createdAt > existing.lastOrderDate) existing.lastOrderDate = o.createdAt;
    } else {
      map.set(o.buyerId, {
        buyerId: o.buyerId,
        buyerName: o.buyerName,
        orderCount: 1,
        totalSpent: o.total,
        vendorIds: new Set([o.vendorId]),
        vendorCount: 1,
        lastOrderDate: o.createdAt,
      });
    }
  }
  return Array.from(map.values())
    .map(({ vendorIds, ...row }) => ({ ...row, vendorCount: vendorIds.size }))
    .sort((a, b) => b.totalSpent - a.totalSpent);
}

export default function AdminBuyersScreen() {
  const [buyers, setBuyers] = useState<BuyerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    try {
      const orders = await orderService.getAllOrders();
      setBuyers(deriveBuyers(orders ?? []));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = () => { setRefreshing(true); load(); };

  const filtered = query
    ? buyers.filter((b) => b.buyerName.toLowerCase().includes(query.toLowerCase()))
    : buyers;

  const totalRevenue = buyers.reduce((s, b) => s + b.totalSpent, 0);

  return (
    <SafeAreaView className="flex-1 bg-surface">
      {/* Header */}
      <View className="px-4 pt-4 pb-2">
        <Text className="text-xl font-bold text-gray-900">Buyers</Text>
        <Text className="text-xs text-muted mt-0.5">
          {buyers.length} buyers · {formatCurrency(totalRevenue)} total revenue
        </Text>
      </View>

      {/* Search */}
      <View className="mx-4 mb-3 flex-row items-center bg-white rounded-2xl px-3 h-11 shadow-sm">
        <Ionicons name="search-outline" size={16} color="#858585" />
        <TextInput
          className="flex-1 ml-2 text-sm text-gray-800"
          placeholder="Search buyer name…"
          placeholderTextColor="#858585"
          value={query}
          onChangeText={setQuery}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery("")}>
            <Ionicons name="close-circle" size={16} color="#858585" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#076B51" />
        </View>
      ) : filtered.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text style={{ fontSize: 48 }}>👥</Text>
          <Text className="text-lg font-bold text-gray-800 mt-4 text-center">No buyers found</Text>
          <Text className="text-sm text-muted text-center mt-2">
            {query ? "No buyers match your search" : "Buyers will appear once orders are placed"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.buyerId}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#076B51" colors={["#076B51"]} />
          }
          ListHeaderComponent={
            <Text className="text-xs text-muted py-2">
              Sorted by total spend
            </Text>
          }
          renderItem={({ item, index }) => (
            <View className="bg-white rounded-2xl p-4 mb-3 flex-row items-center shadow-sm">
              {/* Rank medals */}
              {index < 3 && (
                <View className="absolute top-3 right-3">
                  <Text style={{ fontSize: 16 }}>
                    {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                  </Text>
                </View>
              )}

              <Avatar name={item.buyerName} size="md" />

              <View className="flex-1 ml-3">
                <Text className="text-sm font-bold text-gray-900" numberOfLines={1}>
                  {item.buyerName}
                </Text>

                <View className="flex-row items-center flex-wrap mt-1 gap-x-3">
                  <View className="flex-row items-center">
                    <Ionicons name="receipt-outline" size={11} color="#858585" />
                    <Text className="text-xs text-muted ml-1">
                      {item.orderCount} order{item.orderCount !== 1 ? "s" : ""}
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    <Ionicons name="storefront-outline" size={11} color="#858585" />
                    <Text className="text-xs text-muted ml-1">
                      {item.vendorCount} vendor{item.vendorCount !== 1 ? "s" : ""}
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    <Ionicons name="time-outline" size={11} color="#858585" />
                    <Text className="text-xs text-muted ml-1">
                      {formatDate(item.lastOrderDate)}
                    </Text>
                  </View>
                </View>
              </View>

              <View className="items-end ml-2">
                <Text className="text-base font-bold text-primary-500">
                  {formatCurrency(item.totalSpent)}
                </Text>
                <Text className="text-[10px] text-muted mt-0.5">total spent</Text>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
