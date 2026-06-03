export enum Roles {
  SALES = 10,
  OPERATIONS = 20,
  CONTROL = 30,
  MANAGEMENT = 40,
  SYSTEM_ADMIN = 50,
}

export const getRoleName = (roleId: number) => {
  switch (roleId) {
    case Roles.SYSTEM_ADMIN:
      return "Системный администратор";
    case Roles.MANAGEMENT:
      return "Руководство";
    case Roles.CONTROL:
      return "Отдел контроля";
    case Roles.OPERATIONS:
      return "Операционный отдел";
    case Roles.SALES:
      return "Отдел продаж";
    default:
      return "Неизвестная роль";
  }
};
