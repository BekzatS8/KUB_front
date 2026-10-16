"use client"

import { useEffect, useState } from "react"
import { Instagram, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { startWazzupInstagramLogin } from "@/src/api/integrations_wazzup.api"

// Подключение Instagram к VISARIO. Wazzup создаёт канал Instagram только с
// данными из Facebook, поэтому CRM сама проводит вход: уводит на Facebook,
// а после входа страница instagram-callback предлагает выбрать аккаунт.
export function InstagramConnectDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (open) setError("")
  }, [open])

  const login = async () => {
    setLoading(true)
    setError("")
    try {
      const { auth_url } = await startWazzupInstagramLogin()
      // Facebook не открывается внутри CRM — уходим на него в этой вкладке и
      // возвращаемся на страницу выбора аккаунта.
      window.location.href = auth_url
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Не удалось начать вход через Facebook")
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
            Войдите через Facebook и выберите аккаунт Instagram — CRM подключит его в Wazzup.
          </DialogDescription>
        </DialogHeader>

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
            <li>
              Входит человек с правами на эту страницу. В окне Facebook нажмите «Изменить
              настройки» и дайте доступ ко всем страницам, компаниям и аккаунтам Instagram.
            </li>
            <li>Этот Instagram не подключён к другому аккаунту Wazzup (например, к КУБ).</li>
          </ul>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Отмена
          </Button>
          <Button onClick={login} disabled={loading}>
            {loading && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
            Войти через Facebook
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
