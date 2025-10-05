"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import CustomerModal, {
  CustomerForEdit,
} from "@/components/customers/customer-modal";

type Customer = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  reservationsCount?: number;
};

export default function CustomersTable() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerForEdit | null>(null);

  async function fetchCustomers() {
    try {
      const res = await fetch("/api/customers", { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setCustomers(json.items ?? []);
    } catch (e) {
      toast.error("Error cargando clientes", { description: String(e) });
    }
  }

  useEffect(() => {
    fetchCustomers();
  }, []);

  function openEdit(c: Customer) {
    setEditing({
      _id: c._id,
      name: c.name,
      email: c.email,
      phone: c.phone ?? "",
    });
    setModalOpen(true);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Listado de Clientes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-2 text-left">Nombre</th>
                  <th className="p-2 text-left">Email</th>
                  <th className="p-2 text-left">Teléfono</th>
                  <th className="p-2 text-left">Reservas</th>
                  <th className="p-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c._id} className="border-t">
                    <td className="p-2">{c.name}</td>
                    <td className="p-2">{c.email}</td>
                    <td className="p-2">{c.phone || "-"}</td>
                    <td className="p-2">{c.reservationsCount ?? 0}</td>
                    <td className="p-2 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(c)}
                      >
                        Editar
                      </Button>
                    </td>
                  </tr>
                ))}
                {customers.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="p-4 text-center text-sm text-muted-foreground"
                    >
                      No hay clientes registrados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <CustomerModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        customer={editing}
        onSaved={fetchCustomers}
      />
    </div>
  );
}
