"use client"

import * as React from "react"
import { addDoc, collection, doc, limit, orderBy, updateDoc } from "firebase/firestore"
import {
  CalendarCheck,
  CalendarDays,
  CalendarX,

  Clock3,
  Forward,

  RotateCcw,
  Stamp,
  XCircle,
} from "lucide-react"
import { COL, db } from "@/lib/firebase"
import { DEPARTMENT, STATUS, stage } from "@/lib/workflow"
import { useRealtimeCollection } from "@/hooks/use-firestore"
import { formatDate, formatDateTime, truncate } from "@/lib/format"
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
import {
  WorkQueue,
  type QueueAction,
  type SubmissionRow,
} from "@/components/dashboard/work-queue"

/* ------------------------------------------------------------------ *
 * Applications
 *
 * The Director sits at four points in the two chains. What "accept" means
 * depends on which point the file is at, so the actions are built per row
 * rather than per view. Decline and return are always available, and both
 * demand a written reason.
 * ------------------------------------------------------------------ */

const decline: QueueAction = {
  key: "decline",
  label: "Decline",
  tone: "danger",
  icon: XCircle,
  status: STATUS.declined,
  department: DEPARTMENT.csu,
  record: "Declined by the Director",
  kind: "error",
  requiresReason: true,
}

const returnForChanges: QueueAction = {
  key: "return",
  label: "Return for changes",
  tone: "danger",
  icon: RotateCcw,
  status: STATUS.changesRequested,
  department: DEPARTMENT.csu,
  record: "Returned for changes by the Director",
  kind: "error",
  requiresReason: true,
}

function directorActions(row: SubmissionRow): QueueAction[] {
  const status = row.status ?? ""
  const base = [decline, returnForChanges]

  // Stage 2 — first look, straight after CSU.
  if (stage("withDirector").includes(status)) {
    return row.route === "first"
      ? [
          ...base,
          {
            key: "to-bd",
            label: "Accept — send for site visit",
            icon: Forward,
            status: STATUS.siteVisit,
            department: DEPARTMENT.businessDevelopment,
            record: "Accepted by the Director, sent for site visit",
          },
        ]
      : [
          ...base,
          {
            key: "to-monitoring",
            label: "Accept — send for inspection",
            icon: Forward,
            status: STATUS.inspection,
            department: DEPARTMENT.monitoring,
            record: "Accepted by the Director, sent for inspection",
          },
        ]
  }

  // Third party, stage 4 — Monitoring's report is back.
  if (stage("inspectionReported").includes(status) && row.route === "third") {
    return [
      ...base,
      {
        key: "to-planning",
        label: "Accept — send to Planning",
        icon: Forward,
        status: STATUS.planningReview,
        department: DEPARTMENT.planning,
        record: "Inspection accepted, sent to Planning",
      },
    ]
  }

  // Third party, stage 6 — Planning's report is back. Approval hands the file
  // to CSU, who register the applicant as a third party.
  if (status === STATUS.planningReported && row.route === "third") {
    return [
      ...base,
      {
        key: "approve-third",
        label: "Approve permit",
        icon: Stamp,
        status: STATUS.approved,
        department: DEPARTMENT.csu,
        record: "Permit approved by the Director",
        kind: "success",
        notify: "csu",
      },
    ]
  }

  // First party, stage 6 — Business Development recommends. The Director's
  // acceptance writes the holder straight into the first-party register.
  if (stage("recommended").includes(status) && row.route === "first") {
    return [
      ...base,
      {
        key: "approve-first",
        label: "Approve and register",
        icon: Stamp,
        status: STATUS.registered,
        department: DEPARTMENT.csu,
        record: "Permit approved and entered in the first-party register",
        kind: "success",
        notify: "csu",
        register: "first-party",
      },
    ]
  }

  return []
}

const DECISION_STATUSES = [
  ...stage("withDirector"),
  ...stage("inspectionReported"),
  ...stage("recommended"),
  STATUS.planningReported,
]

const IN_FLIGHT = [
  ...stage("siteVisit"),
  ...stage("visitReported"),
  ...stage("awaitingPayment"),
  STATUS.paymentConfirmed,
  ...stage("inspection"),
  STATUS.planningReview,
]

export function DirectorSubmissions() {
  return (
    <WorkQueue
      title="Applications"
      description="Every point in both chains where the decision is yours"
      actorId="director"
      views={[
        {
          value: "decisions",
          label: "Your decision",
          routes: ["first", "third"],
          statuses: DECISION_STATUSES,
          empty: {
            title: "Nothing waiting on you",
            body: "Files arrive here from CSU, from Business Development, and from Monitoring and Planning once their reports are in.",
          },
          actionsFor: directorActions,
          column: { header: "Route", render: (row) => (row.route === "first" ? "First party" : "Third party") },
        },
        {
          value: "moving",
          label: "With other desks",
          routes: ["first", "third"],
          statuses: IN_FLIGHT,
          empty: {
            title: "Nothing out with other desks",
            body: "Files you've routed to Business Development, Finance, Monitoring or Planning show up here until they come back.",
          },
          column: { header: "With", render: (row) => row.department ?? "—" },
        },
        {
          value: "closed",
          label: "Closed",
          routes: ["first", "third"],
          statuses: [
            STATUS.approved,
            STATUS.registered,
            STATUS.declined,
            STATUS.changesRequested,
            "Rejected",
          ],
          empty: {
            title: "Nothing closed yet",
            body: "Approved, declined and returned files stay here as the permanent record.",
          },
          column: {
            header: "Permit",
            render: (row) => (row.permitNumber ? <span className="font-mono text-[11.5px]">{row.permitNumber}</span> : "—"),
          },
        },
      ]}
    />
  )
}

