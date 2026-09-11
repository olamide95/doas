"use client"

import * as React from "react"
import { addDoc, arrayUnion, collection, doc, limit, orderBy, updateDoc } from "firebase/firestore"
import type { LucideIcon } from "lucide-react"
import { Check, Inbox, MapPin } from "lucide-react"
import { COL, db } from "@/lib/firebase"
import {
  REGISTER_COLLECTION,
  expiryFrom,
  isBlocked,
  notifyIdFor,
  permitNumber,
  stageIndex,
  stagesFor,
  type RegisterCategory,
} from "@/lib/workflow"
import { useMergedCollections } from "@/hooks/use-firestore"
import { formatDate, formatDateTime, naira, toMillis, truncate } from "@/lib/format"
import { toast } from "@/components/ui/toast"
import { Sheet } from "@/components/dashboard/sheet"
import { ActionButton, SearchField, TextareaField } from "@/components/dashboard/form-kit"
import {
  EmptyState,
  Field,
  LoadFailed,
  Panel,
  RowsSkeleton,
  SectionLabel,
  StatusPill,
} from "@/components/dashboard/kit"
import { Segmented } from "@/components/dashboard/notifications-panel"
import { cn } from "@/lib/utils"

export type Route = "first" | "third"

export interface SubmissionRow {
  id: string
  route: Route
  submissionId?: string
  applicantName?: string
  companyName?: string
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
  permitNumber?: string
  billing?: Record<string, unknown>
  siteVisitReport?: Record<string, unknown>
  businessDevelopmentReport?: Record<string, unknown>
  inspectionReport?: Record<string, unknown>
  planningReport?: Record<string, unknown>
  files?: Record<string, unknown>
  documents?: Record<string, unknown>
  comments?: { text: string; timestamp: string; action: string }[]
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
  /** Text recorded in the application history. */
  record: string
  notify?: string
  kind?: "success" | "error" | "info"
  /** Require the draft form to validate before this action runs. */
  needsDraft?: boolean
  /**
   * Block the action until a reason is written. Every decline and every
   * return-for-changes uses this — the applicant has to be told why.
   */
  requiresReason?: boolean
  /** Write the applicant into the permit register as they're approved. */
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
  validate?: (draft: T) => string | null
}

