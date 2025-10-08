import { ReactNode } from "react";
import { DashboardHeader } from "@/components/header";
import { DashboardFooter } from "@/components/footer";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <DashboardHeader />
      <main className="mx-auto w-full max-w-7xl px-4 py-6">{children}</main>
      <DashboardFooter />
    </div>
  );
}
