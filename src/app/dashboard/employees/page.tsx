"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import {
  Users,
  CalendarDays,
  Clock3,
  ClipboardList,
  Plus,
  Pencil,
  Save,
  Building2,
  LogIn,
  LogOut,
  UserRound,
  ChevronLeft, ChevronRight, Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { usePathname, useSearchParams } from "next/navigation";
import { CheckinPanel } from "./_components/checkin-panel";



export default function EmployeesPage() {
  /* ───── Estados ───── */
  const emptyForm = {
    name: "",
    surname: "",
    email: "",
    username: "",
    password: "",
    role: "",
    escape: "Fobia",
  };

  const [employees, setEmployees] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [savingEmployee, setSavingEmployee] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [openModal, setOpenModal] = useState(false);

  const [schedule, setSchedule] = useState<any[]>([]);
  const [escapeFilter, setEscapeFilter] = useState("Fobia");

  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [openShiftModal, setOpenShiftModal] = useState(false);
  const [shiftForm, setShiftForm] = useState({
    date: "",
    employeeId: "",
    start: "",
    end: "",
  });

  const [records, setRecords] = useState<any[]>([]);
  const [active, setActive] = useState<any[]>([]);
  const [filterEmployee, setFilterEmployee] = useState("__all__");
  const [filterDate, setFilterDate] = useState("");

  const filteredRecords = records.filter((r) => {
    const byEmployee =
      filterEmployee === "__all__" || r.employeeId === filterEmployee;

    const byDate =
      !filterDate ||
      new Date(r.time).toISOString().slice(0, 10) === filterDate;

    return byEmployee && byDate;
  });



  /* ───── Funciones base ───── */
  async function loadEmployees() {
    const res = await fetch("/api/employees");
    setEmployees(await res.json());
  }

  async function saveEmployee() {
    const url = "/api/employees";
    const method = editing ? "PUT" : "POST";
    const body = editing ? { ...form, _id: editing } : form;

    setSavingEmployee(true);
    try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json();
      toast.success(editing ? "Empleado actualizado" : "Empleado creado", data.reauthRequired ? { description: "Inicia sesión de nuevo para seguir administrando empleados." } : undefined);
      setForm(emptyForm);
      setEditing(null);
      setOpenModal(false);
      await loadEmployees();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "No se ha podido guardar el empleado");
    }
    } catch { toast.error("No se ha podido conectar con el servidor"); }
    finally { setSavingEmployee(false); }
  }

  async function deleteEmployee(employee: any) {
    if (!window.confirm(`¿Eliminar a ${employee.name} ${employee.surname}? Se conservarán sus fichajes y turnos.`)) return;
    try {
      const res = await fetch(`/api/employees?id=${encodeURIComponent(employee._id)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se ha podido eliminar");
      toast.success("Empleado eliminado");
      await loadEmployees();
    } catch (error) { toast.error(error instanceof Error ? error.message : "No se ha podido eliminar"); }
  }

  async function loadSchedule() {
    const res = await fetch(`/api/schedule?escape=${escapeFilter}`);
    setSchedule(await res.json());
  }

  /* ───── Fichaje ───── */

  /* Cargar registros */
  async function loadRecords() {
    const res = await fetch("/api/employees/checkin");
    if (res.ok) {
      const data = await res.json();
      setRecords(data.all || []);
      setActive(data.active || []);
    }
  }




  /* ───── Hooks ───── */
  useEffect(() => {
    loadEmployees();
    fetch("/api/profile", { cache: "no-store" }).then((res) => res.ok ? res.json() : null).then((user) => setIsAdmin(user?.role === "admin")).catch(() => setIsAdmin(false));
  }, []);

  useEffect(() => {
    loadSchedule();
  }, [escapeFilter]);

  useEffect(() => {
    loadRecords();
  }, []);

  const filteredSchedule = schedule.sort((a, b) => (a.date > b.date ? 1 : -1));

  // Estado actual del tab
const [tabValue, setTabValue] = useState("list");

// Detecta el hash de la URL (#checkin, #calendar, etc.)
useEffect(() => {
  const handleHashChange = () => {
    const hash = window.location.hash.replace("#", "");
    if (hash) setTabValue(hash);
  };

  // Escucha cambios de hash (cuando el usuario navega desde el header)
  handleHashChange(); // ejecuta una vez al cargar
  window.addEventListener("hashchange", handleHashChange);
  return () => window.removeEventListener("hashchange", handleHashChange);
}, []);

// Sincroniza el hash al cambiar de pestaña manualmente
useEffect(() => {
  if (tabValue) {
    window.history.replaceState(null, "", `#${tabValue}`);
  }
}, [tabValue]);


  /* ───── Render ───── */
  return (
    <>
    <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
  <div>
    <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
      Empleados
    </h1>
    <p className="text-sm text-muted-foreground">
      Consulta los datos del personal, sus horarios y el estado de sus fichajes
    </p>
  </div>
</div>

    <div className="space-y-6">
      <Tabs value={tabValue} onValueChange={setTabValue}>
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-2xl bg-white p-1.5 sm:grid-cols-4">
          <TabsTrigger className="min-h-11 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none" value="list">
            <Users className="w-4 h-4 mr-1" /> Empleados
          </TabsTrigger>
          <TabsTrigger className="min-h-11 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none" value="calendar">
            <CalendarDays className="w-4 h-4 mr-1" /> Calendario
          </TabsTrigger>
          <TabsTrigger className="min-h-11 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none" value="checkin">
            <Clock3 className="w-4 h-4 mr-1" /> Fichaje
          </TabsTrigger>
          <TabsTrigger className="min-h-11 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none" value="history">
            <ClipboardList className="w-4 h-4 mr-1" /> Registro
          </TabsTrigger>
        </TabsList>

        {/* ───── LISTA DE EMPLEADOS ───── */}
        <TabsContent value="list">

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <Users className="h-5 w-5 text-primary" /> Equipo
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {employees.length} {employees.length === 1 ? "empleado" : "empleados"} · {active.length} en turno ahora
                  </p>
                </div>
            <Dialog
              open={openModal}
              onOpenChange={(open) => {
                setOpenModal(open);
                if (!open) {
                  setForm(emptyForm);
                  setEditing(null);
                }
              }}
            >
              <DialogTrigger asChild>
                <Button disabled={!isAdmin}
                  onClick={() => {
                    setEditing(null);
                    setForm(emptyForm);
                    setOpenModal(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-1" /> Nuevo empleado
                </Button>
              </DialogTrigger>

              <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {editing ? "Editar empleado" : "Añadir empleado"}
                  </DialogTitle>
                </DialogHeader>

                <div className="grid gap-3 py-2">
  <div className="grid grid-cols-2 gap-2">
    <div className="space-y-2"><Label htmlFor="employee-name">Nombre</Label><Input id="employee-name"
      placeholder="Nombre"
      value={form.name}
      onChange={(e) => setForm({ ...form, name: e.target.value })}
    />
    </div><div className="space-y-2"><Label htmlFor="employee-surname">Apellidos</Label><Input id="employee-surname"
      placeholder="Apellidos"
      value={form.surname}
      onChange={(e) => setForm({ ...form, surname: e.target.value })}
    />
    </div>
  </div>

  <div className="space-y-2"><Label htmlFor="employee-email">Correo electrónico</Label><Input id="employee-email" type="email"
    placeholder="Email"
    value={form.email}
    onChange={(e) => setForm({ ...form, email: e.target.value })}
  />

  </div><div className="space-y-2"><Label htmlFor="employee-username">Usuario (opcional)</Label><Input id="employee-username"
    placeholder="Usuario (opcional)"
    value={form.username || ""}
    onChange={(e) => setForm({ ...form, username: e.target.value })}
  />

  </div><div className="space-y-2"><Label htmlFor="employee-password">{editing ? "Nueva contraseña (opcional)" : "Contraseña"}</Label><Input id="employee-password"
    type="password"
    placeholder={editing ? "Dejar vacía para mantener la actual" : "Al menos 8 caracteres"}
    autoComplete="new-password"
    value={form.password || ""}
    onChange={(e) => setForm({ ...form, password: e.target.value })}
  />

  </div><div className="space-y-2"><Label htmlFor="employee-role">Rol</Label><Select
    value={form.role}
    onValueChange={(v) => setForm({ ...form, role: v })}
  >
    <SelectTrigger id="employee-role" className="w-full">
      <SelectValue placeholder="Rol del empleado" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="admin">Administrador</SelectItem>
      <SelectItem value="game_master">Game Master</SelectItem>
    </SelectContent>
  </Select>

  </div><div className="space-y-2"><Label htmlFor="employee-escape">Escape asociado</Label><Select
    value={form.escape}
    onValueChange={(v) => setForm({ ...form, escape: v })}
  >
    <SelectTrigger id="employee-escape" className="w-full">
      <SelectValue placeholder="Escape asociado" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="Fobia">Fobia</SelectItem>
      <SelectItem value="Action Gates">Action Gates</SelectItem>
    </SelectContent>
  </Select>

  </div><DialogFooter className="flex justify-end gap-2 mt-3">
    <Button
      variant="outline"
      onClick={() => {
        setForm(emptyForm);
        setEditing(null);
        setOpenModal(false);
      }}
    >
      Cancelar
    </Button>
    <Button onClick={saveEmployee} disabled={savingEmployee}>
      {savingEmployee ? "Guardando…" : editing ? "Guardar cambios" : "Crear empleado"}
    </Button>
  </DialogFooter>
</div>

              </DialogContent>
            </Dialog>
              </div>
            </CardHeader>
            <CardContent>

          
          {/* Listado de empleados */}
          <div className="divide-y rounded-xl border">
            {employees.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">No hay empleados registrados.</p> : employees.map((emp) => (
              <div key={emp._id} className="flex flex-wrap items-center gap-4 p-4 sm:px-5">
                <div className="relative"><Avatar className="size-11"><AvatarImage src={emp.avatar || "/avatar-default.png"} /><AvatarFallback className="bg-primary/10 font-medium text-primary">{emp.name?.[0]}{emp.surname?.[0]}</AvatarFallback></Avatar>{active.some((r) => String(r.employeeId) === String(emp._id)) && <span title="En turno" className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-card bg-emerald-500" />}</div>
                <div className="min-w-0 flex-1"><p className="font-semibold">{emp.name} {emp.surname}</p><p className="mt-1 break-all text-sm text-muted-foreground">{emp.email}</p></div>
                <div className="flex w-full flex-wrap items-center gap-2 pl-[60px] sm:w-60 sm:pl-0"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${emp.role === "admin" ? "bg-primary/10 text-primary" : "bg-sky-500/10 text-sky-700"}`}>{emp.role === "admin" ? "Administrador" : emp.role === "game_master" ? "Game Master" : emp.role}</span><span className="flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground"><Building2 className="size-3" />{emp.escape || "Sin escape"}</span></div>
                {isAdmin && <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => { setEditing(emp._id); setForm({ ...emp, password: "" }); setOpenModal(true); }}><Pencil className="size-4" />Editar</Button><Button size="sm" variant="outline" className="text-destructive" onClick={() => deleteEmployee(emp)}><Trash2 className="size-4" />Eliminar</Button></div>}
              </div>
            ))}
          </div>
          </CardContent>
          </Card>
        </TabsContent>

        {/* ───── CALENDARIO LABORAL ───── */}
        <TabsContent value="calendar">
          <Card>
            <CardHeader className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5" />
                <CardTitle>Calendario Laboral Semanal</CardTitle>
              </div>
              <Select value={escapeFilter} onValueChange={setEscapeFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Selecciona escape" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Fobia">Fobia</SelectItem>
                  <SelectItem value="Action Gates">Action Gates</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>

            <CardContent>
              {/* NAV SEMANAL */}
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setSelectedDate(
                      new Date(selectedDate!.setDate(selectedDate!.getDate() - 7))
                    )
                  }
                >
                  <ChevronLeft className="size-4" /> Semana anterior
                </Button>
                <p className="font-medium">
                  Semana del{" "}
                  {format(new Date(selectedDate!.getFullYear(), selectedDate!.getMonth(), selectedDate!.getDate() - selectedDate!.getDay()), "dd MMM yyyy", { locale: es })} –{" "}
                  {format(
                    new Date(selectedDate!.getFullYear(), selectedDate!.getMonth(), selectedDate!.getDate() - selectedDate!.getDay() + 6),
                    "dd MMM yyyy",
                    { locale: es }
                  )}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setSelectedDate(
                      new Date(selectedDate!.setDate(selectedDate!.getDate() + 7))
                    )
                  }
                >
                  Semana siguiente <ChevronRight className="size-4" />
                </Button>
              </div>

              {/* GRID SEMANAL */}
              <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
                {Array.from({ length: 7 }).map((_, i) => {
                  const current = new Date(
                    selectedDate!.getFullYear(),
                    selectedDate!.getMonth(),
                    selectedDate!.getDate() - selectedDate!.getDay() + i
                  );
                  const iso = current.toISOString().split("T")[0];
                  const dayData = schedule.find((s) => s.date === iso);

                  return (
                    <div
                      key={i}
                      className="border rounded-lg p-3 shadow-sm hover:shadow-md transition-all bg-card"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <p className="font-semibold text-sm">
                          {format(current, "EEE dd/MM", { locale: es })}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setShiftForm({
                              ...shiftForm,
                              date: iso,
                            });
                            setOpenShiftModal(true);
                          }}
                          title="Añadir turno"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>

                      {/* TURNOS */}
                      {dayData && dayData.shifts.length > 0 ? (
                        <div className="space-y-2">
                          {dayData.shifts.map((s: any, idx: number) => {
                            const emp = employees.find(
                              (e) => e._id === s.employeeId?.toString()
                            );
                            return (
                              <div
                                key={idx}
                                className="rounded-md border bg-muted/40 p-2 text-sm"
                              >
                                <p className="flex items-center gap-1 font-medium">
                                  <UserRound className="size-4" aria-hidden="true" /> {emp ? `${emp.name} ${emp.surname}` : "—"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {s.start} – {s.end}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">
                          Sin turnos asignados
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* MODAL PARA AÑADIR TURNO */}
          <Dialog open={openShiftModal} onOpenChange={setOpenShiftModal}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Asignar turno</DialogTitle>
                <DialogDescription>
                  Selecciona el empleado y horario para {shiftForm.date}.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-3 py-2">
                <Select
                  value={shiftForm.employeeId}
                  onValueChange={(v) => setShiftForm({ ...shiftForm, employeeId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar empleado" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees
                      .filter((e) => e.escape === escapeFilter)
                      .map((e) => (
                        <SelectItem key={e._id} value={e._id}>
                          {e.name} {e.surname}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>

                {/* Select hora inicio */}
                <Select
                  value={shiftForm.start}
                  onValueChange={(v) => setShiftForm({ ...shiftForm, start: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Hora inicio" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => i)
                      .map((h) => `${String(h).padStart(2, "0")}:00`)
                      .map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>

                {/* Select hora fin */}
                <Select
                  value={shiftForm.end}
                  onValueChange={(v) => setShiftForm({ ...shiftForm, end: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Hora fin" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => i)
                      .map((h) => `${String(h).padStart(2, "0")}:00`)
                      .map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>

                <DialogFooter className="flex justify-end gap-2 mt-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShiftForm({
                        date: "",
                        employeeId: "",
                        start: "",
                        end: "",
                      });
                      setOpenShiftModal(false);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={async () => {
                      if (!shiftForm.employeeId || !shiftForm.start || !shiftForm.end) {
                        toast.error("Completa todos los campos");
                        return;
                      }

                      const res = await fetch("/api/schedule", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          ...shiftForm,
                          escape: escapeFilter,
                        }),
                      });

                      if (res.ok) {
                        toast.success("Turno asignado correctamente");
                        setShiftForm({
                          date: "",
                          employeeId: "",
                          start: "",
                          end: "",
                        });
                        setOpenShiftModal(false);
                        loadSchedule();
                      } else {
                        toast.error("Error al guardar el turno");
                      }
                    }}
                  >
                    Guardar turno
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>


        {/* ───── FICHAJE ───── */}
        <TabsContent value="checkin">
          <CheckinPanel employees={employees} records={records} active={active} onRegistered={loadRecords} />
        </TabsContent>

        {/* ───── REGISTRO ───── */}
        <TabsContent value="history">
          <Card>
            <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-primary" />
                <CardTitle>Registro de Fichajes</CardTitle>
              </div>

              {/* Filtros */}
              <div className="flex flex-wrap gap-3">
                {/* Filtro por empleado */}
                <Select
                  onValueChange={(v) => setFilterEmployee(v)}
                  value={filterEmployee}
                >
                  <SelectTrigger aria-label="Filtrar por empleado" className="w-[200px]">
                    <SelectValue placeholder="Filtrar por empleado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos</SelectItem>
                    {employees.map((e) => (
                      <SelectItem key={e._id} value={e._id}>
                        {e.name} {e.surname}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Filtro por fecha */}
                <Input
                  type="date"
                  aria-label="Filtrar por fecha"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="w-[180px]"
                />
              </div>
            </CardHeader>

            <CardContent>
              {filteredRecords.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No hay registros que coincidan con el filtro.
                </p>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <div className="bg-muted/30 text-sm font-medium px-4 py-2 flex justify-between">
                    <span>Empleado</span>
                    <span>Registro</span>
                  </div>

                  <div className="divide-y">
                    {filteredRecords.map((r, i) => (
                      <div
                        key={i}
                        className="flex flex-wrap items-center justify-between gap-2 px-4 py-4 text-sm hover:bg-muted/30"
                      >
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <span>
                            {r.employee?.name} {r.employee?.surname}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {r.type === "in" ? (
                            <LogIn className="w-4 h-4 text-green-600" />
                          ) : (
                            <LogOut className="w-4 h-4 text-red-600" />
                          )}
                          <span
                            className={`font-medium ${r.type === "in" ? "text-green-700" : "text-red-700"
                              }`}
                          >
                            {r.type === "in" ? "Entrada" : "Salida"}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock3 className="w-3 h-3" />
                            {format(new Date(r.time), "dd/MM/yyyy HH:mm", {
                              locale: es,
                            })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>


      </Tabs>
    </div>
    </>
  );
}
