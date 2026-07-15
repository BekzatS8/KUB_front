// Скоупы документов (ТЗ 04.07.2026, п.2.1).
//
// У документа scope — это либо 'deal' (документ по клиенту/сделке: договор,
// расписка), либо код отдела: общие документы отдела — шаблоны, прайсы,
// регламенты. Зеркалит allowedDocumentScopes в internal/handlers/document_handler.go:
// сервер отдаёт 403 на чужой отдел, поэтому списки здесь должны совпадать.

export type DocumentDepartmentScope =
  | 'sales'
  | 'visa'
  | 'partner'
  | 'hr'
  | 'legal'
  | 'quality_control'
  | 'management'

export const DEPARTMENT_SCOPES: { scope: DocumentDepartmentScope; label: string }[] = [
  { scope: 'sales', label: 'Отдел продаж' },
  { scope: 'visa', label: 'Визовый отдел' },
  { scope: 'partner', label: 'Партнёрский отдел' },
  { scope: 'hr', label: 'Отдел кадров' },
  { scope: 'legal', label: 'Юридический отдел' },
  { scope: 'quality_control', label: 'Контроль качества' },
  { scope: 'management', label: 'Руководство' },
]

export function departmentScopeLabel(scope: string): string {
  return DEPARTMENT_SCOPES.find((d) => d.scope === scope)?.label ?? 'Отдел'
}

/** Отделы, документы которых роль может открыть. Админ и руководство — все. */
export function departmentScopesForRole(roleCode?: string | null): DocumentDepartmentScope[] {
  switch (roleCode) {
    case 'system_admin':
    case 'management':
      return DEPARTMENT_SCOPES.map((d) => d.scope)
    case 'sales':
      return ['sales']
    case 'visa':
      return ['visa']
    case 'partner':
      return ['partner']
    case 'hr':
      return ['hr']
    case 'legal':
      return ['legal']
    case 'quality_control':
      return ['quality_control']
    default:
      return []
  }
}

/**
 * Отделы, в которые роль может загружать документы. Совпадает с видимостью,
 * кроме админа: сервер разрешает ему любой scope, но грузить «за отдел кадров»
 * осмысленно только осознанно — выбор отдела показываем явно.
 */
export function uploadScopesForRole(roleCode?: string | null): DocumentDepartmentScope[] {
  return departmentScopesForRole(roleCode)
}

/** Видит ли роль документы по клиентам и сделкам (scope 'deal'). */
export function canViewClientDocuments(roleCode?: string | null): boolean {
  return ['system_admin', 'management', 'sales', 'visa'].includes(roleCode ?? '')
}
