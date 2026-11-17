import { ShieldAlert, ShieldCheck } from "lucide-react";

type Privacy = { accepted: boolean; at?: string | null; url?: string; source?: string } | null | undefined;

const SOURCE: Record<string, string> = { web: "en la web", crm: "en el CRM", "plataforma-anterior": "en la plataforma anterior" };

/** Indica al equipo si el cliente aceptó la política de privacidad al reservar */
export function PrivacyBadge({ privacy }: { privacy: Privacy }) {
  if (privacy?.accepted) {
    const when = privacy.at ? new Date(privacy.at).toLocaleString("es-ES", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : null;
    return (
      <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        <span>
          <strong className="font-medium">Política de privacidad aceptada</strong>
          <span className="block text-xs opacity-80">
            {[when, SOURCE[privacy.source ?? ""]].filter(Boolean).join(" · ")}
            {privacy.url && <> · <a href={privacy.url} target="_blank" rel="noopener noreferrer" className="underline">ver política</a></>}
          </span>
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
      <ShieldAlert className="mt-0.5 size-4 shrink-0" />
      <span>
        <strong className="font-medium">No consta la aceptación de la política de privacidad</strong>
        <span className="block text-xs opacity-80">Reserva creada desde el CRM o sin este dato.</span>
      </span>
    </div>
  );
}
