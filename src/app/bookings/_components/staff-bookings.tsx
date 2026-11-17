"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { PublicBooking, BRAND_THEME } from "@/components/public-booking/public-booking";
import type { Escape } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const ESCAPES: { escape: Escape; path: string }[] = [
  { escape: "Fobia", path: "/iframe/fobia" },
  { escape: "Action Gates", path: "/iframe/action-gates" },
];

/**
 * «Reserva de clientes» dentro del CRM: es la demo exacta del módulo que se
 * incrusta en la web de cada escape (mismo componente que /iframe/…).
 */
export function StaffBookings() {
  const [escape, setEscape] = useState<Escape>("Fobia");

  useEffect(() => {
    try {
      const v = localStorage.getItem("demo-escape");
      if (v === "Fobia" || v === "Action Gates") setEscape(v);
    } catch {}
  }, []);
  const choose = (e: Escape) => {
    setEscape(e);
    try { localStorage.setItem("demo-escape", e); } catch {}
  };
  const current = ESCAPES.find((e) => e.escape === escape)!;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl bg-muted p-1 text-sm">
          {ESCAPES.map(({ escape: e }) => (
            <button
              key={e}
              type="button"
              onClick={() => choose(e)}
              className={cn("flex items-center gap-2 rounded-lg px-4 py-2 font-medium", escape === e ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              <span className="size-2.5 rounded-full" style={{ background: BRAND_THEME[e].primary }} />
              {e}
            </button>
          ))}
        </div>
        <a href={current.path} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          <ExternalLink className="size-4" /> Abrir como lo ve el cliente
        </a>
      </div>

      {/* Mismo módulo que en la web; key para reiniciarlo al cambiar de escape */}
      <div className="overflow-hidden rounded-2xl border bg-background">
        <PublicBooking key={escape} escape={escape} />
      </div>
    </div>
  );
}
