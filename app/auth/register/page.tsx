"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Building2,
  Mail,
  Lock,
  Phone,
  AlertCircle,
  User,
  Crown,
  Shield,
  Target,
  Users,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as RolesAPI from "@/src/api/roles.api";
import type { Role } from "@/src/models/roles.model";

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    company_name: "",
    bin_iin: "",
    email: "",
    password: "",
    phone: "",
    role_id: 10, // Default to sales role
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const router = useRouter();

  // Fetch available roles
  useEffect(() => {
    const fetchRoles = async () => {
      setRolesLoading(true);
      try {
        const response = await RolesAPI.listRoles({ limit: 100 });
        const rolesList = Array.isArray(response) ? response : response.data || [];
        // Filter out management roles for regular registration
        const publicRoles = rolesList.filter(role => 
          !role.name.toLowerCase().includes('leadership') && 
          !role.name.toLowerCase().includes('system_admin') &&
          !role.name.toLowerCase().includes('admin')
        );
        setRoles(publicRoles);
      } catch (error) {
        console.error("Failed to fetch roles:", error);
        // Fallback to default active roles if API fails
        setRoles([
          { id: 10, name: "sales", description: "Менеджер по продажам", created_at: "", updated_at: "" },
          { id: 30, name: "quality_control", description: "Отдел контроля", created_at: "", updated_at: "" },
          { id: 60, name: "visa", description: "Визовый отдел", created_at: "", updated_at: "" },
          { id: 70, name: "partner", description: "Партнерский отдел", created_at: "", updated_at: "" },
        ]);
      } finally {
        setRolesLoading(false);
      }
    };

    fetchRoles();
  }, []);

  const getRoleIcon = (roleName: string) => {
    const name = roleName.toLowerCase();
    if (name.includes('sales') || name.includes('продаж')) return Target;
    if (name.includes('control') || name.includes('контроль') || name.includes('quality')) return Shield;
    if (name.includes('management') || name.includes('менедж')) return Crown;
    if (name.includes('visa') || name.includes('виза')) return Settings;
    return Users;
  };

  const getRoleLabel = (role: Role) => {
    const labelMap: Record<string, string> = {
      'sales': 'Менеджер по продажам (МОП)',
      'quality_control': 'Отдел контроля качества',
      'management': 'Руководство',
      'admin': 'Администратор',
      'visa': 'Визовый отдел',
      'partner': 'Менеджер по партнёрам',
      'hr': 'Отдел кадров',
      'legal': 'Юрист',
    };

    return labelMap[role.name.toLowerCase()] || role.description || role.name;
  };

  const handleInputChange = (field: string, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleRoleSelect = (roleId: number) => {
    setFormData((prev) => ({ ...prev, role_id: roleId }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    if (formData.bin_iin.length !== 12) {
      setError("БИН/ИИН должен содержать 12 цифр");
      setIsLoading(false);
      return;
    }

    try {
      const { register } = await import("@/src/api/auth.api");
      const response = await register(formData);

      if (response.user && response.user.id) {
        router.push(`/auth/register/confirm?user_id=${response.user.id}`);
      } else {
        setError("Не удалось получить ID пользователя после регистрации.");
      }
    } catch (err: any) {
      setError(err?.message || "Произошла ошибка при регистрации");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-gradient-to-br from-white to-gray-50 border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300 rounded-2xl p-1 backdrop-blur-sm hover:-translate-y-1">
        <CardHeader className="space-y-1 text-center animate-fadeIn">
          <div className="flex items-center justify-center mb-4 group">
            <Building2 className="h-10 w-10 text-primary mr-2 transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-indigo-600 bg-clip-text group-hover:opacity-90 transition-opacity">
              CRM Platform
            </h1>
          </div>
          <CardTitle className="text-2xl font-semibold text-gray-900">
            Регистрация
          </CardTitle>
          <CardDescription className="text-gray-500">
            Создайте аккаунт для вашей компании
          </CardDescription>
        </CardHeader>

        <CardContent className="animate-fadeIn delay-150">
          {error && (
            <Alert
              variant="destructive"
              className="mb-6 border-l-4 border-red-500 animate-shake"
            >
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company_name" className="text-sm font-medium text-gray-700">
                Название компании
              </Label>
              <div className="relative group">
                <Building2 className="absolute left-3 top-3 h-4 w-4 text-gray-400 group-hover:text-primary transition-colors" />
                <Input
                  id="company_name"
                  placeholder="Введите название компании..."
                  value={formData.company_name}
                  onChange={(e) => handleInputChange("company_name", e.target.value)}
                  className="pl-10"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bin_iin" className="text-sm font-medium text-gray-700">
                БИН/ИИН
              </Label>
              <Input
                id="bin_iin"
                placeholder="Введите БИН/ИИН..."
                value={formData.bin_iin}
                onChange={(e) => handleInputChange("bin_iin", e.target.value.replace(/\D/g, "").slice(0, 12))}
                maxLength={12}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                Email
              </Label>
              <div className="relative group">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400 group-hover:text-primary transition-colors" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Введите Email..."
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  className="pl-10"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium text-gray-700">
                Телефон
              </Label>
              <div className="relative group">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400 group-hover:text-primary transition-colors" />
                <Input
                  id="phone"
                  placeholder="Введите телефон..."
                  value={formData.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  className="pl-10"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                Пароль
              </Label>
              <div className="relative group">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400 group-hover:text-primary transition-colors" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Введите пароль..."
                  value={formData.password}
                  onChange={(e) => handleInputChange("password", e.target.value)}
                  className="pl-10"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role" className="text-sm font-medium text-gray-700">
                Роль в системе
              </Label>
              {rolesLoading ? (
                <div className="flex items-center justify-center p-3 border border-gray-200 rounded-lg">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  <span className="ml-2 text-sm text-gray-500">Загрузка ролей...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {roles.map((role) => {
                    const Icon = getRoleIcon(role.name);
                    return (
                      <div
                        key={role.id}
                        className={`
                          relative p-3 border rounded-lg cursor-pointer transition-all duration-200
                          ${formData.role_id === role.id
                            ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                          }
                        `}
                        onClick={() => handleRoleSelect(role.id)}
                      >
                        <div className="flex items-center space-x-3">
                          <Icon className={`h-5 w-5 ${
                            formData.role_id === role.id ? "text-primary" : "text-gray-400"
                          }`} />
                          <div className="flex-1">
                            <p className={`font-medium text-sm ${
                              formData.role_id === role.id ? "text-primary" : "text-gray-900"
                            }`}>
                              {getRoleLabel(role)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {role.description}
                            </p>
                          </div>
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            formData.role_id === role.id
                              ? "border-primary bg-primary"
                              : "border-gray-300"
                          }`}>
                            {formData.role_id === role.id && (
                              <div className="w-2 h-2 rounded-full bg-white"></div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Выберите роль, которая лучше всего описывает ваши обязанности в компании
              </p>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? "Регистрация..." : "Зарегистрироваться"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/auth/login"
              className="text-sm font-medium text-black hover:text-gray-500 hover:underline transition-colors"
            >
              Уже есть аккаунт? Войти →
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
