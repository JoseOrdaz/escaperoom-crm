"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm, useFieldArray, Controller, type Control, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  ArrowLeft, CalendarClock, CalendarOff, CalendarRange, Check, ChevronDown, Clock, Copy, DoorOpen, Euro, ImagePlus,
  Info, Link2, Loader2, Plus, Save, Sparkles, Tag, Trash, Trash2, Users, Wand2, X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ESCAPES } from "@/lib/permissions";
import { cn } from "@/lib/utils";

/* ───────────────────────── Tipos y esquema ───────────────────────── */
type DayKey = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

const DAYS: { key: DayKey; label: string; short: string }[] = [
  { key: "monday", label: "Lunes", short: "L" },
  { key: "tuesday", label: "Martes", short: "M" },
  { key: "wednesday", label: "Miércoles", short: "X" },
  { key: "thursday", label: "Jueves", short: "J" },
  { key: "friday", label: "Viernes", short: "V" },
  { key: "saturday", label: "Sábado", short: "S" },
  { key: "sunday", label: "Domingo", short: "D" },
];
const WEEKDAYS: DayKey[] = ["monday", "tuesday", "wednesday", "thursday", "friday"];
const WEEKEND: DayKey[] = ["saturday", "sunday"];

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
const priceRuleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha obligatoria"),
  start: z.string().optional().or(z.literal("")),
  end: z.string().optional().or(z.literal("")),
  adjustType: z.enum(["percent", "amount"]).default("percent"),
  value: z.coerce.number().refine((n) => n !== 0, "Indica el ajuste"),
  label: z.string().max(80).optional().or(z.literal("")),
});
const dayOffSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha obligatoria"),
  reason: z.string().max(120).optional().or(z.literal("")),
  message: z.string().max(240).optional().or(z.literal("")),
});
const overrideSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha obligatoria"),
  slots: z.array(timeSlotSchema).min(1, "Añade al menos una franja"),
});
const imageUrlSchema = z.string().trim().optional().default("").superRefine((val, ctx) => {
  if (!val) return;
  if (!/^https?:\/\//i.test(val) && !val.startsWith("/")) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "URL inválida. Usa una URL http(s) o una ruta que empiece por /" });
  }
});

const schema = z.object({
  _id: z.string(),
  name: z.string().min(2, "Mínimo 2 caracteres").max(60),
  active: z.boolean().default(true),
  durationMinutes: z.coerce.number().int().min(30, "Mínimo 30 min").max(180, "Máximo 180 min"),
  capacityMin: z.coerce.number().int().min(1),
  capacityMax: z.coerce.number().int().min(1),
  imageUrl: imageUrlSchema,
  priceTable: z.array(priceRowSchema).default([]),
  schedule: z.object({
    template: weekTemplateSchema,
    daysOff: z.array(dayOffSchema).default([]),
    overrides: z.array(overrideSchema).default([]),
    priceRules: z.array(priceRuleSchema).default([]),
  }),
  linkedRooms: z.array(z.string()).default([]),
  escape: z.enum(ESCAPES).default("Fobia"),
}).refine((v) => v.capacityMin <= v.capacityMax, {
  path: ["capacityMin"], message: "El mínimo no puede ser mayor que el máximo",
});

type FormValues = z.infer<typeof schema>;
type Props = { room: FormValues; allowedEscapes?: string[] };

/* ───────────────────────── Utilidades ───────────────────────── */
const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const toHHmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const eur = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);

