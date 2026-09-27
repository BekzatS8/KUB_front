"use client"

import { useEffect, useMemo, useState } from "react"
import { Instagram, LoaderCircle, Mail, MessageCircle, Send } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { driveErrorMessage, sendDriveFiles, type DriveNode, type DriveSendChannel } from "@/src/api/drive.api"
import { getWazzupChannels, type WazzupChannel } from "@/src/api/integrations_wazzup.api"
import { DriveNodeIcon, formatBytes } from "./drive-utils"

const CHANNELS: { value: DriveSendChannel; label: string; icon: typeof Mail; to: string; placeholder: string }[] = [
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle, to: "Номер телефона", placeholder: "77001234567" },
  { value: "telegram", label: "Telegram", icon: Send, to: "Username или телефон", placeholder: "username" },
  { value: "instagram", label: "Instagram", icon: Instagram, to: "Username", placeholder: "username" },
  { value: "email", label: "Почта", icon: Mail, to: "Адрес почты", placeholder: "client@mail.kz" },
]

// Транспорт номера Wazzup → куда им можно писать.
const TRANSPORT_OF: Record<string, DriveSendChannel> = {
  whatsapp: "whatsapp",
  wapi: "whatsapp",
  telegram: "telegram",
  tgapi: "telegram",
  instagram: "instagram",
  instapi: "instagram",
}

const MAIL_LIMIT = 20 * 1024 * 1024

// «Отправить»: файлы клиенту через мессенджер CRM (WhatsApp, Telegram,
// Instagram) или на почту вложениями.
export function DriveSendDialog({ nodes, onClose }: { nodes: DriveNode[] | null; onClose: () => void }) {
  const [channel, setChannel] = useState<DriveSendChannel>("whatsapp")
  const [to, setTo] = useState("")
  const [text, setText] = useState("")
  const [subject, setSubject] = useState("")
  const [numbers, setNumbers] = useState<WazzupChannel[]>([])
  const [numberId, setNumberId] = useState("")
  const [sending, setSending] = useState(false)

  const files = useMemo(() => (nodes ?? []).filter((n) => n.kind === "file"), [nodes])
  const skipped = (nodes?.length ?? 0) - files.length
  const total = files.reduce((sum, f) => sum + (f.size_bytes || 0), 0)

  useEffect(() => {
    if (!nodes) return
    setTo("")
    setText("")
    setSubject("")
    setNumberId("")
    // Без доступа к мессенджеру список номеров не загрузится — останется почта.
    getWazzupChannels()
      .then((res) => setNumbers(res?.value || []))
      .catch(() => setNumbers([]))
  }, [nodes])

  const numbersForChannel = numbers.filter((n) => TRANSPORT_OF[(n.transport || "").toLowerCase()] === channel)
  const current = CHANNELS.find((c) => c.value === channel)!
  const isMail = channel === "email"
  const tooBigForMail = isMail && total > MAIL_LIMIT

  const submit = async () => {
    if (files.length === 0 || !to.trim()) return
    setSending(true)
    try {
      const res = await sendDriveFiles({
        ids: files.map((f) => f.id),
        channel,
        to: to.trim(),
        channel_id: isMail ? undefined : numberId || undefined,
        text: text.trim() || undefined,
        subject: isMail ? subject.trim() || undefined : undefined,
      })
      toast.success(`Отправлено файлов: ${res.sent}`)
      onClose()
    } catch (err) {
      toast.error(driveErrorMessage(err, "Не удалось отправить"))
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={nodes !== null} onOpenChange={(open) => !open && !sending && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle>Отправить {files.length === 1 ? "файл" : `файлы (${files.length})`}</DialogTitle>
          <DialogDescription>Клиенту в мессенджер CRM или на почту.</DialogDescription>
        </DialogHeader>

        <ul className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2 text-sm">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-2">
              <DriveNodeIcon node={f} className="h-4 w-4" />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="shrink-0 text-xs text-slate-500">{formatBytes(f.size_bytes)}</span>
            </li>
          ))}
        </ul>
        {skipped > 0 && (
          <p className="text-xs text-amber-700">Папки отправить нельзя — пропущено: {skipped}. Откройте папку и выберите файлы в ней.</p>
        )}

        <div className="grid grid-cols-4 gap-1 rounded-lg bg-slate-100 p-1">
          {CHANNELS.map((c) => {
            const Icon = c.icon
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => {
                  setChannel(c.value)
                  setNumberId("")
                }}
                className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition ${
                  channel === c.value ? "bg-white font-medium text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{c.label}</span>
              </button>
            )
          })}
        </div>

        <div className="space-y-3">
          {!isMail && (
            <div className="space-y-1.5">
              <Label>С какого номера</Label>
              <select
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
                value={numberId}
                onChange={(e) => setNumberId(e.target.value)}
              >
                <option value="">Автоматически</option>
                {numbersForChannel.map((n) => (
                  <option key={n.id} value={n.channel_id}>
                    {n.name || n.phone || n.channel_id}
                    {n.branch_name ? ` · ${n.branch_name}` : ""}
                  </option>
                ))}
              </select>
              {numbersForChannel.length === 0 && (
                <p className="text-xs text-amber-700">Нет подключённых номеров {current.label} — отправка может не пройти.</p>
              )}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="drive-send-to">{current.to}</Label>
            <Input
              id="drive-send-to"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder={current.placeholder}
              type={isMail ? "email" : "text"}
            />
          </div>
          {isMail && (
            <div className="space-y-1.5">
              <Label htmlFor="drive-send-subject">Тема</Label>
              <Input
                id="drive-send-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={files.length === 1 ? files[0].name : "Файлы"}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="drive-send-text">{isMail ? "Текст письма" : "Сообщение перед файлами"}</Label>
            <Textarea
              id="drive-send-text"
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Необязательно"
            />
          </div>
          {tooBigForMail && (
            <p className="text-sm text-red-600">
              Вместе файлы весят {formatBytes(total)} — почта принимает до 20 МБ. Отправьте через мессенджер.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Отмена
          </Button>
          <Button onClick={submit} disabled={sending || files.length === 0 || !to.trim() || tooBigForMail}>
            {sending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Отправить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
