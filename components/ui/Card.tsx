import React from "react";
import { StyleSheet, View, ViewProps, TouchableOpacity, TouchableOpacityProps } from "react-native";
import { Colors } from "../../constants/colors";

interface CardProps extends ViewProps {
  children: React.ReactNode;
  variant?: "default" | "dark" | "outline" | "flat";
  padding?: "none" | "sm" | "md" | "lg";
}

interface PressableCardProps extends TouchableOpacityProps {
  children: React.ReactNode;
  variant?: "default" | "dark" | "outline" | "flat";
  padding?: "none" | "sm" | "md" | "lg";
}

const variantClass = {
  default: "bg-white shadow-sm",
  dark: "bg-dark-card",
  outline: "bg-white border border-border",
  flat: "bg-surface",
};

const paddingClass = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-5",
};

export const Card: React.FC<CardProps> = ({
  children,
  variant = "default",
  padding = "md",
  style,
  ...rest
}) => (
  <View
    className={["overflow-hidden", variantClass[variant], paddingClass[padding]].join(" ")}
    style={[styles.base, variantStyles[variant], style]}
    {...rest}
  >
    {children}
  </View>
);

export const PressableCard: React.FC<PressableCardProps> = ({
  children,
  variant = "default",
  padding = "md",
  style,
  ...rest
}) => (
  <TouchableOpacity
    className={["overflow-hidden", variantClass[variant], paddingClass[padding]].join(" ")}
    activeOpacity={0.85}
    style={[styles.base, variantStyles[variant], style]}
    {...rest}
  >
    {children}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  base: {
    borderRadius: 20,
  },
});

const variantStyles = StyleSheet.create({
  default: {
    backgroundColor: Colors.white,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
  },
  dark: {
    backgroundColor: Colors.dark.card,
  },
  outline: {
    backgroundColor: Colors.white,
    borderColor: Colors.border,
    borderWidth: 1,
  },
  flat: {
    backgroundColor: Colors.surface,
  },
});
