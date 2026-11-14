"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, FileCode2, FlaskConical, Loader2, Megaphone, Plus, RotateCcw, Search, Send, Users, X } from "lucide-react";
import { RichEditor } from "./rich-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buildNewsletterEmail, type Brand } from "@/lib/newsletter-template";
import { cn } from "@/lib/utils";

type Recipient = { _id: string; name: string; email: string; venues: Brand[]; reservations: number; lastVisit: string | null; optedOut: boolean };
type Campaign = {
  _id: string; brand: Brand; subject: string; title?: string; message: string; ctaText?: string; ctaUrl?: string;
  format?: "fields" | "html"; html?: string; wrap?: boolean; summary?: string;
  audience: string; total: number; sent: number; failed: number; status: string; sentBy?: { name: string }; createdAt: string;
};
type AudienceType = "all" | "fobia" | "action" | "selected";
type Mode = "fields" | "editor" | "html";
type Draft = {
  brand: Brand; subject: string; title: string; message: string; ctaText: string; ctaUrl: string;
  mode: Mode; html: string; wrap: boolean;
};

const EMPTY: Draft = { brand: "fobia", subject: "", title: "", message: "", ctaText: "", ctaUrl: "", mode: "fields", html: "", wrap: true };

const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** Convierte el texto del formulario en HTML para seguir editándolo en el editor */
function fieldsToHtml(d: Pick<Draft, "message" | "ctaText" | "ctaUrl">) {
  const paras = d.message
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const cta = d.ctaText.trim() && /^https?:\/\//i.test(d.ctaUrl.trim())
    ? `<p><a href="${escHtml(d.ctaUrl.trim())}">${escHtml(d.ctaText.trim())}</a></p>`
    : "";
  return `<p>¡Hola, {{nombre}}!</p>${paras}${cta}`;
}
const htmlHasContent = (h: string) => !!h.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim() || /<img/i.test(h);

const TEMPLATES: { id: string; label: string; draft: Partial<Draft> }[] = [
  { id: "blank", label: "En blanco", draft: { subject: "", title: "", message: "", ctaText: "", ctaUrl: "" } },
  {
    id: "closed",
    label: "Aviso de cierre",
    draft: {
      subject: "Aviso: cerramos el día [fecha]",
      title: "Aviso importante",
      message:
        "Queremos avisarte de que el día [fecha] permaneceremos cerrados.\n\nSi queréis jugar ese día, llamadnos y buscaremos una opción para vuestro grupo.",
      ctaText: "",
      ctaUrl: "",
    },
  },
  {
    id: "news",
    label: "Novedad",
    draft: {
      subject: "¡Tenemos novedades!",
      title: "¡Tenemos novedades!",
      message: "[Cuenta aquí la novedad: nueva sala, nuevo horario, evento especial…]",
      ctaText: "Reservar",
      ctaUrl: "",
    },
  },
  {
    id: "promo",
    label: "Promoción",
    draft: {
      subject: "Un descuento especial para ti",
      title: "Descuento especial",
      message: "Usa el código [CÓDIGO] al reservar y obtén un [X] % de descuento hasta el [fecha].",
      ctaText: "Reservar ahora",
      ctaUrl: "",
    },
  },
];

const AUDIENCE_LABEL: Record<string, string> = { all: "Todos", fobia: "Clientes Fobia", action: "Clientes Action Gates", selected: "Selección" };
const BRAND_LABEL: Record<Brand, string> = { fobia: "Fobia", action: "Action Gates" };

function audienceOf(all: Recipient[], type: AudienceType, ids: Set<string>) {
  const out = all.filter((r) => r.optedOut).map((r) => r.email);
  const optedOut = new Set(out);
  const chosen = type === "selected" ? all.filter((r) => ids.has(r._id)) : type === "all" ? all : all.filter((r) => r.venues.includes(type));
  const seen = new Set<string>();
  return chosen.filter((r) => !optedOut.has(r.email) && !seen.has(r.email) && (seen.add(r.email), true));
}

