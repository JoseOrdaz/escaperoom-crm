"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Form, FormField, FormItem, FormLabel, FormMessage, FormControl, FormDescription,
} from "@/components/ui/form";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

/* ============ Tipos ============ */
type TimeSlot = { start: string; end: string };
type WeekTemplate = {
  monday: TimeSlot[]; tuesday: TimeSlot[]; wednesday: TimeSlot[];
  thursday: TimeSlot[]; friday: TimeSlot[]; saturday: TimeSlot[]; sunday: TimeSlot[];
};
type Room = {
  _id: string; name: string; durationMinutes: number;
  capacityMin: number; capacityMax: number;
  priceTable: { players: number; price: number }[];
  schedule: { template: WeekTemplate; daysOff: { date: string }[]; overrides: { date: string; slots: TimeSlot[] }[] };
};
type Customer = { _id: string; name: string; email: string; phone?: string };

export type ReservationForEdit = {
  _id: string;
  roomId: string;
  start: string;
  end: string;
  players: number;
  language: "es" | "en" | "ru";
  description?: string;
  notes?: string;
  customer?: { id?: string; name?: string; email?: string; phone?: string };
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  title?: string;
  reservation?: ReservationForEdit | null;
  onSaved?: (updatedId: string) => void | Promise<void>;
  rooms?: Room[];
};

/* ================= Helpers ================= */
const HHMM = /^\d{2}:\d{2}$/;
const pad = (n: number) => String(n).padStart(2, "0");
const hhmmFromISO = (iso: string) => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const ymdFromISO = (iso: string) => new Date(iso).toISOString().slice(0, 10);
const dayKeys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

function normSlots(a?: TimeSlot[] | null) {
  return (Array.isArray(a) ? a : []).filter(s => HHMM.test(s.start) && HHMM.test(s.end) && s.start < s.end);
}
function getDayKeyFromDate(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  return dayKeys[d.getDay()];
}
function getSlotsForDate(room: Room, dateStr: string): TimeSlot[] {
  const schedule = room.schedule ?? {};
  if (schedule.daysOff?.some(d => d?.date === dateStr)) return [];
  const ov = schedule.overrides?.find(o => o?.date === dateStr);
  if (ov) return normSlots(ov.slots);
  const key = getDayKeyFromDate(dateStr) as keyof WeekTemplate;
  return normSlots(schedule?.template?.[key]);
}
function priceForPlayers(room: Room, players: number) {
  const row = room.priceTable?.find((p) => Number(p.players) === Number(players));
  return row ? Number(row.price) : 0;
}
const eur = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

/* ================= Schema ================= */
const schema = z.object({
  id: z.string().optional(),
  roomId: z.string().min(1, "Selecciona sala"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  slot: z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}(#\d+)?$/, "Franja inválida"),
  players: z.coerce.number().int().min(1, "Selecciona jugadores"),
  language: z.enum(["es", "en", "ru"]).default("es"),
  description: z.string().max(140).optional(),
  notes: z.string().max(1000).optional(),
  customerSelectId: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.customerSelectId === "__new__") {
    if (!data.firstName?.trim()) {
      ctx.addIssue({ path: ["firstName"], code: "custom", message: "Nombre obligatorio" });
    }
    if (!data.lastName?.trim()) {
      ctx.addIssue({ path: ["lastName"], code: "custom", message: "Apellidos obligatorios" });
    }
    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      ctx.addIssue({ path: ["email"], code: "custom", message: "Email válido obligatorio" });
    }
  }
});
type FormValues = z.infer<typeof schema>;

