"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDownWideNarrow, CalendarCheck, ChevronLeft, ChevronRight, Eye, Loader2, Mail, Pencil, Phone, Plus, Search, UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import CustomerModal, { CustomerForEdit } from "@/components/customers/customer-modal";
import { CustomerSheet } from "@/components/customers/customer-sheet";
import { cn } from "@/lib/utils";

type Customer = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  createdAt?: string | null;
  reservationsCount?: number;
  activeReservations?: number;
  lastReservation?: string | null;
  escapes?: ("Fobia" | "Action Gates")[];
};
type EscapeFilter = "all" | "fobia" | "action";
type Sort = "recent" | "reservations" | "lastVisit" | "name";

const SORTS: { value: Sort; label: string }[] = [
  { value: "recent", label: "Últimos creados" },
  { value: "reservations", label: "Más reservas" },
  { value: "lastVisit", label: "Última reserva" },
  { value: "name", label: "Nombre (A–Z)" },
];

const initials = (name = "") =>
  name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—";
const nf = new Intl.NumberFormat("es-ES");

function EscapeChips({ escapes }: { escapes?: Customer["escapes"] }) {
  if (!escapes?.length) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {escapes.map((e) => (
        <span
          key={e}
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-medium",
            e === "Fobia" ? "bg-indigo-500/10 text-indigo-700" : "bg-teal-500/10 text-teal-700"
          )}
        >
          {e}
        </span>
      ))}
    </span>
  );
}

