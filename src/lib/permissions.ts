/**
 * Roles, permisos y escapes. Sin dependencias de servidor: se usa tanto en las
 * rutas de la API como en el cliente (menú, botones, guardas de página).
 */
import { isFobiaRoom } from "@/lib/venues";

export const ESCAPES = ["Fobia", "Action Gates"] as const;
export type Escape = (typeof ESCAPES)[number];
export type Role = "admin" | "game_master";

export type Permission =
  | "reservations.view"
  | "reservations.create"
  | "reservations.edit"
  | "reservations.notify" // avisar / escribir al cliente desde la reserva
  | "reservations.delete"
  | "reservations.price" // ajustar el precio pagado
  | "checkin" // fichajes y calendario laboral
  | "rooms.manage"
  | "customers.view"
  | "coupons.manage"
  | "employees.manage"
  | "emails.view" // registro de correos
  | "newsletter.send";

/** Lo que puede hacer un game master. El administrador puede todo. */
const GAME_MASTER: Permission[] = [
  "reservations.view",
  "reservations.create",
  "reservations.edit",
  "reservations.notify",
  "checkin",
];

export const PERMISSION_LABEL: Record<Permission, string> = {
  "reservations.view": "Ver reservas y calendario",
  "reservations.create": "Crear reservas",
  "reservations.edit": "Editar reservas (hora, estado, notas, cliente)",
  "reservations.notify": "Avisar y escribir al cliente",
  "reservations.delete": "Eliminar reservas",
  "reservations.price": "Ajustar el precio pagado",
  checkin: "Fichajes y calendario laboral",
  "rooms.manage": "Gestionar salas, horarios y precios",
  "customers.view": "Ver y gestionar clientes",
  "coupons.manage": "Gestionar cupones",
  "employees.manage": "Gestionar empleados",
  "emails.view": "Ver el registro de correos",
  "newsletter.send": "Enviar newsletter y avisos",
};

export const normalizeRole = (role?: string): Role => (role === "admin" ? "admin" : "game_master");

export function can(role: string | undefined, perm: Permission) {
  return normalizeRole(role) === "admin" || GAME_MASTER.includes(perm);
}

export const isEscape = (v: unknown): v is Escape => ESCAPES.includes(v as Escape);

/**
 * Escapes asociados a un empleado. Admite el formato antiguo (`escape: "Fobia"`).
 * Un administrador sin lista `escapes` (cuentas antiguas) ve todos.
 */
export function employeeEscapes(emp: Record<string, any> | null | undefined): Escape[] {
  const isAdmin = normalizeRole(emp?.role) === "admin";
  // Administradores sin lista explícita (cuentas antiguas: el campo `escape` era solo
  // el valor por defecto del formulario) → todos los escapes.
  if (isAdmin && !Array.isArray(emp?.escapes)) return [...ESCAPES];
  const list = Array.isArray(emp?.escapes) ? emp!.escapes.filter(isEscape) : isEscape(emp?.escape) ? [emp!.escape] : [];
  const unique = [...new Set(list)] as Escape[];
  if (unique.length === 0 && isAdmin) return [...ESCAPES];
  return unique;
}

/** Escape al que pertenece una sala (campo `escape` o, si falta, por el nombre) */
export function escapeOfRoom(room: Record<string, any> | null | undefined): Escape {
  if (isEscape(room?.escape)) return room!.escape;
  return isFobiaRoom(room?.name ?? "") ? "Fobia" : "Action Gates";
}

export const escapeToBrand = (e: Escape) => (e === "Fobia" ? "fobia" : "action") as "fobia" | "action";

/** Permiso necesario para entrar en cada página del panel (por prefijo de ruta) */
export const PAGE_PERMISSION: { prefix: string; perm: Permission }[] = [
  { prefix: "/dashboard/bookings", perm: "reservations.view" },
  { prefix: "/dashboard/reservations", perm: "reservations.view" },
  { prefix: "/dashboard/emails", perm: "emails.view" },
  { prefix: "/dashboard/rooms", perm: "rooms.manage" },
  { prefix: "/dashboard/customers", perm: "customers.view" },
  { prefix: "/dashboard/coupons", perm: "coupons.manage" },
  { prefix: "/dashboard/employees", perm: "checkin" }, // dentro, las pestañas de gestión piden employees.manage
];

export function canOpenPage(role: string | undefined, pathname: string) {
  const rule = PAGE_PERMISSION.find((p) => pathname.startsWith(p.prefix));
  return !rule || can(role, rule.perm);
}
