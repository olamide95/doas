"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  OctagonAlert,
  X,
} from "lucide-react"

/* ------------------------------------------------------------------ *
 * Store — lives outside React so toast() can be called from anywhere:
 * event handlers, async callbacks, Firestore error branches.
 * ------------------------------------------------------------------ */

export type ToastVariant =
  | "default"
  | "success"
  | "warning"
  | "info"
  | "error"
  | "destructive"
  | "loading"

export interface ToastOptions {
  title?: React.ReactNode
  /** Alias kept so existing `toast({ title, description })` calls still work. */
  description?: React.ReactNode
  variant?: ToastVariant
  /** ms. 0 keeps it on screen until dismissed. Defaults by variant. */
  duration?: number
  action?: { label: string; onClick: () => void }
}

interface ToastRecord extends ToastOptions {
  id: string
  open: boolean
}

export interface ToastHandle {
  id: string
  dismiss: () => void
  update: (next: ToastOptions) => void
}

const MAX_VISIBLE = 4
const EXIT_MS = 200

let records: ToastRecord[] = []
const subscribers = new Set<(next: ToastRecord[]) => void>()
const timers = new Map<string, ReturnType<typeof setTimeout>>()

function publish() {
  const snapshot = [...records]
  subscribers.forEach((fn) => fn(snapshot))
}

function clearTimer(id: string) {
  const t = timers.get(id)
  if (t) clearTimeout(t)
  timers.delete(id)
}

function defaultDuration(variant: ToastVariant = "default") {
  if (variant === "loading") return 0
  if (variant === "error" || variant === "destructive") return 6500
  return 4500
}

function scheduleDismiss(id: string, duration: number) {
  clearTimer(id)
  if (duration > 0) timers.set(id, setTimeout(() => dismiss(id), duration))
}

export function dismiss(id?: string) {
  const targets = id ? [id] : records.map((r) => r.id)
  records = records.map((r) => (targets.includes(r.id) ? { ...r, open: false } : r))
  publish()
  targets.forEach((target) => {
    clearTimer(target)
    setTimeout(() => {
      records = records.filter((r) => r.id !== target)
      publish()
    }, EXIT_MS)
  })
}

