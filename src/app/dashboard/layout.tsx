"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/header";
import { DashboardFooter } from "@/components/footer";

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
      <div className="min-h-dvh flex items-center justify-center text-muted-foreground">
        Cargando panel...
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <DashboardHeader />
      <main className="mx-auto w-full max-w-7xl px-4 py-6">{children}</main>
      <DashboardFooter />
    </div>
  );
}
