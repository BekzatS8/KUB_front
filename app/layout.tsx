import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/contexts/AuthContext"
import Script from "next/script"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "CRM Platform - Система управления клиентами",
  description: "Современная CRM система для управления клиентами, задачами и документооборотом",
  icons: {
    icon: "/logo.png",
  },
}

import { Toaster } from "@/components/ui/toaster"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/logo.png" />
        <Script
          id="suppress-hydration-warning"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              // Подавление предупреждений гидратации для конкретных атрибутов
              const originalError = console.error;
              console.error = (...args) => {
                if (typeof args[0] === 'string' && 
                    args[0].includes('Warning: A title element received an attribute with the name http-equiv')) {
                  return;
                }
                if (typeof args[0] === 'string' && 
                    args[0].includes('Warning: Extra attributes from the server')) {
                  return;
                }
                originalError.apply(console, args);
              }
            `
          }}
        />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <AuthProvider>
          <ThemeProvider 
            attribute="class" 
            defaultTheme="light" 
            enableSystem 
            disableTransitionOnChange
            storageKey="crm-theme"
          >
            {children}
            <Toaster />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  )
}