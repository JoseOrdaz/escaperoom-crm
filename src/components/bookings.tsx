"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import confetti from "canvas-confetti";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
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
import { CheckCircle2, DoorOpen, Clock, FileText, UserCog, Users, User, Mail, MessageCircle, RotateCcw, FileDown, MessageSquare, Phone, CalendarDays } from "lucide-react";
import { CalendarDay } from "react-day-picker";

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
}: {
  roomsProp?: Room[];
  roomIds?: string[];
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
    form.reset();
  };

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
      const day = d.toLocaleDateString("sv-SE");
      const start = new Date(res.start).toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const end = new Date(res.end).toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
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
      const startDate = new Date(`${localYMD}T${start}`);
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
          language: "es",
          notes: values.notes,
          customerName: `${values.firstName} ${values.lastName}`.trim(),
          customerEmail: values.email,
          customerPhone: values.phone,
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

  /* ───────── Breadcrumb ───────── */
  const steps = [
    { label: "Sala", info: roomId ? selectedRoom?.name : "" },
    { label: "Jugadores", info: players ? `${players}` : "" },
    { label: "Fecha y hora", info: date ? `${date.toLocaleDateString()} ${slot || ""}` : "" },
    {
      label: "Datos",
      info: form.getValues("firstName")
        ? `${form.getValues("firstName")} ${form.getValues("lastName")}`
        : "",
    },
    { label: "Resumen", info: "" },
    { label: "Confirmación", info: "" },
  ];

  /* ───────── Scroll al inicio al cambiar de paso ───────── */
  useEffect(() => {
    // Solo aplica en pantallas pequeñas (móviles)
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [step]);


  return (
    <div className="mx-auto max-w-6xl md:p-6 flex gap-8">
      {step < 5 && (
        <aside className="hidden md:block w-56 shrink-0">
          <ul className="space-y-3">
            {steps.map((s, i) => {
              const index = i + 1;
              const active = step === index;
              const done = completedSteps.includes(index);

              return (
                <li
                  key={s.label}
                  onClick={() => goToStep(index)}
                  className={cn(
                    "group relative flex flex-col rounded-lg px-4 py-3 border transition-all duration-200 cursor-pointer shadow-sm",
                    active
                      ? "border-primary/60 bg-primary/5 text-primary font-semibold"
                      : done
                        ? "border-green-400/40 bg-green-50/60 dark:bg-green-900/10 text-green-600 hover:bg-green-50/80"
                        : "border-muted hover:border-primary/30 hover:bg-muted/40"
                  )}
                >
                  <div className="flex items-center gap-3">
                    {done ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : active ? (
                      <div className="w-5 h-5 rounded-full border-2 border-primary flex items-center justify-center text-xs font-semibold text-primary bg-white dark:bg-slate-900">
                        {index}
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border text-xs flex items-center justify-center text-muted-foreground">
                        {index}
                      </div>
                    )}
                    <div className="flex flex-col">
                      <span
                        className={cn(
                          "text-sm transition-colors",
                          active && "text-primary font-medium",
                          done && "text-green-700"
                        )}
                      >
                        {s.label}
                      </span>
                      {s.info && (
                        <span className="text-xs text-muted-foreground truncate">
                          {s.info}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </aside>
      )}

      {/* Contenido principal */}
      <div className="flex-1">
        <Card>
          {/* <CardHeader className="text-center sm:text-left space-y-2 bg-gradient-to-r from-primary/5 to-transparent rounded-t-2xl p-6 border-b border-border/40">
  <CardTitle className="flex items-center gap-2 text-2xl font-semibold text-foreground tracking-tight">
    <CalendarDays className="w-6 h-6 text-primary" />
    Reserva tu sala
  </CardTitle>
  <CardDescription className="text-base text-muted-foreground leading-relaxed">
    Completa el formulario para reservar tu sala de escape
  </CardDescription>
</CardHeader> */}

          <CardContent>
            {/* Paso 1: Sala */}
            {step === 1 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="text-center sm:text-left">
                  <h2 className="text-2xl font-semibold text-primary tracking-tight flex items-center gap-2">
                    <DoorOpen className="w-6 h-6 text-primary/80" />
                    Selecciona una sala
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Elige una de las salas disponibles para tu reserva
                  </p>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {rooms.map((r) => {
                    const selected = roomId === r._id;
                    return (
                      <Card
                        key={r._id}
                        onClick={() => {
                          setRoomId(r._id);
                          goNext(2);
                        }}
                        className={cn(
                          "relative cursor-pointer overflow-hidden rounded-2xl border transition-all duration-300 ease-out group py-0",
                          selected
                            ? "border-primary/60 bg-primary/10 shadow-xl scale-[1.02]"
                            : "border-muted/30 hover:border-primary/40 hover:shadow-lg hover:scale-[1.01]"
                        )}
                      >
                        {/* Imagen con overlay */}
                        <div className="relative h-44 overflow-hidden">
                          {r.imageUrl ? (
                            <img
                              src={r.imageUrl}
                              alt={r.name}
                              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center bg-muted text-muted-foreground">
                              <DoorOpen className="w-8 h-8" />
                            </div>
                          )}

                          {/* Overlay degradado */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />


                        </div>

                        {/* Contenido */}
                        <CardContent className="relative z-10 p-5 dark:bg-slate-900/50 rounded-b-2xl">
                          <div className="flex items-center justify-between mb-1">
                            <p
                              className={cn(
                                "font-semibold text-lg tracking-tight truncate",
                                selected && "text-primary"
                              )}
                            >
                              {r.name}
                            </p>
                            {selected && (
                              <CheckCircle2 className="w-5 h-5 text-primary animate-pulse" />
                            )}
                          </div>

                          <p className="text-sm text-muted-foreground mb-3">
                            {r.capacityMin}–{r.capacityMax} jugadores
                          </p>


                        </CardContent>

                        {/* Efecto glow al seleccionar */}
                        {selected && (
                          <div className="absolute inset-0 rounded-2xl ring-2 ring-primary/50 shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)] pointer-events-none" />
                        )}
                      </Card>

                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Paso 2: Jugadores */}
            {step === 2 && selectedRoom && (
              <motion.div initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
                <div className="text-center sm:text-left mb-5">
                  <h2 className="text-2xl font-semibold text-primary tracking-tight flex items-center gap-2">
                    <DoorOpen className="w-6 h-6 text-primary/80" />
                    ¿Cuántos jugadores?
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Selecciona el número de jugadores para tu reserva
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {selectedRoom.priceTable.map((p) => {
                    const pricePerPlayer = (p.price / p.players).toFixed(2);
                    return (
                      <Card
                        key={p.players}
                        className={cn(
                          "cursor-pointer hover:shadow-md transition-all border-primary/20 hover:border-primary/50",
                          players === p.players && "border-primary bg-primary/5"
                        )}
                        onClick={() => {
                          setPlayers(p.players);
                          goNext(3);
                        }}
                      >
                        <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                          <p className="font-semibold text-lg">{p.players} jugadores</p>
                          <p className="text-sm text-muted-foreground">
                            Precio total: <span className="font-medium">{p.price} €</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            <span className="italic">≈ {pricePerPlayer} €/jugador</span>
                          </p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Paso 3: Fecha y hora */}
            {step === 3 && selectedRoom && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="text-center sm:text-left mb-5">
                  <h2 className="text-2xl font-semibold text-primary tracking-tight flex items-center gap-2">
                    <DoorOpen className="w-6 h-6 text-primary/80" />
                    Elige fecha y hora
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Selecciona la fecha y hora para tu reserva
                  </p>
                </div>
                <div className="max-w-md mx-auto">
                  <Calendar
                    mode="single"
                    selected={date || undefined}
                    onSelect={(d) => setDate(d || null)}
                    className="rounded-lg border shadow-md w-full p-2"
                    modifiers={{
                      green: (d) => getDayStatus(d) === "green",
                      yellow: (d) => getDayStatus(d) === "yellow",
                      red: (d) => getDayStatus(d) === "red",
                      disabled: (d) => getDayStatus(d) === "disabled",
                    }}
                    modifiersClassNames={{
                      green: "bg-green-100 text-green-800 rounded-md hover:bg-green-200 md:m-1 m-0.5",
                      yellow: "bg-yellow-100 text-yellow-800 rounded-md hover:bg-yellow-200 md:m-1 m-0.5",
                      red: "bg-red-100 text-red-800 rounded-md md:m-1 m-0.5",
                      disabled: "opacity-40 pointer-events-none md:m-1 m-0.5",
                    }}
                  />
                </div>
                <div className="hidden md:flex mt-6 flex-wrap items-center justify-center gap-6 rounded-xl bg-muted/30 px-6 py-4 shadow-sm border border-border/50">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-md bg-green-400/80 shadow-sm ring-1 ring-green-600/40" />
                    <span className="text-sm text-muted-foreground font-medium">Todas disponibles</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-md bg-yellow-300/80 shadow-sm ring-1 ring-yellow-600/40" />
                    <span className="text-sm text-muted-foreground font-medium">Algunas libres</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-md bg-red-400/80 shadow-sm ring-1 ring-red-600/40" />
                    <span className="text-sm text-muted-foreground font-medium">No quedan / Cerrado</span>
                  </div>
                </div>


                {date && (
                  <div className="mt-6 max-w-lg mx-auto">
                    <h3 className="font-medium mb-2">Selecciona una hora:</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {getSlotsForDate(selectedRoom, date).map((slot: any) => {
                        const start = slot.start;
                        const dayStr = date.toLocaleDateString("sv-SE");
                        const reserved = (reservationsByDay[dayStr] || []).some((r) =>
                          overlaps(r.start, r.end, slot.start, slot.end)
                        );
                        return (
                          <Button
                            key={start}
                            variant={reserved ? "secondary" : "outline"}
                            disabled={reserved}
                            onClick={() => {
                              if (!reserved) {
                                setSlot(start);
                                goNext(4);
                              }
                            }}
                          >
                            {start}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Paso 4: Datos */}
            {step === 4 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="max-w-3xl mx-auto"
              >
                <h2 className="text-2xl font-semibold text-primary mb-2 flex items-center gap-2">
                  <UserCog className="w-6 h-6 text-primary/80" />
                  Tus datos
                </h2>
                <p className="text-muted-foreground mb-6 text-sm">
                  Completa tus datos personales para confirmar la reserva
                </p>

                <Card className="p-4 md:p-6 border border-border/50 bg-card/70 backdrop-blur-sm shadow-sm rounded-2xl">
                  <Form {...form}>
                    <form
                      onSubmit={form.handleSubmit(onSubmit)}
                      className="space-y-6"
                    >
                      {/* Nombre y Apellidos */}
                      <div className="grid sm:grid-cols-2 gap-5">
                        <FormField
                          control={form.control}
                          name="firstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">Nombre *</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="Tu nombre"
                                  className="h-10 rounded-md border border-border/50 focus:ring-2 focus:ring-primary/30 transition"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="lastName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">Apellidos *</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="Tus apellidos"
                                  className="h-10 rounded-md border border-border/50 focus:ring-2 focus:ring-primary/30 transition"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Email y Teléfono */}
                      <div className="grid sm:grid-cols-2 gap-5">
                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">Email *</FormLabel>
                              <FormControl>
                                <Input
                                  type="email"
                                  {...field}
                                  placeholder="ejemplo@correo.com"
                                  className="h-10 rounded-md border border-border/50 focus:ring-2 focus:ring-primary/30 transition"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">Teléfono *</FormLabel>
                              <FormControl>
                                <Input
                                  type="tel"
                                  {...field}
                                  placeholder="600 123 456"
                                  className="h-10 rounded-md border border-border/50 focus:ring-2 focus:ring-primary/30 transition"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Notas */}
                      <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              Observaciones o detalles (edad, evento, etc.)
                            </FormLabel>
                            <FormControl>
                              <Textarea
                                rows={3}
                                {...field}
                                placeholder="Ejemplo: cumpleaños de 12 años, grupo de 6 jugadores..."
                                className="rounded-md border border-border/50 focus:ring-2 focus:ring-primary/30 transition resize-none"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Checkbox privacidad */}
                      <FormField
                        control={form.control}
                        name="acceptPrivacy"
                        render={({ field }) => (
                          <FormItem className="flex items-start gap-3">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                className="mt-1 data-[state=checked]:bg-primary data-[state=checked]:text-white transition"
                              />
                            </FormControl>
                            <FormLabel className="block text-sm text-muted-foreground leading-relaxed max-w-2xl">
                              Acepto la{" "}
                              <a
                                href="/privacidad"
                                target="_blank"
                                className="underline text-primary hover:text-primary/80"
                              >
                                política de privacidad
                              </a>
                              , y consiento el tratamiento de mis datos personales con la finalidad de
                              gestionar mi reserva y la comunicación relacionada con la misma.
                            </FormLabel>

                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button
                        type="button"
                        onClick={async () => {
                          const isValid = await form.trigger(); // valida el formulario
                          if (isValid) goNext(5);
                        }}
                        className="w-full py-5 text-base font-medium shadow-md hover:shadow-lg transition"
                      >
                        Siguiente
                      </Button>

                    </form>
                  </Form>
                </Card>
              </motion.div>
            )}

            {/* Paso 5: Resumen */}
            {/* Paso 5: Resumen */}
{step === 5 && selectedRoom && date && slot && (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    className="max-w-2xl mx-auto text-center"
  >
    <div className="flex flex-col items-center mb-6">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/10 text-blue-600 mb-3">
        <FileText className="w-10 h-10" />
      </div>
      <h2 className="text-2xl font-semibold text-blue-600">
        Revisa tu reserva
      </h2>
      <p className="text-sm text-muted-foreground mt-1">
        Comprueba que todos los datos son correctos antes de confirmar.
      </p>
    </div>

    <Card className="border border-border/40 shadow-sm bg-card/70 backdrop-blur-sm rounded-2xl text-left">
      <CardContent className="p-6 space-y-3 text-sm">
        <div className="grid sm:grid-cols-2 gap-y-3 gap-x-6">
          <p className="flex items-center gap-2">
            <DoorOpen className="w-4 h-4 text-muted-foreground" />
            <strong>Sala:</strong>{" "}
            <span className="text-muted-foreground">{selectedRoom.name}</span>
          </p>

          <p className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-muted-foreground" />
            <strong>Fecha:</strong>{" "}
            <span className="text-muted-foreground">
              {date.toLocaleDateString("es-ES")}
            </span>
          </p>

          <p className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <strong>Hora:</strong>{" "}
            <span className="text-muted-foreground">{slot}</span>
          </p>

          <p className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <strong>Jugadores:</strong>{" "}
            <span className="text-muted-foreground">{players}</span>
          </p>

          {/* 🔹 Precio total */}
          <p className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <strong>Precio total:</strong>{" "}
            <span className="text-muted-foreground">
              {(
                selectedRoom.priceTable.find((p) => p.players === players)?.price ?? 0
              ).toFixed(2)}{" "}
              €
            </span>
          </p>

          <p className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            <strong>Nombre:</strong>{" "}
            <span className="text-muted-foreground">
              {form.getValues("firstName")} {form.getValues("lastName")}
            </span>
          </p>

          <p className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <strong>Email:</strong>{" "}
            <span className="text-muted-foreground">
              {form.getValues("email")}
            </span>
          </p>

          <p className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-muted-foreground" />
            <strong>Teléfono:</strong>{" "}
            <span className="text-muted-foreground">
              {form.getValues("phone")}
            </span>
          </p>

          {form.getValues("notes") && (
            <p className="sm:col-span-2 flex items-start gap-2">
              <MessageSquare className="w-4 h-4 text-muted-foreground mt-1" />
              <span>
                <strong>Notas:</strong>{" "}
                <span className="text-muted-foreground">
                  {form.getValues("notes")}
                </span>
              </span>
            </p>
          )}
        </div>
      </CardContent>
    </Card>

    <div className="flex justify-center gap-4 mt-8">
      <Button
        variant="secondary"
        onClick={() => goToStep(4)}
        className="flex items-center gap-2"
      >
        <RotateCcw className="w-4 h-4" />
        Volver
      </Button>

      <Button
        onClick={() => onSubmit(form.getValues())}
        className="flex items-center gap-2"
      >
        <CheckCircle2 className="w-4 h-4" />
        Confirmar reserva
      </Button>
    </div>
  </motion.div>
)}




            {/* Paso 5: Confirmación */}
            {step === 6 && confirmedReservation && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="text-center max-w-xl mx-auto"
              >
                {/* Header */}
                <div className="flex flex-col items-center mb-6">
                  <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 text-green-600 mb-3">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <h2 className="text-2xl font-bold text-green-600">
                    ¡Reserva confirmada!
                  </h2>
                  <p className="text-muted-foreground text-sm mt-1">
                    Hemos recibido tu reserva correctamente. A continuación verás los detalles.
                  </p>
                </div>

                {/* Tarjeta con detalles */}
                <Card className="border border-border/40 shadow-sm bg-card/70 backdrop-blur-sm rounded-2xl">
                  <CardContent className="p-6 text-left text-sm space-y-3">
                    <div className="grid sm:grid-cols-2 gap-y-3 gap-x-6">
                      {/* <p className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <strong>Localizador:</strong>{" "}
                        <span className="text-muted-foreground">{confirmedReservation._id}</span>
                      </p> */}

                      <p className="flex items-center gap-2">
                        <DoorOpen className="w-4 h-4 text-muted-foreground" />
                        <strong>Sala:</strong>{" "}
                        <span className="text-muted-foreground">{confirmedReservation.room?.name}</span>
                      </p>

                      <p className="flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-muted-foreground" />
                        <strong>Fecha:</strong>{" "}
                        <span className="text-muted-foreground">
                          {new Date(confirmedReservation.date).toLocaleDateString()}
                        </span>
                      </p>

                      <p className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <strong>Hora:</strong>{" "}
                        <span className="text-muted-foreground">
                          {confirmedReservation.start} – {confirmedReservation.end}
                        </span>
                      </p>

                      <p className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <strong>Jugadores:</strong>{" "}
                        <span className="text-muted-foreground">{confirmedReservation.players}</span>
                      </p>
                      <p className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <strong>Precio total:</strong>{" "}
                        <span className="text-muted-foreground">
                          {(
                            confirmedReservation.room?.priceTable.find(
                              (p) => p.players === confirmedReservation.players
                            )?.price ?? 0
                          ).toFixed(2)}{" "}
                          €
                        </span>
                      </p>
                      <p className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <strong>Cliente:</strong>{" "}
                        <span className="text-muted-foreground">{confirmedReservation.customer.name}</span>
                      </p>

                      <p className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <strong>Email:</strong>{" "}
                        <span className="text-muted-foreground">{confirmedReservation.customer.email}</span>
                      </p>

                      <p className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <strong>Teléfono:</strong>{" "}
                        <span className="text-muted-foreground">{confirmedReservation.customer.phone}</span>
                      </p>

                      {confirmedReservation.notes && (
                        <p className="sm:col-span-2 flex items-start gap-2">
                          <MessageSquare className="w-4 h-4 text-muted-foreground mt-1" />
                          <span>
                            <strong>Notas/Información:</strong>{" "}
                            <span className="text-muted-foreground">{confirmedReservation.notes}</span>
                          </span>
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Botones de acción */}
                <div className="flex flex-wrap justify-center gap-4 mt-8">
                  <Button
                    onClick={() => {
                      const fecha = new Date(confirmedReservation.date).toLocaleDateString("es-ES", {
                        weekday: "long",
                        day: "2-digit",
                        month: "long",
                      });

                      const precio = (
                        confirmedReservation.room?.priceTable.find(
                          (p) => p.players === confirmedReservation.players
                        )?.price ?? 0
                      ).toFixed(2);

                      // Usa emojis normales aquí — no codificados
                      const mensaje = [
                        "🎉 *¡Reserva confirmada!*",
                        `🏠 *Sala:* ${confirmedReservation.room?.name}`,
                        `📅 *Fecha:* ${fecha}`,
                        `⏰ *Hora:* ${confirmedReservation.start} – ${confirmedReservation.end}`,
                        `👥 *Jugadores:* ${confirmedReservation.players}`,
                        `💶 *Precio total:* ${precio} €`,
                        "",
                        "¡Nos vemos pronto en el escape room! 🔐",
                      ].join("\n");

                      // Codificamos todo el texto una sola vez
                      const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje.trim())}`;
                      window.open(url, "_blank");
                    }}
                    className="bg-green-500 hover:bg-green-600 text-white flex items-center gap-2 px-5 py-2.5 rounded-md shadow-md transition-all"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Enviar por WhatsApp
                  </Button>





                  {/* <Button variant="outline" className="flex items-center gap-2">
                    <FileDown className="w-4 h-4" />
                    Descargar PDF
                  </Button> */}

                  <Button
                    variant="secondary"
                    onClick={resetWizard}
                    className="flex items-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Nueva reserva
                  </Button>
                </div>
              </motion.div>
            )}

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
