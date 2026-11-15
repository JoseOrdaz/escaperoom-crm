"use client";

import { useEffect, useState } from "react";
import type { DayBooking } from "@/components/reservations/slot-picker";

const hhmm = (iso: string) => new Date(iso).toISOString().slice(11, 16); // hora de pared guardada en UTC

type ApiReservation = {
  _id: string; roomId: string; roomName?: string; start: string; end: string; players?: number; price?: number;
  language?: string; notes?: string; status?: string; customer?: { name?: string; email?: string; phone?: string } | null;
};

/**
 * Todas las reservas (no canceladas) de un día en las salas del usuario.
 * Solo funciona con sesión del CRM; sin sesión devuelve [] (la API responde 401).
 * `blockingIds`: reservas que bloquean la sala elegida (misma sala o vinculadas).
 */
export function useDayBookings(date: Date | null, enabled: boolean, currentRoomId?: string | null, blockingIds?: Set<string>) {
  const [items, setItems] = useState<ApiReservation[]>([]);
  const ymd = date ? date.toLocaleDateString("sv-SE") : null;

  useEffect(() => {
    if (!enabled || !ymd) return setItems([]);
    const next = new Date(`${ymd}T00:00:00`);
    next.setDate(next.getDate() + 1);
    const qs = new URLSearchParams({ from: ymd, to: next.toLocaleDateString("sv-SE"), forCalendar: "1" });
    let cancelled = false;
    fetch(`/api/reservations?${qs}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((json) => !cancelled && setItems(Array.isArray(json) ? json : json.items ?? []))
      .catch(() => !cancelled && setItems([]));
    return () => {
      cancelled = true;
    };
  }, [enabled, ymd]);

  const list: DayBooking[] = items
    .filter((r) => r.status !== "cancelada")
    .sort((a, b) => +new Date(a.start) - +new Date(b.start))
    .map((r) => ({
      id: r._id,
      start: hhmm(r.start),
      end: hhmm(r.end),
      customer: r.customer?.name,
      email: r.customer?.email,
      phone: r.customer?.phone,
      room: r.roomName,
      linked: !!currentRoomId && r.roomId !== currentRoomId && !!blockingIds?.has(r._id),
      blocking: r.roomId === currentRoomId || !!blockingIds?.has(r._id),
      status: r.status,
      players: r.players,
      language: r.language,
      price: r.price,
      notes: r.notes,
    }));
  return list;
}
