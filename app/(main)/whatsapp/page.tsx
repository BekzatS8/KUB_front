"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
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
type WidgetState = "loading" | "ready" | "error" | "not_connected" | "service_unavailable";

const SOFT_REFRESH_DURATION_MS = 7.5 * 60 * 60 * 1000;

const getWidgetErrorMessage = (error: any) => {
  if (error?.response?.status === 404) {
    return { state: "not_connected" as const, message: "Интеграция Wazzup не подключена" };
  }

  if (error?.response?.status === 502 || error?.response?.status === 503) {
    return { state: "service_unavailable" as const, message: "Сервис Wazzup временно недоступен" };
  }

  if (error?.code === "NETWORK_ERROR" || error?.code === "ECONNABORTED") {
    return { state: "error" as const, message: "Ошибка сети. Проверьте подключение к интернету" };
  }

  return {
    state: "error" as const,
    message: error?.response?.data?.message || error?.message || "Не удалось загрузить мессенджер",
  };
};

export default function MessengerPage() {
  const [activeChannel, setActiveChannel] = useState<ChannelId>("whatsapp");
  const [iframeUrl, setIframeUrl] = useState("");
  const [widgetState, setWidgetState] = useState<WidgetState>("loading");
  const [widgetError, setWidgetError] = useState("");
  const [sessionReceivedAt, setSessionReceivedAt] = useState<number | null>(null);
  const [isManualRefresh, setIsManualRefresh] = useState(false);

  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [isSetupLoading, setIsSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState("");
  const [setupForm, setSetupForm] = useState({
    webhooks_base_url: "https://api.kubcrm.kz",
    enabled: true,
  });

  const wazzupConnected = widgetState === "ready";

  const loadWidget = useCallback(async () => {
    setWidgetState("loading");
    setWidgetError("");

    try {
      const response = await getWazzupIframe();
      const nextUrl = response.iframe_url || response.url;

      if (!nextUrl) {
        setWidgetState("error");
        setWidgetError("Wazzup не вернул ссылку на виджет");
        return;
      }

      setIframeUrl(nextUrl);
      setSessionReceivedAt(Date.now());
      setWidgetState("ready");
    } catch (error: any) {
      const nextError = getWidgetErrorMessage(error);
      setWidgetState(nextError.state);
      setWidgetError(nextError.message);
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

  useEffect(() => {
    if (!sessionReceivedAt || widgetState !== "ready") return;

    const refreshIn = SOFT_REFRESH_DURATION_MS - (Date.now() - sessionReceivedAt);
    const timer = window.setTimeout(refreshWidget, Math.max(refreshIn, 0));

    return () => window.clearTimeout(timer);
  }, [refreshWidget, sessionReceivedAt, widgetState]);

  const channels = useMemo(
    () => [
      {
        id: "whatsapp" as const,
        title: "WhatsApp",
        description: "Диалоги и клиенты через Wazzup",
        status: wazzupConnected ? "Подключено" : "Нужно подключить",
        statusClassName: wazzupConnected
          ? "bg-emerald-50 text-emerald-700"
          : "bg-amber-50 text-amber-700",
        icon: MessageCircle,
        iconClassName: "bg-emerald-500 text-white",
      },
      {
        id: "telegram" as const,
        title: "Telegram",
        description: "Сообщения через канал Wazzup",
        status: wazzupConnected ? "Готово" : "Нужен Wazzup",
        statusClassName: wazzupConnected
          ? "bg-sky-50 text-sky-700"
          : "bg-slate-100 text-slate-600",
        icon: Send,
        iconClassName: "bg-sky-500 text-white",
      },
      {
        id: "instagram" as const,
        title: "Instagram",
        description: "Direct через канал Wazzup",
        status: wazzupConnected ? "Готово к настройке" : "Нужен Wazzup",
        statusClassName: wazzupConnected
          ? "bg-pink-50 text-pink-700"
          : "bg-slate-100 text-slate-600",
        icon: Instagram,
        iconClassName: "bg-pink-500 text-white",
      },
    ],
    [wazzupConnected],
  );

  const handleSetup = async () => {
    setIsSetupLoading(true);
    setSetupError("");

    try {
      await setupWazzup(setupForm);
      setIsSetupModalOpen(false);
      await loadWidget();
    } catch (error: any) {
      setSetupError(
        error?.response?.data?.message ||
          error?.message ||
          "Не удалось сохранить настройки Wazzup",
      );
    } finally {
      setIsSetupLoading(false);
    }
  };

  const renderWhatsAppPanel = () => {
    if (widgetState === "loading") {
      return (
        <div className="flex min-h-[520px] items-center justify-center rounded-xl border bg-white">
          <div className="text-center">
            <RefreshCw className="mx-auto mb-4 h-8 w-8 animate-spin text-blue-600" />
            <p className="text-slate-600">Загрузка Wazzup...</p>
          </div>
        </div>
      );
    }

    if (widgetState === "ready") {
      return (
        <div className="h-[calc(100dvh-260px)] min-h-[560px] overflow-hidden rounded-xl border bg-white shadow-sm">
          <iframe
            src={iframeUrl}
            className="h-full w-full border-0"
            title="WhatsApp Wazzup"
            onError={refreshWidget}
          />
        </div>
      );
    }

    return (
      <div className="flex min-h-[520px] items-center justify-center rounded-xl border bg-white p-6">
        <div className="max-w-md text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-amber-500" />
          <h3 className="mb-2 text-lg font-semibold text-slate-900">
            WhatsApp не загружен
          </h3>
          <p className="mb-5 text-sm text-slate-600">
            {widgetError || "Проверьте подключение Wazzup и повторите попытку"}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" onClick={() => setIsSetupModalOpen(true)}>
              <Settings className="mr-2 h-4 w-4" />
              Настроить
            </Button>
            <Button onClick={refreshWidget}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Обновить
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderTelegramPanel = () => (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500 text-white">
          <Send className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Telegram</h3>
          <p className="text-sm text-slate-600">
            Канал подключается через Wazzup. После настройки диалоги Telegram будут доступны в общем виджете.
          </p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {["Сообщения Telegram", "История диалогов", "Работа менеджеров"].map((item) => (
          <div key={item} className="rounded-lg border bg-slate-50 p-4 text-sm text-slate-700">
            <CheckCircle2 className="mb-2 h-4 w-4 text-sky-600" />
            {item}
          </div>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <Button onClick={() => setIsSetupModalOpen(true)}>
          Настроить Wazzup
          <Settings className="ml-2 h-4 w-4" />
        </Button>
        <Button variant="outline" onClick={() => setActiveChannel("whatsapp")}>
          Открыть общий виджет
        </Button>
      </div>
    </div>
  );

  const renderInstagramPanel = () => (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-pink-500 text-white">
          <Instagram className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Instagram Direct</h3>
          <p className="text-sm text-slate-600">
            Канал подключается через Wazzup. После настройки диалоги будут доступны в общем виджете.
          </p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {["Direct-сообщения", "История диалогов", "Работа менеджеров"].map((item) => (
          <div key={item} className="rounded-lg border bg-slate-50 p-4 text-sm text-slate-700">
            <CheckCircle2 className="mb-2 h-4 w-4 text-pink-600" />
            {item}
          </div>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <Button onClick={() => setIsSetupModalOpen(true)}>
          Настроить Wazzup
          <Settings className="ml-2 h-4 w-4" />
        </Button>
        <Button variant="outline" onClick={() => setActiveChannel("whatsapp")}>
          Открыть общий виджет
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-[calc(100dvh-1rem)] space-y-4 bg-slate-50 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Мессенджер</h1>
          <p className="text-sm text-slate-600">
            WhatsApp, Telegram и Instagram в одном рабочем разделе
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refreshWidget}>
            <RefreshCw className={cn("mr-2 h-4 w-4", isManualRefresh && "animate-spin")} />
            Обновить
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
                <div className="flex items-center gap-3">
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", channel.iconClassName)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">{channel.title}</div>
                    <div className="text-sm text-slate-500">{channel.description}</div>
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

      {activeChannel === "whatsapp" && renderWhatsAppPanel()}
      {activeChannel === "telegram" && renderTelegramPanel()}
      {activeChannel === "instagram" && renderInstagramPanel()}

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
