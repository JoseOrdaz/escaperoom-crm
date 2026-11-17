"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Braces, Loader2, RotateCcw, Save, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  TEMPLATE_KEYS, TEMPLATE_META, TEMPLATE_VARIABLES, renderTemplateEmail,
  type Brand, type EmailTemplate, type TemplateKey,
} from "@/lib/email-templates";
import { cn } from "@/lib/utils";

type Stored = EmailTemplate & { customized?: boolean; updatedAt?: string | null; updatedBy?: string | null };
const BRAND_LABEL: Record<Brand, string> = { fobia: "Fobia", action: "Action Gates" };

const SAMPLE = {
  reservationId: "000000000000000000000000",
  roomName: "Misión Casiopea",
  customerName: "Ana García",
  start: new Date(Date.UTC(2026, 11, 12, 18, 0)),
  end: new Date(Date.UTC(2026, 11, 12, 19, 0)),
  players: 6,
  price: 132,
  coupon: null,
};

export function EmailTemplatesPanel() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [all, setAll] = useState<Record<string, Record<TemplateKey, Stored>> | null>(null);
  const [brand, setBrand] = useState<Brand>("action");
  const [key, setKey] = useState<TemplateKey>("created");
  const [draft, setDraft] = useState<EmailTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  async function load() {
    const res = await fetch("/api/email-templates", { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(json.error || "No se pudieron cargar las plantillas");
    setBrands(json.brands);
    setAll(json.templates);
    setBrand((b) => (json.brands.includes(b) ? b : json.brands[0]));
  }
  useEffect(() => {
    load();
  }, []);

  const stored = all?.[brand]?.[key];
  useEffect(() => {
    if (stored) setDraft({ subject: stored.subject, heading: stored.heading, intro: stored.intro, body: stored.body, showDetails: stored.showDetails, showCancelLink: stored.showCancelLink });
  }, [stored]);

  const dirty = !!draft && !!stored && (["subject", "heading", "intro", "body", "showDetails", "showCancelLink"] as const).some((k) => draft[k] !== stored[k]);

  const preview = useMemo(
    () => (draft ? renderTemplateEmail({ brand, key, template: draft, data: SAMPLE }) : null),
    [draft, brand, key]
  );

  function insertVar(v: string) {
    const el = bodyRef.current;
    if (!draft || !el) return;
    const token = `{{${v}}}`;
    const start = el.selectionStart ?? draft.body.length;
    const end = el.selectionEnd ?? start;
    setDraft({ ...draft, body: draft.body.slice(0, start) + token + draft.body.slice(end) });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await fetch("/api/email-templates", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brand, key, template: draft }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error);
      toast.success("Plantilla guardada: se usará en los próximos correos");
      await load();
    } catch (e) {
      toast.error("No se pudo guardar", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (!confirm("¿Volver al texto original de esta plantilla?")) return;
    const res = await fetch(`/api/email-templates?brand=${brand}&key=${key}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Plantilla restablecida");
      load();
    } else toast.error("No se pudo restablecer");
  }

  if (!all || !draft) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Cargando plantillas…</p>;

  return (
    <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)_minmax(0,0.9fr)]">
      {/* Selector */}
      <aside className="space-y-4">
        {brands.length > 1 && (
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
            {brands.map((b) => (
              <button key={b} type="button" onClick={() => setBrand(b)} className={cn("rounded-lg px-3 py-1.5 text-sm font-medium", brand === b ? "bg-card shadow-sm" : "text-muted-foreground")}>
                {BRAND_LABEL[b]}
              </button>
            ))}
          </div>
        )}
        <ul className="space-y-1.5">
          {TEMPLATE_KEYS.map((k) => {
            const t = all[brand]?.[k];
            return (
              <li key={k}>
                <button
                  type="button"
                  onClick={() => setKey(k)}
                  className={cn("w-full rounded-xl border p-3 text-left transition-colors", key === k ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-primary/40")}
                >
                  <span className="flex items-center justify-between gap-2 text-sm font-medium">
                    {TEMPLATE_META[k].label}
                    {t?.customized && <span className="rounded-full bg-primary/10 px-2 text-[10px] font-semibold text-primary">Editada</span>}
                  </span>
                  <span className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground"><Zap className="mt-0.5 size-3 shrink-0" />{TEMPLATE_META[k].when}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Editor */}
      <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold">{TEMPLATE_META[key].label} · {BRAND_LABEL[brand]}</h2>
            {stored?.customized && stored.updatedAt && (
              <p className="text-xs text-muted-foreground">Editada {new Date(stored.updatedAt).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })}{stored.updatedBy ? ` por ${stored.updatedBy}` : ""}</p>
            )}
          </div>
          {dirty && <span className="flex items-center gap-1 text-xs text-amber-700"><span className="size-1.5 rounded-full bg-amber-500" />Sin guardar</span>}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="tpl-subject" className="text-sm font-medium">Asunto</label>
          <Input id="tpl-subject" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="tpl-heading" className="text-sm font-medium">Título de la cabecera</label>
            <Input id="tpl-heading" value={draft.heading} onChange={(e) => setDraft({ ...draft, heading: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="tpl-intro" className="text-sm font-medium">Frase inicial</label>
            <Input id="tpl-intro" value={draft.intro} onChange={(e) => setDraft({ ...draft, intro: e.target.value })} />
          </div>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="tpl-body" className="text-sm font-medium">Información para el cliente</label>
          <Textarea id="tpl-body" ref={bodyRef} rows={14} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} className="font-mono text-xs leading-relaxed" />
          <p className="text-xs text-muted-foreground">Línea en blanco = nuevo párrafo · <code className="rounded bg-muted px-1">## Título</code> = subtítulo · los enlaces https:// se convierten solos.</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1 text-xs text-muted-foreground"><Braces className="size-3.5" /> Insertar:</span>
          {TEMPLATE_VARIABLES.map((v) => (
            <button key={v} type="button" onClick={() => insertVar(v)} className="rounded-md border bg-muted/40 px-2 py-0.5 font-mono text-xs hover:border-primary/50 hover:text-primary">{`{{${v}}}`}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" className="size-4 accent-primary" checked={draft.showDetails} onChange={(e) => setDraft({ ...draft, showDetails: e.target.checked })} /> Tabla con los datos de la reserva</label>
          {key !== "cancelled" && (
            <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" className="size-4 accent-primary" checked={draft.showCancelLink} onChange={(e) => setDraft({ ...draft, showCancelLink: e.target.checked })} /> Botón «Cancelar mi reserva»</label>
          )}
        </div>
        <div className="flex flex-wrap justify-between gap-2 border-t pt-4">
          <Button type="button" variant="ghost" onClick={reset} disabled={!stored?.customized}><RotateCcw className="size-4" /> Restablecer original</Button>
          <Button type="button" onClick={save} disabled={saving || !dirty}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Guardar plantilla</Button>
        </div>
      </section>

      {/* Vista previa */}
      <div className="xl:sticky xl:top-24 xl:self-start">
        <p className="mb-2 text-sm font-medium text-muted-foreground">Vista previa <span className="font-normal">(datos de ejemplo)</span></p>
        <p className="mb-2 truncate rounded-lg border bg-card px-3 py-2 text-sm"><span className="text-muted-foreground">Asunto: </span>{preview?.subject}</p>
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <iframe title="Vista previa del correo" srcDoc={preview?.html} sandbox="" className="h-[620px] w-full" />
        </div>
      </div>
    </div>
  );
}
