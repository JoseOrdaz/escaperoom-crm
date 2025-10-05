// "use client";

// import { useEffect, useMemo, useState } from "react";
// import { toast } from "sonner";
// import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Textarea } from "@/components/ui/textarea";
// import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
// import { Form, FormField, FormItem, FormLabel, FormMessage, FormControl } from "@/components/ui/form";
// import { z } from "zod";
// import { useForm } from "react-hook-form";
// import { zodResolver } from "@hookform/resolvers/zod";

// /* ============ Tipos compatibles con tus páginas ============ */
// type TimeSlot = { start: string; end: string };
// type WeekTemplate = {
//   monday: TimeSlot[]; tuesday: TimeSlot[]; wednesday: TimeSlot[];
//   thursday: TimeSlot[]; friday: TimeSlot[]; saturday: TimeSlot[]; sunday: TimeSlot[];
// };
// type Room = {
//   _id: string; name: string; durationMinutes: number;
//   capacityMin: number; capacityMax: number;
//   priceTable: { players:number; price:number }[];
//   schedule: { template: WeekTemplate; daysOff: {date:string}[]; overrides: {date:string; slots:TimeSlot[]}[] };
// };
// type Customer = { _id: string; name: string; email: string; phone?: string };

// export type ReservationForEdit = {
//   _id: string;
//   roomId: string;
//   start: string; // ISO
//   end: string;   // ISO
//   players: number;
//   language: "es" | "en" | "ru";
//   description?: string;
//   notes?: string; // extraInfo
//   customer?: { id?: string; name?: string; email?: string; phone?: string };
// };

// type Props = {
//   open: boolean;
//   onOpenChange: (open: boolean) => void;
//   /** La reserva a editar (requerido para modo edición) */
//   reservation: ReservationForEdit | null;
//   /** callback tras guardar con éxito (por ejemplo, refrescar tabla/lista) */
//   onSaved?: (updatedId: string) => void | Promise<void>;
//   /** Puedes pasar rooms desde fuera para evitar fetch aquí */
//   rooms?: Room[];
//   /** Opcional: listado de clientes si quieres permitir cambiar el cliente */
//   customers?: Customer[];
//   /** Mostrar/ocultar el selector de cliente (por defecto false) */
//   enableCustomerSelect?: boolean;
// };

// /* ================= Helpers ================= */
// const HHMM = /^\d{2}:\d{2}$/;
// const pad = (n:number)=>String(n).padStart(2,"0");
// const hhmmFromISO = (iso: string) => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
// const ymdFromISO  = (iso: string) => new Date(iso).toISOString().slice(0,10);
// const dayKeys = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"] as const;
// const looksHex24 = (v: string) => /^[a-f0-9]{24}$/i.test(v);

// function normSlots(a?: TimeSlot[] | null) {
//   return (Array.isArray(a)?a:[]).filter(s => HHMM.test(s.start) && HHMM.test(s.end) && s.start < s.end);
// }
// function getDayKeyFromDate(dateStr: string) {
//   const d = new Date(`${dateStr}T00:00:00`);
//   return dayKeys[d.getDay()];
// }
// function getSlotsForDate(room: Room, dateStr: string): TimeSlot[] {
//   const schedule = room.schedule ?? {};
//   const isDayOff = Array.isArray(schedule.daysOff) && schedule.daysOff.some((d: any) => d?.date === dateStr);
//   if (isDayOff) return [];
//   const ov = (Array.isArray(schedule.overrides) ? schedule.overrides : []).find((o: any) => o?.date === dateStr);
//   if (ov) return normSlots(ov.slots);
//   const key = getDayKeyFromDate(dateStr) as keyof WeekTemplate;
//   return normSlots(schedule?.template?.[key]);
// }
// function priceForPlayers(room: Room, players: number) {
//   const row = room.priceTable?.find((p) => Number(p.players) === Number(players));
//   return row ? Number(row.price) : 0;
// }

// /* ================= Schema del form ================= */
// const editSchema = z.object({
//   id: z.string().min(1),
//   roomId: z.string().min(1, "Selecciona sala"),
//   date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
//   slot: z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}(#\d+)?$/, "Franja inválida"),
//   players: z.coerce.number().int().min(1, "Selecciona jugadores"),
//   language: z.enum(["es","en","ru"]).default("es"),
//   description: z.string().max(140).optional(),
//   notes: z.string().max(1000).optional(),
//   customerSelectId: z.string().optional(), // solo si enableCustomerSelect
// });
// type EditValues = z.infer<typeof editSchema>;

