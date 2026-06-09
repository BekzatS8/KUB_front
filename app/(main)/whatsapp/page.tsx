"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Instagram,
  MessageCircle,
  RefreshCw,
  Send,
  Settings,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { getWazzupIframe, setupWazzup } from "@/src/api/integrations_wazzup.api";

type ChannelId = "whatsapp" | "telegram" | "instagram";
type WidgetState = "loading" | "ready" | "error";

const CHANNELS: Array<{
  id: ChannelId;
  title: string;
  description: string;
  icon: typeof MessageCircle;
  iconClassName: string;
}> = [
  {
    id: "whatsapp",
    title: "WhatsApp",
    description: "Диалоги через Wazzup",
    icon: MessageCircle,
    iconClassName: "bg-emerald-500 text-white",
  },
  {
    id: "telegram",
    title: "Telegram",
    description: "Диалоги через Wazzup",
    icon: Send,
    iconClassName: "bg-sky-500 text-white",
  },
  {
    id: "instagram",
    title: "Instagram",
    description: "Direct через Wazzup",
    icon: Instagram,
    iconClassName: "bg-pink-500 text-white",
  },
];

const getWidgetErrorMessage = (error: any) => {
  const status = error?.response?.status;
  const message = String(error?.message || "");

  if (status === 401 || status === 403 || /forbidden|unauthorized|session|истекла/i.test(message)) {
    return "Нет доступа или истекла сессия";
  }
  if (status === 404) {
    return "Endpoint Wazzup iframe не найден";
  }
  if (status === 500 || status === 502 || status === 503) {
    return "Ошибка сервера Wazzup-интеграции";
  }
  if (error?.code === "NETWORK_ERROR" || error?.code === "ECONNABORTED") {
    return "Ошибка сети. Проверьте подключение";
  }
  return "Не удалось открыть Wazzup. Проверьте интеграцию.";
};

export default function MessengerPage() {
  const [activeChannel, setActiveChannel] = useState<ChannelId>("whatsapp");
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

  const widgetReady = widgetState === "ready";

  const loadWidget = useCallback(async () => {
    setWidgetState("loading");
    setWidgetError("");

    try {
      const response = await getWazzupIframe();
      const nextUrl = response.iframe_url || response.url;

      if (!nextUrl) {
        setWidgetState("error");
        setWidgetError("Не удалось открыть Wazzup. Проверьте интеграцию.");
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
    loadWidget();
  }, [loadWidget]);

  const channels = useMemo(
    () =>
      CHANNELS.map((channel) => ({
        ...channel,
        status: widgetReady ? "Через Wazzup" : "Требуется настройка",
        statusClassName: widgetReady
          ? "bg-emerald-50 text-emerald-700"
          : "bg-amber-50 text-amber-700",
      })),
    [widgetReady],
  );

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
        <div className="flex h-[calc(100vh-220px)] min-h-[560px] items-center justify-center rounded-xl border bg-white shadow-sm">
          <div className="text-center">
            <RefreshCw className="mx-auto mb-4 h-8 w-8 animate-spin text-blue-600" />
            <p className="text-slate-600">Загрузка Wazzup...</p>
          </div>
        </div>
      );
    }

    if (widgetState === "error") {
      return (
        <div className="flex h-[calc(100vh-220px)] min-h-[560px] items-center justify-center rounded-xl border bg-white p-6 shadow-sm">
          <div className="max-w-md text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-amber-500" />
            <h2 className="mb-2 text-lg font-semibold text-slate-900">
              Не удалось открыть Wazzup
            </h2>
            <p className="mb-5 text-sm text-slate-600">
              {widgetError || "Не удалось открыть Wazzup. Проверьте интеграцию."}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" onClick={() => setIsSetupModalOpen(true)}>
                <Settings className="mr-2 h-4 w-4" />
                Настроить Wazzup
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
      <div className="h-[calc(100vh-220px)] min-h-[560px] overflow-hidden rounded-xl border bg-white shadow-sm">
        <iframe
          src={iframeUrl}
          className="h-full w-full border-0"
          title="Wazzup общий виджет"
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
            Все диалоги WhatsApp, Telegram и Instagram открываются через Wazzup iframe
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={refreshWidget}>
            <RefreshCw className={cn("mr-2 h-4 w-4", isManualRefresh && "animate-spin")} />
            Обновить
          </Button>
          <Button variant="outline" onClick={refreshWidget}>
            <MessageCircle className="mr-2 h-4 w-4" />
            Открыть виджет
          </Button>
          <Button onClick={() => setIsSetupModalOpen(true)}>
            <Settings className="mr-2 h-4 w-4" />
            Wazzup
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {channels.map((channel) => {
          const Icon = channel.icon;
          const isActive = activeChannel === channel.id;

          return (
            <button
              key={channel.id}
              type="button"
              onClick={() => setActiveChannel(channel.id)}
              className={cn(
                "rounded-xl border bg-white p-4 text-left shadow-sm transition",
                "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset",
                isActive ? "border-blue-500 shadow-md" : "border-slate-200 hover:border-blue-200",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", channel.iconClassName)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900">{channel.title}</div>
                    <div className="truncate text-sm text-slate-500">{channel.description}</div>
                  </div>
                </div>
                <Badge className={cn("shrink-0 border-0", channel.statusClassName)}>
                  {channel.status}
                </Badge>
              </div>
            </button>
          );
        })}
      </div>

      {renderWidget()}

      <Dialog open={isSetupModalOpen} onOpenChange={setIsSetupModalOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-lg">
          <DialogHeader>
            <DialogTitle>Настройка Wazzup</DialogTitle>
            <DialogDescription>
              Подключение используется для WhatsApp, Telegram и Instagram. Сами каналы добавляются в личном кабинете Wazzup.
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
