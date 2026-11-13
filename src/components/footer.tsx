export function DashboardFooter() {
  return (
    <footer className="border-t px-4 py-5 text-xs text-muted-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2">
        <span>Escape CRM · Gestión de experiencias</span>
        <span>© {new Date().getFullYear()}</span>
      </div>
    </footer>
  );
}
