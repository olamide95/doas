"use client"

import * as React from "react"
import { addDoc, arrayUnion, collection, doc, limit, orderBy, updateDoc } from "firebase/firestore"
import type { LucideIcon } from "lucide-react"
import { Check, Inbox, Lock, MapPin } from "lucide-react"
import { COL, db } from "@/lib/firebase"
import { REGISTER_COLLECTION, STATUS, expiryFrom, isBlocked, notifyIdFor, permitNumber, stageIndex, stagesFor, type RegisterCategory } from "@/lib/workflow"
import { isLit, typeLabel, type Measurements } from "@/lib/tariff"
import { useMergedCollections } from "@/hooks/use-firestore"
import { formatDate, formatDateTime, naira, toMillis, truncate } from "@/lib/format"
import { toast } from "@/components/ui/toast"
import { Sheet } from "@/components/dashboard/sheet"
import { ActionButton, SearchField, TextareaField } from "@/components/dashboard/form-kit"
import { EmptyState, Field, LoadFailed, Panel, RowsSkeleton, SectionLabel, StatusPill } from "@/components/dashboard/kit"
import { Segmented } from "@/components/dashboard/notifications-panel"
import { AuditTimeline, type AuditEntry } from "@/components/dashboard/audit-timeline"
import { cn } from "@/lib/utils"

export type Route = "first" | "third"

export interface SubmissionRow {
  id: string
  route: Route
  submissionId?: string
  applicantType?: string
  applicantName?: string
  companyName?: string
  cacRegistrationNumber?: string
  tin?: string
  corporateAddress?: string
  primaryContactName?: string
  primaryContactPhone?: string
  primaryContactEmail?: string
  signageSiteAddress?: string
  areaCouncil?: string
  email?: string
  contactPhoneNumber?: string
  applicationType?: string
  purposeOfApplication?: string
  addressLine1?: string
  addressLine2?: string
  gpsCoordinates?: string
  signDimensions?: string
  structuralHeight?: string
  numberOfSigns?: string
  typeOfSign?: string
  structureDuration?: string
  practitionerName?: string
  practitionerLicenseNumber?: string
  companyRegistrationNumber?: string
  companyAddress?: string
  status?: string
  department?: string
  directorReason?: string
  deskQuery?: string
  permitNumber?: string
  registerId?: string
  startsAt?: string
  expiresAt?: string
  measurements?: Measurements
  billing?: Record<string, unknown>
  payment?: Record<string, unknown>
  businessDevelopmentReport?: Record<string, unknown>
  technicalReport?: Record<string, unknown>
  siteVisitReport?: Record<string, unknown>
  inspectionReport?: Record<string, unknown>
  files?: Record<string, unknown>
  documents?: Record<string, unknown>
  comments?: AuditEntry[]
  createdAt?: unknown
  updatedAt?: unknown
}

export interface QueueAction {
  key: string
  label: string
  icon?: LucideIcon
  tone?: "primary" | "danger"
  status: string
  department: string
  /** Text recorded in the audit trail. */
  record: string
  notify?: string
  kind?: "success" | "error" | "info"
  needsDraft?: boolean
  requiresReason?: boolean
  /** Extra guard evaluated against the draft and row before running. */
  check?: (draft: Record<string, unknown> | null, row: SubmissionRow) => string | null
  /** Final sign-off: issue the permit and write/refresh the register entry. */
  register?: RegisterCategory
}

export interface QueueView {
  value: string
  label: string
  routes: Route[]
  statuses: string[]
  empty: { title: string; body: string }
  actions?: QueueAction[]
  actionsFor?: (row: SubmissionRow) => QueueAction[]
  column?: { header: string; render: (row: SubmissionRow) => React.ReactNode }
}

export interface QueueDraft<T extends Record<string, unknown>> {
  field: string
  views: string[]
  title: string
  initial: (row: SubmissionRow) => T
  render: (draft: T, set: (patch: Partial<T>) => void, row: SubmissionRow) => React.ReactNode
  validate?: (draft: T, row: SubmissionRow) => string | null
  /** Additional fields written alongside the draft (e.g. locked measurements). */
  derive?: (draft: T, row: SubmissionRow, ctx: { now: string; actorId: string }) => Record<string, unknown>
}

