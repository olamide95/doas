"use client"

import * as React from "react"
import { addDoc, collection, doc, limit, orderBy, updateDoc } from "firebase/firestore"
import { BadgeCheck, CalendarCheck, CalendarDays, CalendarX, Clock3, FileCheck2, FileWarning, Forward, MailCheck, Receipt, RotateCcw, Ruler, Split, Stamp, Undo2, XCircle } from "lucide-react"
import { COL, db } from "@/lib/firebase"
import { APPLICANT_DESK, CSU_DESK, DEPARTMENT, DIRECTOR_DESK, IN_FLIGHT, STATUS, VETTING_TRACKS, WITH_APPLICANT, initialVetting, stage } from "@/lib/workflow"
import { useRealtimeCollection } from "@/hooks/use-firestore"
import { formatDate, formatDateTime, naira, truncate } from "@/lib/format"
import { toast } from "@/components/ui/toast"
import { Sheet } from "@/components/dashboard/sheet"
import { ActionButton, TextareaField } from "@/components/dashboard/form-kit"
import { EmptyState, Field, LoadFailed, Panel, RowsSkeleton, SectionLabel, StatusPill, UrgencyPill } from "@/components/dashboard/kit"
import { WorkQueue, type QueueAction, type SubmissionRow } from "@/components/dashboard/work-queue"