// export default function ReservationEditorDialog({
//   open,
//   onOpenChange,
//   reservation,
//   onSaved,
//   rooms: roomsProp,
//   customers = [],
//   enableCustomerSelect = false,
// }: Props) {
//   /* Rooms (usa las que vengan por props o haz fetch) */
//   const [roomsLocal, setRoomsLocal] = useState<Room[]>([]);
//   const [loadingRooms, setLoadingRooms] = useState(false);

//   useEffect(() => {
//     if (roomsProp && roomsProp.length) return; // ya vienen por props
//     (async () => {
//       setLoadingRooms(true);
//       try {
//         const res = await fetch("/api/rooms", { cache:"no-store" });
//         if (!res.ok) throw new Error(await res.text());
//         setRoomsLocal(await res.json());
//       } catch(e:any) {
//         toast.error("No se pudieron cargar salas", { description:String(e) });
//       } finally {
//         setLoadingRooms(false);
//       }
//     })();
//   }, [roomsProp]);

//   const rooms = useMemo(() => roomsProp?.length ? roomsProp : roomsLocal, [roomsProp, roomsLocal]);

//   /* Form */
//   const form = useForm<EditValues>({
//     resolver: zodResolver(editSchema),
//     defaultValues: {
//       id: "",
//       roomId: "",
//       date: new Date().toISOString().slice(0,10),
//       slot: "",
//       players: 1,
//       language: "es",
//       description: "",
//       notes: "",
//       customerSelectId: "",
//     },
//     mode: "onBlur",
//   });

//   const watchRoomId = form.watch("roomId");
//   const watchDate   = form.watch("date");
//   const watchPlayers= form.watch("players");
//   const selectedRoom = useMemo(() => rooms.find(r => r._id === watchRoomId), [rooms, watchRoomId]);

//   /* Opciones jugadores */
//   const playerOptions = useMemo(() => {
//     const base = (selectedRoom?.priceTable ?? []).slice().sort((a,b)=>a.players-b.players);
//     return base.map(r => ({
//       players: r.players,
//       label: `${r.players} (${new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(r.price)})`,
//     }));
//   }, [selectedRoom]);

//   /* Slots del día */
//   const [slotOptions, setSlotOptions] = useState<Array<TimeSlot & { _id: string }>>([]);
//   useEffect(() => {
//     if (!selectedRoom || !watchDate) { setSlotOptions([]); form.setValue("slot",""); return; }
//     const raw = getSlotsForDate(selectedRoom, watchDate);
//     const withIds = raw.map((s,i)=>({ ...s, _id:`${s.start}-${s.end}#${i}` }));
//     setSlotOptions(withIds);
//     const current = form.getValues("slot");
//     const exists = withIds.some(s => s._id === current);
//     form.setValue("slot", exists ? current : (withIds[0]?._id ?? ""));
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [selectedRoom, watchDate]);

//   /* Ajuste jugadores si cambias sala */
//   useEffect(() => {
//     if (!selectedRoom) return;
//     const current = form.getValues("players");
//     const exists = playerOptions.some(o => o.players === Number(current));
//     const nextPlayers = exists ? Number(current) : (playerOptions[0]?.players ?? selectedRoom.capacityMin);
//     form.setValue("players", nextPlayers, { shouldDirty:true });
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [selectedRoom, JSON.stringify(playerOptions)]);

//   const computedPrice = useMemo(() => selectedRoom ? priceForPlayers(selectedRoom, Number(watchPlayers)||0) : 0, [selectedRoom, watchPlayers]);

//   /* Sincroniza el form cuando cambia la reserva */
//   useEffect(() => {
//     if (!reservation) return;
//     const date = ymdFromISO(reservation.start);
//     const start = hhmmFromISO(reservation.start);
//     const end   = hhmmFromISO(reservation.end);

//     const r = rooms.find(rr => rr._id === reservation.roomId);
//     let slotId = "";
//     if (r) {
//       const raw = getSlotsForDate(r, date);
//       const withIds = raw.map((s,i)=>({ ...s, _id:`${s.start}-${s.end}#${i}` }));
//       setSlotOptions(withIds);
//       slotId = (withIds.find(s => s.start===start && s.end===end)?. _id) ?? (withIds[0]?._id ?? "");
//     } else {
//       setSlotOptions([]);
//     }

