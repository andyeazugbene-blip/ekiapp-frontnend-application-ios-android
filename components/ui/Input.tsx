import React, { useState } from "react";
import { StyleSheet, Text, TextInput, TextInputProps, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../constants/colors";
import { FontFamily } from "../../constants/typography";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isPassword?: boolean;
}

export const Input = React.forwardRef<TextInput, InputProps>(({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  isPassword = false,
  style,
  ...rest
}, ref) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.field, error ? styles.fieldError : null]}>
        {leftIcon ? <View style={styles.side}>{leftIcon}</View> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={Colors.text.secondary}
          secureTextEntry={isPassword && !isVisible}
          style={[styles.input, style]}
          {...rest}
        />
        {isPassword ? (
          <TouchableOpacity onPress={() => setIsVisible((value) => !value)} style={styles.side}>
            <Ionicons name={isVisible ? "eye-off-outline" : "eye-outline"} size={18} color={Colors.text.secondary} />
          </TouchableOpacity>
        ) : rightIcon ? (
          <View style={styles.side}>{rightIcon}</View>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
});

interface SearchInputProps extends TextInputProps {
  onClear?: () => void;
}

export const SearchInput: React.FC<SearchInputProps> = ({ onClear, value, ...rest }) => (
  <View style={styles.search}>
    <Ionicons name="search-outline" size={18} color={Colors.text.secondary} />
    <TextInput value={value} placeholderTextColor={Colors.text.secondary} style={styles.searchInput} {...rest} />
    {value && onClear ? (
      <TouchableOpacity onPress={onClear} style={styles.side}>
        <Ionicons name="close-circle" size={18} color={Colors.text.secondary} />
      </TouchableOpacity>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    marginBottom: 16,
  },
  label: {
    color: Colors.text.primary,
    fontFamily: FontFamily.headingBold,
    fontSize: 12,
    marginBottom: 8,
  },
  field: {
    minHeight: 52,
    borderRadius: 20,
    paddingHorizontal: 14,
    backgroundColor: Colors.surface,
    flexDirection: "row",
    alignItems: "center",
  },
  fieldError: {
    borderWidth: 1,
    borderColor: Colors.status.error,
  },
  input: {
    flex: 1,
    color: Colors.text.primary,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
    paddingVertical: 12,
  },
  side: {
    marginLeft: 8,
  },
  error: {
    color: Colors.status.error,
    fontFamily: FontFamily.body,
    fontSize: 12,
    marginTop: 6,
  },
  hint: {
    color: Colors.text.secondary,
    fontFamily: FontFamily.body,
    fontSize: 12,
    marginTop: 6,
  },
  search: {
    minHeight: 52,
    borderRadius: 20,
    paddingHorizontal: 14,
    backgroundColor: Colors.white,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 4,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    color: Colors.text.primary,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
  },
});