/* ------------------------------------------------------------------ *
 * The gatekeeper desk. Every inter-department move is decided here.
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
  notifyApplicant: "Your application was declined by the Director",
}

const returnForChanges: QueueAction = {
  key: "return",
  label: "Return for changes",
  tone: "danger",
  icon: RotateCcw,
  status: STATUS.changesRequested,
  department: DEPARTMENT.csu,
  record: "Returned to applicant for changes by the Director",
  kind: "error",
  requiresReason: true,
  notifyApplicant: "Your application was returned for changes",
}

const requestCorrectedDocuments: QueueAction = {
  key: "redo-documents",
  label: "Request corrected documents",
  tone: "danger",
  icon: FileWarning,
  status: STATUS.documentsRequested,
  department: APPLICANT_DESK,
  record: "Corrected technical documents requested by the Director",
  kind: "error",
  requiresReason: true,
  notifyApplicant: "Upload corrected technical documents",
}

function fieldDesk(row: SubmissionRow) {
  return row.route === "first"
    ? { status: STATUS.siteVisit, department: DEPARTMENT.businessDevelopment, name: "Business Development", verb: "site visit" }
    : { status: STATUS.planningReview, department: DEPARTMENT.planning, name: "Planning & Development", verb: "site inspection" }
}

const toBilling = (label: string, record: string, reason = false): QueueAction => ({
  key: reason ? "billing-reason" : "to-billing",
  label,
  tone: reason ? "danger" : "primary",
  icon: Receipt,
  status: STATUS.billingAssessment,
  department: DEPARTMENT.billing,
  record,
  requiresReason: reason,
})

export function directorActions(row: SubmissionRow): QueueAction[] {
  const s = row.status ?? ""
  const field = fieldDesk(row)
  const third = row.route === "third"

  const toField = (reason: boolean): QueueAction => ({
    key: reason ? "back-to-field" : "to-field",
    label: reason ? `Send back to ${field.name}` : `Accept — send for ${field.verb}`,
    tone: reason ? "danger" : "primary",
    icon: reason ? Undo2 : Forward,
    status: field.status,
    department: field.department,
    record: reason ? `Returned to ${field.name} for re-inspection by the Director` : `Digital signature appended — routed to ${field.name} for ${field.verb}`,
    requiresReason: reason,
  })

  if (stage("withDirector").includes(s)) return [decline, returnForChanges, toField(false)]

  /* ---- First party: BD measurements → Billing ---- */
  if (!third && stage("visitReported").includes(s)) {
    const actions: QueueAction[] = [toField(true)]
    if (row.measurements?.items?.length) actions.push(toBilling("Verify measurements — send to Billing", "Measurements verified by the Director — routed to Billing"))
    return actions
  }

  /* ---- Third party: site inspection → documents request ---- */
  if (third && stage("planningReported").includes(s)) {
    const clash = String(row.technicalReport?.clashDetectionStatus ?? "")
    const recommended = String(row.technicalReport?.recommendation ?? "Recommended") !== "Not recommended"
    const actions: QueueAction[] = clash === "Rejected_Overlap" || !recommended ? [decline, toField(true)] : [toField(true)]
    if (row.measurements?.items?.length && clash !== "Rejected_Overlap")
      actions.push({
        key: "clear-documents",
        label: recommended ? "Confirm recommendation — send to CSU for documents" : "Overrule — clear for documents",
        icon: FileCheck2,
        status: STATUS.documentsCleared,
        department: DEPARTMENT.csu,
        record: "Site inspection confirmed by the Director — CSU to request technical documents",
        requiresReason: !recommended,
      })
    return actions
  }

  /* ---- Third party: documents → parallel technical vetting ---- */
  if (stage("documentsVerified").includes(s))
    return [
      decline,
      requestCorrectedDocuments,
      {
        key: "to-vetting",
        label: "Confirm — send for technical vetting",
        icon: Split,
        status: STATUS.technicalVetting,
        department: DEPARTMENT.planning,
        record: "Documents confirmed by the Director — EIA to Planning & Development; soil test and structural drawing to Monitoring",
        notify: "planning_development",
        alsoNotify: ["monitoring_enforcement"],
        patch: (r) => ({ vetting: initialVetting(r.files), vettingStartedAt: new Date().toISOString() }),
        notifyApplicant: "Your documents have gone for technical vetting",
      },
    ]

  if (stage("vettingReported").includes(s)) {
    const unsatisfactory = VETTING_TRACKS.some((t) => row.vetting?.[t.key]?.report?.recommendation === "Unsatisfactory")
    return [
      ...(unsatisfactory ? [decline] : []),
      requestCorrectedDocuments,
      {
        key: "re-vet",
        label: "Return to the units for re-vetting",
        tone: "danger",
        icon: Undo2,
        status: STATUS.technicalVetting,
        department: DEPARTMENT.planning,
        record: "Vetting reports returned to the units by the Director",
        requiresReason: true,
        notify: "planning_development",
        alsoNotify: ["monitoring_enforcement"],
        patch: (r, { note }) => {
          const out: Record<string, unknown> = {}
          VETTING_TRACKS.forEach((t) => {
            if (r.vetting?.[t.key]) {
              out[`vetting.${t.key}.state`] = r.vetting[t.key].assignedTo ? "returned" : "unassigned"
              out[`vetting.${t.key}.returnReason`] = note
            }
          })
          return out
        },
      },
      toBilling(
        unsatisfactory ? "Overrule — approve vetting and send to Billing" : "Approve vetting — send to Billing",
        "Technical vetting approved by the Director — routed to Billing",
        unsatisfactory,
      ),
    ]
  }

  if (stage("billingQueried").includes(s)) return [toField(true), toBilling("Overrule query — return to Billing", "Billing query overruled by the Director", true)]

  if (stage("billProposed").includes(s))
    return [
      toBilling("Return for repricing", "Pricing returned to Billing by the Director", true),
      // New third-party permits go through Finance's Remita invoice; renewals keep the direct invoice route.
      third && !row.registerId
        ? {
            key: "confirm-price",
            label: `Confirm ${naira(row.billing?.netInvoiceAmount as number)} — send to Finance for Remita`,
            icon: BadgeCheck,
            status: STATUS.billApproved,
            department: DEPARTMENT.finance,
            record: s === STATUS.renewalProposed ? "Renewal pricing confirmed by the Director — Finance to raise Remita" : "Bill confirmed by the Director — Finance to raise Remita",
          }
        : {
            key: "confirm-price",
            label: `Confirm ${naira(row.billing?.netInvoiceAmount as number)} — issue invoice`,
            icon: BadgeCheck,
            status: STATUS.awaitingPayment,
            department: DEPARTMENT.finance,
            record: s === STATUS.renewalProposed ? "Renewal pricing confirmed by the Director — invoice issued" : "Pricing confirmed by the Director — invoice issued",
          },
    ]

  if (stage("paymentFlagged").includes(s))
    return [
      decline,
      {
        key: "reverify",
        label: "Return to Finance to re-verify",
        tone: "danger",
        icon: Undo2,
        status: STATUS.awaitingPayment,
        department: DEPARTMENT.finance,
        record: "Flagged payment returned to Finance by the Director",
        requiresReason: true,
      },
    ]

  if (stage("paymentReconciled").includes(s))
    return [
      {
        key: "sign",
        label: row.registerId ? "Sign renewal — extend permit" : "Sign off — issue permit",
        icon: Stamp,
        status: STATUS.registered,
        department: DEPARTMENT.csu,
        record: row.registerId ? "Permit renewed and signed by the Director" : "Permit signed and issued by the Director",
        kind: "success",
        notify: "csu",
        register: row.route === "first" ? "first-party" : "third-party",
      },
    ]

  /* ---- Third party: setting out ---- */
  if (stage("settingOutWithDirector").includes(s))
    return [
      {
        key: "to-setting-out",
        label: "Send to Monitoring for setting out",
        icon: Ruler,
        status: STATUS.settingOut,
        department: DEPARTMENT.monitoring,
        record: "Setting out approved by the Director — routed to Monitoring & Enforcement",
        notifyApplicant: "Monitoring will contact you to set out the site",
      },
    ]

  if (stage("settingOutReported").includes(s)) {
    const ok = String(row.settingOutReport?.recommendation ?? "") !== "Not recommended"
    return [
      {
        key: "redo-setting-out",
        label: "Return to Monitoring",
        tone: "danger",
        icon: Undo2,
        status: STATUS.settingOut,
        department: DEPARTMENT.monitoring,
        record: "Setting-out report returned to Monitoring by the Director",
        requiresReason: true,
      },
      {
        key: "certificate",
        label: ok ? "Approve — issue setting-out certificate" : "Overrule — issue setting-out certificate",
        icon: Stamp,
        status: STATUS.certificateIssued,
        department: DEPARTMENT.csu,
        record: "Setting out approved — certificate signed by the Director",
        kind: "success",
        notify: "csu",
        requiresReason: !ok,
        register: "third-party",
        issue: "settingOutCertificate",
      },
    ]
  }

  if (stage("certificateReleased").includes(s))
    return [
      {
        key: "approval-letter",
        label: "Issue approval letter",
        icon: MailCheck,
        status: STATUS.approvalIssued,
        department: DEPARTMENT.csu,
        record: "Approval letter signed by the Director — CSU to release",
        kind: "success",
        notify: "csu",
        issue: "approvalLetter",
      },
    ]

  return []
}

