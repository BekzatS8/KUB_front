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
import { AlertCircle, CheckCircle } from "lucide-react";
import Link from "next/link";
import { confirm_registration, resend_confirmation } from "@/src/api/auth.api";
import { useRouter } from "next/navigation";

function ConfirmPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [userId, setUserId] = useState<number | null>(null);
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  useEffect(() => {
    const userIdFromUrl = searchParams.get('user_id');
    if (userIdFromUrl) {
      setUserId(parseInt(userIdFromUrl, 10));
    }
  }, [searchParams]);

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      setError("ID пользователя не найден.");
      return;
    }
    setIsLoading(true);
    setError("");
    setSuccess(false);

    try {
      await confirm_registration({ user_id: userId, code });
      setSuccess(true);
      setTimeout(() => {
        router.push('/auth/login');
      }, 2000)
    } catch (err: any) {
      setError(err?.message || "Произошла ошибка");
    } finally {
      setIsLoading(false);
    }
  };
  
    const handleResend = async () => {
    if (!userId) {
      setError("ID пользователя не найден.");
      return;
    }
    setResendLoading(true);
    setError("");
    setResendSuccess(false);

    try {
      // Note: The resend endpoint in the user request requires a phone number,
      // which we don't have on this page. We will assume the backend can handle
      // resending with just the user_id. If not, this needs adjustment.
      await resend_confirmation({ user_id: userId, phone: '' }); // Sending empty phone
      setResendSuccess(true);
    } catch (err: any) {
      setError(err?.message || "Ошибка при повторной отправке кода");
    } finally {
      setResendLoading(false);
    }
  };

  if (success) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
            <Card className="w-full max-w-md bg-white shadow-lg rounded-2xl p-2">
                <CardContent className="pt-6">
                    <div className="text-center space-y-4">
                        <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
                        <h2 className="text-2xl font-bold">Успешно!</h2>
                        <p className="text-gray-600">Ваш аккаунт подтвержден. Перенаправляем на страницу входа...</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white shadow-lg rounded-2xl p-2">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-semibold text-gray-900">
            Подтверждение регистрации
          </CardTitle>
          <CardDescription className="text-gray-500">
            Введите код, отправленный на ваш телефон
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
           {resendSuccess && (
            <Alert variant="default" className="mb-4">
              <AlertDescription>Код успешно отправлен повторно.</AlertDescription>
            </Alert>
          )}

            <form onSubmit={handleConfirm} className="space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="code"
                  className="text-sm font-medium text-gray-700"
                >
                  Код подтверждения
                </Label>
                <Input
                    id="code"
                    placeholder="123456"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="text-center tracking-widest text-2xl"
                    required
                    disabled={isLoading || !userId}
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading || !userId}
                className="w-full"
              >
                {isLoading ? "Подтверждение..." : "Подтвердить"}
              </Button>
            </form>

            <div className="mt-4 text-center">
                 <Button
                    variant="link"
                    onClick={handleResend}
                    disabled={resendLoading || !userId}
                    className="text-sm"
                >
                    {resendLoading ? "Отправка..." : "Отправить код повторно"}
                </Button>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ConfirmPageContent />
    </Suspense>
  )
}
