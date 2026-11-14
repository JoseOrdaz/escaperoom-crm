"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import confetti from "canvas-confetti";

import { Button } from "@/components/ui/button";
import { SlotPicker, type DayStatus } from "@/components/reservations/slot-picker";
import { priceFor } from "@/lib/pricing";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { CheckCircle2, DoorOpen, Clock, Users, MessageCircle, RotateCcw, Phone, CalendarDays, ChevronLeft, Languages, Ticket, ArrowRight, Check, Pencil, Loader2 } from "lucide-react";

const LANGS = [
  { value: "es", label: "Español", flag: "🇪🇸" },
  { value: "en", label: "English", flag: "🇬🇧" },
  { value: "ru", label: "Русский", flag: "🇷🇺" },
] as const;
type Lang = (typeof LANGS)[number]["value"];

const eur = (n: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n);

/* ───────── Types ───────── */
type Room = {
  _id: string;
  name: string;
  imageUrl?: string;
  capacityMin: number;
  capacityMax: number;
  priceTable: { players: number; price: number }[];
  durationMinutes?: number;
  schedule?: any;
};
type Reservation = { start: string; end: string; players: number };

/* ───────── Schema ───────── */
const schema = z.object({
  firstName: z.string().min(2, "Nombre requerido"),
  lastName: z.string().min(2, "Apellidos requeridos"),
  email: z.string().email("Email inválido"),
  phone: z.string().min(6, "Teléfono requerido"),
  notes: z.string().max(500).optional(),
  acceptPrivacy: z.literal(true, {
    message: "Debes aceptar la política de privacidad",
  }),
});
type ClientFormValues = z.infer<typeof schema>;

