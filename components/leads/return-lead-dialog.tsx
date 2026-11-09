"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import * as leadsApi from "@/src/api/leads.api";

// «Вернуть лид» (ТЗ «доработки CRM КУБ», п.3.2): снимает ответственного и
// возвращает лид в общую очередь нераспределённых. Причина обязательна и
// сохраняется в истории лида.
export function ReturnLeadDialog({
  leadId,
  open,
  onClose,
  onReturned,
}: {
  leadId: number;
  open: boolean;
  onClose: () => void;
  onReturned: () => void;
}) {
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!reason.trim()) return;
    setBusy(true);
    try {
      await leadsApi.return_lead(leadId, reason.trim());
      toast({ title: "Лид возвращён", description: "Лид в общей очереди нераспределённых" });
      setReason("");
      onClose();
      onReturned();
    } catch (err: any) {
      toast({
        title: "Не удалось вернуть лид",
        description: err?.response?.data?.message ?? err?.message ?? "Ошибка",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Вернуть лид</DialogTitle>
          <DialogDescription>
            Ответственный будет снят, лид вернётся в общую очередь нераспределённых.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="return-reason">
            Причина возврата <span className="text-red-500">*</span>
          </Label>
          <Textarea
            id="return-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Например: клиент из другого города, не мой профиль"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Отмена
          </Button>
          <Button onClick={submit} disabled={!reason.trim() || busy}>
            {busy ? "Возврат…" : "Вернуть"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
