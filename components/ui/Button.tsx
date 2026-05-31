import React from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, TouchableOpacityProps, View } from "react-native";
import { Colors } from "../../constants/colors";
import { FontFamily } from "../../constants/typography";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  iconPosition = "left",
  fullWidth = false,
  disabled,
  style,
  ...rest
}) => {
  const isDisabled = disabled || loading;
  const variantStyle = variantMap[variant];
  const sizeStyle = sizeMap[size];

  return (
    <TouchableOpacity
      disabled={isDisabled}
      activeOpacity={0.86}
      style={[
        styles.base,
        sizeStyle.container,
        variantStyle.container,
        fullWidth ? styles.full : null,
        isDisabled ? styles.disabled : null,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "outline" || variant === "ghost" ? Colors.primary.DEFAULT : Colors.white}
        />
      ) : (
        <>
          {icon && iconPosition === "left" ? <View style={styles.iconLeft}>{icon}</View> : null}
          <Text style={[sizeStyle.text, variantStyle.text]}>{title}</Text>
          {icon && iconPosition === "right" ? <View style={styles.iconRight}>{icon}</View> : null}
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  full: {
    width: "100%",
  },
  disabled: {
    opacity: 0.55,
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
});

const sizeMap = {
  sm: {
    container: { minHeight: 40, borderRadius: 14, paddingHorizontal: 16 },
    text: { fontFamily: FontFamily.headingBold, fontSize: 13, letterSpacing: -0.1 },
  },
  md: {
    container: { minHeight: 50, borderRadius: 14, paddingHorizontal: 18 },
    text: { fontFamily: FontFamily.headingBold, fontSize: 14, letterSpacing: -0.1 },
  },
  lg: {
    container: { minHeight: 56, borderRadius: 14, paddingHorizontal: 22 },
    text: { fontFamily: FontFamily.headingBold, fontSize: 15, letterSpacing: -0.1 },
  },
};

const variantMap = {
  primary: {
    container: { backgroundColor: Colors.primary.DEFAULT },
    text: { color: Colors.white },
  },
  secondary: {
    container: { backgroundColor: Colors.dark.card },
    text: { color: Colors.white },
  },
  outline: {
    container: { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border },
    text: { color: Colors.primary.DEFAULT },
  },
  ghost: {
    container: { backgroundColor: "transparent" },
    text: { color: Colors.primary.DEFAULT },
  },
  danger: {
    container: { backgroundColor: Colors.status.error },
    text: { color: Colors.white },
  },
};
