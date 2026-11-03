"use client"

import * as React from "react"
import { BadgeCheck, CalendarDays, CalendarPlus, ExternalLink, FileBadge2, FileClock, FileText, Loader2, MapPin, Megaphone, Signpost, TriangleAlert } from "lucide-react"
import { stage } from "@/lib/workflow"
import { ISSUED_META, documentPath } from "@/lib/issued-documents"
import { applicantMessage } from "@/lib/applicant"
import { isDecommissioned, isPast } from "@/lib/practitioner-registry"
import { formatDate, formatDateTime, truncate } from "@/lib/format"
import { typeLabel } from "@/lib/tariff"
import { toast } from "@/components/ui/toast"
import { ActionButton, SelectField, TextField, TextareaField } from "@/components/dashboard/form-kit"
import { EmptyState, Field, LoadFailed, PageHeading, Panel, RowsSkeleton, SectionLabel, StatTile, StatusPill } from "@/components/dashboard/kit"
import { portalApi, usePortal } from "@/components/auth/portal-context"
import type { Announcement } from "@/components/shared/announcements-panel"
import { inProgress, needsPractitioner, useOpenAnnouncements, usePortalApplications, usePortalDocuments, usePortalMeetings, usePortalSites } from "@/components/portal/use-portal-data"

type AnnouncementRow = Announcement & { id: string }

/* ------------------------------------------------------------------ *
 * Dashboard
 * ------------------------------------------------------------------ */

export function PortalOverview({
  onApply,
  onOpenApplication,
  onNavigate,
}: {
  onApply: (a: AnnouncementRow | null) => void
  onOpenApplication: (submissionId: string) => void
  onNavigate: (tab: string) => void
}) {
  const { profile } = usePortal()
  const apps = usePortalApplications()
  const announcements = useOpenAnnouncements()
  const docs = usePortalDocuments()
  const sites = usePortalSites()

  const action = apps.rows.filter(needsPractitioner)
  const progress = apps.rows.filter(inProgress)
  const approved = apps.rows.filter((r) => stage("issued").includes(r.status ?? ""))
  const liveSites = sites.data.filter((s) => !isDecommissioned(s.assetStatus)).length
  const licenceExpired = isPast(profile?.arconLicenseExpiry)

  return (
    <div className="space-y-6">
      <PageHeading
        title={profile?.companyName ?? "Practitioner portal"}
        description="Apply for new sites, pay through Remita, upload documents when asked and collect your letters, receipts and certificates."
        actions={<ActionButton onClick={() => onApply(null)}>New application</ActionButton>}
      />

      {licenceExpired ? (
        <div className="flex items-start gap-2 rounded-lg border border-[hsl(var(--state-stop))]/30 bg-[hsl(var(--state-stop-soft))] px-4 py-3 text-[13px]">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--state-stop))]" />
          Your ARCON licence on file expired on {formatDate(profile?.arconLicenseExpiry)}. Send the renewed licence to Customer Service so your file stays current.
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile index={0} label="Needs your action" value={action.length} tone={action.length ? "stop" : "clear"} icon={TriangleAlert} onClick={() => onNavigate("applications")} />
        <StatTile index={1} label="In progress" value={progress.length} tone="move" icon={FileClock} onClick={() => onNavigate("applications")} />
        <StatTile index={2} label="Approved" value={approved.length} tone="clear" icon={BadgeCheck} onClick={() => onNavigate("documents")} />
        <StatTile index={3} label="Sites on your file" value={liveSites} tone="idle" icon={Signpost} onClick={() => onNavigate("sites")} />
      </div>

      {action.length ? (
        <Panel title="Waiting on you" description="Open each one to upload, pay or request setting out" bodyClassName="p-3 sm:p-4">
          <ul className="space-y-2">
            {action.map((r) => {
              const msg = applicantMessage(r.status, "third")
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => onOpenApplication(r.submissionId ?? r.id)}
                    className="flex w-full flex-col gap-1 rounded-lg border border-[hsl(var(--state-stop))]/30 bg-card px-3.5 py-3 text-left hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-semibold text-foreground">{msg.headline}</span>
                      <span className="block text-[12px] text-muted-foreground">
                        {r.submissionId} · {truncate(r.signageSiteAddress, 50)}
                      </span>
                    </span>
                    <StatusPill status={r.status} />
                  </button>
                </li>
              )
            })}
          </ul>
        </Panel>
      ) : null}

      <AnnouncementsList rows={announcements.rows} loading={announcements.loading} error={announcements.error} onApply={onApply} compact />

      <Panel title="Latest documents" description="Letters, e-receipts and certificates issued to you" bodyClassName="p-3 sm:p-4">
        {docs.loading ? (
          <RowsSkeleton rows={3} columns={3} />
        ) : !docs.rows.length ? (
          <EmptyState icon={FileBadge2} title="No documents yet" description="Your documents request letters, e-receipts, setting-out certificates and approval letters appear here." />
        ) : (
          <DocumentList rows={docs.rows.slice(0, 5)} />
        )}
      </Panel>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Announcements
 * ------------------------------------------------------------------ */

