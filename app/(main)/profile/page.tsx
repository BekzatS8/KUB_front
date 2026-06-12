"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Save, RotateCcw, Upload, Trash2, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/use-toast";
import { AuthenticatedAvatarImage } from "@/components/authenticated-avatar-image";
import * as ProfileAPI from "@/src/api/profile.api";
import type { User } from "@/src/models/users.model";
import { getRoleName } from "@/src/models/roles.enum";

type ProfileForm = {
  first_name: string;
  last_name: string;
  middle_name: string;
  iin: string;
  phone: string;
  address: string;
  extra_info: string;
};

const formFromUser = (user: User): ProfileForm => ({
  first_name: user.first_name || "",
  last_name: user.last_name || "",
  middle_name: user.middle_name || "",
  iin: user.iin || user.bin_iin || "",
  phone: user.phone || "",
  address: user.address || "",
  extra_info: user.extra_info || "",
});

const fullName = (user?: Partial<User> | null) =>
  [user?.last_name, user?.first_name, user?.middle_name].filter(Boolean).join(" ").trim() ||
  user?.full_name ||
  user?.email ||
  "Пользователь";

const initials = (user?: Partial<User> | null) => {
  const name = fullName(user);
  const parts = name.split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || "U") + (parts[1]?.[0] || "");
};

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0, scale: 1, size: 192 });
  const [dragging, setDragging] = useState(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();

  const roleName = useMemo(() => {
    const id = user?.role?.id || 0;
    return getRoleName(id) || "Пользователь";
  }, [user]);

  useEffect(() => {
    ProfileAPI.getProfile()
      .then((profile) => {
        setUser(profile);
        setForm(formFromUser(profile));
        setCrop({
          x: Number(profile.avatar?.crop_x || 0),
          y: Number(profile.avatar?.crop_y || 0),
          scale: Number(profile.avatar?.crop_scale || 1),
          size: Number(profile.avatar?.crop_size || 192),
        });
      })
      .catch(() => {
        toast({ variant: "destructive", title: "Ошибка", description: "Не удалось загрузить профиль" });
      })
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  const updateField = (field: keyof ProfileForm, value: string) => {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const saveProfile = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const updated = await ProfileAPI.updateProfile(form);
      setUser(updated);
      setForm(formFromUser(updated));
      toast({ title: "Профиль сохранён" });
    } catch {
      toast({ variant: "destructive", title: "Ошибка", description: "Не удалось сохранить профиль" });
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    if (user) setForm(formFromUser(user));
  };

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast({ variant: "destructive", title: "Ошибка", description: "Неверный формат файла" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ variant: "destructive", title: "Ошибка", description: "Файл слишком большой" });
      return;
    }
    setSelectedFile(file);
    setCrop({ x: 0, y: 0, scale: 1, size: 192 });
  };

  const saveAvatar = async () => {
    if (!selectedFile) return;
    setAvatarSaving(true);
    try {
      await ProfileAPI.uploadAvatar(selectedFile);
      const updated = await ProfileAPI.updateAvatarCrop({
        crop_x: crop.x,
        crop_y: crop.y,
        crop_scale: crop.scale,
        crop_size: crop.size,
      });
      setUser(updated);
      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = "";
      toast({ title: "Фото загружено" });
    } catch {
      toast({ variant: "destructive", title: "Ошибка", description: "Не удалось сохранить аватар" });
    } finally {
      setAvatarSaving(false);
    }
  };

  const deleteAvatar = async () => {
    setAvatarSaving(true);
    try {
      const updated = await ProfileAPI.deleteAvatar();
      setUser(updated);
      setSelectedFile(null);
      toast({ title: "Аватар удалён" });
    } catch {
      toast({ variant: "destructive", title: "Ошибка", description: "Не удалось удалить аватар" });
    } finally {
      setAvatarSaving(false);
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || !lastPoint.current) return;
    const dx = event.clientX - lastPoint.current.x;
    const dy = event.clientY - lastPoint.current.y;
    lastPoint.current = { x: event.clientX, y: event.clientY };
    setCrop((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
  };

  if (loading || !form) {
    return <div className="p-8 text-slate-600">Загрузка профиля...</div>;
  }

  if (!user) {
    return <div className="p-8 text-slate-600">Не удалось загрузить данные профиля</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Профиль</h1>
        <p className="text-slate-600">{user.email}</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Основная информация</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AuthenticatedAvatarImage src={user.avatar_url || user.avatar?.url} alt={fullName(user)} className="h-full w-full object-cover" />
                <AvatarFallback className="text-xl">{initials(user)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 truncate">{fullName(user)}</p>
                <p className="text-sm text-slate-500 truncate">{user.email}</p>
              </div>
            </div>
            <Readonly label="Роль" value={roleName} />
            <Readonly label="Филиал" value={user.branch?.name || "-"} />
            <Readonly label="Должность" value={user.position || "-"} />
            <Readonly label="Статус" value={user.is_active ? "Активен" : "Неактивен"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Личные данные</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Фамилия" value={form.last_name} onChange={(v) => updateField("last_name", v)} />
              <Field label="Имя" value={form.first_name} onChange={(v) => updateField("first_name", v)} />
              <Field label="Отчество" value={form.middle_name} onChange={(v) => updateField("middle_name", v)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="ИИН" value={form.iin} onChange={(v) => updateField("iin", v)} />
              <Field label="Телефон" value={form.phone} onChange={(v) => updateField("phone", v)} />
            </div>
            <Field label="Адрес" value={form.address} onChange={(v) => updateField("address", v)} />
            <div className="space-y-2">
              <Label htmlFor="extra_info">Дополнительная информация</Label>
              <Textarea id="extra_info" value={form.extra_info} onChange={(e) => updateField("extra_info", e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={resetForm} disabled={saving}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Отменить
              </Button>
              <Button onClick={saveProfile} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                Сохранить
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Фото профиля</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
          <div className="space-y-3">
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFileChange} />
            <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
              <ImagePlus className="h-4 w-4 mr-2" />
              Загрузить фото
            </Button>
            <Button type="button" variant="outline" onClick={deleteAvatar} disabled={avatarSaving || !(user.avatar_url || user.avatar?.url)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Удалить аватар
            </Button>
          </div>

          <div className="space-y-4">
            <div
              className="relative h-52 w-52 overflow-hidden rounded-full border bg-slate-100"
              onPointerDown={(event) => {
                setDragging(true);
                lastPoint.current = { x: event.clientX, y: event.clientY };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={onPointerMove}
              onPointerUp={() => {
                setDragging(false);
                lastPoint.current = null;
              }}
            >
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Так будет выглядеть ваша аватарка"
                  className="absolute left-1/2 top-1/2 max-w-none select-none"
                  draggable={false}
                  style={{
                    width: `${crop.size}px`,
                    transform: `translate(calc(-50% + ${crop.x}px), calc(-50% + ${crop.y}px)) scale(${crop.scale})`,
                  }}
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-3xl font-semibold text-slate-500">
                  {initials(user)}
                </div>
              )}
            </div>
            <p className="text-sm text-slate-600">Так будет выглядеть ваша аватарка</p>
            <div className="max-w-sm space-y-2">
              <Label htmlFor="zoom">Масштаб</Label>
              <Input
                id="zoom"
                type="range"
                min="0.5"
                max="3"
                step="0.05"
                value={crop.scale}
                onChange={(e) => setCrop((prev) => ({ ...prev, scale: Number(e.target.value) }))}
                disabled={!previewUrl}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={saveAvatar} disabled={!selectedFile || avatarSaving}>
                <Upload className="h-4 w-4 mr-2" />
                Сохранить аватар
              </Button>
              <Button variant="outline" onClick={() => inputRef.current?.click()}>
                Выбрать другое фото
              </Button>
              <Button variant="outline" onClick={() => setSelectedFile(null)} disabled={!selectedFile}>
                Отмена
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = label.toLowerCase().replace(/\s+/g, "_");
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Readonly({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-medium text-slate-900">{value}</p>
    </div>
  );
}
