"use client"

import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/* ------------------------------------------------------------------ *
 * Status vocabulary
 * Every status in DOAS is one of five things: waiting on someone,
 * moving between desks, cleared, stopped, or dormant. The colour says
 * which — it isn't decoration.
 * ------------------------------------------------------------------ */

export type StateTone = "wait" | "move" | "clear" | "stop" | "idle"

export const TONE: Record<StateTone, { text: string; soft: string; dot: string; rule: string }> = {
  wait: {
    text: "text-[hsl(var(--state-wait))]",
    soft: "bg-[hsl(var(--state-wait-soft))] text-[hsl(var(--state-wait))]",
    dot: "bg-[hsl(var(--state-wait))]",
    rule: "bg-[hsl(var(--state-wait))]",
  },
  move: {
    text: "text-[hsl(var(--state-move))]",
    soft: "bg-[hsl(var(--state-move-soft))] text-[hsl(var(--state-move))]",
    dot: "bg-[hsl(var(--state-move))]",
    rule: "bg-[hsl(var(--state-move))]",
  },
  clear: {
    text: "text-[hsl(var(--state-clear))]",
    soft: "bg-[hsl(var(--state-clear-soft))] text-[hsl(var(--state-clear))]",
    dot: "bg-[hsl(var(--state-clear))]",
    rule: "bg-[hsl(var(--state-clear))]",
  },
  stop: {
    text: "text-[hsl(var(--state-stop))]",
    soft: "bg-[hsl(var(--state-stop-soft))] text-[hsl(var(--state-stop))]",
    dot: "bg-[hsl(var(--state-stop))]",
    rule: "bg-[hsl(var(--state-stop))]",
  },
  idle: {
    text: "text-[hsl(var(--state-idle))]",
    soft: "bg-[hsl(var(--state-idle-soft))] text-[hsl(var(--state-idle))]",
    dot: "bg-[hsl(var(--state-idle))]",
    rule: "bg-[hsl(var(--state-idle))]",
  },
}

export function toneForStatus(status?: string | null): StateTone {
  const s = (status ?? "").toLowerCase()
  if (!s) return "idle"
  if (s.includes("reject") || s.includes("suspend") || s.includes("expired")) return "stop"
  if (s.includes("approv") || s.includes("complete") || s.includes("active") || s.includes("paid"))
    return "clear"
  if (s.includes("forward") || s.includes("review") || s.includes("progress") || s.includes("schedul"))
    return "move"
  if (s.includes("pend") || s.includes("required") || s.includes("await") || s.includes("submitted"))
    return "wait"
  return "idle"
}

/** Statuses read better without their bookkeeping prefix in a narrow cell. */
export function shortStatus(status?: string | null): string {
  if (!status) return "Unknown"
  return status.replace(/^Forwarded to /i, "With ")
}

export function StatusPill({
  status,
  tone,
  className,
}: {
  status?: string | null
  tone?: StateTone
  className?: string
}) {
  const t = TONE[tone ?? toneForStatus(status)]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-[11.5px] font-semibold",
        t.soft,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", t.dot)} aria-hidden />
      {shortStatus(status)}
    </span>
  )
}

export function UrgencyPill({ urgency }: { urgency?: string | null }) {
  const u = (urgency ?? "low").toLowerCase()
  const tone: StateTone = u === "high" ? "stop" : u === "medium" ? "wait" : "idle"
  const label = u.charAt(0).toUpperCase() + u.slice(1)
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11.5px] font-semibold",
        TONE[tone].soft,
      )}
    >
      {label}
    </span>
  )
}

/* ------------------------------------------------------------------ *
 * Numbers
 * ------------------------------------------------------------------ */

export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = React.useState(value)
  const previous = React.useRef(value)

  React.useEffect(() => {
    const from = previous.current
    const to = value
    previous.current = value
    if (from === to) return

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduce) {
      setDisplay(to)
      return
    }

    const duration = 520
    const start = performance.now()
    let frame = 0

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(from + (to - from) * eased))
      if (t < 1) frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])

  return <span className={cn("figure tnum", className)}>{display.toLocaleString("en-NG")}</span>
}

