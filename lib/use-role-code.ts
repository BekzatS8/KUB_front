"use client"

import { useEffect, useState } from "react"
import { getCurrentUser, getRoleCode } from "@/lib/auth"
import { getMe } from "@/src/api/auth.api"

// Роль текущего пользователя с сервера (/users/me), как в меню.
//
// Копию профиля в localStorage перезаписывают разные страницы, и роль в ней
// бывает не той: из-за этого админ не видел кнопок «Подключить» и «Доступ» на
// странице каналов. Пока ответ сервера не пришёл, берём роль из копии.
export function useRoleCode(): string | undefined {
  const [roleCode, setRoleCode] = useState<string | undefined>(() => getRoleCode(getCurrentUser()))

  useEffect(() => {
    let cancelled = false
    getMe()
      .then((me) => {
        const code = getRoleCode(me)
        if (!cancelled && code) setRoleCode(code)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return roleCode
}
