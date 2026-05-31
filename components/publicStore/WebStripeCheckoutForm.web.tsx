import React, { useMemo, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { CardElement, Elements, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

const stripePromise = loadStripe(process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "");

interface WebStripeCheckoutFormProps {
  amountLabel: string;
  disabled?: boolean;
  billingEmail: string;
  billingName: string;
  onBeforeConfirm: () => Promise<string>;
  onSuccess: (paymentId: string | null) => Promise<void>;
  onError: (message: string) => void;
}

interface InnerProps extends WebStripeCheckoutFormProps {}

function InnerCheckoutForm(props: InnerProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  const cardOptions = useMemo(
    () => ({
      hidePostalCode: true,
      style: {
        base: {
          color: "#1F2937",
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: "16px",
          iconColor: "#076B51",
          "::placeholder": {
            color: "#8A8F94",
          },
        },
        invalid: {
          color: "#E11D48",
          iconColor: "#E11D48",
        },
      },
    }),
    [],
  );

  const handlePress = async () => {
    if (props.disabled || submitting) return;
    if (!stripe || !elements) {
      props.onError("Stripe is still loading. Please try again.");
      return;
    }

    const card = elements.getElement(CardElement);
    if (!card) {
      props.onError("Card details are not ready yet.");
      return;
    }

    setSubmitting(true);
    try {
      const clientSecret = await props.onBeforeConfirm();
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card,
          billing_details: {
            email: props.billingEmail,
            name: props.billingName,
          },
        },
      });

      if (result.error) {
        props.onError(result.error.message ?? "Card payment failed.");
        return;
      }

      await props.onSuccess(result.paymentIntent?.id ?? null);
    } catch (error) {
      props.onError(error instanceof Error ? error.message : "Card payment failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View
      style={{
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "#D8E7E0",
        backgroundColor: "#FFFFFF",
        padding: 16,
        gap: 14,
      }}
    >
      <View>
        <Text style={{ color: "#2B2B2B", fontSize: 15, lineHeight: 21, fontFamily: "Manrope-Bold" }}>
          Credit / Debit Card
        </Text>
        <Text style={{ color: "#687076", fontSize: 13, lineHeight: 19, fontFamily: "Outfit-Regular", marginTop: 4 }}>
          Visa, Mastercard, Amex
        </Text>
      </View>

      <View
        style={{
          borderRadius: 16,
          borderWidth: 1,
          borderColor: "#E7EAE8",
          backgroundColor: "#FAFBFA",
          paddingHorizontal: 14,
          paddingVertical: 18,
        }}
      >
        <CardElement options={cardOptions} />
      </View>

      <TouchableOpacity
        activeOpacity={0.88}
        disabled={props.disabled || submitting}
        onPress={handlePress}
        style={{
          height: 56,
          borderRadius: 18,
          backgroundColor: "#076B51",
          alignItems: "center",
          justifyContent: "center",
          opacity: props.disabled || submitting ? 0.65 : 1,
        }}
      >
        {submitting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={{ color: "#FFFFFF", fontSize: 15, lineHeight: 21, fontFamily: "Manrope-Bold" }}>
            Pay Securely - {props.amountLabel}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

export function WebStripeCheckoutForm(props: WebStripeCheckoutFormProps) {
  if (!process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    return (
      <View
        style={{
          borderRadius: 18,
          borderWidth: 1,
          borderColor: "#F2D5D8",
          backgroundColor: "#FFF8F8",
          padding: 16,
        }}
      >
        <Text style={{ color: "#B42318", fontSize: 13, lineHeight: 19, fontFamily: "Outfit-Regular" }}>
          Stripe is not configured for this environment.
        </Text>
      </View>
    );
  }

  return (
    <Elements stripe={stripePromise}>
      <InnerCheckoutForm {...props} />
    </Elements>
  );
}
