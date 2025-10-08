"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Plus } from "lucide-react";

import ReservationModal, {
  ReservationForEdit,
  // ReservationDraft,
  // Room,
} from "@/components/reservations/reservation-modal";

import { Clock, CheckCircle, XCircle } from "lucide-react";


const ALL = "__all__";

type Resv = {
  _id: string;
  roomId: string;
  roomName: string;
  start: string;
  end: string;
  players: number;
  price: number;
  language: "es" | "en" | "ru";
  customer?: { name?: string; email?: string; phone?: string };
  // description?: string;
  notes?: string;
  internalNotes?: string;
  status?: "pendiente" | "confirmada" | "cancelada";
};

const eur = (n: number) =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);

type Filters = {
  from: string;
  to?: string;
  roomId?: string;
  q?: string;
};

export default function ReservationsTable() {
  
  /* ───────── Salas ───────── */
  type Room = {
    _id: string;
    name: string;
    durationMinutes: number;
    capacityMin: number;
    capacityMax: number;
    priceTable: any; // Replace 'any' with the actual type if known
    schedule: any;   // Replace 'any' with the actual type if known
  };
  const [rooms, setRooms] = useState<Room[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/rooms", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          // Ensure all required properties exist, fill with defaults if missing
          setRooms(
            data.map((r: any) => ({
              _id: r._id,
              name: r.name,
              durationMinutes: r.durationMinutes ?? 60,
              capacityMin: r.capacityMin ?? 2,
              capacityMax: r.capacityMax ?? 6,
              priceTable: r.priceTable ?? {},
              schedule: r.schedule ?? {},
            }))
          );
        }
      } catch {
        toast.error("Error cargando salas");
      }
    })();
  }, []);

  /* ───────── Filtros iniciales ───────── */
  const today = new Date().toISOString().slice(0, 10);
  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  const defaultTo = nextYear.toISOString().slice(0, 10);

  const [filters, setFilters] = useState<Filters>({
    from: today,
    to: defaultTo,
    roomId: ALL,
    q: "",
  });

  /* ───────── Datos ───────── */
  const [rows, setRows] = useState<Resv[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  async function fetchData(p = 1) {
    try {
      const qs = new URLSearchParams();
      qs.set("from", filters.from || today);
      qs.set("to", filters.to || defaultTo);
      if (filters.roomId && filters.roomId !== ALL)
        qs.set("roomId", filters.roomId);
      if (filters.q) qs.set("q", filters.q);
      qs.set("page", String(p));
      qs.set("pageSize", String(pageSize));

      const res = await fetch(`/api/reservations?${qs.toString()}`, {
        cache: "no-store",
      });

      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setRows(Array.isArray(json) ? json : json.items ?? []);
      setTotal(Array.isArray(json) ? json.length : json.total ?? 0);
      setPage(p);
    } catch (e) {
      toast.error("Error cargando reservas", { description: String(e) });
    }
  }

  useEffect(() => {
    fetchData(1);
  }, [filters]);

  /* ───────── Modal ───────── */
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("edit");
  const [editing, setEditing] = useState<ReservationForEdit | null>(null);
  const [prefill, setPrefill] = useState<undefined>(
    undefined
  );

  function openEdit(r: Resv) {
    setMode("edit");
    setEditing({
      _id: r._id,
      roomId: r.roomId,
      start: r.start,
      end: r.end,
      players: r.players,
      language: r.language,
      // description: r.description,
      notes: r.notes,
      internalNotes: r.internalNotes,
      status: r.status ?? "pendiente",
      customer: r.customer
        ? {
          name: r.customer.name,
          email: r.customer.email,
          phone: r.customer.phone,
        }
        : undefined,
    });
    setPrefill(undefined);
    setModalOpen(true);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  /* ───────── Render ───────── */
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Gestión de reservas</h2>
        <Button
          onClick={() => {
            setMode("create");
            setEditing(null);
            setPrefill(undefined);
            setModalOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Añadir reserva
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listado de Reservas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">

          {/* Filtros */}
          <div className="grid gap-2 sm:grid-cols-6 items-center relative">
            {/* Desde */}
            <Input
              type="date"
              value={filters.from}
              onChange={(e) =>
                setFilters((f) => ({ ...f, from: e.target.value }))
              }
            />

            {/* Hasta */}
            <Input
              type="date"
              value={filters.to ?? ""}
              onChange={(e) =>
                setFilters((f) => ({ ...f, to: e.target.value }))
              }
            />

            {/* Sala */}
            <Select
              value={filters.roomId ?? ALL}
              onValueChange={(v) => setFilters((f) => ({ ...f, roomId: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sala" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas las salas</SelectItem>
                {rooms.map((r) => (
                  <SelectItem key={r._id} value={r._id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Buscador */}
            <Input
              placeholder="Buscar cliente o email..."
              value={filters.q ?? ""}
              onChange={(e) =>
                setFilters((f) => ({ ...f, q: e.target.value }))
              }
              className="sm:col-span-2"
            />

            {/* Botón Reset sutil */}
            {(
              filters.roomId !== ALL ||
              filters.q ||
              filters.from !== today ||
              filters.to !== defaultTo
            ) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600 transition-all"
                  onClick={() => {
                    setFilters({
                      from: today,
                      to: defaultTo,
                      roomId: ALL,
                      q: "",
                    });
                  }}
                >
                  ✕ Limpiar filtros
                </Button>
              )}
          </div>


          <Separator />

          {/* Tabla */}
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-2 text-left">Fecha</th>
                  <th className="p-2 text-left">Hora</th>
                  <th className="p-2 text-left">Sala</th>
                  <th className="p-2 text-left">Jugadores</th>
                  <th className="p-2 text-left">Precio</th>
                  <th className="p-2 text-left">Idioma</th>
                  <th className="p-2 text-left">Cliente</th>
                  <th className="p-2 text-left">Estado</th>
                  <th className="p-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const d = new Date(r.start);
                  const dateStr = d.toLocaleDateString("es-ES", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "2-digit",
                  });
                  const s = d.toLocaleTimeString("es-ES", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const e = new Date(r.end).toLocaleTimeString("es-ES", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  // filtro cliente/email
                  if (
                    filters.q &&
                    !(
                      (r.customer?.name ?? "")
                        .toLowerCase()
                        .includes(filters.q.toLowerCase()) ||
                      (r.customer?.email ?? "")
                        .toLowerCase()
                        .includes(filters.q.toLowerCase())
                    )
                  )
                    return null;

                  return (
                    <tr key={r._id} className="border-t">
                      <td className="p-2">{dateStr}</td>
                      <td className="p-2">
                        {s}–{e}
                      </td>
                      <td className="p-2">{r.roomName}</td>
                      <td className="p-2">{r.players}</td>
                      <td className="p-2">{eur(r.price ?? 0)}</td>
                      <td className="p-2 uppercase">{r.language}</td>
                      <td className="p-2">
                        {r.customer?.name ?? ""}{" "}
                        {r.customer?.email ? `· ${r.customer.email}` : ""}
                      </td>
                      <td className="p-2">
                        {r.status === "pendiente" && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 text-xs font-medium">
                            <Clock className="w-3 h-3 text-yellow-600" /> Pendiente
                          </span>
                        )}
                        {r.status === "confirmada" && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs font-medium">
                            <CheckCircle className="w-3 h-3 text-green-600" /> Confirmada
                          </span>
                        )}
                        {r.status === "cancelada" && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-red-800 text-xs font-medium">
                            <XCircle className="w-3 h-3 text-red-600" /> Cancelada
                          </span>
                        )}
                      </td>

                      <td className="p-2 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEdit(r)}
                        >
                          Editar
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="text-center py-4 text-muted-foreground"
                    >
                      No hay reservas en este rango.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal */}
      <ReservationModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        mode={mode}
        reservation={editing}
        rooms={rooms}
        onSaved={async () => {
          await fetchData(page);
        }}
      />
    </div>
  );
}
