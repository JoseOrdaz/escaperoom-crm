import { CheckCircle2 } from "lucide-react";

export default function CanceladaPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center p-6">
      <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
      <h1 className="text-2xl font-bold text-green-600 mb-2">
        ¡Reserva cancelada correctamente!
      </h1>
      <p className="text-muted-foreground max-w-md">
        Hemos cancelado tu reserva con éxito. Esperamos verte pronto para otra aventura en nuestros Escape Rooms 🔐. 
        Si tienes alguna pregunta, no dudes en contactarnos.
        
      </p>
    </div>
  );
}
