"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Building2 } from "lucide-react"
import * as OrgAPI from "@/src/api/organization.api"
import type { Organization, UpdateOrganizationRequest } from "@/src/models/organization.model"
import { getMe } from "@/src/api/auth.api"

export default function OrganizationSettingsPage() {
  const [org, setOrg] = useState<Organization | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const [form, setForm] = useState<UpdateOrganizationRequest>({
    name: "",
    legal_name: "",
    bin: "",
    phone: "",
    email: "",
    address: "",
    website: "",
    whatsapp: "",
    telegram: "",
    instagram: "",
    tiktok: "",
    logo_url: "",
  })

  useEffect(() => {
    async function load() {
      setIsLoading(true)
      try {
        const [data, me] = await Promise.all([
          OrgAPI.getOrganization(),
          getMe(),
        ])
        setOrg(data)
        setForm({
          name: data.name ?? "",
          legal_name: data.legal_name ?? "",
          bin: data.bin ?? "",
          phone: data.phone ?? "",
          email: data.email ?? "",
          address: data.address ?? "",
          website: data.website ?? "",
          whatsapp: data.whatsapp ?? "",
          telegram: data.telegram ?? "",
          instagram: data.instagram ?? "",
          tiktok: data.tiktok ?? "",
          logo_url: data.logo_url ?? "",
        })
        const roleId = (me as any)?.role?.id
        setIsAdmin(roleId === 50)
      } catch (err) {
        console.error("Failed to load organization:", err)
        toast.error("Ошибка при загрузке данных организации")
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const handleSave = async () => {
    if (!isAdmin) return
    setIsSaving(true)
    try {
      const updated = await OrgAPI.updateOrganization(form)
      setOrg(updated)
      toast.success("Данные организации сохранены")
    } catch (err) {
      console.error("Failed to update organization:", err)
      toast.error("Ошибка при сохранении")
    } finally {
      setIsSaving(false)
    }
  }

  const field = (
    id: keyof UpdateOrganizationRequest,
    label: string,
    placeholder?: string
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        placeholder={placeholder ?? ""}
        value={(form[id] as string) ?? ""}
        onChange={(e) => setForm({ ...form, [id]: e.target.value })}
        disabled={!isAdmin}
      />
    </div>
  )

  if (isLoading) {
    return (
      <div className="m-6 space-y-4 animate-pulse">
        <div className="h-8 w-64 bg-gray-200 rounded" />
        <div className="h-96 bg-gray-200 rounded" />
      </div>
    )
  }

  return (
    <div className="m-6 max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600">
          <Building2 className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Организация</h1>
          <p className="text-sm text-gray-500">
            Реквизиты и контакты вашей компании
          </p>
        </div>
      </div>

      {!isAdmin && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
          Редактирование доступно только администратору.
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Основная информация</CardTitle>
              <CardDescription>Название и юридические реквизиты</CardDescription>
            </div>
            <img
              src="/ziperion-logo.png"
              alt="Ziperion logo"
              className="h-12 w-auto shrink-0 object-contain"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {field("name", "Название (отображаемое)", "KUB Travel")}
          {field("legal_name", "Юридическое название", "ТОО «...»")}
          {field("bin", "БИН", "123456789012")}
          {field("address", "Адрес", "г. Алматы, ул. ...")}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Контакты</CardTitle>
          <CardDescription>Телефон, email и сайт</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {field("phone", "Телефон", "+7 (700) 000-00-00")}
          {field("email", "Email", "info@company.kz")}
          {field("website", "Сайт", "https://company.kz")}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Социальные сети</CardTitle>
          <CardDescription>WhatsApp, Telegram, Instagram, TikTok</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {field("whatsapp", "WhatsApp", "77001234567")}
          {field("telegram", "Telegram", "@company или ссылка")}
          {field("instagram", "Instagram", "@company")}
          {field("tiktok", "TikTok", "@company")}
        </CardContent>
      </Card>

      {isAdmin && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Сохранение..." : "Сохранить изменения"}
          </Button>
        </div>
      )}
    </div>
  )
}