/** Live feed of both submission collections, newest first. */
export function useSubmissions(max = 250) {
  const { data, loading, error } = useMergedCollections<Omit<SubmissionRow, "id" | "route">>(
    [
      { path: COL.firstParty, constraints: [orderBy("createdAt", "desc"), limit(max)], tag: "first" },
      { path: COL.thirdParty, constraints: [orderBy("createdAt", "desc"), limit(max)], tag: "third" },
    ],
    (row) => toMillis(row.createdAt),
  )

  const rows = React.useMemo(
    () => data.map((row) => ({ ...row, route: row.source as Route })) as SubmissionRow[],
    [data],
  )

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

export function WorkQueue<T extends Record<string, unknown>>({
  title,
  description,
  department,
  actorId,
  views,
  draft,
  extraDetail,
}: WorkQueueProps<T>) {
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
      return [row.applicantName, row.submissionId, row.email, row.companyName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    })
  }, [rows, view, department, search])

  React.useEffect(() => {
    if (!selected) return
    const fresh = rows.find((row) => row.id === selected.id && row.route === selected.route)
    if (fresh && fresh.updatedAt !== selected.updatedAt) setSelected(fresh)
  }, [rows, selected])

  const draftActive = Boolean(draft && draft.views.includes(view.value))

  const open = (row: SubmissionRow) => {
    setSelected(row)
    setNote("")
    setDraftValue(draft ? draft.initial(row) : null)
  }

  const close = () => {
    setSelected(null)
    setNote("")
    setDraftValue(null)
  }

  const run = async (action: QueueAction) => {
    if (!selected || busy) return

    if (action.requiresReason && !note.trim()) {
      toast.warning({
        title: "Give a reason",
        description: "The applicant is told why, so this can't be left blank.",
      })
      return
    }

    if (action.needsDraft && draft && draftValue) {
      const problem = draft.validate?.(draftValue)
      if (problem) {
        toast.warning({ title: "Report incomplete", description: problem })
        return
      }
    }

    setBusy(true)
    const now = new Date().toISOString()
    const payload: Record<string, unknown> = {
      status: action.status,
      department: action.department,
      comments: arrayUnion({ text: note || action.record, timestamp: now, action: action.record }),
      updatedAt: now,
    }

    if (action.requiresReason) payload.directorReason = note.trim()
    if (action.needsDraft && draft && draftValue) {
      payload[draft.field] = { ...draftValue, submittedAt: now, submittedBy: actorId }
    }

    let permit: string | null = null
    if (action.register) {
      permit = selected.permitNumber ?? permitNumber(action.register)
      payload.permitNumber = permit
      payload.approvedAt = now
      payload.expiresAt = expiryFrom(new Date(now))
    }

    try {
      await updateDoc(doc(db, collectionFor(selected.route), selected.id), payload)

      if (action.register && permit) {
        await addDoc(collection(db, REGISTER_COLLECTION), {
          category: action.register,
          permitNumber: permit,
          submissionId: selected.submissionId ?? selected.id,
          submissionRef: selected.id,
          route: selected.route,
          holderName: selected.applicantName ?? "",
          companyName: selected.companyName ?? "",
          email: selected.email ?? "",
          phone: selected.contactPhoneNumber ?? "",
          address: [selected.addressLine1, selected.addressLine2].filter(Boolean).join(", "),
          gpsCoordinates: selected.gpsCoordinates ?? "",
          signageType: selected.typeOfSign ?? selected.applicationType ?? "",
          practitionerName: selected.practitionerName ?? "",
          practitionerLicenseNumber: selected.practitionerLicenseNumber ?? "",
          status: "Active",
          approvedAt: now,
          expiresAt: expiryFrom(new Date(now)),
          registeredBy: actorId,
        })
      }

      await addDoc(collection(db, COL.activity), {
        submissionId: selected.id,
        action: action.record,
        comment: note,
        timestamp: now,
        userId: actorId,
      })

      await addDoc(collection(db, COL.notifications), {
        userId: action.notify ?? notifyIdFor(action.department),
        content: `${action.record} — ${selected.applicantName ?? "application"}${
          note.trim() ? `: ${note.trim()}` : ""
        }`,
        type: action.kind ?? "info",
        referenceId: selected.id,
        isRead: false,
        createdAt: now,
      })

      toast.success({
        title: action.record,
        description: permit ? `Permit ${permit}` : (selected.applicantName ?? undefined),
      })
      close()
    } catch (err) {
      toast.error({
        title: "Action not saved",
        description: err instanceof Error ? err.message : "Try again in a moment.",
      })
    } finally {
      setBusy(false)
    }
  }

  const actions = selected ? (view.actionsFor?.(selected) ?? view.actions ?? []) : []
  const needsReason = actions.some((action) => action.requiresReason)

  return (
    <>
      <Panel
        title={title}
        description={description}
        actions={
          views.length > 1 ? (
            <Segmented
              value={view.value}
              onChange={setViewValue}
              options={views.map((v) => ({ value: v.value, label: v.label }))}
            />
          ) : null
        }
        bodyClassName="p-0"
      >
        <div className="border-b border-border p-3 sm:px-5">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Search by applicant, reference or email"
          />
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
        title={draftActive && draft ? draft.title : "Application review"}
        caption={
          selected ? `${selected.submissionId ?? selected.id} · ${selected.applicantName ?? ""}` : ""
        }
        width={draftActive ? "max-w-3xl" : "max-w-2xl"}
        footer={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <ActionButton tone="quiet" onClick={close}>
              Close
            </ActionButton>
            {actions.map((action) => (
              <ActionButton
                key={action.key}
                tone={action.tone ?? "primary"}
                icon={action.icon}
                disabled={busy}
                onClick={() => run(action)}
              >
                {busy ? "Saving…" : action.label}
              </ActionButton>
            ))}
          </div>
        }
      >
        {selected ? (
          <div className="space-y-6">
            <StageTracker row={selected} />

            {selected.directorReason && isBlocked(selected.status) ? (
              <div className="rounded-lg border border-[hsl(var(--state-stop))]/30 bg-[hsl(var(--state-stop-soft))] px-4 py-3">
                <p className="text-[12.5px] font-semibold text-[hsl(var(--state-stop))]">
                  Reason given
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-foreground">
                  {selected.directorReason}
                </p>
              </div>
            ) : null}

            <ApplicationSummary row={selected} />

            {draftActive && draft && draftValue ? (
              <div>
                <SectionLabel>{draft.title}</SectionLabel>
                {draft.render(
                  draftValue,
                  (patch) => setDraftValue((prev) => ({ ...(prev as T), ...patch })),
                  selected,
                )}
              </div>
            ) : null}

            {extraDetail?.(selected)}

            <ExistingReports row={selected} />
            <Attachments row={selected} />
            <History row={selected} />

            <TextareaField
              id="queue-note"
              label={needsReason ? "Reason or note" : "Note for the next desk"}
              value={note}
              onChange={setNote}
              placeholder={
                needsReason
                  ? "Required when declining or returning a file. The applicant is told what you write here."
                  : "Saved to the application history and shown to whoever picks this up next."
              }
            />
          </div>
        ) : null}
      </Sheet>
    </>
  )
}

