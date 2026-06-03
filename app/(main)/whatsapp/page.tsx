"use client";

import type React from "react";
import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  MessageCircle,
  Send,
  MoreVertical,
  Search,
  Plus,
  Paperclip,
  Smile,
  Users,
  User as UserIcon,
  Trash2,
  LogOut,
  UserPlus,
  MessageSquare,
  Phone,
  Video,
  Clock,
  Check,
  CheckCheck,
  AlertCircle,
  UserCheck,
  ArrowRight,
  Settings,
  RefreshCw,
  XCircle
} from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { ru } from "date-fns/locale";
import { getWazzupIframe, setupWazzup, sendWazzupMessage } from "@/src/api/integrations_wazzup.api";
import { getCurrentUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

// Types for WhatsApp integration
interface WhatsAppDialog {
  id: string;
  phone: string;
  name?: string;
  avatar?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
  isOnline: boolean;
  assignedTo?: string;
  assignedToName?: string;
  leadId?: number;
  clientId?: number;
  dealId?: number;
  status: 'active' | 'archived' | 'blocked';
}

interface WhatsAppMessage {
  id: string;
  text: string;
  timestamp: string;
  isIncoming: boolean;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  attachments?: string[];
  senderName?: string;
}

// Widget state types
type WidgetState = 'loading' | 'ready' | 'error' | 'not_connected' | 'service_unavailable';
type WidgetError = { type: '404' | '502' | 'network' | 'unknown'; message: string };

// Session management constants
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours
const SOFT_REFRESH_DURATION_MS = 7.5 * 60 * 60 * 1000; // 7.5 hours (soft refresh before expiration)

export default function WhatsAppPage() {
  const [selectedDialog, setSelectedDialog] = useState<WhatsAppDialog | null>(null);
  const [message, setMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [iframeUrl, setIframeUrl] = useState<string>("");
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Widget state management
  const [widgetState, setWidgetState] = useState<WidgetState>('loading');
  const [widgetError, setWidgetError] = useState<WidgetError | null>(null);
  const [sessionReceivedAt, setSessionReceivedAt] = useState<number | null>(null);
  const [isManualRefresh, setIsManualRefresh] = useState(false);

  // Setup form state
  const [setupForm, setSetupForm] = useState({
    webhooks_base_url: 'https://api.kubcrm.kz',
    enabled: true
  });
  const [isSetupLoading, setIsSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  // Mock data for dialogs
  const [dialogs, setDialogs] = useState<WhatsAppDialog[]>([]);
  const [dialogsLoading, setDialogsLoading] = useState(false);
  const [dialogsError, setDialogsError] = useState<string | null>(null);

  // Mock messages
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  const currentUser = getCurrentUser();
  const [isChatVisible, setIsChatVisible] = useState(true); // Show chat by default

  // Fetch WhatsApp dialogs
  const fetchDialogs = async () => {
    setDialogsLoading(true);
    setDialogsError(null);
    try {
      // TODO: Replace with actual API call when backend provides dialogs endpoint
      // For now, we'll keep it empty until the backend implements WhatsApp dialog listing
      setDialogs([]);
    } catch (error: any) {
      console.error("Failed to fetch WhatsApp dialogs:", error);
      setDialogsError(error.message || "Не удалось загрузить диалоги WhatsApp");
    } finally {
      setDialogsLoading(false);
    }
  };

  useEffect(() => {
    fetchDialogs();
  }, []);

  // Load widget: fetch iframe URL and manage session
  const loadWidget = useCallback(async () => {
    setWidgetState('loading');
    setWidgetError(null);
    setIsManualRefresh(false);

    try {
      const response = await getWazzupIframe();
      console.log('Wazzup iframe response:', response);
      setIframeUrl(response.iframe_url || response.url);
      setSessionReceivedAt(Date.now());
      setWidgetState('ready');
      console.log('Widget state set to ready, iframe URL:', response.iframe_url || response.url);
    } catch (error: any) {
      console.error("Failed to load Wazzup widget:", error);

      // Handle different error types
      if (error.response?.status === 404) {
        setWidgetError({ type: '404', message: 'Интеграция мессенджера не подключена' });
        setWidgetState('not_connected');
      } else if (error.response?.status === 502 || error.response?.status === 503) {
        setWidgetError({ type: '502', message: 'Мессенджер временно недоступен' });
        setWidgetState('service_unavailable');
      } else if (error.code === 'NETWORK_ERROR' || error.code === 'ECONNABORTED') {
        setWidgetError({ type: 'network', message: 'Ошибка сети. Проверьте подключение к интернету.' });
        setWidgetState('error');
      } else {
        setWidgetError({ type: 'unknown', message: error.message || 'Не удалось загрузить виджет' });
        setWidgetState('error');
      }
    }
  }, []);

  // Refresh widget: re-fetch iframe URL and update iframe
  const refreshWidget = useCallback(async () => {
    setIsManualRefresh(true);
    await loadWidget();
  }, [loadWidget]);

  // Load widget when component mounts
  useEffect(() => {
    loadWidget();
  }, [loadWidget]);

  // Auto-refresh before session expiration (soft refresh at 7.5 hours)
  useEffect(() => {
    if (!sessionReceivedAt || widgetState !== 'ready') return;

    const timeUntilSoftRefresh = SOFT_REFRESH_DURATION_MS - (Date.now() - sessionReceivedAt);

    if (timeUntilSoftRefresh <= 0) {
      // Session already expired, refresh immediately
      refreshWidget();
      return;
    }

    const timer = setTimeout(() => {
      console.log('Soft refresh: session approaching expiration');
      refreshWidget();
    }, timeUntilSoftRefresh);

    return () => clearTimeout(timer);
  }, [sessionReceivedAt, widgetState, refreshWidget]);

  // Handle iframe load errors
  const handleIframeError = useCallback(() => {
    console.error('Iframe loading error detected');
    // Attempt to refresh the widget
    refreshWidget();
  }, [refreshWidget]);

  const loadWhatsAppChat = async (dialog: WhatsAppDialog) => {
    // This function is now deprecated - we use loadWidget instead
    // which doesn't require dialog-specific parameters per spec
    await loadWidget();
  };

  // Handle setup form submission
  const handleSetup = async () => {
    setIsSetupLoading(true);
    setSetupError(null);

    try {
      const response = await setupWazzup(setupForm);
      console.log('Wazzup setup successful:', response);
      setIsSetupModalOpen(false);

      // Force widget reload with a small delay to ensure backend has processed
      setTimeout(async () => {
        await loadWidget();
      }, 500);
    } catch (error: any) {
      console.error('Failed to setup Wazzup:', error);
      setSetupError(error.message || 'Не удалось настроить интеграцию');
    } finally {
      setIsSetupLoading(false);
    }
  };

  useEffect(() => {
    // Load widget when component mounts or when selectedDialog changes
    loadWidget();
  }, [loadWidget]);

  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return "";
    return timestamp;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <Check className="h-3 w-3 text-gray-400" />;
      case 'delivered':
        return <CheckCheck className="h-3 w-3 text-gray-400" />;
      case 'read':
        return <CheckCheck className="h-3 w-3 text-blue-500" />;
      case 'failed':
        return <AlertCircle className="h-3 w-3 text-red-500" />;
      default:
        return <Clock className="h-3 w-3 text-gray-400" />;
    }
  };

  const filteredDialogs = dialogs.filter((dialog) =>
    dialog.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dialog.phone.includes(searchTerm.replace(/\s/g, ''))
  );

  const handleAssignDialog = (userId: string) => {
    if (selectedDialog) {
      setDialogs(prev => prev.map(d => 
        d.id === selectedDialog.id 
          ? { ...d, assignedTo: userId, assignedToName: `Менеджер ${userId}` }
          : d
      ));
      setIsAssignModalOpen(false);
      // TODO: Call API to update assignment in backend
    }
  };

  const navigateToCRM = (type: 'lead' | 'client' | 'deal', id: number) => {
    const path = `/${type}s/${id}`;
    window.open(path, '_blank');
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !selectedDialog) return;

    try {
      await sendWazzupMessage(selectedDialog.phone, message);
      setMessage("");
      // Optionally add the message to local state for immediate feedback
      // The actual message will appear in the iframe
    } catch (error) {
      console.error("Failed to send message:", error);
      // Show error to user
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex h-screen">
      {/* Dialog List - completely hidden for Wazzup since iframe shows dialogs internally */}
      <div className="hidden">
      </div>

      {/* Chat Area */}
      <div className="flex flex-1 flex-col">
        {/* Always show widget when ready, or show placeholder when not */}
        {widgetState === 'ready' || widgetState === 'loading' || widgetState === 'error' || widgetState === 'not_connected' || widgetState === 'service_unavailable' ? (
          <>
            {/* Chat Header */}
            <div className="p-4 bg-white border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsChatVisible(false)}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                  </Button>
                  <div className="relative">
                    <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                      <MessageCircle className="h-5 w-5 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-medium">Мессенджер</h3>
                    <p className="text-sm text-gray-600">
                      {widgetState === 'ready' ? 'Подключено' : 'Загрузка...'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {/* Manual refresh button */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={refreshWidget}
                    title="Обновить мессенджер"
                  >
                    <RefreshCw className={`h-4 w-4 ${isManualRefresh ? 'animate-spin' : ''}`} />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setIsSetupModalOpen(true)}>
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Messages or Iframe */}
            <div className="flex-1 bg-gray-50">
              {widgetState === 'loading' && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <RefreshCw className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-4" />
                    <p className="text-gray-600">Загрузка мессенджера...</p>
                  </div>
                </div>
              )}

              {widgetState === 'ready' && (
                <iframe
                  src={iframeUrl}
                  className="w-full h-full border-0"
                  title="Мессенджер"
                  onError={handleIframeError}
                />
              )}

              {widgetState === 'not_connected' && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center max-w-md">
                    <XCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Интеграция не подключена
                    </h3>
                    <p className="text-gray-600 mb-4">
                      {widgetError?.message || 'Интеграция мессенджера не настроена'}
                    </p>
                    <div className="flex gap-2 justify-center">
                      <Button
                        variant="outline"
                        onClick={() => setIsSetupModalOpen(true)}
                      >
                        Настроить интеграцию
                      </Button>
                      <Button
                        onClick={refreshWidget}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Попробовать снова
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {widgetState === 'service_unavailable' && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center max-w-md">
                    <AlertCircle className="h-12 w-12 text-orange-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Сервис временно недоступен
                    </h3>
                    <p className="text-gray-600 mb-4">
                      {widgetError?.message || 'Мессенджер временно недоступен'}
                    </p>
                    <Button
                      onClick={refreshWidget}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Повторить
                    </Button>
                  </div>
                </div>
              )}

              {widgetState === 'error' && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center max-w-md">
                    <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Ошибка загрузки
                    </h3>
                    <p className="text-gray-600 mb-4">
                      {widgetError?.message || 'Не удалось загрузить виджет'}
                    </p>
                    <Button
                      onClick={refreshWidget}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Повторить
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Интеграция мессенджера
              </h3>
              <p className="text-gray-600">
                Загрузка...
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Assign Dialog Modal */}
      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Назначить ответственного</DialogTitle>
            <DialogDescription>
              Выберите менеджера, который будет отвечать за этот диалог
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            {['user1', 'user2', 'user3'].map(userId => (
              <div key={userId} className="flex items-center space-x-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
                   onClick={() => handleAssignDialog(userId)}>
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    {userId.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">Менеджер {userId}</p>
                  <p className="text-sm text-gray-500">user{userId}@example.com</p>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Отмена</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Setup Modal */}
      <Dialog open={isSetupModalOpen} onOpenChange={setIsSetupModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Настройка интеграции мессенджера</DialogTitle>
            <DialogDescription>
              Настройте подключение к мессенджеру
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {setupError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {setupError}
              </div>
            )}
            <div>
              <Label htmlFor="webhook-url">Webhook Base URL</Label>
              <Input
                id="webhook-url"
                placeholder="https://api.kubcrm.kz"
                value={setupForm.webhooks_base_url}
                onChange={(e) => setSetupForm({ ...setupForm, webhooks_base_url: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">
                Базовый URL для вебхуков (без пути к вебхуку)
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="enabled"
                checked={setupForm.enabled}
                onChange={(e) => setSetupForm({ ...setupForm, enabled: e.target.checked })}
                className="w-4 h-4"
              />
              <Label htmlFor="enabled" className="cursor-pointer">
                Включить интеграцию
              </Label>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" disabled={isSetupLoading}>Отмена</Button>
            </DialogClose>
            <Button onClick={handleSetup} disabled={isSetupLoading}>
              {isSetupLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Настройка...
                </>
              ) : (
                'Сохранить настройки'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
