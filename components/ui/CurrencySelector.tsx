import React from "react";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  CURRENCY_LABELS,
  CURRENCY_SYMBOLS,
  SUPPORTED_CURRENCIES,
  type SupportedCurrency,
} from "../../utils/currency";

interface Props {
  selectedCurrency: SupportedCurrency;
  onChange: (currency: SupportedCurrency) => void | Promise<void>;
  visible: boolean;
  onClose: () => void;
}

export function CurrencySelector({ selectedCurrency, onChange, visible, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>Display currency</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.8} accessibilityLabel="Close currency selector" accessibilityRole="button" style={styles.closeButton}>
              <Ionicons name="close" size={18} color="#282828" />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>We will convert prices for display only. Checkout still uses the order currency.</Text>

          <View style={styles.list}>
            {SUPPORTED_CURRENCIES.map((currency) => {
              const selected = currency === selectedCurrency;
              return (
                <TouchableOpacity
                  key={currency}
                  onPress={() => {
                    onChange(currency);
                    onClose();
                  }}
                  activeOpacity={0.85}
                  style={[styles.option, selected && styles.optionActive]}
                >
                  <View style={styles.optionLeft}>
                    <View style={[styles.symbolWrap, selected && styles.symbolWrapActive]}>
                      <Text style={[styles.symbolText, selected && styles.symbolTextActive]}>
                        {CURRENCY_SYMBOLS[currency]}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.optionLabel}>{currency}</Text>
                      <Text style={styles.optionValue}>{CURRENCY_LABELS[currency]}</Text>
                    </View>
                  </View>
                  {selected ? <Ionicons name="checkmark-circle" size={22} color="#076B51" /> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.32)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 28,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 18,
    fontFamily: "Manrope-Bold",
    color: "#282828",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Outfit-Regular",
    color: "#687076",
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F4F4F4",
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    marginTop: 18,
    gap: 10,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E6ECE8",
    backgroundColor: "#FFFFFF",
  },
  optionActive: {
    borderColor: "#076B51",
    backgroundColor: "#F1FAF6",
  },
  optionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  symbolWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#F2F5F3",
    alignItems: "center",
    justifyContent: "center",
  },
  symbolWrapActive: {
    backgroundColor: "#076B51",
  },
  symbolText: {
    fontSize: 15,
    fontFamily: "Manrope-Bold",
    color: "#076B51",
  },
  symbolTextActive: {
    color: "#FFFFFF",
  },
  optionLabel: {
    fontSize: 14,
    fontFamily: "Manrope-Bold",
    color: "#282828",
  },
  optionValue: {
    fontSize: 12,
    fontFamily: "Outfit-Regular",
    color: "#687076",
    marginTop: 2,
  },
});
