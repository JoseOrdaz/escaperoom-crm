export function DashboardFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 text-xs text-muted-foreground">
        <span>© {new Date().getFullYear()} Escape CRM</span>
        <span>v0.1 • Next.js + MongoDB</span>
      </div>
    </footer>
  );
}
