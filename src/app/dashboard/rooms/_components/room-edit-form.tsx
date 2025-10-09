"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import {
  useForm,
  useFieldArray,
  Controller,
  type Control,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Trash2, Copy, Save, RotateCcw, Trash, CalendarClock } from "lucide-react";

import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";


import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";


type DayKey =
  | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

const DAYS: { key: DayKey; label: string }[] = [
  { key: "monday", label: "Lunes" },
  { key: "tuesday", label: "Martes" },
  { key: "wednesday", label: "Miércoles" },
  { key: "thursday", label: "Jueves" },
  { key: "friday", label: "Viernes" },
  { key: "saturday", label: "Sábado" },
  { key: "sunday", label: "Domingo" },
];

// ─────────────── Schemas
const timeHHmm = z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:mm");
const timeSlotSchema = z.object({ start: timeHHmm, end: timeHHmm })
  .refine((s) => s.start < s.end, { path: ["end"], message: "Inicio < fin" });

const priceRowSchema = z.object({ players: z.coerce.number().int().min(1), price: z.coerce.number().nonnegative() });
const weekTemplateSchema = z.object({
  monday: z.array(timeSlotSchema).default([]),
  tuesday: z.array(timeSlotSchema).default([]),
  wednesday: z.array(timeSlotSchema).default([]),
  thursday: z.array(timeSlotSchema).default([]),
  friday: z.array(timeSlotSchema).default([]),
  saturday: z.array(timeSlotSchema).default([]),
  sunday: z.array(timeSlotSchema).default([]),
});
const dayOffSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(120).optional().or(z.literal("")),
});
const overrideSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slots: z.array(timeSlotSchema).min(1),
});


const imageUrlSchema = z
  .string()
  .trim()
  .optional()
  .default("")
  .superRefine((val, ctx) => {
    if (!val) return; // permitir vacío
    const isAbsolute = /^https?:\/\//i.test(val);
    const isRelative = val.startsWith("/");
    if (!isAbsolute && !isRelative) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "URL inválida. Usa una URL http(s) o una ruta que empiece por /",
      });
    }
  });

const schema = z.object({
  _id: z.string(),
  name: z.string().min(2).max(60),
  active: z.boolean().default(true),
  durationMinutes: z.coerce.number().int().min(30).max(180),
  capacityMin: z.coerce.number().int().min(1),
  capacityMax: z.coerce.number().int().min(1),
  imageUrl: imageUrlSchema,            // 👈 usa el nuevo schema
  priceTable: z.array(priceRowSchema).default([]),
  schedule: z.object({
    template: weekTemplateSchema,
    daysOff: z.array(dayOffSchema).default([]),
    overrides: z.array(overrideSchema).default([]),
  }),
  linkedRooms: z.array(z.string()).default([]),
}).refine((v) => v.capacityMin <= v.capacityMax, {
  path: ["capacityMin"], message: "El mínimo no puede ser mayor que el máximo",
});

type FormValues = z.infer<typeof schema>;
type Props = { room: FormValues };

