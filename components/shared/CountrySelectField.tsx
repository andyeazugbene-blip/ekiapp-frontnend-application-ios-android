import React, { useMemo, useState } from "react";
import { FlatList, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { countryFlagEmoji } from "../../utils/countries";

/**
 * Community Buy market picker (2026-09-22 UI redesign) — replaces a long
 * vertical radio-button list with a compact collapsed field (flag + name +
 * chevron) that opens a searchable modal sheet. UI-only: this component has
 * no opinion on what a "country" is beyond {code, name} — the caller
 * supplies both from whatever its own real option/value source already is
 * (e.g. MarketConfiguration.countryCode from the backend) and gets back
 * exactly that same code string on selection. No new data source, no new
 * validation, no change to what gets submitted anywhere.
 */
export interface CountrySelectOption {
  code: string;
  name: string;
}

interface CountrySelectFieldProps {
  options: CountrySelectOption[];
  value: string | null;
  onSelect: (code: string) => void;
  placeholder?: string;
  disabled?: boolean;
  sheetTitle?: string;
  accessibilityLabel?: string;
}

export function CountrySelectField({
  options,
  value,
  onSelect,
  placeholder = "Select a country",
  disabled = false,
  sheetTitle = "Select market",
  accessibilityLabel,
}: CountrySelectFieldProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = options.find((o) => o.code === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, query]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const handleSelect = (code: string) => {
    onSelect(code);
    close();
  };

  return (
    <>
      <TouchableOpacity
        onPress={() => !disabled && setOpen(true)}
        activeOpacity={0.85}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? (selected ? `Market: ${selected.name}` : placeholder)}
        style={[styles.field, disabled && styles.fieldDisabled]}
      >
        <View style={styles.fieldContent}>
          <Text style={styles.flag}>{selected ? countryFlagEmoji(selected.code) : "🌐"}</Text>
          <Text style={[styles.fieldText, !selected && styles.fieldPlaceholder]} numberOfLines={1}>
            {selected ? selected.name : placeholder}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={18} color="#6A7B72" />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.overlayBackdrop} activeOpacity={1} onPress={close} accessibilityLabel="Close" accessibilityRole="button" />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{sheetTitle}</Text>
            <View style={styles.searchRow}>
              <Ionicons name="search-outline" size={16} color="#8AA194" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search a country..."
                placeholderTextColor="#8AA194"
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Search a country"
              />
              {query.length > 0 ? (
                <TouchableOpacity onPress={() => setQuery("")} accessibilityRole="button" accessibilityLabel="Clear search">
                  <Ionicons name="close-circle" size={16} color="#8AA194" />
                </TouchableOpacity>
              ) : null}
            </View>

            {filtered.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No country matches "{query}".</Text>
              </View>
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={(item) => item.code}
                keyboardShouldPersistTaps="handled"
                style={styles.list}
                renderItem={({ item }) => {
                  const isSelected = item.code === value;
                  return (
                    <TouchableOpacity
                      onPress={() => handleSelect(item.code)}
                      activeOpacity={0.75}
                      accessibilityRole="radio"
                      accessibilityLabel={item.name}
                      accessibilityState={{ selected: isSelected }}
                      style={[styles.row, isSelected && styles.rowActive]}
                    >
                      <Text style={styles.flag}>{countryFlagEmoji(item.code)}</Text>
                      <Text style={styles.rowText}>{item.name}</Text>
                      {isSelected ? <Ionicons name="checkmark-circle" size={20} color="#076B51" /> : null}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F4F6F5",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  fieldDisabled: { opacity: 0.6 },
  fieldContent: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  flag: { fontSize: 20 },
  fieldText: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#151E1B", flexShrink: 1 },
  fieldPlaceholder: { color: "#8AA194" },
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(10,20,16,0.4)" },
  overlayBackdrop: { ...StyleSheet.absoluteFill },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    maxHeight: "80%",
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E2E8E4", alignSelf: "center", marginBottom: 12 },
  sheetTitle: { fontSize: 16, fontFamily: "Manrope-ExtraBold", color: "#12221A", marginBottom: 12 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F4F6F5",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Outfit-Regular", color: "#151E1B", padding: 0 },
  list: { flexGrow: 0 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  rowActive: { borderColor: "#076B51", backgroundColor: "#EFF7F3" },
  rowText: { flex: 1, fontSize: 14, fontFamily: "Outfit-Medium", color: "#151E1B" },
  emptyState: { paddingVertical: 24, alignItems: "center" },
  emptyText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#6A7B72" },
});
