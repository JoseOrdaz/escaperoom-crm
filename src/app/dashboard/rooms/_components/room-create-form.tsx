"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useForm,
  useFieldArray,
  Controller,
  type Control,
} from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Trash2, Copy } from "lucide-react";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

/* ──────────────────────────────────────────────────────────────
   Constantes
   ────────────────────────────────────────────────────────────── */
const DAYS = [
  { key: "monday", label: "Lunes" },
  { key: "tuesday", label: "Martes" },
  { key: "wednesday", label: "Miércoles" },
  { key: "thursday", label: "Jueves" },
  { key: "friday", label: "Viernes" },
  { key: "saturday", label: "Sábado" },
  { key: "sunday", label: "Domingo" },
] as const;

type DayKey = typeof DAYS[number]["key"];

/* ──────────────────────────────────────────────────────────────
   Schemas Zod
   ────────────────────────────────────────────────────────────── */
const timeHHmm = z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:mm");

const timeSlotSchema = z.object({
  start: timeHHmm,
  end: timeHHmm,
}).refine((s) => s.start < s.end, {
  message: "La hora de inicio debe ser menor que la de fin",
  path: ["end"],
});

const priceRowSchema = z.object({
  players: z.coerce.number().int().min(1),
  price: z.coerce.number().nonnegative(),
});

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
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
  reason: z.string().max(120).optional().or(z.literal("")),
});

const overrideSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
  slots: z.array(timeSlotSchema).min(1, "Añade al menos una franja"),
});

// Acepta "" (vacío), http(s)://..., o ruta relativa que empiece por "/"
const imageUrlSchema = z
  .string()
  .trim()
  .optional()
  .default("")
  .superRefine((val, ctx) => {
    if (!val) return;
    const isAbsolute = /^https?:\/\//i.test(val);
    const isRelative = val.startsWith("/");
    if (!isAbsolute && !isRelative) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "URL inválida. Usa http(s)://… o una ruta que empiece por /",
      });
    }
  });

const schema = z
  .object({
    name: z.string().min(2, "Mínimo 2 caracteres").max(60, "Máximo 60"),
    active: z.boolean().default(true),
    durationMinutes: z.coerce.number().int("Debe ser un número entero").min(30, "Mínimo 30").max(180, "Máximo 180"),
    capacityMin: z.coerce.number().int().min(1, "Mínimo 1"),
    capacityMax: z.coerce.number().int().min(1, "Mínimo 1"),
    imageUrl: imageUrlSchema, // 👈 nuevo
    priceTable: z.array(priceRowSchema).min(1, "Añade al menos un precio"),
    schedule: z.object({
      template: weekTemplateSchema,
      daysOff: z.array(dayOffSchema).default([]),
      overrides: z.array(overrideSchema).default([]),
    }),
  })
  .refine((v) => v.capacityMin <= v.capacityMax, {
    message: "El mínimo no puede ser mayor que el máximo",
    path: ["capacityMin"],
  });

type FormValues = z.infer<typeof schema>;

/* ──────────────────────────────────────────────────────────────
   Subcomponentes
   ────────────────────────────────────────────────────────────── */
