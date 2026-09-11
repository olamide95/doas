"use client"

import * as React from "react"
import { AlertTriangle, BarChart3, Clock3, Inbox } from "lucide-react"
import { DEPARTMENT } from "@/lib/workflow"
import { formatDate, naira, toDate, toMillis, truncate } from "@/lib/format"
import { useSubmissions, type SubmissionRow } from "@/components/dashboard/work-queue"
import {
  EmptyState,
  LoadFailed,
  Panel,
  RowsSkeleton,
  StatTile,
  StatusPill,
  TONE,
  toneForStatus,
} from "@/components/dashboard/kit"
import { Segmented } from "@/components/dashboard/notifications-panel"
import { cn } from "@/lib/utils"

const DESKS = Object.values(DEPARTMENT)
const STALE_DAYS = 7

function daysSince(value: unknown): number | null {
  const when = toDate(value)
  if (!when) return null
  return Math.floor((Date.now() - when.getTime()) / 86_400_000)
}

/** Days since the file last moved — that's the number that matters, not age. */
function idleDays(row: SubmissionRow): number | null {
  return daysSince(row.updatedAt ?? row.createdAt)
}

export function DirectorateReport() {
  const { rows, loading, error } = useSubmissions()
  const [split, setSplit] = React.useState<"desk" | "status">("desk")

  const live = React.useMemo(
    () =>
      rows.filter((row) => {
        const status = (row.status ?? "").toLowerCase()
        return !status.includes("reject") && status !== "approved"
      }),
    [rows],
  )

  const byDesk = React.useMemo(() => {
    const counts = new Map<string, number>()
    live.forEach((row) => {
      const desk = row.department || "Unassigned"
      counts.set(desk, (counts.get(desk) ?? 0) + 1)
    })
    return [...DESKS, "Unassigned"]
      .map((desk) => ({ label: desk, count: counts.get(desk) ?? 0 }))
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.count - a.count)
  }, [live])

  const byStatus = React.useMemo(() => {
    const counts = new Map<string, number>()
    rows.forEach((row) => {
      const status = row.status || "Unknown"
      counts.set(status, (counts.get(status) ?? 0) + 1)
    })
    return [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
  }, [rows])

  const stale = React.useMemo(
    () =>
      live
        .map((row) => ({ row, idle: idleDays(row) ?? 0 }))
        .filter((entry) => entry.idle >= STALE_DAYS)
        .sort((a, b) => b.idle - a.idle)
        .slice(0, 8),
    [live],
  )

  const invoices = rows.filter((row) => row.billing && Object.keys(row.billing).length)
  const collected = invoices
    .filter((row) => String(row.billing?.paymentStatus ?? "") === "Paid")
    .reduce((sum, row) => sum + Number(row.billing?.totalAmount ?? 0), 0)
  const owed = invoices
    .filter((row) => String(row.billing?.paymentStatus ?? "") !== "Paid")
    .reduce((sum, row) => sum + Number(row.billing?.totalAmount ?? 0), 0)

  const approved = rows.filter((row) => (row.status ?? "").toLowerCase().includes("approv")).length

  const cleared = React.useMemo(() => {
    const done = rows.filter((row) => (row.status ?? "").toLowerCase() === "approved")
    if (!done.length) return null
    const spans = done
      .map((row) => {
        const opened = toMillis(row.createdAt)
        const closed = toMillis(row.updatedAt)
        return opened && closed && closed > opened ? (closed - opened) / 86_400_000 : null
      })
      .filter((value): value is number => value !== null)
    if (!spans.length) return null
    return Math.round(spans.reduce((sum, value) => sum + value, 0) / spans.length)
  }, [rows])

  if (error) {
    return (
      <Panel title="Directorate report">
        <LoadFailed error={error} what="The directorate report" />
      </Panel>
    )
  }

  const breakdown = split === "desk" ? byDesk : byStatus
  const peak = Math.max(1, ...breakdown.map((entry) => entry.count))

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          index={0}
          label="Live applications"
          value={live.length}
          tone="move"
          icon={Inbox}
          note="Not yet approved or rejected"
        />
        <StatTile
          index={1}
          label="Sitting over a week"
          value={stale.length}
          tone={stale.length ? "stop" : "clear"}
          icon={Clock3}
          note={`No movement in ${STALE_DAYS} days or more`}
        />
        <StatTile
          index={2}
          label="Permits approved"
          value={approved}
          tone="clear"
          icon={BarChart3}
          note={cleared !== null ? `${cleared} days from filing on average` : "Across both routes"}
        />
        <StatTile
          index={3}
          label="Revenue collected"
          value={collected}
          tone="clear"
          icon={BarChart3}
          note={owed ? `${naira(owed)} still outstanding` : "Nothing outstanding"}
        />
      </div>

      <Panel
        title="Where the work is"
        description={
          split === "desk"
            ? "Open files by the desk currently holding them"
            : "Every application by status, including closed ones"
        }
        actions={
          <Segmented
            value={split}
            onChange={(v) => setSplit(v as typeof split)}
            options={[
              { value: "desk", label: "By desk" },
              { value: "status", label: "By status" },
            ]}
          />
        }
      >
        {loading ? (
          <RowsSkeleton rows={5} columns={2} />
        ) : !breakdown.length ? (
          <EmptyState
            icon={Inbox}
            title="No applications on file"
            description="Once the public portal starts taking applications, the workload across each desk shows up here."
          />
        ) : (
          <ul className="space-y-2.5">
            {breakdown.map((entry, i) => {
              const tone = split === "status" ? toneForStatus(entry.label) : "move"
              return (
                <li
                  key={entry.label}
                  style={{ ["--i" as string]: Math.min(i, 10) }}
                  className="reveal"
                >
                  <div className="mb-1 flex items-baseline justify-between gap-3">
                    <span className="truncate text-[13px] text-foreground">{entry.label}</span>
                    <span className="figure shrink-0 text-[13px] text-muted-foreground">
                      {entry.count}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full transition-[width] duration-500", TONE[tone].rule)}
                      style={{ width: `${(entry.count / peak) * 100}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      <Panel
        title="Stalled files"
        description={`Open applications with no movement in ${STALE_DAYS} days or more`}
        bodyClassName="p-3 sm:p-4"
      >
        {loading ? (
          <RowsSkeleton rows={4} columns={4} />
        ) : !stale.length ? (
          <EmptyState
            icon={Clock3}
            title="Nothing is stuck"
            description="Every open application has moved in the last week. This list fills up when a desk falls behind."
          />
        ) : (
          <ul className="space-y-2">
            {stale.map(({ row, idle }, i) => (
              <li
                key={`${row.route}-${row.id}`}
                style={{ ["--i" as string]: Math.min(i, 8) }}
                className="reveal flex flex-col gap-2 rounded-lg border border-border px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-[13.5px] font-semibold text-foreground">
                    {row.applicantName ?? "Unnamed applicant"}
                  </p>
                  <p className="text-[12.5px] text-muted-foreground">
                    {row.submissionId ?? row.id.slice(0, 8)} · {truncate(row.applicationType, 34)}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                    Filed {formatDate(row.createdAt)} · with {row.department || "no desk"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11.5px] font-semibold",
                      TONE[idle >= 21 ? "stop" : "wait"].soft,
                    )}
                  >
                    <AlertTriangle className="h-3 w-3" />
                    {idle} days idle
                  </span>
                  <StatusPill status={row.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
