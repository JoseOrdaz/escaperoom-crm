"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { usePathname, useSearchParams } from "next/navigation";



export default function EmployeesPage() {
  /* ───── Estados ───── */
  const emptyForm = {
    name: "",
    surname: "",
    email: "",
    role: "",
    escape: "Fobia",
  };

  const [employees, setEmployees] = useState<any[]>([]);
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

  const [checkin, setCheckin] = useState({ employeeId: "", type: "" });
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

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      toast.success(editing ? "Empleado actualizado" : "Empleado creado");
      setForm(emptyForm);
      setEditing(null);
      setOpenModal(false);
      loadEmployees();
    }
  }

  async function loadSchedule() {
    const res = await fetch(`/api/schedule?escape=${escapeFilter}`);
    setSchedule(await res.json());
  }

  /* ───── Fichaje ───── */

  async function registerCheck(type: "in" | "out") {
    if (!checkin.employeeId) {
      toast.error("Selecciona un empleado");
      return;
    }

    const res = await fetch("/api/employees/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId: checkin.employeeId, type }),
    });

    if (res.ok) {
      toast.success(type === "in" ? "✅ Entrada registrada" : "🚪 Salida registrada");
      setCheckin({ employeeId: "", type: "" });
      await loadRecords(); // recarga estado al instante
    } else {
      toast.error("Error al registrar fichaje");
    }
  }

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
    <div className="flex items-center justify-between mb-6">
  <div>
    <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
      Empleados
    </h1>
    <p className="text-sm text-muted-foreground">
      Consulta los datos del personal, sus horarios y el estado de sus fichajes
    </p>
  </div>
