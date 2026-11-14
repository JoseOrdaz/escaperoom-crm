export default async function BajaPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold">{error ? "Enlace no válido" : "Te has dado de baja"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error
            ? "No hemos podido procesar la baja con este enlace. Escríbenos y lo hacemos nosotros."
            : "No recibirás más avisos ni novedades por correo. Seguirás recibiendo los correos de tus reservas."}
        </p>
      </div>
    </main>
  );
}
