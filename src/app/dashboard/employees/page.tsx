"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const LABELS: Record<string, string> = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miércoles",
  thursday: "Jueves",
  friday: "Viernes",
  saturday: "Sábado",
  sunday: "Domingo",
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: "",
    surname: "",
    email: "",
    role: "",
  });

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
      toast.success("Empleado creado");
      setForm({ name: "", surname: "", email: "", role: "" });
      loadEmployees();
    }
  }

  async function updateSchedule(id: string, weeklySchedule: any) {
    await fetch("/api/employees", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _id: id, weeklySchedule }),
    });
    toast.success("Horario actualizado");
    loadEmployees();
  }

  async function checkIn(email: string, type: "in" | "out") {
    const res = await fetch("/api/employees/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, type }),
    });
    if (res.ok) {
      toast.success(type === "in" ? "Entrada registrada" : "Salida registrada");
      loadEmployees();
    }
  }

  useEffect(() => {
    loadEmployees();
  }, []);

  // Obtiene el estado actual de fichaje (hoy)
  function getStatus(emp: any) {
    const today = new Date().toISOString().split("T")[0];
    const todayLogs = emp.checkins?.filter((c: any) =>
      c.timestamp.startsWith(today)
    );

    if (!todayLogs?.length) return { status: "Sin fichar", color: "text-gray-500" };

    const last = todayLogs[todayLogs.length - 1];
    if (last.type === "in")
      return {
        status: `🟢 Trabajando desde ${format(
          new Date(last.timestamp),
          "HH:mm",
          { locale: es }
        )}`,
        color: "text-green-600",
      };
    else
      return {
        status: `🔴 Descanso desde ${format(
          new Date(last.timestamp),
          "HH:mm",
          { locale: es }
        )}`,
        color: "text-red-600",
      };
  }

  return (
    <div className="p-6">
      <Tabs defaultValue="list" className="space-y-6">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="list">👥 Empleados</TabsTrigger>
          <TabsTrigger value="schedule">📆 Horario</TabsTrigger>
          <TabsTrigger value="checkin">⏱️ Fichar</TabsTrigger>
          <TabsTrigger value="history">📜 Registro</TabsTrigger>
        </TabsList>

        {/* 🧑‍💼 CREAR EMPLEADOS */}
        <TabsContent value="list">
          <Card>
            <CardHeader>
              <CardTitle>Añadir empleado</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Input placeholder="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input placeholder="Apellidos" value={form.surname} onChange={(e) => setForm({ ...form, surname: e.target.value })} />
              <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <Input placeholder="Cargo" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
              <Button onClick={createEmployee}>Guardar</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 🗓️ HORARIO SEMANAL */}
        <TabsContent value="schedule">
          <div className="grid md:grid-cols-2 gap-4">
            {employees.map((emp) => (
              <Card key={emp._id}>
                <CardHeader>
                  <CardTitle>{emp.name} {emp.surname}</CardTitle>
                  <p className="text-sm text-muted-foreground">{emp.role}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {DAYS.map((d) => (
                    <div key={d} className="grid grid-cols-4 gap-2 items-center">
                      <p className="text-sm">{LABELS[d]}</p>
                      <Input
                        placeholder="Inicio"
                        value={emp.weeklySchedule?.[d]?.start || ""}
                        onChange={(e) => {
                          emp.weeklySchedule[d].start = e.target.value;
                          updateSchedule(emp._id, emp.weeklySchedule);
                        }}
                      />
                      <Input
                        placeholder="Fin"
                        value={emp.weeklySchedule?.[d]?.end || ""}
                        onChange={(e) => {
                          emp.weeklySchedule[d].end = e.target.value;
                          updateSchedule(emp._id, emp.weeklySchedule);
                        }}
                      />
                      <Input
                        placeholder="Salas (coma)"
                        value={emp.weeklySchedule?.[d]?.rooms?.join(", ") || ""}
                        onChange={(e) => {
                          emp.weeklySchedule[d].rooms = e.target.value.split(",").map((r) => r.trim());
                          updateSchedule(emp._id, emp.weeklySchedule);
                        }}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* 🕒 FICHAJE */}
        <TabsContent value="checkin">
          <Card>
            <CardHeader>
              <CardTitle>Panel de fichaje</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {employees.map((emp) => {
                const s = getStatus(emp);
                return (
                  <div key={emp._id} className="flex justify-between items-center border rounded-md p-3">
                    <div>
                      <p className="font-semibold">{emp.name} {emp.surname}</p>
                      <p className={`text-sm ${s.color}`}>{s.status}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => checkIn(emp.email, "in")}>
                        Entrada
                      </Button>
                      <Button onClick={() => checkIn(emp.email, "out")}>
                        Salida
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 🧾 HISTORIAL */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Historial de fichajes</CardTitle>
            </CardHeader>
            <CardContent>
              {employees.map((emp) => (
                <div key={emp._id} className="mb-4">
                  <h3 className="font-semibold mb-2">
                    {emp.name} {emp.surname}
                  </h3>
                  <div className="border rounded-md p-3 space-y-1 text-sm">
                    {emp.checkins?.length ? (
                      emp.checkins.map((c: any, i: number) => (
                        <p key={i}>
                          {c.type === "in" ? "🟢 Entrada" : "🔴 Salida"} -{" "}
                          {format(new Date(c.timestamp), "dd/MM/yyyy HH:mm", { locale: es })}
                        </p>
                      ))
                    ) : (
                      <p className="text-muted-foreground">Sin registros</p>
                    )}
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
