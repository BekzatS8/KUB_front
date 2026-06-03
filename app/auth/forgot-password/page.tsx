"use client";

import type React from "react";
import { useState } from "react";
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
import { Mail, AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { forgot_password } from "@/src/api/auth.api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess(false);

    try {
      await forgot_password({ email });
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
            Забыли пароль?
          </CardTitle>
          <CardDescription className="text-gray-500">
            Введите ваш email для сброса пароля
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
            <Alert variant="default" className="mb-4">
              <AlertDescription>
                Инструкции по сбросу пароля отправлены на ваш email.
              </AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="text-sm font-medium text-gray-700"
                >
                  Email
                </Label>
                <div className="relative group">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400 group-hover:text-primary transition-colors" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="manager@kubcrm.kz"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? "Отправка..." : "Сбросить пароль"}
              </Button>
            </form>
          )}

          <div className="mt-4 text-center">
            <Link
              href="/auth/login"
              className="text-sm font-medium text-black hover:text-gray-500 hover:underline transition-colors flex items-center justify-center"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Вернуться ко входу
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
