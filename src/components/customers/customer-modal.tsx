"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type CustomerForEdit = {
  _id?: string;   // 👈 lo hacemos opcional para permitir creación
  name: string;
  email: string;
  phone?: string;
};

export default function CustomerModal({
  open,
  onOpenChange,
  customer,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customer: CustomerForEdit | null;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState<CustomerForEdit>(
    customer ?? { name: "", email: "", phone: "" }
  );
  const [saving, setSaving] = useState(false);

  // sincroniza cuando cambie el customer que llega
  useEffect(() => {
    if (customer) {
      setForm(customer);
    } else {
      setForm({ name: "", email: "", phone: "" });
    }
  }, [customer]);

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      const url = form._id
        ? `/api/customers/${form._id}` // 🔑 PUT con ID
        : `/api/customers`;            // 🔑 POST si es nuevo

      const method = form._id ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error(await res.text());

      toast.success(form._id ? "Cliente actualizado" : "Cliente creado");

      await onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Error guardando cliente", { description: String(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {form._id ? "Editar cliente" : "Nuevo cliente"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2"><Label htmlFor="customer-name">Nombre</Label>
          <Input id="customer-name"
            placeholder="Nombre"
            value={form?.name ?? ""}
            onChange={(e) =>
              setForm((f) => ({ ...f, name: e.target.value }))
            }
          />
          </div><div className="space-y-2"><Label htmlFor="customer-email">Correo electrónico</Label>
          <Input id="customer-email"
            placeholder="Email"
            type="email"
            value={form?.email ?? ""}
            onChange={(e) =>
              setForm((f) => ({ ...f, email: e.target.value }))
            }
          />
          </div><div className="space-y-2"><Label htmlFor="customer-phone">Teléfono</Label>
          <Input id="customer-phone"
            placeholder="Teléfono"
            value={form?.phone ?? ""}
            onChange={(e) =>
              setForm((f) => ({ ...f, phone: e.target.value }))
            }
          />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
