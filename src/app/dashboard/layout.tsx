"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/header";
import { DashboardFooter } from "@/components/footer";
import { DoorOpen, Loader2 } from "lucide-react";


export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 🔍 Verificar sesión desde cookie local
    const session = typeof window !== "undefined"
      ? document.cookie.split("; ").find((r) => r.startsWith("session_user="))
      : null;

    if (!session) {
      router.replace("/login");
    } else {
      setLoading(false);
    }
  }, [router]);

  if (loading) {
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
    <div className="min-h-dvh bg-background lg:pl-60">
      <DashboardHeader />
      <main className="mx-auto min-h-[calc(100dvh-8rem)] w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      <DashboardFooter />
    </div>
  );
}
