"use client"

import * as React from "react"
import { Forward, ImagePlus, Loader2, X } from "lucide-react"
import { AFTER_PAYMENT, DEPARTMENT, STATUS, stage } from "@/lib/workflow"
import { uploadRecordFile } from "@/lib/practitioner-registry"
import { formatDate } from "@/lib/format"
import { toast } from "@/components/ui/toast"
import { FieldGrid, SelectField, TextField, TextareaField, YesNoField } from "@/components/dashboard/form-kit"
import { WorkQueue, type QueueDraft, type SubmissionRow } from "@/components/dashboard/work-queue"

/**
 * Setting out — Monitoring & Enforcement marks the approved position on site
 * after payment, then reports to the Director, who issues the certificate.
 */

interface SettingOutDraft extends Record<string, unknown> {
  settingOutDate: string
  officerName: string
  confirmedCoordinates: string
  setbackMeters: string
  pegsPlaced: string
  matchesDrawing: string
  observations: string
  recommendation: string
  photos: string[]
}

function SettingOutForm({ d, set, row }: { d: SettingOutDraft; set: (p: Partial<SettingOutDraft>) => void; row: SubmissionRow }) {
  const [uploading, setUploading] = React.useState(false)
  const req = row.settingOutRequest

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    try {
      const urls: string[] = []
      for (const file of Array.from(files).slice(0, 6)) {
        if (!file.type.startsWith("image/")) continue
        if (file.size > 10 * 1024 * 1024) {
          toast.warning({ title: "Skipped a large photo", description: `${file.name} is over 10 MB.` })
          continue
        }
        const stored = await uploadRecordFile(`monitoring/${row.id}`, "setting-out", file)
        urls.push(stored.url)
      }
      set({ photos: [...d.photos, ...urls] })
    } catch (err) {
      toast.error({ title: "Upload failed", description: err instanceof Error ? err.message : "Try again." })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-5">
      {req ? (
        <p className="rounded-lg bg-muted/50 px-3.5 py-2.5 text-[12.5px] text-muted-foreground">
          Practitioner asked for {formatDate(req.preferredDate)} · site contact {String(req.contactName ?? "")} {req.contactPhone ? `(${String(req.contactPhone)})` : ""}
          {req.note ? ` — “${String(req.note)}”` : ""}
        </p>
      ) : null}
      <FieldGrid columns={3}>
        <TextField id="so-date" label="Date set out" type="date" value={d.settingOutDate} onChange={(v) => set({ settingOutDate: v })} />
        <TextField id="so-officer" label="Setting-out officer" value={d.officerName} onChange={(v) => set({ officerName: v })} />
        <TextField id="so-gps" label="Coordinates set out" mono value={d.confirmedCoordinates} placeholder="9.0765, 7.3986" onChange={(v) => set({ confirmedCoordinates: v })} />
        <TextField id="so-setback" label="Setback from road (m)" value={d.setbackMeters} onChange={(v) => set({ setbackMeters: v })} />
        <YesNoField id="so-pegs" label="Pegs / beacons placed" value={d.pegsPlaced} onChange={(v) => set({ pegsPlaced: v })} />
        <YesNoField id="so-match" label="Position matches approved drawing" value={d.matchesDrawing} onChange={(v) => set({ matchesDrawing: v })} />
      </FieldGrid>
      <TextareaField id="so-obs" label="Observations" rows={3} value={d.observations} onChange={(v) => set({ observations: v })} />
      <SelectField
        id="so-rec"
        label="Recommendation to the Director"
        value={d.recommendation}
        onChange={(v) => set({ recommendation: v })}
        options={[
          { value: "Recommended", label: "Recommended — issue the setting-out certificate" },
          { value: "Not recommended", label: "Not recommended" },
        ]}
      />
      <div>
        <p className="mb-1.5 text-[12.5px] font-medium text-foreground">Site photographs</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {d.photos.map((url) => (
            <div key={url} className="relative aspect-square overflow-hidden rounded-lg border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="Setting-out photograph" className="h-full w-full object-cover" />
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => set({ photos: d.photos.filter((p) => p !== url) })}
                className="absolute right-1 top-1 rounded-md bg-foreground/60 p-1 text-white hover:bg-foreground/80"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <label className="grid aspect-square cursor-pointer place-items-center rounded-lg border border-dashed border-border text-muted-foreground hover:bg-muted">
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addPhotos(e.target.files)} />
          </label>
        </div>
      </div>
    </div>
  )
}

const draft: QueueDraft<SettingOutDraft> = {
  field: "settingOutReport",
  views: ["todo"],
  title: "Setting-out report",
  initial: (row) => {
    const p = (row.settingOutReport ?? {}) as Partial<SettingOutDraft>
    const lock = row.measurements?.items?.[0]
    return {
      settingOutDate: p.settingOutDate ?? "",
      officerName: p.officerName ?? "",
      confirmedCoordinates: p.confirmedCoordinates ?? (lock?.lat && lock?.lng ? `${lock.lat}, ${lock.lng}` : row.gpsCoordinates ?? ""),
      setbackMeters: p.setbackMeters ?? String(row.technicalReport?.setbackFromRoadMeters ?? ""),
      pegsPlaced: p.pegsPlaced ?? "",
      matchesDrawing: p.matchesDrawing ?? "",
      observations: p.observations ?? "",
      recommendation: p.recommendation ?? "",
      photos: Array.isArray(p.photos) ? p.photos : [],
    }
  },
  validate: (d) => {
    if (!d.settingOutDate) return "Enter the date the site was set out."
    if (!d.officerName.trim()) return "Name the setting-out officer."
    if (!/(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/.test(d.confirmedCoordinates)) return "Record the coordinates set out (lat, lng)."
    if (!d.pegsPlaced || !d.matchesDrawing) return "Answer both yes/no checks."
    if (!d.recommendation) return "Give your recommendation."
    if (!d.photos.length) return "Add at least one site photograph."
    return null
  },
  derive: (d) => ({ settingOutReport: { ...d, pegsPlaced: d.pegsPlaced === "Yes", matchesDrawing: d.matchesDrawing === "Yes" } }),
  render: (d, set, row) => <SettingOutForm d={d} set={set} row={row} />,
}

export function SettingOutQueue() {
  return (
    <WorkQueue<SettingOutDraft>
      title="Setting out"
      description="Paid third-party sites the Director has sent for setting out"
      department={DEPARTMENT.monitoring}
      actorId="monitoring_enforcement"
      draft={draft}
      views={[
        {
          value: "todo",
          label: "To set out",
          routes: ["third"],
          statuses: stage("settingOut"),
          empty: { title: "Nothing to set out", body: "Files come here after payment, when the Director approves the practitioner's setting-out request." },
          column: { header: "Preferred date", render: (row) => formatDate(row.settingOutRequest?.preferredDate) },
          actions: [
            {
              key: "report",
              label: "File setting-out report — send to Director",
              icon: Forward,
              status: STATUS.settingOutReported,
              department: DEPARTMENT.director,
              record: "Setting-out report filed by Monitoring & Enforcement",
              needsDraft: true,
            },
          ],
        },
        {
          value: "done",
          label: "Reported",
          routes: ["third"],
          statuses: AFTER_PAYMENT.filter((s) => !stage("settingOut").includes(s) && !stage("receiptIssued").includes(s) && !stage("settingOutRequested").includes(s)),
          filter: (row) => Boolean(row.settingOutReport),
          empty: { title: "No setting-out reports yet", body: "Reports you've sent to the Director stay here." },
          column: { header: "With", render: (row) => row.department ?? "—" },
        },
      ]}
    />
  )
}
