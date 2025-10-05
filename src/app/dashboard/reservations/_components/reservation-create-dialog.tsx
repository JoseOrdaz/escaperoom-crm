// src/app/dashboard/reservations/_components/reservation-create-dialog.tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { generateStartTimesForDate, priceForPlayers, type RoomConfigLite } from "@/lib/schedule"

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  roomId: z.string().min(1, "Selecciona sala"),
  start: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida"),
  players: z.coerce.number().int().min(1),
  price: z.coerce.number().nonnegative(),
  customerName: z.string().min(2),
  customerEmail: z.string().email(),
  customerPhone: z.string().min(6).max(20),
  language: z.enum(["es","en","ru"]).default("es"),
  notes: z.string().max(1000).optional().or(z.literal("")),
})

type FormValues = z.infer<typeof schema>

export function ReservationCreateDialog({
  rooms,
  defaultDate,
  onCreated,
}: {
  rooms: RoomConfigLite[]
  defaultDate?: string   // YYYY-MM-DD
  onCreated?: () => void
}) {
  const [open, setOpen] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: defaultDate || new Date().toISOString().slice(0,10),
      roomId: "",
      start: "",
      players: 2,
      price: 0,
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      language: "es",
      notes: "",
    },
    mode: "onBlur",
  })

  const selectedRoom = useMemo(
    () => rooms.find(r => r._id === form.watch("roomId")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rooms, form.watch("roomId")]
  )

  // Limitar jugadores según la sala
  const capMin = selectedRoom?.capacityMin ?? 1
  const capMax = selectedRoom?.capacityMax ?? 12

  // Recalcular horas disponibles cuando cambian sala o fecha
  const [startOptions, setStartOptions] = useState<string[]>([])
  useEffect(() => {
    const date = form.getValues("date")
    if (!selectedRoom || !date) {
      setStartOptions([])
      form.setValue("start", "")
      return
    }
    const opts = generateStartTimesForDate(selectedRoom, date)
    setStartOptions(opts)
    // Si la hora actual ya no es válida, vaciar
    const current = form.getValues("start")
    if (current && !opts.includes(current)) form.setValue("start", "")
  }, [selectedRoom, form.watch("date")]) // eslint-disable-line

  // Recalcular precio al cambiar nº de jugadores o sala
  useEffect(() => {
    const n = Number(form.getValues("players"))
    if (!selectedRoom) {
      form.setValue("price", 0)
      return
    }
    const p = priceForPlayers(selectedRoom, n)
    form.setValue("price", p)
  }, [selectedRoom, form.watch("players")]) // eslint-disable-line

  async function onSubmit(values: FormValues) {
    const t = toast.loading("Creando reserva…")
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      if (!res.ok) throw new Error(await res.text())
      toast.success("Reserva creada", { id: t })
      setOpen(false)
      onCreated?.()
    } catch (e: any) {
      toast.error("No se pudo crear", { id: t, description: e?.message ?? "Inténtalo de nuevo" })
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" /> Nueva reserva</Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva reserva</DialogTitle>
          <DialogDescription>Se autocompleta con la configuración de la sala.</DialogDescription>
        </DialogHeader>

        {/* Sala + Fecha */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Sala</Label>
            <Select
              value={form.watch("roomId")}
              onValueChange={(v) => {
                form.setValue("roomId", v, { shouldDirty: true })
                // Ajustar jugadores al mínimo de la sala
                const r = rooms.find(rr => rr._id === v)
                if (r) {
                  const current = Number(form.getValues("players"))
                  const clamp = Math.min(Math.max(current, r.capacityMin), r.capacityMax)
                  form.setValue("players", clamp)
                }
              }}
            >
              <SelectTrigger><SelectValue placeholder="Selecciona sala" /></SelectTrigger>
              <SelectContent>
                {rooms.map(r => (
                  <SelectItem key={r._id} value={r._id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Fecha</Label>
            <Input
              type="date"
              value={form.watch("date")}
              onChange={(e) => form.setValue("date", e.target.value)}
            />
          </div>
        </div>

        {/* Hora + Jugadores */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Hora</Label>
            <Select
              value={form.watch("start")}
              onValueChange={(v) => form.setValue("start", v)}
              disabled={!selectedRoom || startOptions.length === 0}
            >
              <SelectTrigger><SelectValue placeholder={startOptions.length ? "Selecciona hora" : "Cerrado"} /></SelectTrigger>
              <SelectContent>
                {startOptions.map(h => (<SelectItem key={h} value={h}>{h}</SelectItem>))}
              </SelectContent>
            </Select>
            {selectedRoom && startOptions.length === 0 && (
              <p className="text-xs text-muted-foreground">No hay franjas para esta fecha.</p>
            )}
          </div>

          <div className="space-y-1">
            <Label>Nº de jugadores</Label>
            <Input
              type="number"
              min={capMin}
              max={capMax}
              value={form.watch("players")}
              onChange={(e) => {
                const n = Number(e.target.value || 0)
                const clamped = Math.min(Math.max(n, capMin), capMax)
                form.setValue("players", clamped)
              }}
            />
            {selectedRoom && (
              <p className="text-xs text-muted-foreground">
                Capacidad: {capMin}–{capMax}
              </p>
            )}
          </div>
        </div>

        {/* Precio */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Precio (€)</Label>
            <Input type="number" value={form.watch("price")} onChange={(e)=>form.setValue("price", Number(e.target.value||0))} />
            <p className="text-xs text-muted-foreground">Calculado por la tabla de precios de la sala (editable).</p>
          </div>

          <div className="space-y-1">
            <Label>Idioma</Label>
            <Select value={form.watch("language")} onValueChange={(v)=>form.setValue("language", v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="en">Inglés</SelectItem>
                <SelectItem value="ru">Ruso</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Cliente */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <Label>Nombre</Label>
            <Input value={form.watch("customerName")} onChange={(e)=>form.setValue("customerName", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" value={form.watch("customerEmail")} onChange={(e)=>form.setValue("customerEmail", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Teléfono</Label>
            <Input value={form.watch("customerPhone")} onChange={(e)=>form.setValue("customerPhone", e.target.value)} />
          </div>
        </div>

        {/* Notas / preguntas extra */}
        <div className="space-y-1">
          <Label>Notas</Label>
          <Textarea
            placeholder="¿Son adultos o menores? ¿Edades? ¿Evento especial?... "
            value={form.watch("notes")}
            onChange={(e)=>form.setValue("notes", e.target.value)}
            rows={4}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={()=>setOpen(false)}>Cancelar</Button>
          <Button onClick={form.handleSubmit(onSubmit)} disabled={!selectedRoom}>Crear</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
