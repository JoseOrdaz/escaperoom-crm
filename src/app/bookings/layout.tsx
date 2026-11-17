"use client";

import { ReactNode, useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { Analytics } from "@vercel/analytics/next";
import { DashboardHeader } from "@/components/header";
import { DashboardFooter } from "@/components/footer";
import { SessionProvider, type SessionInfo } from "@/components/session-provider";

export default function BookingsLayout({ children }: { children: ReactNode }) {
  // Misma sesión que el panel: sin ella el menú lateral ocultaba las opciones con permisos
  const [session, setSession] = useState<SessionInfo | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => { if (!cancelled && json) setSession(json); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <SessionProvider value={session}>
      <div className="min-h-dvh bg-background lg:pl-60">
        <DashboardHeader />
        <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mb-4 flex flex-col gap-2 border-b pb-4">
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <CalendarDays className="h-6 w-6 text-primary" />
              Reservas para clientes
            </h1>
            <p className="text-sm text-muted-foreground">Demo del módulo que ven los clientes en la web de cada escape. Las reservas que hagas aquí son reales.</p>
          </div>
          {children}
          <Analytics />
        </main>
        <DashboardFooter />
      </div>
    </SessionProvider>
  );
}
