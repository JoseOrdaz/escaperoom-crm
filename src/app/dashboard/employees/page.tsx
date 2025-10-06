"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import Image from "next/image";

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: "",
    surname: "",
    email: "",
    role: "",
    avatar: "",
  });
  const [file, setFile] = useState<File | null>(null);

  async function loadEmployees() {
    const res = await fetch("/api/employees");
    const data = await res.json();
    setEmployees(data);
  }

  async function uploadAvatar() {
    if (!file) return "";
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/employees/upload", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    return data.url;
  }

  async function createEmployee() {
    const avatarUrl = await uploadAvatar();
    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, avatar: avatarUrl }),
    });
    if (res.ok) {
      toast.success("Empleado creado");
      setForm({ name: "", surname: "", email: "", role: "", avatar: "" });
      setFile(null);
      loadEmployees();
    } else toast.error("Error al crear empleado");
  }

  async function deleteEmployee(id: string) {
    if (!confirm("¿Eliminar empleado?")) return;
    const res = await fetch(`/api/employees?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Empleado eliminado");
      loadEmployees();
    }
  }

  useEffect(() => {
    loadEmployees();
  }, []);

  return (
    <div className="p-6">
      <Tabs defaultValue="list" className="space-y-6">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="list">👥 Empleados</TabsTrigger>
          <TabsTrigger value="add">➕ Añadir empleado</TabsTrigger>
        </TabsList>

        {/* LISTADO DE EMPLEADOS */}
        <TabsContent value="list">
          <div className="grid md:grid-cols-3 gap-6">
            {employees.map((emp) => (
              <Card key={emp._id} className="hover:shadow-lg transition">
                <CardHeader className="flex items-center gap-3">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={emp.avatar || "/avatar-default.png"} />
                    <AvatarFallback>
                      {emp.name?.[0]}
                      {emp.surname?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg">
                      {emp.name} {emp.surname}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">{emp.role}</p>
                  </div>
                </CardHeader>
                <CardContent className="flex justify-between items-center">
                  <p className="text-xs text-muted-foreground">{emp.email}</p>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteEmployee(emp._id)}
                  >
                    Eliminar
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* FORMULARIO DE CREACIÓN */}
        <TabsContent value="add">
          <Card className="max-w-xl">
            <CardHeader>
              <CardTitle>Crear nuevo empleado</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex items-center gap-3">
                {file ? (
                  <Image
                    src={URL.createObjectURL(file)}
                    alt="avatar preview"
                    width={64}
                    height={64}
                    className="rounded-full border"
                  />
                ) : (
                  <div className="rounded-full bg-gray-100 h-16 w-16 flex items-center justify-center text-gray-400">
                    +
                  </div>
                )}
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </div>
              <Input
                placeholder="Nombre"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <Input
                placeholder="Apellidos"
                value={form.surname}
                onChange={(e) => setForm({ ...form, surname: e.target.value })}
              />
              <Input
                placeholder="Email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <Input
                placeholder="Cargo (Ej: Game Master)"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              />
              <Button onClick={createEmployee}>Guardar empleado</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
