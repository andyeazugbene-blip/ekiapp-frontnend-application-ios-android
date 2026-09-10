import React, { useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

/**
 * Lightweight, dependency-free calendar picker — no native date-picker
 * package is installed in this Expo app, and adding one would require a
 * fresh native build for both platforms (out of scope for a UX-only
 * change). This is a real interactive calendar, not a text field asking
 * for a hand-typed "YYYY-MM-DD" string.
 */

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfDay(d: Date): Date {
  const next = new Date(d);
  next.setHours(0, 0, 0, 0);
  return next;
}

function buildMonthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = first.getDay();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day));
  return cells;
}

export function DatePickerField({
  label,
  value,
  onChange,
  minimumDate,
  disabled,
  placeholder = "Select a date",
  hint,
}: {
  label: string;
  value?: string | null;
  onChange: (isoDate: string) => void;
  minimumDate?: Date;
  disabled?: boolean;
  placeholder?: string;
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedDate = value ? new Date(value) : null;
  const validSelected = selectedDate && !Number.isNaN(selectedDate.getTime()) ? selectedDate : null;
  const [cursor, setCursor] = useState(() => validSelected ?? minimumDate ?? new Date());

  const openPicker = () => {
    if (disabled) return;
    setCursor(validSelected ?? minimumDate ?? new Date());
    setOpen(true);
  };

  const min = minimumDate ? startOfDay(minimumDate) : null;
  const cells = buildMonthGrid(cursor.getFullYear(), cursor.getMonth());

  const displayText = validSelected
    ? validSelected.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
    : placeholder;

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        onPress={openPicker}
        disabled={disabled}
        activeOpacity={0.85}
        style={[styles.field, disabled && styles.fieldDisabled]}
        accessibilityRole="button"
        accessibilityLabel={`${label}${validSelected ? `, ${displayText}` : ""}`}
        accessibilityState={{ disabled }}
      >
        <Ionicons name="calendar-outline" size={18} color="#076B51" />
        <Text style={[styles.fieldText, !validSelected && styles.fieldPlaceholder]}>{displayText}</Text>
      </TouchableOpacity>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.scrim}>
          <View style={styles.sheet}>
            <View style={styles.headerRow}>
              <TouchableOpacity
                onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
                style={styles.navBtn}
                accessibilityRole="button"
                accessibilityLabel="Previous month"
              >
                <Ionicons name="chevron-back" size={18} color="#076B51" />
              </TouchableOpacity>
              <Text style={styles.monthLabel}>{MONTH_NAMES[cursor.getMonth()]} {cursor.getFullYear()}</Text>
              <TouchableOpacity
                onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
                style={styles.navBtn}
                accessibilityRole="button"
                accessibilityLabel="Next month"
              >
                <Ionicons name="chevron-forward" size={18} color="#076B51" />
              </TouchableOpacity>
            </View>

            <View style={styles.weekRow}>
              {WEEKDAYS.map((w, i) => (
                <Text key={`${w}-${i}`} style={styles.weekdayText}>{w}</Text>
              ))}
            </View>

            <View style={styles.grid}>
              {cells.map((cellDate, index) => {
                if (!cellDate) return <View key={`blank-${index}`} style={styles.cell} />;
                const isPast = min ? startOfDay(cellDate) < min : false;
                const isSelected = Boolean(validSelected && toIsoDate(cellDate) === toIsoDate(validSelected));
                return (
                  <TouchableOpacity
                    key={cellDate.toISOString()}
                    disabled={isPast}
                    onPress={() => {
                      onChange(toIsoDate(cellDate));
                      setOpen(false);
                    }}
                    style={[styles.cell, styles.dayCell, isSelected && styles.dayCellSelected]}
                    accessibilityRole="button"
                    accessibilityLabel={cellDate.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}
                    accessibilityState={{ disabled: isPast, selected: isSelected }}
                  >
                    <Text style={[styles.dayText, isPast && styles.dayTextDisabled, isSelected && styles.dayTextSelected]}>{cellDate.getDate()}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              onPress={() => setOpen(false)}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={styles.closeBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#516A60", marginBottom: 8 },
  field: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#F4F6F5", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13 },
  fieldDisabled: { opacity: 0.6 },
  fieldText: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#151E1B" },
  fieldPlaceholder: { color: "#8AA194" },
  hint: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#8AA194", marginTop: 6 },
  scrim: { flex: 1, backgroundColor: "rgba(11,33,25,0.55)", justifyContent: "center", padding: 24 },
  sheet: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 18, gap: 4 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  navBtn: { width: 34, height: 34, borderRadius: 12, backgroundColor: "rgba(7,107,81,0.08)", alignItems: "center", justifyContent: "center" },
  monthLabel: { fontSize: 15, fontFamily: "Manrope-Bold", color: "#151E1B" },
  weekRow: { flexDirection: "row" },
  weekdayText: { flex: 1, textAlign: "center", fontSize: 11, fontFamily: "Manrope-SemiBold", color: "#8AA194", paddingVertical: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "14.28%", aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  dayCell: { borderRadius: 999 },
  dayCellSelected: { backgroundColor: "#076B51" },
  dayText: { fontSize: 13, fontFamily: "Outfit-Medium", color: "#151E1B" },
  dayTextDisabled: { color: "#D7DEDA" },
  dayTextSelected: { color: "#FFFFFF", fontFamily: "Manrope-Bold" },
  closeBtn: { marginTop: 10, alignItems: "center", paddingVertical: 10 },
  closeBtnText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#6A7B72" },
});