/** Where the file is in its chain. Derived from status, not stored. */
export function StageTracker({ row }: { row: SubmissionRow }) {
  const stages = stagesFor(row.route)
  const current = stageIndex(row.route, row.status)
  const blocked = isBlocked(row.status)

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[12.5px] font-medium text-muted-foreground">
          {row.route === "first" ? "First-party route" : "Third-party route"}
        </p>
        <StatusPill status={row.status} />
      </div>

      <ol className="flex items-stretch gap-1">
        {stages.map((entry, index) => {
          const done = current > index
          const active = current === index && !blocked
          return (
            <li key={entry.label} className="min-w-0 flex-1">
              <span
                className={cn(
                  "block h-1 rounded-full transition-colors",
                  blocked
                    ? "bg-[hsl(var(--state-stop))]/30"
                    : done
                      ? "bg-[hsl(var(--state-clear))]"
                      : active
                        ? "bg-[hsl(var(--state-wait))]"
                        : "bg-border",
                )}
              />
              <p
                className={cn(
                  "mt-1.5 truncate text-[10.5px] leading-tight",
                  active ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
                title={`${entry.label} · ${entry.desk}`}
              >
                {done ? <Check className="mr-0.5 inline h-2.5 w-2.5" aria-hidden /> : null}
                {entry.label}
              </p>
            </li>
          )
        })}
      </ol>

      {blocked ? (
        <p className="mt-2 text-[12px] text-[hsl(var(--state-stop))]">
          Held at the Director&rsquo;s decision. The applicant has to act before this moves again.
        </p>
      ) : null}
    </div>
  )
}

function QueueTable({
  rows,
  view,
  onOpen,
}: {
  rows: SubmissionRow[]
  view: QueueView
  onOpen: (row: SubmissionRow) => void
}) {
  return (
    <div className="overflow-x-auto scroll-slim">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-border text-[11.5px] font-semibold text-muted-foreground">
            <th className="px-3 py-2.5">Reference</th>
            <th className="px-3 py-2.5">Applicant</th>
            <th className="hidden px-3 py-2.5 md:table-cell">Type</th>
            {view.column ? (
              <th className="hidden px-3 py-2.5 lg:table-cell">{view.column.header}</th>
            ) : (
              <th className="hidden px-3 py-2.5 lg:table-cell">Site</th>
            )}
            <th className="px-3 py-2.5">Status</th>
            <th className="hidden px-3 py-2.5 sm:table-cell">Received</th>
            <th className="px-3 py-2.5 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={`${row.route}-${row.id}`}
              style={{ ["--i" as string]: Math.min(i, 10) }}
              className="reveal border-b border-border/70 transition-colors last:border-0 hover:bg-muted/50"
            >
              <td className="px-3 py-3 font-mono text-[12px] text-muted-foreground">
                {row.submissionId ?? row.id.slice(0, 8)}
              </td>
              <td className="px-3 py-3">
                <p className="text-[13.5px] font-medium text-foreground">
                  {row.applicantName ?? "—"}
                </p>
                <p className="text-[11.5px] text-muted-foreground">
                  {row.companyName ?? row.email ?? ""}
                </p>
              </td>
              <td className="hidden px-3 py-3 text-[13px] text-muted-foreground md:table-cell">
                {truncate(row.applicationType, 26)}
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
                  "—"
                )}
              </td>
              <td className="px-3 py-3">
                <StatusPill status={row.status} />
              </td>
              <td className="hidden px-3 py-3 text-[12.5px] text-muted-foreground sm:table-cell">
                {formatDate(row.createdAt)}
              </td>
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
        <Field label="Applicant" value={row.applicantName} />
        <Field label="Route" value={row.route === "first" ? "First party" : "Third party"} />
        <Field label="Email" value={row.email} />
        <Field label="Phone" value={row.contactPhoneNumber} />
        <Field label="Reference" value={row.submissionId} mono />
        <Field label="Received" value={formatDateTime(row.createdAt)} />
        {row.permitNumber ? <Field label="Permit number" value={row.permitNumber} mono /> : null}
        {row.companyName ? <Field label="Company" value={row.companyName} /> : null}
        {row.companyRegistrationNumber ? (
          <Field label="Company reg. no." value={row.companyRegistrationNumber} mono />
        ) : null}
        <Field label="Application type" value={row.applicationType} />
        <Field label="Currently with" value={row.department} />
        <Field
          label="Site"
          value={[row.addressLine1, row.addressLine2].filter(Boolean).join(", ")}
          className="col-span-2"
        />
        {row.gpsCoordinates ? (
          <Field label="Coordinates" value={row.gpsCoordinates} mono className="col-span-2" />
        ) : null}
        {row.purposeOfApplication ? (
          <Field label="Purpose" value={row.purposeOfApplication} className="col-span-2" />
        ) : null}
      </div>

      {row.signDimensions || row.typeOfSign || row.structuralHeight ? (
        <div className="mt-4 grid grid-cols-2 gap-4 rounded-lg bg-muted/40 p-3.5">
          <Field label="Sign dimensions" value={row.signDimensions} />
          <Field label="Structural height" value={row.structuralHeight} />
          <Field label="Number of signs" value={row.numberOfSigns} />
          <Field label="Type of sign" value={row.typeOfSign} />
          <Field label="Duration" value={row.structureDuration} />
        </div>
      ) : null}

      {row.practitionerName ? (
        <div className="mt-4 grid grid-cols-2 gap-4 rounded-lg bg-muted/40 p-3.5">
          <Field label="Practitioner" value={row.practitionerName} />
          <Field label="Licence" value={row.practitionerLicenseNumber} mono />
        </div>
      ) : null}
    </div>
  )
}

