"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Loader2, Plus, X, Search, CalendarDays, UsersRound, Pencil, DoorOpen, SlidersHorizontal } from "lucide-react";

import ReservationModal, {
  ReservationForEdit,
  // ReservationDraft,
  // Room,
} from "@/components/reservations/reservation-modal";

import { Clock, CheckCircle, XCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";



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
  customer?: { id?: string; name?: string; email?: string; phone?: string };
  // description?: string;
  notes?: string;
  internalNotes?: string;
  status?: "pendiente" | "confirmada" | "cancelada";
  coupon?: { code: string; type: "percent" | "amount"; value: number };
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
  roomIds?: string[];
  q?: string;
};

export default function ReservationsTable() {

  const [loading, setLoading] = useState(false);


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
    roomIds: [],
    q: "",
  });
  
  /* ───────── Datos ───────── */
  const [rows, setRows] = useState<Resv[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  async function fetchData(p = 1) {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set("from", filters.from || today);
      qs.set("to", filters.to || defaultTo);
      if (filters.roomIds && filters.roomIds.length > 0)
        qs.set("roomIds", filters.roomIds.join(","));
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
    } finally {
      setLoading(false);
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
      coupon: r.coupon ?? undefined,
      customer: r.customer
        ? {
          id: r.customer.id,
          name: r.customer.name,
          email: r.customer.email,
          phone: r.customer.phone,
        }
        : undefined,
    });
    setPrefill(undefined);
    setModalOpen(true);
  }

  const visibleRows = rows.filter((row) => {
    const query = (filters.q ?? "").trim().toLowerCase();
    return !query || [row.customer?.name, row.customer?.email].some((value) => value?.toLowerCase().includes(query));
  });
  const Status = ({ status }: { status: Resv["status"] }) => {
    if (!status) return <span className="text-muted-foreground">—</span>;
    const config = { pendiente: { label: "Pendiente", icon: Clock, style: "bg-amber-50 text-amber-800" }, confirmada: { label: "Confirmada", icon: CheckCircle, style: "bg-emerald-50 text-emerald-800" }, cancelada: { label: "Cancelada", icon: XCircle, style: "bg-red-50 text-red-800" } }[status];
    const Icon = config.icon;
    return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${config.style}`}><Icon className="size-3.5" />{config.label}</span>;
  };

  /* ───────── Render ───────── */
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            Gestión de reservas
          </h1>
          <p className="text-sm text-muted-foreground">
            Crea, edita o cancela reservas de forma rápida y centralizada
          </p>
        </div>

        <Button
          onClick={() => {
            setMode("create");
            setEditing(null);
            setPrefill(undefined);
            setModalOpen(true);
          }}
          className="shadow-sm hover:shadow-md transition-all"
        >
          <Plus className="mr-2 h-4 w-4" /> Añadir reserva
        </Button>
      </div>


      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="border-b px-5 py-5 sm:px-6">
          <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><CalendarDays className="size-5" /></span><div><CardTitle className="text-base">Reservas</CardTitle><p className="mt-1 text-sm text-muted-foreground">Consulta y gestiona las reservas del periodo seleccionado.</p></div></div>
        </CardHeader>
        <CardContent className="space-y-5 px-5 py-5 sm:px-6">

          {/* Filtros */}
          <div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(145px,1fr)_minmax(145px,1fr)_minmax(180px,1.2fr)_minmax(200px,1.5fr)_auto]">
            {/* Desde */}
            <div className="space-y-2"><Label htmlFor="reservations-from">Desde</Label><Input id="reservations-from"
              type="date"
              value={filters.from}
              onChange={(e) =>
                setFilters((f) => ({ ...f, from: e.target.value }))
              }
            /></div>

            {/* Hasta */}
            <div className="space-y-2"><Label htmlFor="reservations-to">Hasta</Label><Input id="reservations-to"
              type="date"
              value={filters.to ?? ""}
              onChange={(e) =>
                setFilters((f) => ({ ...f, to: e.target.value }))
              }
            /></div>

            {/* Sala */}
            {/* Salas (select con checkboxes dentro) */}
<div className="space-y-2"><Label htmlFor="reservations-rooms">Salas</Label><Select
  // No usamos "value" porque será multiselección manual
  onValueChange={() => {}} // necesario por tipado
>
  <SelectTrigger id="reservations-rooms" className="w-full">
    <SelectValue
      placeholder={
        filters.roomIds && filters.roomIds.length > 0
          ? `${filters.roomIds.length} sala${filters.roomIds.length > 1 ? "s" : ""} seleccionada${filters.roomIds.length > 1 ? "s" : ""}`
          : "Seleccionar salas"
      }
    />
  </SelectTrigger>

  <SelectContent className="max-h-64 overflow-auto p-2">
    <div className="flex flex-col gap-1">
      {rooms.map((r) => {
        const checked = filters.roomIds?.includes(r._id);
        return (
          <label
            key={r._id}
            className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-muted cursor-pointer"
          >
            <Checkbox
              checked={checked}
              onCheckedChange={(value) => {
                setFilters((f) => {
                  const ids = new Set(f.roomIds);
                  if (value) ids.add(r._id);
                  else ids.delete(r._id);
                  return { ...f, roomIds: Array.from(ids) };
                });
              }}
            />
            <span className="text-sm">{r.name}</span>
          </label>
        );
      })}
    </div>

    {filters.roomIds?.length > 0 && (
      <div className="border-t mt-2 pt-2 flex justify-center">
        <Button
          size="sm"
          variant="ghost"
          className="text-red-500 hover:bg-red-50"
          onClick={() => setFilters((f) => ({ ...f, roomIds: [] }))}
        >
          Quitar selección
        </Button>
      </div>
    )}
  </SelectContent>
</Select></div>

            {/* Buscador */}
            <div className="space-y-2"><Label htmlFor="reservations-search">Cliente</Label><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input id="reservations-search"
              placeholder="Buscar nombre o correo"
              value={filters.q ?? ""}
              onChange={(e) =>
                setFilters((f) => ({ ...f, q: e.target.value }))
              }
              className="pl-9"
            /></div></div>

            {/* Botón Reset sutil */}
            {(
              (filters.roomIds?.length ?? 0) > 0 ||
              filters.q ||
              filters.from !== today ||
              filters.to !== defaultTo
            ) && (
                <Button
                  variant="ghost"
                  className="w-fit text-muted-foreground"
                  onClick={() => {
                    setFilters({
                      from: today,
                      to: defaultTo,
                      roomIds: [],
                      q: "",
                    });
                  }}
                >
                  <X className="size-4" /> Limpiar filtros
                </Button>
              )}
          </div>



          <div className="flex items-center justify-between border-t pt-4"><p className="text-sm text-muted-foreground"><SlidersHorizontal className="mr-2 inline size-4" />{loading ? "Cargando reservas…" : `${visibleRows.length} ${visibleRows.length === 1 ? "reserva" : "reservas"} mostradas`}</p><span className="hidden text-xs text-muted-foreground md:inline">Selecciona editar para ver los detalles</span></div>
          {loading ? <div className="flex items-center justify-center gap-2 py-14 text-sm text-muted-foreground" role="status"><Loader2 className="size-5 animate-spin text-primary" /> Cargando reservas…</div> : visibleRows.length === 0 ? <div className="rounded-xl border border-dashed px-6 py-12 text-center"><CalendarDays className="mx-auto size-6 text-muted-foreground" /><p className="mt-3 font-medium">No hay reservas para mostrar</p><p className="mt-1 text-sm text-muted-foreground">Prueba con otro periodo o cambia los filtros.</p></div> : <>
            <div className="space-y-3 md:hidden">{visibleRows.map((r) => { const date = new Date(r.start).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }); const start = new Date(r.start).toISOString().substring(11, 16); const end = new Date(r.end).toISOString().substring(11, 16); return <div key={r._id} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold">{r.roomName || "Sala"}</p><p className="mt-1 text-sm text-muted-foreground">{date} · {start}–{end}</p></div><Status status={r.status} /></div><div className="mt-4 border-t pt-3 text-sm"><p className="font-medium">{r.customer?.name || "Sin cliente"}</p>{r.customer?.email && <p className="mt-1 break-all text-muted-foreground">{r.customer.email}</p>}<p className="mt-2 text-muted-foreground">{r.players} jugadores · {eur(r.price ?? 0)} · {r.language?.toUpperCase()}{r.coupon ? ` · ${r.coupon.code} (${r.coupon.type === "percent" ? `-${r.coupon.value}%` : `-${eur(r.coupon.value)}`})` : ""}</p></div><Button className="mt-4 w-full" size="sm" variant="outline" onClick={() => openEdit(r)}><Pencil className="size-4" /> Editar reserva</Button></div>; })}</div>
            <div className="hidden overflow-hidden rounded-xl border md:block"><Table className="min-w-[1050px]"><TableHeader><TableRow className="hover:bg-transparent"><TableHead>Fecha y hora</TableHead><TableHead>Sala</TableHead><TableHead>Cliente</TableHead><TableHead>Jugadores</TableHead><TableHead>Precio</TableHead><TableHead>Cupón</TableHead><TableHead>Idioma</TableHead><TableHead>Estado</TableHead><TableHead className="sticky right-0 z-10 bg-[#f8f8fc] text-right">Acciones</TableHead></TableRow></TableHeader><TableBody>{visibleRows.map((r) => { const date = new Date(r.start).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }); const start = new Date(r.start).toISOString().substring(11, 16); const end = new Date(r.end).toISOString().substring(11, 16); return <TableRow key={r._id}><TableCell><p className="font-medium">{date}</p><p className="mt-1 text-xs text-muted-foreground">{start}–{end}</p></TableCell><TableCell><span className="flex items-center gap-2 font-medium"><DoorOpen className="size-4 text-muted-foreground" />{r.roomName || "Sala"}</span></TableCell><TableCell><p className="font-medium">{r.customer?.name || "Sin cliente"}</p>{r.customer?.email && <p className="mt-1 text-xs text-muted-foreground">{r.customer.email}</p>}</TableCell><TableCell><span className="flex items-center gap-1.5"><UsersRound className="size-4 text-muted-foreground" />{r.players}</span></TableCell><TableCell className="font-medium tabular-nums">{eur(r.price ?? 0)}</TableCell><TableCell>{r.coupon ? <><p className="font-medium">{r.coupon.code}</p><p className="mt-1 text-xs text-muted-foreground">{r.coupon.type === "percent" ? `-${r.coupon.value}%` : `-${eur(r.coupon.value)}`}</p></> : <span className="text-muted-foreground">—</span>}</TableCell><TableCell className="uppercase text-muted-foreground">{r.language}</TableCell><TableCell><Status status={r.status} /></TableCell><TableCell className="sticky right-0 bg-card text-right"><Button size="sm" variant="outline" onClick={() => openEdit(r)}><Pencil className="size-4" />Editar</Button></TableCell></TableRow>; })}</TableBody></Table></div>
          </>}

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
