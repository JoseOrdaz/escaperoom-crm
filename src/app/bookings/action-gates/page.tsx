"use client";

import BookingWizard from "@/app/bookings/page"; // 👈 importa tu BookingWizard

export default function BookingsActionGatesPage() {
  const roomIds = [
    "68d70ef68bf39964730e5a5d", 
    "68d70f1c8bf39964730e5a5e",
    "68e2581f9447bed395138370",
    
  ];

  return <BookingWizard roomIds={roomIds} />;
}
