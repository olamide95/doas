"use client"

import * as React from "react"
import { limit, orderBy } from "firebase/firestore"
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  FileWarning,
  MapPin,
  Pencil,
  Plus,
  Search,
  Signpost,
  Users,
} from "lucide-react"
import {
  PRACTITIONER_COL,
  PROFILE_FILE_SLOTS,
  SITE_FILE_SLOTS,
  SITE_MULTI_SLOTS,
  daysUntil,
  inGracePeriod,
  isDecommissioned,
  isPast,
  profileMissingDocs,
  type Actor,
  type PractitionerProfile,
  type SiteFile,
} from "@/lib/practitioner-registry"
import { useRealtimeCollection } from "@/hooks/use-firestore"
import { formatDate, formatDateTime, naira } from "@/lib/format"
import { Sheet } from "@/components/dashboard/sheet"
import { ActionButton } from "@/components/dashboard/form-kit"
import { EmptyState, Field, LoadFailed, Panel, RowsSkeleton, SectionLabel, StatTile, StatusPill } from "@/components/dashboard/kit"
import { Segmented } from "@/components/dashboard/notifications-panel"
import { PractitionerForm, type ProfileRow } from "@/components/dashboard/practitioners/practitioner-form"
import { SiteForm, type SiteRow } from "@/components/dashboard/practitioners/site-form"
import { cn } from "@/lib/utils"

/**
 * Practitioner Registry — digitised third-party practitioner files and their
 * site inventory. Shared by the CSU and Director dashboards; both can capture
 * and correct records. There is no approval step: this is data entry from the
 * physical files already held by DOAS.
 */

const EXPIRING_WINDOW = 30

type View =
  | { kind: "none" }
  | { kind: "profile"; id: string }
  | { kind: "editProfile"; id: string | null }
  | { kind: "site"; practitionerId: string; siteId: string | null; returnTo: "profile" | "none" }

type SiteFilter = "all" | "active" | "pending" | "grace" | "expiring" | "archived" | "incomplete"

function siteFlags(site: SiteRow) {
  const grace = inGracePeriod(site)
  const left = daysUntil(site.expiryDate)
  const expiring = !grace && !isDecommissioned(site.assetStatus) && left !== null && left >= 0 && left <= EXPIRING_WINDOW
  return { grace, expiring, left }
}

function Flag({ tone, children }: { tone: "stop" | "wait" | "move"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
        tone === "stop" && "bg-[hsl(var(--state-stop-soft))] text-[hsl(var(--state-stop))]",
        tone === "wait" && "bg-muted text-foreground",
        tone === "move" && "bg-primary/10 text-primary",
      )}
    >
      {children}
    </span>
  )
}

function SiteFlags({ site }: { site: SiteRow }) {
  const { grace, expiring, left } = siteFlags(site)
  return (
    <>
      {grace ? (
        <Flag tone="stop">
          <AlertTriangle className="h-3 w-3" />
          Grace period
        </Flag>
      ) : null}
      {expiring ? <Flag tone="wait">Expires in {left}d</Flag> : null}
      {!site.recordComplete ? <Flag tone="wait">{site.missingDocuments?.length ?? 0} docs missing</Flag> : null}
    </>
  )
}

function SiteListItem({ site, showPractitioner, onOpen, index }: { site: SiteRow; showPractitioner?: boolean; onOpen: () => void; index: number }) {
  return (
    <li style={{ ["--i" as string]: Math.min(index, 8) }} className="reveal">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full flex-col gap-2 rounded-lg border border-border bg-card px-3.5 py-3 text-left transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0">
          <p className="font-mono text-[12px] font-semibold text-foreground">{site.siteReferenceCode}</p>
          <p className="text-[13px] text-foreground">
            {site.structureType} · {site.operationalFaces}
            {site.totalDisplayAreaM2 ? ` · ${site.totalDisplayAreaM2.toLocaleString()} m²` : ""}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[12px] text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {site.district}, {site.areaCouncil}
              {showPractitioner ? ` · ${site.practitionerName}` : ""}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <SiteFlags site={site} />
          {site.expiryDate && !isDecommissioned(site.assetStatus) ? (
            <span className="text-[11.5px] text-muted-foreground">Exp. {formatDate(site.expiryDate)}</span>
          ) : null}
          <StatusPill status={site.assetStatus} />
        </div>
      </button>
    </li>
  )
}

