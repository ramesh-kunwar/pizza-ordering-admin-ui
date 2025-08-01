import { create } from "zustand";

import { devtools, persist } from "zustand/middleware";

interface Tenant {
  id: number;
  name: string;
  address: string;
}
export interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  tenant: Tenant;
}

interface AuthState {
  user: null | User;
  setUser: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set) => ({
        user: null,
        setUser: (user) => set({ user: user }),
        logout: () => set({ user: null }),
      }),
      {
        name: "auth-storage",
        partialize: (state) => ({ user: state.user }),
      }
    )
  )
);
