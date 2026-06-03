"use client";

import * as React from "react";
import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
} from "next-themes";
import { useEffect } from "react";
import { setAuthToken } from "@/src/api/index";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  useEffect(() => {
    try {
      const match = document.cookie
        .split("; ")
        .find((row) => row.startsWith("auth_token="));
      const token = match ? decodeURIComponent(match.split("=")[1]) : null;
      if (token) setAuthToken(token);
    } catch (e) {
      // ignore
    }
  }, []);

  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
