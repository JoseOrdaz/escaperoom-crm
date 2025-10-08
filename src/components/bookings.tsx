"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import confetti from "canvas-confetti";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { CheckCircle2 } from "lucide-react";

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
    errorMap: () => ({ message: "Debes aceptar la política de privacidad" }),
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
          // description: "",
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
        description: json?._id ? `Localizador #${json._id}` : undefined,
      });

      goNext(5);
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
    { label: "Confirmación", info: "" },
  ];

  return (
    <div className="mx-auto max-w-6xl p-6 flex gap-8">
      {step < 5 && (
        <div className="w-64">
          <ul className="space-y-4">
            {steps.map((s, i) => {
              const index = i + 1;
              const active = step === index;
              const done = completedSteps.includes(index);
              return (
                <li
                  key={s.label}
                  onClick={() => goToStep(index)}
                  className={cn(
                    "flex flex-col border-l-2 pl-3 transition-colors cursor-pointer",
                    active && "border-primary text-primary font-semibold",
                    done && "border-green-500 text-green-600 hover:text-primary"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {done ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : (
                      <span className="w-4 h-4 rounded-full border flex items-center justify-center text-xs">
                        {index}
                      </span>
                    )}
                    <span>{s.label}</span>
                  </div>
                  {s.info && (
                    <span className="ml-7 text-xs text-muted-foreground truncate">{s.info}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Contenido principal */}
      <div className="flex-1">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-bold">Reserva tu sala</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Paso 1: Sala */}
            {step === 1 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h2 className="font-bold text-lg">Selecciona una sala</h2>
                <div className="grid sm:grid-cols-3 gap-4 mt-4">
                  {rooms.map((r) => (
                    <Card
                      key={r._id}
                      className="cursor-pointer hover:shadow-lg border-primary/30"
                      onClick={() => {
                        setRoomId(r._id);
                        goNext(2);
                      }}
                    >
                      <CardContent className="p-4">
                        {r.imageUrl && (
                          <img src={r.imageUrl} alt={r.name} className="rounded-md mb-2" />
                        )}
                        <p className="font-medium">{r.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {r.capacityMin}–{r.capacityMax} jugadores
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Paso 2: Jugadores */}
            {step === 2 && selectedRoom && (
              <motion.div initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
                <h2 className="font-bold text-lg mb-4">¿Cuántos jugadores?</h2>
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
                <h2 className="font-bold text-lg mb-4 text-center">Elige fecha y hora</h2>
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
                      green: "bg-green-100 text-green-800 rounded-md hover:bg-green-200 m-1",
                      yellow: "bg-yellow-100 text-yellow-800 rounded-md hover:bg-yellow-200 m-1",
                      red: "bg-red-100 text-red-800 rounded-md m-1",
                      disabled: "opacity-40 pointer-events-none m-1",
                    }}
                  />
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-center gap-6 rounded-xl bg-muted/30 px-6 py-4 shadow-sm border border-border/50">
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
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h2 className="font-bold text-lg mb-4">Tus datos</h2>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nombre *</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Apellidos *</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email *</FormLabel>
                            <FormControl><Input type="email" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Teléfono *</FormLabel>
                            <FormControl><Input type="tel" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>¿Son adultos o menores?, ¿Cuántos años tienen los menores?, ¿Es para un evento?, etc...</FormLabel>
                          <FormControl><Textarea rows={3} {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="acceptPrivacy"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel className="font-normal">
                            Acepto la{" "}
                            <a href="/privacidad" target="_blank" className="underline">
                              política de privacidad
                            </a>
                          </FormLabel>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full">
                      Confirmar reserva
                    </Button>
                  </form>
                </Form>
              </motion.div>
            )}

            {/* Paso 5: Confirmación */}
            {step === 5 && confirmedReservation && (
              <motion.div initial={{ opacity: 0.9 }} animate={{ opacity: 1 }}>
                <h2 className="text-center text-2xl font-bold text-green-600">
                  🎉 ¡Reserva confirmada!
                </h2>
                <Card className="mt-4">
                  <CardContent className="space-y-2 p-4 text-sm">
                    <p><strong>Localizador:</strong> {confirmedReservation._id}</p>
                    <p><strong>Sala:</strong> {confirmedReservation.room?.name}</p>
                    <p><strong>Fecha:</strong> {new Date(confirmedReservation.date).toLocaleDateString()}</p>
                    <p><strong>Hora:</strong> {confirmedReservation.start} – {confirmedReservation.end}</p>
                    <p><strong>Jugadores:</strong> {confirmedReservation.players}</p>
                    <p><strong>Cliente:</strong> {confirmedReservation.customer.name}</p>
                    <p><strong>Email:</strong> {confirmedReservation.customer.email}</p>
                    <p><strong>Teléfono:</strong> {confirmedReservation.customer.phone}</p>
                    {confirmedReservation.notes && <p><strong>Notas:</strong> {confirmedReservation.notes}</p>}
                  </CardContent>
                </Card>
                <div className="flex justify-center gap-4 mt-6">
                  <Button
                    onClick={() =>
                      window.open(
                        `https://wa.me/?text=Reserva confirmada en ${confirmedReservation.room?.name
                        } el ${new Date(
                          confirmedReservation.date
                        ).toLocaleDateString()} a las ${confirmedReservation.start
                        }. Localizador: ${confirmedReservation._id}`
                      )
                    }
                  >
                    WhatsApp
                  </Button>
                  <Button variant="outline">Descargar PDF</Button>
                  <Button variant="secondary" onClick={resetWizard}>
                    Hacer otra reserva
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
