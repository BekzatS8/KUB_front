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
import { connectWazzupInstagram, type WazzupInstagramConnect } from "@/src/api/integrations_wazzup.api"

// Подключение Instagram к VISARIO. Встроенная форма Wazzup Instagram не
// поддерживает: CRM создаёт канал через API, а Wazzup отдаёт ссылку входа
// через Facebook. Страница Facebook не открывается внутри CRM — только во
// вкладке.
export function InstagramConnectDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<WazzupInstagramConnect | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    if (open) {
      setResult(null)
      setError("")
    }
  }, [open])

  const create = async () => {
    setLoading(true)
    setError("")
    try {
      setResult(await connectWazzupInstagram())
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Не удалось создать канал Instagram")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !loading && onClose()}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Instagram className="h-5 w-5 text-pink-600" />
            Подключить Instagram к VISARIO
          </DialogTitle>
          <DialogDescription>
            CRM создаст канал Instagram в Wazzup и даст ссылку для входа через Facebook.
          </DialogDescription>
        </DialogHeader>

        {!result && (
          <div className="space-y-3 text-sm text-slate-700">
            <p className="font-medium">Перед подключением проверьте:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Аккаунт Instagram — профессиональный, тип <b>«Бизнес»</b> (с типом «Автор» не
                подключится).
              </li>
              <li>Аккаунт привязан к бизнес-странице Facebook.</li>
              <li>
                В приложении Instagram: «Настройки и конфиденциальность → Сообщения и ответы на
                истории → Управление сообщениями → <b>Разрешить доступ к сообщениям</b>».
              </li>
              <li>Входить через Facebook будет человек с правами на эту страницу.</li>
              <li>Этот Instagram не подключён к другому аккаунту Wazzup (например, к КУБ).</li>
            </ul>
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</div>
            )}
          </div>
        )}

        {result?.auth_url && (
          <div className="space-y-3 text-sm text-slate-700">
            <p>Канал создан. Откройте ссылку, войдите в Facebook и выберите страницу и аккаунт Instagram.</p>
            <Button asChild className="w-full">
              <a href={result.auth_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Войти через Facebook
              </a>
            </Button>
            <p className="text-xs text-slate-500">
              После входа вернитесь сюда, закройте окно и нажмите «Обновить» — Instagram появится в
              группе VISARIO. Если вкладку закрыли раньше времени, у канала в списке будет кнопка
              «Авторизовать».
            </p>
          </div>
        )}

        {result && !result.auth_url && (
          <div className="space-y-3 text-sm text-slate-700">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
              Wazzup создал канал{result.channel_id ? ` (${result.channel_id})` : ""}
              {result.state ? `, состояние «${result.state}»` : ""}, но не вернул ссылку для входа
              через Facebook. Пришлите разработчику ответ Wazzup ниже.
            </div>
            {result.provider_response && (
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-slate-100 p-2 text-xs">
                {result.provider_response}
              </pre>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {result ? "Закрыть" : "Отмена"}
          </Button>
          {!result && (
            <Button onClick={create} disabled={loading}>
              {loading && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              Создать канал и получить ссылку
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
