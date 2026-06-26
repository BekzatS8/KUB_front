"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, RefreshCw, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  getWazzupIframe,
  setupWazzup,
} from "@/src/api/integrations_wazzup.api";

type WidgetState = "loading" | "ready" | "error";

const getWidgetErrorMessage = (error: any) => {
  const status = error?.response?.status;
  const message = String(error?.message || "");

  if (status === 401 || status === 403 || /forbidden|unauthorized|session|истекла/i.test(message)) {
    return "Нет доступа или истекла сессия";
  }
  if (status === 404) {
    return "Канал не найден. Проверьте настройки интеграции";
  }
  if (status === 500 || status === 502 || status === 503) {
    return "Ошибка сервера интеграции";
  }
  if (error?.code === "NETWORK_ERROR" || error?.code === "ECONNABORTED") {
    return "Ошибка сети. Проверьте подключение";
  }
  return "Не удалось открыть мессенджер";
};

export default function MessengerPage() {
  const [iframeUrl, setIframeUrl] = useState("");
  const [widgetState, setWidgetState] = useState<WidgetState>("loading");
  const [widgetError, setWidgetError] = useState("");
  const [isManualRefresh, setIsManualRefresh] = useState(false);

  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [isSetupLoading, setIsSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState("");
  const [setupForm, setSetupForm] = useState({
    webhooks_base_url: "https://api.kubcrm.kz",
    enabled: true,
  });
  const initialLoadRef = useRef(false);

  const loadWidget = useCallback(async () => {
    setWidgetState("loading");
    setWidgetError("");

    try {
      const response = await getWazzupIframe({});
      const nextUrl = response.iframe_url || response.url;

      if (!nextUrl) {
        setWidgetState("error");
        setWidgetError("URL мессенджера не получен");
        return;
      }

      setIframeUrl(nextUrl);
      setWidgetState("ready");
    } catch (error: any) {
      setWidgetState("error");
      setWidgetError(getWidgetErrorMessage(error));
    } finally {
      setIsManualRefresh(false);
    }
  }, []);

  const refreshWidget = useCallback(async () => {
    setIsManualRefresh(true);
    await loadWidget();
  }, [loadWidget]);

  useEffect(() => {
    if (initialLoadRef.current) {
      return;
    }
    initialLoadRef.current = true;
    loadWidget();
  }, [loadWidget]);

  const handleSetup = async () => {
    setIsSetupLoading(true);
    setSetupError("");

    try {
      await setupWazzup(setupForm);
      setIsSetupModalOpen(false);
      await loadWidget();
    } catch (error: any) {
      setSetupError(getWidgetErrorMessage(error));
    } finally {
      setIsSetupLoading(false);
    }
  };

  const renderWidget = () => {
    if (widgetState === "loading") {
      return (
        <div className="flex h-[calc(100vh-180px)] min-h-[560px] items-center justify-center rounded-lg border bg-white shadow-sm">
          <div className="text-center">
            <RefreshCw className="mx-auto mb-4 h-8 w-8 animate-spin text-blue-600" />
            <p className="text-slate-600">Загрузка мессенджера...</p>
          </div>
        </div>
      );
    }

    if (widgetState === "error") {
      return (
        <div className="flex h-[calc(100vh-180px)] min-h-[560px] items-center justify-center rounded-lg border bg-white p-6 shadow-sm">
          <div className="max-w-md text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-amber-500" />
            <h2 className="mb-2 text-lg font-semibold text-slate-900">
              Не удалось открыть мессенджер
            </h2>
            <p className="mb-5 text-sm text-slate-600">
              {widgetError || "Не удалось открыть мессенджер. Проверьте интеграцию."}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" onClick={() => setIsSetupModalOpen(true)}>
                <Settings className="mr-2 h-4 w-4" />
                Настройки интеграции
              </Button>
              <Button onClick={refreshWidget}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Повторить
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="h-[calc(100vh-180px)] min-h-[560px] overflow-hidden rounded-lg border bg-white shadow-sm">
        <iframe
          key={iframeUrl}
          src={iframeUrl}
          className="h-full w-full border-0"
          title="Мессенджер"
          allow="microphone *; clipboard-write *"
          onError={refreshWidget}
        />
      </div>
    );
  };

  return (
    <div className="min-h-[calc(100dvh-1rem)] space-y-4 bg-slate-50 p-4 sm:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Мессенджер</h1>
          <p className="text-sm text-slate-600">
            WhatsApp, Telegram и Instagram
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={refreshWidget}>
            <RefreshCw className={cn("mr-2 h-4 w-4", isManualRefresh && "animate-spin")} />
            Обновить
          </Button>
          <Button onClick={() => setIsSetupModalOpen(true)}>
            <Settings className="mr-2 h-4 w-4" />
            Настройки
          </Button>
        </div>
      </div>

      {renderWidget()}

      <Dialog open={isSetupModalOpen} onOpenChange={setIsSetupModalOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-lg">
          <DialogHeader>
            <DialogTitle>Настройка интеграции</DialogTitle>
            <DialogDescription>
              Подключение используется для WhatsApp, Telegram и Instagram. Сами каналы добавляются в личном кабинете сервиса.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {setupError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {setupError}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="webhook-url">Webhook Base URL</Label>
              <Input
                id="webhook-url"
                value={setupForm.webhooks_base_url}
                onChange={(event) =>
                  setSetupForm((prev) => ({
                    ...prev,
                    webhooks_base_url: event.target.value,
                  }))
                }
                placeholder="https://api.kubcrm.kz"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={setupForm.enabled}
                onChange={(event) =>
                  setSetupForm((prev) => ({ ...prev, enabled: event.target.checked }))
                }
                className="h-4 w-4 rounded border-slate-300"
              />
              Включить интеграцию
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSetupModalOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSetup} disabled={isSetupLoading}>
              {isSetupLoading && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
