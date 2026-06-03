import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuthStore } from "../stores/authStore";

interface ErrorBoundaryState {
  hasError: boolean;
  message?: string;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error) {
    console.error("App screen crashed", error);
  }

  private retry = () => {
    this.setState({ hasError: false, message: undefined });
  };

  private resetSession = async () => {
    await useAuthStore.getState().beginFreshAuthFlow();
    this.setState({ hasError: false, message: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.body}>Please close and reopen Eki. If this continues, contact support.</Text>
          {this.state.message ? (
            <Text style={styles.debugText} numberOfLines={3}>
              {this.state.message}
            </Text>
          ) : null}
          <TouchableOpacity activeOpacity={0.86} onPress={this.retry} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Try again</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.86} onPress={this.resetSession} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Sign out and reset session</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "#F4F4F4",
  },
  title: {
    color: "#111827",
    fontFamily: "Manrope-Bold",
    fontSize: 22,
    marginBottom: 8,
    textAlign: "center",
  },
  body: {
    color: "#4B5563",
    fontFamily: "Outfit-Regular",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  debugText: {
    color: "#7F1D1D",
    fontFamily: "Outfit-Regular",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 14,
    maxWidth: 320,
    textAlign: "center",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#076B51",
    borderRadius: 14,
    height: 48,
    justifyContent: "center",
    marginTop: 22,
    minWidth: 220,
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontFamily: "Manrope-Bold",
    fontSize: 14,
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#D1D5DB",
    borderRadius: 14,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    marginTop: 10,
    minWidth: 220,
    paddingHorizontal: 18,
  },
  secondaryButtonText: {
    color: "#374151",
    fontFamily: "Manrope-SemiBold",
    fontSize: 13,
  },
});
