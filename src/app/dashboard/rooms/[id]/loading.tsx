export default function RoomEditLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Cargando sala">
      <div className="space-y-2">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-muted" />
        <div className="h-4 w-48 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-11 w-full max-w-md animate-pulse rounded-xl bg-muted" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="h-96 animate-pulse rounded-2xl bg-muted" />
        <div className="h-64 animate-pulse rounded-2xl bg-muted" />
      </div>
    </div>
  );
}
