import { ReactNode } from "react";
import { DashboardHeader } from "@/components/header";
import { DashboardFooter } from "@/components/footer";
import { CalendarDays } from "lucide-react";
import { Analytics } from "@vercel/analytics/next"


export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <DashboardHeader />
      
      <main className="mx-auto w-full max-w-7xl px-4 py-6">
        <div className="flex flex-col gap-2 border-b pb-4 mb-4">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-primary" />
          Demo de Reservas para Clientes
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Este módulo representa el sistema de reservas que se integrará en la web pública,
          permitiendo a los clientes seleccionar sala, fecha y hora de forma intuitiva.
        </p>
      </div>
        {children}
                <Analytics />

        </main>
      <DashboardFooter />
    </div>
  );
}
