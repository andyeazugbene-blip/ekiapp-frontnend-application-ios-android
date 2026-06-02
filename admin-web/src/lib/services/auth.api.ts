import { apiClient } from "../api";
import { User } from "@/types";

export const authAPI = {
  async login(email: string, password: string) {
    return apiClient.login(email, password);
  },

  async getCurrentUser(): Promise<User> {
    return apiClient.getCurrentUser({ suppressUnauthorizedRedirect: true });
  },

  logout() {
    apiClient.logout();
  },
};
