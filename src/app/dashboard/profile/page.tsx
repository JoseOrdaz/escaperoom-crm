"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, Loader2, Save, UserRound, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Profile = { name: string; surname: string; email: string; username: string; avatar: string; role: string };

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [changingPassword, setChangingPassword] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/profile", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error(response.status === 401 ? "Inicia sesión de nuevo para acceder a tu perfil." : "No se ha podido cargar el perfil.");
      setProfile(await response.json());
    }).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!profile) return;
    setSaving(true);
    try {
      const response = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se han podido guardar los cambios");
      setProfile(data);
      window.dispatchEvent(new Event("profile-updated"));
      toast.success("Perfil actualizado");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Error al guardar"); }
    finally { setSaving(false); }
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    if (passwords.next !== passwords.confirm) { toast.error("Las contraseñas nuevas no coinciden"); return; }
    setChangingPassword(true);
    try {
      const response = await fetch("/api/profile/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: passwords.current, newPassword: passwords.next }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se ha podido cambiar la contraseña");
      setPasswords({ current: "", next: "", confirm: "" });
      toast.success("Contraseña actualizada");
    } catch (err) { toast.error(err instanceof Error ? err.message : "No se ha podido cambiar la contraseña"); }
    finally { setChangingPassword(false); }
  }

  async function upload(file?: File) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) { toast.error("Usa una imagen PNG, JPEG o WebP de hasta 2 MB"); return; }
    setUploading(true);
    try {
      const form = new FormData(); form.set("file", file);
      const response = await fetch("/api/profile/avatar", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se ha podido subir la foto");
      setProfile((current) => current ? { ...current, avatar: data.avatar } : current);
      window.dispatchEvent(new Event("profile-updated"));
      toast.success("Foto actualizada");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Error al subir la foto"); }
    finally { setUploading(false); if (inputRef.current) inputRef.current.value = ""; }
  }

  if (loading) return <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground" role="status"><Loader2 className="size-4 animate-spin" />Cargando tu perfil…</div>;
  if (error || !profile) return <div className="space-y-4"><h1 className="text-2xl font-semibold">Mi perfil</h1><p className="text-sm text-muted-foreground">{error}</p><Button asChild><Link href="/login">Iniciar sesión</Link></Button></div>;
  const initials = `${profile.name[0] ?? ""}${profile.surname[0] ?? ""}`.toUpperCase();
  return <div className="max-w-5xl space-y-6">
    <div><h1 className="text-2xl font-semibold tracking-tight">Mi perfil</h1><p className="mt-1 text-sm text-muted-foreground">Gestiona tus datos personales y tu foto de perfil.</p></div>
    <div className="grid gap-6 md:grid-cols-[260px_minmax(0,1fr)]">
      <Card className="h-fit"><CardContent className="flex flex-col items-center px-6 text-center"><Avatar className="size-24"><AvatarImage src={profile.avatar || undefined} alt={`Foto de ${profile.name}`} /><AvatarFallback className="bg-primary/10 text-xl text-primary">{initials || <UserRound />}</AvatarFallback></Avatar><p className="mt-4 font-semibold">{profile.name} {profile.surname}</p><p className="mt-1 text-sm text-muted-foreground">{profile.role === "admin" ? "Administrador" : profile.role === "game_master" ? "Game master" : profile.role}</p><input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} onChange={(event) => upload(event.target.files?.[0])} /><Button type="button" variant="outline" className="mt-5 w-full" disabled={uploading} onClick={() => inputRef.current?.click()}>{uploading ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}{uploading ? "Subiendo…" : "Cambiar foto"}</Button><p className="mt-3 text-xs leading-5 text-muted-foreground">PNG, JPEG o WebP. Máximo 2 MB.</p></CardContent></Card>
      <div className="space-y-6"><Card><CardHeader><CardTitle>Datos personales</CardTitle><CardDescription>Actualiza la información asociada a tu cuenta.</CardDescription></CardHeader><CardContent><form onSubmit={save} className="space-y-5"><div className="grid gap-5 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="profile-name">Nombre</Label><Input id="profile-name" required maxLength={80} value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></div><div className="space-y-2"><Label htmlFor="profile-surname">Apellidos</Label><Input id="profile-surname" required maxLength={80} value={profile.surname} onChange={(e) => setProfile({ ...profile, surname: e.target.value })} /></div></div><div className="space-y-2"><Label htmlFor="profile-email">Correo electrónico</Label><Input id="profile-email" type="email" required maxLength={254} value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} /></div><div className="space-y-2"><Label htmlFor="profile-username">Usuario</Label><Input id="profile-username" required maxLength={80} value={profile.username} onChange={(e) => setProfile({ ...profile, username: e.target.value })} /></div><div className="flex justify-end border-t pt-5"><Button type="submit" disabled={saving || uploading}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}{saving ? "Guardando…" : "Guardar cambios"}</Button></div></form></CardContent></Card>
      <Card><CardHeader><CardTitle>Contraseña</CardTitle><CardDescription>Introduce tu contraseña actual para establecer una nueva.</CardDescription></CardHeader><CardContent><form onSubmit={changePassword} className="space-y-5"><div className="space-y-2"><Label htmlFor="current-password">Contraseña actual</Label><Input id="current-password" type="password" autoComplete="current-password" required value={passwords.current} onChange={(e) => setPasswords({ ...passwords, current: e.target.value })} /></div><div className="grid gap-5 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="new-password">Nueva contraseña</Label><Input id="new-password" type="password" autoComplete="new-password" required minLength={8} value={passwords.next} onChange={(e) => setPasswords({ ...passwords, next: e.target.value })} /><p className="text-xs text-muted-foreground">Al menos 8 caracteres.</p></div><div className="space-y-2"><Label htmlFor="confirm-password">Confirmar contraseña</Label><Input id="confirm-password" type="password" autoComplete="new-password" required minLength={8} value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} /></div></div><div className="flex justify-end border-t pt-5"><Button type="submit" disabled={changingPassword}>{changingPassword ? <Loader2 className="size-4 animate-spin" /> : <LockKeyhole className="size-4" />}{changingPassword ? "Actualizando…" : "Cambiar contraseña"}</Button></div></form></CardContent></Card></div>
    </div>
  </div>;
}
