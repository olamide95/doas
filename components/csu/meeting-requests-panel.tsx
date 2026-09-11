"use client"

import * as React from "react"
import { addDoc, collection, doc, limit, orderBy, updateDoc } from "firebase/firestore"
import {
  CalendarCheck,
  CalendarDays,
  CalendarX,
  Clock3,
  Forward,
  Paperclip,
  XCircle,
} from "lucide-react"
import { COL, db } from "@/lib/firebase"
import { DEPARTMENT, MEETING_STATUS, meetingDecided } from "@/lib/workflow"
import { useRealtimeCollection } from "@/hooks/use-firestore"
import { formatDate, formatDateTime, toMillis, truncate } from "@/lib/format"
import { toast } from "@/components/ui/toast"
import { Sheet } from "@/components/dashboard/sheet"
import { ActionButton, TextareaField } from "@/components/dashboard/form-kit"
import {
  EmptyState,
  Field,
  LoadFailed,
  Panel,
  RowsSkeleton,
  SectionLabel,
  StatusPill,
  UrgencyPill,
} from "@/components/dashboard/kit"
import { Segmented } from "@/components/dashboard/notifications-panel"
import { cn } from "@/lib/utils"

interface MeetingDoc {
  requestId?: string
  fullName?: string
  email?: string
  phoneNumber?: string
  organization?: string
  purpose?: string
  preferredDate?: string
  preferredTime?: string
  urgency?: string
  status?: string
  notes?: string
  directorComment?: string
  responseDate?: string
  supportingDocumentUrl?: string
  createdAt?: unknown
}

/**
 * CSU screens visitor requests and passes the ones worth the Director's time
 * upward. Once he decides, the decision and his note land back here — the same
 * text the visitor sees on the public tracker.
 */
