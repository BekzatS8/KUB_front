export enum Roles {
  SALES = 10,
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
