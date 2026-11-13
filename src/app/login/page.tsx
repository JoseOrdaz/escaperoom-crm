"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  CardHeader,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { ArrowRight, Loader2, LockKeyhole, UserRound } from "lucide-react";

const schema = z.object({
  username: z.string().min(1, "Introduce el usuario o correo"),
  password: z.string().min(1, "Introduce la contraseña"),
});

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { username: "", password: "" },
  });

  // 🧹 Limpiar sesión previa al entrar en login
  useEffect(() => {
    document.cookie = "session_user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  }, []);

  // 🔐 Enviar login
  async function onSubmit(values: z.infer<typeof schema>) {
    try {
      setLoading(true);
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const json = await res.json();
      setLoading(false);

      if (res.ok && json.ok) {
        toast.success(`Bienvenido ${json.user.name}`);
        // Redirigir según rol
        if (json.user.role === "admin") {
          router.push("/dashboard/rooms");
        } else {
          router.push("/dashboard/bookings");
        }
      } else {
        toast.error(json.error || "Credenciales incorrectas");
      }
    } catch {
      toast.error("Error de conexión");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f3f2f9] px-4 py-10 sm:py-14">
      <div className="w-full max-w-[460px]">
        <div className="mb-6 flex items-center justify-center gap-3 text-center">
          <span className="h-px w-8 bg-primary/25" aria-hidden="true" />
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Panel de gestión</p>
          <span className="h-px w-8 bg-primary/25" aria-hidden="true" />
        </div>
        <Card className="overflow-hidden border-0 bg-white py-0 shadow-[0_24px_80px_-30px_rgba(41,31,90,0.3)]">
          <div className="bg-[#20243c] px-7 py-8 sm:px-10 sm:py-9">
            <div className="flex items-center justify-center gap-6 sm:gap-8" aria-label="Fobia Escape Rooms y Action Gates">
              <img src="/brand/fobia.png" alt="Fobia Escape Rooms" className="h-auto w-[44%] max-w-[160px] object-contain" />
              <span className="h-12 w-px shrink-0 bg-white/20" aria-hidden="true" />
              <img src="/brand/action-gates.svg" alt="Action Gates" className="h-auto w-[44%] max-w-[155px] object-contain" />
            </div>
          </div>
          <CardHeader className="space-y-2 px-7 pb-0 pt-8 text-center sm:px-10 sm:pt-10">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Bienvenido de nuevo</h1>
            <CardDescription className="leading-6">Accede para gestionar tus salas, reservas y equipo.</CardDescription>
          </CardHeader>
          <CardContent className="px-7 pb-8 pt-7 sm:px-10 sm:pb-10">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField control={form.control} name="username" render={({ field }) => (
                  <FormItem><FormLabel>Usuario o correo</FormLabel><FormControl><div className="relative"><UserRound aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Tu usuario o correo" autoComplete="username" className="h-11 pl-10" {...field} /></div></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="password" render={({ field }) => (
                  <FormItem><FormLabel>Contraseña</FormLabel><FormControl><div className="relative"><LockKeyhole aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input type="password" placeholder="Tu contraseña" autoComplete="current-password" className="h-11 pl-10" {...field} /></div></FormControl><FormMessage /></FormItem>
                )} />
                <Button type="submit" className="mt-2 h-11 w-full" disabled={loading}>{loading ? <><Loader2 className="size-4 animate-spin" /> Accediendo…</> : <>Entrar al CRM <ArrowRight className="size-4" /></>}</Button>
              </form>
            </Form>
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-xs text-muted-foreground">Escape CRM · Gestión de experiencias</p>
      </div>
    </main>
  );
}
