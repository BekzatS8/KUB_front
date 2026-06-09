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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  getWazzupChannels,
  getWazzupDialogMessages,
  getWazzupDialogs,
  getWazzupIframe,
  getWazzupStatus,
  sendWazzupDialogMessage,
  setupWazzup,
  type WazzupChannel,
  type WazzupDialog,
  type WazzupDialogMessage,
  type WazzupStatus,
} from "@/src/api/integrations_wazzup.api";

type ChannelId = "whatsapp" | "telegram" | "instagram";
type WidgetState = "idle" | "loading" | "ready" | "error";

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
    description: "Диалоги WhatsApp из Wazzup",
    icon: MessageCircle,
    iconClassName: "bg-emerald-500 text-white",
  },
  {
    id: "telegram",
    title: "Telegram",
    description: "Диалоги Telegram из Wazzup",
    icon: Send,
    iconClassName: "bg-sky-500 text-white",
  },
  {
    id: "instagram",
    title: "Instagram",
    description: "Instagram Direct из Wazzup",
    icon: Instagram,
    iconClassName: "bg-pink-500 text-white",
  },
];

const channelLabel: Record<ChannelId, string> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  instagram: "Instagram Direct",
};

const getErrorMessage = (error: any) => {
  const status = error?.response?.status;
  const message = String(error?.message || "");

  if (status === 401 || status === 403 || /forbidden|unauthorized|permission|session|истекла/i.test(message)) {
    return "Нет доступа или истекла сессия";
  }
  if (status === 404) {
    return "Данные Wazzup не найдены";
  }
  if (status === 500 || status === 502 || status === 503) {
    return "Ошибка сервера Wazzup-интеграции";
  }
  if (error?.code === "NETWORK_ERROR" || error?.code === "ECONNABORTED") {
    return "Ошибка сети. Проверьте подключение";
  }
  return error?.response?.data?.message || error?.response?.data?.error || error?.message || "Не удалось выполнить запрос";
};

const formatTime = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const normalizeList = <T,>(response?: { value?: T[] } | T[]): T[] => {
  if (Array.isArray(response)) return response;
  return response?.value || [];
};

