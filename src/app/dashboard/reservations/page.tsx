// src/app/dashboard/reservations/page.tsx
import { headers } from "next/headers";
import { Suspense } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReservationsCalendar } from "./_components/reservations-calendar";


export const dynamic = "force-dynamic";

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 1); }

async function getInitialReservations(fromISO: string, toISO: string) {
  try {
    const h = headers();
    const proto = h.get("x-forwarded-proto") ?? "http";
    const host = h.get("host") ?? "localhost:3000";
    const origin = `${proto}://${host}`;
    const p = new URLSearchParams({ from: fromISO, to: toISO });
    const res = await fetch(`${origin}/api/reservations?${p.toString()}`, { cache: "no-store" });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export default async function ReservationsPage() {
  const now = new Date();
  const from = startOfMonth(now).toISOString().slice(0, 10);
  const to = endOfMonth(now).toISOString().slice(0, 10);
  const initialReservations = await getInitialReservations(from, to);

  return (

    <>
    <div className="flex items-center justify-between mb-6">
  <div>
    <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
      Calendario de reservas
    </h1>
    <p className="text-sm text-muted-foreground">
      Consulta y gestiona todas las reservas programadas por sala y horario
    </p>
  </div>
    </div>

    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Calendario de reservas</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="text-sm text-muted-foreground">Cargando calendario…</div>}>
            <ReservationsCalendar
              initialFromISO={from}
              initialToISO={to}
              initialReservations={initialReservations}
            />
          </Suspense>
        </CardContent>
      </Card>
    </div>
    </>
  );
}