export function useSubmissions(max = 250) {
  const { data, loading, error } = useMergedCollections<Omit<SubmissionRow, "id" | "route">>(
    [
      { path: COL.firstParty, constraints: [orderBy("createdAt", "desc"), limit(max)], tag: "first" },
      { path: COL.thirdParty, constraints: [orderBy("createdAt", "desc"), limit(max)], tag: "third" },
    ],
    (row) => toMillis(row.createdAt),
  )
  const rows = React.useMemo(() => data.map((row) => ({ ...row, route: row.source as Route })) as SubmissionRow[], [data])
  return { rows, loading, error }
}

export function collectionFor(route: Route) {
  return route === "first" ? COL.firstParty : COL.thirdParty
}

export function matches(row: SubmissionRow, view: QueueView, department?: string) {
  if (!view.routes.includes(row.route)) return false
  if (department && row.department !== department) return false
  return view.statuses.includes(row.status ?? "")
}

interface WorkQueueProps<T extends Record<string, unknown>> {
  title: string
  description?: string
  department?: string
  actorId: string
  views: QueueView[]
  draft?: QueueDraft<T>
  extraDetail?: (row: SubmissionRow) => React.ReactNode
}

export function WorkQueue<T extends Record<string, unknown>>({ title, description, department, actorId, views, draft, extraDetail }: WorkQueueProps<T>) {
  const { rows, loading, error } = useSubmissions()
  const [viewValue, setViewValue] = React.useState(views[0]?.value ?? "")
  const [search, setSearch] = React.useState("")
  const [selected, setSelected] = React.useState<SubmissionRow | null>(null)
  const [note, setNote] = React.useState("")
  const [draftValue, setDraftValue] = React.useState<T | null>(null)
  const [busy, setBusy] = React.useState(false)

  const view = views.find((v) => v.value === viewValue) ?? views[0]

  const visible = React.useMemo(() => {
    const term = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (!matches(row, view, department)) return false
      if (!term) return true
      return [row.applicantName, row.companyName, row.submissionId, row.email, row.permitNumber]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term))
    })
  }, [rows, view, department, search])

  React.useEffect(() => {
    if (!selected) return
    const fresh = rows.find((r) => r.id === selected.id && r.route === selected.route)
    if (fresh && fresh.updatedAt !== selected.updatedAt) setSelected(fresh)
  }, [rows, selected])

  const draftActive = Boolean(draft && draft.views.includes(view.value))

  const open = (row: SubmissionRow) => {
    setSelected(row)
    setNote("")
    setDraftValue(draft && draft.views.includes(view.value) ? draft.initial(row) : null)
  }

  const close = () => {
    setSelected(null)
    setNote("")
    setDraftValue(null)
  }

  const run = async (action: QueueAction) => {
    if (!selected || busy) return

    if (action.requiresReason && !note.trim()) {
      toast.warning({ title: "Give a reason", description: "This is recorded on the file, so it can't be blank." })
      return
    }
    if (action.needsDraft && draft && draftValue) {
      const problem = draft.validate?.(draftValue, selected)
      if (problem) {
        toast.warning({ title: "Not ready", description: problem })
        return
      }
    }
    const blocked = action.check?.(draftValue as Record<string, unknown> | null, selected)
    if (blocked) {
      toast.warning({ title: "Can't do that yet", description: blocked })
      return
    }

    setBusy(true)
    const now = new Date().toISOString()
    const entry: AuditEntry = {
      text: note.trim() || action.record,
      timestamp: now,
      action: action.record,
      desk: actorId,
      from: selected.department ?? "",
      to: action.department,
      status: action.status,
    }
    const payload: Record<string, unknown> = {
      status: action.status,
      department: action.department,
      comments: arrayUnion(entry),
      updatedAt: now,
    }

    if (action.requiresReason) payload[isBlocked(action.status) ? "directorReason" : "deskQuery"] = note.trim()

    if (action.needsDraft && draft && draftValue) {
      payload[draft.field] = { ...draftValue, submittedAt: now, submittedBy: actorId }
      Object.assign(payload, draft.derive?.(draftValue, selected, { now, actorId }) ?? {})
    }

    let permit: string | null = null
    let startsAt = ""
    let expiresAt = ""
    if (action.register) {
      const billing = (selected.billing ?? {}) as Record<string, unknown>
      startsAt = String(billing.subscriptionStartDate ?? now.slice(0, 10))
      expiresAt = String(billing.subscriptionExpiryDate ?? expiryFrom(new Date(now)))
      permit = selected.permitNumber ?? permitNumber(action.register)
      Object.assign(payload, { permitNumber: permit, approvedAt: now, startsAt, expiresAt })
    }

    try {
      const ref = doc(db, collectionFor(selected.route), selected.id)
      await updateDoc(ref, payload)

      if (action.register && permit) {
        const billing = (selected.billing ?? {}) as Record<string, unknown>
        const registerEntry = {
          category: action.register,
          permitNumber: permit,
          submissionId: selected.submissionId ?? selected.id,
          submissionRef: selected.id,
          route: selected.route,
          holderName: selected.companyName ?? selected.applicantName ?? "",
          companyName: selected.companyName ?? "",
          email: selected.primaryContactEmail ?? selected.email ?? "",
          phone: selected.primaryContactPhone ?? selected.contactPhoneNumber ?? "",
          address: selected.signageSiteAddress ?? selected.addressLine1 ?? "",
          areaCouncil: selected.areaCouncil ?? "",
          gpsCoordinates: selected.gpsCoordinates ?? "",
          signageType: selected.applicationType ?? "",
          totalSqm: selected.measurements?.totalSqm ?? 0,
          practitionerName: selected.practitionerName ?? "",
          practitionerLicenseNumber: selected.practitionerLicenseNumber ?? "",
          invoiceNumber: billing.invoiceNumber ?? "",
          lastInvoiceAmount: billing.netInvoiceAmount ?? 0,
          cycle: Number(billing.cycle ?? 1),
          status: "Active",
          approvedAt: now,
          startsAt,
          expiresAt,
          registeredBy: actorId,
        }
        if (selected.registerId) {
          await updateDoc(doc(db, REGISTER_COLLECTION, selected.registerId), { ...registerEntry, renewedAt: now })
        } else {
          const created = await addDoc(collection(db, REGISTER_COLLECTION), registerEntry)
          await updateDoc(ref, { registerId: created.id })
        }
      }

      await addDoc(collection(db, COL.activity), { submissionId: selected.id, action: action.record, comment: note, timestamp: now, userId: actorId })

      await addDoc(collection(db, COL.notifications), {
        userId: action.notify ?? notifyIdFor(action.department),
        content: `${action.record} — ${selected.companyName ?? selected.applicantName ?? "application"}${note.trim() ? `: ${note.trim()}` : ""}`,
        type: action.kind ?? "info",
        referenceId: selected.id,
        isRead: false,
        createdAt: now,
      })

      toast.success({ title: action.record, description: permit ? `Permit ${permit}` : selected.submissionId })
      close()
    } catch (err) {
      toast.error({ title: "Action not saved", description: err instanceof Error ? err.message : "Try again in a moment." })
    } finally {
      setBusy(false)
    }
  }

  const actions = selected ? (view.actionsFor?.(selected) ?? view.actions ?? []) : []
  const needsReason = actions.some((a) => a.requiresReason)
  const showQuery = selected?.deskQuery && ([STATUS.billingQueried, STATUS.paymentFlagged] as string[]).includes(selected.status ?? "")

  return (
    <>
      <Panel
        title={title}
        description={description}
        actions={views.length > 1 ? <Segmented value={view.value} onChange={setViewValue} options={views.map((v) => ({ value: v.value, label: v.label }))} /> : null}
        bodyClassName="p-0"
      >
        <div className="border-b border-border p-3 sm:px-5">
          <SearchField value={search} onChange={setSearch} placeholder="Search by company, reference, email or permit" />
        </div>
        <div className="p-3 sm:p-4">
          {error ? (
            <LoadFailed error={error} what="Applications" />
          ) : loading ? (
            <RowsSkeleton rows={6} columns={6} />
          ) : !visible.length ? (
            <EmptyState icon={Inbox} title={view.empty.title} description={view.empty.body} />
          ) : (
            <QueueTable rows={visible} view={view} onOpen={open} />
          )}
        </div>
      </Panel>

      <Sheet
        open={Boolean(selected)}
        onClose={close}
        title={draftActive && draft ? draft.title : "File review"}
        caption={selected ? `${selected.submissionId ?? selected.id} · ${selected.companyName ?? selected.applicantName ?? ""}` : ""}
        width={draftActive ? "max-w-4xl" : "max-w-2xl"}
        footer={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <ActionButton tone="quiet" onClick={close}>
              Close
            </ActionButton>
            {actions.map((a) => (
              <ActionButton key={a.key} tone={a.tone ?? "primary"} icon={a.icon} disabled={busy} onClick={() => run(a)}>
                {busy ? "Saving…" : a.label}
              </ActionButton>
            ))}
          </div>
        }
      >
        {selected ? (
          <div className="space-y-6">
            <StageTracker row={selected} />

            {selected.directorReason && isBlocked(selected.status) ? <Notice title="Reason given" body={selected.directorReason} /> : null}
            {showQuery ? <Notice title="Query raised" body={selected.deskQuery as string} /> : null}

            <ApplicationSummary row={selected} />
            {selected.measurements ? <LockedMeasurements m={selected.measurements} /> : null}

            {draftActive && draft && draftValue ? (
              <div>
                <SectionLabel>{draft.title}</SectionLabel>
                {draft.render(draftValue, (patch) => setDraftValue((prev) => ({ ...(prev as T), ...patch })), selected)}
              </div>
            ) : null}

            {extraDetail?.(selected)}
            <ExistingReports row={selected} />
            <Attachments row={selected} />
            <AuditTimeline row={selected} />

            <TextareaField
              id="queue-note"
              label={needsReason ? "Reason or note" : "Note for the next desk"}
              value={note}
              onChange={setNote}
              placeholder={needsReason ? "Required for declines, returns, queries and flags. Recorded on the file." : "Saved to the audit log and shown to whoever picks this up next."}
            />
          </div>
        ) : null}
      </Sheet>
    </>
  )
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-[hsl(var(--state-stop))]/30 bg-[hsl(var(--state-stop-soft))] px-4 py-3">
      <p className="text-[12.5px] font-semibold text-[hsl(var(--state-stop))]">{title}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-foreground">{body}</p>
    </div>
  )
}

