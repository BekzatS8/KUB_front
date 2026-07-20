"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent, type MouseEvent } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { snapCenterToCursor } from "@dnd-kit/modifiers";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Building2, User, RefreshCw, Pencil, Archive, Trash2, MessageCircle, Phone } from "lucide-react";
import * as FunnelStagesAPI from "@/src/api/funnel-stages.api";
import { move_deal_stage } from "@/src/api/deals.api";
import { move_lead_stage } from "@/src/api/leads.api";
import { useBoardSocket } from "@/hooks/useBoardSocket";
import type {
  FunnelBoard,
  FunnelBoardColumn,
  FunnelBoardDeal,
} from "@/src/models/funnel-stages.model";

const STATUS_LABELS: Record<string, string> = {
  new: "Новая",
  in_progress: "В работе",
  negotiation: "Переговоры",
  won: "Выиграна",
  lost: "Проиграна",
  cancelled: "Отменена",
};

const LEAD_STATUS_LABELS: Record<string, string> = {
  new: "Новый лид",
  in_progress: "Лид в работе",
  confirmed: "Лид подтверждён",
  cancelled: "Отказ",
};

const LEAD_SOURCE_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  instagram: "Instagram",
};

const STATUS_CLASSNAMES: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  negotiation: "bg-purple-100 text-purple-800",
  won: "bg-green-100 text-green-800",
  lost: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-800",
};

function formatAmount(amount: number, currency?: string) {
  const value = Number(amount || 0).toLocaleString("ru-RU");
  return currency ? `${value} ${currency}` : value;
}

interface DealActions {
  onEdit?: (deal: FunnelBoardDeal) => void;
  onArchive?: (deal: FunnelBoardDeal) => void;
  onDelete?: (deal: FunnelBoardDeal) => void;
  canWrite?: boolean;
  isSales?: boolean;
  isAdmin?: boolean;
}

interface DealCardProps extends DealActions {
  deal: FunnelBoardDeal;
  onClick?: (deal: FunnelBoardDeal) => void;
  disabled?: boolean;
}

function DealCard({
  deal,
  onClick,
  disabled,
  overlay,
  onEdit,
  onArchive,
  onDelete,
  canWrite,
  isSales,
  isAdmin,
}: DealCardProps & { overlay?: boolean }) {
  const isLead = deal.kind === "lead";
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${isLead ? "lead" : "deal"}-${deal.id}`,
    disabled,
  });

  // Lead cards are managed from the lead view — no deal edit/archive actions.
  const showEdit = !overlay && !isLead && canWrite && onEdit;
  const showArchive = !overlay && !isLead && canWrite && !isSales && onArchive;
  const showDelete = !overlay && !isLead && isAdmin && onDelete;
  const hasActions = showEdit || showArchive || showDelete;

  // Prevent drag/card-click from firing when interacting with action buttons.
  const stop = (e: PointerEvent | MouseEvent) => e.stopPropagation();

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onClick?.(deal)}
      className={cn(
        "group relative rounded-lg border bg-white p-3 shadow-sm select-none transition-all",
        overlay
          ? "shadow-xl ring-2 ring-blue-500 ring-offset-1 rotate-1 cursor-move scale-105"
          : "cursor-move hover:shadow-md hover:ring-2 hover:ring-blue-300 hover:ring-offset-1",
        isDragging && !overlay && "opacity-25 border-dashed border-blue-300"
      )}
    >
      {hasActions && (
        <div
          className="absolute right-1.5 top-1.5 z-10 flex gap-0.5 rounded-md border bg-white/95 p-0.5 opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
          onPointerDown={stop}
          onClick={stop}
        >
          {showEdit && (
            <button
              type="button"
              title="Редактировать"
              className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              onClick={() => onEdit!(deal)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {showArchive && (
            <button
              type="button"
              title="Архивировать"
              className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              onClick={() => onArchive!(deal)}
            >
              <Archive className="h-3.5 w-3.5" />
            </button>
          )}
          {showDelete && (
            <button
              type="button"
              title="Удалить"
              className="rounded p-1 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => onDelete!(deal)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-mono text-gray-400">#{deal.id}</span>
        {isLead ? (
          <Badge className="text-xs bg-amber-100 text-amber-800">
            {LEAD_STATUS_LABELS[deal.status] || "Лид"}
          </Badge>
        ) : (
          <Badge className={cn("text-xs", STATUS_CLASSNAMES[deal.status] || "bg-gray-100 text-gray-800")}>
            {STATUS_LABELS[deal.status] || deal.status}
          </Badge>
        )}
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-sm font-medium text-gray-900">
        {isLead ? (
          <MessageCircle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
        ) : (
          <Building2 className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        )}
        <span className="truncate">
          {deal.client_name || (isLead ? `Лид #${deal.id}` : `Клиент #${deal.client_id}`)}
        </span>
      </div>
      {isLead ? (
        <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-600">
          {deal.phone && (
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3 w-3 shrink-0 text-gray-400" />
              +{deal.phone}
            </span>
          )}
          {deal.source && (
            <span className="text-gray-400">
              {LEAD_SOURCE_LABELS[deal.source] || deal.source}
            </span>
          )}
        </div>
      ) : (
        <div className="mt-1 text-sm font-semibold text-gray-800">
          {formatAmount(deal.amount, deal.currency)}
        </div>
      )}
      {deal.owner_name ? (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-500">
          <User className="h-3 w-3 shrink-0" />
          <span className="truncate">{deal.owner_name}</span>
        </div>
      ) : (
        isLead && (
          <div className="mt-1.5 text-xs font-medium text-amber-600">
            Не разобран — перетащите, чтобы взять в работу
          </div>
        )
      )}
    </div>
  );
}