/* ------------------------------------------------------------------ *
 * Meeting requests
 * ------------------------------------------------------------------ */

interface MeetingDoc {
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
  createdAt?: unknown
}

export function DirectorMeetings() {
  const [selected, setSelected] = React.useState<(MeetingDoc & { id: string }) | null>(null)
  const [reply, setReply] = React.useState("")
  const [busy, setBusy] = React.useState(false)

  const { data, loading, error } = useRealtimeCollection<MeetingDoc>(
    COL.meetings,
    [orderBy("createdAt", "desc"), limit(150)],
    [],
  )

  const rows = React.useMemo(
    () => data.filter((m) => ["forwarded", "approved", "rejected", "scheduled"].includes(m.status ?? "")),
    [data],
  )

  const decide = async (decision: "approved" | "rejected") => {
    if (!selected || busy) return
    if (decision === "rejected" && !reply.trim()) {
      toast.warning({
        title: "Give a reason",
        description: "CSU passes this back to the visitor, so it can't be blank.",
      })
      return
    }

    setBusy(true)
    const now = new Date().toISOString()
    try {
      await updateDoc(doc(db, COL.meetings, selected.id), {
        status: decision,
        directorComment: reply,
        responseDate: now,
        updatedAt: now,
      })
      await addDoc(collection(db, COL.notifications), {
        userId: "csu",
        content: `Meeting request for ${selected.fullName ?? "a visitor"} was ${decision} by the Director.${
          reply ? ` Note: ${reply}` : ""
        }`,
        type: decision === "approved" ? "success" : "error",
        referenceId: selected.id,
        isRead: false,
        createdAt: now,
      })
      toast.success({
        title: decision === "approved" ? "Meeting approved" : "Meeting rejected",
        description: selected.fullName ?? undefined,
      })
      setSelected(null)
      setReply("")
    } catch (err) {
      toast.error({
        title: "Decision not saved",
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
        description="Visitors CSU has forwarded for your decision"
        bodyClassName="p-3 sm:p-4"
      >
        {error ? (
          <LoadFailed error={error} what="Meeting requests" />
        ) : loading ? (
          <RowsSkeleton rows={4} columns={4} />
        ) : !rows.length ? (
          <EmptyState
            icon={CalendarDays}
            title="No meeting requests"
            description="CSU screens visitor requests first — the ones worth your time arrive here."
          />
        ) : (
          <ul className="space-y-2">
            {rows.map((meeting, i) => (
              <li key={meeting.id} style={{ ["--i" as string]: Math.min(i, 8) }} className="reveal">
                <button
                  type="button"
                  onClick={() => {
                    setSelected(meeting)
                    setReply("")
                  }}
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
        caption={selected?.fullName ?? ""}
        width="max-w-xl"
        footer={
          selected ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <ActionButton tone="quiet" onClick={() => setSelected(null)}>
                Close
              </ActionButton>
              {selected.status === "forwarded" ? (
                <>
                  <ActionButton tone="danger" icon={CalendarX} disabled={busy} onClick={() => decide("rejected")}>
                    Reject
                  </ActionButton>
                  <ActionButton icon={CalendarCheck} disabled={busy} onClick={() => decide("approved")}>
                    Approve
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
                <Field label="Requested" value={formatDateTime(selected.createdAt)} />
                <Field label="Purpose" value={selected.purpose} className="col-span-2" />
                {selected.notes ? (
                  <Field label="CSU notes" value={selected.notes} className="col-span-2" />
                ) : null}
              </div>
            </div>

            {selected.status !== "forwarded" ? (
              <div>
                <SectionLabel>Your decision</SectionLabel>
                <div className="space-y-2">
                  <StatusPill status={selected.status} />
                  {selected.directorComment ? (
                    <p className="text-[13px] text-muted-foreground">{selected.directorComment}</p>
                  ) : null}
                  {selected.responseDate ? (
                    <p className="text-[11.5px] text-muted-foreground">
                      Recorded {formatDateTime(selected.responseDate)}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <TextareaField
                id="meeting-reply"
                label="Note for CSU"
                value={reply}
                rows={3}
                placeholder="Required when rejecting. CSU passes this back to the visitor."
                onChange={setReply}
              />
            )}
          </div>
        ) : null}
      </Sheet>
    </>
  )
}


