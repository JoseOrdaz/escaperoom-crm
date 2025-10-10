import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Rutas públicas
  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Leer cookie de sesión
  const session = req.cookies.get("session_user")?.value;
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const user = JSON.parse(session);

  // Control de roles
  const adminOnlyPaths = ["/dashboard/employees", "/dashboard/rooms"];
  const gmAllowed = [
    "/dashboard/bookings",
    "/dashboard/reservations",
    "/dashboard/employees#checkin",
    "/dashboard/employees#calendar",
  ];

  if (user.role === "game_master") {
    const path = pathname + req.nextUrl.hash;
    const isAllowed = gmAllowed.some((allowed) => path.startsWith(allowed));
    if (!isAllowed) {
      return NextResponse.redirect(new URL("/dashboard/bookings", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*"],
};