//     const allowedPlayers = (r?.priceTable ?? []).map(p => p.players);
//     const players = allowedPlayers.includes(reservation.players) ? reservation.players : (allowedPlayers[0] ?? reservation.players);

//     form.reset({
//       id: reservation._id,
//       roomId: reservation.roomId,
//       date,
//       slot: slotId,
//       players,
//       language: reservation.language,
//       description: reservation.description ?? "",
//       notes: reservation.notes ?? "",
//       customerSelectId: reservation.customer?.id ?? "",
//     });
//   // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [reservation, rooms]);

//   /* Guardar */
//   async function submitEdit(values: EditValues) {
//     if (!values.id) return;
//     const t = toast.loading("Guardando cambios…");
//     try {
//       const [startRaw, endPart] = String(values.slot).split("-");
//       const start = (startRaw ?? "").trim();
//       const end   = (endPart ?? "").split("#")[0].trim();

//       const body: any = {
//         roomId: values.roomId,
//         date: values.date,
//         start,
//         end,
//         players: values.players,
//         language: values.language,
//         description: values.description ?? "",
//         notes: values.notes ?? "",
//       };

//       // Selector de cliente opcional
//       if (enableCustomerSelect && values.customerSelectId) {
//         if (looksHex24(values.customerSelectId)) body.customerId = values.customerSelectId;
//         // si quieres pasar además los datos visibles:
//         const c = customers.find(x => String(x._id) === String(values.customerSelectId));
//         if (c) {
//           if (c.name)  body.customerName  = c.name;
//           if (c.email) body.customerEmail = c.email;
//           if (c.phone) body.customerPhone = c.phone;
//         }
//       }

//       const res = await fetch(`/api/reservations/${values.id}`, {
//         method:"PATCH",
//         headers:{ "Content-Type":"application/json" },
//         body: JSON.stringify(body),
//       });
//       const json = await res.json().catch(()=>({}));
//       if (!res.ok) throw new Error(json?.error || JSON.stringify(json));

//       toast.success("Reserva actualizada",{ id:t });
//       onOpenChange(false);
//       if (onSaved) await onSaved(values.id);
//     } catch(e:any) {
//       toast.error("No se pudo actualizar",{ id:t, description: e?.message ?? "Inténtalo de nuevo" });
//     }
//   }

//   return (
//     <Dialog open={open} onOpenChange={onOpenChange}>
//       <DialogContent className="max-w-lg">
//         <DialogHeader>
//           <DialogTitle>Editar reserva</DialogTitle>
//           <DialogDescription>Modifica los datos y guarda los cambios.</DialogDescription>
//         </DialogHeader>

//         <Form {...form}>
//           <form className="space-y-4" onSubmit={form.handleSubmit(submitEdit)}>
//             <input type="hidden" {...form.register("id")} />

//             {/* Sala */}
//             <FormField control={form.control} name="roomId" render={({ field }) => (
//               <FormItem className="w-full">
//                 <FormLabel>Sala *</FormLabel>
//                 <Select value={field.value} onValueChange={field.onChange} disabled={loadingRooms || rooms.length===0}>
//                   <FormControl><SelectTrigger className="w-full"><SelectValue placeholder={loadingRooms ? "Cargando…" : "Selecciona sala"} /></SelectTrigger></FormControl>
//                   <SelectContent>{rooms.map(r => <SelectItem key={r._id} value={r._id}>{r.name}</SelectItem>)}</SelectContent>
//                 </Select>
//                 <FormMessage />
//               </FormItem>
//             )} />

//             {/* Jugadores */}
//             <FormField control={form.control} name="players" render={({ field }) => (
//               <FormItem className="w-full">
//                 <FormLabel>Jugadores *</FormLabel>
//                 <Select value={String(field.value)} onValueChange={(v)=>field.onChange(Number(v))} disabled={!selectedRoom || playerOptions.length===0}>
//                   <FormControl><SelectTrigger className="w-full"><SelectValue placeholder={playerOptions.length ? "Selecciona" : "Configura precios en la sala"} /></SelectTrigger></FormControl>
//                   <SelectContent>{playerOptions.map(p => <SelectItem key={p.players} value={String(p.players)}>{p.label}</SelectItem>)}</SelectContent>
//                 </Select>
//                 {selectedRoom && (
//                   <p className="text-xs text-muted-foreground">
//                     Precio calculado: <span className="font-medium">
//                       {new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(computedPrice)}
//                     </span> · Capacidad {selectedRoom.capacityMin}–{selectedRoom.capacityMax}
//                   </p>
//                 )}
//                 <FormMessage />
//               </FormItem>
//             )} />

