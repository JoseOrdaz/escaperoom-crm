import { DoorOpen, Heart, Compass } from "lucide-react";

export function DashboardFooter() {
  return (
    <footer className="border-t bg-muted/30 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between px-4 py-4 text-xs text-muted-foreground gap-2">
        {/* Izquierda */}
        <div className="flex items-center gap-2">
          <DoorOpen className="h-4 w-4 text-primary" />
          <span className="font-medium">Escape CRM</span>
          <span>© {new Date().getFullYear()}</span>
        </div>

        {/* Centro */}
        <div className="hidden sm:flex items-center gap-1 text-muted-foreground/80">
          <Heart className="h-3 w-3 text-red-500" />
          <span>Hecho con pasión para gestores de Escape Rooms</span>
        </div>

        {/* Derecha */}
        <div className="flex items-center gap-2 text-muted-foreground/80">
          <Compass className="h-4 w-4 text-primary/80" />
          <span>Gestión, reservas y control en un solo lugar</span>
        </div>
      </div>
    </footer>
  );
}
