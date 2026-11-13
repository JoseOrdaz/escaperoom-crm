// src/app/dashboard/reservations/page.tsx
import { Suspense } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ReservationsCalendar } from "./_components/reservations-calendar";


export const dynamic = "force-dynamic";

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 1); }

export default async function ReservationsPage() {
  const now = new Date();
  const from = startOfMonth(now).toISOString().slice(0, 10);
  const to = endOfMonth(now).toISOString().slice(0, 10);


  return (

    <>
    <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
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
        <CardContent className="p-4 sm:p-6">
          <Suspense fallback={<div className="text-sm text-muted-foreground">Cargando calendario…</div>}>
            <ReservationsCalendar
              initialFromISO={from}
              initialToISO={to}
              initialReservations={[]}
            />
          </Suspense>
        </CardContent>
      </Card>
    </div>
    </>
  );
}
