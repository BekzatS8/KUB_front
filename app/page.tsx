"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    // Проверяем наличие токена авторизации
    const token = localStorage.getItem("auth_token")

    if (token) {
      // Если пользователь авторизован, перенаправляем на ленту
      router.push("/feed")
    } else {
      // Если не авторизован, перенаправляем на страницу входа
      router.push("/auth/login")
    }
  }, [router])

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center">
      <div className="text-white text-center animate-fade-in">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-white/30 border-t-white mx-auto mb-6"></div>
          <div className="absolute inset-0 animate-pulse rounded-full h-16 w-16 bg-white/10 blur-xl"></div>
        </div>
        <p className="text-lg font-medium">Загрузка...</p>
      </div>
    </div>
  )
}
