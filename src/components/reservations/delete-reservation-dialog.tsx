"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/**
 * Eliminar una reserva y, opcionalmente, su cliente si no tiene más reservas.
 */
export function DeleteReservationDialog({
  reservationId,
  customer,
  onDeleted,
}: {
  reservationId: string;
  customer?: { id?: string; name?: string } | null;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [others, setOthers] = useState<number | null>(null);
  const [alsoCustomer, setAlsoCustomer] = useState(false);
  const [busy, setBusy] = useState(false);
  const customerId = customer?.id && /^[a-f0-9]{24}$/i.test(customer.id) ? customer.id : null;

  // Al abrir: ¿cuántas otras reservas tiene el cliente?
  useEffect(() => {
    if (!open || !customerId) return;
    setOthers(null);
    setAlsoCustomer(false);
    fetch(`/api/reservations?customerId=${customerId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((list: { _id: string }[]) => setOthers(list.filter((x) => String(x._id) !== reservationId).length))
      .catch(() => setOthers(null));
  }, [open, customerId, reservationId]);

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/reservations/${reservationId}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Error al eliminar");
      if (alsoCustomer && customerId) {
        const r2 = await fetch(`/api/customers/${customerId}`, { method: "DELETE" });
        if (!r2.ok) toast.error("La reserva se eliminó, pero no se pudo eliminar el cliente");
        else toast.success("Reserva y cliente eliminados");
      } else {
        toast.success("Reserva eliminada");
      }
      setOpen(false);
      onDeleted();
    } catch (e) {
      toast.error("Error eliminando la reserva", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive">
          <Trash2 className="size-4" /> Eliminar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar esta reserva?</AlertDialogTitle>
          <AlertDialogDescription>Se borrará definitivamente. No se envía ningún correo al cliente.</AlertDialogDescription>
        </AlertDialogHeader>

        {customerId && (
          <div className="rounded-lg border p-3 text-sm">
            {others === null ? (
              <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Comprobando el cliente…</p>
            ) : others === 0 ? (
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" className="mt-0.5 size-4 accent-destructive" checked={alsoCustomer} onChange={(e) => setAlsoCustomer(e.target.checked)} />
                <span>
                  <span className="font-medium">Eliminar también al cliente {customer?.name ?? ""}</span>
                  <span className="block text-xs text-muted-foreground">No tiene más reservas. Se borrarán su ficha y sus notas.</span>
                </span>
              </label>
            ) : (
              <p className="text-muted-foreground">
                El cliente <strong className="text-foreground">{customer?.name}</strong> tiene {others} {others === 1 ? "reserva más" : "reservas más"}; su ficha se conserva.
              </p>
            )}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
          <Button variant="destructive" onClick={remove} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />} {alsoCustomer ? "Eliminar reserva y cliente" : "Eliminar reserva"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
