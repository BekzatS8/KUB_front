"use client"

import { useState } from "react"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
    MessageSquare,
    Bot,
    Send,
    Check,
    Loader2,
    AlertTriangle,
    Clock,
    ArrowRight,
    Terminal,
    Bell,
    CheckCircle2,
    XCircle,
    RefreshCw,
    ExternalLink,
    Zap,
    ListChecks,
    HelpCircle,
    Link2,
    ShieldCheck,
} from "lucide-react"
import { toast } from "sonner"
import {
    request_telegram_link,
    telegram_webhook,
    confirm_telegram_link,
} from "@/src/api/integrations_telegram.api"

// ─── Types ───────────────────────────────────────────────────────

type LinkingStep = 0 | 1 | 2 | 3 // 0=idle, 1=requested, 2=sent /start, 3=linked

interface LinkState {
    step: LinkingStep
    loading: boolean
    code: string
    username: string | null
    error: string | null
}

// ─── Main Page ───────────────────────────────────────────────────

export default function TelegramBotPage() {
    const [state, setState] = useState<LinkState>({
        step: 0,
        loading: false,
        code: "",
        username: null,
        error: null,
    })

    // ─── Step 1: Request link ────────────────────────────────────

    const handleRequestLink = async () => {
        setState((s) => ({ ...s, loading: true, error: null }))
        try {
            await request_telegram_link()
            toast.success("Система готова к привязке")
            setState((s) => ({ ...s, step: 1, loading: false }))
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.message || "Ошибка запроса"
            toast.error(msg)
            setState((s) => ({ ...s, loading: false, error: msg }))
        }
    }

    // ─── Step 2: Simulate webhook /start ─────────────────────────

    const handleSimulateStart = async () => {
        setState((s) => ({ ...s, loading: true, error: null }))
        try {
            await telegram_webhook({
                update_id: Date.now(),
                message: {
                    chat: { id: Date.now() },
                    text: "/start",
                },
            })
            toast.success("Команда /start отправлена боту")
            setState((s) => ({ ...s, step: 2, loading: false }))
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.message || "Ошибка отправки"
            toast.error(msg)
            setState((s) => ({ ...s, loading: false, error: msg }))
        }
    }

    // ─── Step 3: Confirm link with code ──────────────────────────

    const handleConfirmCode = async () => {
        if (!state.code.trim()) {
            toast.error("Введите код привязки")
            return
        }
        setState((s) => ({ ...s, loading: true, error: null }))
        try {
            const res = await confirm_telegram_link(undefined, { code: state.code.trim() })
            const username = res?.username || res?.telegram_username || res?.data?.username || null
            toast.success("Аккаунт Telegram успешно привязан!")
            setState((s) => ({
                ...s,
                step: 3,
                loading: false,
                username: username ? `@${username.replace(/^@/, "")}` : "Привязан",
                error: null,
            }))
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.message || "Неверный или просроченный код"
            toast.error(msg)
            setState((s) => ({
                ...s,
                loading: false,
                error: "Код не принят. Попробуйте запросить новый, отправив /start боту.",
            }))
        }
    }

    // ─── Reset ───────────────────────────────────────────────────

    const handleReset = () => {
        setState({
            step: 0,
            loading: false,
            code: "",
            username: null,
            error: null,
        })
    }

    // ─── Step indicator ──────────────────────────────────────────

    const steps = [
        { label: "Запрос", icon: Link2 },
        { label: "/start", icon: Send },
        { label: "Код", icon: Terminal },
        { label: "Готово", icon: CheckCircle2 },
    ]

    return (
        <>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between m-6 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center">
                            <Send className="h-5 w-5 text-white" />
                        </div>
                        Telegram Бот
                    </h1>
                    <p className="text-gray-600 mt-1">Интеграция CRM с Telegram для уведомлений и управления задачами</p>
                </div>
                {state.step === 3 && (
                    <Badge className="bg-green-100 text-green-800 text-sm px-3 py-1.5 gap-1.5">
                        <CheckCircle2 className="h-4 w-4" />
                        Подключено: {state.username}
                    </Badge>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mx-6 mb-6">
                {/* ── LEFT: Linking Wizard ─────────────────────────────── */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Zap className="h-5 w-5 text-blue-500" />
                                Привязка аккаунта
                            </CardTitle>
                            <CardDescription>
                                Пошаговое подключение вашего Telegram-аккаунта к CRM
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {/* Steps indicator */}
                            <div className="flex items-center justify-between mb-8">
                                {steps.map((s, i) => (
                                    <div key={i} className="flex items-center flex-1">
                                        <div className="flex flex-col items-center gap-1.5">
                                            <div
                                                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300 ${state.step > i
                                                        ? "bg-green-500 text-white shadow-md shadow-green-200"
                                                        : state.step === i
                                                            ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                                                            : "bg-gray-100 text-gray-400"
                                                    }`}
                                            >
                                                {state.step > i ? (
                                                    <Check className="h-5 w-5" />
                                                ) : (
                                                    <s.icon className="h-4 w-4" />
                                                )}
                                            </div>
                                            <span
                                                className={`text-xs font-medium ${state.step >= i ? "text-gray-700" : "text-gray-400"
                                                    }`}
                                            >
                                                {s.label}
                                            </span>
                                        </div>
                                        {i < steps.length - 1 && (
                                            <div
                                                className={`flex-1 h-0.5 mx-2 mt-[-20px] transition-colors duration-300 ${state.step > i ? "bg-green-400" : "bg-gray-200"
                                                    }`}
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Step 0: Start */}
                            {state.step === 0 && (
                                <div className="space-y-4">
                                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                                        <div className="flex items-start gap-3">
                                            <Bot className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                                            <div>
                                                <p className="font-medium text-sm text-blue-900">
                                                    Начните подключение
                                                </p>
                                                <p className="text-xs text-blue-700 mt-1">
                                                    Нажмите кнопку ниже, чтобы подготовить систему к привязке
                                                    вашего Telegram-аккаунта. После этого вам потребуется
                                                    открыть чат с ботом.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <Button
                                        onClick={handleRequestLink}
                                        disabled={state.loading}
                                        className="w-full h-11"
                                    >
                                        {state.loading ? (
                                            <>
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                Подготовка...
                                            </>
                                        ) : (
                                            <>
                                                <ArrowRight className="h-4 w-4 mr-2" />
                                                Начать подключение
                                            </>
                                        )}
                                    </Button>
                                </div>
                            )}

                            {/* Step 1: Send /start */}
                            {state.step === 1 && (
                                <div className="space-y-4">
                                    <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                                        <div className="flex items-start gap-3">
                                            <MessageSquare className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
                                            <div>
                                                <p className="font-medium text-sm text-yellow-900">
                                                    Отправьте команду боту
                                                </p>
                                                <p className="text-xs text-yellow-700 mt-1">
                                                    Откройте чат с нашим Telegram-ботом и отправьте команду{" "}
                                                    <code className="bg-yellow-200 px-1.5 py-0.5 rounded font-mono text-yellow-900">
                                                        /start
                                                    </code>
                                                    . Бот выдаст вам код привязки.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            onClick={() => setState((s) => ({ ...s, step: 2 }))}
                                            className="flex-1"
                                        >
                                            Я уже отправил /start
                                            <ArrowRight className="h-4 w-4 ml-2" />
                                        </Button>
                                    </div>

                                    <div className="border-t pt-4">
                                        <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                                            <Terminal className="h-3 w-3" />
                                            Для тестирования/симуляции:
                                        </p>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={handleSimulateStart}
                                            disabled={state.loading}
                                        >
                                            {state.loading ? (
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            ) : (
                                                <Send className="h-4 w-4 mr-2" />
                                            )}
                                            Симулировать /start (webhook)
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Step 2: Enter code */}
                            {state.step === 2 && (
                                <div className="space-y-4">
                                    <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                                        <div className="flex items-start gap-3">
                                            <Clock className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />
                                            <div>
                                                <p className="font-medium text-sm text-orange-900">
                                                    Введите код привязки
                                                </p>
                                                <p className="text-xs text-orange-700 mt-1">
                                                    Бот отправил вам код в чат. Введите его ниже.
                                                    <br />
                                                    <strong>Внимание:</strong> код действителен только{" "}
                                                    <strong>30 минут</strong>.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Код привязки</Label>
                                        <Input
                                            placeholder="Введите код из Telegram..."
                                            value={state.code}
                                            onChange={(e) =>
                                                setState((s) => ({ ...s, code: e.target.value, error: null }))
                                            }
                                            className="text-center text-lg tracking-widest font-mono h-12"
                                        />
                                    </div>

                                    {state.error && (
                                        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                                            <div className="flex items-start gap-2">
                                                <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                                                <div>
                                                    <p className="text-xs text-red-700">{state.error}</p>
                                                    <p className="text-xs text-red-600 mt-1">
                                                        Запросите новый код, отправив{" "}
                                                        <code className="bg-red-200 px-1 rounded font-mono">/start</code>{" "}
                                                        боту.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <Button
                                        onClick={handleConfirmCode}
                                        disabled={state.loading || !state.code.trim()}
                                        className="w-full h-11"
                                    >
                                        {state.loading ? (
                                            <>
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                Проверка...
                                            </>
                                        ) : (
                                            <>
                                                <ShieldCheck className="h-4 w-4 mr-2" />
                                                Подтвердить
                                            </>
                                        )}
                                    </Button>
                                </div>
                            )}

                            {/* Step 3: Success */}
                            {state.step === 3 && (
                                <div className="space-y-4">
                                    <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-center">
                                        <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
                                        <p className="font-semibold text-green-900 text-lg">
                                            Аккаунт привязан!
                                        </p>
                                        {state.username && (
                                            <p className="text-sm text-green-700 mt-1">
                                                Telegram: <strong>{state.username}</strong>
                                            </p>
                                        )}
                                        <p className="text-xs text-green-600 mt-3">
                                            Теперь вы будете получать уведомления о задачах и сделках
                                            прямо в Telegram.
                                        </p>
                                    </div>
                                    <Button
                                        variant="outline"
                                        onClick={handleReset}
                                        className="w-full"
                                    >
                                        <RefreshCw className="h-4 w-4 mr-2" />
                                        Привязать другой аккаунт
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Warning Card */}
                    {state.step !== 3 && (
                        <Card className="border-amber-200 bg-amber-50/50">
                            <CardContent className="p-4">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="font-medium text-sm text-amber-900">
                                            Важная информация
                                        </p>
                                        <ul className="text-xs text-amber-700 mt-1 space-y-1">
                                            <li>• Код привязки действителен <strong>30 минут</strong></li>
                                            <li>• Если код не принят — отправьте <code className="bg-amber-200 px-1 rounded font-mono">/start</code> боту для получения нового</li>
                                            <li>• Один Telegram-аккаунт привязывается к одному пользователю CRM</li>
                                        </ul>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* ── RIGHT: Instructions ──────────────────────────────── */}
                <div className="space-y-6">
                    {/* Why you need this */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Bell className="h-5 w-5 text-blue-500" />
                                Зачем это нужно?
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                                        <Bell className="h-4 w-4 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">Уведомления о задачах</p>
                                        <p className="text-xs text-gray-500">
                                            Получайте мгновенные уведомления о новых задачах, изменениях статусов и приближающихся дедлайнах.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                                    <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                                        <Clock className="h-4 w-4 text-green-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">Проверка дедлайнов</p>
                                        <p className="text-xs text-gray-500">
                                            Быстро проверяйте сроки по задачам без необходимости открывать CRM в браузере.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                                    <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                                        <ListChecks className="h-4 w-4 text-purple-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">Работа с задачами</p>
                                        <p className="text-xs text-gray-500">
                                            Управляйте задачами прямо из Telegram — просматривайте список, получайте детали.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Bot commands */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Terminal className="h-5 w-5 text-gray-700" />
                                Основные команды бота
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <div className="flex items-center gap-3 p-3 rounded-lg border bg-white">
                                    <code className="bg-gray-900 text-green-400 px-3 py-1.5 rounded-lg text-sm font-mono font-medium whitespace-nowrap">
                                        /start
                                    </code>
                                    <p className="text-sm text-gray-600">
                                        Получение кода привязки аккаунта
                                    </p>
                                </div>
                                <div className="flex items-center gap-3 p-3 rounded-lg border bg-white">
                                    <code className="bg-gray-900 text-green-400 px-3 py-1.5 rounded-lg text-sm font-mono font-medium whitespace-nowrap">
                                        /tasks
                                    </code>
                                    <p className="text-sm text-gray-600">
                                        Список ваших актуальных задач
                                    </p>
                                </div>
                                <div className="flex items-center gap-3 p-3 rounded-lg border bg-white">
                                    <code className="bg-gray-900 text-green-400 px-3 py-1.5 rounded-lg text-sm font-mono font-medium whitespace-nowrap">
                                        /help
                                    </code>
                                    <p className="text-sm text-gray-600">
                                        Справка по всем командам бота
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Notification labels */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <HelpCircle className="h-5 w-5 text-gray-700" />
                                Как читать уведомления
                            </CardTitle>
                            <CardDescription>
                                Каждое уведомление содержит метки для быстрой навигации
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <Badge className="bg-blue-100 text-blue-800 text-xs shrink-0">
                                        new
                                    </Badge>
                                    <p className="text-sm text-gray-600">
                                        <strong>Статус</strong> — текущий статус задачи (new, in_progress, done)
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Badge className="bg-red-100 text-red-800 text-xs shrink-0">
                                        high
                                    </Badge>
                                    <p className="text-sm text-gray-600">
                                        <strong>Приоритет</strong> — уровень важности (low, medium, high)
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Badge className="bg-orange-100 text-orange-800 text-xs shrink-0">
                                        просрочено
                                    </Badge>
                                    <p className="text-sm text-gray-600">
                                        <strong>Дедлайн</strong> — задача просрочена, требует внимания
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Badge className="bg-purple-100 text-purple-800 text-xs shrink-0">
                                        deal#42
                                    </Badge>
                                    <p className="text-sm text-gray-600">
                                        <strong>Сделка</strong> — связь задачи с конкретной сделкой в CRM
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    )
}
