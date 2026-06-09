"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TelegramRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/whatsapp");
  }, [router]);

  return null;
}
