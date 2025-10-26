"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
import { Loader2, Plus, Trash2, Percent, Euro } from "lucide-react";

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

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
      toast.success("✅ Cupón creado correctamente");
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
      toast.success("🗑️ Cupón eliminado");
      loadCoupons();
    } else toast.error(data.error);
  }

  useEffect(() => {
    loadCoupons();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Cupones</h1>
        <Button onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> Nuevo cupón
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : coupons.length === 0 ? (
        <p className="text-muted-foreground italic">
          No hay cupones creados todavía
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {coupons.map((c) => (
            <Card key={c._id}>
              <CardHeader>
                <CardTitle>{c.code}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                <p>
                  Tipo:{" "}
                  {c.type === "percent"
                    ? `${c.value}%`
                    : `${c.value.toFixed(2)} €`}
                </p>
                <p>
                  Usos: {c.usedCount} / {c.maxUses}
                </p>
                <p>
                  Fechas: {new Date(c.startDate).toLocaleDateString()} →{" "}
                  {new Date(c.endDate).toLocaleDateString()}
                </p>
                {c.roomId && <p>🎯 Asignado a sala específica</p>}
                <div className="pt-3">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteCoupon(c.code)}
                    className="w-full"
                  >
                    <Trash2 className="w-4 h-4 mr-1" /> Eliminar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ───────── Modal ───────── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="w-full max-w-[700px] p-0 overflow-hidden rounded-xl shadow-xl"
          aria-describedby="form-coupon"
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
              <Label className="font-medium">Código *</Label>
              <Input
                placeholder="Ej: HALLOWEEN25"
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
                <Label>Tipo *</Label>
                <Select
                  value={form.type}
                  onValueChange={(v: "percent" | "amount") =>
                    setForm({ ...form, type: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Porcentaje (%)</SelectItem>
                    <SelectItem value="amount">Cantidad (€)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>
                  Valor {form.type === "percent" ? "(%)" : "(€)"} *
                </Label>
                <div className="relative">
                  <Input
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
              <Label>Usos máximos *</Label>
              <Input
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
              <div className="grid grid-cols-2 gap-4 mt-2">
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