// ─────────────── Subcomponentes (evitar Hooks en .map)
function DaySlotsEditor({
  day, formPath, control, title,
}: { day: DayKey; formPath: `schedule.template.${DayKey}`; control: Control<FormValues>; title: string }) {
  const { fields, append, remove } = useFieldArray({ control, name: formPath, keyName: "_key" });

  return (
    <div className="rounded-lg border">
      <div className="flex items-center justify-between bg-muted/40 px-4 py-2">
        <div className="font-medium">{title}</div>
        <Button type="button" variant="outline" size="sm" onClick={() => append({ start: "16:00", end: "17:00" })}>
          <Plus className="mr-1 h-4 w-4" /> Añadir
        </Button>
      </div>
      {fields.length === 0 ? (
        <div className="p-4 text-sm text-muted-foreground">Sin franjas</div>
      ) : (
        <div className="divide-y">
          {fields.map((row, idx) => (
            <div key={row._key} className="flex items-center gap-3 p-3">
              <Controller
                name={`${formPath}.${idx}.start`}
                control={control}
                render={({ field }) => (
                  <div className="flex flex-col">
                    <label className="text-xs text-muted-foreground">Inicio</label>
                    <Input type="time" step={60} {...field} />
                  </div>
                )}
              />
              <Controller
                name={`${formPath}.${idx}.end`}
                control={control}
                render={({ field }) => (
                  <div className="flex flex-col">
                    <label className="text-xs text-muted-foreground">Fin</label>
                    <Input type="time" step={60} {...field} />
                  </div>
                )}
              />
              <div className="flex-1" />
              <Button type="button" variant="ghost" size="icon" onClick={() => remove(idx)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OverrideEditor({
  index, control, onRemove,
}: { index: number; control: Control<FormValues>; onRemove: (i: number) => void }) {
  const { fields, append, remove } = useFieldArray({
    control, name: `schedule.overrides.${index}.slots`, keyName: "_key",
  });

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center gap-3">
        <FormField
          control={control}
          name={`schedule.overrides.${index}.date`}
          render={({ field }) => (
            <div className="flex-1">
              <label className="text-xs text-muted-foreground">Fecha</label>
              <Input type="date" {...field} />
            </div>
          )}
        />
        <div className="flex-1" />
        <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(index)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {fields.length === 0 ? (
        <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">Sin franjas</div>
      ) : (
        <div className="divide-y rounded-md border">
          {fields.map((slot, sIdx) => (
            <div key={slot._key} className="flex items-center gap-3 p-3">
              <Controller
                name={`schedule.overrides.${index}.slots.${sIdx}.start`}
                control={control}
                render={({ field }) => (
                  <div className="flex flex-col">
                    <label className="text-xs text-muted-foreground">Inicio</label>
                    <Input type="time" step={60} {...field} />
                  </div>
                )}
              />
              <Controller
                name={`schedule.overrides.${index}.slots.${sIdx}.end`}
                control={control}
                render={({ field }) => (
                  <div className="flex flex-col">
                    <label className="text-xs text-muted-foreground">Fin</label>
                    <Input type="time" step={60} {...field} />
                  </div>
                )}
              />
              <div className="flex-1" />
              <Button type="button" variant="ghost" size="icon" onClick={() => remove(sIdx)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Button type="button" variant="outline" onClick={() => append({ start: "16:00", end: "17:00" })}>
        <Plus className="mr-1 h-4 w-4" /> Añadir franja
      </Button>
    </div>
  );
}

// ─────────────── Form principal
export function RoomEditForm({ room }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: room,
    mode: "onBlur",
  });

  // ===== Avatar / imagen =====
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  function initialsFromName(name: string) {
    return (
      name
        ?.split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase())
        .join("") || "SL"
    );
  }

  async function handlePickFile() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Sube un archivo de imagen");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen supera 5MB");
      return;
    }

    const t = toast.loading("Subiendo imagen…");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const { url } = await res.json(); // { url: "/uploads/xxx.png" }
      form.setValue("imageUrl", url, { shouldDirty: true });
      toast.success("Imagen subida", { id: t });
    } catch (err: any) {
      toast.error("No se pudo subir", { id: t, description: err?.message });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Tabla de precios + helpers
  const { fields: priceFields, replace: priceReplace, update: priceUpdate } =
    useFieldArray({ control: form.control, name: "priceTable", keyName: "_key" });

  const capacityMin = form.watch("capacityMin");
  const capacityMax = form.watch("capacityMax");

  // Regenerar filas al cambiar rango manteniendo precios existentes
  useEffect(() => {
    const min = Math.max(1, Number(capacityMin || 1));
    const max = Math.max(min, Number(capacityMax || min));
    const current = form.getValues("priceTable");
    const map = new Map(current.map((r) => [Number(r.players), r.price]));
    const nextRows = [];
    for (let p = min; p <= max; p++) nextRows.push({ players: p, price: map.get(p) ?? 0 });
    priceReplace(nextRows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capacityMin, capacityMax]);

  // Autorrelleno
  const [basePerPerson, setBasePerPerson] = useState<number>(25);
  const [fromPlayers, setFromPlayers] = useState<number>(10);
  const [perPersonFrom, setPerPersonFrom] = useState<number>(19);
  const canAutoFill = useMemo(() => priceFields.length > 0, [priceFields.length]);

  function handleAutoFill() {
    if (!canAutoFill) return;
    const min = Number(capacityMin || 1);
    const max = Number(capacityMax || min);
    for (let p = min; p <= max; p++) {
      const price = p >= fromPlayers ? p * perPersonFrom : p * basePerPerson;
      priceUpdate(p - min, { players: p, price: Math.round(price) });
    }
    toast.success("Precios autorrellenados");
  }
  function handleClearPrices() {
    priceFields.forEach((_, idx) => priceUpdate(idx, { ...priceFields[idx], price: 0 }));
  }

  // Days off
  const { fields: dayOffFields, append: dayOffAppend, remove: dayOffRemove } =
    useFieldArray({ control: form.control, name: "schedule.daysOff", keyName: "_key" });

  // Overrides
  const { fields: overrideFields, append: overrideAppend, remove: overrideRemove } =
    useFieldArray({ control: form.control, name: "schedule.overrides", keyName: "_key" });

  function copyDayToAll(from: DayKey) {
    const src = form.getValues(`schedule.template.${from}` as const);
    (["monday","tuesday","wednesday","thursday","friday","saturday","sunday"] as DayKey[])
      .forEach((k) => form.setValue(`schedule.template.${k}` as const, src));
    toast.success(`Horario de ${
      DAYS.find(d=>d.key===from)?.label
    } aplicado a todos los días`);
  }

  async function onSave(values: FormValues) {
    setSaving(true);
    const t = toast.loading("Guardando…");
    try {
      const res = await fetch(`/api/rooms/${values._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name.trim(),
          active: values.active,
          durationMinutes: values.durationMinutes,
          capacityMin: values.capacityMin,
          capacityMax: values.capacityMax,
          imageUrl: values.imageUrl || "", // 👈 guardar
          priceTable: values.priceTable,
          schedule: values.schedule,
          linkedRooms: values.linkedRooms,
          updatedAt: new Date(),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Cambios guardados", { id: t });
      router.refresh();
    } catch (e: any) {
      toast.error("No se pudo guardar", { id: t, description: e?.message ?? "Inténtalo de nuevo" });
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    const t = toast.loading("Eliminando…");
    try {
      const res = await fetch(`/api/rooms/${form.getValues("_id")}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Sala eliminada", { id: t });
      router.replace("/dashboard/rooms");
    } catch (e: any) {
      toast.error("No se pudo eliminar", { id: t, description: e?.message ?? "Revisa reservas vinculadas" });
    }
  }

  const [rooms, setRooms] = useState<{ _id: string; name: string }[]>([]);

useEffect(() => {
  (async () => {
    try {
      const res = await fetch("/api/rooms", { cache: "force-cache" });
      if (res.ok) {
        const json = await res.json();
        setRooms(json);
      }
    } catch {
      toast.error("Error cargando salas");
    }
  })();
}, []);

  return (
    <form onSubmit={form.handleSubmit(onSave)} className="grid gap-8">
      <Tabs defaultValue="details" className="space-y-6">
        <TabsList>
          <TabsTrigger value="details">Detalles</TabsTrigger>
          <TabsTrigger value="pricing">Precios</TabsTrigger>
          <TabsTrigger value="schedule">Horario</TabsTrigger>
        </TabsList>

        {/* Detalles */}
        <TabsContent value="details" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Datos básicos</CardTitle>
              <CardDescription>Nombre, estado, imagen, capacidad y duración</CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="grid gap-6 pt-6">
              {/* Avatar + acciones */}
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={form.watch("imageUrl") || undefined} alt={form.watch("name") || "Sala"} />
                  <AvatarFallback>{initialsFromName(form.watch("name") || "")}</AvatarFallback>
                </Avatar>
                <div className="space-x-2">
                  <Button type="button" variant="outline" size="sm" onClick={handlePickFile} disabled={uploading}>
                    {uploading ? "Subiendo…" : "Cambiar imagen"}
                  </Button>
                  {form.watch("imageUrl") ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => form.setValue("imageUrl", "", { shouldDirty: true })}
                    >
                      Quitar
                    </Button>
                  ) : null}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium">Nombre</label>
                  <Input {...form.register("name")} />
                </div>
                <div className="flex flex-col justify-end">
                  <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                    <span className="text-sm">Activa</span>
                    <Switch checked={form.watch("active")} onCheckedChange={(v)=>form.setValue("active", v)} />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium">Duración (min)</label>
                  <Input type="number" min={30} max={180} step={5} {...form.register("durationMinutes", { valueAsNumber: true })} />
                </div>
                <div>
                  <label className="block text-sm font-medium">Jugadores (mín)</label>
                  <Input type="number" min={1} {...form.register("capacityMin", { valueAsNumber: true })} />
                </div>
                <div>
                  <label className="block text-sm font-medium">Jugadores (máx)</label>
                  <Input type="number" min={1} {...form.register("capacityMax", { valueAsNumber: true })} />
                </div>
              </div>
              {/* Salas vinculadas */}
<div className="space-y-2">
  <label className="text-sm font-medium text-foreground">Salas vinculadas</label>
  <p className="text-xs text-muted-foreground">
    Si una de estas salas está ocupada, esta también quedará bloqueada.
  </p>

  <Popover>
    <PopoverTrigger asChild>
      <Button
        variant="outline"
        role="combobox"
        className="w-full justify-between text-sm min-h-[2.5rem]"
      >
        <div className="flex flex-wrap items-center gap-1 truncate">
          {form.watch("linkedRooms")?.length > 0 ? (
            form.watch("linkedRooms").map((id) => {
              const name = rooms.find((r) => r._id === id)?.name ?? id;
              return (
                <span
                  key={id}
                  className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {name}
                  <button
                    type="button"
                    className="ml-1 hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      form.setValue(
                        "linkedRooms",
                        form.getValues("linkedRooms").filter((v) => v !== id)
                      );
                    }}
                  >
                    ✕
                  </button>
                </span>
              );
            })
          ) : (
            <span className="text-muted-foreground">Seleccionar salas...</span>
          )}
        </div>
        <span className="ml-2 opacity-60">▾</span>
      </Button>
    </PopoverTrigger>

    <PopoverContent className="p-0 w-[260px]">
      <Command>
        <CommandInput placeholder="Buscar sala..." />
        <CommandEmpty>No se encontraron salas.</CommandEmpty>
        <CommandGroup>
          {rooms
            .filter((r) => r._id !== form.getValues("_id"))
            .map((r) => {
              const selected = form.watch("linkedRooms")?.includes(r._id);
              return (
                <CommandItem
                  key={r._id}
                  value={r._id}
                  onSelect={() => {
                    const current = form.getValues("linkedRooms") || [];
                    if (selected) {
                      form.setValue(
                        "linkedRooms",
                        current.filter((id) => id !== r._id)
                      );
                    } else {
                      form.setValue("linkedRooms", [...current, r._id]);
                    }
                  }}
                >
                  <div
                    className={`mr-2 h-4 w-4 rounded-sm border flex items-center justify-center ${
                      selected
                        ? "bg-primary text-primary-foreground"
                        : "opacity-50"
                    }`}
                  >
                    {selected ? "✓" : ""}
                  </div>
                  {r.name}
                </CommandItem>
              );
            })}
        </CommandGroup>
      </Command>
    </PopoverContent>
  </Popover>
</div>



            </CardContent>
          </Card>
        </TabsContent>

        {/* Precios */}
        <TabsContent value="pricing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Precios por número de jugadores</CardTitle>
              <CardDescription>Precio total del grupo por tamaño</CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="pt-6">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="col-span-2 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium">€/persona base</label>
                    <Input type="number" value={basePerPerson} onChange={(e)=>setBasePerPerson(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Desde (jugadores)</label>
                    <Input type="number" value={fromPlayers} onChange={(e)=>setFromPlayers(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">€/persona desde N</label>
                    <Input type="number" value={perPersonFrom} onChange={(e)=>setPerPersonFrom(Number(e.target.value))} />
                  </div>
                </div>
                <div className="col-span-2 mt-6 flex items-start justify-end gap-2 md:mt-0">
                  <Button type="button" variant="outline" onClick={handleClearPrices}><RotateCcw className="mr-2 h-4 w-4" />Limpiar</Button>
                  <Button type="button" onClick={handleAutoFill}>Autorrellenar</Button>
                </div>
              </div>

              <div className="mt-6 overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Jugadores</TableHead>
                      <TableHead>Precio total (€)</TableHead>
                      <TableHead className="w-[180px] text-right">€/persona</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {priceFields.map((row, idx) => {
                      const price = form.watch(`priceTable.${idx}.price`);
                      const players = form.watch(`priceTable.${idx}.players`);
                      const perPerson = Number(players) > 0 ? (Number(price) || 0) / Number(players) : 0;
                      return (
                        <TableRow key={row._key}>
                          <TableCell className="font-medium">{players} jugador{players===1?"":"es"}</TableCell>
                          <TableCell>
                            <Input type="number" min={0} step="1" {...form.register(`priceTable.${idx}.price` as const, { valueAsNumber: true })} />
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {perPerson ? `${perPerson.toFixed(2)} €` : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Horario */}
        <TabsContent value="schedule" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Horario laboral semanal</CardTitle>
              <CardDescription>Define franjas por día (HH:mm)</CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="grid gap-4 pt-6">
              {DAYS.map((d) => (
                <div key={d.key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{d.label}</h4>
                    <Button type="button" size="sm" variant="ghost" onClick={() => copyDayToAll(d.key)}>
                      <Copy className="mr-1 h-4 w-4" /> Aplicar a todos los días
                    </Button>
                  </div>
                  <DaySlotsEditor day={d.key} title="" control={form.control} formPath={`schedule.template.${d.key}`} />
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Días de descanso */}
            <Card>
              <CardHeader>
                <CardTitle>Días de descanso</CardTitle>
                <CardDescription>Fechas cerradas</CardDescription>
              </CardHeader>
              <Separator />
              <CardContent className="space-y-3 pt-6">
                {dayOffFields.length === 0 && (
                  <p className="text-sm text-muted-foreground">No hay días añadidos.</p>
                )}
                {dayOffFields.map((row, idx) => (
                  <div key={row._key} className="flex items-center gap-3 rounded-lg border p-3">
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground">Fecha</label>
                      <Input type="date" {...form.register(`schedule.daysOff.${idx}.date` as const)} />
                    </div>
                    <div className="flex-[1.5]">
                      <label className="text-xs text-muted-foreground">Motivo</label>
                      <Input placeholder="Festivo / mantenimiento…" {...form.register(`schedule.daysOff.${idx}.reason` as const)} />
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => dayOffRemove(idx)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={() => dayOffAppend({ date: "", reason: "" })}>
                  <Plus className="mr-1 h-4 w-4" /> Añadir día de descanso
                </Button>
              </CardContent>
            </Card>

            {/* Días especiales */}
            <Card>
              <CardHeader>
                <CardTitle>Días especiales</CardTitle>
                <CardDescription>Define franjas solo para esa fecha</CardDescription>
              </CardHeader>
              <Separator />
              <CardContent className="space-y-4 pt-6">
                {overrideFields.length === 0 && (
                  <p className="text-sm text-muted-foreground">No hay días especiales.</p>
                )}
                {overrideFields.map((row, oIdx) => (
                  <OverrideEditor key={row._key} index={oIdx} control={form.control} onRemove={overrideRemove} />
                ))}
                <Button type="button" variant="outline" onClick={() => overrideAppend({ date: "", slots: [] })}>
                  <Plus className="mr-1 h-4 w-4" /> Añadir día especial
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={() => router.replace("/dashboard/rooms")}>
            <CalendarClock className="mr-2 h-4 w-4" /> Volver al listado
          </Button>
          <Button type="submit" disabled={saving}>
            <Save className="mr-2 h-4 w-4" /> {saving ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="destructive">
              <Trash className="mr-2 h-4 w-4" /> Eliminar sala
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar sala</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. Se eliminará la sala si no tiene reservas vinculadas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete}>Eliminar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </form>
  );
}
