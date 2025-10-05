"use client";

import BookingWizard from "@/app/bookings/page"; // 👈 importa tu BookingWizard

export default function BookingsFobiaPage() {
  const roomIds = [
    "68e19f57c164ecb8af94a90c", // Gulliver y los Gigantes
    "68e21ca5a4b8222c245033e9", // La Piedra Filosofal
    "68e21f7fa4b8222c245033ea", // La Academia de Houdini
    "68e22019a4b8222c245033eb", // La Casa de los Fantasmas
  ];

  return <BookingWizard roomIds={roomIds} />;
}
