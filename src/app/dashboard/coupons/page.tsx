"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarDays, ChevronDown, DoorOpen, Euro, Loader2, Pencil, Percent, Plus, Search, TicketPercent, Trash2, UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type Coupon = {
  _id: string; code: string; type: "percent" | "amount"; value: number; roomId?: string | null;
  startDate: string; endDate: string; maxUses: number; usedCount?: number; active?: boolean;
  /** Importado de la plataforma anterior */
  legacy?: boolean;
};
type Usage = Record<string, { rooms: { roomId: string; name: string; uses: number; cancelled: number; revenue: number }[]; uses: number; revenue: number; last: string | null }>;
type Room = { _id: string; name: string };
type FormState = { code: string; type: "percent" | "amount"; value: string; roomId: string; startDate: string; endDate: string; maxUses: string; active: boolean };

const ymd = (d: Date | string) => new Date(d).toLocaleDateString("sv-SE");
const fmt = (d: string) => new Date(d).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
const eur = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

function couponStatus(c: Coupon) {
  const now = new Date();
  const start = new Date(c.startDate);
  const end = new Date(c.endDate);
  end.setHours(23, 59, 59, 999);
  if (c.active === false) return { key: "off", label: "Desactivado", tone: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/60" };
  if ((c.usedCount ?? 0) >= (c.maxUses ?? Infinity)) return { key: "used", label: "Agotado", tone: "bg-rose-500/10 text-rose-700", dot: "bg-rose-500" };
  if (now > end) return { key: "expired", label: "Caducado", tone: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/60" };
  if (now < start) return { key: "scheduled", label: "Programado", tone: "bg-sky-500/10 text-sky-700", dot: "bg-sky-500" };
  return { key: "active", label: "Activo", tone: "bg-emerald-500/10 text-emerald-700", dot: "bg-emerald-500" };
}

const emptyForm = (): FormState => {
  const today = new Date();
  const inAMonth = new Date(today);
  inAMonth.setMonth(today.getMonth() + 1);
  return { code: "", type: "percent", value: "10", roomId: "", startDate: ymd(today), endDate: ymd(inAMonth), maxUses: "50", active: true };
};

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [usage, setUsage] = useState<Usage>({});
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const [dialog, setDialog] = useState<null | { mode: "create" | "edit"; original?: Coupon }>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [c, u, r] = await Promise.all([
        fetch("/api/coupons", { cache: "no-store" }).then((x) => x.json()),
        fetch("/api/coupons/usage", { cache: "no-store" }).then((x) => (x.ok ? x.json() : { usage: {} })),
        fetch("/api/rooms", { cache: "no-store" }).then((x) => (x.ok ? x.json() : [])),
      ]);
      setCoupons((c.coupons ?? []).map((x: Coupon) => ({ ...x, _id: String(x._id), roomId: x.roomId ? String(x.roomId) : null })));
      setUsage(u.usage ?? {});
      setRooms(Array.isArray(r) ? r : []);
    } catch {
      toast.error("No se pudieron cargar los cupones");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const roomName = useMemo(() => new Map(rooms.map((r) => [r._id, r.name])), [rooms]);
  const visible = coupons.filter((c) => {
    const st = couponStatus(c).key;
    const matchesQuery = c.code.toLowerCase().includes(query.trim().toLowerCase());
    const matchesFilter = filter === "all" || (filter === "active" ? st === "active" || st === "scheduled" : st !== "active" && st !== "scheduled");
    return matchesQuery && matchesFilter;
  });

  function openCreate() {
    setForm(emptyForm());
    setDialog({ mode: "create" });
  }
  function openEdit(c: Coupon) {
    setForm({
      code: c.code, type: c.type, value: String(c.value), roomId: c.roomId ?? "",
      startDate: ymd(c.startDate), endDate: ymd(c.endDate), maxUses: String(c.maxUses), active: c.active !== false,
    });
    setDialog({ mode: "edit", original: c });
  }

  async function save() {
    const value = Number(form.value);
    const maxUses = Number(form.maxUses);
    if (dialog?.mode === "create" && !/^[A-Z0-9_-]{3,30}$/.test(form.code)) return toast.error("Código: 3–30 caracteres, letras, números, - o _");
    if (!(value > 0)) return toast.error("El valor debe ser mayor que 0");
    if (form.type === "percent" && value > 100) return toast.error("Un porcentaje no puede ser mayor que 100");
    if (!(maxUses >= 1)) return toast.error("Usos máximos: al menos 1");
    if (form.endDate < form.startDate) return toast.error("La fecha de fin es anterior a la de inicio");

    const body = {
      type: form.type, value, roomId: form.roomId || null, maxUses, active: form.active,
      startDate: `${form.startDate}T00:00:00`, endDate: `${form.endDate}T23:59:59`,
    };
    setSaving(true);
    try {
      const res =
        dialog?.mode === "edit"
          ? await fetch(`/api/coupons/${encodeURIComponent(form.code)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
          : await fetch("/api/coupons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, code: form.code }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error);
      toast.success(dialog?.mode === "edit" ? "Cupón actualizado" : "Cupón creado");
      setDialog(null);
      load();
    } catch (e) {
      toast.error("No se pudo guardar", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  async function remove(code: string) {
    if (!confirm(`¿Eliminar el cupón ${code}? Las reservas que lo usaron lo conservan.`)) return;
    const res = await fetch(`/api/coupons/${encodeURIComponent(code)}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (data.ok) {
      toast.success("Cupón eliminado");
      load();
    } else toast.error(data.error || "No se pudo eliminar");
  }

  const original = dialog?.original;
  const expiredWhileEditing = original && couponStatus(original).key === "expired";

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cupones</h1>
          <p className="mt-1 text-sm text-muted-foreground">Descuentos, su vigencia y en qué salas se han usado.</p>
        </div>
        <Button onClick={openCreate}><Plus className="size-4" /> Nuevo cupón</Button>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="inline-flex rounded-lg bg-muted p-1">
            {([["all", "Todos"], ["active", "Vigentes"], ["inactive", "Caducados / agotados"]] as const).map(([k, label]) => (
              <button key={k} type="button" onClick={() => setFilter(k)} className={cn("rounded-md px-3 py-1.5 text-sm font-medium", filter === k ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                {label}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Buscar cupón" placeholder="Buscar por código" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center p-12" role="status"><Loader2 className="size-5 animate-spin text-primary" /></div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><TicketPercent className="size-6" /></span>
            <p className="font-medium">{query || filter !== "all" ? "No hay resultados" : "Aún no hay cupones"}</p>
          </div>
        ) : (
          <ul className="divide-y">
            {visible.map((c) => {
              const st = couponStatus(c);
              const used = c.usedCount ?? 0;
              const pct = Math.min(100, Math.round((used / Math.max(1, c.maxUses)) * 100));
              const u = usage[c.code];
              const isOpen = expanded === c._id;
              const dimmed = st.key !== "active" && st.key !== "scheduled";
              return (
                <li key={c._id} className={cn(dimmed && "bg-muted/25")}>
                  <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-4">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><TicketPercent className="size-5" /></span>
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-semibold tracking-wide">{c.code}</span>
                          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", st.tone)}><span className={cn("size-1.5 rounded-full", st.dot)} />{st.label}</span>
                          {c.legacy && <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground" title="Importado con las reservas de la plataforma anterior">Plataforma anterior</span>}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          <strong className="text-foreground">{c.type === "percent" ? `${c.value} %` : eur(c.value)}</strong> de descuento ·{" "}
                          {c.roomId ? roomName.get(c.roomId) ?? "Sala específica" : "Todas las salas"}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-muted-foreground sm:flex sm:flex-wrap sm:items-center">
                      <span className="flex min-w-36 flex-col gap-1.5">
                        <span className="flex items-center gap-2"><UsersRound className="size-4" /><span className="tabular-nums">{used} / {c.maxUses} usos</span></span>
                        <span className="h-1.5 w-full overflow-hidden rounded-full bg-muted"><span className={cn("block h-full rounded-full", pct >= 100 ? "bg-rose-500" : "bg-primary")} style={{ width: `${pct}%` }} /></span>
                      </span>
                      <span className="flex items-center gap-2"><CalendarDays className="size-4" />{fmt(c.startDate)} – {fmt(c.endDate)}</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setExpanded(isOpen ? null : c._id)} aria-expanded={isOpen}>
                        <DoorOpen className="size-4" /> {u ? `${u.rooms.length} ${u.rooms.length === 1 ? "sala" : "salas"}` : "Sin usos"}
                        <ChevronDown className={cn("size-3.5 transition-transform", isOpen && "rotate-180")} />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openEdit(c)}><Pencil className="size-4" /> Editar</Button>
                      <Button size="sm" variant="outline" onClick={() => remove(c.code)} className="text-destructive hover:text-destructive" aria-label={`Eliminar ${c.code}`}><Trash2 className="size-4" /></Button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="border-t bg-muted/20 px-5 py-4">
                      {!u ? (
                        <p className="text-sm text-muted-foreground">Ninguna reserva ha usado este cupón todavía.</p>
                      ) : (
                        <>
                          <p className="mb-3 text-sm text-muted-foreground">
                            Usado en <strong className="text-foreground">{u.uses}</strong> reservas · <strong className="text-foreground">{eur(u.revenue)}</strong> facturado con él
                            {u.last && <> · último uso para el {fmt(u.last)}</>}
                          </p>
                          <ul className="space-y-2">
                            {u.rooms.map((r) => {
                              const max = Math.max(...u.rooms.map((x) => x.uses), 1);
                              return (
                                <li key={r.roomId} className="grid grid-cols-[minmax(0,160px)_minmax(0,1fr)_auto] items-center gap-3 text-sm">
                                  <span className="truncate">{r.name}</span>
                                  <span className="h-2.5 rounded-r bg-muted"><span className="block h-full rounded-r bg-primary" style={{ width: `${(r.uses / max) * 100}%` }} /></span>
                                  <span className="tabular-nums text-muted-foreground">
                                    {r.uses} {r.uses === 1 ? "uso" : "usos"} · {eur(r.revenue)}
                                    {r.cancelled ? <span className="ml-1 text-xs">({r.cancelled} cancel.)</span> : null}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── Crear / editar ── */}
      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-lg">
          <DialogHeader className="border-b p-5">
            <DialogTitle>{dialog?.mode === "edit" ? `Editar ${form.code}` : "Nuevo cupón"}</DialogTitle>
            <DialogDescription>
              {expiredWhileEditing ? "Este cupón está caducado: amplía la fecha de fin para volver a activarlo." : "Descuento que el cliente aplica al reservar."}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 space-y-5 overflow-y-auto p-5">
            <div className="space-y-1.5">
              <label htmlFor="cp-code" className="text-sm font-medium">Código</label>
              <Input
                id="cp-code"
                value={form.code}
                disabled={dialog?.mode === "edit"}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s+/g, "") })}
                placeholder="HALLOWEEN25"
                className="font-mono uppercase"
              />
              {dialog?.mode === "edit" && <p className="text-xs text-muted-foreground">El código no se puede cambiar porque ya puede estar en reservas.</p>}
            </div>

            <div className="grid grid-cols-[auto_1fr] items-end gap-3">
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Tipo</p>
                <div className="inline-flex rounded-lg bg-muted p-1">
                  {([["percent", Percent, "%"], ["amount", Euro, "€"]] as const).map(([t, Icon, label]) => (
                    <button key={t} type="button" onClick={() => setForm({ ...form, type: t })} className={cn("flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium", form.type === t ? "bg-card shadow-sm" : "text-muted-foreground")}>
                      <Icon className="size-3.5" /> {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="cp-value" className="text-sm font-medium">Descuento</label>
                <div className="relative">
                  <Input id="cp-value" inputMode="decimal" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="pr-8 tabular-nums" />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{form.type === "percent" ? "%" : "€"}</span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="cp-room" className="text-sm font-medium">Sala</label>
              <select id="cp-room" value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })} className="h-9 w-full rounded-md border bg-transparent px-3 text-sm">
                <option value="">Todas las salas</option>
                {rooms.map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="cp-start" className="text-sm font-medium">Válido desde</label>
                <Input id="cp-start" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="cp-end" className="text-sm font-medium">Hasta</label>
                <Input id="cp-end" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 items-end gap-3">
              <div className="space-y-1.5">
                <label htmlFor="cp-uses" className="text-sm font-medium">Usos máximos</label>
                <Input id="cp-uses" type="number" min={1} value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} />
                {original && <p className="text-xs text-muted-foreground">Ya usado {original.usedCount ?? 0} veces</p>}
              </div>
              <label className="flex h-9 cursor-pointer items-center justify-between rounded-md border px-3">
                <span className="text-sm">Activo</span>
                <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              </label>
            </div>
          </div>

          <DialogFooter className="border-t p-4">
            <Button variant="outline" onClick={() => setDialog(null)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="size-4 animate-spin" />}{dialog?.mode === "edit" ? "Guardar cambios" : "Crear cupón"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
