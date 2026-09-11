"use client"

import * as React from "react"
import { doc, limit, updateDoc, where, writeBatch } from "firebase/firestore"
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  FileText,
  MessageSquare,
  OctagonAlert,
  UserRound,
} from "lucide-react"
import { COL, db } from "@/lib/firebase"
import { useRealtimeCollection } from "@/hooks/use-firestore"
import { timeAgo, toMillis } from "@/lib/format"
import { toast } from "@/components/ui/toast"
import { EmptyState, LoadFailed, Panel, RowsSkeleton, TONE, type StateTone } from "./kit"
import { cn } from "@/lib/utils"

interface RawNotification {
  userId?: string
  title?: string
  content?: string
  message?: string
  type?: string
  isRead?: boolean
  read?: boolean
  referenceId?: string
  createdAt?: unknown
  timestamp?: unknown
}

const TYPE_STYLE: Record<string, { icon: React.ElementType; tone: StateTone }> = {
  success: { icon: CheckCircle2, tone: "clear" },
  approval: { icon: CheckCircle2, tone: "clear" },
  error: { icon: OctagonAlert, tone: "stop" },
  warning: { icon: OctagonAlert, tone: "wait" },
  submission: { icon: FileText, tone: "move" },
  message: { icon: MessageSquare, tone: "move" },
  user: { icon: UserRound, tone: "idle" },
  info: { icon: Bell, tone: "move" },
}

export function NotificationsPanel({ audience }: { audience: string }) {
  const [filter, setFilter] = React.useState<"all" | "unread">("all")
  const [busy, setBusy] = React.useState(false)

  const { data, loading, error } = useRealtimeCollection<RawNotification>(
    COL.notifications,
    [where("userId", "==", audience), limit(120)],
    [audience],
  )

  const items = React.useMemo(
    () =>
      data
        .map((n) => ({
          id: n.id,
          title: n.title ?? titleFor(n.type),
          body: n.content ?? n.message ?? "",
          type: n.type ?? "info",
          read: Boolean(n.isRead ?? n.read ?? false),
          at: n.createdAt ?? n.timestamp,
        }))
        .sort((a, b) => toMillis(b.at) - toMillis(a.at)),
    [data],
  )

  const unread = items.filter((n) => !n.read)
  const visible = filter === "unread" ? unread : items

  const markRead = async (id: string) => {
    try {
      await updateDoc(doc(db, COL.notifications, id), { isRead: true, read: true })
    } catch {
      toast.error({ title: "Could not mark as read", description: "Check your connection and try again." })
    }
  }

  const markAllRead = async () => {
    if (!unread.length || busy) return
    setBusy(true)
    try {
      const batch = writeBatch(db)
      unread.forEach((n) => batch.update(doc(db, COL.notifications, n.id), { isRead: true, read: true }))
      await batch.commit()
      toast.success({
        title: "All caught up",
        description: `${unread.length} notification${unread.length > 1 ? "s" : ""} marked as read.`,
      })
    } catch {
      toast.error({ title: "Could not mark all as read", description: "Some items were left unread." })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel
      title="Notifications"
      description={
        unread.length
          ? `${unread.length} waiting on you`
          : "Nothing new since you last checked"
      }
      actions={
        <>
          <Segmented
            value={filter}
            onChange={(v) => setFilter(v as "all" | "unread")}
            options={[
              { value: "all", label: `All ${items.length ? `(${items.length})` : ""}`.trim() },
              { value: "unread", label: `Unread ${unread.length ? `(${unread.length})` : ""}`.trim() },
            ]}
          />
          <button
            type="button"
            onClick={markAllRead}
            disabled={!unread.length || busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] font-medium text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-45"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read
          </button>
        </>
      }
      bodyClassName="p-3 sm:p-4"
    >
      {error ? (
        <LoadFailed error={error} what="Notifications" />
      ) : loading ? (
        <RowsSkeleton rows={4} columns={3} />
      ) : !visible.length ? (
        <EmptyState
          icon={Bell}
          title={filter === "unread" ? "No unread notifications" : "No notifications yet"}
          description="Anything forwarded to your desk, approved, or rejected will show up here."
        />
      ) : (
        <ul className="space-y-2">
          {visible.map((n, i) => {
            const style = TYPE_STYLE[n.type] ?? TYPE_STYLE.info
            const Icon = style.icon
            return (
              <li
                key={n.id}
                style={{ ["--i" as string]: Math.min(i, 8) }}
                className={cn(
                  "reveal relative flex gap-3 rounded-lg border border-border px-3.5 py-3 transition-colors",
                  n.read ? "bg-card" : "bg-muted/40",
                )}
              >
                {!n.read ? (
                  <span
                    className={cn("absolute inset-y-2 left-0 w-[3px] rounded-r", TONE[style.tone].rule)}
                    aria-hidden
                  />
                ) : null}
                <span
                  className={cn(
                    "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                    TONE[style.tone].soft,
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[13.5px] font-semibold text-foreground">{n.title}</p>
                    <span className="shrink-0 whitespace-nowrap text-[11px] text-muted-foreground">
                      {timeAgo(n.at)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{n.body}</p>
                  {!n.read ? (
                    <button
                      type="button"
                      onClick={() => markRead(n.id)}
                      className="mt-2 text-[12px] font-semibold text-accent underline-offset-4 hover:underline"
                    >
                      Mark as read
                    </button>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

function titleFor(type?: string) {
  switch (type) {
    case "success":
      return "Approved"
    case "error":
      return "Rejected"
    case "submission":
      return "New submission"
    case "message":
      return "New message"
    default:
      return "Update"
  }
}

export function Segmented({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            "rounded-[7px] px-2.5 py-1.5 text-[12.5px] font-medium transition-colors",
            value === o.value
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
