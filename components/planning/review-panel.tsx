"use client"

import * as React from "react"
import { limit } from "firebase/firestore"
import { getDownloadURL, ref, uploadBytes } from "firebase/storage"
import { Forward, Loader2, Paperclip, Square } from "lucide-react"
import { storage } from "@/lib/firebase"
import { DEPARTMENT, REGISTER_COLLECTION, STATUS, stage } from "@/lib/workflow"
import { ILLUMINATION_TYPES, STRUCTURE_TYPES, type Measurements } from "@/lib/tariff"
import { useRealtimeCollection } from "@/hooks/use-firestore"
import { toast } from "@/components/ui/toast"
import { ActionButton, FieldGrid, SelectField, TextField, TextareaField } from "@/components/dashboard/form-kit"
import { WorkQueue, type QueueDraft, type SubmissionRow } from "@/components/dashboard/work-queue"
import { cn } from "@/lib/utils"

interface TechnicalDraft extends Record<string, unknown> {
  structureType: string
  illuminationType: string
  faceHeightMeters: string
  faceWidthMeters: string
  numberOfFaces: string
  gpsLatitude: string
  gpsLongitude: string
  foundationDepthMeters: string
  corenEngineerName: string
  corenLicenseNumber: string
  structuralIntegrityCert: string
  setbackFromRoadMeters: string
  clashDetectionStatus: string
  trafficSightlineClearance: boolean
  utilityLineClearance: boolean
  approvedSpatialPolygon: string
  vettedBy: string
  vettingNotes: string
}

const num = (v: string) => Number(v)
const hasNum = (v: string) => v.trim() !== "" && Number.isFinite(Number(v))
const faceArea = (d: TechnicalDraft) => {
  const a = num(d.faceHeightMeters) * num(d.faceWidthMeters) * Math.max(1, Math.floor(num(d.numberOfFaces) || 1))
  return a > 0 ? Math.round(a * 100) / 100 : 0
}

