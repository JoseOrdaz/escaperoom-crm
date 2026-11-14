"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
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
import { SlotPicker, type DayStatus } from "@/components/reservations/slot-picker";
import { CustomerEmailPanel } from "@/components/reservations/customer-email-panel";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Clock, CheckCircle, XCircle, Loader2, UserPlus, DoorOpen, CalendarDays, UserRound, FileText, Save, Languages } from "lucide-react";

const LANGUAGES = [
  { value: "es", label: "Español" },
  { value: "en", label: "Inglés" },
  { value: "ru", label: "Ruso" },
] as const;


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
  coupon?: { code: string; type: "percent" | "amount"; value: number };

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
function priceForPlayers(room: Room, players?: number) {
  const target = Number(players ?? 0);
  const row = room.priceTable?.find((p) => Number(p.players) === target);
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
  initialDate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "create" | "edit";
  reservation?: ReservationForEdit | null;
  onSaved?: (id: string) => void;
  rooms?: Room[];
  /** YYYY-MM-DD preseleccionado al crear (p. ej. al pulsar un día del calendario) */
  initialDate?: string;
}) {
  const [roomsLocal, setRoomsLocal] = useState<Room[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [reservations, setReservations] = useState<ReservationForEdit[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [slotOptions, setSlotOptions] = useState<Array<TimeSlot & { reserved?: boolean }>>([]);
  const [sendEmail, setSendEmail] = useState(false);
  const [emailMessage, setEmailMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [selectedCoupon, setSelectedCoupon] = useState<any | null>(null);
  const [customerDraft, setCustomerDraft] = useState({ name: "", email: "", phone: "" });






  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { roomId: "", players: undefined, language: "es" },
  });


  const watchRoomId = form.watch("roomId");
  const watchPlayers = form.watch("players");
  const watchCustomer = form.watch("customerSelectId");

  const selectedCustomer = useMemo(
    () =>
      watchCustomer && watchCustomer !== "__new__"
        ? customers.find((c) => String(c._id) === String(watchCustomer))
        : undefined,
    [customers, watchCustomer]
  );
  useEffect(() => {
    setCustomerDraft({
      name: selectedCustomer?.name ?? "",
      email: selectedCustomer?.email ?? "",
      phone: selectedCustomer?.phone ?? "",
    });
  }, [selectedCustomer]);
  const customerChanged =
    !!selectedCustomer &&
    (customerDraft.name.trim() !== (selectedCustomer.name ?? "") ||
      customerDraft.email.trim().toLowerCase() !== (selectedCustomer.email ?? "").toLowerCase() ||
      customerDraft.phone.trim() !== (selectedCustomer.phone ?? ""));

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

  /* Cargar cupones */
useEffect(() => {
  fetch("/api/coupons")
    .then((r) => r.json())
    .then((data) => {
      const now = new Date();
      const valid = (data.coupons || []).filter((c: any) => {
        return (
          c.active &&
          new Date(c.startDate) <= now &&
          new Date(c.endDate) >= now
        );
      });
      setCoupons(valid);
    })
    .catch(() => setCoupons([]));
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
    setSendEmail(false);
    setEmailMessage("");
    return;
  }

  

  if (mode === "edit" && reservation) {

       if (reservation.coupon) {
      const existing = coupons.find(
        (c) => c.code === reservation.coupon?.code
      );
      if (existing) {
        setSelectedCoupon(existing);
      } else {
        // Si el cupón ya no está en la lista actual, lo guardamos temporalmente
        setSelectedCoupon(reservation.coupon);
      }
    } else {
      setSelectedCoupon(null);
    }
    // Esperar a que los clientes estén cargados antes de resetear
    if (!customers.length) return;

    // Primero por id (varios clientes pueden compartir email)
    const foundCustomer =
      customers.find((c) => String(c._id) === String(reservation.customer?.id)) ??
      customers.find((c) => c.email === reservation.customer?.email);

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
    setSelectedDate(initialDate ? new Date(`${initialDate}T00:00:00`) : null);
    setSelectedSlot(null);
  }
}, [open, mode, reservation, form, customers, coupons, initialDate]);



  const reservationsByDay = useMemo(() => {
    const map: Record<string, { start: string; end: string }[]> = {};
    reservations
      .filter((r) => !(mode === "edit" && reservation?._id && String(r._id) === String(reservation._id)))
      .forEach((r) => {
      const d = new Date(r.start);
      const day = d.toLocaleDateString("sv-SE");
      const start = hhmmFromISO(r.start);
      const end = hhmmFromISO(r.end);
      if (!map[day]) map[day] = [];
      map[day].push({ start, end });
    });
    return map;
  }, [reservations, mode, reservation?._id]);

  const getDayStatus = (d: Date): DayStatus => {
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

  const computedPrice = useMemo(() => {
  if (!selectedRoom) return 0;
  const basePrice = priceForPlayers(selectedRoom, Number(watchPlayers) || 0);
  if (!selectedCoupon) return basePrice;

  // Aplicar descuento
  const discount =
    selectedCoupon.type === "percent"
      ? basePrice * (selectedCoupon.value / 100)
      : selectedCoupon.value;

  return Math.max(basePrice - discount, 0);
}, [selectedRoom, watchPlayers, selectedCoupon]);


  /* === SUBMIT === */
  async function submit(values: FormValues) {
    setFormError(null);

  if (!selectedRoom || !selectedDate || !selectedSlot)
    return toast.error("Selecciona fecha y hora");

  setLoading(true); // 👈 activar loading

  if (selectedCustomer && customerChanged) {
    if (!customerDraft.name.trim() || !/^\S+@\S+\.\S+$/.test(customerDraft.email.trim())) {
      setLoading(false);
      return toast.error("Revisa el nombre y el email del cliente");
    }
    try {
      const r = await fetch(`/api/customers/${selectedCustomer._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: customerDraft.name.trim(),
          email: customerDraft.email.trim(),
          phone: customerDraft.phone.trim(),
        }),
      });
      if (!r.ok) throw new Error();
      setCustomers((list) =>
        list.map((c) =>
          c._id === selectedCustomer._id
            ? { ...c, name: customerDraft.name.trim(), email: customerDraft.email.trim().toLowerCase(), phone: customerDraft.phone.trim() }
            : c
        )
      );
    } catch {
      setLoading(false);
      return toast.error("No se han podido guardar los datos del cliente");
    }
  }

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
    ...(sendEmail && emailMessage.trim() ? { emailMessage: emailMessage.trim() } : {}),
  };

  if (selectedCoupon) {
  const basePrice = priceForPlayers(selectedRoom, values.players);
  const discount =
    selectedCoupon.type === "percent"
      ? basePrice * (selectedCoupon.value / 100)
      : selectedCoupon.value;
  const finalPrice = Math.max(basePrice - discount, 0);

  body.couponCode = selectedCoupon.code;
  body.discountType = selectedCoupon.type;
  body.discountValue = selectedCoupon.value;
  body.discountAmount = discount;
  body.price = finalPrice;
} else {
  // Si no hay cupón, guardamos el precio normal
  body.price = priceForPlayers(selectedRoom, values.players);
}





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
    if (json?.email) {
      if (json.email.ok) toast.success("Correo enviado al cliente");
      else toast.error("La reserva se guardó, pero el correo no se pudo enviar", { description: json.email.error });
    }
    onOpenChange(false);
    onSaved?.(json._id ?? "");
  } catch (err: any) {
    toast.error("Error al guardar reserva", {
      description: err?.message,
    });
  } finally {
    setLoading(false); // 👈 desactivar loading siempre
    setSendEmail(false);
    setEmailMessage("");
  }
}


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90dvh,900px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-6 py-5 pr-12 text-left sm:px-7">
          <DialogTitle className="text-xl tracking-tight">{mode === "edit" ? "Editar reserva" : "Nueva reserva"}</DialogTitle>
          <DialogDescription>{mode === "edit" ? "Puedes modificar cualquier dato de la reserva." : "Completa los datos de la sesión y del cliente."}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto px-6 py-6 sm:px-7">
          <Form {...form}>
            <form
                id="reservation-form"
                onSubmit={form.handleSubmit(submit, () => {
                  // Cuando hay errores de validación
                  setFormError("Revisa todos los campos obligatorios");
                })}
                className="space-y-6 pb-6"
              >

              <div className="flex items-center gap-3 border-b pb-4"><span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><DoorOpen className="size-4" /></span><div><h3 className="text-sm font-semibold">Experiencia</h3><p className="text-xs text-muted-foreground">Sala, jugadores y descuento</p></div></div>
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
                        // Conserva el día (al editar o si viene del calendario); la hora se vuelve a elegir
                        setSelectedDate((d) => (mode === "edit" || initialDate ? d : null));
                        setSelectedSlot(null);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
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
                            <SelectTrigger className="w-full">
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

                  {/* Idioma */}
                  <FormField
                    control={form.control}
                    name="language"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Idioma de la sesión *</FormLabel>
                        <FormDescription>Idioma en el que se hará el juego y los correos</FormDescription>
                        <Select value={field.value ?? "es"} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <span className="flex items-center gap-2">
                                <Languages className="size-4 text-muted-foreground" />
                                <SelectValue placeholder="Selecciona idioma" />
                              </span>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {LANGUAGES.map((l) => (
                              <SelectItem key={l.value} value={l.value}>
                                {l.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />

                  {/* Cupón */}
{(coupons.length > 0 || selectedCoupon) && (() => {
  const roomCoupons = coupons.filter((c) => !c.roomId || c.roomId === selectedRoom?._id);
  const currentMissing = selectedCoupon && !roomCoupons.some((c) => c.code === selectedCoupon.code);
  return (
  <div className="space-y-1">
    <FormLabel>Cupón</FormLabel>
    <FormDescription>Selecciona un cupón válido (si aplica)</FormDescription>
    <Select
      value={selectedCoupon?.code || "__none__"}
      onValueChange={(code) => {
        if (code === "__none__") return setSelectedCoupon(null);
        if (code === selectedCoupon?.code) return;
        const coupon = roomCoupons.find((c) => c.code === code);
        if (coupon) {
          setSelectedCoupon(coupon);
          toast.success(
            `Cupón ${coupon.code} aplicado: ${
              coupon.type === "percent" ? `${coupon.value}%` : `-${coupon.value}€`
            }`
          );
        } else {
          setSelectedCoupon(null);
          toast.error("Cupón no válido para esta sala");
        }
      }}
    >
      <SelectTrigger className="w-full" aria-label="Cupón">
        <SelectValue placeholder="Selecciona cupón" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">Sin cupón</SelectItem>
        {currentMissing && (
          <SelectItem value={selectedCoupon.code}>
            {selectedCoupon.code} ({selectedCoupon.type === "percent" ? `${selectedCoupon.value}%` : `-${selectedCoupon.value}€`}) · actual
          </SelectItem>
        )}
        {roomCoupons.map((c) => (
          <SelectItem key={c.code} value={c.code}>
            {c.code} ({c.type === "percent" ? `${c.value}%` : `-${c.value}€`})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    {selectedCoupon && (
      <p className="text-xs text-green-600">
        Cupón aplicado: {selectedCoupon.code}
        {currentMissing && " (ya no está vigente, se conserva en esta reserva)"}
      </p>
    )}
  </div>
  );
})()}


                  <div className="flex items-center gap-3 border-b pt-2 pb-4"><span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><CalendarDays className="size-4" /></span><div><h3 className="text-sm font-semibold">Fecha y disponibilidad</h3><p className="text-xs text-muted-foreground">Elige una fecha y una hora libre</p></div></div>
                  {/* Calendario + horas */}
                  <FormItem>
                    <FormLabel>Fecha y hora *</FormLabel>
                    <FormDescription>Elige el día y después una de las horas libres</FormDescription>
                    <SlotPicker
                      selectedDate={selectedDate}
                      onSelectDate={(d) => {
                        setSelectedDate(d);
                        setSelectedSlot(null);
                      }}
                      getDayStatus={getDayStatus}
                      slots={slotOptions}
                      selectedSlot={selectedSlot}
                      onSelectSlot={setSelectedSlot}
                    />
                  </FormItem>

                  <div className="flex items-center gap-3 border-b pt-2 pb-4"><span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><UserRound className="size-4" /></span><div><h3 className="text-sm font-semibold">Cliente</h3><p className="text-xs text-muted-foreground">Selecciona un cliente o añade uno nuevo</p></div></div>
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
                            <SelectTrigger className="w-full">
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
                              <span className="inline-flex items-center gap-2"><UserPlus className="size-4" /> Crear nuevo cliente</span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />

                  {selectedCustomer && (
                    <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5 sm:col-span-2">
                          <label htmlFor="customer-name" className="text-sm font-medium">Nombre completo</label>
                          <Input id="customer-name" value={customerDraft.name} onChange={(e) => setCustomerDraft({ ...customerDraft, name: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                          <label htmlFor="customer-email" className="text-sm font-medium">Email</label>
                          <Input id="customer-email" type="email" value={customerDraft.email} onChange={(e) => setCustomerDraft({ ...customerDraft, email: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                          <label htmlFor="customer-phone" className="text-sm font-medium">Teléfono</label>
                          <Input id="customer-phone" type="tel" value={customerDraft.phone} onChange={(e) => setCustomerDraft({ ...customerDraft, phone: e.target.value })} />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {customerChanged
                          ? "Los cambios se guardarán en la ficha del cliente al guardar la reserva."
                          : "Puedes corregir los datos del cliente aquí."}
                      </p>
                    </div>
                  )}

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

                  <div className="flex items-center gap-3 border-b pt-2 pb-4"><span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><FileText className="size-4" /></span><div><h3 className="text-sm font-semibold">Notas y estado</h3><p className="text-xs text-muted-foreground">Información adicional para la reserva</p></div></div>
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
                              "w-full",
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

                {mode === "edit" && reservation?._id && (
                  <CustomerEmailPanel
                    reservationId={reservation._id}
                    customerEmail={selectedCustomer?.email ?? reservation.customer?.email}
                    status={form.watch("status") ?? "pendiente"}
                    notify={sendEmail}
                    onNotifyChange={setSendEmail}
                    notifyMessage={emailMessage}
                    onNotifyMessageChange={setEmailMessage}
                  />
                )}

                </>
              )}
            </form>
          </Form>
        </div>

        {/* Footer fijo */}
        <DialogFooter className="border-t bg-card px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
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

  <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:ml-auto sm:w-auto">Cancelar</Button>
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
      <><Save className="size-4" /> Guardar cambios</>
    ) : (
      <>Crear reserva</>
    )}
  </Button>
</DialogFooter>

      </DialogContent>
    </Dialog>
  );
}
