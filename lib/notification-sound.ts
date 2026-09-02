// Единый генератор звуковых сигналов уведомлений (Web Audio API, без
// аудиофайлов — работает офлайн, ничего не грузим). Разные типы событий —
// разный тон, чтобы их можно было различить на слух.

export type NotificationSoundType =
  | "lead"
  | "chat"
  | "messenger"
  | "task"
  | "feed"
  | "default";

// Частоты (Гц) и «мелодия»: массив = последовательность коротких бипов.
const TONES: Record<NotificationSoundType, number[]> = {
  lead: [988, 1319], // восходящий — «пришёл новый лид»
  chat: [660], // короткий средний
  messenger: [784], // чуть выше, отличимый от чата
  task: [880, 880], // два одинаковых — как было у задач
  feed: [1047, 784], // нисходящий — «новое в Ленте на одобрение»
  default: [880],
};

let sharedCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return null;
    if (!sharedCtx) sharedCtx = new Ctx();
    return sharedCtx;
  } catch {
    return null;
  }
}

// Разблокировка звука после первого жеста пользователя (autoplay policy).
export function unlockNotificationSound() {
  const ctx = getCtx();
  if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
}

export function playNotificationSound(type: NotificationSoundType = "default") {
  try {
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const freqs = TONES[type] || TONES.default;
    const step = 0.18;
    freqs.forEach((freq, i) => {
      const delay = i * step;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.001, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.18);
    });
  } catch {
    // autoplay policy может блокировать звук до первого жеста — молча игнорируем
  }
}
