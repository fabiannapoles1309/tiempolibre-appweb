import React, { createContext, useContext, useEffect, useState } from "react";
import { User, UserRole, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

export function isAdmin(user: { role: string } | null | undefined): boolean {
  if (!user) return false;
  return user.role === UserRole.ADMIN || user.role === UserRole.SUPERUSER;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(() => {
    const saved = localStorage.getItem("tiempolibre_user");
    if (saved) {
      try { return JSON.parse(saved); } catch { return null; }
    }
    return null;
  });
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const { data: meData, isLoading } = useGetMe({
    query: {
      retry: false,
      queryKey: getGetMeQueryKey(),
    },
  });

  useEffect(() => {
    if (meData?.user) {
      setUserState(meData.user);
      localStorage.setItem("tiempolibre_user", JSON.stringify(meData.user));
      if ((meData.user as any).mustChangePassword) {
        navigate("/change-password");
      }
    } else if (meData && !meData.user) {
      setUserState(null);
      localStorage.removeItem("tiempolibre_user");
    }
  }, [meData]);

  const setUser = (newUser: User | null) => {
    setUserState(newUser);
    if (newUser) {
      localStorage.setItem("tiempolibre_user", JSON.stringify(newUser));
      if ((newUser as any).mustChangePassword) {
        navigate("/change-password");
      }
    } else {
      localStorage.removeItem("tiempolibre_user");
    }
  };

  const logout = () => {
    setUserState(null);
    localStorage.removeItem("tiempolibre_user");
    queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
