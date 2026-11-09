// Доступ к разделам по роли на стороне интерфейса. Бэкенд всё равно проверяет
// права на каждом запросе; здесь — чтобы прямая ссылка на закрытый раздел
// показывала «Нет доступа», а не пустую страницу с ошибками.

// Оператор колл-центра (ТЗ «доработки CRM КУБ», п.5): только лиды, мессенджер,
// звонки, календарь и свой профиль.
// "/dashboard" — страница-развилка после входа (сразу переадресует на «Лиды»).
const OPERATOR_PREFIXES = ["/dashboard", "/leads", "/whatsapp", "/whatsapp-child", "/telephony", "/calendar", "/profile"]

// Разделы, открытые только перечисленным ролям.
const RESTRICTED: { prefix: string; roles: string[] }[] = [
  // Сотрудники и зарплаты — администратор, руководство, отдел кадров (п.1)
  { prefix: "/employees", roles: ["system_admin", "admin", "management", "hr"] },
]

function matches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + "/")
}

export function canAccessPath(roleCode: string | undefined, pathname: string): boolean {
  if (!roleCode) return true // роль ещё не загрузилась — не мигаем «Нет доступа»
  if (roleCode === "operator") {
    return OPERATOR_PREFIXES.some((p) => matches(pathname, p))
  }
  for (const r of RESTRICTED) {
    if (matches(pathname, r.prefix)) return r.roles.includes(roleCode)
  }
  return true
}