function haversine(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000
  const toRad = (x: number) => (x * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function validatePolygon(value: string): string | null {
  try {
    const obj = JSON.parse(value)
    const geom = obj?.type === "Feature" ? obj.geometry : obj
    if (geom?.type !== "Polygon" || !Array.isArray(geom.coordinates?.[0])) return "GeoJSON must be a Polygon."
    const ring = geom.coordinates[0] as number[][]
    if (ring.length < 4) return "A polygon ring needs at least 4 points."
    const [f, l] = [ring[0], ring[ring.length - 1]]
    if (f[0] !== l[0] || f[1] !== l[1]) return "The polygon ring must close (first point = last point)."
    return null
  } catch {
    return "Spatial polygon isn't valid JSON."
  }
}

function squarePolygon(lat: number, lng: number, radius: number) {
  const dLat = radius / 111320
  const dLng = radius / (111320 * Math.cos((lat * Math.PI) / 180))
  const r = (n: number) => Number(n.toFixed(8))
  const ring = [
    [r(lng - dLng), r(lat - dLat)],
    [r(lng + dLng), r(lat - dLat)],
    [r(lng + dLng), r(lat + dLat)],
    [r(lng - dLng), r(lat + dLat)],
    [r(lng - dLng), r(lat - dLat)],
  ]
  return JSON.stringify({ type: "Polygon", coordinates: [ring] })
}

function Clearance({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div>
      <p className="mb-1.5 text-[12.5px] font-medium text-foreground">{label}</p>
      <div className="inline-flex w-full rounded-lg border border-input p-0.5">
        {[true, false].map((opt) => (
          <button
            key={String(opt)}
            type="button"
            onClick={() => onChange(opt)}
            aria-pressed={value === opt}
            className={cn(
              "flex-1 rounded-[7px] px-2 py-1.5 text-[12.5px] font-semibold",
              value === opt
                ? opt
                  ? "bg-[hsl(var(--state-clear-soft))] text-[hsl(var(--state-clear))]"
                  : "bg-[hsl(var(--state-stop-soft))] text-[hsl(var(--state-stop))]"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {opt ? "Clear" : "Not clear"}
          </button>
        ))}
      </div>
    </div>
  )
}

interface RegisterPoint {
  gpsCoordinates?: string
  category?: string
  submissionRef?: string
  permitNumber?: string
  holderName?: string
}

function VettingForm({ d, set, row }: { d: TechnicalDraft; set: (p: Partial<TechnicalDraft>) => void; row: SubmissionRow }) {
  const [uploading, setUploading] = React.useState(false)
  const { data: register } = useRealtimeCollection<RegisterPoint>(REGISTER_COLLECTION, [limit(500)], [])

  const nearest = React.useMemo(() => {
    if (!hasNum(d.gpsLatitude) || !hasNum(d.gpsLongitude)) return null
    const lat = num(d.gpsLatitude)
    const lng = num(d.gpsLongitude)
    let best: { distance: number; label: string } | null = null
    for (const entry of register) {
      if (entry.category !== "third-party" || entry.submissionRef === row.id) continue
      const m = (entry.gpsCoordinates ?? "").match(/(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/)
      if (!m) continue
      const distance = haversine(lat, lng, Number(m[1]), Number(m[2]))
      if (!best || distance < best.distance) best = { distance, label: `${entry.holderName ?? ""} (${entry.permitNumber ?? ""})` }
    }
    return best
  }, [register, d.gpsLatitude, d.gpsLongitude, row.id])

  const uploadCert = async (file?: File) => {
    if (!file) return
    setUploading(true)
    try {
      const target = ref(storage, `planning/${row.id}/structural-cert-${Date.now()}.pdf`)
      await uploadBytes(target, file, { contentType: file.type })
      set({ structuralIntegrityCert: await getDownloadURL(target) })
    } catch (err) {
      toast.error({ title: "Upload failed", description: err instanceof Error ? err.message : "Try again." })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-5">
      <FieldGrid columns={3}>
        <SelectField id="pl-type" label="Structure type" value={d.structureType} onChange={(v) => set({ structureType: v })} options={STRUCTURE_TYPES} />
        <SelectField id="pl-ill" label="Illumination" value={d.illuminationType} onChange={(v) => set({ illuminationType: v })} options={ILLUMINATION_TYPES} />
        <TextField id="pl-faces" label="Number of faces" value={d.numberOfFaces} onChange={(v) => set({ numberOfFaces: v })} />
        <TextField id="pl-h" label="Face height (m)" value={d.faceHeightMeters} onChange={(v) => set({ faceHeightMeters: v })} />
        <TextField id="pl-w" label="Face width (m)" value={d.faceWidthMeters} onChange={(v) => set({ faceWidthMeters: v })} />
        <TextField id="pl-area" label="Display area (m²)" value={faceArea(d).toFixed(2)} onChange={() => undefined} hint="H × W × faces (read-only)" />
        <TextField id="pl-lat" label="GPS latitude" mono value={d.gpsLatitude} onChange={(v) => set({ gpsLatitude: v })} />
        <TextField id="pl-lng" label="GPS longitude" mono value={d.gpsLongitude} onChange={(v) => set({ gpsLongitude: v })} />
        <TextField id="pl-found" label="Foundation depth (m)" value={d.foundationDepthMeters} onChange={(v) => set({ foundationDepthMeters: v })} />
      </FieldGrid>

      <FieldGrid columns={3}>
        <TextField id="pl-eng" label="COREN engineer" value={d.corenEngineerName} onChange={(v) => set({ corenEngineerName: v })} />
        <TextField id="pl-coren" label="COREN licence number" mono value={d.corenLicenseNumber} onChange={(v) => set({ corenLicenseNumber: v })} />
        <div>
          <p className="mb-1.5 text-[12.5px] font-medium text-foreground">Structural integrity certificate</p>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[12.5px] font-semibold hover:bg-muted">
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
            {d.structuralIntegrityCert ? "Replace PDF" : "Upload PDF"}
            <input type="file" accept=".pdf" className="hidden" onChange={(e) => uploadCert(e.target.files?.[0])} />
          </label>
          {d.structuralIntegrityCert ? (
            <a href={d.structuralIntegrityCert} target="_blank" rel="noopener noreferrer" className="ml-2 text-[12px] text-accent underline-offset-4 hover:underline">
              view
            </a>
          ) : null}
        </div>
      </FieldGrid>

      <FieldGrid columns={4}>
        <TextField id="pl-setback" label="Setback from road (m)" value={d.setbackFromRoadMeters} onChange={(v) => set({ setbackFromRoadMeters: v })} />
        <SelectField
          id="pl-clash"
          label="Clash detection"
          value={d.clashDetectionStatus}
          onChange={(v) => set({ clashDetectionStatus: v })}
          hint={nearest ? `Nearest permitted billboard: ${Math.round(nearest.distance)} m — ${nearest.label}` : "No permitted billboard on record nearby"}
          options={[
            { value: "Clear", label: "Clear" },
            { value: "Warning_Proximity_Issue", label: "Warning — proximity issue" },
            { value: "Rejected_Overlap", label: "Rejected — overlap" },
          ]}
        />
        <Clearance label="Traffic sightline" value={d.trafficSightlineClearance} onChange={(v) => set({ trafficSightlineClearance: v })} />
        <Clearance label="Utility line clearance" value={d.utilityLineClearance} onChange={(v) => set({ utilityLineClearance: v })} />
      </FieldGrid>

      <div>
        <TextareaField
          id="pl-poly"
          label="Approved spatial polygon (GeoJSON)"
          value={d.approvedSpatialPolygon}
          rows={4}
          placeholder='{"type":"Polygon","coordinates":[[[lng,lat],…]]}'
          onChange={(v) => set({ approvedSpatialPolygon: v })}
        />
        <div className="mt-2">
          <ActionButton
            tone="quiet"
            icon={Square}
            onClick={() => {
              if (!hasNum(d.gpsLatitude) || !hasNum(d.gpsLongitude)) {
                toast.warning({ title: "Enter the coordinates first" })
                return
              }
              set({ approvedSpatialPolygon: squarePolygon(num(d.gpsLatitude), num(d.gpsLongitude), 25) })
            }}
          >
            Generate 25 m exclusion zone
          </ActionButton>
        </div>
      </div>

      <FieldGrid>
        <TextField id="pl-by" label="Vetted by" value={d.vettedBy} onChange={(v) => set({ vettedBy: v })} />
      </FieldGrid>
      <TextareaField id="pl-notes" label="Vetting notes" value={d.vettingNotes} rows={3} onChange={(v) => set({ vettingNotes: v })} />
    </div>
  )
}

const draft: QueueDraft<TechnicalDraft> = {
  field: "technicalReport",
  views: ["review"],
  title: "Planning & technical vetting",
  initial: (row) => {
    const p = (row.technicalReport ?? {}) as Partial<TechnicalDraft>
    const [lat, lng] = (row.gpsCoordinates ?? "").split(",").map((s) => s.trim())
    return {
      structureType: p.structureType ?? row.applicationType ?? "",
      illuminationType: p.illuminationType ?? "",
      faceHeightMeters: p.faceHeightMeters ?? "",
      faceWidthMeters: p.faceWidthMeters ?? "",
      numberOfFaces: p.numberOfFaces ?? "1",
      gpsLatitude: p.gpsLatitude ?? lat ?? "",
      gpsLongitude: p.gpsLongitude ?? lng ?? "",
      foundationDepthMeters: p.foundationDepthMeters ?? "",
      corenEngineerName: p.corenEngineerName ?? "",
      corenLicenseNumber: p.corenLicenseNumber ?? "",
      structuralIntegrityCert: p.structuralIntegrityCert ?? "",
      setbackFromRoadMeters: p.setbackFromRoadMeters ?? "",
      clashDetectionStatus: p.clashDetectionStatus ?? "",
      trafficSightlineClearance: p.trafficSightlineClearance ?? false,
      utilityLineClearance: p.utilityLineClearance ?? false,
      approvedSpatialPolygon: p.approvedSpatialPolygon ?? "",
      vettedBy: p.vettedBy ?? "",
      vettingNotes: p.vettingNotes ?? "",
    }
  },
  validate: (d) => {
    if (!d.structureType || !d.illuminationType) return "Choose the structure type and illumination."
    if (!(faceArea(d) > 0)) return "Enter face height, width and number of faces."
    if (!hasNum(d.gpsLatitude) || !hasNum(d.gpsLongitude)) return "Record the GPS coordinates."
    if (!(num(d.foundationDepthMeters) > 0)) return "Enter the foundation depth."
    if (!d.corenEngineerName.trim() || !d.corenLicenseNumber.trim()) return "Name the COREN engineer and licence."
    if (!d.structuralIntegrityCert) return "Upload the structural integrity certificate."
    if (!hasNum(d.setbackFromRoadMeters)) return "Enter the setback from the road."
    if (!d.clashDetectionStatus) return "Record the clash detection result."
    const polygon = validatePolygon(d.approvedSpatialPolygon)
    if (polygon) return polygon
    if (!d.vettedBy.trim()) return "Name the vetting officer."
    return null
  },
  derive: (d, _row, { now, actorId }) => {
    const measurements: Measurements = {
      source: "planning_development",
      items: [
        {
          id: "#01",
          type: d.structureType,
          illumination: d.illuminationType,
          height: num(d.faceHeightMeters),
          width: num(d.faceWidthMeters),
          faces: Math.max(1, Math.floor(num(d.numberOfFaces) || 1)),
          sqm: faceArea(d),
          lat: Number(num(d.gpsLatitude).toFixed(8)),
          lng: Number(num(d.gpsLongitude).toFixed(8)),
        },
      ],
      totalSqm: faceArea(d),
      lockedAt: now,
      lockedBy: d.vettedBy || actorId,
    }
    return { measurements, gpsCoordinates: `${d.gpsLatitude}, ${d.gpsLongitude}` }
  },
  render: (d, set, row) => <VettingForm d={d} set={set} row={row} />,
}

export function PlanningQueue() {
  return (
    <WorkQueue<TechnicalDraft>
      title="Technical vetting"
      description="Third-party structures the Director has sent for engineering and planning review"
      department={DEPARTMENT.planning}
      actorId="planning_development"
      draft={draft}
      views={[
        {
          value: "review",
          label: "To vet",
          routes: ["third"],
          statuses: stage("planningReview"),
          empty: { title: "Nothing to vet", body: "Third-party files the Director accepts arrive here." },
          actions: [
            {
              key: "submit",
              label: "Lock vetting — send to Director",
              icon: Forward,
              status: STATUS.planningReported,
              department: DEPARTMENT.director,
              record: "Technical vetting report filed by Planning",
              needsDraft: true,
            },
          ],
        },
        {
          value: "done",
          label: "Reported",
          routes: ["third"],
          statuses: [
            ...stage("planningReported"),
            ...stage("billing"),
            ...stage("billingQueried"),
            ...stage("billProposed"),
            ...stage("awaitingPayment"),
            ...stage("paymentReconciled"),
            ...stage("issued"),
          ],
          empty: { title: "Nothing reported yet", body: "Reports you've returned to the Director stay here." },
          column: { header: "With", render: (row) => row.department ?? "—" },
        },
      ]}
    />
  )
}