export function PractitionerRegistry({ actor }: { actor: Actor }) {
  const profiles = useRealtimeCollection<PractitionerProfile>(PRACTITIONER_COL.profiles, [orderBy("companyName"), limit(1000)], [])
  const sites = useRealtimeCollection<SiteFile>(PRACTITIONER_COL.sites, [orderBy("createdAt", "desc"), limit(5000)], [])

  const [mode, setMode] = React.useState<"practitioners" | "sites">("practitioners")
  const [search, setSearch] = React.useState("")
  const [siteFilter, setSiteFilter] = React.useState<SiteFilter>("all")
  const [profileSiteTab, setProfileSiteTab] = React.useState<"live" | "archived">("live")
  const [view, setView] = React.useState<View>({ kind: "none" })

  const profileRows = profiles.data as ProfileRow[]
  const siteRows = sites.data as SiteRow[]

  const sitesByPractitioner = React.useMemo(() => {
    const map = new Map<string, SiteRow[]>()
    siteRows.forEach((s) => {
      const list = map.get(s.practitionerId) ?? []
      list.push(s)
      map.set(s.practitionerId, list)
    })
    map.forEach((list) => list.sort((a, b) => a.siteReferenceCode.localeCompare(b.siteReferenceCode)))
    return map
  }, [siteRows])

  const profileById = React.useMemo(() => new Map(profileRows.map((p) => [p.id, p])), [profileRows])

  /* ---- Stats ---- */
  const stats = React.useMemo(() => {
    let active = 0
    let grace = 0
    let expiring = 0
    let incomplete = 0
    siteRows.forEach((s) => {
      const f = siteFlags(s)
      if (s.assetStatus === "Active") active++
      if (f.grace) grace++
      if (f.expiring) expiring++
      if (!s.recordComplete) incomplete++
    })
    const expiredLicences = profileRows.filter((p) => isPast(p.arconLicenseExpiry)).length
    return { active, grace, expiring, incomplete, expiredLicences }
  }, [siteRows, profileRows])

  /* ---- Lists ---- */
  const term = search.trim().toLowerCase()

  const practitionerList = React.useMemo(() => {
    if (!term) return profileRows
    return profileRows.filter((p) =>
      [p.companyName, p.rcNumber, p.doasPractitionerId, p.email, p.managingDirector, p.arconLicenseNumber]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(term)),
    )
  }, [profileRows, term])

  const siteList = React.useMemo(() => {
    return siteRows.filter((s) => {
      const f = siteFlags(s)
      const pass =
        siteFilter === "all" ||
        (siteFilter === "active" && s.assetStatus === "Active") ||
        (siteFilter === "pending" && s.assetStatus === "Pending") ||
        (siteFilter === "grace" && f.grace) ||
        (siteFilter === "expiring" && f.expiring) ||
        (siteFilter === "archived" && isDecommissioned(s.assetStatus)) ||
        (siteFilter === "incomplete" && !s.recordComplete)
      if (!pass) return false
      if (!term) return true
      return [s.siteReferenceCode, s.practitionerName, s.district, s.areaCouncil, s.landmarkAddress, s.demandNoticeNumber, s.structureType]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(term))
    })
  }, [siteRows, siteFilter, term])

  /* ---- Current selections ---- */
  const currentProfile =
    view.kind === "profile" ? profileById.get(view.id) ?? null : view.kind === "site" ? profileById.get(view.practitionerId) ?? null : null
  const editingProfile = view.kind === "editProfile" && view.id ? profileById.get(view.id) ?? null : null
  const currentSite = view.kind === "site" && view.siteId ? siteRows.find((s) => s.id === view.siteId) ?? null : null
  const practitionerSites = currentProfile ? sitesByPractitioner.get(currentProfile.id) ?? [] : []

  const loading = profiles.loading || sites.loading
  const error = profiles.error || sites.error

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          index={0}
          label="Practitioners on file"
          value={profileRows.length}
          tone="move"
          icon={Users}
          note={stats.expiredLicences ? `${stats.expiredLicences} with an expired ARCON licence` : "All ARCON licences current"}
        />
        <StatTile index={1} label="Active sites" value={stats.active} tone="clear" icon={Signpost} note={`${siteRows.length} structures in total`} />
        <StatTile
          index={2}
          label="In grace period"
          value={stats.grace}
          tone={stats.grace ? "stop" : "clear"}
          icon={CalendarClock}
          note={stats.expiring ? `${stats.expiring} more expire within ${EXPIRING_WINDOW} days` : "Expired with no renewal payment"}
        />
        <StatTile
          index={3}
          label="Incomplete site files"
          value={stats.incomplete}
          tone={stats.incomplete ? "wait" : "clear"}
          icon={FileWarning}
          note="Documents still to scan from paper"
        />
      </div>

      <Panel
        title="Practitioner registry"
        description="Third-party practitioners and every structure they operate, digitised from the physical files"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              value={mode}
              onChange={(v) => setMode(v as typeof mode)}
              options={[
                { value: "practitioners", label: "Practitioners" },
                { value: "sites", label: "All sites" },
              ]}
            />
            <ActionButton icon={Plus} onClick={() => setView({ kind: "editProfile", id: null })}>
              Add practitioner
            </ActionButton>
          </div>
        }
        bodyClassName="p-3 sm:p-4"
      >
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={mode === "practitioners" ? "Search name, RC, DOAS ID, email…" : "Search reference, practitioner, district, demand notice…"}
              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-[13px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>
          {mode === "sites" ? (
            <select
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value as SiteFilter)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-primary"
            >
              <option value="all">All sites</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="grace">In grace period</option>
              <option value="expiring">Expiring in {EXPIRING_WINDOW} days</option>
              <option value="archived">Historical / decommissioned</option>
              <option value="incomplete">Incomplete files</option>
            </select>
          ) : null}
        </div>

        {error ? (
          <LoadFailed error={error} what="The practitioner registry" />
        ) : loading ? (
          <RowsSkeleton rows={5} columns={3} />
        ) : mode === "practitioners" ? (
          !practitionerList.length ? (
            <EmptyState
              icon={Building2}
              title={term ? "No practitioner matches that search" : "No practitioners on file yet"}
              description="Start with a practitioner's corporate file, then add each of their sites — active, pending and historical."
            />
          ) : (
            <ul className="space-y-2">
              {practitionerList.map((p, i) => {
                const list = sitesByPractitioner.get(p.id) ?? []
                const live = list.filter((s) => !isDecommissioned(s.assetStatus)).length
                const graceCount = list.filter((s) => inGracePeriod(s)).length
                const missing = profileMissingDocs(p).length
                const expired = isPast(p.arconLicenseExpiry)
                return (
                  <li key={p.id} style={{ ["--i" as string]: Math.min(i, 8) }} className="reveal">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileSiteTab("live")
                        setView({ kind: "profile", id: p.id })
                      }}
                      className="flex w-full flex-col gap-2 rounded-lg border border-border bg-card px-3.5 py-3 text-left transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-[13.5px] font-semibold text-foreground">{p.companyName}</p>
                        <p className="text-[12px] text-muted-foreground">
                          <span className="font-mono">{p.doasPractitionerId}</span> · {p.rcNumber} · ARCON {p.arconCategory}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                        {expired ? <Flag tone="stop">ARCON licence expired</Flag> : null}
                        {graceCount ? <Flag tone="stop">{graceCount} in grace</Flag> : null}
                        {missing ? <Flag tone="wait">{missing} docs missing</Flag> : null}
                        <Flag tone="move">
                          {live} live · {list.length - live} archived
                        </Flag>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )
        ) : !siteList.length ? (
          <EmptyState
            icon={Signpost}
            title="No sites match"
            description="Sites are added from inside a practitioner's file. Change the filter or search to see more."
          />
        ) : (
          <ul className="space-y-2">
            {siteList.map((s, i) => (
              <SiteListItem
                key={s.id}
                site={s}
                index={i}
                showPractitioner
                onOpen={() => setView({ kind: "site", practitionerId: s.practitionerId, siteId: s.id, returnTo: "none" })}
              />
            ))}
          </ul>
        )}
      </Panel>

      {/* ---------------- Practitioner file ---------------- */}
      <Sheet
        open={view.kind === "profile" && !!currentProfile}
        onClose={() => setView({ kind: "none" })}
        title={currentProfile?.companyName ?? "Practitioner"}
        caption={currentProfile ? `${currentProfile.doasPractitionerId}${currentProfile.isLegacyId ? " (legacy ID)" : ""}` : ""}
        width="max-w-3xl"
        footer={
          currentProfile ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <ActionButton tone="quiet" onClick={() => setView({ kind: "none" })}>
                Close
              </ActionButton>
              <ActionButton tone="quiet" icon={Pencil} onClick={() => setView({ kind: "editProfile", id: currentProfile.id })}>
                Edit profile
              </ActionButton>
              <ActionButton
                icon={Plus}
                onClick={() => setView({ kind: "site", practitionerId: currentProfile.id, siteId: null, returnTo: "profile" })}
              >
                Add site
              </ActionButton>
            </div>
          ) : null
        }
      >
        {currentProfile ? (
          <div className="space-y-6">
            {isPast(currentProfile.arconLicenseExpiry) || profileMissingDocs(currentProfile).length ? (
              <div className="space-y-1 rounded-lg border border-[hsl(var(--state-stop))]/30 bg-[hsl(var(--state-stop-soft))] px-3.5 py-2.5 text-[12.5px]">
                {isPast(currentProfile.arconLicenseExpiry) ? (
                  <p>
                    <strong>ARCON licence expired</strong> on {formatDate(currentProfile.arconLicenseExpiry)}.
                  </p>
                ) : null}
                {profileMissingDocs(currentProfile).length ? (
                  <p>
                    <strong>Missing:</strong> {profileMissingDocs(currentProfile).join(" · ")}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div>
              <SectionLabel>Corporate identification</SectionLabel>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Registered name" value={currentProfile.companyName} className="col-span-2" />
                <Field label="RC number" value={currentProfile.rcNumber} />
                <Field label="TIN" value={currentProfile.tin} />
              </div>
            </div>

            <div>
              <SectionLabel>Compliance & licensing</SectionLabel>
              <div className="grid grid-cols-2 gap-4">
                <Field label="ARCON category" value={currentProfile.arconCategory} />
                <Field label="ARCON licence no." value={currentProfile.arconLicenseNumber} />
                <Field label="Licence expiry" value={formatDate(currentProfile.arconLicenseExpiry)} />
                <Field label="Managing Director / CEO" value={currentProfile.managingDirector} />
                <Field label="Lead practitioner ARCON no." value={currentProfile.leadPractitionerArconNo} className="col-span-2" />
              </div>
            </div>

            <div>
              <SectionLabel>Contact</SectionLabel>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Head office" value={currentProfile.hqAddress} className="col-span-2" />
                <Field label="Primary phone" value={currentProfile.phonePrimary} />
                <Field label="Secondary phone" value={currentProfile.phoneSecondary || "—"} />
                <Field label="Email" value={currentProfile.email} className="col-span-2" />
              </div>
            </div>

            <div>
              <SectionLabel>Registration documents</SectionLabel>
              <ul className="space-y-1.5">
                {PROFILE_FILE_SLOTS.map((slot) => {
                  const file = currentProfile.documents?.[slot.key]
                  return (
                    <li key={slot.key} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-[12.5px]">
                      <span className="text-foreground">{slot.label}</span>
                      {file ? (
                        <a href={file.url} target="_blank" rel="noopener noreferrer" className="shrink-0 font-semibold text-primary hover:underline">
                          View
                        </a>
                      ) : (
                        <span className="shrink-0 text-[hsl(var(--state-stop))]">Not on file</span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <SectionLabel>Site inventory ({practitionerSites.length})</SectionLabel>
                <Segmented
                  value={profileSiteTab}
                  onChange={(v) => setProfileSiteTab(v as typeof profileSiteTab)}
                  options={[
                    { value: "live", label: "Active & pending" },
                    { value: "archived", label: "Historical" },
                  ]}
                />
              </div>
              {(() => {
                const shown = practitionerSites.filter((s) =>
                  profileSiteTab === "live" ? !isDecommissioned(s.assetStatus) : isDecommissioned(s.assetStatus),
                )
                return shown.length ? (
                  <ul className="space-y-2">
                    {shown.map((s, i) => (
                      <SiteListItem
                        key={s.id}
                        site={s}
                        index={i}
                        onOpen={() => setView({ kind: "site", practitionerId: currentProfile.id, siteId: s.id, returnTo: "profile" })}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-lg bg-muted/50 px-3.5 py-3 text-[12.5px] text-muted-foreground">
                    {profileSiteTab === "live" ? "No active or pending sites recorded yet." : "No historical sites recorded."}
                  </p>
                )
              })()}
            </div>

            {currentProfile.notes ? (
              <div>
                <SectionLabel>File notes</SectionLabel>
                <p className="text-[13px] text-muted-foreground">{currentProfile.notes}</p>
              </div>
            ) : null}

            <p className="text-[11.5px] text-muted-foreground">
              Captured by {currentProfile.createdBy?.toUpperCase()} {formatDateTime(currentProfile.createdAt)} · last edited by{" "}
              {currentProfile.updatedBy?.toUpperCase()} {formatDateTime(currentProfile.updatedAt)}
            </p>
          </div>
        ) : null}
      </Sheet>

      {/* ---------------- Forms ---------------- */}
      <PractitionerForm
        open={view.kind === "editProfile"}
        existing={editingProfile}
        actor={actor}
        onClose={() => setView(view.kind === "editProfile" && view.id ? { kind: "profile", id: view.id } : { kind: "none" })}
        onSaved={(id) => setView({ kind: "profile", id })}
      />

      {view.kind === "site" && currentProfile ? (
        <SiteForm
          open
          practitioner={currentProfile}
          existing={currentSite}
          siblingCodes={practitionerSites.filter((s) => s.id !== currentSite?.id).map((s) => s.siteReferenceCode)}
          actor={actor}
          onClose={() => setView(view.returnTo === "profile" ? { kind: "profile", id: view.practitionerId } : { kind: "none" })}
          onSaved={() => setView(view.returnTo === "profile" ? { kind: "profile", id: view.practitionerId } : { kind: "none" })}
        />
      ) : null}

      {/* Revenue snapshot — quick sense check for the Director */}
      {!loading && siteRows.length ? <RevenueStrip sites={siteRows} /> : null}
    </div>
  )
}

function RevenueStrip({ sites }: { sites: SiteRow[] }) {
  const live = sites.filter((s) => !isDecommissioned(s.assetStatus))
  const valuation = live.reduce((sum, s) => sum + (s.annualPermitFee ?? 0), 0)
  const collected = live.reduce((sum, s) => sum + (s.amountPaid ?? 0), 0)
  const outstanding = Math.max(0, valuation - collected)
  const receipts = sites.reduce(
    (sum, s) => sum + SITE_MULTI_SLOTS.reduce((n, slot) => n + (s.receipts?.[slot.key]?.length ?? 0), 0),
    0,
  )
  const photos = sites.reduce((sum, s) => sum + SITE_FILE_SLOTS.filter((slot) => s.documents?.[slot.key]).length, 0)
  return (
    <Panel title="Recorded revenue" description="From demand notices and payments captured on the site files">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label="Annual valuation (live sites)" value={naira(valuation)} />
        <Field label="Paid on file" value={naira(collected)} />
        <Field label="Outstanding" value={naira(outstanding)} />
        <Field label="Documents digitised" value={`${photos + receipts} files`} />
      </div>
    </Panel>
  )
}