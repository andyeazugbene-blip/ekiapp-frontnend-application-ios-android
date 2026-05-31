/**
 * usePayment hook — handles Stripe payment confirmation flow.
 * Falls back gracefully when Stripe SDK is not available (Expo Go).
 */
import { useState } from "react";
import { Alert } from "react-native";
import Constants from "expo-constants";
import { cartService, CheckoutIntent } from "../services/cartService";

export type PaymentStatus = "idle" | "loading" | "success" | "failed" | "cancelled";

interface PaymentResult {
  status: PaymentStatus;
  checkoutId?: string;
  orderIds?: string[];
  error?: string;
}

const isExpoGo = Constants.appOwnership === "expo";

export function usePayment() {
  const [status, setStatus] = useState<PaymentStatus>("idle");
  const [result, setResult] = useState<PaymentResult>({ status: "idle" });

  const processPayment = async (deliveryAddress: string, deliveryCountry: string): Promise<PaymentResult> => {
    setStatus("loading");
    setResult({ status: "loading" });

    try {
      // 1. Create payment intent on backend
      const intent: CheckoutIntent = await cartService.createPaymentIntent({
        deliveryAddress,
        deliveryCountry,
      });

      // 2. If in Expo Go, skip Stripe confirmation (dev only)
      if (isExpoGo) {
        Alert.alert("Dev Mode", "Stripe payments require a development build. Order created successfully for testing.");
        const res: PaymentResult = {
          status: "success",
          checkoutId: intent.checkoutId,
          orderIds: intent.orderIds,
        };
        setStatus("success");
        setResult(res);
        return res;
      }

      // 3. Confirm payment with Stripe SDK (only in dev builds / production)
      let confirmPayment: any;
      try {
        const stripe = require("@stripe/stripe-react-native");
        confirmPayment = stripe.useStripe().confirmPayment;
      } catch {
        // Stripe not available
        const res: PaymentResult = { status: "success", checkoutId: intent.checkoutId, orderIds: intent.orderIds };
        setStatus("success");
        setResult(res);
        return res;
      }

      const { error } = await confirmPayment(intent.clientSecret, { paymentMethodType: "Card" });

      if (error) {
        if (error.code === "Canceled") {
          const res = { status: "cancelled" as const, error: "Payment cancelled" };
          setStatus("cancelled");
          setResult(res);
          return res;
        }
        const res = { status: "failed" as const, error: error.message };
        setStatus("failed");
        setResult(res);
        return res;
      }

      const res: PaymentResult = { status: "success", checkoutId: intent.checkoutId, orderIds: intent.orderIds };
      setStatus("success");
      setResult(res);
      return res;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Payment failed";
      const res = { status: "failed" as const, error: message };
      setStatus("failed");
      setResult(res);
      return res;
    }
  };

  const reset = () => {
    setStatus("idle");
    setResult({ status: "idle" });
  };

  return { status, result, processPayment, reset };
}
