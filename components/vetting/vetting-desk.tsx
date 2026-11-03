"use client"

import * as React from "react"
import { addDoc, arrayUnion, collection, doc, runTransaction, updateDoc, where, type DocumentData, type UpdateData } from "firebase/firestore"
import { CheckCircle2, ClipboardCheck, FileSearch, Loader2, Paperclip, Send, Undo2, UserPlus } from "lucide-react"
import { COL, db } from "@/lib/firebase"
import {
  DEPARTMENT,
  STATUS,
  VETTING_TRACKS,
  notifyIdFor,
  stage,
  tracksFor,
  vettingComplete,
  type VettingReport,
  type VettingTrackDef,
  type VettingTrackState,
} from "@/lib/workflow"
import { isUnitHead } from "@/lib/roles"
import { uploadRecordFile } from "@/lib/practitioner-registry"
import { useRealtimeCollection } from "@/hooks/use-firestore"
import { formatDate, formatDateTime, truncate } from "@/lib/format"
import { toast } from "@/components/ui/toast"
import { useStaff } from "@/components/auth/staff-context"
import { Sheet } from "@/components/dashboard/sheet"
import { ActionButton, SearchField, SelectField, TextareaField } from "@/components/dashboard/form-kit"
import { EmptyState, Field, LoadFailed, Panel, RowsSkeleton, SectionLabel, StatTile, StatusPill } from "@/components/dashboard/kit"
import { Segmented } from "@/components/dashboard/notifications-panel"
import { ApplicationSummary, LockedMeasurements, collectionFor, useSubmissions, type SubmissionRow } from "@/components/dashboard/work-queue"
import { AuditTimeline, type AuditEntry } from "@/components/dashboard/audit-timeline"
import { cn } from "@/lib/utils"

/**
 * Parallel technical vetting.
 *
 * After the Director confirms the practitioner's documents, each document is
 * vetted by its unit: the EIA by Planning & Development, the soil test and
 * structural drawing by Monitoring & Enforcement. In each unit the head
 * assigns an officer, the officer files a vetting report, and the head
 * confirms it. When every track across both units is confirmed the file
 * goes back to the Director automatically.
 */

interface StaffDoc {
  name?: string
  email?: string
  department?: string
  designation?: string
  active?: boolean
}

interface Item {
  row: SubmissionRow
  def: VettingTrackDef
  track: VettingTrackState
}

type ViewKey = "unassigned" | "assigned" | "confirm" | "mine" | "submitted" | "done"

const ACTIVE = (row: SubmissionRow) => stage("technicalVetting").includes(row.status ?? "")

