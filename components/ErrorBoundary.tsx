import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("App screen crashed", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.body}>Please close and reopen Eki. If this continues, contact support.</Text>
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
});
