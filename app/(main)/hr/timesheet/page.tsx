import { ClipboardList } from "lucide-react";

export default function TimesheetPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100">
        <ClipboardList className="h-10 w-10 text-slate-400" />
      </div>
      <h1 className="mt-6 text-2xl font-bold text-slate-900">Табель сотрудников</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        Раздел находится в разработке и будет доступен в следующем обновлении.
      </p>
      <span className="mt-4 rounded-full bg-amber-100 px-4 py-1.5 text-xs font-semibold text-amber-700">
        В разработке
      </span>
    </div>
  );
}