/* ------------------------------------------------------------------ *
 * Layout pieces
 * ------------------------------------------------------------------ */

export function PageHeading({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-[26px] font-semibold leading-tight text-foreground sm:text-[30px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-[62ch] text-[13.5px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  )
}

/**
 * A metric tile. The status rule down the left edge tells you at a glance
 * whether the number is something to act on.
 */
export function StatTile({
  label,
  value,
  tone = "idle",
  icon: Icon,
  note,
  onClick,
  index = 0,
}: {
  label: string
  value: number
  tone?: StateTone
  icon: LucideIcon
  note?: string
  onClick?: () => void
  index?: number
}) {
  const Wrapper = onClick ? "button" : "div"
  return (
    <Wrapper
      {...(onClick ? { type: "button" as const, onClick } : {})}
      style={{ ["--i" as string]: index }}
      className={cn(
        "reveal group relative overflow-hidden rounded-xl surface px-4 py-4 text-left transition-shadow",
        onClick && "hover:surface-raised focus-visible:surface-raised",
      )}
    >
      <span className={cn("absolute inset-y-0 left-0 w-[3px]", TONE[tone].rule)} aria-hidden />
      <div className="flex items-start justify-between gap-3 pl-1">
        <div className="min-w-0">
          <p className="truncate text-[12.5px] font-medium text-muted-foreground">{label}</p>
          <p className="mt-1.5 text-[32px] font-semibold leading-none text-foreground">
            <AnimatedNumber value={value} />
          </p>
          {note ? <p className="mt-2 text-[11.5px] text-muted-foreground">{note}</p> : null}
        </div>
        <span
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-transform",
            TONE[tone].soft,
            onClick && "group-hover:scale-105",
          )}
        >
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        </span>
      </div>
    </Wrapper>
  )
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: string
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={cn("rounded-xl surface", className)}>
      {title || actions ? (
        <header className="flex flex-col gap-3 border-b border-border px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            {title ? (
              <h2 className="font-display text-[15px] font-semibold text-foreground">{title}</h2>
            ) : null}
            {description ? (
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </header>
      ) : null}
      <div className={cn("p-4 sm:p-5", bodyClassName)}>{children}</div>
    </section>
  )
}

/** An empty screen is an invitation to act, so it always names the next step. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="fade-in flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-14 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <p className="mt-3 font-display text-[15px] font-semibold text-foreground">{title}</p>
      {description ? (
        <p className="mt-1 max-w-[46ch] text-[13px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function RowsSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-px overflow-hidden rounded-lg" aria-hidden>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 bg-card px-3 py-3.5">
          {Array.from({ length: columns }).map((_, c) => (
            <div
              key={c}
              className="skeleton h-3 rounded"
              style={{ width: c === 0 ? "18%" : c === columns - 1 ? "10%" : "16%" }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function LoadFailed({ error, what }: { error: Error; what: string }) {
  return (
    <div className="rounded-lg border border-[hsl(var(--state-stop))]/30 bg-[hsl(var(--state-stop-soft))] px-4 py-3.5">
      <p className="text-[13px] font-semibold text-[hsl(var(--state-stop))]">
        {what} could not load
      </p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
        {error.message.includes("index")
          ? "Firestore needs an index for this query. Open the browser console and follow the link Firebase printed to create it."
          : error.message}
      </p>
    </div>
  )
}

/** Field label + value, used inside detail dialogs. */
export function Field({
  label,
  value,
  mono,
  className,
}: {
  label: string
  value?: React.ReactNode
  mono?: boolean
  className?: string
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[11.5px] font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 break-words text-[13.5px] text-foreground",
          mono && "font-mono text-[12.5px]",
        )}
      >
        {value === undefined || value === null || value === "" ? "—" : value}
      </p>
    </div>
  )
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 border-b border-border pb-1.5 font-display text-[13px] font-semibold text-foreground">
      {children}
    </h3>
  )
}
