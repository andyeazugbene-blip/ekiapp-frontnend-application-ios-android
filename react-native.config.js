// Android-only native dependency. @react-native-google-signin/google-signin
// fixes the Android Google Sign-In bug (see components/auth/
// SocialAuthButtons.tsx for the root cause) — iOS keeps using
// expo-auth-session untouched and never calls this library's API. React
// Native's CocoaPods autolinking would otherwise link its iOS native module
// into every iOS build regardless of whether the JS ever calls it (that's
// separate from, and unaffected by, whether its Expo config plugin is
// applied) — excluding it here keeps the iOS build exactly as it was before
// this package existed in node_modules at all.
module.exports = {
  dependencies: {
    "@react-native-google-signin/google-signin": {
      platforms: {
        ios: null,
      },
    },
  },
};
