"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, RefreshCw, Send, Settings } from "lucide-react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getCurrentUser, getRoleCode } from "@/lib/auth";
import {
  getWazzupIframe,
  setupWazzup,
  getWazzupChannels,
  sendWazzupMessage,
  type WazzupChannel,
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
  // Настройку интеграции меняет только админ — обычные роли (в т.ч. юрист,
  // которому открыли мессенджер) кнопку настроек не видят (обратная связь 20.07.2026).
  const isAdmin = getRoleCode(getCurrentUser()) === "system_admin";
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

  // «Написать первым»: KUB сам создаёт диалог через API Wazzup (iframe не умеет
  // начинать переписку с новым контактом). Канал = с какого филиала/номера писать.
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeChannels, setComposeChannels] = useState<WazzupChannel[]>([]);
  const [composeChannelId, setComposeChannelId] = useState(""); // external_channel_id
  const [composeTo, setComposeTo] = useState("");
  const [composeText, setComposeText] = useState("");
  const [composeSending, setComposeSending] = useState(false);

  const selectedComposeChannel = composeChannels.find(
    (c) => c.channel_id === composeChannelId,
  );
  const composeTransport = selectedComposeChannel?.transport || "whatsapp";

  useEffect(() => {
    if (!composeOpen) return;
    getWazzupChannels()
      .then((res) => {
        const list = res?.value || [];
        setComposeChannels(list);
        setComposeChannelId((prev) => prev || list[0]?.channel_id || "");
      })
      .catch(() => setComposeChannels([]));
  }, [composeOpen]);

  const handleComposeSend = async () => {
    const text = composeText.trim();
    if (!composeChannelId) {
      toast.error("Выберите канал");
      return;
    }
    if (!composeTo.trim() || !text) {
      toast.error("Заполните получателя и текст");
      return;
    }
    // whatsapp — только цифры номера; telegram/instagram — username без @.
    const recipient =
      composeTransport === "whatsapp"
        ? composeTo.replace(/\D/g, "")
        : composeTo.replace(/^@/, "").trim();
    if (!recipient) {
      toast.error("Некорректный получатель");
      return;
    }
    setComposeSending(true);
    try {
      await sendWazzupMessage(recipient, text, composeTransport, composeChannelId);
      toast.success("Сообщение отправлено. Переписка появится в списке чатов.");
      setComposeOpen(false);
      setComposeTo("");
      setComposeText("");
      refreshWidget();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error ||
          "Не удалось отправить. Проверьте интеграцию и тип канала (для официального WABA нужен шаблон).",
      );
    } finally {
      setComposeSending(false);
    }
  };
  // Deep-link на конкретную переписку: /whatsapp?phone=7700...&transport=whatsapp
  // (из карточки клиента/лида). chat_id — синоним phone (для telegram/instagram
  // это username). Открываем iframe сразу на этом чате.
  const searchParams = useSearchParams();
  const chatTransport = searchParams.get("transport") || "";
  const rawChat = searchParams.get("chat_id") || searchParams.get("phone") || "";
  // Для WhatsApp chat_id — это цифры номера; для Telegram/Instagram — username.
  const chatId =
    chatTransport === "telegram" || chatTransport === "instagram"
      ? rawChat.replace(/^@/, "").trim()
      : rawChat.replace(/\D/g, "");

  const loadWidget = useCallback(async () => {
    setWidgetState("loading");
    setWidgetError("");

    try {
      const response = await getWazzupIframe(
        chatId ? { transport: chatTransport || "whatsapp", chat_id: chatId } : {}
      );
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
  }, [chatId, chatTransport]);

  const refreshWidget = useCallback(async () => {
    setIsManualRefresh(true);
    await loadWidget();
  }, [loadWidget]);

  // Перезагружаем виджет при первом заходе и при смене целевого чата (deep-link).
  useEffect(() => {
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
              {isAdmin && (
                <Button variant="outline" onClick={() => setIsSetupModalOpen(true)}>
                  <Settings className="mr-2 h-4 w-4" />
                  Настройки интеграции
                </Button>
              )}
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
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => setComposeOpen(true)}>
            <Send className="mr-2 h-4 w-4" />
            Написать
          </Button>
          <Button variant="outline" onClick={refreshWidget}>
            <RefreshCw className={cn("mr-2 h-4 w-4", isManualRefresh && "animate-spin")} />
            Обновить
          </Button>
          {isAdmin && (
            <Button variant="outline" onClick={() => setIsSetupModalOpen(true)}>
              <Settings className="mr-2 h-4 w-4" />
              Настройки
            </Button>
          )}
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

      {/* «Написать первым» — KUB отправляет первое сообщение через API Wazzup,
          после чего диалог появляется в списке чатов (iframe сам это не умеет). */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-md">
          <DialogHeader>
            <DialogTitle>Написать первым</DialogTitle>
            <DialogDescription>
              Сообщение отправится клиенту с выбранного канала (филиала). После
              отправки переписка появится в списке чатов.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Канал (филиал)</Label>
              <select
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
                value={composeChannelId}
                onChange={(e) => setComposeChannelId(e.target.value)}
              >
                {composeChannels.length === 0 && <option value="">Каналы не найдены</option>}
                {composeChannels.map((ch) => (
                  <option key={ch.id} value={ch.channel_id}>
                    {ch.name || ch.phone || ch.channel_id}
                    {ch.branch_name ? ` · ${ch.branch_name}` : ""}
                    {` · ${ch.transport}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="compose-to">
                {composeTransport === "whatsapp" ? "Номер телефона" : "Username / телефон"}
              </Label>
              <Input
                id="compose-to"
                value={composeTo}
                onChange={(e) => setComposeTo(e.target.value)}
                placeholder={composeTransport === "whatsapp" ? "77001234567" : "username"}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="compose-text">Сообщение</Label>
              <Textarea
                id="compose-text"
                rows={4}
                value={composeText}
                onChange={(e) => setComposeText(e.target.value)}
                placeholder="Введите сообщение..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setComposeOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleComposeSend} disabled={composeSending}>
              {composeSending ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Отправить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