export function DirectorSubmissions() {
  return (
    <WorkQueue
      title="Director's desk"
      description="Every file waiting for your signature before it can move"
      actorId="director"
      views={[
        {
          value: "decisions",
          label: "Your decision",
          routes: ["first", "third"],
          statuses: DIRECTOR_DESK,
          empty: { title: "Nothing waiting on you", body: "Files arrive here between every desk — intake, inspections, documents, vetting, bills, payments and setting out." },
          actionsFor: directorActions,
          column: { header: "Stage", render: (row) => row.status ?? "—" },
        },
        {
          value: "moving",
          label: "With other desks",
          routes: ["first", "third"],
          statuses: [...IN_FLIGHT, ...CSU_DESK, ...WITH_APPLICANT],
          empty: { title: "Nothing out with other desks", body: "Files you've routed onward show here until they come back." },
          column: { header: "With", render: (row) => row.department ?? "—" },
        },
        {
          value: "closed",
          label: "Closed",
          routes: ["first", "third"],
          statuses: [...stage("issued"), ...stage("blocked")],
          empty: { title: "Nothing closed yet", body: "Approved, declined and returned files stay here." },
          column: { header: "Permit", render: (row) => (row.permitNumber ? <span className="font-mono text-[11.5px]">{row.permitNumber}</span> : "—") },
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

  const { data, loading, error } = useRealtimeCollection<MeetingDoc>(COL.meetings, [orderBy("createdAt", "desc"), limit(150)], [])
  const rows = React.useMemo(() => data.filter((m) => ["forwarded", "approved", "rejected", "scheduled"].includes(m.status ?? "")), [data])

  const decide = async (decision: "approved" | "rejected") => {
    if (!selected || busy) return
    if (decision === "rejected" && !reply.trim()) {
      toast.warning({ title: "Give a reason", description: "The visitor sees this." })
      return
    }
    setBusy(true)
    const now = new Date().toISOString()
    try {
      await updateDoc(doc(db, COL.meetings, selected.id), { status: decision, directorComment: reply, responseDate: now, updatedAt: now })
      await addDoc(collection(db, COL.notifications), {
        userId: "csu",
        content: `Meeting request for ${selected.fullName ?? "a visitor"} was ${decision} by the Director.${reply ? ` Note: ${reply}` : ""}`,
        type: decision === "approved" ? "success" : "error",
        referenceId: selected.id,
        isRead: false,
        createdAt: now,
      })
      toast.success({ title: decision === "approved" ? "Meeting approved" : "Meeting rejected", description: selected.fullName })
      setSelected(null)
      setReply("")
    } catch (err) {
      toast.error({ title: "Decision not saved", description: err instanceof Error ? err.message : "Try again." })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Panel title="Meeting requests" description="Visitors CSU has forwarded for your decision" bodyClassName="p-3 sm:p-4">
        {error ? (
          <LoadFailed error={error} what="Meeting requests" />
        ) : loading ? (
          <RowsSkeleton rows={4} columns={4} />
        ) : !rows.length ? (
          <EmptyState icon={CalendarDays} title="No meeting requests" description="CSU screens requests first — the ones worth your time arrive here." />
        ) : (
          <ul className="space-y-2">
            {rows.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(m)
                    setReply("")
                  }}
                  className="flex w-full flex-col gap-2 rounded-lg border border-border bg-card px-3.5 py-3 text-left hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-semibold text-foreground">{m.fullName}</p>
                    <p className="text-[12.5px] text-muted-foreground">{m.organization || m.email}</p>
                    <p className="mt-1 text-[12.5px] text-muted-foreground">{truncate(m.purpose, 72)}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatDate(m.preferredDate)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground">
                      <Clock3 className="h-3.5 w-3.5" />
                      {m.preferredTime || "—"}
                    </span>
                    <UrgencyPill urgency={m.urgency} />
                    <StatusPill status={m.status} />
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
            <div className="flex flex-wrap justify-end gap-2">
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
                {selected.notes ? <Field label="CSU notes" value={selected.notes} className="col-span-2" /> : null}
              </div>
            </div>
            {selected.status !== "forwarded" ? (
              <div>
                <SectionLabel>Your decision</SectionLabel>
                <StatusPill status={selected.status} />
                {selected.directorComment ? <p className="mt-2 text-[13px] text-muted-foreground">{selected.directorComment}</p> : null}
              </div>
            ) : (
              <TextareaField id="meeting-reply" label="Note for CSU" value={reply} rows={3} placeholder="Required when rejecting." onChange={setReply} />
            )}
          </div>
        ) : null}
      </Sheet>
    </>
  )
}