interface ColumnProps extends DealActions {
  column: FunnelBoardColumn;
  onDealClick?: (deal: FunnelBoardDeal) => void;
  canMove: boolean;
}

function Column({ column, onDealClick, canMove, ...actions }: ColumnProps) {
  const stage = column.stage;
  const droppableId = stage ? `stage-${stage.id}` : "stage-none";
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    disabled: !canMove || !stage,
  });

  const color = stage?.color || "#94a3b8";

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-lg border bg-gray-50">
      <div
        className="sticky top-0 z-10 rounded-t-lg border-b bg-gray-50 px-3 py-2"
        style={{ borderTopColor: color, borderTopWidth: 3 }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="truncate text-sm font-semibold text-gray-900">
              {stage ? stage.name : "Без этапа"}
            </span>
          </div>
          <Badge variant="outline" className="text-xs shrink-0">
            {column.count}
          </Badge>
        </div>
        <div className="mt-1 text-xs text-gray-500">
          {formatAmount(column.total_amount)}
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-col gap-2 p-2 transition-colors min-h-[120px]",
          isOver && "bg-blue-50"
        )}
      >
        {column.deals.length === 0 ? (
          <div className="py-6 text-center text-xs text-gray-400">Нет сделок</div>
        ) : (
          column.deals.map((deal) => (
            <DealCard
              key={`${deal.kind || "deal"}-${deal.id}`}
              deal={deal}
              onClick={onDealClick}
              disabled={!canMove}
              {...actions}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface KanbanBoardProps extends DealActions {
  funnelId: number;
  canMove?: boolean;
  onDealClick?: (deal: FunnelBoardDeal) => void;
  refreshKey?: number;
}

export function KanbanBoard({
  funnelId,
  canMove = true,
  onDealClick,
  refreshKey,
  ...actions
}: KanbanBoardProps) {
  const [board, setBoard] = useState<FunnelBoard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeDeal, setActiveDeal] = useState<FunnelBoardDeal | null>(null);

  // Горизонтальный скролл воронки: у высоких колонок нижняя полоса прокрутки
  // «уезжает» вниз, и до неё приходится листать страницу. Дублируем полосу
  // сверху и держим её синхронной с доской, чтобы этапы справа были доступны
  // без прокрутки вниз (обратная связь от заказчика 10.07.2026).
  const boardRef = useRef<HTMLDivElement | null>(null);
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollWidth, setScrollWidth] = useState(0);
  const [clientWidth, setClientWidth] = useState(0);

  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const measure = () => {
      setScrollWidth(el.scrollWidth);
      setClientWidth(el.clientWidth);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [board]);

  const syncFromTop = () => {
    if (boardRef.current && topScrollRef.current) {
      boardRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  };
  const syncFromBoard = () => {
    if (boardRef.current && topScrollRef.current) {
      topScrollRef.current.scrollLeft = boardRef.current.scrollLeft;
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const loadBoard = async () => {
    setIsLoading(true);
    try {
      const data = await FunnelStagesAPI.getFunnelBoard(funnelId);
      setBoard(data);
    } catch (err: any) {
      console.error("Error loading funnel board:", err);
      toast.error("Ошибка при загрузке воронки");
    } finally {
      setIsLoading(false);
    }
  };

  // Тихое фоновое обновление доски — без спиннера и без тоста, чтобы не
  // мигало при поллинге/возврате фокуса. Используется для «живого» режима.
  const refreshBoard = async () => {
    if (!funnelId) return;
    try {
      const data = await FunnelStagesAPI.getFunnelBoard(funnelId);
      setBoard(data);
    } catch (err) {
      console.error("Error refreshing funnel board:", err);
    }
  };

  // Первичная загрузка и смена воронки — со скелетоном (это действительно
  // полная перезагрузка контента).
  useEffect(() => {
    if (funnelId) {
      loadBoard();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [funnelId]);

  // Обновления, инициированные родителем (перенос через модалку, архивация,
  // изменения на детальной странице) — тихо, без скелетона, чтобы доска не
  // мигала и перенос ощущался моментальным.
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return; // не дублируем первичную загрузку
    }
    if (funnelId) {
      refreshBoard();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  // «Живой» режим доски. Основной канал — WebSocket (см. useBoardSocket ниже):
  // когда другой менеджер двигает/архивирует карточку в этой воронке, сервер
  // шлёт сигнал, и доска перечитывается моментально. Слушатели фокуса/
  // видимости и поллинг (30с) остаются страховкой на случай обрыва сокета.
  const activeDealRef = useRef<FunnelBoardDeal | null>(null);
  activeDealRef.current = activeDeal;

  const maybeRefreshRef = useRef<() => void>(() => {});
  maybeRefreshRef.current = () => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    if (activeDealRef.current) return; // не мешаем перетаскиванию
    refreshBoard();
  };

  // Real-time через WebSocket: по сигналу «board_changed» перечитываем доску
  // (лёгкий дебаунс, чтобы серия переносов не вызвала шквал запросов).
  const wsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useBoardSocket(funnelId || null, () => {
    if (wsDebounceRef.current) clearTimeout(wsDebounceRef.current);
    wsDebounceRef.current = setTimeout(() => maybeRefreshRef.current(), 250);
  });

  useEffect(() => {
    if (!funnelId) return;

    const maybeRefresh = () => maybeRefreshRef.current();

    const onVisibility = () => maybeRefresh();
    const onFocus = () => maybeRefresh();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    const interval = window.setInterval(maybeRefresh, 30000);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [funnelId]);

  const allDeals = useMemo(
    () => board?.columns.flatMap((c) => c.deals) || [],
    [board]
  );

  // Card drag ids are "deal-X" / "lead-X"; parse back to kind + numeric id.
  const parseCardId = (raw: string): { kind: "deal" | "lead"; id: number } | null => {
    const m = raw.match(/^(deal|lead)-(\d+)$/);
    if (!m) return null;
    return { kind: m[1] as "deal" | "lead", id: Number(m[2]) };
  };

  const matchCard = (d: FunnelBoardDeal, kind: string, id: number) =>
    (d.kind || "deal") === kind && d.id === id;

  const handleDragStart = (event: DragStartEvent) => {
    const parsed = parseCardId(String(event.active.id));
    const deal = parsed ? allDeals.find((d) => matchCard(d, parsed.kind, parsed.id)) || null : null;
    setActiveDeal(deal);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDeal(null);
    if (!over || !board) return;

    const parsed = parseCardId(String(active.id));
    if (!parsed) return;
    const overId = String(over.id);

    // over can be either the column droppable ("stage-X") or another card
    // ("deal-X"/"lead-X") when the card is on top of the column's droppable
    // area. In both cases we resolve the target stage.
    let targetStageId: number | null = null;
    if (overId.startsWith("stage-") && overId !== "stage-none") {
      targetStageId = Number(overId.replace("stage-", ""));
    } else {
      const overParsed = parseCardId(overId);
      if (overParsed) {
        const overColumn = board.columns.find((c) =>
          c.deals.some((d) => matchCard(d, overParsed.kind, overParsed.id))
        );
        if (overColumn?.stage) targetStageId = overColumn.stage.id;
      }
    }

    if (!targetStageId) return;

    const sourceColumn = board.columns.find((c) =>
      c.deals.some((d) => matchCard(d, parsed.kind, parsed.id))
    );
    const deal = sourceColumn?.deals.find((d) => matchCard(d, parsed.kind, parsed.id));
    if (!deal || !sourceColumn) return;
    if (sourceColumn.stage?.id === targetStageId) return;

    const targetColumn = board.columns.find((c) => c.stage?.id === targetStageId);
    if (!targetColumn) return;

    // Derive the status the server will assign so the optimistic card badge is correct.
    let optimisticStatus = deal.status;
    if (targetColumn.stage) {
      const s = targetColumn.stage;
      if (parsed.kind === "lead") {
        optimisticStatus = s.type === "lost" ? "cancelled" : deal.status === "new" ? "in_progress" : deal.status;
      } else if (s.type === "won") {
        optimisticStatus = "won";
      } else if (s.type === "lost") {
        optimisticStatus = "lost";
      } else if (["new", "in_progress", "negotiation", "won", "lost", "cancelled"].includes(s.code)) {
        optimisticStatus = s.code;
      } else {
        optimisticStatus = "in_progress";
      }
    }

    // Optimistic move
    const previousBoard = board;
    const optimisticDeal: FunnelBoardDeal = { ...deal, stage_id: targetStageId, status: optimisticStatus };
    const newColumns = board.columns.map((col) => {
      if (col === sourceColumn) {
        const deals = col.deals.filter((d) => !matchCard(d, parsed.kind, parsed.id));
        return { ...col, deals, count: deals.length, total_amount: deals.reduce((s, d) => s + Number(d.amount || 0), 0) };
      }
      if (col === targetColumn) {
        const deals = [...col.deals, optimisticDeal];
        return { ...col, deals, count: deals.length, total_amount: deals.reduce((s, d) => s + Number(d.amount || 0), 0) };
      }
      return col;
    });
    setBoard({ ...board, columns: newColumns });

    const moveRequest =
      parsed.kind === "lead"
        ? move_lead_stage({ stage_id: targetStageId }, { id: parsed.id })
        : move_deal_stage({ stage_id: targetStageId }, { id: parsed.id });

    moveRequest
      .then(() => {
        toast.success(parsed.kind === "lead" ? "Лид перемещён" : "Сделка перемещена");
        // Тихо сверяем состояние с сервером (won/lost/in_progress выставляется
        // на бэке по stage.type; неразобранный лид достаётся тому, кто перенёс).
        // Именно ТИХО, без скелетона: оптимистичная карточка уже на месте,
        // полная перезагрузка `loadBoard()` мигала и создавала ощущение
        // задержки — перенос должен быть моментальным.
        refreshBoard();
      })
      .catch((err: any) => {
        console.error("Error moving card:", err);
        toast.error(err?.response?.data?.message || err?.message || "Ошибка при перемещении");
        setBoard(previousBoard);
      });
  };

  if (isLoading && !board) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-96 w-72 shrink-0 rounded-lg" />
        ))}
      </div>
    );
  }

  if (!board || board.columns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-gray-500">
        <RefreshCw className="h-6 w-6" />
        <p>Для этой воронки не настроены этапы</p>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {/* Дублирующая полоса прокрутки сверху — видна только когда доска шире экрана */}
      {scrollWidth > clientWidth + 1 && (
        <div
          ref={topScrollRef}
          onScroll={syncFromTop}
          className="sticky top-0 z-20 mb-1 overflow-x-auto"
          aria-hidden="true"
        >
          <div style={{ width: scrollWidth, height: 1 }} />
        </div>
      )}
      <div
        ref={boardRef}
        onScroll={syncFromBoard}
        className="flex items-start gap-3 overflow-auto pb-2 max-h-[75vh]"
      >
        {board.columns.map((column) => (
          <Column
            key={column.stage?.id ?? "none"}
            column={column}
            onDealClick={onDealClick}
            canMove={canMove}
            {...actions}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null} modifiers={[snapCenterToCursor]}>
        {activeDeal ? <DealCard deal={activeDeal} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
