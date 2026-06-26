import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "../../stores/authStore";
import { UserRole } from "../../types/auth";
import { authService } from "../../services/authService";
import {
  FieldLabel,
  FormCard,
  OnboardingHeader,
  PrimaryButton,
} from "../../components/onboarding/FigmaNativeUI";

type BuyerSignupStep = "account" | "otp" | "details";

const BUYER_OTP_PURPOSE = "buyer_signup_email";

async function sendBuyerSignupOtp(contact: string) {
  return authService.sendOtp(contact, BUYER_OTP_PURPOSE);
}

async function verifyBuyerSignupOtp(contact: string, code: string) {
  return authService.verifyOtp(contact, code, BUYER_OTP_PURPOSE);
}

export default function RegisterScreen() {
  const router = useRouter();
  const { role, redirect, ref } = useLocalSearchParams<{ role?: string; redirect?: string; ref?: string }>();
  const { register, isLoading, error, isAuthenticated, user, clearError, beginFreshAuthFlow } =
    useAuthStore();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState(() => (typeof ref === "string" ? ref.trim() : ""));
  const [buyerStep, setBuyerStep] = useState<BuyerSignupStep>("account");
  const [otpCode, setOtpCode] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [postcode, setPostcode] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");

  const resolvedRole = (role ?? "buyer") as UserRole;
  const isVendor = resolvedRole === "vendor";

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    if (user.role !== resolvedRole) return;

    if (isVendor && user.role === "vendor") {
      router.push("/(vendor-onboarding)/otp" as any);
      return;
    }

    if (user.role === "vendor") {
      router.replace("/(vendor)" as any);
    } else if (user.role === "admin") {
      router.replace("/(admin)" as any);
    } else if (redirect) {
      router.replace(redirect as any);
    } else {
      router.replace("/(buyer)" as any);
    }
  }, [isAuthenticated, user, isVendor, router, redirect]);

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    if (user.role !== resolvedRole) {
      beginFreshAuthFlow().catch(() => {});
    }
  }, [beginFreshAuthFlow, isAuthenticated, resolvedRole, user]);

  useEffect(() => {
    if (error) {
      Alert.alert("Registration failed", error);
    }
  }, [error]);

  useEffect(() => {
    clearError();
    setBuyerStep("account");
  }, [clearError, resolvedRole, redirect]);

  const validateAccountFields = () => {
    if (!name.trim()) {
      Alert.alert("Missing details", "Full name is required.");
      return false;
    }
    if (!email.trim()) {
      Alert.alert("Missing details", "Email address is required.");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      Alert.alert("Invalid email", "Enter a valid email address.");
      return false;
    }
    if (!password.trim()) {
      Alert.alert("Missing details", "Password is required.");
      return false;
    }
    return true;
  };

  const handleContinue = async () => {
    if (!validateAccountFields()) return;

    clearError();
    if (!isVendor) {
      setOtpSending(true);
      try {
        await sendBuyerSignupOtp(email.trim().toLowerCase());
        setBuyerStep("otp");
        Alert.alert("Code sent", "We sent a verification code to your email.");
      } catch (err) {
        Alert.alert("Could not send code", err instanceof Error ? err.message : "Please try again.");
      } finally {
        setOtpSending(false);
      }
      return;
    }

    if (isAuthenticated || user) {
      await beginFreshAuthFlow().catch(() => {});
    }
    await register({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role: resolvedRole,
      referralCode: referralCode.trim() || undefined,
    });
  };

  const handleVerifyBuyerOtp = async () => {
    if (!otpCode.trim()) {
      Alert.alert("Enter code", "Enter the OTP sent to your email.");
      return;
    }

    setOtpVerifying(true);
    try {
      const result = await verifyBuyerSignupOtp(email.trim().toLowerCase(), otpCode.trim());
      if (!result.verified) {
        Alert.alert("Invalid code", "The code could not be verified. Please check it and try again.");
        return;
      }
      setBuyerStep("details");
    } catch (err) {
      Alert.alert("Verification failed", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleBuyerSignup = async () => {
    if (!phone.trim()) {
      Alert.alert("Missing phone", "Add your phone number for order and delivery updates.");
      return;
    }
    if (!country.trim()) {
      Alert.alert("Missing country", "Add your delivery country.");
      return;
    }
    if (!deliveryAddress.trim()) {
      Alert.alert("Missing address", "Add your delivery address.");
      return;
    }

    clearError();
    if (isAuthenticated || user) {
      await beginFreshAuthFlow().catch(() => {});
    }
    await register({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role: "buyer",
      phone: phone.trim(),
      country: country.trim(),
      city: city.trim() || undefined,
      postcode: postcode.trim() || undefined,
      deliveryAddress: deliveryAddress.trim(),
      referralCode: referralCode.trim() || undefined,
    });
  };

  const activeSegments = isVendor ? 0 : buyerStep === "account" ? 0 : buyerStep === "otp" ? 1 : 2;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <SafeAreaView edges={["top"]} style={{ backgroundColor: "transparent" }}>
          <TouchableOpacity
            onPress={() => {
              if (!isVendor && buyerStep === "details") {
                setBuyerStep("otp");
              } else if (!isVendor && buyerStep === "otp") {
                setOtpCode("");
                setBuyerStep("account");
              } else {
                router.back();
              }
            }}
            activeOpacity={0.8}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </SafeAreaView>
        <OnboardingHeader
          activeSegments={activeSegments}
          title={
            isVendor
              ? "Create your vendor account"
              : buyerStep === "otp"
              ? "Verify your email"
              : buyerStep === "details"
              ? "Add delivery details"
              : "Create your buyer account"
          }
          subtitle={
            isVendor
              ? "Use your email to set up your store and seller profile."
              : buyerStep === "otp"
              ? "Enter the code we sent before creating your buyer account."
              : buyerStep === "details"
              ? "These details help vendors deliver orders and send delivery updates."
              : "Use your email to start shopping with Eki."
          }
        />

        <FormCard>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollBody}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sectionTitle}>
              {buyerStep === "otp" ? "Email OTP" : buyerStep === "details" ? "Delivery Profile" : "Create Account"}
            </Text>

            {buyerStep === "account" ? (
              <>
                <View style={styles.fieldGroup}>
                  <FieldLabel>Full name:</FieldLabel>
                  <TextInput
                    autoCapitalize="words"
                    onChangeText={(value) => {
                      setName(value);
                      if (error) clearError();
                    }}
                    placeholder="e.g johnson"
                    placeholderTextColor="#858585"
                    style={styles.input}
                    value={name}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <FieldLabel>Email address</FieldLabel>
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    onChangeText={(value) => {
                      setEmail(value);
                      if (error) clearError();
                    }}
                    placeholder="e.g name@email.com"
                    placeholderTextColor="#858585"
                    style={styles.input}
                    textContentType="emailAddress"
                    value={email}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <FieldLabel>Password:</FieldLabel>
                  <TextInput
                    onChangeText={(value) => {
                      setPassword(value);
                      if (error) clearError();
                    }}
                    placeholder="Enter your password"
                    placeholderTextColor="#858585"
                    secureTextEntry
                    style={styles.input}
                    value={password}
                  />
                </View>

                {!isVendor ? (
                  <View style={styles.fieldGroup}>
                    <FieldLabel>Referral code (optional):</FieldLabel>
                    <TextInput
                      autoCapitalize="characters"
                      onChangeText={setReferralCode}
                      placeholder="Enter referral code"
                      placeholderTextColor="#858585"
                      style={styles.input}
                      value={referralCode}
                    />
                  </View>
                ) : null}
              </>
            ) : null}

            {!isVendor && buyerStep === "otp" ? (
              <>
                <View style={styles.noticeCard}>
                  <Text style={styles.noticeTitle}>Check your email</Text>
                  <Text style={styles.noticeText}>
                    We sent a verification code to:
                  </Text>
                  <Text style={{ color: "#076B51", fontFamily: "Manrope-Bold", fontSize: 14, marginTop: 6 }}>
                    {email.trim().toLowerCase()}
                  </Text>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => { setOtpCode(""); setBuyerStep("account"); }}
                    style={{ marginTop: 10 }}
                  >
                    <Text style={{ color: "#076B51", fontFamily: "Manrope-Bold", fontSize: 13 }}>
                      Wrong email? Go back
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.fieldGroup}>
                  <FieldLabel>Verification code:</FieldLabel>
                  <TextInput
                    autoFocus
                    keyboardType="number-pad"
                    maxLength={6}
                    onChangeText={setOtpCode}
                    placeholder="Enter 4-6 digit code"
                    placeholderTextColor="#858585"
                    style={[styles.input, styles.otpInput]}
                    value={otpCode}
                  />
                </View>
              </>
            ) : null}

            {!isVendor && buyerStep === "details" ? (
              <>
                <View style={styles.fieldGroup}>
                  <FieldLabel>Phone number:</FieldLabel>
                  <TextInput
                    keyboardType="phone-pad"
                    onChangeText={setPhone}
                    placeholder="+44 7700 900123"
                    placeholderTextColor="#858585"
                    style={styles.input}
                    value={phone}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <FieldLabel>Delivery address:</FieldLabel>
                  <TextInput
                    autoCapitalize="words"
                    onChangeText={setDeliveryAddress}
                    placeholder="Street address"
                    placeholderTextColor="#858585"
                    style={styles.input}
                    value={deliveryAddress}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <FieldLabel>Country:</FieldLabel>
                  <TextInput
                    autoCapitalize="words"
                    onChangeText={setCountry}
                    placeholder="United Kingdom"
                    placeholderTextColor="#858585"
                    style={styles.input}
                    value={country}
                  />
                </View>

                <View style={styles.twoColumn}>
                  <View style={[styles.fieldGroup, styles.twoColumnItem]}>
                    <FieldLabel>City:</FieldLabel>
                    <TextInput
                      autoCapitalize="words"
                      onChangeText={setCity}
                      placeholder="London"
                      placeholderTextColor="#858585"
                      style={styles.input}
                      value={city}
                    />
                  </View>
                  <View style={[styles.fieldGroup, styles.twoColumnItem]}>
                    <FieldLabel>Postcode:</FieldLabel>
                    <TextInput
                      autoCapitalize="characters"
                      onChangeText={setPostcode}
                      placeholder="E1 6RF"
                      placeholderTextColor="#858585"
                      style={styles.input}
                      value={postcode}
                    />
                  </View>
                </View>
              </>
            ) : null}

            <View style={{ flex: 1 }} />

            {!isVendor && buyerStep === "account" ? (
              <View style={styles.rewardCard}>
                <Text style={styles.rewardTitle}>Buyer rewards on signup</Text>
                <Text style={styles.rewardItem}>
                  - Your personal referral code is created on your Eki account after signup.
                </Text>
                <Text style={styles.rewardItem}>
                  - Referral credit is added after the invited buyer completes their first paid order.
                </Text>
                <Text style={styles.rewardItem}>
                  - Earned wallet credits and referral totals stay synced with your live account.
                </Text>
              </View>
            ) : null}

            {isVendor ? (
              <Text style={styles.note}>You'll set up your store in the next step</Text>
            ) : null}

            {buyerStep === "account" ? (
              <PrimaryButton
                disabled={isLoading || otpSending}
                onPress={handleContinue}
                title={isLoading || otpSending ? "Loading..." : "Continue"}
              />
            ) : buyerStep === "otp" ? (
              <>
                <PrimaryButton
                  disabled={otpVerifying}
                  onPress={handleVerifyBuyerOtp}
                  title={otpVerifying ? "Verifying..." : "Verify email"}
                />
                <TouchableOpacity
                  activeOpacity={0.7}
                  disabled={otpSending}
                  onPress={handleContinue}
                  style={styles.secondaryTextButton}
                >
                  <Text style={styles.secondaryTextButtonText}>{otpSending ? "Sending..." : "Resend code"}</Text>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.7} onPress={() => setBuyerStep("account")} style={styles.secondaryTextButton}>
                  <Text style={styles.secondaryTextButtonText}>Change email</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <PrimaryButton
                  disabled={isLoading}
                  onPress={handleBuyerSignup}
                  title={isLoading ? "Creating..." : "Create buyer account"}
                />
                <TouchableOpacity activeOpacity={0.7} onPress={() => setBuyerStep("otp")} style={styles.secondaryTextButton}>
                  <Text style={styles.secondaryTextButtonText}>Back to code</Text>
                </TouchableOpacity>
              </>
            )}

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() =>
                  router.push({
                    pathname: "/(auth)/login",
                    params: { role: resolvedRole, redirect },
                  })
                }
              >
                <Text style={styles.footerLink}>Log In</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </FormCard>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#076B51" },
  flex: { flex: 1 },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 16,
    marginBottom: 4,
  },
  scrollBody: { flexGrow: 1, paddingBottom: 16 },
  sectionTitle: {
    color: "#1A1A1A",
    fontFamily: "Manrope-Bold",
    fontSize: 18,
    marginBottom: 22,
  },
  fieldGroup: {
    marginBottom: 18,
  },
  twoColumn: {
    flexDirection: "row",
    gap: 12,
  },
  twoColumnItem: {
    flex: 1,
  },
  input: {
    height: 52,
    borderRadius: 12,
    backgroundColor: "#F4F4F4",
    color: "#282828",
    fontFamily: "Outfit-Regular",
    fontSize: 14,
    paddingHorizontal: 18,
  },
  otpInput: {
    fontFamily: "Manrope-Bold",
    fontSize: 18,
    letterSpacing: 1,
    textAlign: "center",
  },
  noticeCard: {
    borderRadius: 16,
    backgroundColor: "#F0F7F4",
    padding: 14,
    marginBottom: 18,
  },
  noticeTitle: {
    color: "#076B51",
    fontFamily: "Manrope-Bold",
    fontSize: 14,
    marginBottom: 4,
  },
  noticeText: {
    color: "#24564A",
    fontFamily: "Outfit-Regular",
    fontSize: 12,
    lineHeight: 18,
  },
  note: {
    color: "#858585",
    fontFamily: "Outfit-Medium",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 14,
    marginTop: 16,
  },
  rewardCard: {
    borderRadius: 16,
    backgroundColor: "#F0F7F4",
    padding: 14,
    marginTop: 8,
    marginBottom: 14,
  },
  rewardTitle: {
    color: "#076B51",
    fontFamily: "Manrope-Bold",
    fontSize: 14,
    marginBottom: 8,
  },
  rewardItem: {
    color: "#24564A",
    fontFamily: "Outfit-Regular",
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 4,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 18,
    paddingBottom: 8,
  },
  footerText: {
    color: "#1A1A1A",
    fontFamily: "Manrope-SemiBold",
    fontSize: 13,
  },
  footerLink: {
    color: "#076B51",
    fontFamily: "Manrope-Bold",
    fontSize: 13,
  },
  secondaryTextButton: {
    alignSelf: "center",
    paddingVertical: 10,
    marginTop: 4,
  },
  secondaryTextButtonText: {
    color: "#076B51",
    fontFamily: "Manrope-Bold",
    fontSize: 13,
  },
});