export default function MeetingRequestsPanel() {
  const [tab, setTab] = React.useState<"new" | "waiting" | "decided">("new")
  const [selected, setSelected] = React.useState<(MeetingDoc & { id: string }) | null>(null)
  const [note, setNote] = React.useState("")
  const [busy, setBusy] = React.useState(false)

  const { data, loading, error } = useRealtimeCollection<MeetingDoc>(
    COL.meetings,
    [orderBy("createdAt", "desc"), limit(200)],
    [],
  )

  const normalised = React.useMemo(
    () =>
      data
        .map((row) => ({ ...row, status: (row.status ?? MEETING_STATUS.withCsu).toLowerCase() }))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)),
    [data],
  )

  const rows = React.useMemo(() => {
    if (tab === "new") return normalised.filter((row) => row.status === MEETING_STATUS.withCsu)
    if (tab === "waiting")
      return normalised.filter((row) => row.status === MEETING_STATUS.withDirector)
    return normalised.filter((row) => meetingDecided(row.status))
  }, [normalised, tab])

  const newCount = normalised.filter((row) => row.status === MEETING_STATUS.withCsu).length

  const open = (row: MeetingDoc & { id: string }) => {
    setSelected(row)
    setNote(row.notes ?? "")
  }

  const act = async (next: "forward" | "decline") => {
    if (!selected || busy) return

    if (next === "decline" && !note.trim()) {
      toast.warning({
        title: "Give a reason",
        description: "The visitor sees this on their tracker, so it can't be blank.",
      })
      return
    }

    setBusy(true)
    const now = new Date().toISOString()

    try {
      await updateDoc(doc(db, COL.meetings, selected.id), {
        status: next === "forward" ? MEETING_STATUS.withDirector : MEETING_STATUS.declined,
        department: next === "forward" ? DEPARTMENT.director : DEPARTMENT.csu,
        notes: note,
        ...(next === "decline" ? { directorComment: note, responseDate: now } : {}),
        assignedTo: next === "forward" ? "director" : null,
        updatedAt: now,
      })

      if (next === "forward") {
        await addDoc(collection(db, COL.notifications), {
          userId: "director",
          content: `Meeting request forwarded by CSU — ${selected.fullName ?? "a visitor"}: ${truncate(
            selected.purpose,
            80,
          )}`,
          type: "message",
          referenceId: selected.id,
          isRead: false,
          createdAt: now,
        })
      }

      toast.success({
        title: next === "forward" ? "Sent to the Director" : "Request declined",
        description: selected.fullName ?? undefined,
      })
      setSelected(null)
      setNote("")
    } catch (err) {
      toast.error({
        title: "Not saved",
        description: err instanceof Error ? err.message : "Try again in a moment.",
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Panel
        title="Meeting requests"
        description={newCount ? `${newCount} waiting to be screened` : "Nothing new to screen"}
        actions={
          <Segmented
            value={tab}
            onChange={(v) => setTab(v as typeof tab)}
            options={[
              { value: "new", label: "To screen" },
              { value: "waiting", label: "With Director" },
              { value: "decided", label: "Decided" },
            ]}
          />
        }
        bodyClassName="p-3 sm:p-4"
      >
        {error ? (
          <LoadFailed error={error} what="Meeting requests" />
        ) : loading ? (
          <RowsSkeleton rows={4} columns={4} />
        ) : !rows.length ? (
          <EmptyState
            icon={CalendarDays}
            title={
              tab === "new"
                ? "Nothing to screen"
                : tab === "waiting"
                  ? "Nothing with the Director"
                  : "No decisions yet"
            }
            description="Requests filed from the public site arrive here for you to screen before they reach the Director."
          />
        ) : (
          <ul className="space-y-2">
            {rows.map((meeting, i) => (
              <li key={meeting.id} style={{ ["--i" as string]: Math.min(i, 8) }} className="reveal">
                <button
                  type="button"
                  onClick={() => open(meeting)}
                  className="flex w-full flex-col gap-2 rounded-lg border border-border bg-card px-3.5 py-3 text-left transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-semibold text-foreground">{meeting.fullName}</p>
                    <p className="text-[12.5px] text-muted-foreground">
                      {meeting.organization || meeting.email}
                    </p>
                    <p className="mt-1 text-[12.5px] text-muted-foreground">
                      {truncate(meeting.purpose, 72)}
                    </p>
                    {meetingDecided(meeting.status) && meeting.directorComment ? (
                      <p
                        className={cn(
                          "mt-1.5 text-[12px] italic",
                          meeting.status === MEETING_STATUS.declined
                            ? "text-[hsl(var(--state-stop))]"
                            : "text-[hsl(var(--state-clear))]",
                        )}
                      >
                        Director: {truncate(meeting.directorComment, 80)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatDate(meeting.preferredDate)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground">
                      <Clock3 className="h-3.5 w-3.5" />
                      {meeting.preferredTime || "—"}
                    </span>
                    <UrgencyPill urgency={meeting.urgency} />
                    <StatusPill status={meeting.status} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Sheet
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Meeting request"
        caption={selected ? `${selected.requestId ?? selected.id} · ${selected.fullName ?? ""}` : ""}
        width="max-w-xl"
        footer={
          selected ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <ActionButton tone="quiet" onClick={() => setSelected(null)}>
                Close
              </ActionButton>
              {selected.status === MEETING_STATUS.withCsu ? (
                <>
                  <ActionButton
                    tone="danger"
                    icon={XCircle}
                    disabled={busy}
                    onClick={() => act("decline")}
                  >
                    Decline here
                  </ActionButton>
                  <ActionButton icon={Forward} disabled={busy} onClick={() => act("forward")}>
                    Send to the Director
                  </ActionButton>
                </>
              ) : null}
            </div>
          ) : null
        }
      >
        {selected ? (
          <div className="space-y-6">
            <div>
              <SectionLabel>Visitor</SectionLabel>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Name" value={selected.fullName} />
                <Field label="Organisation" value={selected.organization} />
                <Field label="Email" value={selected.email} />
                <Field label="Phone" value={selected.phoneNumber} />
                <Field label="Preferred date" value={formatDate(selected.preferredDate)} />
                <Field label="Preferred time" value={selected.preferredTime} />
                <Field label="Urgency" value={<UrgencyPill urgency={selected.urgency} />} />
                <Field label="Submitted" value={formatDateTime(selected.createdAt)} />
                <Field label="Purpose" value={selected.purpose} className="col-span-2" />
              </div>

              {selected.supportingDocumentUrl ? (
                <a
                  href={selected.supportingDocumentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors hover:bg-muted"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  Supporting document
                </a>
              ) : null}
            </div>

            {meetingDecided(selected.status) ? (
              <div
                className={cn(
                  "rounded-lg border px-4 py-3",
                  selected.status === MEETING_STATUS.declined
                    ? "border-[hsl(var(--state-stop))]/30 bg-[hsl(var(--state-stop-soft))]"
                    : "border-[hsl(var(--state-clear))]/30 bg-[hsl(var(--state-clear-soft))]",
                )}
              >
                <div className="flex items-center gap-2">
                  {selected.status === MEETING_STATUS.declined ? (
                    <CalendarX className="h-4 w-4 text-[hsl(var(--state-stop))]" />
                  ) : (
                    <CalendarCheck className="h-4 w-4 text-[hsl(var(--state-clear))]" />
                  )}
                  <p className="text-[12.5px] font-semibold text-foreground">
                    The Director&rsquo;s decision
                  </p>
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-foreground">
                  {selected.directorComment || "No note was left."}
                </p>
                {selected.responseDate ? (
                  <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                    Recorded {formatDateTime(selected.responseDate)} · the visitor can see this on
                    their tracker
                  </p>
                ) : null}
              </div>
            ) : selected.status === MEETING_STATUS.withDirector ? (
              <p className="rounded-lg bg-muted/50 px-4 py-3 text-[13px] text-muted-foreground">
                Sent up and waiting on the Director. His answer will appear here and on the
                visitor&rsquo;s tracker at the same time.
              </p>
            ) : (
              <TextareaField
                id="csu-meeting-note"
                label="Your note"
                value={note}
                rows={3}
                placeholder="Context for the Director, or — if you're declining here — the reason the visitor will read."
                onChange={setNote}
              />
            )}
          </div>
        ) : null}
      </Sheet>
    </>
  )
}
