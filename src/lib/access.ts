import { NextResponse } from "next/server";
import type { Db, ObjectId } from "mongodb";
import { currentProfile, sameOrigin } from "@/lib/profile-session";
import { can, employeeEscapes, escapeOfRoom, normalizeRole, type Escape, type Permission, type Role } from "@/lib/permissions";

export type Access = {
  id: ObjectId;
  role: Role;
  isAdmin: boolean;
  escapes: Escape[];
  name: string;
  email: string;
  can: (perm: Permission) => boolean;
};

/** Usuario de la sesión segura (cookie httpOnly) con su rol y escapes, o null */
export async function getAccess(): Promise<Access | null> {
  const p = await currentProfile();
  if (!p) return null;
  const role = normalizeRole(p.role);
  return {
    id: p._id as ObjectId,
    role,
    isAdmin: role === "admin",
    escapes: employeeEscapes(p),
    name: `${p.name ?? ""} ${p.surname ?? ""}`.trim(),
    email: p.email ?? "",
    can: (perm) => can(role, perm),
  };
}

/**
 * Comprueba sesión (+ origen en peticiones que modifican) y, si se indica, un permiso.
 * Devuelve { access } o { response } con el error listo para devolver.
 */
export async function requireAccess(req: Request | null, perm?: Permission) {
  if (req && req.method !== "GET" && !sameOrigin(req)) {
    return { response: NextResponse.json({ ok: false, error: "Origen no permitido" }, { status: 403 }) } as const;
  }
  const access = await getAccess();
  if (!access) return { response: NextResponse.json({ ok: false, error: "Inicia sesión de nuevo" }, { status: 401 }) } as const;
  if (perm && !access.can(perm)) {
    return { response: NextResponse.json({ ok: false, error: "No tienes permiso para esta acción" }, { status: 403 }) } as const;
  }
  return { access } as const;
}

/** Salas que puede ver este usuario según sus escapes */
export async function scopedRooms(db: Db, access: Access) {
  const rooms = await db.collection("rooms").find({}, { projection: { name: 1, escape: 1 } }).toArray();
  return rooms.filter((r) => access.escapes.includes(escapeOfRoom(r)));
}

export async function scopedRoomIds(db: Db, access: Access) {
  return (await scopedRooms(db, access)).map((r) => r._id as ObjectId);
}

/** ¿Puede este usuario trabajar con esa sala? */
export async function canUseRoom(db: Db, access: Access, roomId: ObjectId | null | undefined) {
  if (!roomId) return false;
  const room = await db.collection("rooms").findOne({ _id: roomId }, { projection: { name: 1, escape: 1 } });
  return !!room && access.escapes.includes(escapeOfRoom(room));
}

export const forbiddenRoom = () =>
  NextResponse.json({ ok: false, error: "Esta sala no pertenece a tus escapes" }, { status: 403 });
