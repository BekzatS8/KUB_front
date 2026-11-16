"use client";

import { useEffect, useRef, useState } from "react";

import * as ClientAPI from "@/src/api/clients.api";

function extractList(res: any): any[] {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.items)) return res.items;
  if (Array.isArray(res?.data?.items)) return res.data.items;
  return [];
}

// Серверный поиск клиента для выпадашек: сервер отдаёт список не больше 100
// клиентов за раз, поэтому поиск по загруженным не находил остальных
// («на клиента Маминов Данияр не могу сделать документ», 16.11.2026).
// results = null — поиска нет, показываем стартовый список.
export function useClientSearch(opts?: { mine?: boolean }) {
  const [results, setResults] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const search = (query: string, clientType?: string) => {
    if (timer.current) clearTimeout(timer.current);
    const term = query.trim();
    const my = ++seq.current;
    if (!term) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      const params = { page: 1, size: 50, q: term, ...(clientType ? { client_type: clientType } : {}) };
      try {
        let res;
        if (opts?.mine) {
          res = await ClientAPI.listMyClients(params);
        } else {
          try {
            res = await ClientAPI.listClients(params);
          } catch {
            res = await ClientAPI.listMyClients(params);
          }
        }
        // Ответ на устаревший запрос (пользователь печатает дальше) не показываем.
        if (my === seq.current) setResults(extractList(res));
      } catch (err) {
        console.error("Client search error:", err);
        if (my === seq.current) setResults([]);
      } finally {
        if (my === seq.current) setLoading(false);
      }
    }, 300);
  };

  return { results, loading, search };
}
