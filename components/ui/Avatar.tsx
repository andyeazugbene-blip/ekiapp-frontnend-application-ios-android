import React from "react";
import { View, Image, Text, ViewProps } from "react-native";

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

interface AvatarProps extends ViewProps {
  uri?: string;
  name?: string;
  size?: AvatarSize;
  online?: boolean;
}

const sizeMap: Record<AvatarSize, { container: string; text: string; dot: string }> = {
  xs: { container: "w-7 h-7", text: "text-xs", dot: "w-2 h-2" },
  sm: { container: "w-9 h-9", text: "text-sm", dot: "w-2.5 h-2.5" },
  md: { container: "w-11 h-11", text: "text-base", dot: "w-3 h-3" },
  lg: { container: "w-14 h-14", text: "text-lg", dot: "w-3.5 h-3.5" },
  xl: { container: "w-20 h-20", text: "text-2xl", dot: "w-4 h-4" },
};

function getInitials(name?: string): string {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function getColorFromName(name?: string): string {
  const colors = [
    "bg-green-500",
    "bg-teal-500",
    "bg-blue-500",
    "bg-purple-500",
    "bg-orange-500",
    "bg-pink-500",
  ];
  if (!name) return colors[0];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
}

export const Avatar: React.FC<AvatarProps> = ({
  uri,
  name,
  size = "md",
  online,
  style,
  ...rest
}) => {
  const s = sizeMap[size];
  const initials = getInitials(name);
  const bgColor = getColorFromName(name);

  return (
    <View className="relative self-start" style={style} {...rest}>
      {uri ? (
        <Image
          source={{ uri }}
          className={[s.container, "rounded-full"].join(" ")}
        />
      ) : (
        <View className={[s.container, "rounded-full items-center justify-center", bgColor].join(" ")}>
          <Text className={["text-white font-semibold", s.text].join(" ")}>{initials}</Text>
        </View>
      )}

      {online !== undefined && (
        <View
          className={[
            "absolute bottom-0 right-0 rounded-full border-2 border-white",
            s.dot,
            online ? "bg-green-400" : "bg-gray-400",
          ].join(" ")}
        />
      )}
    </View>
  );
};