function ExistingReports({ row }: { row: SubmissionRow }) {
  const reports: [string, Record<string, unknown> | undefined][] = [
    ["Business Development site visit", row.businessDevelopmentReport],
    ["Monitoring inspection", row.inspectionReport ?? row.siteVisitReport],
    ["Planning report", row.planningReport],
  ]

  const present = reports.filter(([, value]) => value && Object.keys(value).length)
  if (!present.length && !row.billing) return null

  return (
    <>
      {present.map(([label, report]) => (
        <div key={label}>
          <SectionLabel>{label}</SectionLabel>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(report as Record<string, unknown>)
              .filter(([key, value]) => key !== "sitePhotos" && typeof value === "string" && value)
              .slice(0, 18)
              .map(([key, value]) => (
                <Field key={key} label={labelise(key)} value={String(value)} />
              ))}
          </div>
          {Array.isArray((report as Record<string, unknown>).sitePhotos) ? (
            <PhotoGrid urls={(report as { sitePhotos: string[] }).sitePhotos} />
          ) : null}
        </div>
      ))}

      {row.billing ? (
        <div>
          <SectionLabel>Billing</SectionLabel>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Invoice" value={String(row.billing.invoiceNumber ?? "")} mono />
            <Field label="Due" value={formatDate(row.billing.dueDate)} />
            <Field label="Application fee" value={naira(row.billing.applicationFee as number)} />
            <Field label="Processing fee" value={naira(row.billing.processingFee as number)} />
            <Field label="Annual fee" value={naira(row.billing.annualFee as number)} />
            <Field
              label="Total"
              value={
                <span className="figure text-[16px] font-semibold">
                  {naira(row.billing.totalAmount as number)}
                </span>
              }
            />
            <Field
              label="Payment"
              value={<StatusPill status={String(row.billing.paymentStatus ?? "Pending")} />}
            />
            {row.billing.paymentReference ? (
              <Field label="Reference" value={String(row.billing.paymentReference)} mono />
            ) : null}
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
        <a
          key={`${url}-${i}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="aspect-square overflow-hidden rounded-lg border border-border"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={`Site photograph ${i + 1}`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform hover:scale-105"
          />
        </a>
      ))}
    </div>
  )
}

function Attachments({ row }: { row: SubmissionRow }) {
  const source = row.files ?? row.documents
  if (!source) return null

  const entries = Object.entries(source).filter(
    ([key, value]) => key !== "sitePhotos" && typeof value === "string" && value,
  )
  if (!entries.length) return null

  return (
    <div>
      <SectionLabel>Documents</SectionLabel>
      <ul className="space-y-2">
        {entries.map(([key, url]) => (
          <li
            key={key}
            className="flex items-center justify-between gap-3 rounded-lg border border-border px-3.5 py-2.5"
          >
            <span className="text-[13px] font-medium text-foreground">{labelise(key)}</span>
            <a
              href={String(url)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12.5px] font-semibold text-accent underline-offset-4 hover:underline"
            >
              Open
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

function History({ row }: { row: SubmissionRow }) {
  return (
    <div>
      <SectionLabel>History</SectionLabel>
      {row.comments?.length ? (
        <ol className="space-y-3">
          {row.comments
            .slice()
            .reverse()
            .map((entry, i) => (
              <li key={i} className="border-l-2 border-border pl-3.5">
                <p className="text-[13px] font-semibold text-foreground">{entry.action}</p>
                <p className="text-[11.5px] text-muted-foreground">
                  {formatDateTime(entry.timestamp)}
                </p>
                {entry.text && entry.text !== entry.action ? (
                  <p className="mt-1 text-[13px] text-muted-foreground">{entry.text}</p>
                ) : null}
              </li>
            ))}
        </ol>
      ) : (
        <p className="text-[13px] text-muted-foreground">
          Nothing recorded yet. Your decision will be the first entry.
        </p>
      )}
    </div>
  )
}

export function labelise(key: string) {
  const spaced = key.replace(/([A-Z])/g, " $1").replace(/[_-]+/g, " ").trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase()
}
