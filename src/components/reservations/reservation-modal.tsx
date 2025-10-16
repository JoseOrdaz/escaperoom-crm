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
  Form, FormField, FormItem, FormLabel, FormControl, FormDescription,
} from "@/components/ui/form";
import { Calendar } from "@/components/ui/calendar";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";


/* ============ Tipos ============ */
type TimeSlot = { start: string; end: string };
type WeekTemplate = {
  monday: TimeSlot[]; tuesday: TimeSlot[]; wednesday: TimeSlot[];
  thursday: TimeSlot[]; friday: TimeSlot[]; saturday: TimeSlot[]; sunday: TimeSlot[];
};
type Room = {
  _id: string;
  name: string;
  durationMinutes: number;
  capacityMin: number;
  capacityMax: number;
  priceTable: { players: number; price: number }[];
  schedule: {
    template: WeekTemplate;
    daysOff: { date: string }[];
    overrides: { date: string; slots: TimeSlot[] }[];
  };
};
type Customer = { _id: string; name: string; email: string; phone?: string };

export type ReservationForEdit = {
  _id: string;
  roomId: string;
  start: string;
  end: string;
  players: number;
  language: "es" | "en" | "ru";
  // description?: string;
  notes?: string;
  internalNotes?: string;
  status?: "pendiente" | "confirmada" | "cancelada";
  customer?: { id?: string; name?: string; email?: string; phone?: string };
};




/* ================= Helpers ================= */
const HHMM = /^\d{2}:\d{2}$/;
const pad = (n: number) => String(n).padStart(2, "0");
const hhmmFromISO = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};
const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string) => {
  const toMin = (s: string) => {
    const [h, m] = s.split(":").map(Number);
    return h * 60 + m;
  };
  const as = toMin(aStart), ae = toMin(aEnd), bs = toMin(bStart), be = toMin(bEnd);
  return as < be && ae > bs;
};

function normSlots(a?: TimeSlot[] | null) {
  return (Array.isArray(a) ? a : []).filter(
    (s) => HHMM.test(s.start) && HHMM.test(s.end) && s.start < s.end
  );
}
function getDayKeyFromDate(date: Date) {
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
  return days[date.getDay()];
}
function getSlotsForDate(room: Room, date: Date): TimeSlot[] {
  const ymd = date.toLocaleDateString("sv-SE");
  const schedule = room.schedule ?? {};
  if (schedule.daysOff?.some((d) => d?.date === ymd)) return [];
  const ov = schedule.overrides?.find((o) => o?.date === ymd);
  if (ov) return normSlots(ov.slots);
  const key = getDayKeyFromDate(date) as keyof WeekTemplate;
  return normSlots(schedule?.template?.[key]);
}
function priceForPlayers(room: Room, players: number) {
  const row = room.priceTable?.find((p) => Number(p.players) === Number(players));
  return row ? Number(row.price) : 0;
}
const eur = (n: number) =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);

/* ================= Schema ================= */
const schema = z.object({
  roomId: z.string().min(1, "Selecciona sala"),
  players: z
    .union([
      z.coerce.number().int().min(1, "Selecciona jugadores"),
      z.undefined(),
    ])
    .refine((v) => v !== undefined && v > 0, "Selecciona número de jugadores"),

  language: z.enum(["es", "en", "ru"]).default("es"),
  customerSelectId: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  // description: z.string().max(140).optional(),
  notes: z.string().max(1000).optional(),
  internalNotes: z.string().max(1000).optional(),
  status: z.enum(["pendiente", "confirmada", "cancelada"]).default("pendiente"),

});
type FormValues = z.infer<typeof schema>;