export function StageTracker({ row }: { row: SubmissionRow }) {
  const stages = stagesFor(row.route)
  const current = stageIndex(row.route, row.status)
  const blocked = isBlocked(row.status)
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[12.5px] font-medium text-muted-foreground">{row.route === "first" ? "First-party route" : "Third-party route"}</p>
        <StatusPill status={row.status} />
      </div>
      <ol className="flex items-stretch gap-1">
        {stages.map((entry, index) => {
          const done = current > index
          const active = current === index && !blocked
          return (
            <li key={`${entry.label}-${index}`} className="min-w-0 flex-1">
              <span
                className={cn(
                  "block h-1 rounded-full",
                  blocked ? "bg-[hsl(var(--state-stop))]/30" : done ? "bg-[hsl(var(--state-clear))]" : active ? "bg-[hsl(var(--state-wait))]" : "bg-border",
                )}
              />
              <p className={cn("mt-1.5 truncate text-[10.5px] leading-tight", active ? "font-semibold text-foreground" : "text-muted-foreground")} title={`${entry.label} · ${entry.desk}`}>
                {done ? <Check className="mr-0.5 inline h-2.5 w-2.5" aria-hidden /> : null}
                {entry.label}
              </p>
            </li>
          )
        })}
      </ol>
      {blocked ? <p className="mt-2 text-[12px] text-[hsl(var(--state-stop))]">Held at the Director&rsquo;s decision. The applicant has to act first.</p> : null}
    </div>
  )
}

