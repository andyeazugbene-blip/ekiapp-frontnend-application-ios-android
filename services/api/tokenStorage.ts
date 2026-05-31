/**
 * Token Storage — Secure JWT persistence using expo-secure-store.
 * Falls back to in-memory storage on web.
 */
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const TOKEN_KEY = "eki_auth_token";
const REFRESH_TOKEN_KEY = "eki_refresh_token";

// In-memory fallback for web (SecureStore is native-only)
let memoryToken: string | null = null;
let memoryRefreshToken: string | null = null;

const isNative = Platform.OS === "ios" || Platform.OS === "android";

export const tokenStorage = {
  async getToken(): Promise<string | null> {
    if (!isNative) return memoryToken;
    try {
      return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  async setToken(token: string): Promise<void> {
    if (!isNative) { memoryToken = token; return; }
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    } catch {}
  },

  async getRefreshToken(): Promise<string | null> {
    if (!isNative) return memoryRefreshToken;
    try {
      return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    } catch {
      return null;
    }
  },

  async setRefreshToken(token: string): Promise<void> {
    if (!isNative) { memoryRefreshToken = token; return; }
    try {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
    } catch {}
  },

  async clearTokens(): Promise<void> {
    if (!isNative) { memoryToken = null; memoryRefreshToken = null; return; }
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    } catch {}
  },
};