/* ================= COMPONENT ================= */
export default function ReservationModal({
  open,
  onOpenChange,
  mode,
  reservation,
  onSaved,
  rooms: roomsProp,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "create" | "edit";
  reservation?: ReservationForEdit | null;
  onSaved?: (id: string) => void;
  rooms?: Room[];
}) {
  const [roomsLocal, setRoomsLocal] = useState<Room[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [reservations, setReservations] = useState<ReservationForEdit[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [slotOptions, setSlotOptions] = useState<Array<TimeSlot & { reserved?: boolean }>>([]);
  const [sendEmail, setSendEmail] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);






  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { roomId: "", players: undefined, language: "es" },
  });


  const watchRoomId = form.watch("roomId");
  const watchPlayers = form.watch("players");
  const watchCustomer = form.watch("customerSelectId");

  const selectedRoom = useMemo(
    () => (roomsProp ?? roomsLocal).find((r) => r._id === watchRoomId),
    [roomsProp, roomsLocal, watchRoomId]
  );

  /* Cargar salas */
  useEffect(() => {
    if (roomsProp?.length) return;
    fetch("/api/rooms")
      .then((r) => r.json())
      .then(setRoomsLocal)
      .catch(() => toast.error("No se pudieron cargar salas"));
  }, [roomsProp]);

  /* Cargar clientes */
  useEffect(() => {
    fetch("/api/customers")
      .then((r) => r.json())
      .then((j) => setCustomers(j.items ?? []))
      .catch(() => setCustomers([]));
  }, []);

  /* Cargar reservas */
  useEffect(() => {
    if (!watchRoomId) return;
    const today = new Date().toISOString().slice(0, 10);
    const toDate = new Date();
    toDate.setDate(toDate.getDate() + 30);
    const to = toDate.toISOString().slice(0, 10);
    fetch(`/api/reservations?roomId=${watchRoomId}&from=${today}&to=${to}&forCalendar=1`)
      .then((r) => r.json())
      .then((json) => setReservations(json.reservas ?? json ?? []))
      .catch(() => setReservations([]));
  }, [watchRoomId]);

  useEffect(() => {
  if (!open) {
    form.reset({ roomId: "", players: undefined, language: "es" });
    setSelectedDate(null);
    setSelectedSlot(null);
    return;
  }

  if (mode === "edit" && reservation) {
    // Esperar a que los clientes estén cargados antes de resetear
    if (!customers.length) return;

    const foundCustomer = customers.find(
      (c) =>
        c._id === reservation.customer?.id ||
        c.email === reservation.customer?.email
    );

    form.reset({
      roomId: reservation.roomId,
      players: reservation.players,
      language: reservation.language ?? "es",
      customerSelectId: foundCustomer?._id ?? reservation.customer?.id ?? "",
      notes: reservation.notes,
      internalNotes: reservation.internalNotes ?? "",
      status: reservation.status ?? "pendiente",
    });

    const start = new Date(reservation.start);
    setSelectedDate(start);
    setSelectedSlot(
      `${hhmmFromISO(reservation.start)}-${hhmmFromISO(reservation.end)}`
    );
  } else {
    form.reset({ roomId: "", players: undefined, language: "es" });
    setSelectedDate(null);
    setSelectedSlot(null);
  }
}, [open, mode, reservation, form, customers]);



  const reservationsByDay = useMemo(() => {
    const map: Record<string, { start: string; end: string }[]> = {};
    reservations.forEach((r) => {
      const d = new Date(r.start);
      const day = d.toLocaleDateString("sv-SE");
      const start = hhmmFromISO(r.start);
      const end = hhmmFromISO(r.end);
      if (!map[day]) map[day] = [];
      map[day].push({ start, end });
    });
    return map;
  }, [reservations]);

  const getDayStatus = (d: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (d < today) return "disabled";
    if (!selectedRoom) return "green";
    const ymd = d.toLocaleDateString("sv-SE");
    const slots = getSlotsForDate(selectedRoom, d);
    if (slots.length === 0) return "red";
    const reserved = reservationsByDay[ymd] || [];
    const reservedCount = slots.filter((s) =>
      reserved.some((r) => overlaps(r.start, r.end, s.start, s.end))
    ).length;
    if (reservedCount === 0) return "green";
    if (reservedCount < slots.length) return "yellow";
    return "red";
  };

  /* Cargar franjas del día seleccionado */
  useEffect(() => {
    if (!selectedRoom || !selectedDate) return setSlotOptions([]);
    const slots = getSlotsForDate(selectedRoom, selectedDate);
    const ymd = selectedDate.toLocaleDateString("sv-SE");
    const reserved = reservationsByDay[ymd] || [];
    setSlotOptions(
      slots.map((s) => ({
        ...s,
        reserved: reserved.some((r) => overlaps(r.start, r.end, s.start, s.end)),
      }))
    );
  }, [selectedRoom, selectedDate, reservationsByDay]);

  const computedPrice = useMemo(
    () =>
      selectedRoom
        ? priceForPlayers(selectedRoom, Number(watchPlayers) || 0)
        : 0,
    [selectedRoom, watchPlayers]
  );

  /* === SUBMIT === */
  async function submit(values: FormValues) {
    setFormError(null);

  if (!selectedRoom || !selectedDate || !selectedSlot)
    return toast.error("Selecciona fecha y hora");

  setLoading(true); // 👈 activar loading

  const [start, end] = selectedSlot.split("-");
  const body: Record<string, any> = {
    roomId: selectedRoom._id,
    date: selectedDate.toLocaleDateString("sv-SE"),
    start,
    end,
    players: values.players,
    language: values.language,
    notes: values.notes,
    internalNotes: values.internalNotes,
    status: values.status,
    sendEmail,
  };

  if (values.customerSelectId === "__new__") {
    body.customerName = `${values.firstName ?? ""} ${values.lastName ?? ""}`.trim();
    body.customerEmail = values.email;
    body.customerPhone = values.phone;
  } else if (values.customerSelectId) {
    const c = customers.find(
      (x) => x._id === values.customerSelectId || x.email === values.customerSelectId
    );
    if (c) body.customerId = c._id;
  }

  try {
    const res = await fetch(
      mode === "edit"
        ? `/api/reservations/${reservation?._id}`
        : "/api/reservations",
      {
        method: mode === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const json = await res.json();
    if (!res.ok)
      return toast.error("Error al guardar reserva", {
        description: json?.error,
      });

    toast.success("Reserva guardada correctamente");
    onOpenChange(false);
    onSaved?.(json._id ?? "");
  } catch (err: any) {
    toast.error("Error al guardar reserva", {
      description: err?.message,
    });
  } finally {
    setLoading(false); // 👈 desactivar loading siempre
    setSendEmail(false);
  }
}


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl sm:max-w-xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Editar reserva" : "Crear nueva reserva"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-scroll pr-2 space-y-6">
          <Form {...form}>
            <form
                id="reservation-form"
                onSubmit={form.handleSubmit(submit, () => {
                  // Cuando hay errores de validación
                  setFormError("⚠️ Revisa todos los campos obligatorios");
                })}
                className="space-y-6 pb-6"
              >

              {/* Sala */}
              <FormField
                control={form.control}
                name="roomId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sala *</FormLabel>
                    <FormDescription>Selecciona la sala</FormDescription>
                    <Select
                      value={field.value}
                      onValueChange={(v) => {
                        field.onChange(v);
                        setSelectedDate(null);
                        setSelectedSlot(null);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona sala" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(roomsProp ?? roomsLocal).map((r) => (
                          <SelectItem key={r._id} value={r._id}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              {!selectedRoom ? (
                <p className="text-sm text-muted-foreground italic">
                  Selecciona una sala para continuar.
                </p>
              ) : (
                <>
                  {/* Jugadores */}
                  <FormField
                    control={form.control}
                    name="players"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Jugadores *</FormLabel>
                        <FormDescription>Selecciona el número de jugadores</FormDescription>
                        <Select
                          value={field.value ? String(field.value) : ""}
                          onValueChange={(v) => field.onChange(Number(v))}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona número de jugadores" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {selectedRoom.priceTable.map((p) => (
                              <SelectItem key={p.players} value={String(p.players)}>
                                {p.players} jugadores — {eur(p.price)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <p className="text-xs text-muted-foreground">
                          Precio: {eur(computedPrice)} · Capacidad{" "}
                          {selectedRoom.capacityMin}–{selectedRoom.capacityMax}
                        </p>
                      </FormItem>
                    )}
                  />

                  {/* Calendario + horas */}
                  <FormItem>
                    <FormLabel>Fecha y hora *</FormLabel>
                    <FormDescription>Selecciona la fecha y hora</FormDescription>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <Calendar
                        mode="single"
                        selected={selectedDate ?? undefined}
                        onSelect={(d) => {
                          setSelectedDate(d ?? null);
                          setSelectedSlot(null);
                        }}
                        className="rounded-md border shadow-sm p-2"
                        modifiers={{
                          green: (d) => getDayStatus(d) === "green",
                          yellow: (d) => getDayStatus(d) === "yellow",
                          red: (d) => getDayStatus(d) === "red",
                          disabled: (d) => getDayStatus(d) === "disabled",
                        }}
                        modifiersClassNames={{
                          green:
                            "bg-green-100 text-green-800 hover:bg-green-200 m-1",
                          yellow:
                            "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 m-1",
                          red: "bg-red-100 text-red-800 m-1",
                          disabled: "opacity-40 pointer-events-none m-1",
                        }}
                      />
                     <div className="flex flex-wrap content-start items-start gap-2 flex-1">

                        {selectedDate ? (
                          slotOptions.length ? (
                            slotOptions.map((s, i) => (
                              <Button
                                key={i}
                                type="button"
                                variant={
                                  s.reserved
                                    ? "secondary"
                                    : selectedSlot === `${s.start}-${s.end}`
                                      ? "default"
                                      : "outline"
                                }
                                disabled={s.reserved}
                                onClick={() =>
                                  setSelectedSlot(`${s.start}-${s.end}`)
                                }
                                className={cn(
                                  s.reserved && "text-red-500 font-semibold"
                                )}
                              >
                                {s.start}
                              </Button>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground col-span-full">
                              No hay franjas disponibles este día.
                            </p>
                          )
                        ) : (
                          <p className="text-sm text-muted-foreground col-span-full">
                            Selecciona una fecha.
                          </p>
                        )}
                      </div>
                    </div>
                  </FormItem>

                  {/* Cliente */}
                  <FormField
                    control={form.control}
                    name="customerSelectId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cliente</FormLabel>
                        <FormDescription>Selecciona un cliente o crea uno nuevo</FormDescription>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona cliente" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {customers.map((c) => (
                              <SelectItem key={c._id} value={String(c._id)}>
                                {`${c.name} — ${c.email}`}
                              </SelectItem>
                            ))}
                            <SelectItem value="__new__">
                              ➕ Crear nuevo cliente
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />

                  {watchCustomer === "__new__" && (
                    <div className="grid sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nombre *</FormLabel>
                            <FormControl>
                              <Input placeholder="Nombre" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Apellidos *</FormLabel>
                            <FormControl>
                              <Input placeholder="Apellidos" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email *</FormLabel>
                            <FormControl>
                              <Input
                                type="email"
                                placeholder="tucorreo@ejemplo.com"
                                {...field}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Teléfono *</FormLabel>
                            <FormControl>
                              <Input type="tel" placeholder="600..." {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {/* Descripción */}
                  {/* <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descripción</FormLabel>
                        <Input
                          placeholder="Breve descripción de la reserva"
                          {...field}
                        />
                      </FormItem>
                    )}
                  /> */}

                  {/* Notas */}
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notas/Información cliente</FormLabel>
                        <FormDescription>Notas o información relevante que ha enviado el cliente</FormDescription>
                        <Textarea
                          rows={3}
                          placeholder="Notas adicionales o detalles relevantes para la reserva"
                          {...field}
                        />
                      </FormItem>
                    )}
                  />
                  {/* Notas internas */}
                <FormField
                  control={form.control}
                  name="internalNotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notas internas Admins</FormLabel>
                       <FormDescription>Notas o información relevante para el personal interno</FormDescription>
                      <Textarea
                        rows={3}
                        placeholder="Solo visibles para el personal interno"
                        {...field}
                      />
                      <FormDescription>
                        Estas notas no se muestran al cliente.
                      </FormDescription>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado de la reserva</FormLabel>
                      <FormDescription>Selecciona el estado actual de la reserva</FormDescription>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger
                            className={cn(
                              field.value === "pendiente" && "border-yellow-300 text-yellow-700",
                              field.value === "confirmada" && "border-green-300 text-green-700",
                              field.value === "cancelada" && "border-red-300 text-red-700"
                            )}
                          >
                            <SelectValue placeholder="Selecciona estado" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pendiente">
                            <div className="flex items-center gap-2 text-yellow-700">
                              <Clock className="w-4 h-4 text-yellow-600" />
                              <span>Pendiente</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="confirmada">
                            <div className="flex items-center gap-2 text-green-700">
                              <CheckCircle className="w-4 h-4 text-green-600" />
                              <span>Confirmada</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="cancelada">
                            <div className="flex items-center gap-2 text-red-700">
                              <XCircle className="w-4 h-4 text-red-600" />
                              <span>Cancelada</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}

                  
                />

                {mode === "edit" &&
                  (form.watch("status") === "pendiente" ||
                    form.watch("status") === "cancelada") && (
                    <div className="flex items-center space-x-2 border rounded-md p-3 bg-muted/30">
                      <input
                        id="sendEmail"
                        type="checkbox"
                        checked={sendEmail}
                        onChange={(e) => setSendEmail(e.target.checked)}
                        className="h-4 w-4 accent-primary"
                      />
                      <label
                        htmlFor="sendEmail"
                        className="text-sm text-muted-foreground cursor-pointer"
                      >
                        Enviar correo al cliente informando sobre el estado de la reserva
                      </label>
                    </div>
                  )}

                </>
              )}
            </form>
          </Form>
        </div>

        {/* Footer fijo */}
        <DialogFooter className="border-t bg-background p-4 flex sm:justify-between gap-2">
  {mode === "edit" && reservation?._id && (
    <Button
      type="button"
      variant="destructive"
      size="sm"
      onClick={async () => {
        const confirmed = window.confirm(
          "¿Seguro que deseas eliminar esta reserva?"
        );
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
          onSaved?.(reservation._id);
        } catch (e: any) {
          toast.error("Error eliminando reserva", {
            id: t,
            description: e?.message,
          });
        }
      }}
    >
      Eliminar
    </Button>
  )}

  {formError && (
    <p className="text-sm text-red-600 font-medium flex-1 text-center sm:text-left">
      {formError}
    </p>
  )}

  <Button
    type="submit"
    form="reservation-form"
    className="w-full sm:w-auto"
    disabled={loading}
  >
    {loading ? (
      <>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Guardando...
      </>
    ) : mode === "edit" ? (
      "Guardar cambios"
    ) : (
      "Crear reserva"
    )}
  </Button>
</DialogFooter>

      </DialogContent>
    </Dialog>
  );
}
