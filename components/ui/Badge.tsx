import React from "react";
import { View, Text, ViewProps } from "react-native";

type BadgeVariant =
  | "success"
  | "warning"
  | "error"
  | "info"
  | "pending"
  | "active"
  | "suspended"
  | "draft"
  | "default";

interface BadgeProps extends ViewProps {
  label: string;
  variant?: BadgeVariant;
  size?: "sm" | "md";
  dot?: boolean;
  /** Figma-style outlined pill: transparent bg + colored border + colored text. */
  outlined?: boolean;
}

const variantClass: Record<
  BadgeVariant,
  { bg: string; text: string; dot: string; border: string }
> = {
  success: { bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500", border: "border-green-500" },
  active: { bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500", border: "border-green-500" },
  warning: { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-500", border: "border-amber-500" },
  pending: { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-500", border: "border-amber-500" },
  error: { bg: "bg-red-100", text: "text-red-600", dot: "bg-red-500", border: "border-red-400" },
  suspended: { bg: "bg-red-100", text: "text-red-600", dot: "bg-red-500", border: "border-red-400" },
  info: { bg: "bg-blue-100", text: "text-blue-600", dot: "bg-blue-500", border: "border-blue-500" },
  draft: { bg: "bg-gray-100", text: "text-gray-500", dot: "bg-gray-400", border: "border-gray-400" },
  default: { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400", border: "border-gray-400" },
};

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = "default",
  size = "md",
  dot = false,
  outlined = false,
  style,
  ...rest
}) => {
  const classes = variantClass[variant];
  const isSmall = size === "sm";

  return (
    <View
      className={[
        "flex-row items-center self-start rounded-full",
        outlined ? `bg-transparent border ${classes.border}` : classes.bg,
        isSmall ? "px-2 py-0.5" : "px-3 py-1",
      ].join(" ")}
      style={style}
      {...rest}
    >
      {dot && (
        <View className={["rounded-full mr-1.5", classes.dot, isSmall ? "w-1.5 h-1.5" : "w-2 h-2"].join(" ")} />
      )}
      <Text className={[classes.text, isSmall ? "text-xs font-medium" : "text-sm font-medium"].join(" ")}>
        {label}
      </Text>
    </View>
  );
};
