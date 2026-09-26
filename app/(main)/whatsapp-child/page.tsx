"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { MessengerView } from "@/components/messenger/messenger-view";
import { WAZZUP_CHILD_VISIBLE } from "@/lib/features";

export default function ChildMessengerPage() {
  const router = useRouter();

  // Пока дочерний аккаунт скрыт, прямая ссылка ведёт в общий мессенджер.
  useEffect(() => {
    if (!WAZZUP_CHILD_VISIBLE) router.replace("/whatsapp");
  }, [router]);

  if (!WAZZUP_CHILD_VISIBLE) return null;
  return <MessengerView account="child" />;
}