export function AnnouncementsList({
  rows,
  loading,
  error,
  onApply,
  compact,
}: {
  rows: AnnouncementRow[]
  loading: boolean
  error: Error | null
  onApply: (a: AnnouncementRow) => void
  compact?: boolean
}) {
  const shown = compact ? rows.slice(0, 4) : rows
  return (
    <Panel title="New sites from DOAS" description="Sites the Directorate has opened for application" bodyClassName="p-3 sm:p-4">
      {error ? (
        <LoadFailed error={error} what="Announcements" />
      ) : loading ? (
        <RowsSkeleton rows={3} columns={3} />
      ) : !shown.length ? (
        <EmptyState icon={Megaphone} title="No open announcements" description="New sites announced by DOAS appear here. You can still apply for a site you have identified yourself." />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {shown.map((a) => (
            <li key={a.id} className="overflow-hidden rounded-lg border border-border bg-card">
              {a.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.photoUrl} alt={a.title} className="h-36 w-full object-cover" />
              ) : null}
              <div className="space-y-1.5 p-3.5">
                <p className="text-[14px] font-semibold text-foreground">{a.title}</p>
                <p className="flex items-center gap-1 text-[12.5px] text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {truncate(a.address, 60)} · {a.district ? `${a.district}, ` : ""}
                  {a.areaCouncil}
                </p>
                <p className="text-[12.5px] text-muted-foreground">
                  {typeLabel(a.structureType)}
                  {a.dimensions ? ` · ${a.dimensions}` : ""}
                  {a.closingDate ? ` · closes ${formatDate(a.closingDate)}` : ""}
                </p>
                {a.description ? <p className="text-[12.5px] text-foreground">{truncate(a.description, compact ? 120 : 400)}</p> : null}
                <div className="pt-1.5">
                  <ActionButton onClick={() => onApply(a)}>Apply for this site</ActionButton>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

export function PortalAnnouncements({ onApply }: { onApply: (a: AnnouncementRow) => void }) {
  const { rows, loading, error } = useOpenAnnouncements()
  return <AnnouncementsList rows={rows} loading={loading} error={error} onApply={onApply} />
}

/* ------------------------------------------------------------------ *
 * Documents
 * ------------------------------------------------------------------ */

function DocumentList({ rows }: { rows: ReturnType<typeof usePortalDocuments>["rows"] }) {
  return (
    <ul className="space-y-2">
      {rows.map((d) => (
        <li key={d.code} className="flex flex-col gap-2 rounded-lg border border-border px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-[13.5px] font-medium text-foreground">
              <FileText className="h-3.5 w-3.5" /> {ISSUED_META[d.kind]?.title ?? d.title}
            </span>
            <span className="block text-[12px] text-muted-foreground">
              {d.submissionId} · {truncate(d.siteAddress, 50)} · {formatDate(d.issuedAt)}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {d.status === "revoked" ? <StatusPill status="Revoked" tone="stop" /> : null}
            <a
              href={documentPath(d.code)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-accent underline-offset-4 hover:underline"
            >
              Open / print <ExternalLink className="h-3 w-3" />
            </a>
          </span>
        </li>
      ))}
    </ul>
  )
}

export function PortalDocuments() {
  const { rows, loading, error } = usePortalDocuments()
  return (
    <Panel title="Letters, receipts & certificates" description="Every document carries a QR code and barcode anyone can use to verify it" bodyClassName="p-3 sm:p-4">
      {error ? (
        <LoadFailed error={error} what="Your documents" />
      ) : loading ? (
        <RowsSkeleton rows={4} columns={3} />
      ) : !rows.length ? (
        <EmptyState icon={FileBadge2} title="No documents yet" description="Documents appear here as each stage of your applications is completed." />
      ) : (
        <DocumentList rows={rows} />
      )}
    </Panel>
  )
}

/* ------------------------------------------------------------------ *
 * Sites on file
 * ------------------------------------------------------------------ */

export function PortalSites() {
  const { data, loading, error } = usePortalSites()
  const rows = [...data].sort((a, b) => (a.siteReferenceCode ?? "").localeCompare(b.siteReferenceCode ?? ""))
  return (
    <Panel title="Sites on your DOAS file" description="Structures recorded against your practitioner file" bodyClassName="p-3 sm:p-4">
      {error ? (
        <LoadFailed error={error} what="Your sites" />
      ) : loading ? (
        <RowsSkeleton rows={4} columns={4} />
      ) : !rows.length ? (
        <EmptyState icon={Signpost} title="No sites recorded" description="Approved structures are added to your file by the Directorate." />
      ) : (
        <ul className="space-y-2">
          {rows.map((s) => (
            <li key={s.id} className="flex flex-col gap-2 rounded-lg border border-border px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-mono text-[12px] font-semibold text-foreground">{s.siteReferenceCode}</p>
                <p className="text-[13px] text-foreground">
                  {s.structureType} · {s.operationalFaces}
                  {s.totalDisplayAreaM2 ? ` · ${s.totalDisplayAreaM2.toLocaleString()} m²` : ""}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  {s.landmarkAddress ? `${truncate(s.landmarkAddress, 50)} · ` : ""}
                  {s.district}, {s.areaCouncil}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {s.expiryDate ? <span className="text-[12px] text-muted-foreground">Exp. {formatDate(s.expiryDate)}</span> : null}
                <StatusPill status={s.assetStatus} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

/* ------------------------------------------------------------------ *
 * Meetings
 * ------------------------------------------------------------------ */

export function PortalMeetings() {
  const { profile } = usePortal()
  const { rows, loading, error } = usePortalMeetings()
  const apps = usePortalApplications()
  const [form, setForm] = React.useState({ purpose: "", preferredDate: "", preferredTime: "", urgency: "low", relatedApplication: "", contactName: profile?.managingDirector ?? "" })
  const [busy, setBusy] = React.useState(false)
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  const send = async () => {
    if (!form.purpose.trim() || !form.preferredDate) {
      toast.warning({ title: "Give the purpose and a preferred date" })
      return
    }
    setBusy(true)
    try {
      await portalApi("/api/portal", { action: "meeting", ...form })
      toast.success({ title: "Meeting request sent", description: "Customer Service will screen it for the Director." })
      setForm((f) => ({ ...f, purpose: "", preferredDate: "", preferredTime: "", relatedApplication: "" }))
    } catch (err) {
      toast.error({ title: "Not sent", description: err instanceof Error ? err.message : "Try again." })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Panel className="lg:col-span-2" title="Request a meeting" description="Your name, company, email and phone come from your file">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/40 p-3 text-[12.5px]">
            <Field label="Company" value={profile?.companyName} />
            <Field label="Email" value={profile?.email} />
            <Field label="Phone" value={profile?.phonePrimary} />
          </div>
          <TextField id="pm-name" label="Attending" value={form.contactName} onChange={(v) => set({ contactName: v })} />
          <TextareaField id="pm-purpose" label="Purpose *" rows={3} value={form.purpose} onChange={(v) => set({ purpose: v })} />
          <div className="grid grid-cols-2 gap-3">
            <TextField id="pm-date" label="Preferred date *" type="date" value={form.preferredDate} onChange={(v) => set({ preferredDate: v })} />
            <TextField id="pm-time" label="Preferred time" type="time" value={form.preferredTime} onChange={(v) => set({ preferredTime: v })} />
          </div>
          <SelectField
            id="pm-urgency"
            label="Urgency"
            value={form.urgency}
            onChange={(v) => set({ urgency: v })}
            options={[
              { value: "low", label: "Low" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" },
            ]}
          />
          <SelectField
            id="pm-app"
            label="Related application (optional)"
            value={form.relatedApplication}
            onChange={(v) => set({ relatedApplication: v })}
            options={apps.rows.map((r) => ({ value: r.submissionId ?? r.id, label: `${r.submissionId} — ${truncate(r.signageSiteAddress, 30)}` }))}
          />
          <ActionButton icon={busy ? Loader2 : CalendarPlus} disabled={busy} onClick={send}>
            Send request
          </ActionButton>
        </div>
      </Panel>

      <Panel className="lg:col-span-3" title="Your meeting requests" bodyClassName="p-3 sm:p-4">
        {error ? (
          <LoadFailed error={error} what="Meeting requests" />
        ) : loading ? (
          <RowsSkeleton rows={3} columns={3} />
        ) : !rows.length ? (
          <EmptyState icon={CalendarDays} title="No meeting requests" description="Requests you send appear here with the Director's decision." />
        ) : (
          <ul className="space-y-2">
            {rows.map((m) => (
              <li key={m.id} className="rounded-lg border border-border px-3.5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-[12px] text-muted-foreground">{m.requestId}</p>
                  <StatusPill status={m.status} />
                </div>
                <p className="mt-1 text-[13px] text-foreground">{truncate(m.purpose, 140)}</p>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Preferred {formatDate(m.preferredDate)} {m.preferredTime ?? ""} · requested {formatDateTime(m.createdAt)}
                </p>
                {m.directorComment ? <p className="mt-1 text-[12.5px] text-foreground">Director: {m.directorComment}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Profile (read-only)
 * ------------------------------------------------------------------ */

export function PortalProfile() {
  const { profile, portal } = usePortal()
  if (!profile) return <EmptyState icon={FileText} title="Practitioner file not found" description="Contact DOAS Customer Service." />
  return (
    <Panel title="Your practitioner file" description="Held by DOAS. Every application is filled in from these details — ask Customer Service to correct anything wrong.">
      <div className="space-y-6">
        <div>
          <SectionLabel>Corporate identification</SectionLabel>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Registered name" value={profile.companyName} className="col-span-2" />
            <Field label="DOAS practitioner ID" value={profile.doasPractitionerId} mono />
            <Field label="RC number" value={profile.rcNumber} mono />
            <Field label="TIN" value={profile.tin} mono />
          </div>
        </div>
        <div>
          <SectionLabel>Licensing</SectionLabel>
          <div className="grid grid-cols-2 gap-4">
            <Field label="ARCON category" value={profile.arconCategory} />
            <Field label="ARCON licence" value={profile.arconLicenseNumber} />
            <Field label="Licence expiry" value={formatDate(profile.arconLicenseExpiry)} />
            <Field label="Managing Director" value={profile.managingDirector} />
            <Field label="Lead practitioner ARCON no." value={profile.leadPractitionerArconNo} />
          </div>
        </div>
        <div>
          <SectionLabel>Contact</SectionLabel>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Head office" value={profile.hqAddress} className="col-span-2" />
            <Field label="Phone" value={profile.phonePrimary} />
            <Field label="Email on file" value={profile.email} />
            <Field label="Portal login" value={portal?.email} />
          </div>
        </div>
      </div>
    </Panel>
  )
}
