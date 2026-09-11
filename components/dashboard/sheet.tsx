"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * A right-hand slide-over for reviewing one record. Chosen over a centred
 * dialog because these records are tall and read top-to-bottom, and the table
 * behind stays visible for context.
 */
export function Sheet({
  open,
  onClose,
  title,
  caption,
  footer,
  children,
  width = "max-w-2xl",
}: {
  open: boolean
  onClose: () => void
  title: string
  caption?: string
  footer?: React.ReactNode
  children: React.ReactNode
  width?: string
}) {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => setMounted(true), [])

  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  if (!mounted || !open) return null

  return createPortal(
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="fade-in absolute inset-0 bg-foreground/40 backdrop-blur-[2px]"
      />
      <div
        className={cn(
          "reveal absolute inset-y-0 right-0 flex w-full flex-col bg-card shadow-2xl sm:w-[92vw]",
          width,
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-display text-[16px] font-semibold text-foreground">{title}</h2>
            {caption ? (
              <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">{caption}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto scroll-slim px-5 py-5">{children}</div>

        {footer ? <footer className="border-t border-border px-5 py-3.5">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  )
}
