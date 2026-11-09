"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CustomSelect } from "@/components/ui/custom-select";
import { useToast } from "@/components/ui/use-toast";
import * as leadsApi from "@/src/api/leads.api";
import { listFunnels } from "@/src/api/funnels.api";
import { listFunnelStages } from "@/src/api/funnel-stages.api";

// Блок «Воронка» в карточке лида (ТЗ «доработки CRM КУБ», п.3.4):
//  - показывает текущую воронку и этап;
//  - в списке — только этапы воронки своего отдела, «Переместить» переводит
//    лид на выбранный этап;
//  - перенос в воронку другого отдела — только руководству и админу (ответ
//    заказчика); оператор передаёт лид кнопкой «Передать в отдел продаж».

interface LeadFunnelInfo {
  id: number;
  funnel_id?: number;
  stage_id?: number;
  funnel_name?: string;
  stage_name?: string;
  is_archived?: boolean;
  read_only?: boolean;
}

export function LeadFunnelBlock({
  lead,
  canMoveBetweenDepartments,
  onMoved,
}: {
  lead: LeadFunnelInfo;
  canMoveBetweenDepartments: boolean;
  onMoved: () => void;
}) {
  const { toast } = useToast();
  const [funnels, setFunnels] = useState<{ id: number; name: string }[]>([]);
  const [stages, setStages] = useState<{ id: number; name: string }[]>([]);
  const [stageTarget, setStageTarget] = useState("");
  const [funnelTarget, setFunnelTarget] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listFunnels()
      .then((list) => setFunnels((list || []).map((f: any) => ({ id: f.id, name: f.name }))))
      .catch(() => setFunnels([]));
  }, []);

  // Этапы — только если воронка лида доступна пользователю (воронка его
  // отдела; руководство и админ видят все воронки).
  const ownFunnel = !!lead.funnel_id && funnels.some((f) => f.id === lead.funnel_id);
  useEffect(() => {
    if (!ownFunnel || !lead.funnel_id) {
      setStages([]);
      return;
    }
    listFunnelStages(lead.funnel_id)
      .then((list: any[]) =>
        setStages(
          (list || [])
            .filter((s) => s.is_active !== false)
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
            .map((s) => ({ id: s.id, name: s.name }))
        )
      )
      .catch(() => setStages([]));
  }, [ownFunnel, lead.funnel_id]);

  const editable = !lead.read_only && !lead.is_archived;
  const errorText = (err: any) => err?.response?.data?.message ?? err?.message ?? "Ошибка";

  const moveStage = async () => {
    const stageId = Number(stageTarget);
    if (!stageId) return;
    setBusy(true);
    try {
      await leadsApi.move_lead_stage({ stage_id: stageId }, { id: lead.id });
      toast({ title: "Этап изменён", description: stages.find((s) => s.id === stageId)?.name });
      setStageTarget("");
      onMoved();
    } catch (err: any) {
      toast({ title: "Не удалось переместить", description: errorText(err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const moveFunnel = async () => {
    const funnelId = Number(funnelTarget);
    if (!funnelId) return;
    setBusy(true);
    try {
      await leadsApi.move_lead_to_funnel(lead.id, funnelId);
      toast({ title: "Лид перенесён", description: funnels.find((f) => f.id === funnelId)?.name });
      setFunnelTarget("");
      onMoved();
    } catch (err: any) {
      toast({ title: "Не удалось перенести", description: errorText(err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const funnelName = lead.funnel_name || funnels.find((f) => f.id === lead.funnel_id)?.name || "—";
  const stageOptions = stages.filter((s) => s.id !== lead.stage_id).map((s) => ({ value: String(s.id), label: s.name }));
  const funnelOptions = funnels.filter((f) => f.id !== lead.funnel_id).map((f) => ({ value: String(f.id), label: f.name }));

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <RefreshCw className="w-4 h-4 text-muted-foreground" /> Воронка
      </h3>
      <div className="space-y-2">
        <div className="flex flex-col sm:grid sm:grid-cols-[140px_1fr] gap-1 sm:gap-2 py-1">
          <span className="text-sm text-muted-foreground">Воронка</span>
          <span className="text-sm font-medium">{funnelName}</span>
        </div>
        <div className="flex flex-col sm:grid sm:grid-cols-[140px_1fr] gap-1 sm:gap-2 py-1">
          <span className="text-sm text-muted-foreground">Этап</span>
          <span className="text-sm font-medium">{lead.stage_name || "—"}</span>
        </div>

        {editable && ownFunnel && stageOptions.length > 0 && (
          <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <CustomSelect
                value={stageTarget}
                onChange={setStageTarget}
                options={stageOptions}
                placeholder="Выберите этап"
              />
            </div>
            <Button onClick={moveStage} disabled={!stageTarget || busy} className="shrink-0">
              {busy ? "Перемещение…" : "Переместить"}
            </Button>
          </div>
        )}
        {editable && !ownFunnel && lead.funnel_id && (
          <p className="text-xs text-muted-foreground">Лид в воронке другого отдела — этапы меняет этот отдел.</p>
        )}

        {editable && canMoveBetweenDepartments && funnelOptions.length > 0 && (
          <div className="mt-2 border-t pt-3">
            <p className="mb-2 text-xs text-muted-foreground">Перенести в воронку другого отдела</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <CustomSelect
                  value={funnelTarget}
                  onChange={setFunnelTarget}
                  options={funnelOptions}
                  placeholder="Выберите воронку"
                />
              </div>
              <Button variant="outline" onClick={moveFunnel} disabled={!funnelTarget || busy} className="shrink-0">
                Перенести
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
