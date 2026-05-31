import React, { useEffect, useRef } from "react";
import { View, Text, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export interface RevenueDataPoint {
  day: string;
  amount: number;
}

interface RevenueChartProps {
  data: RevenueDataPoint[];
  currencySymbol?: string;
  trendPercent?: number;
}

const BAR_HEIGHT = 100;

export function RevenueChart({
  data,
  currencySymbol = "£",
  trendPercent = 12,
}: RevenueChartProps) {
  const maxAmount = Math.max(...data.map((d) => d.amount), 1);
  const total = data.reduce((acc, d) => acc + d.amount, 0);
  const todayIdx = data.length - 1;
  const trend = trendPercent >= 0;

  const animValues = useRef(data.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.stagger(
      55,
      animValues.map((anim, i) =>
        Animated.spring(anim, {
          toValue: (data[i].amount / maxAmount) * BAR_HEIGHT,
          tension: 80,
          friction: 10,
          useNativeDriver: false,
        })
      )
    ).start();
  }, []);

  return (
    <View>
      {/* Summary row */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 20,
        }}
      >
        <View>
          <Text style={{ fontSize: 11, color: "#6B7280", fontWeight: "500" }}>Total this week</Text>
          <Text style={{ fontSize: 26, fontWeight: "800", color: "#111827", marginTop: 2 }}>
            {currencySymbol}
            {total.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
          </Text>
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: trend ? "#DCFCE7" : "#FEE2E2",
            borderRadius: 20,
            paddingHorizontal: 10,
            paddingVertical: 5,
          }}
        >
          <Ionicons
            name={trend ? "trending-up" : "trending-down"}
            size={13}
            color={trend ? "#16A34A" : "#DC2626"}
          />
          <Text
            style={{
              fontSize: 12,
              fontWeight: "700",
              color: trend ? "#16A34A" : "#DC2626",
              marginLeft: 4,
            }}
          >
            {trend ? "+" : ""}
            {trendPercent}% vs last week
          </Text>
        </View>
      </View>

      {/* Bars */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          height: BAR_HEIGHT,
          gap: 6,
        }}
      >
        {data.map((point, i) => {
          const isHighest = point.amount === maxAmount;
          return (
            <View
              key={point.day}
              style={{ flex: 1, alignItems: "center", height: BAR_HEIGHT }}
            >
              <View style={{ flex: 1, justifyContent: "flex-end", width: "100%" }}>
                <Animated.View
                  style={{
                    width: "100%",
                    height: animValues[i],
                    backgroundColor: isHighest ? "#076B51" : i === todayIdx ? "#3F967C" : "#EAF6F2",
                    borderRadius: 6,
                  }}
                />
              </View>
              <Text
                style={{
                  fontSize: 9,
                  color: isHighest ? "#076B51" : "#858585",
                  marginTop: 5,
                  fontWeight: isHighest ? "700" : "400",
                }}
              >
                {point.day}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Amount labels (top 3) */}
      <View style={{ flexDirection: "row", marginTop: 10, gap: 8 }}>
        {[...data]
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 3)
          .map((p) => (
            <View
              key={p.day}
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#F9FAFB",
                borderRadius: 8,
                paddingHorizontal: 8,
                paddingVertical: 4,
              }}
            >
              <Text style={{ fontSize: 9, color: "#6B7280" }}>{p.day}</Text>
              <Text style={{ fontSize: 10, fontWeight: "700", color: "#111827", marginLeft: 4 }}>
                {currencySymbol}{p.amount}
              </Text>
            </View>
          ))}
      </View>
    </View>
  );
}