export default function BookingWizard({
  roomsProp,
  roomIds,
  contactPhone,
}: {
  roomsProp?: Room[];
  roomIds?: string[];
  /** Teléfono que se muestra cuando un día no admite reservas online */
  contactPhone?: string;
}) {
  const [step, setStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const [rooms, setRooms] = useState<Room[]>(roomsProp || []);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [players, setPlayers] = useState<number | null>(null);
  const [date, setDate] = useState<Date | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [confirmedReservation, setConfirmedReservation] = useState<any>(null);
  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState<any | null>(null);
  const [finalPrice, setFinalPrice] = useState<number | null>(null);
  const [language, setLanguage] = useState<Lang>("es");
  const [submitting, setSubmitting] = useState(false);


  /* ───────── Helpers ───────── */
  function getSlotsForDate(room: Room, date: Date) {
    if (!room?.schedule) return [];
    const ymd = date.toLocaleDateString("sv-SE");
    const weekday = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ][date.getDay()] as keyof Room["schedule"]["template"];

    if (room.schedule.daysOff?.some((d: any) => d.date === ymd)) return [];
    const override = room.schedule.overrides?.find((o: any) => o.date === ymd);
    if (override) return override.slots;
    return room.schedule.template?.[weekday] || [];
  }

  /* ───────── Form ───────── */
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      notes: "",
      acceptPrivacy: false,
    },
  });

  /* ───────── Navegación ───────── */
  const goNext = (next: number) => {
    setCompletedSteps((prev) =>
      prev.includes(step) ? prev : [...prev, step]
    );
    setStep(next);
  };
  const goToStep = (targetStep: number) => {
    if (targetStep < step || completedSteps.includes(targetStep)) {
      setStep(targetStep);
    }
  };
  const resetWizard = () => {
    setStep(1);
    setCompletedSteps([]);
    setRoomId(null);
    setPlayers(null);
    setDate(null);
    setSlot(null);
    setConfirmedReservation(null);
    setLanguage("es");
    setCoupon(null);
    setCouponCode("");
    setFinalPrice(null);
    form.reset();
  };

  async function validateCoupon() {
    if (!couponCode.trim()) {
      toast.error("Introduce un código de cupón");
      return;
    }
    if (!selectedRoom) {
      toast.error("Selecciona una sala primero");
      return;
    }

    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: couponCode.trim(),
          roomId: selectedRoom._id,
          date: new Date().toISOString(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.valid) throw new Error(data.message || "Cupón no válido");

      // Calcular nuevo precio
      const basePrice =
        selectedRoom.priceTable.find((p) => p.players === players)?.price ?? 0;
      const discount =
        data.type === "percent"
          ? (basePrice * data.value) / 100
          : Number(data.value);
      const newPrice = Math.max(basePrice - discount, 0);

      setCoupon({
        code: couponCode.trim(),
        type: data.type,
        value: data.value,
      });
      setFinalPrice(newPrice);

      toast.success(data.message);
    } catch (e: any) {
      setCoupon(null);
      setFinalPrice(null);
      toast.error("Cupón no válido", { description: e.message });
    }
  }



  /* ───────── Cargar salas (solo si no vienen por props) ───────── */
  useEffect(() => {
    if (roomsProp && roomsProp.length > 0) {
      setRooms(roomsProp);
      return;
    }

    fetch("/api/rooms")
      .then((r) => r.json())
      .then((allRooms) => {
        if (roomIds && roomIds.length > 0) {
          const filtered = allRooms.filter((r: Room) => roomIds.includes(r._id));
          setRooms(filtered);
        } else {
          setRooms(allRooms);
        }
      })
      .catch(() => toast.error("Error cargando salas"));
  }, [roomsProp, roomIds]);


  /* ───────── Cargar reservas ───────── */
  useEffect(() => {
    if (!roomId) return;
    const today = new Date().toISOString().slice(0, 10);
    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 30);
    const to = nextMonth.toISOString().slice(0, 10);

    fetch(`/api/reservations?roomId=${roomId}&from=${today}&to=${to}`)
      .then((r) => r.json())
      .then((json) =>
        setReservations(Array.isArray(json) ? json : json.items ?? [])
      )
      .catch(() => toast.error("Error cargando reservas"));
  }, [roomId]);

  /* ───────── Transformar reservas ───────── */
  const reservationsByDay = useMemo(() => {
    const map: Record<string, { start: string; end: string }[]> = {};
    reservations.forEach((res) => {
      const d = new Date(res.start);
      const day = d.toISOString().slice(0, 10); // YYYY-MM-DD en UTC

      const startDate = new Date(res.start);
      const endDate = new Date(res.end);

      // 🔹 Horas en UTC, no locales
      const start = `${String(startDate.getUTCHours()).padStart(2, "0")}:${String(
        startDate.getUTCMinutes()
      ).padStart(2, "0")}`;
      const end = `${String(endDate.getUTCHours()).padStart(2, "0")}:${String(
        endDate.getUTCMinutes()
      ).padStart(2, "0")}`;

      if (!map[day]) map[day] = [];
      map[day].push({ start, end });
    });
    return map;
  }, [reservations]);


  const selectedRoom = rooms.find((r) => r._id === roomId);

  /* ───────── Estado del día ───────── */
  const getDayStatus = (d: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (d < today) return "disabled";
    if (!selectedRoom) return "green";
    const ymd = d.toLocaleDateString("sv-SE");
    const slots = getSlotsForDate(selectedRoom, d);
    if (slots.length === 0) return "red";
    const reservedHours = reservationsByDay[ymd] || [];
    const total = slots.length;
    const reservedCount = slots.filter((s: any) =>
      reservedHours.some((r) => overlaps(r.start, r.end, s.start, s.end))
    ).length;
    if (reservedCount === 0) return "green";
    if (reservedCount < total) return "yellow";
    return "red";
  };

  /* ───────── Confirmar reserva ───────── */
  const onSubmit = async (values: ClientFormValues) => {
    const t = toast.loading("Creando reserva…");
    try {
      if (!roomId || !date || !slot || !players)
        throw new Error("Datos incompletos");

      const start = slot;
      const localYMD = date.toLocaleDateString("sv-SE");
      const [h, m] = start.split(":").map(Number);
      const startDate = new Date(date);
      startDate.setHours(h, m, 0, 0);

      const endDate = new Date(startDate);
      endDate.setMinutes(endDate.getMinutes() + (selectedRoom?.durationMinutes ?? 120));
      const end = endDate.toTimeString().slice(0, 5);

      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          date: localYMD,
          start,
          end,
          players,
          language,
          notes: values.notes,
          customerName: `${values.firstName} ${values.lastName}`.trim(),
          customerEmail: values.email,
          customerPhone: values.phone,
          ...(coupon ? { couponCode: coupon.code } : {}),
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Error al crear reserva");

      setConfirmedReservation({
        ...json,
        room: selectedRoom,
        start,
        end,
        date: date.toLocaleDateString("sv-SE"),
        players,
        customer: {
          name: `${values.firstName} ${values.lastName}`.trim(),
          email: values.email,
          phone: values.phone,
        },
        notes: values.notes,
        coupon: coupon ? { ...coupon } : null,        // 👈 añade esto
        finalPrice: totalPrice,
      });

      toast.success("¡Reserva confirmada!", {
        id: t,
        description: json?.room?.name
          ? `Sala: ${json.room.name} • ${new Date(json.date).toLocaleDateString()} • ${json.start} - ${json.end}`
          : `Reserva realizada correctamente`,
      });


      goNext(6);
      setTimeout(() => confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 } }), 500);
    } catch (e: any) {
      toast.error("No se pudo crear la reserva", { id: t, description: e.message });
    }
  };

  function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
    const toMin = (s: string) => {
      const [h, m] = s.split(":").map(Number);
      return h * 60 + m;
    };
    const as = toMin(aStart);
    const ae = toMin(aEnd);
    const bs = toMin(bStart);
    const be = toMin(bEnd);
    return as < be && ae > bs;
  }

  /* ───────── Precio ───────── */
  // Precio de la tabla + precio especial del día/hora elegidos (si hay)
  const pricing = priceFor(selectedRoom as any, players, date?.toLocaleDateString("sv-SE"), slot);
  const basePrice = pricing.price;
  const discount = coupon
    ? coupon.type === "percent"
      ? (basePrice * Number(coupon.value)) / 100
      : Number(coupon.value)
    : 0;
  const totalPrice = Math.max(basePrice - discount, 0);
  const minPrice = (r: Room) =>
    r.priceTable?.length ? Math.min(...r.priceTable.map((p) => Number(p.price))) : null;

  /* ───────── Pasos ───────── */
  const steps = ["Sala", "Jugadores", "Fecha y hora", "Tus datos", "Revisar"];

  /* ───────── Scroll al inicio al cambiar de paso ───────── */
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [step]);

  const fmtDate = (d: Date, opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }) => {
    const s = d.toLocaleDateString("es-ES", opts);
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  const endOf = (start: string) => {
    const [h, m] = start.split(":").map(Number);
    const t = h * 60 + m + (selectedRoom?.durationMinutes ?? 120);
    return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  };

  const slotOptions: { start: string; end: string; reserved: boolean }[] =
    selectedRoom && date
      ? getSlotsForDate(selectedRoom, date).map((s: any) => ({
          start: s.start,
          end: s.end,
          reserved: (reservationsByDay[date.toLocaleDateString("sv-SE")] || []).some((r) =>
            overlaps(r.start, r.end, s.start, s.end)
          ),
        }))
      : [];
  const closedDayMessage = (() => {
    if (!selectedRoom || !date) return "";
    const off = selectedRoom.schedule?.daysOff?.find(
      (d: any) => d.date === date.toLocaleDateString("sv-SE")
    ) as { message?: string } | undefined;
    return off?.message?.trim() || "Si queréis jugar este día, llamadnos y buscaremos una opción para vuestro grupo.";
  })();

  const StepHeader = ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div className="mb-6">
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );

  const BackButton = ({ to }: { to: number }) => (
    <Button type="button" variant="ghost" size="sm" onClick={() => goToStep(to)} className="-ml-2 text-muted-foreground">
      <ChevronLeft className="size-4" /> Atrás
    </Button>
  );

  /* ───────── Resumen lateral ───────── */
  const Summary = ({ compact = false }: { compact?: boolean }) => {
    if (!selectedRoom) return null;
    const rows: { icon: React.ReactNode; label: string; value?: string; step: number }[] = [
      { icon: <Users className="size-4" />, label: "Jugadores", value: players ? `${players} jugadores` : undefined, step: 2 },
      {
        icon: <CalendarDays className="size-4" />,
        label: "Fecha",
        value: date ? fmtDate(date, { weekday: "short", day: "numeric", month: "short" }) : undefined,
        step: 3,
      },
      { icon: <Clock className="size-4" />, label: "Hora", value: slot ? `${slot} – ${endOf(slot)}` : undefined, step: 3 },
      { icon: <Languages className="size-4" />, label: "Idioma", value: date ? LANGS.find((l) => l.value === language)?.label : undefined, step: 3 },
    ];
    if (compact) {
      return (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border bg-card p-3 lg:hidden">
          {selectedRoom.imageUrl ? (
            <img src={selectedRoom.imageUrl} alt="" className="size-12 shrink-0 rounded-xl object-cover" />
          ) : (
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted"><DoorOpen className="size-5" /></span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{selectedRoom.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {[players && `${players} jug.`, date && fmtDate(date, { day: "numeric", month: "short" }), slot].filter(Boolean).join(" · ") || "Elige tus opciones"}
            </p>
          </div>
          {players ? <p className="shrink-0 text-base font-semibold tabular-nums">{eur(totalPrice)}</p> : null}
        </div>
      );
    }
    return (
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="relative h-32">
          {selectedRoom.imageUrl ? (
            <img src={selectedRoom.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center bg-muted"><DoorOpen className="size-8 text-muted-foreground" /></div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute inset-x-4 bottom-3 text-white">
            <p className="text-xs uppercase tracking-wider opacity-80">Tu reserva</p>
            <p className="truncate text-lg font-semibold">{selectedRoom.name}</p>
          </div>
        </div>
        <ul className="divide-y px-4">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center gap-3 py-3 text-sm">
              <span className="text-muted-foreground">{r.icon}</span>
              <span className="text-muted-foreground">{r.label}</span>
              <span className={cn("ml-auto text-right font-medium", !r.value && "font-normal text-muted-foreground/60")}>
                {r.value ?? "—"}
              </span>
            </li>
          ))}
        </ul>
        <div className="border-t bg-muted/40 px-4 py-4">
          {coupon && players ? (
            <div className="mb-2 space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="tabular-nums">{eur(basePrice)}</span></div>
              <div className="flex justify-between text-emerald-600"><span className="flex items-center gap-1"><Ticket className="size-3.5" />{coupon.code}</span><span className="tabular-nums">−{eur(discount)}</span></div>
            </div>
          ) : null}
          {pricing.rule && players ? (
            <p className="mb-2 rounded-md bg-amber-500/10 px-2 py-1 text-xs text-amber-800 dark:text-amber-300">
              {pricing.rule.label?.trim() || "Precio especial"} para esta fecha: {pricing.rule.adjustType === "percent" ? `${pricing.rule.value > 0 ? "+" : ""}${pricing.rule.value} %` : `${pricing.rule.value > 0 ? "+" : ""}${eur(pricing.rule.value)}`}
            </p>
          ) : null}
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium">Total</span>
            <span className="text-2xl font-semibold tabular-nums">{players ? eur(totalPrice) : "—"}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto w-full max-w-6xl">
      {/* ── Progreso ── */}
      {step < 6 && (
        <nav aria-label="Progreso de la reserva" className="mb-6">
          <ol className="flex items-center gap-2">
            {steps.map((label, i) => {
              const index = i + 1;
              const active = step === index;
              const done = completedSteps.includes(index) && !active;
              const clickable = index < step || completedSteps.includes(index);
              return (
                <li key={label} className="flex flex-1 flex-col gap-2">
                  <button
                    type="button"
                    disabled={!clickable}
                    onClick={() => goToStep(index)}
                    className="group flex flex-col gap-2 text-left disabled:cursor-default"
                    aria-current={active ? "step" : undefined}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-full rounded-full transition-colors",
                        active ? "bg-primary" : done ? "bg-primary/50" : "bg-muted"
                      )}
                    />
                    <span
                      className={cn(
                        "hidden items-center gap-1.5 text-xs font-medium sm:flex",
                        active ? "text-foreground" : done ? "text-muted-foreground group-hover:text-foreground" : "text-muted-foreground/60"
                      )}
                    >
                      {done ? <Check className="size-3.5 text-primary" /> : <span className="tabular-nums">{index}.</span>}
                      {label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="mt-2 text-xs font-medium text-muted-foreground sm:hidden">
            Paso {step} de {steps.length} · {steps[step - 1]}
          </p>
        </nav>
      )}

      <div className={cn("grid gap-6", step > 1 && step < 6 && "lg:grid-cols-[minmax(0,1fr)_320px]")}>
        <div className="min-w-0">
          {step > 1 && step < 6 && <Summary compact />}

          <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-8">
            {/* Paso 1: Sala */}
            {step === 1 && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                <StepHeader title="Elige tu aventura" subtitle="Selecciona la sala que queréis jugar." />
                {rooms.length === 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-64 animate-pulse rounded-2xl bg-muted" />
                    ))}
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {rooms.map((r) => {
                      const selected = roomId === r._id;
                      const from = minPrice(r);
                      return (
                        <button
                          type="button"
                          key={r._id}
                          onClick={() => {
                            if (roomId !== r._id) {
                              setPlayers(null);
                              setDate(null);
                              setSlot(null);
                              setCoupon(null);
                              setFinalPrice(null);
                            }
                            setRoomId(r._id);
                            goNext(2);
                          }}
                          className={cn(
                            "group relative overflow-hidden rounded-2xl border bg-card text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-primary",
                            selected && "ring-2 ring-primary"
                          )}
                        >
                          <div className="relative aspect-[16/9] overflow-hidden sm:aspect-[4/3]">
                            {r.imageUrl ? (
                              <img src={r.imageUrl} alt={r.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground"><DoorOpen className="size-8" /></div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                            {selected && (
                              <span className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow"><Check className="size-4" /></span>
                            )}
                            <p className="absolute inset-x-4 bottom-3 text-lg font-semibold leading-tight text-white drop-shadow">{r.name}</p>
                          </div>
                          <div className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
                              <span className="flex items-center gap-1"><Users className="size-3.5" />{r.capacityMin}–{r.capacityMax}</span>
                              {r.durationMinutes ? <span className="flex items-center gap-1"><Clock className="size-3.5" />{r.durationMinutes} min</span> : null}
                            </div>
                            {from !== null && (
                              <span className="shrink-0 text-xs text-muted-foreground">desde <span className="text-sm font-semibold text-foreground">{eur(from)}</span></span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* Paso 2: Jugadores */}
            {step === 2 && selectedRoom && (
              <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }}>
                <BackButton to={1} />
                <StepHeader title="¿Cuántos vais a jugar?" subtitle="El precio es por grupo y depende del número de jugadores." />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {selectedRoom.priceTable.map((p) => {
                    const selected = players === p.players;
                    return (
                      <button
                        type="button"
                        key={p.players}
                        onClick={() => {
                          setPlayers(p.players);
                          goNext(3);
                        }}
                        className={cn(
                          "flex flex-col items-center gap-0.5 rounded-2xl border bg-card px-3 py-3 text-center sm:gap-1 sm:py-5 transition-all hover:border-primary/50 hover:shadow-md focus-visible:outline-2 focus-visible:outline-primary",
                          selected && "border-primary bg-primary/5 ring-1 ring-primary"
                        )}
                      >
                        <span className="text-2xl font-semibold tabular-nums sm:text-3xl">{p.players}</span>
                        <span className="text-xs text-muted-foreground">jugadores</span>
                        <span className="mt-1 text-base font-semibold tabular-nums sm:mt-2">{eur(p.price)}</span>
                        <span className="text-[11px] text-muted-foreground">{eur(p.price / p.players)} / persona</span>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Paso 3: Fecha, hora e idioma */}
            {step === 3 && selectedRoom && (
              <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }} className="space-y-6">
                <div>
                  <BackButton to={2} />
                  <StepHeader title="¿Cuándo queréis venir?" subtitle="Elige un día y una de las horas libres." />
                </div>

                <SlotPicker
                  selectedDate={date}
                  onSelectDate={(d) => {
                    setDate(d);
                    setSlot(null);
                  }}
                  getDayStatus={getDayStatus as (d: Date) => DayStatus}
                  slots={slotOptions}
                  selectedSlot={slot ? `${slot}-${slotOptions.find((s) => s.start === slot)?.end ?? endOf(slot)}` : null}
                  onSelectSlot={(v) => setSlot(v.split("-")[0])}
                  emptyState={
                    <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-amber-300/70 bg-amber-50 p-4 text-center dark:bg-amber-500/10">
                      <Phone className="size-5 text-amber-600" />
                      <p className="text-sm font-semibold">No hay reservas online este día</p>
                      <p className="text-xs text-muted-foreground">{closedDayMessage}</p>
                      {contactPhone && (
                        <Button asChild size="sm" className="mt-2">
                          <a href={`tel:${contactPhone.replace(/\s+/g, "")}`}><Phone className="size-4" /> {contactPhone}</a>
                        </Button>
                      )}
                    </div>
                  }
                />

                <div>
                  <p className="mb-2 flex items-center gap-2 text-sm font-medium"><Languages className="size-4 text-muted-foreground" />Idioma de la partida</p>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Idioma de la partida">
                    {LANGS.map((l) => (
                      <button
                        type="button"
                        key={l.value}
                        role="radio"
                        aria-checked={language === l.value}
                        onClick={() => setLanguage(l.value)}
                        className={cn(
                          "flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors",
                          language === l.value ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/50"
                        )}
                      >
                        <span aria-hidden>{l.flag}</span>{l.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button size="lg" disabled={!date || !slot} onClick={() => goNext(4)}>
                    Continuar <ArrowRight className="size-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Paso 4: Datos */}
            {step === 4 && (
              <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }}>
                <BackButton to={3} />
                <StepHeader title="Tus datos" subtitle="Te enviaremos la confirmación por email." />
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(() => goNext(5))} className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField control={form.control} name="firstName" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre</FormLabel>
                          <FormControl><Input {...field} autoComplete="given-name" placeholder="Tu nombre" className="h-11" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="lastName" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Apellidos</FormLabel>
                          <FormControl><Input {...field} autoComplete="family-name" placeholder="Tus apellidos" className="h-11" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="email" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl><Input type="email" {...field} autoComplete="email" placeholder="ejemplo@correo.com" className="h-11" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="phone" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Teléfono</FormLabel>
                          <FormControl><Input type="tel" {...field} autoComplete="tel" placeholder="600 123 456" className="h-11" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    <FormField control={form.control} name="notes" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observaciones <span className="font-normal text-muted-foreground">(opcional)</span></FormLabel>
                        <FormControl>
                          <Textarea rows={3} {...field} placeholder="Cumpleaños, edades de los jugadores, alguna necesidad especial…" className="resize-none" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    {/* Cupón */}
                    <div className="rounded-xl border border-dashed p-4">
                      <p className="mb-2 flex items-center gap-2 text-sm font-medium"><Ticket className="size-4 text-muted-foreground" />¿Tienes un cupón de descuento?</p>
                      {coupon ? (
                        <div className="flex items-center justify-between gap-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
                          <span className="flex items-center gap-2"><Check className="size-4" /><strong>{coupon.code}</strong> aplicado · −{eur(discount)}</span>
                          <button type="button" className="text-xs underline" onClick={() => { setCoupon(null); setFinalPrice(null); setCouponCode(""); }}>Quitar</button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Input
                            placeholder="CÓDIGO"
                            value={couponCode}
                            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); validateCoupon(); } }}
                            className="h-10 font-mono uppercase"
                            aria-label="Código de cupón"
                          />
                          <Button type="button" variant="outline" onClick={validateCoupon} className="h-10 shrink-0">Aplicar</Button>
                        </div>
                      )}
                    </div>

                    <FormField control={form.control} name="acceptPrivacy" render={({ field }) => (
                      <FormItem className="flex items-start gap-3 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} className="mt-0.5" />
                        </FormControl>
                        <div>
                          <FormLabel className="block text-sm font-normal leading-relaxed text-muted-foreground">
                            Acepto la <a href="/privacidad" target="_blank" className="text-primary underline hover:text-primary/80">política de privacidad</a> y el tratamiento de mis datos para gestionar la reserva.
                          </FormLabel>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )} />

                    <div className="flex justify-end">
                      <Button
                        type="button"
                        size="lg"
                        onClick={async () => {
                          const isValid = await form.trigger();
                          if (isValid) goNext(5);
                        }}
                      >
                        Revisar reserva <ArrowRight className="size-4" />
                      </Button>
                    </div>
                  </form>
                </Form>
              </motion.div>
            )}

            {/* Paso 5: Revisar */}
            {step === 5 && selectedRoom && date && slot && (
              <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }}>
                <BackButton to={4} />
                <StepHeader title="Revisa tu reserva" subtitle="Comprueba que todo es correcto antes de confirmar." />

                <div className="divide-y rounded-xl border">
                  {[
                    { title: "Partida", step: 3, lines: [selectedRoom.name, `${fmtDate(date)} · ${slot} – ${endOf(slot)}`, `${players} jugadores · ${LANGS.find((l) => l.value === language)?.label}`] },
                    { title: "Contacto", step: 4, lines: [`${form.getValues("firstName")} ${form.getValues("lastName")}`, form.getValues("email"), form.getValues("phone")] },
                    ...(form.getValues("notes") ? [{ title: "Observaciones", step: 4, lines: [form.getValues("notes") as string] }] : []),
                  ].map((section) => (
                    <div key={section.title} className="flex items-start justify-between gap-4 p-4">
                      <div className="min-w-0">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{section.title}</p>
                        {section.lines.map((l, i) => (
                          <p key={i} className={cn("break-words text-sm", i === 0 && "mt-1 font-medium")}>{l}</p>
                        ))}
                      </div>
                      <button type="button" onClick={() => goToStep(section.step)} className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline">
                        <Pencil className="size-3" /> Cambiar
                      </button>
                    </div>
                  ))}
                  <div className="flex items-baseline justify-between bg-muted/40 p-4">
                    <span className="text-sm font-medium">Total{coupon ? ` (cupón ${coupon.code})` : ""}</span>
                    <span className="text-2xl font-semibold tabular-nums">{eur(totalPrice)}</span>
                  </div>
                </div>

                <Button size="lg" className="mt-6 w-full" disabled={form.formState.isSubmitting || submitting} onClick={async () => { setSubmitting(true); try { await onSubmit(form.getValues()); } finally { setSubmitting(false); } }}>
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  Confirmar reserva
                </Button>
                <p className="mt-3 text-center text-xs text-muted-foreground">Recibirás un email con la confirmación y un enlace para cancelar si lo necesitas.</p>
              </motion.div>
            )}

            {/* Paso 6: Confirmación */}
            {step === 6 && confirmedReservation && (
              <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35 }} className="mx-auto max-w-lg text-center">
                <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                  <CheckCircle2 className="size-9" />
                </div>
                <h2 className="text-2xl font-semibold tracking-tight">¡Reserva confirmada!</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Hemos enviado los detalles a <strong className="text-foreground">{confirmedReservation.customer.email}</strong>.
                </p>

                <div className="mt-6 overflow-hidden rounded-2xl border text-left">
                  <div className="flex items-center gap-3 bg-primary p-4 text-primary-foreground">
                    <DoorOpen className="size-5 opacity-80" />
                    <p className="font-semibold">{confirmedReservation.room?.name}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 p-4 text-sm">
                    <div><p className="text-xs text-muted-foreground">Fecha</p><p className="font-medium">{fmtDate(new Date(`${confirmedReservation.date}T00:00:00`), { weekday: "short", day: "numeric", month: "long" })}</p></div>
                    <div><p className="text-xs text-muted-foreground">Hora</p><p className="font-medium tabular-nums">{confirmedReservation.start} – {confirmedReservation.end}</p></div>
                    <div><p className="text-xs text-muted-foreground">Jugadores</p><p className="font-medium">{confirmedReservation.players}</p></div>
                    <div><p className="text-xs text-muted-foreground">Total</p><p className="font-medium tabular-nums">{eur(confirmedReservation.finalPrice ?? 0)}{confirmedReservation.coupon && <span className="ml-1 text-xs text-emerald-600">({confirmedReservation.coupon.code})</span>}</p></div>
                  </div>
                  <p className="border-t border-dashed px-4 py-3 text-xs text-muted-foreground">Si necesitáis cancelar, usad el enlace del email con al menos 24 horas de antelación.</p>
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <Button
                    onClick={() => {
                      const fecha = fmtDate(new Date(`${confirmedReservation.date}T00:00:00`), { weekday: "long", day: "2-digit", month: "long" });
                      const mensaje = [
                        "🎉 *¡Reserva confirmada!*",
                        `🏠 *Sala:* ${confirmedReservation.room?.name}`,
                        `📅 *Fecha:* ${fecha}`,
                        `⏰ *Hora:* ${confirmedReservation.start} – ${confirmedReservation.end}`,
                        `👥 *Jugadores:* ${confirmedReservation.players}`,
                        `💶 *Precio total:* ${eur(confirmedReservation.finalPrice ?? 0)}`,
                        "",
                        "¡Nos vemos pronto en el escape room! 🔐",
                      ].join("\n");
                      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`, "_blank");
                    }}
                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    <MessageCircle className="size-4" /> Compartir por WhatsApp
                  </Button>
                  <Button variant="outline" onClick={resetWizard}>
                    <RotateCcw className="size-4" /> Hacer otra reserva
                  </Button>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {step > 1 && step < 6 && (
          <aside className="hidden lg:block">
            <div className="sticky top-6">
              <Summary />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
