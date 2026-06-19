"use client"

import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle, useState } from "react"
import SignaturePadLib from "signature_pad"
import { Button } from "@/components/ui/button"

export interface SignaturePadHandle {
  getDataURL: () => string | null
  isEmpty: () => boolean
  clear: () => void
}

interface SignaturePadProps {
  className?: string
  onBegin?: () => void
  onEnd?: () => void
}

const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  ({ className, onBegin, onEnd }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const padRef = useRef<SignaturePadLib | null>(null)
    const [empty, setEmpty] = useState(true)

    const resizeCanvas = useCallback(() => {
      const canvas = canvasRef.current
      if (!canvas || !padRef.current) return
      const ratio = window.devicePixelRatio || 1
      const data = padRef.current.toData()
      canvas.width = canvas.offsetWidth * ratio
      canvas.height = canvas.offsetHeight * ratio
      const ctx = canvas.getContext("2d")
      if (ctx) ctx.scale(ratio, ratio)
      padRef.current.clear()
      padRef.current.fromData(data)
    }, [])

    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return

      const ratio = window.devicePixelRatio || 1
      canvas.width = canvas.offsetWidth * ratio
      canvas.height = canvas.offsetHeight * ratio
      const ctx = canvas.getContext("2d")
      if (ctx) ctx.scale(ratio, ratio)

      const pad = new SignaturePadLib(canvas, {
        backgroundColor: "rgba(255,255,255,0)",
        penColor: "#1e293b",
        minWidth: 1,
        maxWidth: 2.5,
      })

      pad.addEventListener("beginStroke", () => {
        setEmpty(false)
        onBegin?.()
      })
      pad.addEventListener("endStroke", () => {
        setEmpty(pad.isEmpty())
        onEnd?.()
      })

      padRef.current = pad

      const observer = new ResizeObserver(resizeCanvas)
      observer.observe(canvas)

      return () => {
        observer.disconnect()
        pad.off()
        padRef.current = null
      }
    }, [resizeCanvas, onBegin, onEnd])

    useImperativeHandle(ref, () => ({
      getDataURL: () => {
        if (!padRef.current || padRef.current.isEmpty()) return null
        return padRef.current.toDataURL("image/png")
      },
      isEmpty: () => padRef.current?.isEmpty() ?? true,
      clear: () => {
        padRef.current?.clear()
        setEmpty(true)
      },
    }))

    return (
      <div className={`relative ${className ?? ""}`}>
        <canvas
          ref={canvasRef}
          className="w-full h-40 border-2 border-dashed border-slate-300 rounded-lg touch-none cursor-crosshair bg-white"
          style={{ touchAction: "none" }}
        />
        {empty && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="text-sm text-slate-400 select-none">Нарисуйте подпись</span>
          </div>
        )}
        {!empty && (
          <div className="absolute top-2 right-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs text-slate-500 hover:text-slate-700"
              onClick={() => {
                padRef.current?.clear()
                setEmpty(true)
              }}
            >
              Очистить
            </Button>
          </div>
        )}
      </div>
    )
  }
)

SignaturePad.displayName = "SignaturePad"
export { SignaturePad }
