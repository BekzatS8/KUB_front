"use client"

import { useEffect, useState } from "react"
import { ExternalLink, Instagram, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getWazzupInstagramLink } from "@/src/api/integrations_wazzup.api"

function errorText(err: any, fallback: string) {
  return err?.response?.data?.message || err?.message || fallback
}

// Подключение Instagram к VISARIO — окно самого Wazzup: вход в Facebook через
// их приложение и выбор аккаунта, как в кабинете Wazzup. Через API v2
// Instagram не подключается (ответ поддержки Wazzup), поэтому своё приложение
// Meta больше не нужно. reauthChannelId — переавторизовать уже созданный, но
// неработающий канал вместо создания нового.
export function InstagramConnectDialog({
  open,
  onClose,
  reauthChannelId,
}: {
  open: boolean
  onClose: () => void
  reauthChannelId?: string
}) {
  const [link, setLink] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const loadLink = async () => {
    setLoading(true)
    setError("")
    setLink("")
    try {
      const res = await getWazzupInstagramLink(reauthChannelId)
      setLink(res.link)
    } catch (err: any) {
      setError(errorText(err, "Не удалось открыть окно подключения Wazzup"))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) loadLink()
    else {
      setLink("")
      setError("")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reauthChannelId])

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex h-[90vh] w-[calc(100vw-1rem)] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Instagram className="h-5 w-5 text-pink-600" />
            {reauthChannelId ? "Переподключить Instagram к VISARIO" : "Подключить Instagram к VISARIO"}
          </DialogTitle>
          <DialogDescription>
            Нажмите «Войти через Facebook», войдите аккаунтом с доступом к странице VISARIO и выберите
            Instagram. Аккаунт Instagram должен быть типа «Бизнес» и привязан к странице.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border bg-slate-50">
          {loading && (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-500">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Открываем окно Wazzup…
            </div>
          )}
          {!loading && error && (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm">
              <p className="text-red-700">{error}</p>
              <Button variant="outline" size="sm" onClick={loadLink}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Повторить
              </Button>
            </div>
          )}
          {!loading && link && (
            <iframe
              src={link}
              title="Подключение Instagram в Wazzup"
              className="h-full w-full"
              allow="microphone *; clipboard-write *"
            />
          )}
        </div>

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <p className="text-xs text-slate-500">
            Окно Facebook не открылось? Откройте подключение в отдельной вкладке.
          </p>
          <div className="flex gap-2">
            {link && (
              <Button asChild variant="outline">
                <a href={link} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  В новой вкладке
                </a>
              </Button>
            )}
            <Button onClick={onClose}>Готово</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
