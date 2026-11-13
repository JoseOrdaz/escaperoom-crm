import { ReactNode } from "react";
import { DashboardHeader } from "@/components/header";
import { DashboardFooter } from "@/components/footer";
import { CalendarDays } from "lucide-react";
import { Analytics } from "@vercel/analytics/next"


export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background lg:pl-60">
      <DashboardHeader />
      
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-2 border-b pb-4 mb-4">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-primary" />
          Reservas para clientes
        </h1>
        <p className="text-sm text-muted-foreground">Este formulario puede crear reservas reales.</p>
      </div>
        {children}
                <Analytics />

        </main>
      <DashboardFooter />
    </div>
  );
}