</div>

    <div className="p-6 space-y-6">
      <Tabs value={tabValue} onValueChange={setTabValue}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="list">
            <Users className="w-4 h-4 mr-1" /> Empleados
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <CalendarDays className="w-4 h-4 mr-1" /> Calendario
          </TabsTrigger>
          <TabsTrigger value="checkin">
            <Clock3 className="w-4 h-4 mr-1" /> Fichaje
          </TabsTrigger>
          <TabsTrigger value="history">
            <ClipboardList className="w-4 h-4 mr-1" /> Registro
          </TabsTrigger>
        </TabsList>

        {/* ───── LISTA DE EMPLEADOS ───── */}
        <TabsContent value="list">

          <Card>
            <CardHeader>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Users className="w-5 h-5" /> Empleados
                </h2>
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
                <Button
                  onClick={() => {
                    setEditing(null);
                    setForm(emptyForm);
                    setOpenModal(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-1" /> Nuevo empleado
                </Button>
              </DialogTrigger>

              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {editing ? "Editar empleado" : "Añadir empleado"}
                  </DialogTitle>
                </DialogHeader>

                <div className="grid gap-3 py-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Nombre"
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                    />
                    <Input
                      placeholder="Apellidos"
                      value={form.surname}
                      onChange={(e) =>
                        setForm({ ...form, surname: e.target.value })
                      }
                    />
                  </div>
                  <Input
                    placeholder="Email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                  <Input
                    placeholder="Cargo"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                  />

                  <Select
                    value={form.escape}
                    onValueChange={(v) => setForm({ ...form, escape: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Escape asociado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Fobia">🏠 Fobia</SelectItem>
                      <SelectItem value="Action Gates">
                        🚪 Action Gates
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <DialogFooter className="flex justify-end gap-2 mt-3">
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
                    <Button onClick={saveEmployee}>
                      {editing ? (
                        <Save className="w-4 h-4 mr-1" />
                      ) : (
                        <Plus className="w-4 h-4 mr-1" />
                      )}
                      {editing ? "Guardar cambios" : "Crear empleado"}
                    </Button>
                  </DialogFooter>
                </div>
              </DialogContent>
            </Dialog>
              </div>
            </CardHeader>
            <CardContent>

          
          {/* Listado de empleados */}
          <div className="grid md:grid-cols-3 gap-4  ">
            {employees.map((emp) => (
              <Card
                key={emp._id}
                className="hover:shadow-md transition border border-border/60"
              >
                <CardHeader className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={emp.avatar || "/avatar-default.png"} />
                    <AvatarFallback>
                      {emp.name[0]}
                      {emp.surname[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg font-semibold">
                      {emp.name} {emp.surname}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Building2 className="w-3 h-3" /> {emp.escape}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {emp.role} · {emp.email}
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing(emp._id);
                      setForm(emp);
                      setOpenModal(true);
                    }}
                  >
                    <Pencil className="w-4 h-4 mr-1" /> Editar
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          </CardContent>
          </Card>
        </TabsContent>

        {/* ───── CALENDARIO LABORAL ───── */}
        <TabsContent value="calendar">
          <Card>
            <CardHeader className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5" />
                <CardTitle>Calendario Laboral Semanal</CardTitle>
              </div>
              <Select value={escapeFilter} onValueChange={setEscapeFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Selecciona escape" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Fobia">🏠 Fobia</SelectItem>
                  <SelectItem value="Action Gates">🚪 Action Gates</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>

            <CardContent>
              {/* NAV SEMANAL */}
              <div className="flex justify-between items-center mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setSelectedDate(
                      new Date(selectedDate!.setDate(selectedDate!.getDate() - 7))
                    )
                  }
                >
                  ← Semana anterior
                </Button>
                <p className="font-medium">
                  Semana del{" "}
                  {format(selectedDate!, "dd MMM yyyy", { locale: es })} –{" "}
                  {format(
                    new Date(selectedDate!.getTime() + 6 * 86400000),
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
                  Semana siguiente →
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
                                <p className="font-medium">
                                  👤 {emp ? `${emp.name} ${emp.surname}` : "—"}
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
            <DialogContent className="sm:max-w-md">
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
          <div className="space-y-6">
            {/* EMPLEADOS ACTIVOS */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock3 className="w-5 h-5 text-green-600" />
                  Empleados en turno
                </CardTitle>
              </CardHeader>
              <CardContent className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
                {active.length === 0 ? (
                  <p className="text-sm text-muted-foreground col-span-full">
                    Nadie ha fichado aún hoy 😴
                  </p>
                ) : (
                  active.map((r, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 border rounded-md p-3 bg-green-50 dark:bg-green-900/20 shadow-sm"
                    >
                      <div className="relative">
                        <Avatar className="h-12 w-12 border border-green-500">
                          <AvatarImage
                            src={r.employee?.avatar || "/avatar-default.png"}
                          />
                          <AvatarFallback>
                            {r.employee?.name?.[0]}
                            {r.employee?.surname?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full shadow animate-pulse"></span>
                      </div>
                      <div>
                        <p className="font-medium leading-none">
                          {r.employee?.name} {r.employee?.surname}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Fichado a las {format(new Date(r.time), "HH:mm")} h
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* PANEL DE FICHAJE */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <LogIn className="w-5 h-5 text-primary" /> Registrar fichaje
                </CardTitle>
              </CardHeader>

              <CardContent className="flex flex-col md:flex-row gap-6 justify-between">
                {/* Selección */}
                <div className="flex-1 flex flex-col items-center justify-between gap-8 py-8 border rounded-xl bg-muted/10 shadow-sm relative">
  {/* Selector de empleado (arriba del todo) */}
  <div className="absolute -top-7 w-full flex justify-center">
    <div className="w-full max-w-sm">
      <Select
        value={checkin.employeeId}
        onValueChange={(v) => setCheckin({ ...checkin, employeeId: v })}
      >
        <SelectTrigger className="h-12 text-base bg-background border-2 border-primary/20 rounded-lg shadow-md focus:ring-2 focus:ring-primary/40 transition-all">
          <SelectValue placeholder="Selecciona empleado" />
        </SelectTrigger>
        <SelectContent>
          {employees.map((e) => (
            <SelectItem key={e._id} value={e._id}>
              {e.name} {e.surname}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  </div>

  {/* Avatar y datos */}
  <div className="flex flex-col items-center gap-3 pt-10">
    {checkin.employeeId ? (
      <>
        <Avatar className="h-24 w-24 border-4 border-primary/60 shadow-lg">
          <AvatarImage
            src={
              employees.find((e) => e._id === checkin.employeeId)?.avatar ||
              "/avatar-default.png"
            }
          />
          <AvatarFallback className="text-lg">
            {
              employees
                .find((e) => e._id === checkin.employeeId)
                ?.name?.[0]
            }
            {
              employees
                .find((e) => e._id === checkin.employeeId)
                ?.surname?.[0]
            }
          </AvatarFallback>
        </Avatar>
        <h3 className="font-semibold text-lg text-center">
          {
            employees.find((e) => e._id === checkin.employeeId)?.name
          }{" "}
          {
            employees.find((e) => e._id === checkin.employeeId)?.surname
          }
        </h3>
        <p className="text-sm text-muted-foreground">
          {
            employees.find((e) => e._id === checkin.employeeId)?.role ||
            "Empleado"
          }
        </p>
      </>
    ) : (
      <div className="flex flex-col items-center gap-2 text-muted-foreground pt-6">
        <Users className="w-12 h-12 opacity-50" />
        <p className="text-sm">Selecciona un empleado para comenzar</p>
      </div>
    )}
  </div>

  {/* Botones Entrada / Salida */}
  <div className="flex gap-8 justify-center mt-4 pb-2">
    <Button
      size="lg"
      className="relative bg-green-600 hover:bg-green-700 text-white font-semibold w-48 h-14 text-base rounded-xl shadow-lg transition-all hover:scale-[1.03] active:scale-95"
      onClick={() => registerCheck("in")}
      disabled={!checkin.employeeId}
    >
      <LogIn className="w-5 h-5 mr-2" />
      Fichar Entrada
      <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse"></span>
    </Button>

    <Button
      size="lg"
      variant="destructive"
      className="relative w-48 h-14 text-base font-semibold rounded-xl shadow-lg transition-all hover:scale-[1.03] active:scale-95"
      onClick={() => registerCheck("out")}
      disabled={!checkin.employeeId}
    >
      <LogOut className="w-5 h-5 mr-2" />
      Fichar Salida
      <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-400 rounded-full animate-pulse"></span>
    </Button>
  </div>
</div>



                {/* Últimos fichajes */}
                <div className="flex-1 border-l pl-4 max-h-[400px] overflow-y-auto">
                  <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-primary" /> Últimos registros
                  </h3>
                  {records.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin fichajes aún.</p>
                  ) : (
                    <div className="space-y-2">
                      {records.slice(0, 10).map((r, i) => (
                        <div
                          key={i}
                          className={`rounded-md p-2 border flex items-center justify-between ${r.type === "in"
                              ? "border-green-500/50 bg-green-50"
                              : "border-red-500/50 bg-red-50"
                            }`}
                        >
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage
                                src={r.employee?.avatar || "/avatar-default.png"}
                              />
                              <AvatarFallback>
                                {r.employee?.name?.[0]}
                                {r.employee?.surname?.[0]}
                              </AvatarFallback>
                            </Avatar>
                            <p className="text-sm font-medium">
                              {r.employee?.name} {r.employee?.surname}
                            </p>
                          </div>
                          <p
                            className={`text-xs font-semibold ${r.type === "in" ? "text-green-700" : "text-red-600"
                              }`}
                          >
                            {r.type === "in" ? "🟢 Entrada" : "🔴 Salida"} —{" "}
                            {format(new Date(r.time), "HH:mm")}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
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
                  <SelectTrigger className="w-[200px]">
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
                        className="flex justify-between items-center px-4 py-2 text-sm hover:bg-muted/20 transition"
                      >
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <span>
                            {r.employee?.name} {r.employee?.surname}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
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
