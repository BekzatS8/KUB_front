"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Building2, User, RefreshCw } from "lucide-react";
import * as FunnelStagesAPI from "@/src/api/funnel-stages.api";
import { move_deal_stage } from "@/src/api/deals.api";
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

interface DealCardProps {
  deal: FunnelBoardDeal;
  onClick?: (deal: FunnelBoardDeal) => void;
  disabled?: boolean;
}

function DealCard({ deal, onClick, disabled }: DealCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `deal-${deal.id}`,
    disabled,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick?.(deal)}
      className={cn(
        "rounded-lg border bg-white p-3 shadow-sm transition-shadow hover:shadow-md cursor-grab active:cursor-grabbing select-none",
        isDragging && "opacity-40"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-mono text-gray-400">#{deal.id}</span>
        <Badge className={cn("text-xs", STATUS_CLASSNAMES[deal.status] || "bg-gray-100 text-gray-800")}>
          {STATUS_LABELS[deal.status] || deal.status}
        </Badge>
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-sm font-medium text-gray-900">
        <Building2 className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        <span className="truncate">{deal.client_name || `Клиент #${deal.client_id}`}</span>
      </div>
      <div className="mt-1 text-sm font-semibold text-gray-800">
        {formatAmount(deal.amount, deal.currency)}
      </div>
      {deal.owner_name && (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-500">
          <User className="h-3 w-3 shrink-0" />
          <span className="truncate">{deal.owner_name}</span>
        </div>
      )}
    </div>
  );
}

interface ColumnProps {
  column: FunnelBoardColumn;
  onDealClick?: (deal: FunnelBoardDeal) => void;
  canMove: boolean;
}

function Column({ column, onDealClick, canMove }: ColumnProps) {
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
        className="rounded-t-lg border-b px-3 py-2"
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
          "flex flex-1 flex-col gap-2 overflow-y-auto p-2 transition-colors min-h-[120px]",
          isOver && "bg-blue-50"
        )}
      >
        {column.deals.length === 0 ? (
          <div className="py-6 text-center text-xs text-gray-400">Нет сделок</div>
        ) : (
          column.deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} onClick={onDealClick} disabled={!canMove} />
          ))
        )}
      </div>
    </div>
  );
}

interface KanbanBoardProps {
  funnelId: number;
  canMove?: boolean;
  onDealClick?: (deal: FunnelBoardDeal) => void;
  refreshKey?: number;
}

export function KanbanBoard({ funnelId, canMove = true, onDealClick, refreshKey }: KanbanBoardProps) {
  const [board, setBoard] = useState<FunnelBoard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeDeal, setActiveDeal] = useState<FunnelBoardDeal | null>(null);

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

  useEffect(() => {
    if (funnelId) {
      loadBoard();
    }
  }, [funnelId, refreshKey]);

  const allDeals = useMemo(
    () => board?.columns.flatMap((c) => c.deals) || [],
    [board]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const dealId = Number(String(event.active.id).replace("deal-", ""));
    const deal = allDeals.find((d) => d.id === dealId) || null;
    setActiveDeal(deal);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDeal(null);
    if (!over || !board) return;

    const dealId = Number(String(active.id).replace("deal-", ""));
    const overId = String(over.id);
    if (!overId.startsWith("stage-") || overId === "stage-none") return;
    const targetStageId = Number(overId.replace("stage-", ""));

    const sourceColumn = board.columns.find((c) => c.deals.some((d) => d.id === dealId));
    const deal = sourceColumn?.deals.find((d) => d.id === dealId);
    if (!deal || !sourceColumn) return;
    if (sourceColumn.stage?.id === targetStageId) return;

    const targetColumn = board.columns.find((c) => c.stage?.id === targetStageId);
    if (!targetColumn) return;

    // Optimistic update
    const previousBoard = board;
    const updatedDeal: FunnelBoardDeal = { ...deal, stage_id: targetStageId };
    const newColumns = board.columns.map((col) => {
      if (col === sourceColumn) {
        const deals = col.deals.filter((d) => d.id !== dealId);
        return {
          ...col,
          deals,
          count: deals.length,
          total_amount: deals.reduce((sum, d) => sum + Number(d.amount || 0), 0),
        };
      }
      if (col === targetColumn) {
        const deals = [...col.deals, updatedDeal];
        return {
          ...col,
          deals,
          count: deals.length,
          total_amount: deals.reduce((sum, d) => sum + Number(d.amount || 0), 0),
        };
      }
      return col;
    });
    setBoard({ ...board, columns: newColumns });

    move_deal_stage({ stage_id: targetStageId }, { id: dealId })
      .then(() => {
        toast.success("Сделка перемещена");
      })
      .catch((err: any) => {
        console.error("Error moving deal:", err);
        toast.error(err?.response?.data?.message || err?.message || "Ошибка при перемещении сделки");
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
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {board.columns.map((column) => (
          <Column
            key={column.stage?.id ?? "none"}
            column={column}
            onDealClick={onDealClick}
            canMove={canMove}
          />
        ))}
      </div>
      <DragOverlay>
        {activeDeal ? <DealCard deal={activeDeal} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
