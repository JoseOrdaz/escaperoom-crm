"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Code2, Copy, ExternalLink, Loader2, Mail, Save, ShieldCheck, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/components/session-provider";
import { ESCAPES, type Escape } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { EmailTemplatesPanel } from "./_components/email-templates-panel";

type EscapeSettings = { privacyUrl: string; phone: string; email: string };
type Tab = "escapes" | "templates";

export default function SettingsPage() {
  const { info } = useSession();
  const mine = (info?.escapes ?? []) as Escape[];
  const [tab, setTab] = useState<Tab>("escapes");
  const [data, setData] = useState<Record<Escape, EscapeSettings> | null>(null);
  const [saving, setSaving] = useState<Escape | null>(null);

  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setData(j.escapes))
      .catch(() => toast.error("No se pudieron cargar los ajustes"));
  }, []);

  async function save(escape: Escape) {
    if (!data) return;
    setSaving(escape);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ escapes: { [escape]: data[escape] } }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error);
      setData(json.escapes);
      toast.success(`Ajustes de ${escape} guardados`);
    } catch (e) {
      toast.error("No se pudo guardar", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(null);
    }
  }

  const set = (escape: Escape, patch: Partial<EscapeSettings>) =>
    setData((d) => (d ? { ...d, [escape]: { ...d[escape], ...patch } } : d));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ajustes</h1>
        <p className="text-sm text-muted-foreground">Datos de cada escape y textos de los correos que reciben los clientes.</p>
      </div>

      <div role="tablist" aria-label="Sección" className="inline-flex rounded-xl bg-muted p-1">
        {([["escapes", "Escapes", Building2], ["templates", "Plantillas de correo", Mail]] as const).map(([v, label, Icon]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={tab === v}
            onClick={() => setTab(v)}
            className={cn("flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium", tab === v ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "templates" ? (
        <EmailTemplatesPanel />
      ) : !data ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Cargando…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {ESCAPES.filter((e) => mine.includes(e)).map((escape) => {
            const s = data[escape];
            return (
              <section key={escape} className="rounded-2xl border bg-card shadow-sm">
                <header className="flex items-center gap-3 border-b px-5 py-4">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Building2 className="size-4" /></span>
                  <h2 className="font-semibold">{escape}</h2>
                </header>
                <div className="space-y-4 p-5">
                  <div className="space-y-1.5">
                    <label htmlFor={`privacy-${escape}`} className="flex items-center gap-2 text-sm font-medium"><ShieldCheck className="size-4 text-muted-foreground" /> Política de privacidad</label>
                    <div className="flex gap-2">
                      <Input id={`privacy-${escape}`} value={s.privacyUrl} onChange={(e) => set(escape, { privacyUrl: e.target.value })} placeholder="https://…/politica-de-privacidad/" />
                      {s.privacyUrl && (
                        <Button asChild variant="outline" size="icon" aria-label="Abrir política">
                          <a href={s.privacyUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-4" /></a>
                        </Button>
                      )}
                    </div>
                    <p className={cn("text-xs", s.privacyUrl ? "text-muted-foreground" : "text-amber-700")}>
                      {s.privacyUrl
                        ? "El cliente debe aceptarla al reservar en la web; queda registrado en la reserva."
                        : "Sin enlace: el cliente verá el texto sin poder abrir la política."}
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label htmlFor={`phone-${escape}`} className="text-sm font-medium">Teléfono</label>
                      <Input id={`phone-${escape}`} value={s.phone} onChange={(e) => set(escape, { phone: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor={`email-${escape}`} className="text-sm font-medium">Email de contacto</label>
                      <Input id={`email-${escape}`} value={s.email} onChange={(e) => set(escape, { email: e.target.value })} />
                    </div>
                  </div>
                  <EmbedCode escape={escape} />
                  <div className="flex justify-end">
                    <Button onClick={() => save(escape)} disabled={saving === escape}>
                      {saving === escape ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Guardar
                    </Button>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

const EMBED_PATH: Record<Escape, string> = { Fobia: "/iframe/fobia", "Action Gates": "/iframe/action-gates" };

/** Código para pegar en la web del escape (iframe con altura automática) */
function EmbedCode({ escape }: { escape: Escape }) {
  const [origin, setOrigin] = useState("https://escaperoom-crm.vercel.app");
  useEffect(() => setOrigin(window.location.origin), []);
  const url = `${origin}${EMBED_PATH[escape]}`;
  const id = `reservas-${escape === "Fobia" ? "fobia" : "action-gates"}`;
  const code = `<iframe id="${id}" src="${url}" title="Reservas ${escape}" style="width:100%;border:0;min-height:760px;display:block" loading="lazy"></iframe>
<script>
window.addEventListener("message", function (e) {
  var f = document.getElementById("${id}");
  if (!f || e.source !== f.contentWindow || !e.data || e.data.source !== "escape-crm") return;
  if (e.data.type === "height") f.style.height = e.data.height + "px";
  if (e.data.type === "scrollTop") f.scrollIntoView({ behavior: "smooth", block: "start" });
});
</script>`;
  return (
    <div className="space-y-1.5 rounded-xl border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium"><Code2 className="size-4 text-muted-foreground" /> Reservas en tu web</p>
        <div className="flex gap-1.5">
          <Button asChild variant="ghost" size="sm"><a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-4" /> Ver</a></Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigator.clipboard.writeText(code).then(() => toast.success("Código copiado: pégalo en tu web"), () => toast.error("No se pudo copiar"))}
          >
            <Copy className="size-4" /> Copiar código
          </Button>
        </div>
      </div>
      <textarea readOnly value={code} rows={4} onFocus={(e) => e.currentTarget.select()} className="w-full resize-none rounded-md border bg-card p-2 font-mono text-[11px] text-muted-foreground" aria-label={`Código para incrustar las reservas de ${escape}`} />
      <p className="text-xs text-muted-foreground">Pégalo en un bloque «HTML personalizado» de la página de reservas. El marco se ajusta solo a la altura del contenido.</p>
    </div>
  );
}
