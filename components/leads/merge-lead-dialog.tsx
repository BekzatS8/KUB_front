"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
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
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import * as leadsApi from "@/src/api/leads.api";

// «Объединить лиды» (ТЗ «доработки CRM КУБ», п.3.3): лид из Instagram с лидом
// из WhatsApp/Telegram и наоборот. Выбранный лид вливается в открытый:
// переписка, звонки, задачи и пустые поля переезжают сюда, выбранный уходит
// в корзину с пометкой «объединён».

const SOURCE_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  telegram: "Telegram",
  binotel: "Звонок",
  manual: "Вручную",
};

interface FoundLead {
  id: number;
  title: string;
  phone?: string;
  source?: string;
  created_at?: string;
  owner_name?: string;
}

export function MergeLeadDialog({
  lead,
  open,
  onClose,
  onMerged,
}: {
  lead: { id: number; title: string; source?: string };
  open: boolean;
  onClose: () => void;
  onMerged: () => void;
}) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<FoundLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<FoundLead | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setItems([]);
      setSelected(null);
      return;
    }
    const q = query.trim();
    if (q.length < 2) {
      setItems([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      leadsApi
        .list_leads(undefined, { q, page: 1, size: 20, paginate: true })
        .then((res: any) => {
          if (cancelled) return;
          const list: FoundLead[] = Array.isArray(res) ? res : res?.items || res?.data || [];
          setItems(list.filter((l) => l.id !== lead.id));
        })
        .catch(() => !cancelled && setItems([]))
        .finally(() => !cancelled && setLoading(false));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, open, lead.id]);

  const submit = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await leadsApi.merge_leads(lead.id, selected.id);
      toast({ title: "Лиды объединены", description: `Лид #${selected.id} влит в лид #${lead.id}` });
      onClose();
      onMerged();
    } catch (err: any) {
      toast({
        title: "Не удалось объединить",
        description: err?.response?.data?.message ?? err?.message ?? "Ошибка",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Объединить лиды</DialogTitle>
          <DialogDescription>
            Найдите второй лид этого клиента (например, из Instagram или WhatsApp). Он будет влит в лид #{lead.id}:
            переписка, звонки и задачи переедут сюда, а второй лид уйдёт в корзину.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            className="pl-8"
            placeholder="Телефон, имя, ник или номер лида"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {loading && <p className="py-4 text-center text-sm text-muted-foreground">Поиск…</p>}
          {!loading && query.trim().length >= 2 && items.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">Лиды не найдены</p>
          )}
          {items.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setSelected(l)}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm hover:bg-muted",
                selected?.id === l.id && "border-primary bg-primary/5"
              )}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">
                  #{l.id} · {l.title}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {[l.phone ? `+${l.phone}` : "", l.owner_name || ""].filter(Boolean).join(" · ") || "—"}
                </span>
              </span>
              {l.source && (
                <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                  {SOURCE_LABELS[l.source] || l.source}
                </span>
              )}
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Отмена
          </Button>
          <Button onClick={submit} disabled={!selected || busy}>
            {busy ? "Объединение…" : selected ? `Влить #${selected.id} в #${lead.id}` : "Объединить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
