"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Percent, Euro, Search, TicketPercent, CalendarDays, UsersRound } from "lucide-react";

function couponStatus(c: any) {
  const now = new Date();
  const start = new Date(c.startDate);
  const end = new Date(c.endDate);
  end.setHours(23, 59, 59, 999);
  if ((c.usedCount ?? 0) >= (c.maxUses ?? Infinity)) return { key: "used", label: "Agotado", tone: "bg-rose-500/10 text-rose-700", dot: "bg-rose-500" };
  if (now > end) return { key: "expired", label: "Caducado", tone: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/60" };
  if (now < start) return { key: "scheduled", label: "Programado", tone: "bg-sky-500/10 text-sky-700", dot: "bg-sky-500" };
  return { key: "active", label: "Activo", tone: "bg-emerald-500/10 text-emerald-700", dot: "bg-emerald-500" };
}

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const visibleCoupons = coupons.filter((coupon) => String(coupon.code).toLowerCase().includes(query.trim().toLowerCase()));

  const [form, setForm] = useState({
    code: "",
    type: "percent" as "percent" | "amount",
    value: 0,
    roomId: "",
    startDate: new Date(),
    endDate: new Date(),
    maxUses: 1,
  });

  async function loadCoupons() {
    setLoading(true);
    const res = await fetch("/api/coupons");
    const data = await res.json();
    setCoupons(data.coupons || []);
    setLoading(false);
  }

  async function createCoupon() {
    if (!form.code.trim()) return toast.error("Debes introducir un código");
    if (form.value <= 0) return toast.error("El valor debe ser mayor que 0");

    const res = await fetch("/api/coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await res.json();
    if (data.ok) {
      toast.success("Cupón creado correctamente");
      setOpen(false);
      loadCoupons();
      setForm({
        code: "",
        type: "percent",
        value: 0,
        roomId: "",
        startDate: new Date(),
        endDate: new Date(),
        maxUses: 1,
      });
    } else {
      toast.error(data.error || "Error al crear cupón");
    }
  }

  async function deleteCoupon(code: string) {
    if (!confirm(`¿Eliminar cupón ${code}?`)) return;
    const res = await fetch(`/api/coupons/${code}`, { method: "DELETE" });
    const data = await res.json();
    if (data.ok) {
      toast.success("Cupón eliminado");
      loadCoupons();
    } else toast.error(data.error);
  }

  useEffect(() => {
    loadCoupons();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div><h1 className="text-2xl font-semibold tracking-tight">Cupones</h1><p className="mt-1 text-sm text-muted-foreground">Consulta y gestiona los descuentos disponibles.</p></div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> Nuevo cupón
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div><h2 className="text-base font-semibold">Descuentos creados</h2><p className="mt-1 text-sm text-muted-foreground">Consulta su vigencia y los usos disponibles.</p></div>
          <div className="relative w-full sm:max-w-xs"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Buscar cupón" placeholder="Buscar por código" value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" /></div>
        </div>
        {loading ? <div className="flex justify-center p-12" role="status"><Loader2 className="size-5 animate-spin text-primary" /><span className="sr-only">Cargando cupones…</span></div> : visibleCoupons.length === 0 ? <div className="flex flex-col items-center gap-3 px-6 py-14 text-center"><span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><TicketPercent className="size-6" /></span><p className="font-medium">{query ? "No hay resultados" : "Aún no hay cupones"}</p><p className="text-sm text-muted-foreground">{query ? "Prueba con otro código." : "Crea un cupón para ofrecer un descuento."}</p></div> : <div className="divide-y">{visibleCoupons.map((c) => (() => { const st = couponStatus(c); const pct = Math.min(100, Math.round(((c.usedCount ?? 0) / Math.max(1, c.maxUses ?? 1)) * 100)); return <div key={c._id} className={`flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6 ${st.key === "active" || st.key === "scheduled" ? "" : "bg-muted/30"}`}><div className="flex min-w-0 flex-1 items-center gap-4"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><TicketPercent className="size-5" /></span><div className="min-w-0"><p className="flex flex-wrap items-center gap-2"><span className="break-all font-mono font-semibold tracking-wide">{c.code}</span><span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${st.tone}`}><span className={`size-1.5 rounded-full ${st.dot}`} />{st.label}</span></p><p className="mt-1 text-sm text-muted-foreground">{c.type === "percent" ? `${c.value}% de descuento` : `${Number(c.value).toFixed(2)} € de descuento`}{c.roomId ? " · Sala específica" : " · Todas las salas"}</p></div></div><div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground"><span className="flex min-w-36 flex-col gap-1.5"><span className="flex items-center gap-2"><UsersRound className="size-4" /><span className="tabular-nums">{c.usedCount ?? 0} / {c.maxUses} usos</span></span><span className="h-1.5 w-full overflow-hidden rounded-full bg-muted"><span className={`block h-full rounded-full ${pct >= 100 ? "bg-rose-500" : "bg-primary"}`} style={{ width: `${pct}%` }} /></span></span><span className="flex items-center gap-2"><CalendarDays className="size-4" />{new Date(c.startDate).toLocaleDateString("es-ES")} – {new Date(c.endDate).toLocaleDateString("es-ES")}</span></div><Button size="sm" variant="outline" onClick={() => deleteCoupon(c.code)} className="w-fit text-destructive hover:text-destructive"><Trash2 className="size-4" />Eliminar</Button></div>; })())}</div>}
      </div>

      {/* ───────── Modal ───────── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="w-full max-w-[700px] p-0 overflow-hidden rounded-xl shadow-xl"
          aria-describedby={undefined}
        >
          {/* Header */}
          <DialogHeader className="p-5 border-b bg-muted/30">
            <DialogTitle className="text-lg font-semibold tracking-tight">
              Crear nuevo cupón
            </DialogTitle>
          </DialogHeader>

          {/* Contenido scrollable */}
          <div className="max-h-[70vh] overflow-y-auto px-6 py-5 space-y-5 bg-background">
            {/* Código */}
            <div className="space-y-1">
              <Label htmlFor="coupon-code" className="font-medium">Código *</Label>
              <Input
                id="coupon-code" placeholder="Ej: HALLOWEEN25"
                value={form.code}
                onChange={(e) =>
                  setForm({ ...form, code: e.target.value.toUpperCase() })
                }
              />
              <p className="text-xs text-muted-foreground">
                Usa mayúsculas y sin espacios.
              </p>
            </div>

            {/* Tipo + Valor */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="coupon-type">Tipo *</Label>
                <Select
                  value={form.type}
                  onValueChange={(v: "percent" | "amount") =>
                    setForm({ ...form, type: v })
                  }
                >
                  <SelectTrigger id="coupon-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Porcentaje (%)</SelectItem>
                    <SelectItem value="amount">Cantidad (€)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="coupon-value">
                  Valor {form.type === "percent" ? "(%)" : "(€)"} *
                </Label>
                <div className="relative">
                  <Input id="coupon-value"
                    type="number"
                    min={0}
                    step={form.type === "amount" ? "0.01" : "1"}
                    value={form.value}
                    onChange={(e) =>
                      setForm({ ...form, value: parseFloat(e.target.value) })
                    }
                    placeholder={
                      form.type === "percent"
                        ? "Ej: 15"
                        : "Ej: 10.00"
                    }
                    className="pr-8"
                  />
                  {form.type === "percent" ? (
                    <Percent className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Euro className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            </div>

            {/* Usos */}
            <div>
              <Label htmlFor="coupon-uses">Usos máximos *</Label>
              <Input id="coupon-uses"
                type="number"
                min={1}
                value={form.maxUses}
                onChange={(e) =>
                  setForm({ ...form, maxUses: parseInt(e.target.value) })
                }
              />
            </div>

            {/* Fechas */}
            <div>
              <Label>Fechas válidas *</Label>
              <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col items-center border rounded-md p-2">
                  <p className="text-xs text-muted-foreground mb-1">Desde</p>
                  <Calendar
                    mode="single"
                    selected={form.startDate}
                    onSelect={(date) =>
                      date && setForm({ ...form, startDate: date })
                    }
                    className="rounded-md border bg-background"
                  />
                </div>
                <div className="flex flex-col items-center border rounded-md p-2">
                  <p className="text-xs text-muted-foreground mb-1">Hasta</p>
                  <Calendar
                    mode="single"
                    selected={form.endDate}
                    onSelect={(date) =>
                      date && setForm({ ...form, endDate: date })
                    }
                    className="rounded-md border bg-background"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="border-t bg-muted/30 p-5">
            <Button onClick={createCoupon} className="w-full">
              Guardar cupón
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
