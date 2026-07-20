import { useEffect, useRef } from "react";

/**
 * Подписка на real-time обновления канбан-доски воронки.
 * Сервер шлёт лишь сигнал {type:"board_changed", funnel_id}, по которому
 * вызывается onChange — а доска перечитывается через REST (со своим scope).
 * onChange хранится в ref, чтобы смена его идентичности между рендерами
 * не пересоздавала сокет. Есть простой авто-reconnect для долгих сессий.
 */
export function useBoardSocket(funnelId: number | null, onChange: () => void) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!funnelId) return;
    if (typeof window === "undefined") return;

    const token = localStorage.getItem("auth_token");
    if (!token) return;

    const base = process.env.NEXT_PUBLIC_WS_BASE_URL || "wss://api.kubcrm.kz";
    const url = `${base}/funnels/${funnelId}/board/ws?token=${token}`;

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let closedByCleanup = false;

    const connect = () => {
      ws = new WebSocket(url);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.type === "board_changed") {
            onChangeRef.current();
          }
        } catch {
          /* игнорируем некорректные кадры */
        }
      };

      ws.onclose = () => {
        if (closedByCleanup) return;
        // Долгоживущая сессия доски — переподключаемся через 3с.
        reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        try {
          ws?.close();
        } catch {
          /* no-op */
        }
      };
    };

    connect();

    return () => {
      closedByCleanup = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try {
        ws?.close();
      } catch {
        /* no-op */
      }
    };
  }, [funnelId]);
}

export default useBoardSocket;