export function NewsletterPanel() {
  const [view, setView] = useState<"history" | "compose">("history");
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [recipients, setRecipients] = useState<Recipient[] | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [template, setTemplate] = useState("blank");
  const [audience, setAudience] = useState<AudienceType>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [sending, setSending] = useState<"test" | "real" | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [brands, setBrands] = useState<Brand[]>(["fobia", "action"]);

  const loadCampaigns = useCallback(async () => {
    const res = await fetch("/api/newsletter/campaigns", { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    setCampaigns(res.ok ? json.items : []);
  }, []);

  useEffect(() => {
    loadCampaigns();
    fetch("/api/newsletter/recipients", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        setRecipients(j.items ?? []);
        if (Array.isArray(j.brands) && j.brands.length) {
          setBrands(j.brands);
          setDraft((d) => (j.brands.includes(d.brand) ? d : { ...d, brand: j.brands[0] }));
        }
      })
      .catch(() => setRecipients([]));
  }, [loadCampaigns]);

  const all = useMemo(() => recipients ?? [], [recipients]);
  const counts = useMemo(
    () => ({
      all: audienceOf(all, "all", selected).length,
      fobia: audienceOf(all, "fobia", selected).length,
      action: audienceOf(all, "action", selected).length,
      selected: audienceOf(all, "selected", selected).length,
    }),
    [all, selected]
  );
  const total = counts[audience];
  const optedOutCount = useMemo(() => new Set(all.filter((r) => r.optedOut).map((r) => r.email)).size, [all]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? all.filter((r) => `${r.name} ${r.email}`.toLowerCase().includes(q)) : all;
  }, [all, query]);

  const preview = useMemo(
    () =>
      buildNewsletterEmail({
        ...draft,
        format: draft.mode === "fields" ? "fields" : "html",
        subject: draft.subject || "Asunto del correo",
        message: draft.message || "Escribe el mensaje para ver la vista previa…",
        html: draft.html || "<p style='color:#999'>Escribe o pega el contenido para ver la vista previa…</p>",
        recipientName: "Ana",
        unsubscribeLink: "#",
      }).html,
    [draft]
  );

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  function changeMode(mode: Mode) {
    setDraft((d) => ({
      ...d,
      mode,
      // Al pasar del formulario al editor/HTML se conserva lo escrito
      html: mode !== "fields" && !htmlHasContent(d.html) && d.message.trim() ? fieldsToHtml(d) : d.html,
    }));
  }

  function applyTemplate(t: (typeof TEMPLATES)[number]) {
    setTemplate(t.id);
    setDraft((d) => {
      const next = { ...d, ...t.draft };
      return d.mode === "fields" ? next : { ...next, html: t.id === "blank" ? "" : fieldsToHtml(next) };
    });
  }

  async function importHtmlFile(file?: File) {
    if (!file) return;
    if (file.size > 800_000) return toast.error("El archivo es demasiado grande (máx. 800 KB)");
    set({ html: await file.text(), mode: "html" });
  }

  function startNew(base?: Partial<Draft>) {
    setDraft({ ...EMPTY, brand: brands[0], ...base });
    setTemplate(base ? "" : "blank");
    setAudience("all");
    setSelected(new Set());
    setView("compose");
  }

  async function send(test: boolean) {
    if (!draft.subject.trim()) return toast.error("Escribe el asunto");
    if (draft.mode === "fields" && !draft.message.trim()) return toast.error("Escribe el mensaje");
    if (draft.mode !== "fields" && !htmlHasContent(draft.html)) return toast.error("Escribe o pega el contenido");
    if (draft.mode === "fields" && draft.ctaText.trim() && !/^https?:\/\//i.test(draft.ctaUrl.trim())) return toast.error("El enlace del botón debe empezar por https://");
    setSending(test ? "test" : "real");
    try {
      const res = await fetch("/api/newsletter/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: draft.brand,
          subject: draft.subject,
          format: draft.mode === "fields" ? "fields" : "html",
          message: draft.mode === "fields" ? draft.message : undefined,
          html: draft.mode === "fields" ? undefined : draft.html,
          wrap: draft.wrap,
          title: draft.title.trim() || undefined,
          ctaText: draft.ctaText.trim() || undefined,
          ctaUrl: draft.ctaUrl.trim() || undefined,
          audience: audience === "selected" ? { type: "selected", ids: [...selected] } : { type: audience },
          test,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || "No se pudo enviar");
      if (test) {
        toast.success(`Prueba enviada a ${json.to}`);
      } else {
        toast.success(`Enviado a ${json.sent} de ${json.total} clientes`, json.failed ? { description: `${json.failed} con error (ver registro)` } : undefined);
        setView("history");
        loadCampaigns();
      }
    } catch (e) {
      toast.error("No se pudo enviar", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSending(null);
    }
  }

  /* ───────── Historial ───────── */
  if (view === "history") {
    return (
      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Envíos de newsletter y avisos</h2>
              <p className="text-sm text-muted-foreground">
                {recipients ? `${counts.all} clientes pueden recibir avisos` : "Cargando clientes…"}
                {optedOutCount > 0 && ` · ${optedOutCount} dados de baja`}
              </p>
            </div>
            <Button onClick={() => startNew()}>
              <Plus className="size-4" /> Nuevo envío
            </Button>
          </div>

          {campaigns === null ? (
            <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Cargando…</p>
          ) : campaigns.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><Megaphone className="size-6" /></span>
              <p className="font-medium">Aún no has enviado ningún aviso</p>
              <p className="max-w-sm text-sm text-muted-foreground">Envía novedades, promociones o avisos de cierre a todos tus clientes o solo a los que elijas.</p>
              <Button className="mt-2" onClick={() => startNew()}><Plus className="size-4" /> Crear el primero</Button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Fecha</TableHead>
                    <TableHead>Asunto</TableHead>
                    <TableHead>Remitente</TableHead>
                    <TableHead>Destinatarios</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead>Por</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((c) => (
                    <TableRow key={c._id}>
                      <TableCell className="whitespace-nowrap text-sm tabular-nums">
                        {new Date(c.createdAt).toLocaleString("es-ES", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </TableCell>
                      <TableCell className="max-w-72">
                        <p className="truncate font-medium">{c.subject}</p>
                        <p className="truncate text-xs text-muted-foreground">{c.summary || c.message}</p>
                      </TableCell>
                      <TableCell className="text-sm">{BRAND_LABEL[c.brand]}</TableCell>
                      <TableCell className="text-sm">{AUDIENCE_LABEL[c.audience] ?? c.audience}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        <span className="flex items-center gap-1.5 text-emerald-700"><CheckCircle2 className="size-4" />{c.sent}/{c.total}</span>
                        {c.failed > 0 && <span className="text-xs text-rose-700">{c.failed} con error</span>}
                        {c.status === "sending" && <span className="text-xs text-muted-foreground">enviando…</span>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{c.sentBy?.name ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            startNew({
                              brand: c.brand, subject: c.subject, title: c.title ?? "", message: c.message ?? "",
                              ctaText: c.ctaText ?? "", ctaUrl: c.ctaUrl ?? "",
                              mode: c.format === "html" ? "editor" : "fields", html: c.html ?? "", wrap: c.wrap ?? true,
                            })
                          }
                        >
                          <RotateCcw className="size-4" /> Reutilizar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  /* ───────── Redactar ───────── */
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <Card>
        <CardContent className="space-y-6 p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Nuevo envío</h2>
            <Button variant="ghost" size="sm" onClick={() => setView("history")}><X className="size-4" /> Cancelar</Button>
          </div>

          {/* Plantilla */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Plantilla</p>
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => applyTemplate(t)}
                  className={cn("rounded-full border px-3 py-1.5 text-sm transition-colors", template === t.id ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary/50")}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Cambia el texto entre [corchetes] antes de enviar.</p>
          </div>

          {/* Remitente */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Se envía como</p>
            <div className="grid grid-cols-2 gap-2">
              {brands.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => set({ brand: b })}
                  className={cn("rounded-xl border p-3 text-left text-sm transition-colors", draft.brand === b ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-primary/40")}
                >
                  <span className="font-medium">{BRAND_LABEL[b]}</span>
                  <span className="block text-xs text-muted-foreground">{b === "fobia" ? "valencia@fobiaescape.com" : "valencia@action-gates.com"}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Contenido */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="nl-subject" className="text-sm font-medium">Asunto</label>
              <Input id="nl-subject" value={draft.subject} onChange={(e) => set({ subject: e.target.value })} placeholder="Lo que verá el cliente en su bandeja de entrada" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="nl-title" className="text-sm font-medium">Título <span className="font-normal text-muted-foreground">(opcional)</span></label>
              <Input id="nl-title" value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="Si lo dejas vacío se usa el asunto" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Contenido</p>
              <div role="tablist" aria-label="Forma de redactar" className="inline-flex rounded-lg bg-muted p-1">
                {([
                  ["fields", "Formulario"],
                  ["editor", "Editor visual"],
                  ["html", "HTML"],
                ] as const).map(([m, label]) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={draft.mode === m}
                    onClick={() => changeMode(m)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                      draft.mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {draft.mode === "fields" && (
              <>
                <div className="space-y-1.5">
                  <label htmlFor="nl-message" className="text-sm font-medium">Mensaje</label>
                  <Textarea id="nl-message" rows={7} value={draft.message} onChange={(e) => set({ message: e.target.value })} placeholder="Escribe aquí el mensaje…" />
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr]">
                  <div className="space-y-1.5">
                    <label htmlFor="nl-cta" className="text-sm font-medium">Botón <span className="font-normal text-muted-foreground">(opcional)</span></label>
                    <Input id="nl-cta" value={draft.ctaText} onChange={(e) => set({ ctaText: e.target.value })} placeholder="Reservar ahora" />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="nl-url" className="text-sm font-medium">Enlace del botón</label>
                    <Input id="nl-url" value={draft.ctaUrl} onChange={(e) => set({ ctaUrl: e.target.value })} placeholder="https://…" />
                  </div>
                </div>
              </>
            )}

            {draft.mode === "editor" && (
              <RichEditor value={draft.html} onChange={(html) => set({ html })} placeholder="Escribe o pega aquí (desde Word, Google Docs, una web…)" />
            )}

            {draft.mode === "html" && (
              <div className="space-y-2">
                <Textarea
                  rows={14}
                  value={draft.html}
                  onChange={(e) => set({ html: e.target.value })}
                  placeholder="Pega aquí el código HTML del correo (por ejemplo, exportado de Brevo, Mailchimp, Canva…)"
                  spellCheck={false}
                  className="font-mono text-xs"
                  aria-label="Código HTML"
                />
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-primary hover:underline">
                  <FileCode2 className="size-4" /> Importar archivo .html
                  <input type="file" accept=".html,.htm,text/html" className="sr-only" onChange={(e) => importHtmlFile(e.target.files?.[0])} />
                </label>
              </div>
            )}

            {draft.mode !== "fields" && (
              <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
                <label className="flex cursor-pointer items-start gap-3 text-sm">
                  <input type="checkbox" checked={draft.wrap} onChange={(e) => set({ wrap: e.target.checked })} className="mt-0.5 size-4 accent-primary" />
                  <span>
                    <span className="font-medium">Usar el diseño de {BRAND_LABEL[draft.brand]}</span>
                    <span className="block text-xs text-muted-foreground">
                      Cabecera con el título, datos de contacto y pie. Desmárcalo si tu HTML ya trae su propio diseño.
                    </span>
                  </span>
                </label>
                <p className="text-xs text-muted-foreground">
                  Escribe <code className="rounded bg-muted px-1">{"{{nombre}}"}</code> donde quieras el nombre del cliente. Siempre se añade el enlace para darse de baja. Por seguridad se eliminan scripts y formularios.
                </p>
              </div>
            )}
          </div>

          {/* Destinatarios */}
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-medium"><Users className="size-4 text-muted-foreground" /> Destinatarios</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(["all", ...(brands.length > 1 ? (["fobia", "action"] as const) : []), "selected"] as AudienceType[]).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAudience(a)}
                  className={cn("flex items-center justify-between rounded-xl border p-3 text-left text-sm transition-colors", audience === a ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-primary/40")}
                >
                  <span className="font-medium">{a === "all" ? "Todos los clientes" : a === "selected" ? "Elegir clientes" : `Clientes de ${BRAND_LABEL[a]}`}</span>
                  <span className="rounded-full bg-muted px-2 text-xs tabular-nums text-muted-foreground">{recipients ? counts[a] : "…"}</span>
                </button>
              ))}
            </div>

            {audience === "selected" && (
              <div className="rounded-xl border">
                <div className="flex flex-wrap items-center gap-2 border-b p-2">
                  <div className="relative min-w-40 flex-1">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar cliente…" className="h-9 pl-8" aria-label="Buscar cliente" />
                  </div>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setSelected(new Set([...selected, ...visible.filter((r) => !r.optedOut).map((r) => r._id)]))}>Marcar todos</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Ninguno</Button>
                </div>
                <ul className="max-h-64 divide-y overflow-y-auto">
                  {visible.map((r) => (
                    <li key={r._id}>
                      <label className={cn("flex cursor-pointer items-center gap-3 px-3 py-2 text-sm", r.optedOut && "cursor-not-allowed opacity-50")}>
                        <input
                          type="checkbox"
                          disabled={r.optedOut}
                          checked={selected.has(r._id)}
                          onChange={(e) => {
                            const next = new Set(selected);
                            if (e.target.checked) next.add(r._id);
                            else next.delete(r._id);
                            setSelected(next);
                          }}
                          className="size-4 accent-primary"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{r.name || r.email}</span>
                          <span className="block truncate text-xs text-muted-foreground">{r.email}</span>
                        </span>
                        <span className="flex shrink-0 gap-1">
                          {r.optedOut && <span className="rounded bg-rose-500/10 px-1.5 text-[10px] font-semibold text-rose-700">BAJA</span>}
                          {r.venues.map((v) => (
                            <span key={v} className="rounded bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">{v === "fobia" ? "FOBIA" : "AG"}</span>
                          ))}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              No se envía a quien se dio de baja ni dos veces al mismo email. Cada correo incluye un enlace para darse de baja.
            </p>
          </div>

          {/* Acciones */}
          <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => send(true)} disabled={!!sending}>
              {sending === "test" ? <Loader2 className="size-4 animate-spin" /> : <FlaskConical className="size-4" />}
              Enviarme una prueba
            </Button>
            <Button type="button" onClick={() => setConfirmOpen(true)} disabled={!!sending || total === 0 || !draft.subject.trim() || (draft.mode === "fields" ? !draft.message.trim() : !htmlHasContent(draft.html))}>
              {sending === "real" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Enviar a {total} {total === 1 ? "cliente" : "clientes"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Vista previa */}
      <div className="xl:sticky xl:top-6 xl:self-start">
        <p className="mb-2 text-sm font-medium text-muted-foreground">Vista previa</p>
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <iframe title="Vista previa del aviso" srcDoc={preview} sandbox="" className="h-[640px] w-full" />
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Enviar a {total} {total === 1 ? "cliente" : "clientes"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se enviará «{draft.subject}» como {BRAND_LABEL[draft.brand]}. Una vez enviado no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => send(false)}>Enviar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
