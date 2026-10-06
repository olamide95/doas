"use client"

import * as React from "react"
import { doc, onSnapshot } from "firebase/firestore"
import { History, Loader2, Search } from "lucide-react"
import { db } from "@/lib/firebase"
import { findSubmission } from "@/lib/applicant"
import { deskLabel, parseDate } from "@/lib/workflow"
import { Panel, StatusPill } from "@/components/dashboard/kit"
import { ActionButton } from "@/components/dashboard/form-kit"

export interface AuditEntry {
  text?: string
  timestamp?: string
  action?: string
  desk?: string
  from?: string
  to?: string
  status?: string
}

interface TimelineRow {
  comments?: AuditEntry[]
  createdAt?: unknown
  status?: string
  department?: string
}

const pad = (n: number) => String(n).padStart(2, "0")
function stamp(value: unknown) {
  const d = parseDate(value)
  if (!d) return "—"
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Read-only file movement log, built from the trail every action appends. */
export function AuditTimeline({ row }: { row: TimelineRow }) {
  const entries = React.useMemo(() => {
    const list = (row.comments ?? []).slice()
    list.sort((a, b) => (parseDate(a.timestamp)?.getTime() ?? 0) - (parseDate(b.timestamp)?.getTime() ?? 0))
    const opened = list.some((e) => e.desk === "applicant" && /opened/i.test(e.action ?? ""))
    if (opened) return list
    const created = parseDate(row.createdAt)
    return [{ timestamp: created ? created.toISOString() : "", desk: "applicant", action: "File opened via portal upload", to: "CSU" } as AuditEntry, ...list]
  }, [row.comments, row.createdAt])

  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-[12.5px] font-semibold text-foreground">
        <History className="h-3.5 w-3.5" /> Audit log — file movement
      </p>
      <ol className="space-y-1.5 font-mono text-[11.5px] leading-relaxed text-muted-foreground">
        {entries.map((e, i) => (
          <li key={i} className="flex gap-2">
            <span className="shrink-0 text-border">{i === entries.length - 1 ? "└──" : "├──"}</span>
            <span className="min-w-0">
              <span className="text-foreground">[{stamp(e.timestamp)}]</span> — {deskLabel(e.desk)}: {e.action}
              {e.text && e.text !== e.action ? <span className="italic"> “{e.text}”</span> : null}
              {e.to ? <span> Route → {e.to}.</span> : null}
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
        Current file state → <StatusPill status={row.status} /> with {row.department ?? "—"}
      </div>
    </div>
  )
}

/** Anchored at the base of every dashboard (mounted from DashboardShell). */
export function FileTracker() {
  const [reference, setReference] = React.useState("")
  const [target, setTarget] = React.useState<{ path: string; id: string; ref: string } | null>(null)
  const [row, setRow] = React.useState<TimelineRow | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [missing, setMissing] = React.useState(false)

  React.useEffect(() => {
    if (!target) return
    return onSnapshot(doc(db, target.path, target.id), (snap) => setRow(snap.exists() ? (snap.data() as TimelineRow) : null))
  }, [target])

  const look = async () => {
    if (!reference.trim()) return
    setBusy(true)
    setMissing(false)
    try {
      const found = await findSubmission(reference)
      if (!found) {
        setMissing(true)
        setTarget(null)
        setRow(null)
      } else setTarget({ path: found.collectionName, id: found.docId, ref: found.data.submissionId })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel title="File movement history" description="Look up any file reference to see every desk it has passed through.">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && look()}
          placeholder="FP-… or TP-…"
          className="flex-1 rounded-lg border border-input bg-card px-3 py-2 font-mono text-[13px] outline-none focus:border-ring"
        />
        <ActionButton tone="quiet" icon={busy ? Loader2 : Search} onClick={look} disabled={busy}>
          Trace file
        </ActionButton>
      </div>
      {missing ? <p className="mt-2 text-[12.5px] text-[hsl(var(--state-stop))]">No file matches that reference.</p> : null}
      {target && row ? (
        <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3.5">
          <p className="mb-2 font-mono text-[12px] text-foreground">{target.ref}</p>
          <AuditTimeline row={row} />
        </div>
      ) : null}
    </Panel>
  )
}
