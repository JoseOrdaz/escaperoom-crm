"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";

import {
  Plus,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  CalendarRange,
} from "lucide-react";

import ReservationModal, {
  Room,
  Customer,
  ReservationForEdit,
  ReservationDraft,
} from "@/components/reservations/reservation-modal";

/* ───────── Types de /api/reservations ───────── */
type Resv = {
  _id?: string;
  roomId: string;
  roomName?: string;
  start: string;
  end: string;
  players: number;
  price: number;
  customer: { name: string; email: string; phone?: string };
  language: "es" | "en" | "ru";
  notes?: string;
  internalNotes?: string;
  description?: string;
  status?: "pendiente" | "confirmada" | "cancelada";


  
};

/* ───────── Helpers ───────── */
const dateKey = (d: Date) => d.toLocaleDateString("sv-SE");
const sortByStart = (a: Resv, b: Resv) =>
  new Date(a.start).getTime() - new Date(b.start).getTime();
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

const addMonths = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth() + n, 1);

const addWeeks = (d: Date, n: number) => {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n * 7);
  return copy;
};

const formatDateLabel = (d: Date) =>
  d.toLocaleDateString("es-ES", { month: "long", year: "numeric" });

function getMonthMatrix(cursor: Date) {
  const first = startOfMonth(cursor);
  const start = new Date(first);
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  const weeks: Date[][] = [];
  let cur = new Date(start);
  for (let w = 0; w < 6; w++) {
    const row: Date[] = [];
    for (let i = 0; i < 7; i++) {
      row.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(row);
  }
  return weeks;
}

// ✅ Helper para mostrar la hora literal sin aplicar zona horaria
function formatTimeLiteral(isoString: string) {
  // Evita crear Date, usamos el texto original
  if (!isoString.includes("T")) return isoString;
  const time = isoString.split("T")[1]?.slice(0, 5); // "HH:MM"
  return time || "";
}


/* ───────── Componente ───────── */
export function ReservationsCalendar({
  initialFromISO,
  initialToISO,
  initialReservations,
}: {
  initialFromISO: string;
  initialToISO: string;
  initialReservations: Resv[];
}) {
  const [view, setView] = useState<"month" | "week">("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [events, setEvents] = useState<Resv[]>(initialReservations);
  const [loading, setLoading] = useState(false);


  /* Salas */
  const [rooms, setRooms] = useState<Room[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/rooms", { cache: "no-store" });
        if (!res.ok) throw new Error(await res.text());
        setRooms(await res.json());
      } catch (e) {
        toast.error("No se pudieron cargar salas", {
          description: String(e),
        });
      }
    })();
  }, []);

  /* Clientes */
  const [customers, setCustomers] = useState<Customer[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/customers", { cache: "no-store" });
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        setCustomers(json.items ?? []);
      } catch {
        setCustomers([]);
      }
    })();
  }, []);

  /* Carga reservas */
  async function loadRange(from: Date, to: Date) {
    setLoading(true);
    try {
    const p = new URLSearchParams({
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    });
    const res = await fetch(`/api/reservations?${p}`, { cache: "no-store" });
    if (!res.ok) throw new Error(await res.text());
    setEvents(await res.json());
    } finally {
    setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        if (view === "month") {
          await loadRange(startOfMonth(cursor), endOfMonth(cursor));
        } else {
          const monday = new Date(cursor);
          monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
          const nextMon = new Date(monday);
          nextMon.setDate(monday.getDate() + 7);
          await loadRange(monday, nextMon);
        }
      } catch (e) {
        toast.error("No se pudieron cargar reservas", {
          description: String(e),
        });
      }
    })();
  }, [cursor, view]);

  /* Modal */
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<ReservationForEdit | null>(null);
  const [prefill, setPrefill] = useState<ReservationDraft | undefined>();

  function openCreate() {
    setMode("create");
    const today = new Date().toISOString().slice(0, 10);
    setPrefill({
      roomId: rooms[0]?._id,
      date: today,
      players: rooms[0]?.capacityMin ?? 1,
      language: "es",
      description: "",
      notes: "",
    });
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(ev: Resv) {
  setMode("edit");
  setEditing({
    _id: ev._id!,
    roomId: ev.roomId,
    start: ev.start,
    end: ev.end,
    players: ev.players,
    language: ev.language,
    notes: ev.notes ?? "",
    internalNotes: ev.internalNotes ?? "",
    status: ev.status ?? "pendiente",
    customer: ev.customer
      ? {
          id: ev.customer.email,   // 👈 clave para que lo encuentre
          name: ev.customer.name,
          email: ev.customer.email,
          phone: ev.customer.phone,
        }
      : undefined,
  });
  setPrefill(undefined);
  setModalOpen(true);
}


  /* Header */
  function header() {
    return (
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCursor(new Date())}
            title="Hoy"
          >
            <CalendarDays className="h-4 w-4" />
          </Button>

          {view === "month" ? (
            <>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCursor(addMonths(cursor, -1))}
                title="Anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCursor(addMonths(cursor, 1))}
                title="Siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <div className="ml-2 text-lg font-medium">
                {formatDateLabel(cursor)}
              </div>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCursor(addWeeks(cursor, -1))}
                title="Semana anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCursor(addWeeks(cursor, 1))}
                title="Semana siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={view === "month" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("month")}
          >
            <CalendarRange className="mr-2 h-4 w-4" /> Mes
          </Button>
          <Button
            variant={view === "week" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("week")}
          >
            Semana
          </Button>
          {view !== "list" && (
            <Button
              className="ml-2"
              disabled={rooms.length === 0}
              onClick={openCreate}
            >
              <Plus className="mr-2 h-4 w-4" /> Añadir
            </Button>
          )}
        </div>
      </div>
    );
  }

  /* Vistas */
  const weeks = useMemo(() => getMonthMatrix(cursor), [cursor]);
  const eventsByDay = useMemo(() => {
    const map = new Map<string, Resv[]>();
    for (const ev of events) {
      const k = dateKey(new Date(ev.start));
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(ev);
    }
    for (const [, arr] of map) arr.sort(sortByStart);
    return map;
  }, [events]);

  function MonthView() {
    return (
      <div className="grid grid-cols-7 gap-2">
        {weeks.flat().map((d, i) => {
          const key = dateKey(d);
          const dayEvents = eventsByDay.get(key) ?? [];
          return (
            <Card key={i} className="min-h-[110px]">
              <CardContent className="p-2">
                <div className="mb-1 flex items-center justify-between">
                  <div className="text-xs">{d.getDate()}</div>
                  {dayEvents.length > 0 && (
                    <div className="rounded bg-muted px-1 text-[10px]">
                      {dayEvents.length}
                    </div>
                  )}
                </div>
                {dayEvents.slice(0, 3).map((ev) => (
                  <div
                    key={ev._id}
                    className="truncate text-xs cursor-pointer hover:underline"
                    onClick={() => openEdit(ev)}
                  >
                    {formatTimeLiteral(ev.start)} · {ev.roomName}

                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  function WeekView() {
    const monday = new Date(cursor);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {days.map((d) => {
          const key = dateKey(d);
          const dayEvents = (eventsByDay.get(key) ?? []).slice().sort(sortByStart);
          return (
            <Card key={key}>
              <CardContent className="p-3 space-y-2">
                <div className="text-sm font-semibold border-b pb-1">
                  {d.toLocaleDateString("es-ES", {
                    weekday: "long",
                    day: "2-digit",
                    month: "short",
                  })}
                </div>
                {dayEvents.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    Sin reservas
                  </div>
                ) : (
                  dayEvents.map((ev) => {
                    const s = formatTimeLiteral(ev.start);
                    const e = formatTimeLiteral(ev.end);
                    return (
                      <div
                        key={ev._id}
                        className="rounded-md border p-2 bg-accent/10 hover:bg-accent/20 cursor-pointer transition"
                        onClick={() => openEdit(ev)}
                      >
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>
                            {s}–{e}
                          </span>
                          <span>{ev.language.toUpperCase()}</span>
                        </div>
                        <div className="text-sm font-medium">
                            {ev.roomName || "Sala"} · {ev.players} jugadores
                          </div>
                          <div className="flex items-center gap-1 text-xs mt-1">
                              {ev.status === "pendiente" && (
                                <>
                                  <Clock className="w-3 h-3 text-yellow-600" />
                                  <span className="text-yellow-700">Pendiente</span>
                                </>
                              )}
                              {ev.status === "confirmada" && (
                                <>
                                  <CheckCircle className="w-3 h-3 text-green-600" />
                                  <span className="text-green-700">Confirmada</span>
                                </>
                              )}
                              {ev.status === "cancelada" && (
                                <>
                                  <XCircle className="w-3 h-3 text-red-600" />
                                  <span className="text-red-700">Cancelada</span>
                                </>
                              )}
                          </div>

                        {ev.customer && (
                          <div className="text-xs mt-1">
                            👤 {ev.customer.name} · {ev.customer.email}
                            {ev.customer.phone && ` · ${ev.customer.phone}`}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {header()}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : view === "month" ? (
        <MonthView />
      ) : (
        <WeekView />
      )}

      <ReservationModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        mode={mode}
        reservation={editing}
        prefill={prefill}
        rooms={rooms}
        enableCustomerSelect
        onSaved={async () => {
          if (view === "month") {
            await loadRange(startOfMonth(cursor), endOfMonth(cursor));
          } else {
            const monday = new Date(cursor);
            monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
            const nextMon = new Date(monday);
            nextMon.setDate(monday.getDate() + 7);
            await loadRange(monday, nextMon);
          }
        }}
      />
    </div>
  );
}
