import type { Db } from "mongodb";
import { ESCAPES, type Escape } from "@/lib/permissions";

/** Ajustes de cada escape (colección `settings`, documento "escapes") */
export type EscapeSettings = {
  privacyUrl: string; // política de privacidad que acepta el cliente al reservar
  phone: string;
  email: string;
};
export type AllEscapeSettings = Record<Escape, EscapeSettings>;

export const DEFAULT_ESCAPE_SETTINGS: AllEscapeSettings = {
  Fobia: { privacyUrl: "", phone: "+34 654 60 89 75", email: "valencia@fobiaescape.com" },
  "Action Gates": { privacyUrl: "https://action-gates.com/politica-de-privacidad/", phone: "+34 692 502 258", email: "valencia@action-gates.com" },
};

export async function getEscapeSettings(db: Db): Promise<AllEscapeSettings> {
  const doc = await db.collection<{ _id: string } & Partial<AllEscapeSettings>>("settings").findOne({ _id: "escapes" });
  return Object.fromEntries(
    ESCAPES.map((e) => [e, { ...DEFAULT_ESCAPE_SETTINGS[e], ...(doc?.[e] ?? {}) }])
  ) as AllEscapeSettings;
}
