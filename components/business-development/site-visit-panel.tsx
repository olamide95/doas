"use client"

import * as React from "react"
import { getDownloadURL, ref, uploadBytes } from "firebase/storage"
import { Camera, Crosshair, Forward, Loader2, Plus, Trash2 } from "lucide-react"
import { storage } from "@/lib/firebase"
import { ALL_STATUSES, DEPARTMENT, STATUS, stage } from "@/lib/workflow"
import { ILLUMINATION_TYPES, MATERIALS, OCCUPANCY_TYPES, SIGN_TYPES, type Measurements } from "@/lib/tariff"
import { useCurrentUser } from "@/hooks/use-firestore"
import { toast } from "@/components/ui/toast"
import { ActionButton, FieldGrid, SelectField, TextField, TextareaField } from "@/components/dashboard/form-kit"
import { WorkQueue, type QueueDraft, type SubmissionRow } from "@/components/dashboard/work-queue"

interface SignItem {
  signId: string
  signType: string
  illuminationType: string
  materialComposition: string
  heightMeters: string
  widthMeters: string
  gpsLatitude: string
  gpsLongitude: string
  sitePhotoFront: string
  sitePhotoContext: string
}

interface InspectionDraft extends Record<string, unknown> {
  inspectionTimestamp: string
  assignedOfficerId: string
  assignedOfficerName: string
  buildingOccupancyType: string
  signs: SignItem[]
  fieldNotes: string
}

const num = (v: string) => Number(v)
const sqm = (s: SignItem) => {
  const h = num(s.heightMeters)
  const w = num(s.widthMeters)
  return h > 0 && w > 0 ? Math.round(h * w * 100) / 100 : 0
}
const sid = (i: number) => `#${String(i + 1).padStart(2, "0")}`

const blankSign = (i: number, row?: SubmissionRow): SignItem => {
  const [lat, lng] = (row?.gpsCoordinates ?? "").split(",").map((s) => s.trim())
  return {
    signId: sid(i),
    signType: i === 0 ? (row?.applicationType ?? "") : "",
    illuminationType: "",
    materialComposition: "",
    heightMeters: "",
    widthMeters: "",
    gpsLatitude: lat && !Number.isNaN(Number(lat)) ? lat : "",
    gpsLongitude: lng && !Number.isNaN(Number(lng)) ? lng : "",
    sitePhotoFront: "",
    sitePhotoContext: "",
  }
}

function PhotoField({ label, url, path, onChange }: { label: string; url: string; path: string; onChange: (url: string) => void }) {
  const [busy, setBusy] = React.useState(false)
  const id = React.useId()
  const upload = async (file?: File) => {
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      toast.warning({ title: "Photo too large", description: "Keep photos under 10 MB." })
      return
    }
    setBusy(true)
    try {
      const target = ref(storage, `${path}-${Date.now()}-${file.name.replace(/\s+/g, "-")}`)
      await uploadBytes(target, file, { contentType: file.type })
      onChange(await getDownloadURL(target))
    } catch (err) {
      toast.error({ title: "Upload failed", description: err instanceof Error ? err.message : "Try again." })
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-[12.5px] font-medium text-foreground">{label} *</p>
      <label htmlFor={id} className="relative flex aspect-video cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-border bg-muted/30 hover:border-ring">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} className="h-full w-full object-cover" />
        ) : busy ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-[12px] text-muted-foreground">
            <Camera className="h-5 w-5" /> Take or choose photo
          </span>
        )}
        <input id={id} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
      </label>
    </div>
  )
}

