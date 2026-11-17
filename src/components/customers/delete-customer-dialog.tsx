"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export function DeleteCustomerDialog({
  customer,
  onDeleted,
  compact = false,
}: {
  customer: { _id: string; name: string; reservationsCount?: number };
  onDeleted: () => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"unlink" | "delete">("unlink");
  const [busy, setBusy] = useState(false);
  const count = customer.reservationsCount ?? 0;

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/customers/${customer._id}${count ? `?reservations=${mode}` : ""}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || "No se pudo eliminar");
      toast.success(
        count ? (mode === "delete" ? `Cliente y ${count} reservas eliminados` : "Cliente eliminado; sus reservas se conservan sin cliente") : "Cliente eliminado"
      );
      setOpen(false);
      onDeleted();
    } catch (e) {
      toast.error("No se pudo eliminar el cliente", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          size={compact ? "icon" : "sm"}
          variant="outline"
          className={cn("text-destructive hover:bg-destructive/10 hover:text-destructive", compact && "size-8")}
          aria-label={`Eliminar a ${customer.name}`}
          title="Eliminar cliente"
        >
          <Trash2 className="size-4" />{!compact && "Eliminar"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar a {customer.name}?</AlertDialogTitle>
          <AlertDialogDescription>Se borrarán su ficha y sus notas. No se puede deshacer.</AlertDialogDescription>
        </AlertDialogHeader>

        {count > 0 && (
          <fieldset className="space-y-2 rounded-lg border p-3 text-sm">
            <legend className="px-1 text-xs text-muted-foreground">Tiene {count} {count === 1 ? "reserva" : "reservas"}</legend>
            {([
              ["unlink", "Conservar las reservas (quedan sin cliente)", "Recomendado: no se pierde el histórico ni la facturación."],
              ["delete", `Eliminar también sus ${count} ${count === 1 ? "reserva" : "reservas"}`, "Desaparecen del calendario y de las estadísticas."],
            ] as const).map(([value, label, hint]) => (
              <label key={value} className="flex cursor-pointer items-start gap-3">
                <input type="radio" name="del-mode" className="mt-0.5 size-4 accent-primary" checked={mode === value} onChange={() => setMode(value)} />
                <span><span className="font-medium">{label}</span><span className="block text-xs text-muted-foreground">{hint}</span></span>
              </label>
            ))}
          </fieldset>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
          <Button variant="destructive" onClick={remove} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />} Eliminar cliente
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
