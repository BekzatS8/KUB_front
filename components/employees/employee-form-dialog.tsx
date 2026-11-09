"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomSelect } from "@/components/ui/custom-select";
import { useToast } from "@/components/ui/use-toast";
import {
  type Employee, type EmployeeInput, type EmployeeType, EMPLOYEE_TYPE_LABELS,
  create_employee, update_employee, upload_employee_photo,
} from "@/src/api/employees.api";

// Карточка сотрудника: создание и редактирование (ТЗ «доработки CRM КУБ», п.1).
// Все поля обязательны, кроме фото, email и даты увольнения. Дата увольнения
// автоматически делает тип «Уволенный».

const empty: EmployeeInput = {
  full_name: "", birth_date: "", iin: "", address: "", phone: "", email: "",
  emergency_name: "", emergency_relation: "", emergency_phone: "",
  position: "", salary: 0, hired_at: "", fired_at: "", employee_type: "permanent",
};

function toInput(e?: Employee | null): EmployeeInput {
  if (!e) return { ...empty };
  const { id, has_photo, created_at, updated_at, branch_name, ...rest } = e as any;
  return { ...empty, ...rest, email: e.email || "", fired_at: e.fired_at || "" };
}

export function EmployeeFormDialog({
  open,
  employee,
  positions,
  onClose,
  onSaved,
}: {
  open: boolean;
  employee?: Employee | null;
  positions: string[];
  onClose: () => void;
  onSaved: (e: Employee) => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<EmployeeInput>(toInput(employee));
  const [salaryText, setSalaryText] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const f = toInput(employee);
    setForm(f);
    setSalaryText(f.salary ? String(f.salary) : "");
    setPhoto(null);
  }, [open, employee]);

  const set = (patch: Partial<EmployeeInput>) => setForm((f) => ({ ...f, ...patch }));

  const pickPhoto = (file?: File | null) => {
    if (!file) return setPhoto(null);
    if (!/^image\/(jpeg|png)$/.test(file.type)) {
      toast({ title: "Фото — JPG или PNG", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Фото — не больше 5 МБ", variant: "destructive" });
      return;
    }
    setPhoto(file);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload: EmployeeInput = {
        ...form,
        salary: Number(String(salaryText).replace(/\s/g, "").replace(",", ".")) || 0,
        iin: form.iin.replace(/\D/g, ""),
      };
      let saved = employee ? await update_employee(employee.id, payload) : await create_employee(payload);
      if (photo) saved = await upload_employee_photo(saved.id, photo);
      toast({ title: employee ? "Сотрудник обновлён" : "Сотрудник добавлен" });
      onSaved(saved);
      onClose();
    } catch (err: any) {
      toast({
        title: "Не удалось сохранить",
        description: err?.response?.data?.message ?? err?.message ?? "Ошибка",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const req = <span className="text-red-500"> *</span>;
  const field = (label: string, key: keyof EmployeeInput, opts: { type?: string; placeholder?: string; required?: boolean } = {}) => (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}{opts.required !== false && req}</Label>
      <Input
        type={opts.type || "text"}
        placeholder={opts.placeholder}
        value={(form[key] as any) ?? ""}
        onChange={(e) => set({ [key]: e.target.value } as any)}
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{employee ? "Редактировать сотрудника" : "Новый сотрудник"}</DialogTitle>
          <DialogDescription>Поля со звёздочкой обязательны</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">{field("ФИО", "full_name")}</div>
          {field("Дата рождения", "birth_date", { type: "date" })}
          {field("ИИН", "iin", { placeholder: "12 цифр" })}
          <div className="sm:col-span-2">{field("Адрес проживания", "address")}</div>
          {field("Телефон", "phone", { placeholder: "+7 700 000 00 00" })}
          {field("Email (для подписания)", "email", { type: "email", required: false })}
          <div className="sm:col-span-2 mt-1 text-sm font-medium">Экстренный контакт</div>
          {field("ФИО", "emergency_name")}
          {field("Кем приходится", "emergency_relation", { placeholder: "муж, мама, брат…" })}
          {field("Телефон", "emergency_phone", { placeholder: "+7 700 000 00 00" })}
          <div />
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Должность{req}</Label>
            <Input list="employee-positions" value={form.position} onChange={(e) => set({ position: e.target.value })} />
            <datalist id="employee-positions">
              {positions.map((p) => <option key={p} value={p} />)}
            </datalist>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Заработная плата, ₸ в месяц{req}</Label>
            <Input inputMode="decimal" value={salaryText} onChange={(e) => setSalaryText(e.target.value)} placeholder="350000" />
          </div>
          {field("Дата начала работы", "hired_at", { type: "date" })}
          {field("Дата увольнения", "fired_at", { type: "date", required: false })}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Тип{req}</Label>
            <CustomSelect
              value={form.fired_at ? "fired" : form.employee_type}
              onChange={(v) => set({ employee_type: v as EmployeeType })}
              disabled={!!form.fired_at}
              options={(Object.keys(EMPLOYEE_TYPE_LABELS) as EmployeeType[]).map((k) => ({ value: k, label: EMPLOYEE_TYPE_LABELS[k] }))}
            />
            {form.fired_at && <p className="text-xs text-muted-foreground">Указана дата увольнения — тип «Уволенный»</p>}
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Фото (JPG/PNG, до 5 МБ)</Label>
            <Input type="file" accept="image/jpeg,image/png" onChange={(e) => pickPhoto(e.target.files?.[0])} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Отмена</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Сохранение…" : "Сохранить"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
