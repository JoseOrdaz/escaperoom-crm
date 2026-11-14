"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Search, Pencil, Mail, Phone, CalendarCheck, UsersRound, Loader2, Eye } from "lucide-react";
import { CustomerSheet } from "@/components/customers/customer-sheet";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

const initials = (name = "") =>
  name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
import { Input } from "@/components/ui/input";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerForEdit | null>(null);
  const [viewing, setViewing] = useState<Customer | null>(null);

  async function fetchCustomers() {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/customers", { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setCustomers(json.items ?? []);
    } catch (e) {
      setError(true);
      toast.error("Error cargando clientes", { description: String(e) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCustomers();
  }, []);

  const filteredCustomers = customers.filter((customer) =>
    [customer.name, customer.email, customer.phone].some((value) =>
      value?.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
    )
  );

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

    <>
    <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
  <div>
    <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
      Clientes
    </h1>
    <p className="text-sm text-muted-foreground">
      Administra los datos de tus clientes y haz un seguimiento de sus reservas
    </p>
  </div>

  <Button
    onClick={() => {
      setEditing(null);
      setModalOpen(true);
    }}
    className="shadow-sm hover:shadow-md transition-all"
  >
    <Plus className="mr-2 h-4 w-4" /> Añadir cliente
  </Button>
</div>

    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Listado de clientes</CardTitle>
          <p className="text-sm text-muted-foreground">Busca por nombre, correo o teléfono.</p>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4 max-w-sm">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Buscar clientes" placeholder="Buscar clientes" value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" />
          </div>
          <div className="space-y-3 sm:hidden">
            {loading && <p className="py-6 text-center text-sm text-muted-foreground" role="status">Cargando clientes…</p>}
            {error && <p className="py-6 text-center text-sm text-muted-foreground">No se han podido cargar los clientes. <Button variant="link" onClick={fetchCustomers}>Reintentar</Button></p>}
            {!loading && !error && filteredCustomers.length === 0 && <p className="rounded-xl border p-6 text-center text-sm text-muted-foreground">{query ? "No hay clientes que coincidan con la búsqueda." : "No hay clientes registrados."}</p>}
            {filteredCustomers.map((customer) => <div key={customer._id} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold">{customer.name}</p><p className="mt-1 break-all text-sm text-muted-foreground">{customer.email}</p><p className="mt-1 text-sm text-muted-foreground">{customer.phone || "Sin teléfono"} · {customer.reservationsCount ?? 0} reservas</p></div><div className="flex flex-col gap-2"><Button size="sm" onClick={() => setViewing(customer)}><Eye className="size-4" />Ficha</Button><Button size="sm" variant="outline" onClick={() => openEdit(customer)}><Pencil className="size-4" />Editar</Button></div></div></div>)}
          </div>
          <div className="hidden overflow-hidden rounded-xl border sm:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Cliente</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Reservas</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground" role="status"><Loader2 className="mx-auto size-5 animate-spin text-primary" /><span className="sr-only">Cargando clientes…</span></TableCell></TableRow>}
                {error && <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">No se han podido cargar los clientes. <Button variant="link" onClick={fetchCustomers}>Reintentar</Button></TableCell></TableRow>}
                {filteredCustomers.map((c) => (
                  <TableRow key={c._id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary" aria-hidden>
                          {initials(c.name)}
                        </span>
                        <button type="button" onClick={() => setViewing(c)} className="font-medium hover:text-primary hover:underline">{c.name}</button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 hover:text-primary hover:underline">
                        <Mail className="size-3.5 text-muted-foreground" />{c.email}
                      </a>
                      {c.phone ? (
                        <a href={`tel:${c.phone.replace(/\s+/g, "")}`} className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary">
                          <Phone className="size-3" />{c.phone}
                        </a>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">Sin teléfono</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium tabular-nums">
                        <CalendarCheck className="size-3.5 text-muted-foreground" />
                        {c.reservationsCount ?? 0}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" onClick={() => setViewing(c)}>
                          <Eye className="size-4" />Ficha
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openEdit(c)}>
                          <Pencil className="size-4" />Editar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && !error && filteredCustomers.length === 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={4} className="py-12 text-center text-sm text-muted-foreground">
                      <UsersRound className="mx-auto mb-2 size-6 opacity-50" />
                      {query ? "No hay clientes que coincidan con la búsqueda." : "No hay clientes registrados."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <CustomerSheet
        customer={viewing}
        open={!!viewing}
        onOpenChange={(o) => !o && setViewing(null)}
        onEdit={(c) => openEdit({ ...c, reservationsCount: undefined })}
      />

      <CustomerModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        customer={editing}
        onSaved={async () => {
          await fetchCustomers();
          // Si la ficha está abierta, refrescar sus datos
          if (viewing && editing?._id === viewing._id) {
            const res = await fetch(`/api/customers/${viewing._id}`, { cache: "no-store" });
            if (res.ok) setViewing({ ...viewing, ...(await res.json()) });
          }
        }}
      />
    </div>

    </>
  );
}
