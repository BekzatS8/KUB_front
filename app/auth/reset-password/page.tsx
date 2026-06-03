"use client";

import type React from "react";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from 'next/navigation'
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
import { Lock, AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { reset_password } from "@/src/api/auth.api";

function ResetPasswordPageContent() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  
  useEffect(() => {
    const tokenFromUrl = searchParams.get('token');
    if (tokenFromUrl) {
      setToken(tokenFromUrl);
    }
  }, [searchParams]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess(false);

    try {
      await reset_password({ token, password });
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || "Произошла ошибка");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white shadow-lg rounded-2xl p-2">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-semibold text-gray-900">
            Сброс пароля
          </CardTitle>
          <CardDescription className="text-gray-500">
            Введите ваш новый пароль
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success ? (
            <div>
                <Alert variant="default" className="mb-4">
                <AlertDescription>
                    Пароль успешно изменен.
                </AlertDescription>
                </Alert>
                <Link href="/auth/login" className="text-sm font-medium text-black hover:text-gray-500 hover:underline transition-colors flex items-center justify-center">
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Вернуться ко входу
                </Link>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="password"
                  className="text-sm font-medium text-gray-700"
                >
                  Новый пароль
                </Label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400 group-hover:text-primary transition-colors" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Введите новый пароль"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading || !token}
                className="w-full"
              >
                {isLoading ? "Изменение..." : "Изменить пароль"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ResetPasswordPageContent />
        </Suspense>
    )
}
