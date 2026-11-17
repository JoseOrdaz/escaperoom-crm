"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Settings, Trophy, Wallet, CalendarClock, LayoutDashboard, CalendarDays, CalendarRange, Clock3, DoorOpen, ExternalLink, LogOut, Mail, Menu, TicketPercent, Users, UserRoundCog, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useSession } from "@/components/session-provider";
import type { Permission } from "@/lib/permissions";

const groups: { label: string; links: { href: string; label: string; icon: typeof CalendarDays; perm?: Permission }[] }[] = [
  { label: "Operativa", links: [
    { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
    { href: "/dashboard/bookings", label: "Reservas", icon: CalendarDays, perm: "reservations.view" },
    { href: "/dashboard/reservations", label: "Calendario", icon: CalendarRange, perm: "reservations.view" },
    { href: "/dashboard/payments", label: "Cobros", icon: Wallet, perm: "payments.manage" },
    { href: "/dashboard/emails", label: "Correos", icon: Mail, perm: "emails.view" },
    { href: "/dashboard/ranking", label: "Ranking", icon: Trophy, perm: "reservations.view" },
  ] },
  { label: "Gestión", links: [
    { href: "/dashboard/rooms", label: "Salas", icon: DoorOpen, perm: "rooms.manage" },
    { href: "/dashboard/schedules", label: "Horarios y precios", icon: CalendarClock, perm: "rooms.manage" },
    { href: "/dashboard/customers", label: "Clientes", icon: Users, perm: "customers.view" },
    { href: "/dashboard/employees", label: "Empleados", icon: UserRoundCog, perm: "employees.manage" },
    { href: "/dashboard/coupons", label: "Cupones", icon: TicketPercent, perm: "coupons.manage" },
    { href: "/dashboard/settings", label: "Ajustes", icon: Settings, perm: "rooms.manage" },
  ] },
];

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { can } = useSession();
  const visibleGroups = groups
    .map((g) => ({ ...g, links: g.links.filter((l) => !l.perm || can(l.perm)) }))
    .filter((g) => g.links.length > 0);
  return (
    <nav aria-label="Navegación principal" className="space-y-8 px-3 py-6">
      {visibleGroups.map((group) => (
        <div key={group.label}>
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-[#9298b5]">{group.label}</p>
          <div className="space-y-1">
            {group.links.map(({ href, label, icon: Icon }) => {
              const active = href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
              return <Link key={href} href={href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${active ? "bg-white/12 text-white" : "text-[#b8bdd2] hover:bg-white/8 hover:text-white"}`}><Icon className="size-[18px] shrink-0" aria-hidden="true" />{label}</Link>;
            })}
          </div>
        </div>
      ))}
      <div>
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-[#9298b5]">Accesos rápidos</p>
        <Link href="/dashboard/employees#checkin" onClick={onNavigate} className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-[#b8bdd2] hover:bg-white/8 hover:text-white"><Clock3 className="size-[18px]" aria-hidden="true" />Fichajes</Link>
        <Link href="/bookings" onClick={onNavigate} className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-[#b8bdd2] hover:bg-white/8 hover:text-white"><ExternalLink className="size-[18px]" aria-hidden="true" />Demo clientes</Link>
      </div>
    </nav>
  );
}

/** Zona con scroll del menú: degradado + flecha cuando hay más opciones abajo */
function NavScroll({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState({ up: false, down: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setMore({ up: el.scrollTop > 4, down: el.scrollTop + el.clientHeight < el.scrollHeight - 4 });
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => { el.removeEventListener("scroll", update); ro.disconnect(); };
  }, []);
  return (
    <div className={`relative min-h-0 ${className}`}>
      <div ref={ref} className="h-full overflow-y-auto [scrollbar-color:rgba(255,255,255,0.2)_transparent] [scrollbar-width:thin]">{children}</div>
      <div aria-hidden="true" className={`pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-[#20243c] to-transparent transition-opacity ${more.up ? "opacity-100" : "opacity-0"}`} />
      <div className={`pointer-events-none absolute inset-x-0 bottom-0 flex h-16 items-end justify-center bg-gradient-to-t from-[#20243c] via-[#20243c]/85 to-transparent pb-1.5 transition-opacity ${more.down ? "opacity-100" : "opacity-0"}`}>
        <button
          type="button"
          tabIndex={more.down ? 0 : -1}
          onClick={() => ref.current?.scrollBy({ top: ref.current.clientHeight * 0.6, behavior: "smooth" })}
          className={`flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-[#d6d9e8] backdrop-blur hover:bg-white/20 ${more.down ? "pointer-events-auto" : ""}`}
          aria-label="Ver más opciones del menú"
        >
          Más opciones <ChevronDown className="size-3.5 animate-bounce" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <Link href="/dashboard" className="block px-5 pb-4 pt-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" aria-label="Fobia Escape Rooms y Action Gates · Inicio">
      <span className="flex items-center justify-center gap-4">
        <img src="/brand/fobia.png" alt="Fobia Escape Rooms" className="h-auto w-[44%] max-w-[110px] object-contain" />
        <span className="h-9 w-px shrink-0 bg-white/20" aria-hidden="true" />
        <img src="/brand/action-gates.svg" alt="Action Gates" className="h-auto w-[44%] max-w-[104px] object-contain" />
      </span>
      <span className="mt-3 block text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9298b5]">Panel de gestión</span>
    </Link>
  );
}

const roleLabel = (role?: string) => (role === "admin" ? "Administrador" : role === "game_master" ? "Game master" : role || "Sesión activa");

/** Pie del menú: usuario (abre Mi perfil) + cerrar sesión */
function UserFooter({ user, onLogout, onNavigate }: { user: { name?: string; role?: string; avatar?: string } | null; onLogout: () => void; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = pathname.startsWith("/dashboard/profile");
  return (
    <div className="border-t border-white/10 p-3">
      <Link
        href="/dashboard/profile"
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={`flex items-center gap-3 rounded-lg p-2 transition-colors focus-visible:outline-2 focus-visible:outline-primary ${active ? "bg-white/12" : "hover:bg-white/8"}`}
        title="Mi perfil"
      >
        <Avatar className="size-9 ring-2 ring-white/15">
          <AvatarImage src={user?.avatar || undefined} alt="" />
          <AvatarFallback className="bg-[#8067e8] text-xs font-semibold text-white">{user?.name?.charAt(0)?.toUpperCase() || "U"}</AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-white">{user?.name || "Usuario"}</span>
          <span className="block truncate text-xs text-[#b8bdd2]">{roleLabel(user?.role)}</span>
        </span>
        <UserRound className="size-4 shrink-0 text-[#9298b5]" aria-hidden="true" />
      </Link>
      <Button variant="ghost" size="sm" onClick={onLogout} className="mt-1 w-full justify-start text-[#b8bdd2] hover:bg-white/10 hover:text-white">
        <LogOut className="mr-2 size-4" />Cerrar sesión
      </Button>
    </div>
  );
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
  const current = groups.flatMap((group) => group.links).find((link) => (link.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(link.href)));
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    document.cookie = "session_user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.push("/login");
  }
  return <>
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-[#20243c] text-white lg:flex">
      <Brand /><div className="border-t border-white/10" /><NavScroll className="flex-1"><Navigation /></NavScroll>
      <UserFooter user={user} onLogout={logout} />
    </aside>
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-white/95 px-4 sm:px-6 lg:px-8">
      <Sheet open={open} onOpenChange={setOpen}><SheetTrigger asChild><Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menú"><Menu className="size-5" /></Button></SheetTrigger><SheetContent side="left" className="w-72 gap-0 border-0 bg-[#20243c] p-0 text-white"><SheetTitle className="sr-only">Navegación principal</SheetTitle><Brand /><div className="border-t border-white/10" /><NavScroll className="flex-1"><Navigation onNavigate={() => setOpen(false)} /></NavScroll><UserFooter user={user} onLogout={logout} onNavigate={() => setOpen(false)} /></SheetContent></Sheet>
      <div className="min-w-0"><p className="text-xs text-muted-foreground">Espacio de trabajo</p><p className="truncate text-sm font-semibold">{current?.label || (pathname.startsWith("/dashboard/profile") ? "Mi perfil" : "Gestión")}</p></div>
      <Link href="/dashboard/profile" className="ml-auto flex items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-primary" aria-label="Abrir mi perfil"><div className="hidden text-right sm:block"><p className="text-sm font-medium">{user?.name || "Usuario"}</p><p className="text-xs text-muted-foreground">{user?.role === "admin" ? "Administrador" : user?.role === "game_master" ? "Game master" : user?.role || ""}</p></div><Avatar className="size-9"><AvatarImage src={user?.avatar || undefined} alt="" /><AvatarFallback className="bg-primary/10 text-xs text-primary">{user?.name?.charAt(0)?.toUpperCase() || "U"}</AvatarFallback></Avatar></Link>
    </header>
  </>;
}
