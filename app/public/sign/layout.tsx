import type React from "react"

export const metadata = {
    title: "Центр подписи документов — CRM Platform",
    description: "Безопасная страница для просмотра и подписания документов",
}

export default function PublicSignLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // Этот layout вложен в корневой app/layout.tsx,
    // поэтому НЕ добавляем <html>/<body> — они уже есть.
    return <>{children}</>
}
