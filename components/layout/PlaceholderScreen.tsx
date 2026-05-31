import React from "react";
import { View, Text } from "react-native";
import { ScreenWrapper } from "./ScreenWrapper";

interface PlaceholderScreenProps {
  title: string;
  icon?: string;
  bg?: "surface" | "default" | "dark";
}

export const PlaceholderScreen: React.FC<PlaceholderScreenProps> = ({
  title,
  icon = "🚧",
  bg = "surface",
}) => (
  <ScreenWrapper bg={bg}>
    <View className="flex-1 items-center justify-center">
      <Text className="text-5xl mb-4">{icon}</Text>
      <Text className="text-xl font-bold text-gray-900">{title}</Text>
      <Text className="text-sm text-gray-400 mt-2 text-center px-8">
        Screen implementation coming in the next iteration
      </Text>
    </View>
  </ScreenWrapper>
);
