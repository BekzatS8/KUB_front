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
import { Building2, Lock, User, AlertCircle, Info } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthMessage } from "@/hooks/useAuthMessage";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { message: authMessage, clearMessage } = useAuthMessage();

  useEffect(() => {
    // Check if user is already authenticated
    const token = localStorage.getItem("auth_token");
    if (token) {
      router.push("/dashboard");
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const { login } = await import("@/src/api/auth.api");
      // Функция login уже сохраняет токен и пользователя через setAuthToken и setCurrentUser
      await login({ email, password });
      router.push("/dashboard");
    } catch (err: any) {
      setError(err?.message || "Произошла ошибка при входе в систему");
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
            Вход в систему
          </CardTitle>
          <CardDescription className="text-gray-500">
            Введите ваши данные для доступа к платформе
          </CardDescription>
        </CardHeader>

        <CardContent className="animate-fadeIn delay-150">
          {authMessage && (
            <Alert
              variant="default"
              className="mb-4 border-l-4 border-blue-500 bg-blue-50"
            >
              <Info className="h-4 w-4" />
              <AlertDescription>{authMessage}</AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert
              variant="destructive"
              className="mb-4 border-l-4 border-red-500 animate-shake"
            >
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="text-sm font-medium text-gray-700"
              >
                Email
              </Label>
              <div className="relative group">
                <User className="absolute left-3 top-3 h-4 w-4 text-gray-400 group-hover:text-primary transition-colors" />
                <Input
                  id="email"
                  type="email"
                  placeholder="manager@kubcrm.kz"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 border-gray-300 focus:border-gray-900 focus:scale-[1.03] border-2 focus:ring-2 focus:ring-primary/30 transition-all duration-200"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="text-sm font-medium text-gray-700"
              >
                Пароль
              </Label>
              <div className="relative group">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400 group-hover:text-primary transition-colors" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Введите пароль"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 border-gray-300 focus:border-gray-900 focus:scale-[1.03] border-2 focus:ring-2 focus:ring-primary/30 transition-all duration-200"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="relative w-full overflow-hidden rounded-xl border-2 border-gray-900 px-6 py-3 text-black font-semibold 
                        transition-all duration-500 bg-transparent cursor-pointer group
                        hover:text-white hover:border-gray-900
                        before:absolute before:inset-0 before:bg-gradient-to-r before:from-gray-800 before:to-gray-900 
                        before:translate-x-[-100%] before:transition-transform before:duration-1000
                        hover:before:translate-x-0
                        active:scale-95"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {isLoading ? (
                  <>
                    <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Вход...
                  </>
                ) : (
                  "Войти в систему"
                )}
              </span>
            </Button>
          </form>

          <div className="mt-4 text-center space-y-2 pt-4">
            <Link
              href="/auth/register"
              className="text-sm font-medium text-black hover:text-gray-500 hover:underline transition-colors"
            >
              Нет аккаунта? Зарегистрироваться →
            </Link>
            <Link
              href="/auth/forgot-password"
              className="text-sm font-medium text-black hover:text-gray-500 hover:underline transition-colors"
            >
              Забыли пароль?
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}