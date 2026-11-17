"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL, type Payment, type PaymentMethod, type PaymentStatus } from "@/lib/payments";
import { cn } from "@/lib/utils";

export type PaymentRow = { _id: string; roomName: string; start: string; price: number; payment: Payment; customer: { name: string } | null };

const eur = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

export function PaymentDialog({ row, onOpenChange, onSaved }: { row: PaymentRow | null; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [status, setStatus] = useState<PaymentStatus>("pagado");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("tarjeta");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!row) return;
    const p = row.payment;
    setStatus(p.status === "pendiente" ? "pagado" : p.status);
    setAmount(String(p.status === "pendiente" ? row.price : p.paidAmount));
    setMethod(p.method && p.method !== "local" ? p.method : "tarjeta");
    setNote(p.note ?? "");
  }, [row]);

  async function save(next: PaymentStatus) {
    if (!row) return;
    const n = Number(amount.replace(",", "."));
    if (next !== "pendiente" && (!Number.isFinite(n) || n < 0)) return toast.error("Importe no válido");
    setSaving(true);
    try {
      const res = await fetch(`/api/reservations/${row._id}/payment`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next, paidAmount: next === "pendiente" ? 0 : n, method: next === "pendiente" ? null : method, note }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error);
      toast.success(next === "pendiente" ? "Cobro anulado" : "Cobro registrado");
      onSaved();
    } catch (e) {
      toast.error("No se pudo guardar", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  const d = row ? new Date(row.start) : null;
  return (
    <Dialog open={!!row} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar cobro</DialogTitle>
          <DialogDescription>
            {row?.customer?.name || "Sin cliente"} · {row?.roomName} · {d?.toLocaleDateString("es-ES", { day: "2-digit", month: "short", timeZone: "UTC" })} {d?.toISOString().slice(11, 16)} · importe {row ? eur(row.price) : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 text-sm">
            {(["pagado", "parcial"] as const).map((s) => (
              <button key={s} type="button" onClick={() => { setStatus(s); if (s === "pagado" && row) setAmount(String(row.price)); }} className={cn("rounded-lg px-3 py-1.5 font-medium", status === s ? "bg-card shadow-sm" : "text-muted-foreground")}>
                {s === "pagado" ? "Cobrado completo" : "Pago parcial / señal"}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="pay-amount" className="text-sm font-medium">Importe cobrado (€)</label>
            <Input id="pay-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Método</p>
            <div className="flex flex-wrap gap-1.5">
              {PAYMENT_METHODS.filter((m) => m !== "local").map((m) => (
                <button key={m} type="button" onClick={() => setMethod(m)} className={cn("rounded-lg border px-3 py-1.5 text-sm", method === m ? "border-primary bg-primary/5 font-medium text-primary" : "hover:border-primary/40")}>
                  {PAYMENT_METHOD_LABEL[m]}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="pay-note" className="text-sm font-medium">Nota <span className="font-normal text-muted-foreground">(opcional)</span></label>
            <Input id="pay-note" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: señal por Bizum, resto en el local" />
          </div>
          {row?.payment.source === "crm" && row.payment.by && (
            <p className="text-xs text-muted-foreground">Último registro por {row.payment.by}{row.payment.paidAt ? ` el ${new Date(row.payment.paidAt).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}` : ""}.</p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {row && row.payment.status !== "pendiente" ? (
            <Button variant="ghost" className="text-rose-700" disabled={saving} onClick={() => save("pendiente")}>Marcar como pendiente</Button>
          ) : <span />}
          <Button disabled={saving} onClick={() => save(status)}>{saving && <Loader2 className="size-4 animate-spin" />} Guardar cobro</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
