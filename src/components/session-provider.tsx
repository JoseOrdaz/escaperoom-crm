"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Escape, Permission, Role } from "@/lib/permissions";

export type SessionInfo = {
  name: string;
  surname: string;
  email: string;
  avatar: string;
  role: Role;
  escapes: Escape[];
  permissions: Permission[];
};

const SessionContext = createContext<SessionInfo | null>(null);

export function SessionProvider({ value, children }: { value: SessionInfo | null; children: ReactNode }) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/** Usuario actual (rol, escapes y permisos). `can` devuelve false mientras carga. */
export function useSession() {
  const info = useContext(SessionContext);
  return {
    info,
    isAdmin: info?.role === "admin",
    can: (perm: Permission) => !!info?.permissions.includes(perm),
  };
}