function QueueTable({ rows, view, onOpen }: { rows: SubmissionRow[]; view: QueueView; onOpen: (row: SubmissionRow) => void }) {
  return (
    <div className="overflow-x-auto scroll-slim">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-border text-[11.5px] font-semibold text-muted-foreground">
            <th className="px-3 py-2.5">Reference</th>
            <th className="px-3 py-2.5">Applicant</th>
            <th className="hidden px-3 py-2.5 md:table-cell">Type</th>
            <th className="hidden px-3 py-2.5 lg:table-cell">{view.column?.header ?? "Site"}</th>
            <th className="px-3 py-2.5">Status</th>
            <th className="hidden px-3 py-2.5 sm:table-cell">Received</th>
            <th className="px-3 py-2.5 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={`${row.route}-${row.id}`} style={{ ["--i" as string]: Math.min(i, 10) }} className="reveal border-b border-border/70 last:border-0 hover:bg-muted/50">
              <td className="px-3 py-3 font-mono text-[12px] text-muted-foreground">{row.submissionId ?? row.id.slice(0, 8)}</td>
              <td className="px-3 py-3">
                <p className="text-[13.5px] font-medium text-foreground">{row.companyName ?? row.applicantName ?? "—"}</p>
                <p className="text-[11.5px] text-muted-foreground">{row.primaryContactName ?? row.email ?? ""}</p>
              </td>
              <td className="hidden px-3 py-3 text-[13px] text-muted-foreground md:table-cell">
                {row.route === "first" ? "FP" : "3P"} · {truncate(typeLabel(row.applicationType), 22)}
              </td>
              <td className="hidden px-3 py-3 text-[12.5px] text-muted-foreground lg:table-cell">
                {view.column ? (
                  view.column.render(row)
                ) : row.gpsCoordinates ? (
                  <span className="inline-flex items-center gap-1 font-mono text-[11.5px]">
                    <MapPin className="h-3 w-3" />
                    {truncate(row.gpsCoordinates, 22)}
                  </span>
                ) : (
                  (row.areaCouncil ?? "—")
                )}
              </td>
              <td className="px-3 py-3">
                <StatusPill status={row.status} />
              </td>
              <td className="hidden px-3 py-3 text-[12.5px] text-muted-foreground sm:table-cell">{formatDate(row.createdAt)}</td>
              <td className="px-3 py-3 text-right">
                <ActionButton tone="quiet" onClick={() => onOpen(row)}>
                  Open
                </ActionButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ApplicationSummary({ row }: { row: SubmissionRow }) {
  return (
    <div>
      <SectionLabel>Application</SectionLabel>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Organisation" value={row.companyName ?? row.applicantName} />
        <Field label="Applicant type" value={row.applicantType ?? (row.route === "first" ? "First-Party" : "Third-Party Agency")} />
        <Field label="CAC number" value={row.cacRegistrationNumber ?? row.companyRegistrationNumber} mono />
        <Field label="TIN" value={row.tin} mono />
        <Field label="Contact" value={row.primaryContactName} />
        <Field label="Phone" value={row.primaryContactPhone ?? row.contactPhoneNumber} />
        <Field label="Email" value={row.primaryContactEmail ?? row.email} />
        <Field label="Area council" value={row.areaCouncil} />
        <Field label="Reference" value={row.submissionId} mono />
        <Field label="Received" value={formatDateTime(row.createdAt)} />
        {row.permitNumber ? <Field label="Permit number" value={row.permitNumber} mono /> : null}
        <Field label="Currently with" value={row.department} />
        <Field label="Corporate address" value={row.corporateAddress ?? row.companyAddress} className="col-span-2" />
        <Field label="Signage site" value={row.signageSiteAddress ?? row.addressLine1} className="col-span-2" />
        {row.gpsCoordinates ? <Field label="Declared coordinates" value={row.gpsCoordinates} mono className="col-span-2" /> : null}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 rounded-lg bg-muted/40 p-3.5">
        <Field label="Declared structure" value={typeLabel(row.applicationType)} />
        <Field label="Purpose" value={row.purposeOfApplication} />
        <Field label="Declared dimensions" value={row.signDimensions} />
        <Field label="Declared number of signs" value={row.numberOfSigns} />
        {row.practitionerName ? <Field label="Practitioner" value={row.practitionerName} /> : null}
        {row.practitionerLicenseNumber ? <Field label="Licence" value={row.practitionerLicenseNumber} mono /> : null}
      </div>
    </div>
  )
}

export function LockedMeasurements({ m }: { m: Measurements }) {
  return (
    <div>
      <SectionLabel>
        <span className="inline-flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5" /> Locked field parameters
        </span>
      </SectionLabel>
      <ul className="space-y-1.5 font-mono text-[12px] text-foreground">
        {m.items.map((item, i) => (
          <li key={item.id} className="rounded-md bg-muted/40 px-3 py-2">
            Structure {i + 1}: {typeLabel(item.type)} [{isLit(item.illumination) ? "Illuminated" : "Non-lit"}] | Dim: {item.height.toFixed(2)}m × {item.width.toFixed(2)}m
            {item.faces > 1 ? ` × ${item.faces} faces` : ""} | Area: {item.sqm.toFixed(2)} SQM
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[12.5px] text-muted-foreground">
        Total exposure <span className="font-semibold text-foreground">{m.totalSqm.toFixed(2)} SQM</span> · locked by{" "}
        {m.source === "business_development" ? "Business Development" : "Planning"} on {formatDateTime(m.lockedAt)}
      </p>
    </div>
  )
}

function ExistingReports({ row }: { row: SubmissionRow }) {
  const bd = row.businessDevelopmentReport as Record<string, unknown> | undefined
  const tech = row.technicalReport as Record<string, unknown> | undefined
  const billing = row.billing as Record<string, unknown> | undefined
  const payment = row.payment as Record<string, unknown> | undefined
  const declared = (payment?.declared ?? undefined) as Record<string, unknown> | undefined

  const bdPhotos =
    bd && Array.isArray(bd.signs) ? (bd.signs as Record<string, string>[]).flatMap((s) => [s.sitePhotoFront, s.sitePhotoContext]).filter(Boolean) : []

  return (
    <>
      {bd ? (
        <div>
          <SectionLabel>Business Development inspection</SectionLabel>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Inspected" value={formatDateTime(bd.inspectionTimestamp)} />
            <Field label="Officer" value={String(bd.assignedOfficerName || bd.assignedOfficerId || "")} />
            <Field label="Occupancy" value={String(bd.buildingOccupancyType ?? "")} />
            <Field label="Signs on site" value={String(bd.numberOfSignagesOnSite ?? "")} />
            <Field label="Field notes" value={String(bd.fieldNotes ?? "")} className="col-span-2" />
          </div>
          <PhotoGrid urls={bdPhotos as string[]} />
        </div>
      ) : null}

      {tech ? (
        <div>
          <SectionLabel>Planning technical vetting</SectionLabel>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Structure" value={typeLabel(String(tech.structureType ?? ""))} />
            <Field label="Foundation depth" value={tech.foundationDepthMeters ? `${tech.foundationDepthMeters} m` : ""} />
            <Field label="COREN engineer" value={String(tech.corenEngineerName ?? "")} />
            <Field label="COREN licence" value={String(tech.corenLicenseNumber ?? "")} mono />
            <Field label="Setback from road" value={tech.setbackFromRoadMeters ? `${tech.setbackFromRoadMeters} m` : ""} />
            <Field label="Clash detection" value={<StatusPill status={String(tech.clashDetectionStatus ?? "")} />} />
            <Field label="Traffic sightline" value={tech.trafficSightlineClearance ? "Clear" : "Not clear"} />
            <Field label="Utility lines" value={tech.utilityLineClearance ? "Clear" : "Not clear"} />
            {tech.structuralIntegrityCert ? (
              <Field
                label="Structural certificate"
                value={
                  <a className="text-accent underline-offset-4 hover:underline" href={String(tech.structuralIntegrityCert)} target="_blank" rel="noopener noreferrer">
                    Open
                  </a>
                }
              />
            ) : null}
            <Field label="Notes" value={String(tech.vettingNotes ?? "")} className="col-span-2" />
          </div>
        </div>
      ) : null}

      {billing && billing.netInvoiceAmount !== undefined ? (
        <div>
          <SectionLabel>Billing</SectionLabel>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Invoice" value={String(billing.invoiceNumber ?? "")} mono />
            <Field label="Cycle" value={`#${billing.cycle ?? 1} · ${String(billing.billingCycleType ?? "").replace(/_/g, " ")}`} />
            <Field label="Schedule" value={String(billing.scheduleName ?? "")} />
            <Field label="Zone" value={`${billing.zone ?? ""} (${billing.zoneMultiplier ?? ""}×)`} />
            <Field label="Base computation" value={naira(billing.baseComputation as number)} />
            <Field label="Illumination surcharge" value={naira(billing.illuminationSurcharge as number)} />
            <Field label="Penalty" value={naira(billing.penaltyLoadingFee as number)} />
            <Field label="Waiver" value={naira(billing.waiverAmount as number)} />
            <Field label="Net invoice" value={<span className="figure text-[16px] font-semibold">{naira(billing.netInvoiceAmount as number)}</span>} />
            <Field label="Validity" value={`${formatDate(billing.subscriptionStartDate)} → ${formatDate(billing.subscriptionExpiryDate)}`} />
          </div>
        </div>
      ) : null}

      {payment && (declared || payment.reconciliationStatus) ? (
        <div>
          <SectionLabel>Payment</SectionLabel>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Declared RRR" value={String(declared?.rrr ?? "")} mono />
            <Field label="Declared amount" value={naira(declared?.amount as number)} />
            <Field label="Verified RRR" value={String(payment.remitaRrr ?? "")} mono />
            <Field label="Amount credited" value={naira(payment.amountCredited as number)} />
            <Field label="Ledger" value={String(payment.financeLedgerCode ?? "")} />
            <Field label="Reconciliation" value={<StatusPill status={String(payment.reconciliationStatus ?? "Unverified")} />} />
            {Number(payment.balanceDue) > 0 ? <Field label="Balance due" value={naira(payment.balanceDue as number)} /> : null}
          </div>
        </div>
      ) : null}
    </>
  )
}

export function PhotoGrid({ urls }: { urls: string[] }) {
  if (!urls?.length) return null
  return (
    <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
      {urls.map((url, i) => (
        <a key={`${url}-${i}`} href={url} target="_blank" rel="noopener noreferrer" className="aspect-square overflow-hidden rounded-lg border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={`Site photograph ${i + 1}`} loading="lazy" className="h-full w-full object-cover" />
        </a>
      ))}
    </div>
  )
}

function Attachments({ row }: { row: SubmissionRow }) {
  const source = row.files ?? row.documents
  if (!source) return null
  const entries = Object.entries(source).filter(([, v]) => typeof v === "string" && v)
  if (!entries.length) return null
  return (
    <div>
      <SectionLabel>Documents</SectionLabel>
      <ul className="space-y-2">
        {entries.map(([key, url]) => (
          <li key={key} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3.5 py-2.5">
            <span className="text-[13px] font-medium text-foreground">{labelise(key)}</span>
            <a href={String(url)} target="_blank" rel="noopener noreferrer" className="text-[12.5px] font-semibold text-accent underline-offset-4 hover:underline">
              Open
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function labelise(key: string) {
  const spaced = key.replace(/([A-Z])/g, " $1").replace(/[_-]+/g, " ").trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase()
}
