export enum Roles {
  SALES = 10,
  // Оператор колл-центра: первичная обработка лидов и передача в отдел продаж
  // (ТЗ «доработки CRM КУБ», п.5).
  OPERATOR = 95,
  QUALITY_CONTROL = 30,
  CONTROL = 30,
  MANAGEMENT = 40,
  SYSTEM_ADMIN = 50,
  VISA = 60,
  PARTNER = 70,
  HR = 80,
  LEGAL = 90,
}

export const getRoleName = (roleId: number) => {
  switch (roleId) {
    case Roles.SYSTEM_ADMIN:
      return "Администратор";
    case Roles.MANAGEMENT:
      return "Руководство";
    case Roles.QUALITY_CONTROL:
      return "Отдел контроля качества";
    case Roles.SALES:
      return "Менеджер по продажам (МОП)";
    case Roles.OPERATOR:
      return "Оператор (колл-центр)";
    case Roles.VISA:
      return "Визовый отдел";
    case Roles.PARTNER:
      return "Менеджер по партнёрам";
    case Roles.HR:
      return "Отдел кадров";
    case Roles.LEGAL:
      return "Юрист";
    default:
      return "Неизвестная роль";
  }
};

// Короткое название роли для компактных таблиц (ТЗ «доработки CRM КУБ», п.7:
// «МОП» вместо «Менеджер по продажам (МОП)», полное — в подсказке).
export const getRoleShortName = (roleId: number) => {
  switch (roleId) {
    case Roles.SYSTEM_ADMIN:
      return "Админ";
    case Roles.MANAGEMENT:
      return "Руководство";
    case Roles.QUALITY_CONTROL:
      return "ОКК";
    case Roles.SALES:
      return "МОП";
    case Roles.OPERATOR:
      return "Оператор";
    case Roles.VISA:
      return "Визовый";
    case Roles.PARTNER:
      return "Партнёры";
    case Roles.HR:
      return "Кадры";
    case Roles.LEGAL:
      return "Юрист";
    default:
      return "—";
  }
};
