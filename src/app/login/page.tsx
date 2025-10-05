"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
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
import { motion } from "framer-motion";
import { Lock, User, DoorOpen } from "lucide-react";

const schema = z.object({
  username: z.string().min(1, "Introduce el usuario"),
  password: z.string().min(1, "Introduce la contraseña"),
});

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { username: "", password: "" },
  });

  async function onSubmit(values: z.infer<typeof schema>) {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600)); // pequeña espera fake

    if (values.username === "admin" && values.password === "Fobia2025!") {
      toast.success("Bienvenido, Admin 👋");
      router.push("/dashboard/rooms");
    } else {
      toast.error("Credenciales incorrectas");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-zinc-900 dark:to-zinc-800">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="w-[380px] shadow-xl border border-gray-200 dark:border-zinc-700">
          <CardHeader className="text-center space-y-4">
            {/* === LOGO DEL CRM === */}
            <div className="flex items-center justify-center gap-3">
              <div className="p-3 bg-primary/10 rounded-2xl">
                <DoorOpen className="h-10 w-10 text-primary" strokeWidth={1.8} />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-primary">
                Escape CRM
              </h1>
            </div>

            <div className="pt-2">
              <CardTitle className="text-xl font-semibold text-gray-800 dark:text-white">
                Panel de Administración
              </CardTitle>
              <CardDescription>
                Introduce tus credenciales para acceder
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-5"
              >
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Usuario</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                          <Input
                            placeholder="admin"
                            className="pl-9"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contraseña</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                          <Input
                            type="password"
                            placeholder="********"
                            className="pl-9"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full mt-2"
                  disabled={loading}
                >
                  {loading ? "Accediendo..." : "Entrar"}
                </Button>
              </form>
            </Form>
          </CardContent>

          <CardFooter className="text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} EscapeRoom CRM · Todos los derechos reservados
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}
