"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/header";
import { DashboardFooter } from "@/components/footer";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";


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
    <div className="min-h-dvh flex flex-col items-center justify-center bg-gradient-to-br from-background via-muted/40 to-background">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center"
      >
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4 drop-shadow-[0_0_8px_rgba(0,0,0,0.1)]" />
        <p className="text-lg font-semibold text-muted-foreground">
          Cargando panel...
        </p>
        <p className="mt-2 text-sm text-muted-foreground/70">
          Preparando tu panel CRM ⚙️
        </p>
      </motion.div>
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
