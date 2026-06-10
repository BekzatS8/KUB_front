"use client"

import { useEffect, useState } from "react"
import { loadProtectedImage } from "@/src/api/profile.api"

export function AuthenticatedAvatarImage({
  src,
  alt,
  className,
}: {
  src?: string | null
  alt: string
  className?: string
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let nextUrl: string | null = null

    setObjectUrl(null)
    if (!src) return

    loadProtectedImage(src)
      .then((url) => {
        if (cancelled) {
          if (url) URL.revokeObjectURL(url)
          return
        }
        nextUrl = url
        setObjectUrl(url)
      })
      .catch(() => setObjectUrl(null))

    return () => {
      cancelled = true
      if (nextUrl) URL.revokeObjectURL(nextUrl)
    }
  }, [src])

  if (!objectUrl) return null

  return <img src={objectUrl} alt={alt} className={className} />
}
