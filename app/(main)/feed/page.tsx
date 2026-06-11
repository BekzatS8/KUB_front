"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function FeedPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Лента</h1>
        <p className="text-slate-600">События CRM появятся здесь после подключения feed_events.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Лента событий</CardTitle>
          <CardDescription>Backend feed API будет добавлен отдельным этапом.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-slate-500">Пока нет событий для отображения.</CardContent>
      </Card>
    </div>
  )
}
