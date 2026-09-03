import { LoginCredentials, OAuthOutcome, RegisterPayload } from "../types/auth";
import { apiClient, ApiRequestError } from "./api";
import { tokenStorage } from "./api/tokenStorage";

interface AuthResponse {
  user: any;
  token: string;
  refreshToken?: string;
}

interface MeResponse {
  user: any;
}

interface DeleteAccountResponse {
  message: string;
}

function normalizeUser(user: any): any {
  if (!user) return user;
  if (user.role && typeof user.role === "string") {
    user.role = user.role.toLowerCase();
  }
  return user;
}

export const authService = {
  async login(credentials: LoginCredentials) {
    const response = await apiClient.post<AuthResponse>(
      "/api/auth/login",
      { email: credentials.email, password: credentials.password },
      { skipAuth: true }
    );

    await tokenStorage.setToken(response.token);
    if (response.refreshToken) {
      await tokenStorage.setRefreshToken(response.refreshToken);
    }

    return { user: normalizeUser(response.user), token: response.token };
  },

  async register(payload: RegisterPayload) {
    const response = await apiClient.post<AuthResponse>(
      "/api/auth/register",
      {
        name: payload.name,
        email: payload.email,
        password: payload.password,
        phone: payload.phone,
        role: payload.role,
        storeName: payload.storeName,
        country: payload.country,
        city: payload.city,
        postcode: payload.postcode,
        deliveryAddress: payload.deliveryAddress,
        referralCode: payload.referralCode,
      },
      { skipAuth: true }
    );

    await tokenStorage.setToken(response.token);
    if (response.refreshToken) {
      await tokenStorage.setRefreshToken(response.refreshToken);
    }

    return { user: normalizeUser(response.user), token: response.token };
  },

  async getMe() {
    const token = await tokenStorage.getToken();
    if (!token) return null;

    try {
      const response = await apiClient.get<MeResponse>("/api/auth/me");
      return { user: normalizeUser(response.user), token };
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 401) {
        await tokenStorage.clearTokens();
        return null;
      }
      throw err;
    }
  },

  async updateProfile(data: Record<string, unknown>) {
    return apiClient.patch<{ user: any }>("/api/auth/me", data);
  },

  async deleteAccount() {
    return apiClient.post<DeleteAccountResponse>("/api/me/delete-account");
  },

  async forgotPassword(email: string) {
    return apiClient.post<{ message: string }>(
      "/api/auth/forgot-password",
      { email },
      { skipAuth: true }
    );
  },

  async sendOtp(contact: string, purpose = "vendor_onboarding_email", channel: "email" | "sms" = "email") {
    return apiClient.post<{ message: string }>(
      "/api/auth/send-otp",
      { contact, purpose, channel },
      { skipAuth: true }
    );
  },

  async verifyOtp(contact: string, code: string, purpose = "vendor_onboarding_email") {
    return apiClient.post<{ verified: boolean }>(
      "/api/auth/verify-otp",
      { contact, code, purpose },
      { skipAuth: true }
    );
  },

  async resetPassword(token: string, newPassword: string) {
    return apiClient.post<{ message: string }>(
      "/api/auth/reset-password",
      { token, password: newPassword },
      { skipAuth: true }
    );
  },

  async logout() {
    // Real server-side revocation (increments the user's tokenVersion, so
    // this exact token — and any other outstanding one for this account —
    // stops working immediately instead of just being discarded locally
    // and remaining valid until it naturally expires). Best-effort: if the
    // network call fails, the user must still be able to log out locally.
    try {
      await apiClient.post("/api/auth/logout");
    } catch {
      // Ignore — clearing local tokens below is what actually logs this
      // device out; the server-side revocation is defense in depth.
    }
    await tokenStorage.clearTokens();
    return true;
  },

  async switchRole() {
    const response = await apiClient.post<AuthResponse>("/api/auth/switch-role");
    await tokenStorage.setToken(response.token);
    return { user: normalizeUser(response.user), token: response.token };
  },

  // ─── Google / Apple Sign-In ────────────────────────────────────────────
  // These three never store a token themselves for LINK_REQUIRED/
  // SIGNUP_REQUIRED (there isn't one yet) — only a LOGIN outcome, or a
  // completed link/signup, actually issues a session.

  async continueWithGoogle(idToken: string, name?: string): Promise<OAuthOutcome> {
    const outcome = await apiClient.post<OAuthOutcome>("/api/auth/oauth/google", { idToken, name }, { skipAuth: true });
    if (outcome.status === "LOGIN") {
      await tokenStorage.setToken(outcome.token);
      outcome.user = normalizeUser(outcome.user);
    }
    return outcome;
  },

  async continueWithApple(identityToken: string, fullName?: string): Promise<OAuthOutcome> {
    const outcome = await apiClient.post<OAuthOutcome>("/api/auth/oauth/apple", { identityToken, fullName }, { skipAuth: true });
    if (outcome.status === "LOGIN") {
      await tokenStorage.setToken(outcome.token);
      outcome.user = normalizeUser(outcome.user);
    }
    return outcome;
  },

  async linkOAuthAccount(ticket: string, email: string, password: string) {
    const response = await apiClient.post<AuthResponse>("/api/auth/oauth/link", { ticket, email, password }, { skipAuth: true });
    await tokenStorage.setToken(response.token);
    return { user: normalizeUser(response.user), token: response.token };
  },

  async completeOAuthSignup(payload: { ticket: string; name?: string; email?: string; role: "BUYER" | "VENDOR"; referralCode?: string }) {
    const response = await apiClient.post<AuthResponse>("/api/auth/oauth/complete-signup", payload, { skipAuth: true });
    await tokenStorage.setToken(response.token);
    return { user: normalizeUser(response.user), token: response.token };
  },
};