//             {/* Fecha */}
//             <FormField control={form.control} name="date" render={({ field }) => (
//               <FormItem className="w-full">
//                 <FormLabel>Fecha *</FormLabel>
//                 <FormControl><Input type="date" className="w-full" {...field} /></FormControl>
//                 <FormMessage />
//               </FormItem>
//             )} />

//             {/* Franja */}
//             <FormField control={form.control} name="slot" render={({ field }) => (
//               <FormItem className="w-full">
//                 <FormLabel>Hora *</FormLabel>
//                 <Select value={field.value} onValueChange={field.onChange} disabled={!selectedRoom || slotOptions.length===0}>
//                   <FormControl><SelectTrigger className="w-full"><SelectValue placeholder={slotOptions.length ? "Selecciona franja" : "No hay franjas"} /></SelectTrigger></FormControl>
//                   <SelectContent>{slotOptions.map(s => <SelectItem key={s._id} value={s._id}>{s.start}–{s.end}</SelectItem>)}</SelectContent>
//                 </Select>
//                 <FormMessage />
//               </FormItem>
//             )} />

//             {/* Idioma */}
//             <FormField control={form.control} name="language" render={({ field }) => (
//               <FormItem className="w-full">
//                 <FormLabel>Idioma *</FormLabel>
//                 <Select value={field.value} onValueChange={field.onChange}>
//                   <FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl>
//                   <SelectContent>
//                     <SelectItem value="es">Español</SelectItem>
//                     <SelectItem value="en">Inglés</SelectItem>
//                     <SelectItem value="ru">Ruso</SelectItem>
//                   </SelectContent>
//                 </Select>
//                 <FormMessage />
//               </FormItem>
//             )} />

//             {/* Cliente (opcional) */}
//             {enableCustomerSelect && (
//               <FormField control={form.control} name="customerSelectId" render={({ field }) => (
//                 <FormItem className="w-full">
//                   <FormLabel>Cliente</FormLabel>
//                   <Select value={field.value ?? ""} onValueChange={field.onChange} disabled={customers.length===0}>
//                     <FormControl><SelectTrigger className="w-full"><SelectValue placeholder={customers.length ? "Seleccionar cliente" : "Aún no hay clientes"} /></SelectTrigger></FormControl>
//                     <SelectContent>{customers.map(c => <SelectItem key={c._id} value={c._id}>{c.name} — {c.email}</SelectItem>)}</SelectContent>
//                   </Select>
//                   <FormMessage />
//                 </FormItem>
//               )} />
//             )}

//             {/* Descripción / Notas */}
//             <FormField control={form.control} name="description" render={({ field }) => (
//               <FormItem className="w-full">
//                 <FormLabel>Descripción (opcional)</FormLabel>
//                 <FormControl><Input className="w-full" placeholder="p. ej., Cumpleaños / Empresa / Grupo familiar…" {...field} /></FormControl>
//                 <FormMessage />
//               </FormItem>
//             )} />
//             <FormField control={form.control} name="notes" render={({ field }) => (
//               <FormItem className="w-full">
//                 <FormLabel>Información extra</FormLabel>
//                 <FormControl><Textarea rows={4} className="w-full" placeholder="¿Son adultos o menores? ¿Edades? ¿Evento?…" {...field} /></FormControl>
//                 <FormMessage />
//               </FormItem>
//             )} />

//             <DialogFooter className="pt-2">
//               <Button
//                 type="submit"
//                 className="w-full sm:w-auto"
//                 disabled={loadingRooms || !selectedRoom || playerOptions.length===0 || slotOptions.length===0 || !form.watch("slot")}
//               >
//                 Guardar cambios
//               </Button>
//             </DialogFooter>
//           </form>
//         </Form>
//       </DialogContent>
//     </Dialog>
//   );
// }