export default function CustomersPage() {
  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [escape, setEscape] = useState<EscapeFilter>("all");
  const [sort, setSort] = useState<Sort>("recent");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [meta, setMeta] = useState({ total: 0, pages: 1, counts: { all: 0, fobia: 0, action: 0 } });

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerForEdit | null>(null);
  const [viewing, setViewing] = useState<Customer | null>(null);

  // Búsqueda con pequeño retardo para no pedir en cada tecla
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);
  // Al cambiar filtros, volver a la primera página
  useEffect(() => setPage(1), [escape, sort, debounced, pageSize]);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize), escape, sort });
      if (debounced) qs.set("q", debounced);
      const res = await fetch(`/api/customers?${qs}`, { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setRows(json.items ?? []);
      setMeta({ total: json.total ?? 0, pages: json.pages ?? 1, counts: json.counts ?? { all: 0, fobia: 0, action: 0 } });
    } catch (e) {
      setError(true);
      toast.error("Error cargando clientes", { description: String(e) });
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, escape, sort, debounced]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  function openEdit(c: Customer) {
    setEditing({ _id: c._id, name: c.name, email: c.email, phone: c.phone ?? "" });
    setModalOpen(true);
  }

  const from = meta.total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(page * pageSize, meta.total);
  const pageNumbers = (() => {
    const out: (number | "…")[] = [];
    for (let p = 1; p <= meta.pages; p++) {
      if (p === 1 || p === meta.pages || Math.abs(p - page) <= 1) out.push(p);
      else if (out[out.length - 1] !== "…") out.push("…");
    }
    return out;
  })();

  const tabs: { value: EscapeFilter; label: string; count: number }[] = [
    { value: "all", label: "Todos", count: meta.counts.all },
    { value: "fobia", label: "Fobia", count: meta.counts.fobia },
    { value: "action", label: "Action Gates", count: meta.counts.action },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight">
            Clientes
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-sm font-semibold tabular-nums text-primary">{nf.format(meta.counts.all)}</span>
          </h1>
          <p className="text-sm text-muted-foreground">Administra los datos de tus clientes y haz un seguimiento de sus reservas</p>
        </div>
        <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
          <Plus className="size-4" /> Añadir cliente
        </Button>
      </div>

      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        {/* Filtros */}
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between sm:p-5">
          <div role="tablist" aria-label="Escape" className="flex flex-wrap gap-1 rounded-xl bg-muted p-1">
            {tabs.map((t) => (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={escape === t.value}
                onClick={() => setEscape(t.value)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  escape === t.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
                <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">{nf.format(t.count)}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative sm:w-64">
              <Search aria-hidden className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input aria-label="Buscar clientes" placeholder="Nombre, email o teléfono" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowDownWideNarrow className="size-4" />
              <span className="sr-only">Ordenar por</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-9 rounded-md border bg-transparent px-2 text-sm text-foreground">
                {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
          </div>
        </div>

        {/* Móvil */}
        <div className="space-y-3 p-4 sm:hidden">
          {loading && <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground" role="status"><Loader2 className="size-4 animate-spin" /> Cargando…</p>}
          {!loading && rows.length === 0 && <p className="rounded-xl border p-6 text-center text-sm text-muted-foreground">No hay clientes que coincidan.</p>}
          {!loading && rows.map((c) => (
            <div key={c._id} className="rounded-xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <button type="button" onClick={() => setViewing(c)} className="min-w-0 text-left">
                  <p className="font-semibold">{c.name}</p>
                  <p className="mt-0.5 break-all text-sm text-muted-foreground">{c.email || c.phone || "Sin contacto"}</p>
                </button>
                <EscapeChips escapes={c.escapes} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{c.activeReservations ?? 0} reservas · última {fmtDate(c.lastReservation)}</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => setViewing(c)}><Eye className="size-4" />Ficha</Button>
                <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(c)}><Pencil className="size-4" />Editar</Button>
              </div>
            </div>
          ))}
        </div>

        {/* Escritorio */}
        <div className="hidden sm:block">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Cliente</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Escape</TableHead>
                <TableHead>Reservas</TableHead>
                <TableHead>Última reserva</TableHead>
                <TableHead>Alta</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="py-14 text-center"><Loader2 className="mx-auto size-5 animate-spin text-primary" /><span className="sr-only">Cargando clientes…</span></TableCell>
                </TableRow>
              )}
              {!loading && error && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No se han podido cargar los clientes. <Button variant="link" onClick={fetchCustomers}>Reintentar</Button></TableCell>
                </TableRow>
              )}
              {!loading && !error && rows.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                    <UsersRound className="mx-auto mb-2 size-6 opacity-50" />
                    {debounced ? "No hay clientes que coincidan con la búsqueda." : "No hay clientes en este filtro."}
                  </TableCell>
                </TableRow>
              )}
              {!loading && rows.map((c) => (
                <TableRow key={c._id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary" aria-hidden>{initials(c.name)}</span>
                      <button type="button" onClick={() => setViewing(c)} className="text-left font-medium hover:text-primary hover:underline">{c.name}</button>
                    </div>
                  </TableCell>
                  <TableCell>
                    {c.email ? (
                      <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 text-sm hover:text-primary hover:underline"><Mail className="size-3.5 text-muted-foreground" />{c.email}</a>
                    ) : <p className="text-xs text-muted-foreground">Sin email</p>}
                    {c.phone ? (
                      <a href={`tel:${c.phone.replace(/\s+/g, "")}`} className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"><Phone className="size-3" />{c.phone}</a>
                    ) : <p className="mt-1 text-xs text-muted-foreground">Sin teléfono</p>}
                  </TableCell>
                  <TableCell><EscapeChips escapes={c.escapes} /></TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium tabular-nums" title={`${c.reservationsCount ?? 0} en total, incluidas canceladas`}>
                      <CalendarCheck className="size-3.5 text-muted-foreground" />{c.activeReservations ?? 0}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{fmtDate(c.lastReservation)}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{fmtDate(c.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" onClick={() => setViewing(c)}><Eye className="size-4" />Ficha</Button>
                      <Button size="sm" variant="outline" onClick={() => openEdit(c)}><Pencil className="size-4" />Editar</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Paginador */}
        <div className="flex flex-col items-center justify-between gap-3 border-t px-4 py-3 sm:flex-row sm:px-5">
          <p className="text-sm text-muted-foreground">
            {meta.total ? <>Mostrando <strong className="text-foreground tabular-nums">{nf.format(from)}–{nf.format(to)}</strong> de <strong className="text-foreground tabular-nums">{nf.format(meta.total)}</strong> clientes</> : "Sin resultados"}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="size-8" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)} aria-label="Página anterior"><ChevronLeft className="size-4" /></Button>
            {pageNumbers.map((p, i) =>
              p === "…" ? (
                <span key={`gap-${i}`} className="px-1 text-sm text-muted-foreground">…</span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  disabled={loading}
                  aria-current={p === page ? "page" : undefined}
                  className={cn("size-8 rounded-md text-sm tabular-nums", p === page ? "bg-primary font-semibold text-primary-foreground" : "hover:bg-muted")}
                >
                  {p}
                </button>
              )
            )}
            <Button variant="ghost" size="icon" className="size-8" disabled={page >= meta.pages || loading} onClick={() => setPage((p) => p + 1)} aria-label="Página siguiente"><ChevronRight className="size-4" /></Button>
            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="ml-2 h-8 rounded-md border bg-transparent px-2 text-sm" aria-label="Clientes por página">
              {[25, 50, 100].map((n) => <option key={n} value={n}>{n} / página</option>)}
            </select>
          </div>
        </div>
      </section>

      <CustomerSheet
        customer={viewing}
        open={!!viewing}
        onOpenChange={(o) => !o && setViewing(null)}
        onEdit={(c) => openEdit(c)}
      />

      <CustomerModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        customer={editing}
        onSaved={async () => {
          await fetchCustomers();
          if (viewing && editing?._id === viewing._id) {
            const res = await fetch(`/api/customers/${viewing._id}`, { cache: "no-store" });
            if (res.ok) setViewing({ ...viewing, ...(await res.json()) });
          }
        }}
      />
    </div>
  );
}