function SiteInspectionForm({ d, set, row }: { d: InspectionDraft; set: (p: Partial<InspectionDraft>) => void; row: SubmissionRow }) {
  const { user } = useCurrentUser()

  React.useEffect(() => {
    if (!d.assignedOfficerId && user) set({ assignedOfficerId: user.uid, assignedOfficerName: user.displayName || user.email || "" })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const update = (i: number, patch: Partial<SignItem>) => set({ signs: d.signs.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) })
  const add = () => set({ signs: [...d.signs, blankSign(d.signs.length)] })
  const remove = (i: number) => set({ signs: d.signs.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, signId: sid(idx) })) })

  const locate = (i: number) => {
    if (!navigator.geolocation) {
      toast.warning({ title: "No GPS on this device" })
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => update(i, { gpsLatitude: pos.coords.latitude.toFixed(8), gpsLongitude: pos.coords.longitude.toFixed(8) }),
      (err) => toast.error({ title: "Couldn't get location", description: err.message }),
      { enableHighAccuracy: true, timeout: 15000 },
    )
  }

  const total = d.signs.reduce((s, x) => s + sqm(x), 0)

  return (
    <div className="space-y-5">
      <FieldGrid columns={3}>
        <TextField id="bd-ts" label="Inspection timestamp" value={new Date(d.inspectionTimestamp).toLocaleString("en-NG")} onChange={() => undefined} hint="Recorded automatically" />
        <TextField id="bd-officer" label="Inspecting officer" value={d.assignedOfficerName} onChange={(v) => set({ assignedOfficerName: v })} />
        <SelectField
          id="bd-occ"
          label="Building occupancy type"
          value={d.buildingOccupancyType}
          onChange={(v) => set({ buildingOccupancyType: v })}
          options={OCCUPANCY_TYPES.map((o) => ({ value: o, label: o }))}
        />
      </FieldGrid>

      {d.signs.map((s, i) => (
        <div key={s.signId} className="rounded-xl border border-border p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-mono text-[13px] font-semibold text-foreground">Sign {s.signId}</p>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[12.5px] text-muted-foreground">{sqm(s).toFixed(2)} m²</span>
              {d.signs.length > 1 ? (
                <button type="button" onClick={() => remove(i)} aria-label={`Remove sign ${s.signId}`} className="rounded p-1 text-muted-foreground hover:text-[hsl(var(--state-stop))]">
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
          <FieldGrid columns={3}>
            <SelectField id={`t-${i}`} label="Sign type" value={s.signType} onChange={(v) => update(i, { signType: v })} options={SIGN_TYPES} />
            <SelectField id={`il-${i}`} label="Illumination" value={s.illuminationType} onChange={(v) => update(i, { illuminationType: v })} options={ILLUMINATION_TYPES} />
            <SelectField id={`m-${i}`} label="Material" value={s.materialComposition} onChange={(v) => update(i, { materialComposition: v })} options={MATERIALS} />
            <TextField id={`h-${i}`} label="Height (m)" value={s.heightMeters} placeholder="6.00" onChange={(v) => update(i, { heightMeters: v })} />
            <TextField id={`w-${i}`} label="Width (m)" value={s.widthMeters} placeholder="2.00" onChange={(v) => update(i, { widthMeters: v })} />
            <TextField id={`a-${i}`} label="Calculated m²" value={sqm(s).toFixed(2)} onChange={() => undefined} hint="Height × width (read-only)" />
            <TextField id={`lat-${i}`} label="GPS latitude" mono value={s.gpsLatitude} placeholder="9.05785000" onChange={(v) => update(i, { gpsLatitude: v })} />
            <TextField id={`lng-${i}`} label="GPS longitude" mono value={s.gpsLongitude} placeholder="7.49508000" onChange={(v) => update(i, { gpsLongitude: v })} />
            <div className="flex items-end">
              <ActionButton tone="quiet" icon={Crosshair} onClick={() => locate(i)}>
                Use my location
              </ActionButton>
            </div>
          </FieldGrid>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <PhotoField label="Front photo" url={s.sitePhotoFront} path={`site-visits/${row.id}/${s.signId.slice(1)}-front`} onChange={(u) => update(i, { sitePhotoFront: u })} />
            <PhotoField label="Street context photo" url={s.sitePhotoContext} path={`site-visits/${row.id}/${s.signId.slice(1)}-context`} onChange={(u) => update(i, { sitePhotoContext: u })} />
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between">
        <ActionButton tone="quiet" icon={Plus} onClick={add}>
          Add another sign
        </ActionButton>
        <p className="text-[13px] text-muted-foreground">
          {d.signs.length} sign{d.signs.length > 1 ? "s" : ""} · total exposure <span className="font-semibold text-foreground">{total.toFixed(2)} m²</span>
        </p>
      </div>

      <TextareaField id="bd-notes" label="Field notes" value={d.fieldNotes} rows={3} onChange={(fieldNotes) => set({ fieldNotes })} />
      <p className="text-[12px] text-muted-foreground">Submitting locks these measurements. Billing cannot change them — a re-measure needs the Director to send the file back here.</p>
    </div>
  )
}

const validCoord = (v: string, max: number) => v.trim() !== "" && Number.isFinite(Number(v)) && Math.abs(Number(v)) <= max

const draft: QueueDraft<InspectionDraft> = {
  field: "businessDevelopmentReport",
  views: ["pending"],
  title: "Field inspection report",
  initial: (row) => {
    const prev = (row.businessDevelopmentReport ?? {}) as Partial<InspectionDraft>
    return {
      inspectionTimestamp: new Date().toISOString(),
      assignedOfficerId: prev.assignedOfficerId ?? "",
      assignedOfficerName: prev.assignedOfficerName ?? "",
      buildingOccupancyType: prev.buildingOccupancyType ?? "",
      signs: Array.isArray(prev.signs) && prev.signs.length ? prev.signs : [blankSign(0, row)],
      fieldNotes: prev.fieldNotes ?? "",
    }
  },
  validate: (d) => {
    if (!d.assignedOfficerName.trim() && !d.assignedOfficerId) return "Name the inspecting officer."
    if (!d.buildingOccupancyType) return "Select the building occupancy type."
    for (const s of d.signs) {
      if (!s.signType || !s.illuminationType || !s.materialComposition) return `Sign ${s.signId}: choose type, illumination and material.`
      if (!(num(s.heightMeters) > 0) || !(num(s.widthMeters) > 0)) return `Sign ${s.signId}: height and width must be above 0.`
      if (!validCoord(s.gpsLatitude, 90) || !validCoord(s.gpsLongitude, 180)) return `Sign ${s.signId}: record valid GPS coordinates.`
      if (!s.sitePhotoFront || !s.sitePhotoContext) return `Sign ${s.signId}: both photos are required.`
    }
    return null
  },
  derive: (d, _row, { now, actorId }) => {
    const items = d.signs.map((s) => ({
      id: s.signId,
      type: s.signType,
      illumination: s.illuminationType,
      material: s.materialComposition,
      height: num(s.heightMeters),
      width: num(s.widthMeters),
      faces: 1,
      sqm: sqm(s),
      lat: Number(Number(s.gpsLatitude).toFixed(8)),
      lng: Number(Number(s.gpsLongitude).toFixed(8)),
    }))
    const measurements: Measurements = {
      source: "business_development",
      items,
      totalSqm: Math.round(items.reduce((t, i) => t + i.sqm, 0) * 100) / 100,
      lockedAt: now,
      lockedBy: d.assignedOfficerName || actorId,
    }
    return {
      measurements,
      businessDevelopmentReport: { ...d, numberOfSignagesOnSite: d.signs.length, submittedAt: now, submittedBy: actorId },
    }
  },
  render: (d, set, row) => <SiteInspectionForm d={d} set={set} row={row} />,
}

export function BusinessDevelopmentQueue() {
  return (
    <WorkQueue<InspectionDraft>
      title="Site visits"
      description="First-party files the Director has sent for physical inspection"
      department={DEPARTMENT.businessDevelopment}
      actorId="business_development"
      draft={draft}
      views={[
        {
          value: "pending",
          label: "To visit",
          routes: ["first"],
          statuses: stage("siteVisit"),
          empty: { title: "No site visits booked", body: "First-party files the Director accepts arrive here for inspection." },
          actions: [
            {
              key: "submit",
              label: "Lock measurements — send to Director",
              icon: Forward,
              status: STATUS.visitReported,
              department: DEPARTMENT.director,
              record: "Field report logged by Business Development",
              needsDraft: true,
            },
          ],
        },
      ]}
    />
  )
}

export function BusinessDevelopmentHistory() {
  return (
    <WorkQueue
      title="Reported visits"
      description="Files you've inspected, and the desk each one is with now"
      actorId="business_development"
      views={[
        {
          value: "done",
          label: "Reported",
          routes: ["first"],
          statuses: ALL_STATUSES.filter((s) => ![...stage("withCsu"), ...stage("withDirector"), ...stage("siteVisit")].includes(s)),
          empty: { title: "Nothing reported yet", body: "Inspections you file stay here for reference." },
          column: { header: "With", render: (row) => row.department ?? "—" },
        },
      ]}
    />
  )
}

export function BusinessDevelopmentArchive() {
  return (
    <WorkQueue
      title="All first-party applications"
      description="Every first-party file, wherever it sits"
      actorId="business_development"
      views={[
        {
          value: "all",
          label: "All",
          routes: ["first"],
          statuses: ALL_STATUSES,
          empty: { title: "No first-party applications", body: "Applications filed by property owners appear here." },
          column: { header: "With", render: (row) => row.department ?? "—" },
        },
      ]}
    />
  )
}
