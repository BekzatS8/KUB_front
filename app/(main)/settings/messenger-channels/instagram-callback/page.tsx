"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { CheckCircle2, ExternalLink, Instagram, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  connectWazzupInstagram,
  getWazzupInstagramAccounts,
  type WazzupInstagramAccount,
  type WazzupInstagramConnect,
} from "@/src/api/integrations_wazzup.api"

const BACK_HREF = "/settings/messenger-channels"

function errorText(err: any, fallback: string) {
  return err?.response?.data?.message || err?.message || fallback
}

// Сюда Facebook возвращает администратора после входа (META_REDIRECT_URL).
// CRM меняет code на список аккаунтов Instagram; выбранный подключается в
// дочерний аккаунт Wazzup (VISARIO).
function InstagramCallback() {
  const params = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [session, setSession] = useState("")
  const [accounts, setAccounts] = useState<WazzupInstagramAccount[]>([])
  const [connectingId, setConnectingId] = useState("")
  const [result, setResult] = useState<WazzupInstagramConnect | null>(null)
  // code одноразовый: в dev React вызывает эффект дважды.
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const fbError = params.get("error_description") || params.get("error")
    const code = params.get("code") || ""
    const state = params.get("state") || ""
    if (fbError || !code) {
      setError(fbError ? `Facebook: ${fbError}` : "Facebook не вернул код входа — начните подключение заново")
      setLoading(false)
      return
    }
    getWazzupInstagramAccounts(code, state)
      .then((res) => {
        setSession(res.session)
        setAccounts(res.accounts || [])
      })
      .catch((err) => setError(errorText(err, "Не удалось получить аккаунты Instagram")))
      .finally(() => setLoading(false))
  }, [params])

  const connect = async (acc: WazzupInstagramAccount) => {
    setConnectingId(acc.inst_id)
    setError("")
    try {
      setResult(await connectWazzupInstagram(session, acc.inst_id))
    } catch (err: any) {
      setError(errorText(err, "Не удалось подключить Instagram"))
    } finally {
      setConnectingId("")
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Instagram className="h-5 w-5 text-pink-600" />
            Подключение Instagram к VISARIO
          </CardTitle>
          <CardDescription>Выберите аккаунт Instagram, который нужно подключить к Wazzup.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-700">
          {loading && (
            <div className="flex items-center gap-2 text-slate-500">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Получаем аккаунты из Facebook…
            </div>
          )}

          {result?.auth_url && (
            <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-blue-900">
              <p className="font-medium">Остался последний шаг — подтвердить подключение в Wazzup</p>
              <p className="text-xs">
                Канал Instagram создан. Откройте ссылку, войдите в Facebook тем же аккаунтом и выберите
                страницу VISARIO и Instagram. Потом вернитесь сюда и откройте каналы мессенджера.
              </p>
              <Button asChild className="w-full">
                <a href={result.auth_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Завершить подключение в Wazzup
                </a>
              </Button>
            </div>
          )}

          {result && !result.auth_url && !result.provider_response && (
            <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">
              <p className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-4 w-4" />
                Instagram {result.username ? `@${result.username}` : ""}{" "}
                {result.action === "reinit" ? "переавторизован" : "подключён"}
              </p>
              <p className="text-xs">
                Канал появится в группе VISARIO
                {result.state && result.state !== "active" ? ` (сейчас статус «${result.state}» — Wazzup ещё запускает его)` : ""}.
                Назначьте ему филиал и доступ к чатам, как другим номерам.
              </p>
            </div>
          )}

          {result && !result.auth_url && result.provider_response && (
            <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
              <p className="font-medium">
                Wazzup создал канал{result.channel_id ? ` (${result.channel_id})` : ""}
                {result.state ? `, статус «${result.state}»` : ""}, но не вернул ссылку для завершения.
              </p>
              <p className="text-xs">Перешлите разработчику ответ Wazzup:</p>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-white/70 p-2 text-xs">
                {result.provider_response}
              </pre>
            </div>
          )}

          {result?.requested_at_msk && (
            <details className="rounded-lg border border-slate-200 p-3 text-xs text-slate-600">
              <summary className="cursor-pointer">
                Для поддержки Wazzup: запрос {result.requested_at_msk}
              </summary>
              {result.channel_id && <p className="mt-2">Канал: {result.channel_id}</p>}
              {result.request && (
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-slate-100 p-2">
                  {result.request}
                </pre>
              )}
            </details>
          )}

          {!loading && !result && !error && accounts.length === 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
              Facebook не нашёл ни одной страницы с бизнес-аккаунтом Instagram. Проверьте, что
              Instagram — тип «Бизнес» и привязан к странице, а при входе вы дали доступ ко всем
              страницам и аккаунтам Instagram («Изменить настройки»). Затем начните подключение
              заново.
            </div>
          )}

          {!result && accounts.length > 0 && (
            <ul className="space-y-2">
              {accounts.map((acc) => (
                <li
                  key={acc.inst_id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">@{acc.username || acc.inst_id}</p>
                    <p className="truncate text-xs text-slate-500">Страница: {acc.page_name || acc.page_id}</p>
                  </div>
                  <Button size="sm" onClick={() => connect(acc)} disabled={!!connectingId}>
                    {connectingId === acc.inst_id && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                    Подключить
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</div>}

          <Button asChild variant="outline" className="w-full">
            <Link href={BACK_HREF}>К каналам мессенджера</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default function InstagramCallbackPage() {
  return (
    <Suspense fallback={null}>
      <InstagramCallback />
    </Suspense>
  )
}