export function VettingDesk({ department, actorId }: { department: string; actorId: string }) {
  const { staff: me } = useStaff()
  const head = isUnitHead(me?.designation) || me?.department === DEPARTMENT.director
  const { rows, loading, error } = useSubmissions()
  const team = useRealtimeCollection<StaffDoc>(COL.staff, [where("department", "==", department)], [department])

  const [view, setView] = React.useState<ViewKey>(head ? "unassigned" : "mine")
  const [search, setSearch] = React.useState("")
  const [selected, setSelected] = React.useState<{ id: string; key: string } | null>(null)

  const defs = tracksFor(department)

  const items = React.useMemo<Item[]>(() => {
    const out: Item[] = []
    rows.forEach((row) => {
      if (!row.vetting) return
      defs.forEach((def) => {
        const track = row.vetting?.[def.key]
        if (track) out.push({ row, def, track })
      })
    })
    return out
  }, [rows, defs])

  const mine = (i: Item) => Boolean(me && i.track.assignedTo === me.uid)

  const buckets: Record<ViewKey, Item[]> = React.useMemo(
    () => ({
      unassigned: items.filter((i) => ACTIVE(i.row) && (i.track.state === "unassigned" || (i.track.state === "returned" && !i.track.assignedTo))),
      assigned: items.filter((i) => ACTIVE(i.row) && (i.track.state === "assigned" || (i.track.state === "returned" && Boolean(i.track.assignedTo)))),
      confirm: items.filter((i) => ACTIVE(i.row) && i.track.state === "reported"),
      mine: items.filter((i) => ACTIVE(i.row) && mine(i) && (i.track.state === "assigned" || i.track.state === "returned")),
      submitted: items.filter((i) => mine(i) && (i.track.state === "reported" || i.track.state === "confirmed")),
      done: items.filter((i) => i.track.state === "confirmed"),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, me?.uid],
  )

  const views: { value: ViewKey; label: string }[] = head
    ? [
        { value: "unassigned", label: `To assign (${buckets.unassigned.length})` },
        { value: "assigned", label: `With officers (${buckets.assigned.length})` },
        { value: "confirm", label: `To confirm (${buckets.confirm.length})` },
        { value: "mine", label: `Mine (${buckets.mine.length})` },
        { value: "done", label: "Confirmed" },
      ]
    : [
        { value: "mine", label: `My assignments (${buckets.mine.length})` },
        { value: "submitted", label: "Submitted" },
      ]

  const term = search.trim().toLowerCase()
  const visible = buckets[view].filter((i) =>
    term ? [i.row.companyName, i.row.submissionId, i.row.signageSiteAddress, i.track.assignedToName].filter(Boolean).some((v) => String(v).toLowerCase().includes(term)) : true,
  )

  const current = selected ? items.find((i) => i.row.id === selected.id && i.def.key === selected.key) ?? null : null

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {head ? (
          <>
            <StatTile index={0} label="Waiting to be assigned" value={buckets.unassigned.length} tone="wait" icon={UserPlus} onClick={() => setView("unassigned")} />
            <StatTile index={1} label="With officers" value={buckets.assigned.length} tone="move" icon={FileSearch} onClick={() => setView("assigned")} />
            <StatTile index={2} label="Reports to confirm" value={buckets.confirm.length} tone="wait" icon={ClipboardCheck} onClick={() => setView("confirm")} />
            <StatTile index={3} label="Confirmed" value={buckets.done.length} tone="clear" icon={CheckCircle2} onClick={() => setView("done")} />
          </>
        ) : (
          <>
            <StatTile index={0} label="My assignments" value={buckets.mine.length} tone="wait" icon={FileSearch} onClick={() => setView("mine")} />
            <StatTile index={1} label="Reports submitted" value={buckets.submitted.length} tone="move" icon={Send} onClick={() => setView("submitted")} />
          </>
        )}
      </div>

      <Panel
        title="Technical vetting"
        description={`${defs.map((d) => d.label).join(" and ")} — ${head ? "assign officers and confirm their reports" : "vet the documents assigned to you"}`}
        actions={<Segmented value={view} onChange={(v) => setView(v as ViewKey)} options={views} />}
        bodyClassName="p-0"
      >
        <div className="border-b border-border p-3 sm:px-5">
          <SearchField value={search} onChange={setSearch} placeholder="Search by company, reference, site or officer" />
        </div>
        <div className="p-3 sm:p-4">
          {error ? (
            <LoadFailed error={error} what="Vetting files" />
          ) : loading ? (
            <RowsSkeleton rows={5} columns={5} />
          ) : !visible.length ? (
            <EmptyState
              icon={FileSearch}
              title="Nothing here"
              description={
                view === "mine"
                  ? "Documents your head of unit assigns to you appear here."
                  : "Files reach technical vetting after the Director confirms the practitioner's documents."
              }
            />
          ) : (
            <div className="overflow-x-auto scroll-slim">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-border text-[11.5px] font-semibold text-muted-foreground">
                    <th className="px-3 py-2.5">Reference</th>
                    <th className="px-3 py-2.5">Practitioner</th>
                    <th className="px-3 py-2.5">Document</th>
                    <th className="hidden px-3 py-2.5 md:table-cell">Officer</th>
                    <th className="px-3 py-2.5">State</th>
                    <th className="hidden px-3 py-2.5 sm:table-cell">Since</th>
                    <th className="px-3 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((i, n) => (
                    <tr key={`${i.row.id}-${i.def.key}`} style={{ ["--i" as string]: Math.min(n, 10) }} className="reveal border-b border-border/70 last:border-0 hover:bg-muted/50">
                      <td className="px-3 py-3 font-mono text-[12px] text-muted-foreground">{i.row.submissionId ?? i.row.id.slice(0, 8)}</td>
                      <td className="px-3 py-3">
                        <p className="text-[13.5px] font-medium text-foreground">{i.row.companyName ?? "—"}</p>
                        <p className="text-[11.5px] text-muted-foreground">{truncate(i.row.signageSiteAddress, 40)}</p>
                      </td>
                      <td className="px-3 py-3 text-[13px] text-foreground">{i.def.short}</td>
                      <td className="hidden px-3 py-3 text-[12.5px] text-muted-foreground md:table-cell">{i.track.assignedToName ?? "—"}</td>
                      <td className="px-3 py-3">
                        <StatusPill status={i.track.state} />
                      </td>
                      <td className="hidden px-3 py-3 text-[12.5px] text-muted-foreground sm:table-cell">
                        {formatDate(i.track.report?.submittedAt ?? i.track.assignedAt ?? i.row.updatedAt)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <ActionButton tone="quiet" onClick={() => setSelected({ id: i.row.id, key: i.def.key })}>
                          Open
                        </ActionButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Panel>

      {current ? (
        <VettingSheet
          item={current}
          head={head}
          me={me ? { uid: me.uid, name: me.name } : null}
          team={team.data.filter((t) => t.active !== false)}
          actorId={actorId}
          department={department}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  )
}

function emptyReport(def: VettingTrackDef, existing?: VettingReport): Omit<VettingReport, "submittedAt" | "submittedBy" | "submittedByName"> {
  return {
    findings: existing?.findings ?? "",
    checklist: existing?.checklist ?? Object.fromEntries(def.checklist.map((c) => [c, false])),
    recommendation: existing?.recommendation ?? "",
    attachmentUrl: existing?.attachmentUrl ?? "",
  }
}

function VettingSheet({
  item,
  head,
  me,
  team,
  actorId,
  department,
  onClose,
}: {
  item: Item
  head: boolean
  me: { uid: string; name: string } | null
  team: (StaffDoc & { id: string })[]
  actorId: string
  department: string
  onClose: () => void
}) {
  const { row, def, track } = item
  const [officer, setOfficer] = React.useState(track.assignedTo ?? "")
  const [note, setNote] = React.useState("")
  const [report, setReport] = React.useState(() => emptyReport(def, track.report))
  const [busy, setBusy] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)

  const ref = doc(db, collectionFor(row.route), row.id)
  const path = (field: string) => `vetting.${def.key}.${field}`
  const isMine = Boolean(me && track.assignedTo === me.uid)
  const active = stage("technicalVetting").includes(row.status ?? "")

  const canAssign = head && active && ["unassigned", "assigned", "returned"].includes(track.state)
  const canReport = isMine && active && ["assigned", "returned"].includes(track.state)
  const canConfirm = head && active && track.state === "reported"

  const entry = (action: string, text?: string): AuditEntry => ({
    timestamp: new Date().toISOString(),
    desk: actorId,
    action,
    text: text || action,
    from: department,
    to: department,
    status: row.status,
  })

  const desk = async (content: string, audience = notifyIdFor(department)) => {
    await addDoc(collection(db, COL.notifications), { userId: audience, content, type: "info", referenceId: row.id, isRead: false, createdAt: new Date().toISOString() })
  }

  const wrap = async (fn: () => Promise<void>, success: string) => {
    if (busy) return
    setBusy(true)
    try {
      await fn()
      toast.success({ title: success, description: row.submissionId })
      onClose()
    } catch (err) {
      toast.error({ title: "Not saved", description: err instanceof Error ? err.message : "Try again." })
    } finally {
      setBusy(false)
    }
  }

  const assign = () => {
    const person = team.find((t) => t.id === officer)
    if (!person) {
      toast.warning({ title: "Choose an officer" })
      return
    }
    const now = new Date().toISOString()
    return wrap(async () => {
      await updateDoc(ref, {
        [path("state")]: "assigned",
        [path("assignedTo")]: person.id,
        [path("assignedToName")]: person.name ?? person.email ?? "",
        [path("assignedAt")]: now,
        [path("assignedBy")]: me?.uid ?? actorId,
        [path("headNote")]: note.trim(),
        updatedAt: now,
        comments: arrayUnion(entry(`${def.short} assigned to ${person.name ?? person.email} for vetting`, note.trim())),
      })
      await desk(`${def.short} for ${row.companyName ?? row.submissionId} assigned to ${person.name ?? person.email}`)
    }, `Assigned to ${person.name ?? person.email}`)
  }

  const uploadAttachment = async (file?: File) => {
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      toast.warning({ title: "File too large", description: "Keep attachments under 10 MB." })
      return
    }
    setUploading(true)
    try {
      const stored = await uploadRecordFile(`vetting/${row.id}`, def.key, file)
      setReport((r) => ({ ...r, attachmentUrl: stored.url }))
    } catch (err) {
      toast.error({ title: "Upload failed", description: err instanceof Error ? err.message : "Try again." })
    } finally {
      setUploading(false)
    }
  }

  const submitReport = () => {
    if (!report.findings.trim()) {
      toast.warning({ title: "Write your findings" })
      return
    }
    if (!report.recommendation) {
      toast.warning({ title: "Choose Satisfactory or Unsatisfactory" })
      return
    }
    const now = new Date().toISOString()
    const full: VettingReport = { ...report, findings: report.findings.trim(), submittedAt: now, submittedBy: me?.uid ?? actorId, submittedByName: me?.name ?? "" }
    return wrap(async () => {
      await updateDoc(ref, {
        [path("state")]: "reported",
        [path("report")]: full,
        [path("returnReason")]: "",
        updatedAt: now,
        comments: arrayUnion(entry(`${def.short} vetting report filed — ${full.recommendation}`, truncate(full.findings, 200))),
      })
      await desk(`${def.short} vetting report for ${row.companyName ?? row.submissionId} is ready for your confirmation`)
    }, "Report submitted to your head of unit")
  }

  const returnToOfficer = () => {
    if (!note.trim()) {
      toast.warning({ title: "Give a reason", description: "The officer sees this." })
      return
    }
    const now = new Date().toISOString()
    return wrap(async () => {
      await updateDoc(ref, {
        [path("state")]: "returned",
        [path("returnReason")]: note.trim(),
        updatedAt: now,
        comments: arrayUnion(entry(`${def.short} vetting report returned to ${track.assignedToName ?? "the officer"}`, note.trim())),
      })
    }, "Returned to the officer")
  }

  const confirm = () =>
    wrap(async () => {
      let allDone = false
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref)
        if (!snap.exists()) throw new Error("This file no longer exists.")
        const data = snap.data() as SubmissionRow
        if (!stage("technicalVetting").includes(data.status ?? "")) throw new Error("This file has already left technical vetting.")
        const now = new Date().toISOString()
        const vetting = { ...(data.vetting ?? {}) } as Record<string, VettingTrackState>
        vetting[def.key] = { ...vetting[def.key], state: "confirmed", headNote: note.trim(), confirmedAt: now, confirmedBy: me?.uid ?? actorId, confirmedByName: me?.name ?? "" }
        allDone = vettingComplete(vetting)
        const update: Record<string, unknown> = {
          [path("state")]: "confirmed",
          [path("headNote")]: note.trim(),
          [path("confirmedAt")]: now,
          [path("confirmedBy")]: me?.uid ?? actorId,
          [path("confirmedByName")]: me?.name ?? "",
          updatedAt: now,
          comments: arrayUnion(
            entry(`${def.short} vetting confirmed by head of ${department}${allDone ? " — all vetting complete, sent to the Director" : ""}`, note.trim()),
          ),
        }
        if (allDone) {
          update.status = STATUS.vettingReported
          update.department = DEPARTMENT.director
          update.vettingCompletedAt = now
        }
        tx.update(ref, update as UpdateData<DocumentData>)
      })
      if (allDone) await desk(`Technical vetting complete for ${row.companyName ?? row.submissionId} — ready for your decision`, "director")
    }, "Vetting confirmed")

  const pending = VETTING_TRACKS.filter((t) => row.vetting?.[t.key] && row.vetting[t.key].state !== "confirmed" && t.key !== def.key)

  return (
    <Sheet
      open
      onClose={onClose}
      title={`${def.label} — vetting`}
      caption={`${row.submissionId ?? row.id} · ${row.companyName ?? ""}`}
      width="max-w-3xl"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ActionButton tone="quiet" onClick={onClose}>
            Close
          </ActionButton>
          {canAssign ? (
            <ActionButton icon={busy ? Loader2 : UserPlus} disabled={busy} onClick={assign}>
              {track.assignedTo ? "Reassign" : "Assign officer"}
            </ActionButton>
          ) : null}
          {canReport ? (
            <ActionButton icon={busy ? Loader2 : Send} disabled={busy || uploading} onClick={submitReport}>
              Submit report to head of unit
            </ActionButton>
          ) : null}
          {canConfirm ? (
            <>
              <ActionButton tone="danger" icon={Undo2} disabled={busy} onClick={returnToOfficer}>
                Return to officer
              </ActionButton>
              <ActionButton icon={busy ? Loader2 : CheckCircle2} disabled={busy} onClick={confirm}>
                Confirm — send to Director
              </ActionButton>
            </>
          ) : null}
        </div>
      }
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={track.state} />
          <span className="text-[12.5px] text-muted-foreground">File status: {row.status}</span>
        </div>

        {track.state === "returned" && track.returnReason ? (
          <div className="rounded-lg border border-[hsl(var(--state-stop))]/30 bg-[hsl(var(--state-stop-soft))] px-4 py-3">
            <p className="text-[12.5px] font-semibold text-[hsl(var(--state-stop))]">Returned</p>
            <p className="mt-1 text-[13px] text-foreground">{track.returnReason}</p>
          </div>
        ) : null}

        <div>
          <SectionLabel>Document to vet</SectionLabel>
          {track.documentUrl || row.files?.[def.key] ? (
            <a
              href={String(track.documentUrl || row.files?.[def.key])}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[13px] font-semibold text-accent hover:bg-muted"
            >
              <FileSearch className="h-4 w-4" /> Open {def.label}
            </a>
          ) : (
            <p className="text-[13px] text-[hsl(var(--state-stop))]">The practitioner&rsquo;s document is missing from the file.</p>
          )}
          {pending.length ? <p className="mt-2 text-[12px] text-muted-foreground">Still open on this file: {pending.map((t) => `${t.short} (${t.department})`).join(", ")}</p> : null}
        </div>

        <ApplicationSummary row={row} />
        {row.measurements ? <LockedMeasurements m={row.measurements} /> : null}

        <div>
          <SectionLabel>Assignment</SectionLabel>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Officer" value={track.assignedToName} />
            <Field label="Assigned" value={formatDateTime(track.assignedAt)} />
            {track.headNote ? <Field label="Head of unit's note" value={track.headNote} className="col-span-2" /> : null}
          </div>
          {canAssign ? (
            <div className="mt-3">
              <SelectField
                id="vet-officer"
                label="Assign to"
                value={officer}
                onChange={setOfficer}
                options={team.map((t) => ({ value: t.id, label: `${t.name ?? t.email ?? t.id}${t.designation ? ` — ${t.designation}` : ""}` }))}
                hint={team.length ? "Heads of unit can assign to themselves." : `No active staff found in ${department}. Staff Admin can add them.`}
              />
            </div>
          ) : null}
        </div>

        {track.report && !canReport ? (
          <div>
            <SectionLabel>Vetting report</SectionLabel>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Officer" value={track.report.submittedByName} />
              <Field label="Submitted" value={formatDateTime(track.report.submittedAt)} />
              <Field label="Recommendation" value={<StatusPill status={track.report.recommendation} />} />
              {track.report.attachmentUrl ? (
                <Field
                  label="Attachment"
                  value={
                    <a href={track.report.attachmentUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent underline-offset-4 hover:underline">
                      Open
                    </a>
                  }
                />
              ) : null}
              <Field label="Findings" value={track.report.findings} className="col-span-2" />
            </div>
            <ul className="mt-3 space-y-1">
              {Object.entries(track.report.checklist ?? {}).map(([item, ok]) => (
                <li key={item} className="flex items-center gap-2 text-[12.5px]">
                  <span className={cn("h-2 w-2 rounded-full", ok ? "bg-[hsl(var(--state-clear))]" : "bg-[hsl(var(--state-stop))]")} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {canReport ? (
          <div>
            <SectionLabel>Your vetting report</SectionLabel>
            <ul className="space-y-2">
              {def.checklist.map((item) => (
                <li key={item}>
                  <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border px-3 py-2 text-[13px] hover:bg-muted/50">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={Boolean(report.checklist[item])}
                      onChange={(e) => setReport((r) => ({ ...r, checklist: { ...r.checklist, [item]: e.target.checked } }))}
                    />
                    {item}
                  </label>
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-4">
              <TextareaField id="vet-findings" label="Findings" rows={5} value={report.findings} onChange={(v) => setReport((r) => ({ ...r, findings: v }))} />
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  id="vet-rec"
                  label="Recommendation"
                  value={report.recommendation}
                  onChange={(v) => setReport((r) => ({ ...r, recommendation: v as VettingReport["recommendation"] }))}
                  options={[
                    { value: "Satisfactory", label: "Satisfactory" },
                    { value: "Unsatisfactory", label: "Unsatisfactory" },
                  ]}
                />
                <div>
                  <p className="mb-1.5 text-[12.5px] font-medium text-foreground">Supporting attachment (optional)</p>
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[12.5px] font-semibold hover:bg-muted">
                    {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
                    {report.attachmentUrl ? "Replace" : "Attach"}
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => uploadAttachment(e.target.files?.[0])} />
                  </label>
                  {report.attachmentUrl ? (
                    <a href={report.attachmentUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-[12px] text-accent underline-offset-4 hover:underline">
                      view
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {canAssign || canConfirm ? (
          <TextareaField
            id="vet-note"
            label={canConfirm ? "Note for the Director / reason for return" : "Note for the officer"}
            rows={3}
            value={note}
            onChange={setNote}
            placeholder={canConfirm ? "Required when returning to the officer." : "Optional."}
          />
        ) : null}

        <AuditTimeline row={row} />
      </div>
    </Sheet>
  )
}