function DaySlotsEditor({
  dayKey,
  control,
  formPath,
  title,
}: {
  dayKey: DayKey;
  control: Control<FormValues>;
  formPath: `schedule.template.${DayKey}`;
  title: string;
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: formPath,
    keyName: "_key",
  });

  return (
    <div className="rounded-lg border">
      <div className="flex items-center justify-between bg-muted/40 px-4 py-2">
        <div className="font-medium">{title}</div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ start: "16:00", end: "17:00" })}
        >
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
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(idx)}
                aria-label="Eliminar franja"
              >
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
  index,
  control,
  onRemove,
}: {
  index: number;
  control: Control<FormValues>;
  onRemove: (idx: number) => void;
}) {
  const { fields: slotFields, append: slotAppend, remove: slotRemove } = useFieldArray({
    control,
    name: `schedule.overrides.${index}.slots`,
    keyName: "_key",
  });

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center gap-3">
        <FormField
          control={control}
          name={`schedule.overrides.${index}.date`}
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormLabel className="text-xs text-muted-foreground">Fecha</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex-1" />
        <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(index)} aria-label="Eliminar día especial">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {slotFields.length === 0 ? (
        <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">Sin franjas</div>
      ) : (
        <div className="divide-y rounded-md border">
          {slotFields.map((slot, sIdx) => (
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
              <Button type="button" variant="ghost" size="icon" onClick={() => slotRemove(sIdx)} aria-label="Eliminar franja">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Button type="button" variant="outline" onClick={() => slotAppend({ start: "16:00", end: "17:00" })}>
        <Plus className="mr-1 h-4 w-4" /> Añadir franja
      </Button>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Form principal
   ────────────────────────────────────────────────────────────── */
export function RoomCreateForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  // Avatar / imagen
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

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      active: true,
      durationMinutes: 60,
      capacityMin: 2,
      capacityMax: 12,
      imageUrl: "", // 👈 default
      priceTable: [],
      schedule: {
        template: {
          monday: [],
          tuesday: [],
          wednesday: [],
          thursday: [],
          friday: [],
          saturday: [],
          sunday: [],
        },
        daysOff: [],
        overrides: [],
      },
    },
    mode: "onBlur",
  });

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
      if (!res.ok) {
        let msg = res.statusText || "Error subiendo imagen";
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
          const data = await res.json().catch(() => null);
          if (data?.error) msg = data.error;
        }
        throw new Error(msg);
      }

      const { url } = await res.json(); // { url: "/uploads/xxx.png" } o absoluta
      form.setValue("imageUrl", url, { shouldDirty: true });
      toast.success("Imagen subida", { id: t });
    } catch (err: any) {
      toast.error("No se pudo subir", { id: t, description: err?.message ?? "Inténtalo de nuevo" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // ───── Tabla de precios
  const { fields: priceFields, replace: priceReplace, update: priceUpdate } =
    useFieldArray({
      control: form.control,
      name: "priceTable",
      keyName: "_key",
    });

  const capacityMin = form.watch("capacityMin");
  const capacityMax = form.watch("capacityMax");

  useEffect(() => {
    const min = Math.max(1, Number(capacityMin || 1));
    const max = Math.max(min, Number(capacityMax || min));
    const current = form.getValues("priceTable");
    const map = new Map(current.map((r) => [Number(r.players), r.price]));
    const nextRows = [];
    for (let p = min; p <= max; p++) {
      nextRows.push({ players: p, price: map.get(p) ?? 0 });
    }
    priceReplace(nextRows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capacityMin, capacityMax]);

  // Autorrelleno de precios
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
      const idx = p - min;
      priceUpdate(idx, { players: p, price: Math.round(price) });
    }
    toast.success("Precios autorrellenados");
  }
  function handleClearPrices() {
    priceFields.forEach((_, idx) =>
      priceUpdate(idx, { ...priceFields[idx], price: 0 })
    );
  }

  // ───── Días de descanso
  const {
    fields: dayOffFields,
    append: dayOffAppend,
    remove: dayOffRemove,
  } = useFieldArray({
    control: form.control,
    name: "schedule.daysOff",
    keyName: "_key",
  });

  // ───── Overrides (días especiales)
  const {
    fields: overrideFields,
    append: overrideAppend,
    remove: overrideRemove,
  } = useFieldArray({
    control: form.control,
    name: "schedule.overrides",
    keyName: "_key",
  });

  // Copiar horario de un día a todos
  function copyDayToAll(from: DayKey) {
    const source = form.getValues(`schedule.template.${from}` as const);
    DAYS.forEach((d) => {
      form.setValue(`schedule.template.${d.key}` as const, source);
    });
    toast.success(`Horario de ${DAYS.find((d) => d.key === from)?.label} aplicado a todos los días`);
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    const t = toast.loading("Creando sala…");
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name.trim(),
          active: values.active,
          durationMinutes: values.durationMinutes,
          capacityMin: values.capacityMin,
          capacityMax: values.capacityMax,
          imageUrl: values.imageUrl || "", // 👈 guardar imagen
          priceTable: values.priceTable.map((r) => ({
            players: Number(r.players),
            price: Number(r.price),
          })),
          schedule: {
            template: values.schedule.template,
            daysOff: values.schedule.daysOff,
            overrides: values.schedule.overrides,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      await res.json();
      toast.success("Sala creada", { id: t, description: "Volviendo al listado." });
      router.replace("/dashboard/rooms");
    } catch (e: any) {
      toast.error("No se pudo crear", { id: t, description: e?.message ?? "Inténtalo de nuevo" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(
          onSubmit,
          () => toast.error("Revisa los campos del formulario")
        )}
        className="grid gap-8"
      >
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
                <CardDescription>
                  Nombre, estado, imagen, capacidad y duración del juego
                </CardDescription>
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
                      {uploading ? "Subiendo…" : "Subir/Cambiar imagen"}
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
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre de la sala</FormLabel>
                        <FormControl>
                          <Input placeholder="La Prisión / El Laboratorio…" autoFocus {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="active"
                    render={({ field }) => (
                      <FormItem className="flex flex-col justify-end">
                        <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                          <FormLabel className="m-0">Activa</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Activar sala" />
                          </FormControl>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="durationMinutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Duración (min)</FormLabel>
                        <FormControl>
                          <Input type="number" min={30} max={180} step={5} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="capacityMin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Jugadores (mín)</FormLabel>
                        <FormControl>
                          <Input type="number" min={1} step={1} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="capacityMax"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Jugadores (máx)</FormLabel>
                        <FormControl>
                          <Input type="number" min={1} step={1} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Precios */}
          <TabsContent value="pricing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Precios por número de jugadores</CardTitle>
                <CardDescription>
                  Define el precio total del grupo. Puedes autorrellenar por €/persona
                  y ajustar fila a fila.
                </CardDescription>
              </CardHeader>
              <Separator />
              <CardContent className="pt-6">
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="col-span-2 grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium">€/persona base</label>
                      <Input
                        type="number"
                        min={0}
                        step="1"
                        value={basePerPerson}
                        onChange={(e) => setBasePerPerson(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">Desde (jugadores)</label>
                      <Input
                        type="number"
                        min={capacityMin || 1}
                        step="1"
                        value={fromPlayers}
                        onChange={(e) => setFromPlayers(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">€/persona desde N</label>
                      <Input
                        type="number"
                        min={0}
                        step="1"
                        value={perPersonFrom}
                        onChange={(e) => setPerPersonFrom(Number(e.target.value))}
                      />
                    </div>
                  </div>

                  <div className="col-span-2 mt-6 flex items-start justify-end gap-2 md:mt-0">
                    <Button type="button" variant="outline" onClick={handleClearPrices}>
                      Limpiar
                    </Button>
                    <Button type="button" onClick={handleAutoFill} disabled={!canAutoFill}>
                      Autorrellenar
                    </Button>
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
                            <TableCell className="font-medium">
                              {players} jugador{players === 1 ? "" : "es"}
                            </TableCell>
                            <TableCell>
                              <FormField
                                control={form.control}
                                name={`priceTable.${idx}.price`}
                                render={({ field }) => (
                                  <FormItem className="m-0">
                                    <FormControl>
                                      <Input type="number" min={0} step="1" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
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
                <CardDescription>
                  Franjas por día (HH:mm). Usa “Aplicar a todos los días” para copiar.
                </CardDescription>
              </CardHeader>
              <Separator />
              <CardContent className="grid gap-4 pt-6">
                {DAYS.map((d) => (
                  <div key={d.key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{d.label}</h4>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => copyDayToAll(d.key)}
                        title="Aplicar a todos los días"
                      >
                        <Copy className="mr-1 h-4 w-4" />
                        Aplicar a todos los días
                      </Button>
                    </div>
                    <DaySlotsEditor
                      dayKey={d.key}
                      title=""
                      control={form.control}
                      formPath={`schedule.template.${d.key}`}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Descanso */}
              <Card>
                <CardHeader>
                  <CardTitle>Días de descanso</CardTitle>
                  <CardDescription>Fechas cerradas.</CardDescription>
                </CardHeader>
                <Separator />
                <CardContent className="space-y-3 pt-6">
                  {dayOffFields.length === 0 && (
                    <p className="text-sm text-muted-foreground">No hay días añadidos.</p>
                  )}
                  {dayOffFields.map((row, idx) => (
                    <div key={row._key} className="flex items-center gap-3 rounded-lg border p-3">
                      <FormField
                        control={form.control}
                        name={`schedule.daysOff.${idx}.date`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel className="text-xs text-muted-foreground">Fecha</FormLabel>
                            <FormControl><Input type="date" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`schedule.daysOff.${idx}.reason`}
                        render={({ field }) => (
                          <FormItem className="flex-[1.5]">
                            <FormLabel className="text-xs text-muted-foreground">Motivo</FormLabel>
                            <FormControl><Input placeholder="Festivo / mantenimiento…" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
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
                  <CardDescription>
                    Selecciona la fecha y define las franjas únicamente para ese día.
                  </CardDescription>
                </CardHeader>
                <Separator />
                <CardContent className="space-y-4 pt-6">
                  {overrideFields.length === 0 && (
                    <p className="text-sm text-muted-foreground">No hay días especiales.</p>
                  )}

                  {overrideFields.map((row, oIdx) => (
                    <OverrideEditor
                      key={row._key}
                      index={oIdx}
                      control={form.control}
                      onRemove={overrideRemove}
                    />
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => overrideAppend({ date: "", slots: [] })}
                  >
                    <Plus className="mr-1 h-4 w-4" /> Añadir día especial
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Acciones */}
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting} aria-busy={submitting}>
            {submitting ? "Creando…" : "Crear sala"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
