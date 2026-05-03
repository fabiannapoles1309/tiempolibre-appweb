import React, { createContext, useContext, useEffect, useState } from "react";
import { User, UserRole, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Devuelve true si el usuario tiene capacidades de administrador.
 * SUPERUSER hereda todos los permisos de ADMIN.
 */
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
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const queryClient = useQueryClient();

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
    } else if (meData && !meData.user) {
      setUserState(null);
      localStorage.removeItem("tiempolibre_user");
    }
  }, [meData]);

  const setUser = (newUser: User | null) => {
    setUserState(newUser);
    if (newUser) {
      localStorage.setItem("tiempolibre_user", JSON.stringify(newUser));
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