/* ================= Componente ================= */
export default function ReservationModal({
  open, onOpenChange, mode, reservation, onSaved, rooms: roomsProp,
}: Props) {
  /* Rooms */
  const [roomsLocal, setRoomsLocal] = useState<Room[]>([]);
  useEffect(() => {
    if (roomsProp?.length) return;
    (async () => {
      try {
        const res = await fetch("/api/rooms", { cache: "no-store" });
        if (!res.ok) throw new Error(await res.text());
        setRoomsLocal(await res.json());
      } catch (e: any) {
        toast.error("No se pudieron cargar salas", { description: String(e) });
      }
    })();
  }, [roomsProp]);
  const rooms = useMemo(() => roomsProp?.length ? roomsProp : roomsLocal, [roomsProp, roomsLocal]);

  /* Customers */
  const [customers, setCustomers] = useState<Customer[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/customers", { cache: "no-store" });
        const json = await res.json();
        let items: Customer[] = json.items ?? [];

        if (
          reservation?.customer &&
          !items.find((c) =>
            c._id === reservation.customer?.id ||
            c.email === reservation.customer?.email
          )
        ) {
          items = [
            ...items,
            {
              _id: reservation.customer.id ?? reservation.customer.email,
              name: reservation.customer.name ?? "",
              email: reservation.customer.email ?? "",
              phone: reservation.customer.phone ?? "",
            },
          ];
        }

        setCustomers(items);
      } catch {
        setCustomers([]);
      }
    })();
  }, [reservation]);

  /* Reservas del día */
  const [dayReservations, setDayReservations] = useState<ReservationForEdit[]>([]);
  const [occupiedSlots, setOccupiedSlots] = useState<Set<string>>(new Set());

  /* Form */
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      id: "", roomId: "", date: new Date().toISOString().slice(0, 10),
      slot: "", players: 1, language: "es", description: "", notes: "",
      customerSelectId: "", firstName: "", lastName: "", email: "", phone: "",
    },
    mode: "onBlur",
  });

  const watchRoomId = form.watch("roomId");
  const watchDate = form.watch("date");
  const watchPlayers = form.watch("players");
  const watchCustomer = form.watch("customerSelectId");
  const selectedRoom = useMemo(() => rooms.find(r => r._id === watchRoomId), [rooms, watchRoomId]);

  /* Cargar reservas cuando cambia sala o fecha */
  useEffect(() => {
    if (!watchDate || !watchRoomId) return;

    const from = watchDate; // YYYY-MM-DD
    const to = watchDate;   // YYYY-MM-DD

    console.log("📡 Fetching reservas:", { roomId: watchRoomId, from, to });

    (async () => {
      try {
        const res = await fetch(
          `/api/reservations?roomId=${watchRoomId}&from=${from}&to=${to}`,
          { cache: "no-store" }
        );
        const json = await res.json();
        // Mostramos en consola todas las reservas del día para esta sala
        console.log("📅 Reservas existentes para", watchDate, "en sala", watchRoomId, ":", json.reservas ?? json);

        // Mostramos también las franjas ocupadas calculadas
        console.log("⛔ Franjas ocupadas:", json.franjasOcupadas ?? []);

        setDayReservations(json.reservas ?? json ?? []);
        setOccupiedSlots(new Set(json.franjasOcupadas ?? []));
      } catch (e) {
        console.error("Error cargando reservas del día", e);
        setDayReservations([]);
        setOccupiedSlots(new Set());
      }
    })();
  }, [watchDate, watchRoomId]);

  const playerOptions = useMemo(() => {
    return (selectedRoom?.priceTable ?? [])
      .slice().sort((a, b) => a.players - b.players)
      .map(r => ({ players: r.players, label: `${r.players} (${eur(r.price)})` }));
  }, [selectedRoom]);

  /* Slots con flag reserved */
  const [slotOptions, setSlotOptions] = useState<Array<TimeSlot & { _id: string; reserved?: boolean }>>([]);

  useEffect(() => {
    if (!selectedRoom || !watchDate) { setSlotOptions([]); form.setValue("slot", ""); return; }
    const raw = getSlotsForDate(selectedRoom, watchDate);

    const reservedSlots = occupiedSlots;

    const withIds = raw.map((s, i) => {
      const id = `${s.start}-${s.end}#${i}`;
      const isReserved = reservedSlots.has(`${s.start}-${s.end}`);
      return { ...s, _id: id, reserved: isReserved };
    });

    console.log("💡 Slots del día:", withIds);

    setSlotOptions(withIds);

    const current = form.getValues("slot");
    const exists = withIds.some(s => s._id === current && !s.reserved);
    form.setValue("slot", exists ? current : "");
  }, [selectedRoom, watchDate, occupiedSlots]);

  const computedPrice = useMemo(() => selectedRoom ? priceForPlayers(selectedRoom, Number(watchPlayers) || 0) : 0, [selectedRoom, watchPlayers]);

  /* Reset modal */
  useEffect(() => {
    if (!open) {
      form.reset({
        id: "", roomId: "", date: new Date().toISOString().slice(0, 10),
        slot: "", players: 1, language: "es", description: "", notes: "",
        customerSelectId: "", firstName: "", lastName: "", email: "", phone: "",
      });
    }
  }, [open]);

  /* Prefill edición */
  useEffect(() => {
    if (!reservation || !open || mode !== "edit") return;

    const date = ymdFromISO(reservation.start);
    const start = hhmmFromISO(reservation.start);
    const end = hhmmFromISO(reservation.end);
    const r = rooms.find(rr => rr._id === reservation.roomId);

    let slotId = "";
    if (r) {
      const raw = getSlotsForDate(r, date);
      const withIds = raw.map((s, i) => ({ ...s, _id: `${s.start}-${s.end}#${i}` }));
      setSlotOptions(withIds);
      slotId = (withIds.find(s => s.start === start && s.end === end)?._id) ?? "";
    }

    const customerKey = reservation.customer?.id || reservation.customer?.email;

    form.reset({
      id: reservation._id,
      roomId: reservation.roomId,
      date,
      slot: slotId,
      players: reservation.players,
      language: reservation.language,
      description: reservation.description ?? "",
      notes: reservation.notes ?? "",
      customerSelectId: customerKey,
      firstName: "",
      lastName: "",
      email: reservation.customer?.email ?? "",
      phone: reservation.customer?.phone ?? "",
    });
  }, [reservation, rooms, open, mode]);

  /* Helpers */
  function buildBody(values: FormValues, isEdit: boolean) {
    const [startRaw, endPart] = String(values.slot).split("-");
    const start = (startRaw ?? "").trim();
    const end = (endPart ?? "").split("#")[0].trim();

    const body: any = {
      roomId: values.roomId,
      date: values.date,
      start,
      end,
      players: values.players,
      language: values.language,
      description: values.description ?? "",
      notes: values.notes ?? "",
    };

    if (values.customerSelectId === "__new__") {
      body.customerName = `${values.firstName} ${values.lastName}`.trim();
      body.customerEmail = values.email;
      body.customerPhone = values.phone;
    } else if (values.customerSelectId) {
      const selected = customers.find(c => c.email === values.customerSelectId);
      if (selected) body.customerId = selected._id;
    }

    if (isEdit) body.updatedAt = new Date().toISOString();
    return body;
  }

  async function submit(values: FormValues) {
    const t = toast.loading(mode === "edit" ? "Guardando cambios…" : "Creando reserva…");
    try {
      const body = buildBody(values, mode === "edit");

      // 👇 DEBUG: mostramos la info de la reserva que se va a crear/editar
      console.log("📝 Reserva a enviar:", {
        roomId: body.roomId,
        date: body.date,
        start: body.start,
        end: body.end,
        players: body.players,
        language: body.language,
        description: body.description,
        notes: body.notes,
        customerId: body.customerId,
        customerName: body.customerName,
        customerEmail: body.customerEmail,
        customerPhone: body.customerPhone,
      });

      const url = mode === "edit"
        ? `/api/reservations/${values.id}`
        : "/api/reservations";
      const method = mode === "edit" ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Error");

      // 👇 DEBUG: mostramos la respuesta de la API
      console.log("✅ Reserva guardada en BD:", json);

      toast.success(mode === "edit" ? "Reserva actualizada" : "Reserva creada", { id: t });
      onOpenChange(false);
      if (onSaved) await onSaved(json._id ?? values.id ?? "");
    } catch (e: any) {
      toast.error("Error", { id: t, description: e?.message });
    }
  }


  const dialogTitle = mode === "edit" ? "Editar reserva" : "Crear nueva reserva";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>

        {/* Contenedor scrollable */}
        <div className="flex-1 overflow-y-scroll pr-2 relative scrollbar-always">
          <Form {...form}>
            <form
              id="reservation-form"
              onSubmit={form.handleSubmit(submit)}
              className="space-y-6 pb-6"
            >
              {/* Sala */}
              <FormField control={form.control} name="roomId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Sala *</FormLabel>
                  <FormDescription>Selecciona la sala donde se realizará la actividad</FormDescription>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecciona sala" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {rooms.map(r => (
                        <SelectItem key={r._id} value={r._id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Jugadores */}
              <FormField control={form.control} name="players" render={({ field }) => (
                <FormItem>
                  <FormLabel>Jugadores *</FormLabel>
                  <FormDescription>Elige el número de jugadores</FormDescription>
                  <Select
                    value={String(field.value)}
                    onValueChange={(v) => field.onChange(Number(v))}
                    disabled={!selectedRoom}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecciona jugadores" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {playerOptions.map(p => (
                        <SelectItem key={p.players} value={String(p.players)}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedRoom && (
                    <p className="text-xs text-muted-foreground">
                      Precio: {eur(computedPrice)} · Capacidad {selectedRoom.capacityMin}–{selectedRoom.capacityMax}
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )} />

              {/* Fecha */}
              <FormField control={form.control} name="date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha *</FormLabel>
                  <FormDescription>Selecciona el día de la reserva</FormDescription>
                  <Input type="date" className="w-full" {...field} />
                  <FormMessage />
                </FormItem>
              )} />

              {/* Hora */}
              <FormField control={form.control} name="slot" render={({ field }) => (
                <FormItem>
                  <FormLabel>Hora *</FormLabel>
                  <FormDescription>Elige una franja horaria disponible</FormDescription>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecciona franja" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {slotOptions.map(s => (
                        <SelectItem
                          key={s._id}
                          value={s._id}
                          disabled={s.reserved}
                          className={s.reserved ? "!text-red-500 !opacity-100 font-semibold" : ""}
                        >
                          {s.start}–{s.end} {s.reserved && " (ocupado)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Idioma */}
              <FormField control={form.control} name="language" render={({ field }) => (
                <FormItem>
                  <FormLabel>Idioma *</FormLabel>
                  <FormDescription>Selecciona el idioma de la sesión</FormDescription>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="en">Inglés</SelectItem>
                      <SelectItem value="ru">Ruso</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Cliente */}
              <FormField control={form.control} name="customerSelectId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Cliente</FormLabel>
                  <FormDescription>Selecciona un cliente existente o crea uno nuevo</FormDescription>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecciona cliente" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.email} value={String(c.email)}>
                          {`${c.name} — ${c.email}`}
                        </SelectItem>
                      ))}
                      <SelectItem value="__new__">➕ Crear nuevo cliente</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Formulario nuevo cliente */}
              {watchCustomer === "__new__" && (
                <>
                  <FormField control={form.control} name="firstName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre *</FormLabel>
                      <FormControl><Input placeholder="Nombre" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="lastName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Apellidos *</FormLabel>
                      <FormControl><Input placeholder="Apellidos" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email *</FormLabel>
                      <FormControl><Input type="email" placeholder="tucorreo@ejemplo.com" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono *</FormLabel>
                      <FormControl><Input type="tel" placeholder="+34..." {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </>
              )}

              {/* Descripción */}
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <Input placeholder="Breve descripción de la reserva" {...field} />
                  <FormMessage />
                </FormItem>
              )} />

              {/* Notas */}
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas</FormLabel>
                  <Textarea rows={3} placeholder="Notas internas de la reserva" {...field} />
                  <FormMessage />
                </FormItem>
              )} />
            </form>
          </Form>
        </div>

        {/* Footer fijo al final */}
        <DialogFooter className="border-t bg-background p-4 flex justify-between">
          {mode === "edit" && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={async () => {
                if (!reservation?._id) return;
                const confirmed = window.confirm("¿Seguro que deseas eliminar esta reserva?");
                if (!confirmed) return;

                const t = toast.loading("Eliminando reserva...");
                try {
                  const res = await fetch(`/api/reservations/${reservation._id}`, {
                    method: "DELETE",
                  });
                  const json = await res.json();
                  if (!res.ok) throw new Error(json?.error || "Error al eliminar");

                  toast.success("Reserva eliminada correctamente", { id: t });
                  onOpenChange(false);
                  if (onSaved) await onSaved(reservation._id);
                } catch (e: any) {
                  toast.error("Error eliminando reserva", { id: t, description: e?.message });
                }
              }}
            >
              Eliminar
            </Button>
          )}

          <Button type="submit" form="reservation-form" className="w-full sm:w-auto">
            {mode === "edit" ? "Guardar cambios" : "Crear reserva"}
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}
