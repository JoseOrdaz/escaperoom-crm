import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Reserva online",
  robots: { index: false },
};

/** Módulo de reservas para incrustar en la web de cada escape (sin el menú del CRM) */
export default function IframeLayout({ children }: { children: ReactNode }) {
  return <div lang="es" className="min-h-dvh bg-background">{children}</div>;
}
