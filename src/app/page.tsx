import { redirect } from "next/navigation";
import { getAccess } from "@/lib/access";

export const dynamic = "force-dynamic";

/** Inicio: si hay sesión, al panel; si no, al login */
export default async function Home() {
  const access = await getAccess().catch(() => null);
  if (!access) redirect("/login");
  redirect("/dashboard");
}
