"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/header";
import { DashboardFooter } from "@/components/footer";
import { SessionProvider, type SessionInfo } from "@/components/session-provider";
import { canOpenPage } from "@/lib/permissions";
import { DoorOpen, Loader2 } from "lucide-react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<SessionInfo | null>(null);

  // Sesión real (cookie httpOnly) → rol, escapes y permisos
  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile", { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 401) {
          document.cookie = "session_user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
          router.replace("/login");
          return;
        }
        const json = await res.json();
        if (!cancelled) setSession(json);
      })
      .catch(() => router.replace("/login"));
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Páginas sin permiso → a Reservas
  const allowed = !session || canOpenPage(session.role, pathname);
  useEffect(() => {
    if (session && !allowed) router.replace("/dashboard/bookings");
  }, [session, allowed, router]);

  if (!session || !allowed) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-6" role="status" aria-live="polite">
        <div className="flex flex-col items-center text-center">
          <span className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-primary text-white"><DoorOpen className="size-7" /></span>
          <Loader2 className="mb-4 size-5 animate-spin text-primary motion-reduce:animate-none" />
          <p className="font-semibold">Preparando tu espacio</p>
          <p className="mt-1 text-sm text-muted-foreground">Cargando el panel de gestión…</p>
        </div>
      </div>
    );
  }

  return (
    <SessionProvider value={session}>
      <div className="min-h-dvh bg-background lg:pl-60">
        <DashboardHeader />
        <main className="mx-auto min-h-[calc(100dvh-8rem)] w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
        <DashboardFooter />
      </div>
    </SessionProvider>
  );
}