export default function MessengerPage() {
  const [activeChannel, setActiveChannel] = useState<ChannelId>("whatsapp");
  const [status, setStatus] = useState<WazzupStatus | null>(null);
  const [channels, setChannels] = useState<WazzupChannel[]>([]);
  const [dialogs, setDialogs] = useState<WazzupDialog[]>([]);
  const [selectedDialog, setSelectedDialog] = useState<WazzupDialog | null>(null);
  const [messages, setMessages] = useState<WazzupDialogMessage[]>([]);

  const [statusLoading, setStatusLoading] = useState(true);
  const [dialogsLoading, setDialogsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [error, setError] = useState("");
  const [messageText, setMessageText] = useState("");

  const [iframeUrl, setIframeUrl] = useState("");
  const [widgetState, setWidgetState] = useState<WidgetState>("idle");
  const [widgetError, setWidgetError] = useState("");
  const [showWidget, setShowWidget] = useState(false);

  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [isSetupLoading, setIsSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState("");
  const [setupForm, setSetupForm] = useState({
    webhooks_base_url: "https://api.kubcrm.kz",
    enabled: true,
  });

  const loadStatusAndChannels = useCallback(async () => {
    setStatusLoading(true);
    setError("");
    try {
      const [nextStatus, nextChannels] = await Promise.all([
        getWazzupStatus(),
        getWazzupChannels(),
      ]);
      setStatus(nextStatus);
      setChannels(normalizeList(nextChannels));
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setStatusLoading(false);
    }
  }, []);

  const loadDialogs = useCallback(async (transport: ChannelId) => {
    setDialogsLoading(true);
    setSelectedDialog(null);
    setMessages([]);
    setError("");
    try {
      const response = await getWazzupDialogs(transport);
      const nextDialogs = normalizeList(response);
      setDialogs(nextDialogs);
      setSelectedDialog(nextDialogs[0] || null);
    } catch (err: any) {
      setDialogs([]);
      setError(getErrorMessage(err));
    } finally {
      setDialogsLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (dialogId: number) => {
    setMessagesLoading(true);
    setError("");
    try {
      const response = await getWazzupDialogMessages(dialogId, 100, 0);
      setMessages(normalizeList(response));
    } catch (err: any) {
      setMessages([]);
      setError(getErrorMessage(err));
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatusAndChannels();
  }, [loadStatusAndChannels]);

  useEffect(() => {
    loadDialogs(activeChannel);
  }, [activeChannel, loadDialogs]);

  useEffect(() => {
    if (selectedDialog) {
      loadMessages(selectedDialog.id);
    }
  }, [selectedDialog, loadMessages]);

  const loadWidget = useCallback(async () => {
    setWidgetState("loading");
    setWidgetError("");
    setShowWidget(true);
    try {
      const response = await getWazzupIframe();
      const nextUrl = response.iframe_url || response.url;
      if (!nextUrl) {
        setWidgetState("error");
        setWidgetError("Wazzup iframe URL не получен");
        return;
      }
      setIframeUrl(nextUrl);
      setWidgetState("ready");
    } catch (err: any) {
      setWidgetState("error");
      setWidgetError(getErrorMessage(err));
    }
  }, []);

  const handleSetup = async () => {
    setIsSetupLoading(true);
    setSetupError("");
    try {
      await setupWazzup(setupForm);
      setIsSetupModalOpen(false);
      await loadStatusAndChannels();
      await loadWidget();
    } catch (err: any) {
      setSetupError(getErrorMessage(err));
    } finally {
      setIsSetupLoading(false);
    }
  };

  const handleSend = async () => {
    if (!selectedDialog || !messageText.trim()) return;
    setSendLoading(true);
    setError("");
    try {
      const sent = await sendWazzupDialogMessage(selectedDialog.id, messageText.trim());
      setMessages((prev) => [...prev, sent]);
      setMessageText("");
      await loadDialogs(activeChannel);
      setSelectedDialog((prev) => prev || selectedDialog);
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setSendLoading(false);
    }
  };

  const channelsByTransport = useMemo(() => {
    return channels.reduce<Record<string, WazzupChannel[]>>((acc, channel) => {
      const key = channel.transport || "unknown";
      acc[key] = acc[key] || [];
      acc[key].push(channel);
      return acc;
    }, {});
  }, [channels]);

  const getChannelStatus = (transport: ChannelId) => {
    if (statusLoading) return "Проверка";
    if (!status?.configured || !status.enabled) return "Требуется настройка";
    const items = channelsByTransport[transport] || [];
    if (items.length === 0) return "Нет данных";
    const active = items.some((item) => ["active", "connected", "ok", "enabled"].includes(String(item.status).toLowerCase()));
    return active ? "Активен" : "Через Wazzup";
  };

  const isIntegrationReady = Boolean(status?.configured && status.enabled);

  return (
    <div className="min-h-[calc(100dvh-1rem)] space-y-4 bg-slate-50 p-4 sm:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Мессенджер</h1>
          <p className="text-sm text-slate-600">
            WhatsApp, Telegram и Instagram через Wazzup
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => loadDialogs(activeChannel)} disabled={dialogsLoading}>
            <RefreshCw className={cn("mr-2 h-4 w-4", dialogsLoading && "animate-spin")} />
            Обновить
          </Button>
          <Button variant="outline" onClick={loadWidget}>
            <MessageCircle className="mr-2 h-4 w-4" />
            Открыть общий виджет Wazzup
          </Button>
          <Button onClick={() => setIsSetupModalOpen(true)}>
            <Settings className="mr-2 h-4 w-4" />
            Настроить Wazzup
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        {CHANNELS.map((channel) => {
          const Icon = channel.icon;
          const isActive = activeChannel === channel.id;
          const channelStatus = getChannelStatus(channel.id);

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
                <Badge
                  className={cn(
                    "shrink-0 border-0",
                    isIntegrationReady ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700",
                  )}
                >
                  {channelStatus}
                </Badge>
              </div>
            </button>
          );
        })}
      </div>

      {!isIntegrationReady && !statusLoading && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Интеграция Wazzup не настроена или выключена. Настройте Wazzup, чтобы получать диалоги в CRM.
        </div>
      )}

      <div className="grid min-h-[620px] gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <section className="flex min-h-[560px] flex-col rounded-xl border bg-white shadow-sm">
          <div className="border-b px-4 py-3">
            <h2 className="font-semibold text-slate-900">{channelLabel[activeChannel]}</h2>
            <p className="text-sm text-slate-500">Диалоги выбранного канала</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {dialogsLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Загрузка диалогов...
              </div>
            ) : dialogs.length === 0 ? (
              <div className="flex h-full items-center justify-center px-4 text-center text-sm text-slate-500">
                Диалоги пока не найдены. Напишите клиенту или дождитесь входящего сообщения.
              </div>
            ) : (
              dialogs.map((dialog) => (
                <button
                  key={dialog.id}
                  type="button"
                  onClick={() => setSelectedDialog(dialog)}
                  className={cn(
                    "mb-2 w-full rounded-lg border p-3 text-left transition",
                    selectedDialog?.id === dialog.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 hover:border-blue-200 hover:bg-slate-50",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-900">
                        {dialog.display_name || dialog.external_chat_id}
                      </div>
                      <div className="truncate text-sm text-slate-500">
                        {dialog.last_message_text || "Нет сообщений"}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-xs text-slate-400">{formatTime(dialog.last_message_at)}</div>
                      {dialog.unread_count > 0 && (
                        <Badge className="mt-1 border-0 bg-blue-600 text-white">{dialog.unread_count}</Badge>
                      )}
                    </div>
                  </div>
                  {(dialog.client_id || dialog.lead_id) && (
                    <div className="mt-2 flex gap-2 text-xs text-slate-500">
                      {dialog.client_id && <span>Клиент #{dialog.client_id}</span>}
                      {dialog.lead_id && <span>Лид #{dialog.lead_id}</span>}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </section>

        <section className="flex min-h-[560px] flex-col rounded-xl border bg-white shadow-sm">
          {showWidget ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div>
                  <h2 className="font-semibold text-slate-900">Общий виджет Wazzup</h2>
                  <p className="text-sm text-slate-500">Fallback для всех подключённых каналов</p>
                </div>
                <Button variant="outline" onClick={() => setShowWidget(false)}>
                  Вернуться к CRM-диалогам
                </Button>
              </div>
              {widgetState === "loading" && (
                <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Загрузка Wazzup...
                </div>
              )}
              {widgetState === "error" && (
                <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-red-600">
                  {widgetError || "Wazzup iframe URL не получен"}
                </div>
              )}
              {widgetState === "ready" && (
                <iframe src={iframeUrl} className="min-h-0 flex-1 border-0" title="Wazzup общий виджет" />
              )}
            </div>
          ) : selectedDialog ? (
            <>
              <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
                <div className="min-w-0">
                  <h2 className="truncate font-semibold text-slate-900">
                    {selectedDialog.display_name || selectedDialog.external_chat_id}
                  </h2>
                  <p className="truncate text-sm text-slate-500">
                    {channelLabel[activeChannel]} · {selectedDialog.external_chat_id}
                  </p>
                </div>
                <Button variant="outline" onClick={loadWidget}>
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Wazzup
                </Button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-4">
                {messagesLoading ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Загрузка сообщений...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    История сообщений пока пуста.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((message) => {
                      const outgoing = message.direction === "outgoing";
                      return (
                        <div key={message.id} className={cn("flex", outgoing ? "justify-end" : "justify-start")}>
                          <div
                            className={cn(
                              "max-w-[78%] rounded-lg px-3 py-2 text-sm shadow-sm",
                              outgoing ? "bg-blue-600 text-white" : "border bg-white text-slate-900",
                            )}
                          >
                            <div className="whitespace-pre-wrap break-words">{message.text || " "}</div>
                            <div className={cn("mt-1 text-[11px]", outgoing ? "text-blue-100" : "text-slate-400")}>
                              {formatTime(message.created_at)} · {message.status}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="border-t p-3">
                <div className="flex gap-2">
                  <Textarea
                    value={messageText}
                    onChange={(event) => setMessageText(event.target.value)}
                    placeholder="Напишите сообщение..."
                    className="min-h-[44px] resize-none"
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        handleSend();
                      }
                    }}
                  />
                  <Button onClick={handleSend} disabled={sendLoading || !messageText.trim()}>
                    {sendLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-slate-500">
              <CheckCircle2 className="mb-3 h-10 w-10 text-slate-300" />
              <p className="text-sm">Выберите диалог слева, чтобы открыть историю сообщений.</p>
            </div>
          )}
        </section>
      </div>

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