function create(options: ToastOptions): ToastHandle {
  const id = `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
  const duration = options.duration ?? defaultDuration(options.variant)
  const record: ToastRecord = { ...options, duration, id, open: true }

  records = [record, ...records].slice(0, MAX_VISIBLE)
  publish()
  scheduleDismiss(id, duration)

  return {
    id,
    dismiss: () => dismiss(id),
    update: (next) => {
      const duration = next.duration ?? defaultDuration(next.variant ?? options.variant)
      records = records.map((r) => (r.id === id ? { ...r, ...next, duration, open: true } : r))
      publish()
      scheduleDismiss(id, duration)
    },
  }
}

type ToastFn = ((options: ToastOptions) => ToastHandle) & {
  success: (options: Omit<ToastOptions, "variant">) => ToastHandle
  error: (options: Omit<ToastOptions, "variant">) => ToastHandle
  warning: (options: Omit<ToastOptions, "variant">) => ToastHandle
  info: (options: Omit<ToastOptions, "variant">) => ToastHandle
  loading: (options: Omit<ToastOptions, "variant">) => ToastHandle
  dismiss: typeof dismiss
}

export const toast: ToastFn = Object.assign(create, {
  success: (o: Omit<ToastOptions, "variant">) => create({ ...o, variant: "success" }),
  error: (o: Omit<ToastOptions, "variant">) => create({ ...o, variant: "error" }),
  warning: (o: Omit<ToastOptions, "variant">) => create({ ...o, variant: "warning" }),
  info: (o: Omit<ToastOptions, "variant">) => create({ ...o, variant: "info" }),
  loading: (o: Omit<ToastOptions, "variant">) => create({ ...o, variant: "loading" }),
  dismiss,
})

/** Kept for components already written against `const { toast } = useToast()`. */
export function useToast() {
  const [toasts, setToasts] = React.useState<ToastRecord[]>(records)
  React.useEffect(() => {
    subscribers.add(setToasts)
    setToasts([...records])
    return () => {
      subscribers.delete(setToasts)
    }
  }, [])
  return { toast, toasts, dismiss }
}

/* ------------------------------------------------------------------ *
 * View
 * ------------------------------------------------------------------ */

const VARIANT_STYLE: Record<
  ToastVariant,
  { rule: string; icon: React.ElementType; iconClass: string }
> = {
  default: {
    rule: "bg-[hsl(var(--state-idle))]",
    icon: Info,
    iconClass: "text-[hsl(var(--state-idle))]",
  },
  success: {
    rule: "bg-[hsl(var(--state-clear))]",
    icon: CheckCircle2,
    iconClass: "text-[hsl(var(--state-clear))]",
  },
  warning: {
    rule: "bg-[hsl(var(--state-wait))]",
    icon: AlertTriangle,
    iconClass: "text-[hsl(var(--state-wait))]",
  },
  info: {
    rule: "bg-[hsl(var(--state-move))]",
    icon: Info,
    iconClass: "text-[hsl(var(--state-move))]",
  },
  error: {
    rule: "bg-[hsl(var(--state-stop))]",
    icon: OctagonAlert,
    iconClass: "text-[hsl(var(--state-stop))]",
  },
  destructive: {
    rule: "bg-[hsl(var(--state-stop))]",
    icon: OctagonAlert,
    iconClass: "text-[hsl(var(--state-stop))]",
  },
  loading: {
    rule: "bg-[hsl(var(--state-move))]",
    icon: Loader2,
    iconClass: "text-[hsl(var(--state-move))] animate-spin",
  },
}

function ToastCard({ record }: { record: ToastRecord }) {
  const variant = record.variant ?? "default"
  const style = VARIANT_STYLE[variant] ?? VARIANT_STYLE.default
  const Icon = style.icon

  return (
    <div
      role={variant === "error" || variant === "destructive" ? "alert" : "status"}
      aria-live={variant === "error" || variant === "destructive" ? "assertive" : "polite"}
      className={`pointer-events-auto relative w-full overflow-hidden rounded-xl surface-raised ${
        record.open ? "toast-in" : "toast-out"
      }`}
    >
      <span className={`absolute inset-y-0 left-0 w-[3px] ${style.rule}`} aria-hidden />

      <div className="flex items-start gap-3 py-3 pl-4 pr-2.5">
        <Icon className={`mt-0.5 h-[18px] w-[18px] shrink-0 ${style.iconClass}`} aria-hidden />

        <div className="min-w-0 flex-1">
          {record.title ? (
            <p className="text-[13.5px] font-semibold leading-snug text-foreground">
              {record.title}
            </p>
          ) : null}
          {record.description ? (
            <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
              {record.description}
            </p>
          ) : null}
          {record.action ? (
            <button
              type="button"
              onClick={() => {
                record.action?.onClick()
                dismiss(record.id)
              }}
              className="mt-2 text-[12.5px] font-semibold text-accent underline-offset-4 hover:underline"
            >
              {record.action.label}
            </button>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => dismiss(record.id)}
          aria-label="Dismiss"
          className="-mr-0.5 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {record.duration && record.duration > 0 ? (
        <span
          aria-hidden
          className={`toast-drain absolute bottom-0 left-0 h-[2px] w-full ${style.rule} opacity-30`}
          style={{ animationDuration: `${record.duration}ms` }}
        />
      ) : null}
    </div>
  )
}

/**
 * Mounted once in the root layout. Bottom sheet on phones (thumb reach),
 * top-right on desktop so it never covers table actions.
 */
export function Toaster() {
  const [list, setList] = React.useState<ToastRecord[]>([])
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
    subscribers.add(setList)
    setList([...records])
    return () => {
      subscribers.delete(setList)
    }
  }, [])

  if (!mounted) return null

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col-reverse gap-2 p-3 sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-0 sm:w-[min(24rem,calc(100vw-2rem))] sm:flex-col sm:p-5"
      aria-label="Notifications"
    >
      {list.map((record) => (
        <ToastCard key={record.id} record={record} />
      ))}
    </div>,
    document.body,
  )
}
