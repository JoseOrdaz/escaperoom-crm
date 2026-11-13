"use client";

import BookingWizard from "@/components/bookings";
 
export default function BookingsActionGatesPage() {
  const roomIds = [
    "68d70ef68bf39964730e5a5d", 
    "68d70f1c8bf39964730e5a5e",
    "68e2581f9447bed395138370",
    
  ];

  return (
    <main className="min-h-dvh px-4 py-6 sm:px-6 sm:py-8">
      <BookingWizard roomIds={roomIds} contactPhone="+34 692 502 258" />
    </main>
  );
}
