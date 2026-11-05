"use client";

import React, { createContext, useContext, useEffect } from "react";
import { useAuthStore } from "@/store/auth-store";
import { SystemRole, User } from "@/types";

interface AuthContextValue {
  user: User;
  role: SystemRole;
  orgId: string;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, currentRole, currentOrg, isAuthenticated } = useAuthStore();

  return (
    <AuthContext.Provider
      value={{
        user: currentUser,
        role: currentRole,
        orgId: currentOrg?.id || "org-1",
        isAuthenticated,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}


export const useAuthContext = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
  return ctx;
};
