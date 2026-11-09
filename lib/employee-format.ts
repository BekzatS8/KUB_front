// Форматирование для раздела «Сотрудники».
export const formatMoney = (v: number) => new Intl.NumberFormat("ru-RU").format(Math.round(v || 0)) + " ₸"
export const formatDate = (d?: string) => (d ? d.split("-").reverse().join(".") : "—")
export const formatDateTime = (iso?: string) => {
  if (!iso) return "—"
  try {
    return new Intl.DateTimeFormat("ru-KZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso))
  } catch {
    return iso
  }
}
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase()
