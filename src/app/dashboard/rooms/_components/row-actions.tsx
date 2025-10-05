"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Pencil, Tag, CalendarClock, Trash } from "lucide-react";

type Props = { id: string; name?: string };

export function RowActions({ id, name }: Props) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function onDelete() {
    const t = toast.loading("Eliminando sala…");
    try {
      const res = await fetch(`/api/rooms/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Sala eliminada", { id: t });
      router.refresh();
    } catch (e: any) {
      toast.error("No se pudo eliminar", { id: t, description: e?.message ?? "Revisa reservas vinculadas" });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Button asChild variant="ghost" size="icon" title="Editar detalles">
        <Link href={`/dashboard/rooms/${id}`}>
          <Pencil className="h-4 w-4" /> 
        </Link>
      </Button>
      {/* <Button asChild variant="ghost" size="icon" title="Precios">
        <Link href={`/dashboard/rooms/${id}/pricing`}>
          <Tag className="h-4 w-4" />
        </Link>
      </Button>
      <Button asChild variant="ghost" size="icon" title="Horario">
        <Link href={`/dashboard/rooms/${id}/schedule`}>
          <CalendarClock className="h-4 w-4" />
        </Link>
      </Button> */}
{/* 
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="icon" title="Eliminar sala" disabled={deleting}>
            <Trash className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar sala</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Seguro que quieres eliminar <span className="font-medium">{name ?? "esta sala"}</span>? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog> */}
    </div>
  );
}