/* ───────────────────────── Piezas de UI ───────────────────────── */
function Section({ icon: Icon, title, description, action, children }: {
  icon: typeof Clock; title: string; description?: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-card shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" /></span>
          <div>
            <h2 className="font-semibold">{title}</h2>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
        {action}
      </header>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

function Field({ label, hint, error, children, className }: {
  label: string; hint?: string; error?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="text-sm font-medium">{label}</label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Stepper({ value, onChange, min = 1, max = 99 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div className="flex h-9 items-center overflow-hidden rounded-md border">
      <button type="button" className="h-full px-3 text-muted-foreground hover:bg-muted disabled:opacity-40" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} aria-label="Restar">−</button>
      <input
        type="number"
        className="h-full w-full min-w-0 border-x bg-transparent text-center text-sm tabular-nums outline-none"
        value={Number.isFinite(value) ? value : ""}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <button type="button" className="h-full px-3 text-muted-foreground hover:bg-muted disabled:opacity-40" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} aria-label="Sumar">+</button>
    </div>
  );
}

/** Franjas de un día: chips editables + abrir/cerrar */
function DayRow({ day, control, form, duration, onCopy }: {
  day: (typeof DAYS)[number]; control: Control<FormValues>; form: UseFormReturn<FormValues>; duration: number;
  onCopy: (from: DayKey, to: DayKey[]) => void;
}) {
  const { fields, append, remove, replace } = useFieldArray({ control, name: `schedule.template.${day.key}`, keyName: "_key" });
  const slots = form.watch(`schedule.template.${day.key}`) ?? [];
  const open = fields.length > 0;
  const errors = form.formState.errors.schedule?.template?.[day.key];

  function addSlot() {
    const last = slots[slots.length - 1];
    const start = last ? toMin(last.end) + 15 : toMin("16:00");
    append({ start: toHHmm(start), end: toHHmm(start + duration) });
  }

  return (
    <div className={cn("grid gap-3 py-3 sm:grid-cols-[150px_minmax(0,1fr)_auto] sm:items-start", !open && "opacity-80")}>
      <div className="flex items-center gap-3">
        <Switch
          checked={open}
          onCheckedChange={(v) => (v ? addSlot() : replace([]))}
          aria-label={`${day.label} abierto`}
        />
        <div>
          <p className="text-sm font-medium">{day.label}</p>
          <p className="text-xs text-muted-foreground">{open ? `${fields.length} ${fields.length === 1 ? "sesión" : "sesiones"}` : "Cerrado"}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {fields.map((row, idx) => {
          const err = Array.isArray(errors) ? errors[idx] : undefined;
          return (
            <div
              key={row._key}
              className={cn(
                "group flex items-center gap-1 rounded-lg border bg-background py-1 pl-2 pr-1 text-sm shadow-sm",
                err && "border-destructive"
              )}
              title={err?.end?.message}
            >
              <Controller name={`schedule.template.${day.key}.${idx}.start`} control={control} render={({ field }) => (
                <input type="time" step={300} {...field} className="w-[74px] bg-transparent tabular-nums outline-none" aria-label="Inicio" />
              )} />
              <span className="text-muted-foreground">–</span>
              <Controller name={`schedule.template.${day.key}.${idx}.end`} control={control} render={({ field }) => (
                <input type="time" step={300} {...field} className="w-[74px] bg-transparent tabular-nums outline-none" aria-label="Fin" />
              )} />
              <button type="button" onClick={() => remove(idx)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Quitar franja">
                <X className="size-3.5" />
              </button>
            </div>
          );
        })}
        {open && (
          <button type="button" onClick={addSlot} className="flex items-center gap-1 rounded-lg border border-dashed px-2.5 py-1.5 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary">
            <Plus className="size-3.5" /> Añadir
          </button>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="sm" disabled={!open} className="justify-self-start text-muted-foreground sm:justify-self-end">
            <Copy className="size-4" /> Copiar a… <ChevronDown className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onCopy(day.key, DAYS.map((d) => d.key))}>Todos los días</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onCopy(day.key, WEEKDAYS)}>De lunes a viernes</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onCopy(day.key, WEEKEND)}>Fin de semana</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function OverrideEditor({ index, control, onRemove }: { index: number; control: Control<FormValues>; onRemove: (i: number) => void }) {
  const { fields, append, remove } = useFieldArray({ control, name: `schedule.overrides.${index}.slots`, keyName: "_key" });
  return (
    <div className="space-y-3 rounded-xl border p-4">
      <div className="flex items-end gap-3">
        <Controller name={`schedule.overrides.${index}.date`} control={control} render={({ field }) => (
          <Field label="Fecha" className="flex-1 sm:max-w-48"><Input type="date" {...field} /></Field>
        )} />
        <div className="flex-1" />
        <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(index)} aria-label="Quitar día especial"><Trash2 className="size-4" /></Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {fields.map((slot, sIdx) => (
          <div key={slot._key} className="flex items-center gap-1 rounded-lg border bg-background py-1 pl-2 pr-1 text-sm shadow-sm">
            <Controller name={`schedule.overrides.${index}.slots.${sIdx}.start`} control={control} render={({ field }) => (
              <input type="time" step={300} {...field} className="w-[74px] bg-transparent tabular-nums outline-none" aria-label="Inicio" />
            )} />
            <span className="text-muted-foreground">–</span>
            <Controller name={`schedule.overrides.${index}.slots.${sIdx}.end`} control={control} render={({ field }) => (
              <input type="time" step={300} {...field} className="w-[74px] bg-transparent tabular-nums outline-none" aria-label="Fin" />
            )} />
            <button type="button" onClick={() => remove(sIdx)} className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label="Quitar franja"><X className="size-3.5" /></button>
          </div>
        ))}
        <button type="button" onClick={() => append({ start: "16:00", end: "17:00" })} className="flex items-center gap-1 rounded-lg border border-dashed px-2.5 py-1.5 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary">
          <Plus className="size-3.5" /> Franja
        </button>
      </div>
    </div>
  );
}

/* ───────────────────────── Formulario principal ───────────────────────── */
type TabKey = "details" | "pricing" | "schedule" | "dates";

export function RoomEditForm({ room, allowedEscapes = [...ESCAPES] }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<TabKey>("details");

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: room, mode: "onBlur" });
  const { errors, isDirty } = form.formState;

  const name = form.watch("name");
  const imageUrl = form.watch("imageUrl");
  const active = form.watch("active");
  const escape = form.watch("escape");
  const duration = Number(form.watch("durationMinutes")) || 60;
  const capacityMin = Number(form.watch("capacityMin")) || 1;
  const capacityMax = Number(form.watch("capacityMax")) || capacityMin;
  const priceTable = form.watch("priceTable") ?? [];
  const template = form.watch("schedule.template");

  /* Imagen */
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  async function uploadFile(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Sube un archivo de imagen");
    if (file.size > 5 * 1024 * 1024) return toast.error("La imagen supera 5 MB");
    const t = toast.loading("Subiendo imagen…");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const { url } = await res.json();
      form.setValue("imageUrl", url, { shouldDirty: true });
      toast.success("Imagen subida", { id: t });
    } catch (err) {
      toast.error("No se pudo subir", { id: t, description: err instanceof Error ? err.message : undefined });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  /* Precios: una fila por nº de jugadores dentro del rango */
  const { fields: priceFields, replace: priceReplace } = useFieldArray({ control: form.control, name: "priceTable", keyName: "_key" });
  useEffect(() => {
    const min = Math.max(1, capacityMin);
    const max = Math.max(min, capacityMax);
    const current = form.getValues("priceTable");
    const map = new Map(current.map((r) => [Number(r.players), r.price]));
    const next = [];
    for (let p = min; p <= max; p++) next.push({ players: p, price: map.get(p) ?? 0 });
    if (next.length !== current.length || next.some((r, i) => r.players !== Number(current[i]?.players))) priceReplace(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capacityMin, capacityMax]);

  const [basePerPerson, setBasePerPerson] = useState(25);
  const [fromPlayers, setFromPlayers] = useState(10);
  const [perPersonFrom, setPerPersonFrom] = useState(19);
  function autoFill() {
    priceReplace(priceFields.map((_, i) => {
      const p = capacityMin + i;
      return { players: p, price: Math.round(p * (p >= fromPlayers ? perPersonFrom : basePerPerson)) };
    }));
    form.trigger("priceTable");
    toast.success("Precios rellenados");
  }
  const missingPrices = priceTable.filter((r) => !Number(r.price)).length;
  const prices = priceTable.map((r) => Number(r.price)).filter((n) => n > 0);
  const perPersonMax = Math.max(1, ...priceTable.map((r) => (Number(r.players) ? Number(r.price) / Number(r.players) : 0)));

  /* Horario */
  function copyDay(from: DayKey, to: DayKey[]) {
    const src = form.getValues(`schedule.template.${from}`);
    to.forEach((k) => form.setValue(`schedule.template.${k}`, src.map((s) => ({ ...s })), { shouldDirty: true }));
    toast.success(`Horario del ${DAYS.find((d) => d.key === from)?.label.toLowerCase()} copiado`);
  }
  const [gen, setGen] = useState({ from: "10:00", to: "22:00", every: 90, days: [...WEEKDAYS, ...WEEKEND] as DayKey[] });
  const [genOpen, setGenOpen] = useState(false);
  function generate() {
    const slots: { start: string; end: string }[] = [];
    for (let s = toMin(gen.from); s + duration <= toMin(gen.to); s += Math.max(duration, gen.every)) {
      slots.push({ start: toHHmm(s), end: toHHmm(s + duration) });
    }
    if (!slots.length) return toast.error("No caben sesiones en ese rango");
    gen.days.forEach((d) => form.setValue(`schedule.template.${d}`, slots.map((x) => ({ ...x })), { shouldDirty: true }));
    setGenOpen(false);
    toast.success(`${slots.length} sesiones por día generadas`);
  }
  const weeklySessions = DAYS.reduce((n, d) => n + (template?.[d.key]?.length ?? 0), 0);
  const openDays = DAYS.filter((d) => (template?.[d.key]?.length ?? 0) > 0);

  /* Fechas especiales */
  const { fields: dayOffFields, append: dayOffAppend, remove: dayOffRemove } = useFieldArray({ control: form.control, name: "schedule.daysOff", keyName: "_key" });
  const { fields: priceRuleFields, append: priceRuleAppend, remove: priceRuleRemove } = useFieldArray({ control: form.control, name: "schedule.priceRules", keyName: "_key" });
  const { fields: overrideFields, append: overrideAppend, remove: overrideRemove } = useFieldArray({ control: form.control, name: "schedule.overrides", keyName: "_key" });

  /* Salas vinculadas (solo del mismo escape) */
  const [rooms, setRooms] = useState<{ _id: string; name: string; escape?: string }[]>([]);
  useEffect(() => {
    fetch("/api/rooms", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setRooms)
      .catch(() => toast.error("Error cargando salas"));
  }, []);
  const linkable = rooms.filter((r) => r._id !== room._id && (!r.escape || r.escape === escape));
  const linked = form.watch("linkedRooms") ?? [];

  /* Guardar / eliminar */
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
          imageUrl: values.imageUrl || "",
          priceTable: values.priceTable,
          schedule: values.schedule,
          linkedRooms: values.linkedRooms,
          escape: values.escape,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Inténtalo de nuevo");
      toast.success("Cambios guardados", { id: t });
      form.reset(values);
      router.refresh();
    } catch (e) {
      toast.error("No se pudo guardar", { id: t, description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  }
  function onInvalid() {
    const e = form.formState.errors;
    const target: TabKey = e.priceTable ? "pricing" : e.schedule?.template ? "schedule" : e.schedule ? "dates" : "details";
    setTab(target);
    toast.error("Revisa los campos marcados en rojo");
  }
  async function onDelete() {
    const t = toast.loading("Eliminando…");
    try {
      const res = await fetch(`/api/rooms/${room._id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error);
      toast.success("Sala eliminada", { id: t });
      router.replace("/dashboard/rooms");
    } catch (e) {
      toast.error("No se pudo eliminar", { id: t, description: e instanceof Error ? e.message : undefined });
    }
  }

  const tabs: { key: TabKey; label: string; icon: typeof Clock; badge?: number }[] = [
    { key: "details", label: "Detalles", icon: DoorOpen },
    { key: "pricing", label: "Precios", icon: Euro, badge: missingPrices || undefined },
    { key: "schedule", label: "Horario", icon: Clock },
    { key: "dates", label: "Fechas especiales", icon: CalendarRange, badge: dayOffFields.length + overrideFields.length + priceRuleFields.length || undefined },
  ];

  return (
    <form onSubmit={form.handleSubmit(onSave, onInvalid)} className="space-y-6">
      {/* ── Barra superior ── */}
      <div className="sticky top-16 z-10 -mx-4 border-b bg-background/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="ghost" size="icon" onClick={() => router.push("/dashboard/rooms")} aria-label="Volver a salas">
            <ArrowLeft className="size-4" />
          </Button>
          <div className="size-11 shrink-0 overflow-hidden rounded-xl bg-muted">
            {imageUrl ? <img src={imageUrl} alt="" className="size-full object-cover" /> : <DoorOpen className="m-3 size-5 text-muted-foreground" />}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-semibold tracking-tight">{name || "Sala sin nombre"}</h1>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground">{escape}</span>
              <span className={cn("rounded-full px-2 py-0.5 font-medium", active ? "bg-emerald-500/10 text-emerald-700" : "bg-muted text-muted-foreground")}>
                {active ? "Activa" : "Inactiva"}
              </span>
              {isDirty && <span className="flex items-center gap-1 text-amber-700"><span className="size-1.5 rounded-full bg-amber-500" />Cambios sin guardar</span>}
            </div>
          </div>
          <Button type="submit" disabled={saving || !isDirty}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {saving ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>

        <div role="tablist" aria-label="Secciones" className="mt-3 flex gap-1 overflow-x-auto">
          {tabs.map(({ key, label, icon: Icon, badge }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                tab === key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="size-4" /> {label}
              {badge ? <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", key === "pricing" ? "bg-amber-500/15 text-amber-700" : "bg-muted text-muted-foreground")}>{badge}</span> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-6">
          {/* ───────── Detalles ───────── */}
          {tab === "details" && (
            <>
              <Section icon={DoorOpen} title="Datos básicos" description="Cómo se ve la sala al reservar y a qué escape pertenece">
                <div className="grid gap-6 md:grid-cols-[260px_minmax(0,1fr)]">
                  <div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { e.preventDefault(); uploadFile(e.dataTransfer.files?.[0]); }}
                      className="group relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed bg-muted/40 text-sm text-muted-foreground hover:border-primary/50"
                    >
                      {imageUrl ? (
                        <>
                          <img src={imageUrl} alt="" className="absolute inset-0 size-full object-cover" />
                          <span className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100">
                            <ImagePlus className="size-4" /> Cambiar imagen
                          </span>
                        </>
                      ) : (
                        <span className="flex flex-col items-center gap-2"><ImagePlus className="size-6" />Arrastra o elige una imagen</span>
                      )}
                      {uploading && <span className="absolute inset-0 flex items-center justify-center bg-background/70"><Loader2 className="size-5 animate-spin" /></span>}
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadFile(e.target.files?.[0])} />
                    {imageUrl && (
                      <button type="button" className="mt-2 text-xs text-muted-foreground hover:text-destructive" onClick={() => form.setValue("imageUrl", "", { shouldDirty: true })}>
                        Quitar imagen
                      </button>
                    )}
                  </div>

                  <div className="space-y-5">
                    <Field label="Nombre" error={errors.name?.message}>
                      <Input {...form.register("name")} />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Escape" hint="Solo su equipo verá la sala y sus reservas">
                        <select className="h-9 w-full rounded-md border bg-transparent px-3 text-sm" {...form.register("escape")}>
                          {ESCAPES.filter((e) => allowedEscapes.includes(e) || e === room.escape).map((e) => (
                            <option key={e} value={e} disabled={!allowedEscapes.includes(e)}>{e}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Estado">
                        <label className="flex h-9 cursor-pointer items-center justify-between rounded-md border px-3">
                          <span className="text-sm">{active ? "Activa, se puede reservar" : "Inactiva, oculta"}</span>
                          <Switch checked={active} onCheckedChange={(v) => form.setValue("active", v, { shouldDirty: true })} />
                        </label>
                      </Field>
                    </div>
                  </div>
                </div>
              </Section>

              <Section icon={Users} title="Partida" description="Duración y número de jugadores">
                <div className="grid gap-6 sm:grid-cols-2">
                  <Field label="Duración de la sesión" error={errors.durationMinutes?.message}>
                    <div className="flex flex-wrap gap-2">
                      {[45, 60, 75, 90, 120].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => form.setValue("durationMinutes", m, { shouldDirty: true, shouldValidate: true })}
                          className={cn("rounded-lg border px-3 py-1.5 text-sm tabular-nums", duration === m ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary/50")}
                        >
                          {m} min
                        </button>
                      ))}
                      <Input type="number" min={30} max={180} step={5} className="w-24" aria-label="Otra duración" {...form.register("durationMinutes", { valueAsNumber: true })} />
                    </div>
                  </Field>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Mínimo de jugadores" error={errors.capacityMin?.message}>
                      <Stepper value={capacityMin} onChange={(v) => form.setValue("capacityMin", v, { shouldDirty: true, shouldValidate: true })} />
                    </Field>
                    <Field label="Máximo">
                      <Stepper value={capacityMax} min={capacityMin} onChange={(v) => form.setValue("capacityMax", v, { shouldDirty: true, shouldValidate: true })} />
                    </Field>
                  </div>
                </div>
              </Section>

              <Section icon={Link2} title="Salas vinculadas" description="Comparten espacio: si una está reservada, esta queda bloqueada a esa hora">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="h-auto min-h-10 w-full justify-between py-2">
                      <span className="flex flex-wrap gap-1.5">
                        {linked.length ? linked.map((id) => (
                          <span key={id} className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
                            {rooms.find((r) => r._id === id)?.name ?? "…"}
                            <span
                              role="button"
                              tabIndex={0}
                              aria-label="Quitar"
                              className="hover:text-destructive"
                              onClick={(e) => { e.stopPropagation(); form.setValue("linkedRooms", linked.filter((x) => x !== id), { shouldDirty: true }); }}
                            >
                              <X className="size-3" />
                            </span>
                          </span>
                        )) : <span className="text-muted-foreground">Ninguna (puede jugarse a la vez que cualquier otra)</span>}
                      </span>
                      <ChevronDown className="size-4 opacity-60" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[280px] p-0">
                    <Command>
                      <CommandInput placeholder="Buscar sala…" />
                      <CommandEmpty>No hay salas de {escape}.</CommandEmpty>
                      <CommandGroup>
                        {linkable.map((r) => {
                          const selected = linked.includes(r._id);
                          return (
                            <CommandItem
                              key={r._id}
                              value={r.name}
                              onSelect={() => form.setValue("linkedRooms", selected ? linked.filter((x) => x !== r._id) : [...linked, r._id], { shouldDirty: true })}
                            >
                              <span className={cn("mr-2 flex size-4 items-center justify-center rounded-sm border", selected && "bg-primary text-primary-foreground")}>
                                {selected && <Check className="size-3" />}
                              </span>
                              {r.name}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </Section>

              <section className="rounded-2xl border border-destructive/30 p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-destructive">Eliminar sala</h2>
                    <p className="text-sm text-muted-foreground">No se puede deshacer. Si solo quieres ocultarla, márcala como inactiva.</p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button type="button" variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10"><Trash className="size-4" /> Eliminar</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar {name}?</AlertDialogTitle>
                        <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={onDelete}>Eliminar</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </section>
            </>
          )}

          {/* ───────── Precios ───────── */}
          {tab === "pricing" && (
            <Section icon={Euro} title="Precios por grupo" description={`Precio total según el número de jugadores (${capacityMin}–${capacityMax})`}>
              <div className="mb-5 rounded-xl bg-muted/50 p-4">
                <p className="mb-3 flex items-center gap-2 text-sm font-medium"><Wand2 className="size-4 text-primary" /> Rellenar automáticamente</p>
                <div className="flex flex-wrap items-end gap-3 text-sm">
                  <Field label="€ por persona" className="w-28"><Input type="number" value={basePerPerson} onChange={(e) => setBasePerPerson(Number(e.target.value))} /></Field>
                  <Field label="A partir de" className="w-28"><Input type="number" value={fromPlayers} onChange={(e) => setFromPlayers(Number(e.target.value))} /></Field>
                  <Field label="€ por persona" className="w-28"><Input type="number" value={perPersonFrom} onChange={(e) => setPerPersonFrom(Number(e.target.value))} /></Field>
                  <Button type="button" onClick={autoFill}><Sparkles className="size-4" /> Aplicar</Button>
                </div>
              </div>

              {missingPrices > 0 && (
                <p className="mb-3 flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-800">
                  <Info className="size-4" /> {missingPrices} {missingPrices === 1 ? "tamaño de grupo no tiene" : "tamaños de grupo no tienen"} precio: no se podrán reservar.
                </p>
              )}

              <div className="overflow-hidden rounded-xl border">
                <div className="grid grid-cols-[110px_minmax(0,1fr)_120px] gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <span>Jugadores</span><span>Precio total</span><span className="text-right">Por persona</span>
                </div>
                <div className="divide-y">
                  {priceFields.map((row, idx) => {
                    const players = Number(priceTable[idx]?.players ?? row.players);
                    const price = Number(priceTable[idx]?.price) || 0;
                    const pp = players ? price / players : 0;
                    return (
                      <div key={row._key} className="grid grid-cols-[110px_minmax(0,1fr)_120px] items-center gap-3 px-4 py-2">
                        <span className="flex items-center gap-2 text-sm font-medium"><Users className="size-3.5 text-muted-foreground" />{players}</span>
                        <div className="relative max-w-40">
                          <Input
                            type="number"
                            min={0}
                            step="1"
                            className={cn("pr-7 tabular-nums", !price && "border-amber-400")}
                            {...form.register(`priceTable.${idx}.price` as const, { valueAsNumber: true })}
                          />
                          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <span className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-muted sm:block">
                            <span className="block h-full rounded-full bg-primary/60" style={{ width: `${(pp / perPersonMax) * 100}%` }} />
                          </span>
                          <span className="w-14 text-right text-sm tabular-nums text-muted-foreground">{pp ? eur(pp) : "—"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Para subir o bajar el precio un día concreto, usa <button type="button" className="text-primary underline" onClick={() => setTab("dates")}>Fechas especiales</button>.</p>
            </Section>
          )}

          {/* ───────── Horario ───────── */}
          {tab === "schedule" && (
            <Section
              icon={Clock}
              title="Horario semanal"
              description={`Sesiones de ${duration} min. Activa cada día y ajusta sus horas.`}
              action={
                <Button type="button" variant="outline" size="sm" onClick={() => setGenOpen((v) => !v)}>
                  <Wand2 className="size-4" /> Generar franjas
                </Button>
              }
            >
              {genOpen && (
                <div className="mb-5 space-y-3 rounded-xl bg-muted/50 p-4">
                  <div className="flex flex-wrap items-end gap-3">
                    <Field label="Desde" className="w-28"><Input type="time" value={gen.from} onChange={(e) => setGen({ ...gen, from: e.target.value })} /></Field>
                    <Field label="Hasta" className="w-28"><Input type="time" value={gen.to} onChange={(e) => setGen({ ...gen, to: e.target.value })} /></Field>
                    <Field label="Cada (min)" className="w-28"><Input type="number" min={duration} step={5} value={gen.every} onChange={(e) => setGen({ ...gen, every: Number(e.target.value) })} /></Field>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {DAYS.map((d) => {
                      const on = gen.days.includes(d.key);
                      return (
                        <button
                          key={d.key}
                          type="button"
                          onClick={() => setGen({ ...gen, days: on ? gen.days.filter((x) => x !== d.key) : [...gen.days, d.key] })}
                          className={cn("size-9 rounded-full border text-sm font-medium", on ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground")}
                          aria-pressed={on}
                          title={d.label}
                        >
                          {d.short}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="button" size="sm" onClick={generate}><Sparkles className="size-4" /> Generar y reemplazar</Button>
                    <span className="text-xs text-muted-foreground">Sustituye las franjas de los días marcados.</span>
                  </div>
                </div>
              )}
              <div className="divide-y">
                {DAYS.map((d) => (
                  <DayRow key={d.key} day={d} control={form.control} form={form} duration={duration} onCopy={copyDay} />
                ))}
              </div>
            </Section>
          )}

          {/* ───────── Fechas especiales ───────── */}
          {tab === "dates" && (
            <>
              <Section
                icon={CalendarOff}
                title="Días cerrados"
                description="La sala no se puede reservar online. El cliente verá un aviso para llamar."
                action={<Button type="button" variant="outline" size="sm" onClick={() => dayOffAppend({ date: "", reason: "", message: "" })}><Plus className="size-4" /> Añadir</Button>}
              >
                {dayOffFields.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay días cerrados.</p>
                ) : (
                  <div className="space-y-3">
                    {dayOffFields.map((row, idx) => (
                      <div key={row._key} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[160px_minmax(0,1fr)_auto] sm:items-end">
                        <Field label="Fecha" error={errors.schedule?.daysOff?.[idx]?.date?.message}><Input type="date" {...form.register(`schedule.daysOff.${idx}.date` as const)} /></Field>
                        <Field label="Motivo (interno)"><Input placeholder="Festivo, mantenimiento…" {...form.register(`schedule.daysOff.${idx}.reason` as const)} /></Field>
                        <Button type="button" variant="ghost" size="icon" onClick={() => dayOffRemove(idx)} aria-label="Quitar"><Trash2 className="size-4" /></Button>
                        <Field label="Mensaje para clientes (opcional)" className="sm:col-span-3">
                          <Input placeholder="Ej.: Este día solo aceptamos grupos por teléfono, llámanos." {...form.register(`schedule.daysOff.${idx}.message` as const)} />
                        </Field>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              <Section
                icon={CalendarClock}
                title="Días con horario distinto"
                description="Para una fecha concreta se usan estas franjas en lugar del horario semanal."
                action={<Button type="button" variant="outline" size="sm" onClick={() => overrideAppend({ date: "", slots: [] })}><Plus className="size-4" /> Añadir</Button>}
              >
                {overrideFields.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay días con horario distinto.</p>
                ) : (
                  <div className="space-y-3">
                    {overrideFields.map((row, i) => <OverrideEditor key={row._key} index={i} control={form.control} onRemove={overrideRemove} />)}
                  </div>
                )}
              </Section>

              <Section
                icon={Tag}
                title="Precios especiales"
                description="Sube o baja el precio un día (o unas horas). Se aplica sobre la tabla de precios, antes del cupón."
                action={<Button type="button" variant="outline" size="sm" onClick={() => priceRuleAppend({ date: "", start: "", end: "", adjustType: "percent", value: -10, label: "" })}><Plus className="size-4" /> Añadir</Button>}
              >
                {priceRuleFields.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay precios especiales.</p>
                ) : (
                  <div className="space-y-3">
                    {priceRuleFields.map((row, idx) => (
                      <div key={row._key} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[150px_110px_110px_150px_100px_auto] sm:items-end">
                        <Field label="Fecha" error={errors.schedule?.priceRules?.[idx]?.date?.message}><Input type="date" {...form.register(`schedule.priceRules.${idx}.date` as const)} /></Field>
                        <Field label="Desde"><Input type="time" {...form.register(`schedule.priceRules.${idx}.start` as const)} /></Field>
                        <Field label="Hasta"><Input type="time" {...form.register(`schedule.priceRules.${idx}.end` as const)} /></Field>
                        <Field label="Ajuste">
                          <select className="h-9 w-full rounded-md border bg-transparent px-2 text-sm" {...form.register(`schedule.priceRules.${idx}.adjustType` as const)}>
                            <option value="percent">% del precio</option>
                            <option value="amount">€ por grupo</option>
                          </select>
                        </Field>
                        <Field label="Valor (−/+)" error={errors.schedule?.priceRules?.[idx]?.value?.message}><Input type="number" step="0.01" {...form.register(`schedule.priceRules.${idx}.value` as const)} /></Field>
                        <Button type="button" variant="ghost" size="icon" onClick={() => priceRuleRemove(idx)} aria-label="Quitar"><Trash2 className="size-4" /></Button>
                        <Field label="Nombre (se muestra al reservar)" className="sm:col-span-6"><Input placeholder="Ej.: Black Friday" {...form.register(`schedule.priceRules.${idx}.label` as const)} /></Field>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground"><strong>−20</strong> con % = 20 % más barato · <strong>+10</strong> con € = 10 € más caro por grupo. Sin horas, aplica todo el día.</p>
                  </div>
                )}
              </Section>
            </>
          )}
        </div>

        {/* ── Resumen lateral ── */}
        <aside className="hidden xl:block">
          <div className="sticky top-40 space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Resumen</p>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Jugadores</dt><dd className="font-medium tabular-nums">{capacityMin}–{capacityMax}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Duración</dt><dd className="font-medium tabular-nums">{duration} min</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Precio</dt><dd className="font-medium tabular-nums">{prices.length ? `${eur(Math.min(...prices))} – ${eur(Math.max(...prices))}` : "—"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Sesiones / semana</dt><dd className="font-medium tabular-nums">{weeklySessions}</dd></div>
            </dl>
            <div>
              <p className="mb-2 text-xs text-muted-foreground">Días abiertos</p>
              <div className="flex gap-1">
                {DAYS.map((d) => {
                  const on = openDays.some((o) => o.key === d.key);
                  return <span key={d.key} title={d.label} className={cn("flex size-7 items-center justify-center rounded-md text-xs font-medium", on ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground/50")}>{d.short}</span>;
                })}
              </div>
            </div>
            {(missingPrices > 0 || weeklySessions === 0) && (
              <div className="space-y-1 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-800">
                {missingPrices > 0 && <p>· Faltan {missingPrices} precios</p>}
                {weeklySessions === 0 && <p>· No hay horario: no se puede reservar</p>}
              </div>
            )}
          </div>
        </aside>
      </div>
    </form>
  );
}
