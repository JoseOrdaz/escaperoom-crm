"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: "",
    surname: "",
    email: "",
    role: "",
  });
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  async function loadEmployees() {
    const res = await fetch("/api/employees");
    const data = await res.json();
    setEmployees(data);
  }

  async function createEmployee() {
    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      toast.success("Empleado creado correctamente");
      setForm({ name: "", surname: "", email: "", role: "" });
      loadEmployees();
    } else toast.error("Error al crear el empleado");
  }

  async function checkIn(email: string, type: "in" | "out") {
    const res = await fetch("/api/employees/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, type }),
    });
    if (res.ok)
      toast.success(type === "in" ? "Entrada registrada" : "Salida registrada");
    else toast.error("Error al registrar fichaje");
  }

  async function deleteEmployee(id: string) {
    if (!confirm("¿Seguro que quieres eliminar este empleado?")) return;
    const res = await fetch(`/api/employees?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Empleado eliminado");
      loadEmployees();
    } else toast.error("Error al eliminar");
  }

  useEffect(() => {
    loadEmployees();
  }, []);

  return (
    <div className="p-6">
      <Tabs defaultValue="list" className="space-y-6">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="list">👥 Empleados</TabsTrigger>
          <TabsTrigger value="calendar">🗓️ Horarios</TabsTrigger>
          <TabsTrigger value="checkin">⏱️ Fichar</TabsTrigger>
        </TabsList>

        {/* 📋 LISTA DE EMPLEADOS */}
        <TabsContent value="list">
          <Card>
            <CardHeader>
              <CardTitle>Añadir nuevo empleado</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid grid-cols-2 gap-2">
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
              </div>
              <Input
                placeholder="Correo"
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

          <div className="grid md:grid-cols-3 gap-4 mt-6">
            {employees.map((emp) => (
              <Card key={emp._id} className="hover:shadow-lg transition">
                <CardHeader className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={emp.avatar || "/avatar-default.png"} />
                    <AvatarFallback>
                      {emp.name[0]}
                      {emp.surname[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <CardTitle className="text-lg">
                      {emp.name} {emp.surname}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">{emp.role}</p>
                  </div>
                </CardHeader>
                <CardContent className="flex justify-between">
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

        {/* 🗓️ HORARIO SEMANAL */}
        <TabsContent value="calendar">
          <Card>
            <CardHeader>
              <CardTitle>Horario laboral semanal</CardTitle>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="rounded-md border"
              />
              <p className="mt-4 text-sm text-muted-foreground">
                Próximamente: visualización de turnos semanales.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ⏱️ FICHAJE */}
        <TabsContent value="checkin">
          <Card>
            <CardHeader>
              <CardTitle>Panel de fichaje</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {employees.map((emp) => (
                <div
                  key={emp._id}
                  className="flex justify-between items-center border rounded-md p-3"
                >
                  <div>
                    <p className="font-semibold">
                      {emp.name} {emp.surname}
                    </p>
                    <p className="text-sm text-muted-foreground">{emp.email}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => checkIn(emp.email, "in")}
                    >
                      Entrada
                    </Button>
                    <Button onClick={() => checkIn(emp.email, "out")}>
                      Salida
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
