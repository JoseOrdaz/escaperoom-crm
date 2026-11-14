"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarDays, CalendarRange, Clock3, DoorOpen, ExternalLink, LogOut, Mail, Menu, TicketPercent, Users, UserRoundCog, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const groups = [
  { label: "Operativa", links: [
    { href: "/dashboard/bookings", label: "Reservas", icon: CalendarDays },
    { href: "/dashboard/reservations", label: "Calendario", icon: CalendarRange },
    { href: "/dashboard/emails", label: "Correos", icon: Mail },
  ] },
  { label: "Cuenta", links: [{ href: "/dashboard/profile", label: "Mi perfil", icon: UserRound }] },
  { label: "Gestión", links: [
    { href: "/dashboard/rooms", label: "Salas", icon: DoorOpen },
    { href: "/dashboard/customers", label: "Clientes", icon: Users },
    { href: "/dashboard/employees", label: "Empleados", icon: UserRoundCog },
    { href: "/dashboard/coupons", label: "Cupones", icon: TicketPercent },
  ] },
];

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navegación principal" className="space-y-8 px-3 py-6">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-[#9298b5]">{group.label}</p>
          <div className="space-y-1">
            {group.links.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return <Link key={href} href={href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${active ? "bg-white/12 text-white" : "text-[#b8bdd2] hover:bg-white/8 hover:text-white"}`}><Icon className="size-[18px] shrink-0" aria-hidden="true" />{label}</Link>;
            })}
          </div>
        </div>
      ))}
      <div>
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-[#9298b5]">Accesos rápidos</p>
        <Link href="/dashboard/employees#checkin" onClick={onNavigate} className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-[#b8bdd2] hover:bg-white/8 hover:text-white"><Clock3 className="size-[18px]" aria-hidden="true" />Fichajes</Link>
        <Link href="/bookings" onClick={onNavigate} className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-[#b8bdd2] hover:bg-white/8 hover:text-white"><ExternalLink className="size-[18px]" aria-hidden="true" />Reserva de clientes</Link>
      </div>
    </nav>
  );
}

function Brand() {
  return <Link href="/dashboard/bookings" className="flex items-center gap-3 px-6 py-6 text-white"><span className="flex size-9 items-center justify-center rounded-lg bg-[#8067e8] text-white"><DoorOpen className="size-5" aria-hidden="true" /></span><span><span className="block text-sm font-semibold tracking-tight">Escape CRM</span><span className="block text-xs text-[#b8bdd2]">Panel de gestión</span></span></Link>;
}

export function DashboardHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ name?: string; role?: string; avatar?: string } | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const refresh = () => { const cookie = document.cookie.split("; ").find((row) => row.startsWith("session_user="));
    if (cookie) {
      try { setUser(JSON.parse(decodeURIComponent(cookie.slice("session_user=".length)))); } catch { setUser(null); }
      fetch("/api/profile", { cache: "no-store" }).then((res) => res.ok ? res.json() : null).then((profile) => {
        if (profile) setUser({ name: `${profile.name} ${profile.surname}`.trim(), role: profile.role, avatar: profile.avatar });
      }).catch(() => {});
    } };
    refresh();
    window.addEventListener("profile-updated", refresh);
    return () => window.removeEventListener("profile-updated", refresh);
  }, []);
  const current = groups.flatMap((group) => group.links).find((link) => pathname.startsWith(link.href));
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    document.cookie = "session_user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.push("/login");
  }
  return <>
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-[#20243c] text-white lg:flex">
      <Brand /><div className="border-t border-white/10" /><div className="flex-1 overflow-y-auto"><Navigation /></div>
      <div className="border-t border-white/10 p-4"><p className="truncate text-sm font-medium">{user?.name || "Usuario"}</p><p className="mt-1 text-xs text-[#b8bdd2]">{user?.role === "admin" ? "Administrador" : user?.role === "game_master" ? "Game master" : user?.role || "Sesión activa"}</p><Button variant="ghost" size="sm" onClick={logout} className="mt-3 w-full justify-start text-[#b8bdd2] hover:bg-white/10 hover:text-white"><LogOut className="mr-2 size-4" />Cerrar sesión</Button></div>
    </aside>
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-white/95 px-4 sm:px-6 lg:px-8">
      <Sheet open={open} onOpenChange={setOpen}><SheetTrigger asChild><Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menú"><Menu className="size-5" /></Button></SheetTrigger><SheetContent side="left" className="w-72 gap-0 border-0 bg-[#20243c] p-0 text-white"><SheetTitle className="sr-only">Navegación principal</SheetTitle><Brand /><div className="border-t border-white/10" /><div className="overflow-y-auto"><Navigation onNavigate={() => setOpen(false)} /></div><div className="mt-auto border-t p-4"><Button variant="ghost" onClick={logout} className="w-full justify-start"><LogOut className="mr-2 size-4" />Cerrar sesión</Button></div></SheetContent></Sheet>
      <div className="min-w-0"><p className="text-xs text-muted-foreground">Espacio de trabajo</p><p className="truncate text-sm font-semibold">{current?.label || "Gestión"}</p></div>
      <Link href="/dashboard/profile" className="ml-auto flex items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-primary" aria-label="Abrir mi perfil"><div className="hidden text-right sm:block"><p className="text-sm font-medium">{user?.name || "Usuario"}</p><p className="text-xs text-muted-foreground">{user?.role === "admin" ? "Administrador" : user?.role === "game_master" ? "Game master" : user?.role || ""}</p></div><Avatar className="size-9"><AvatarImage src={user?.avatar || undefined} alt="" /><AvatarFallback className="bg-primary/10 text-xs text-primary">{user?.name?.charAt(0)?.toUpperCase() || "U"}</AvatarFallback></Avatar></Link>
    </header>
  </>;
}
