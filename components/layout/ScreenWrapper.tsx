import React from "react";
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ViewProps,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "../../constants/colors";

interface ScreenWrapperProps extends ViewProps {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  bg?: "default" | "surface" | "dark" | "primary";
  refreshing?: boolean;
  onRefresh?: () => void;
  keyboardAvoiding?: boolean;
}

const bgClass = {
  default: "bg-white",
  surface: "bg-surface",
  dark: "bg-dark-bg",
  primary: "bg-primary-500",
};

export const ScreenWrapper: React.FC<ScreenWrapperProps> = ({
  children,
  scroll = false,
  padded = true,
  bg = "surface",
  refreshing = false,
  onRefresh,
  keyboardAvoiding = false,
  style,
  ...rest
}) => {
  const content = (
    <SafeAreaView className={["flex-1", bgClass[bg]].join(" ")}>
      {scroll ? (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={Colors.primary.DEFAULT}
                colors={[Colors.primary.DEFAULT]}
              />
            ) : undefined
          }
        >
          <View
            className={padded ? "px-4 py-4 flex-1" : "flex-1"}
            style={style}
            {...rest}
          >
            {children}
          </View>
        </ScrollView>
      ) : (
        <View
          className={["flex-1", padded ? "px-4 py-4" : ""].join(" ")}
          style={style}
          {...rest}
        >
          {children}
        </View>
      )}
    </SafeAreaView>
  );

  if (keyboardAvoiding) {
    return (
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {content}
      </KeyboardAvoidingView>
    );
  }

  return content;
};
