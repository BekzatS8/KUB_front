"use client"

import { useEffect, useState } from "react"
import { Check, Copy, ExternalLink, Instagram, RefreshCw, Settings } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  getMetaAppSettings,
  saveMetaAppSettings,
  startWazzupInstagramLogin,
  type MetaAppSettings,
} from "@/src/api/integrations_wazzup.api"

function errorText(err: any, fallback: string) {
  return err?.response?.data?.message || err?.message || fallback
}

// Подключение Instagram к VISARIO. Wazzup создаёт канал Instagram только с
// данными из Facebook, поэтому CRM сама проводит вход через приложение Meta
// компании. Ключи приложения вводятся здесь же, один раз на всю CRM; дальше
// любой администратор подключает Instagram сам: вход через Facebook → выбор
// аккаунта на странице instagram-callback.
export function InstagramConnectDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [settings, setSettings] = useState<MetaAppSettings | null>(null)
  const [loadingSettings, setLoadingSettings] = useState(false)
  const [editing, setEditing] = useState(false)
  const [appId, setAppId] = useState("")
  const [appSecret, setAppSecret] = useState("")
  const [saving, setSaving] = useState(false)
  const [loggingIn, setLoggingIn] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setError("")
    setEditing(false)
    setAppSecret("")
    setLoadingSettings(true)
    getMetaAppSettings()
      .then((s) => {
        setSettings(s)
        setAppId(s.app_id || "")
      })
      .catch((err) => setError(errorText(err, "Не удалось загрузить настройки приложения Meta")))
      .finally(() => setLoadingSettings(false))
  }, [open])

  const showSetup = !!settings && (!settings.configured || editing)
  const busy = saving || loggingIn

  const copyRedirect = async () => {
    if (!settings?.redirect_url) return
    try {
      await navigator.clipboard.writeText(settings.redirect_url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* буфер недоступен — адрес виден в поле */
    }
  }

  const save = async () => {
    setSaving(true)
    setError("")
    try {
      const s = await saveMetaAppSettings(appId.trim(), appSecret.trim())
      setSettings(s)
      setAppSecret("")
      setEditing(false)
    } catch (err: any) {
      setError(errorText(err, "Не удалось сохранить ключи"))
    } finally {
      setSaving(false)
    }
  }

  const login = async () => {
    setLoggingIn(true)
    setError("")
    try {
      const { auth_url } = await startWazzupInstagramLogin()
      // Facebook не открывается внутри CRM — уходим на него в этой вкладке и
      // возвращаемся на страницу выбора аккаунта.
      window.location.href = auth_url
    } catch (err: any) {
      setError(errorText(err, "Не удалось начать вход через Facebook"))
      setLoggingIn(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Instagram className="h-5 w-5 text-pink-600" />
            Подключить Instagram к VISARIO
          </DialogTitle>
          <DialogDescription>
            {showSetup
              ? "Один раз на всю CRM: подключите приложение Meta, через которое сотрудники будут входить в Facebook."
              : "Войдите через Facebook и выберите аккаунт Instagram — CRM подключит его в Wazzup."}
          </DialogDescription>
        </DialogHeader>

        {loadingSettings && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Загрузка…
          </div>
        )}

        {showSetup && settings && (
          <div className="space-y-4 text-sm text-slate-700">
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>
                Откройте{" "}
                <a
                  href="https://developers.facebook.com/apps"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                >
                  developers.facebook.com/apps
                  <ExternalLink className="h-3 w-3" />
                </a>{" "}
                → «Создать приложение», тип <b>«Компания»</b> (Business).
              </li>
              <li>
                Добавьте продукт <b>«Вход через Facebook для бизнеса»</b> (Facebook Login for Business).
              </li>
              <li>
                В его настройках, в поле <b>«Действительные URI перенаправления для OAuth»</b>, укажите:
                <div className="mt-1.5 flex gap-2">
                  <Input readOnly value={settings.redirect_url} className="font-mono text-xs" />
                  <Button type="button" variant="outline" size="icon" onClick={copyRedirect} title="Скопировать">
                    {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </li>
              <li>
                В «Настройки приложения → Основное» скопируйте <b>ID приложения</b> и{" "}
                <b>Секрет приложения</b> сюда:
              </li>
            </ol>

            <div className="grid gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="meta-app-id">ID приложения (App ID)</Label>
                <Input
                  id="meta-app-id"
                  inputMode="numeric"
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  placeholder="1234567890123456"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="meta-app-secret">Секрет приложения (App Secret)</Label>
                <Input
                  id="meta-app-secret"
                  type="password"
                  autoComplete="off"
                  value={appSecret}
                  onChange={(e) => setAppSecret(e.target.value)}
                  placeholder={settings.has_secret ? "Сохранён — оставьте пустым, чтобы не менять" : ""}
                />
              </div>
            </div>

            <p className="text-xs text-slate-500">
              CRM проверит ключи в Facebook перед сохранением. Пока приложение в режиме разработки,
              войти смогут только люди, добавленные в его «Роли». Чтобы входили все компании —
              переведите приложение в рабочий режим и пройдите проверку Meta.
            </p>
          </div>
        )}

        {!showSetup && settings?.configured && (
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
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
            >
              <Settings className="h-3 w-3" />
              Приложение Meta: {settings.app_id}
              {settings.source === "server" ? " (из настроек сервера)" : ""} — изменить
            </button>
          </div>
        )}

        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <DialogFooter>
          {showSetup && settings?.configured ? (
            <Button variant="outline" onClick={() => setEditing(false)} disabled={busy}>
              Назад
            </Button>
          ) : (
            <Button variant="outline" onClick={onClose} disabled={busy}>
              Отмена
            </Button>
          )}
          {showSetup ? (
            <Button
              onClick={save}
              disabled={busy || !appId.trim() || (!appSecret.trim() && !settings?.has_secret)}
            >
              {saving && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              Сохранить и проверить
            </Button>
          ) : (
            settings?.configured && (
              <Button onClick={login} disabled={busy}>
                {loggingIn && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                Войти через Facebook
              </Button>
            )
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
