"use client"

import * as React from "react"
import { getDownloadURL, ref, uploadBytes } from "firebase/storage"
import { Camera, CheckCircle2, Loader2, Stamp, Trash2, Forward } from "lucide-react"
import { storage } from "@/lib/firebase"
import { DEPARTMENT, STATUS, stage } from "@/lib/workflow"
import { toast } from "@/components/ui/toast"
import {
  FieldGrid,
  TextField,
  TextareaField,
  YesNoField,
} from "@/components/dashboard/form-kit"
import { WorkQueue, type QueueDraft, type SubmissionRow } from "@/components/dashboard/work-queue"

interface SiteVisitDraft extends Record<string, unknown> {
  companyName: string
  typeOfConcept: string
  numberOfProposedSignage: string
  length: string
  width: string
  area: string
  location: string
  gpsCoordinates: string
  boardToBoardDistance: string
  roadKerbDistance: string
  humanObstruction: string
  vehicleObstruction: string
  visibilityObstruction: string
  vacant: string
  comments: string
  reportingOfficer: string
  reportingOfficerRank: string
  headOfSection: string
  headOfSectionRank: string
  commend: string
  visitDate: string
  sitePhotos: string[]
}

const today = () => new Date().toISOString().slice(0, 10)

function blankDraft(row: SubmissionRow): SiteVisitDraft {
  const existing = (row.businessDevelopmentReport ?? {}) as Partial<SiteVisitDraft>
  return {
    companyName: existing.companyName ?? row.companyName ?? row.applicantName ?? "",
    typeOfConcept: existing.typeOfConcept ?? row.applicationType ?? "",
    numberOfProposedSignage: existing.numberOfProposedSignage ?? row.numberOfSigns ?? "",
    length: existing.length ?? "",
    width: existing.width ?? "",
    area: existing.area ?? "",
    location: existing.location ?? row.addressLine1 ?? "",
    gpsCoordinates: existing.gpsCoordinates ?? row.gpsCoordinates ?? "",
    boardToBoardDistance: existing.boardToBoardDistance ?? "",
    roadKerbDistance: existing.roadKerbDistance ?? "",
    humanObstruction: existing.humanObstruction ?? "No",
    vehicleObstruction: existing.vehicleObstruction ?? "No",
    visibilityObstruction: existing.visibilityObstruction ?? "No",
    vacant: existing.vacant ?? "Yes",
    comments: existing.comments ?? "",
    reportingOfficer: existing.reportingOfficer ?? "",
    reportingOfficerRank: existing.reportingOfficerRank ?? "",
    headOfSection: existing.headOfSection ?? "",
    headOfSectionRank: existing.headOfSectionRank ?? "",
    commend: existing.commend ?? "",
    visitDate: existing.visitDate ?? today(),
    sitePhotos: existing.sitePhotos ?? [],
  }
}

/** Length × width is the number the fee schedule keys off, so keep it computed. */
function area(draft: SiteVisitDraft) {
  const l = Number(draft.length)
  const w = Number(draft.width)
  if (!Number.isFinite(l) || !Number.isFinite(w) || !l || !w) return ""
  return (l * w).toFixed(2)
}

function SitePhotos({
  submissionId,
  urls,
  onChange,
}: {
  submissionId: string
  urls: string[]
  onChange: (urls: string[]) => void
}) {
  const [uploading, setUploading] = React.useState(false)
  const inputId = `photos-${submissionId}`

  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (!files.length) return

    const tooBig = files.find((file) => file.size > 10 * 1024 * 1024)
    if (tooBig) {
      toast.warning({
        title: "Photo too large",
        description: `${tooBig.name} is over 10 MB. Compress it and try again.`,
      })
      return
    }

    setUploading(true)
    try {
      const uploaded = await Promise.all(
        files.map(async (file) => {
          const key = `site-visits/${submissionId}/${Date.now()}-${file.name.replace(/\s+/g, "-")}`
          const target = ref(storage, key)
          await uploadBytes(target, file, {
            contentType: file.type,
            customMetadata: { submissionId, uploadedAt: new Date().toISOString() },
          })
          return getDownloadURL(target)
        }),
      )
      onChange([...urls, ...uploaded])
      toast.success({
        title: `${uploaded.length} photo${uploaded.length > 1 ? "s" : ""} uploaded`,
        description: "They save with the report when you submit it.",
      })
    } catch (err) {
      toast.error({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Check your connection and try again.",
      })
    } finally {
      setUploading(false)
      event.target.value = ""
    }
  }

  return (
    <div>
      <p className="mb-1.5 text-[12.5px] font-medium text-foreground">Site photographs</p>
      <label
        htmlFor={inputId}
        className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border px-6 py-7 text-center transition-colors hover:border-ring hover:bg-muted/40"
      >
        <span className="grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground">
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Camera className="h-5 w-5" />
          )}
        </span>
        <span className="text-[13px] font-medium text-foreground">
          {uploading ? "Uploading…" : "Add photos of the site"}
        </span>
        <span className="text-[11.5px] text-muted-foreground">
          JPG or PNG, up to 10 MB each. Include the board position and the road frontage.
        </span>
        <input
          id={inputId}
          type="file"
          accept="image/*"
          multiple
          disabled={uploading}
          onChange={upload}
          className="hidden"
        />
      </label>

      {urls.length ? (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {urls.map((url, i) => (
            <div
              key={`${url}-${i}`}
              className="group relative aspect-square overflow-hidden rounded-lg border border-border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Site ${i + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                aria-label={`Remove photo ${i + 1}`}
                onClick={() => onChange(urls.filter((_, index) => index !== i))}
                className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-md bg-foreground/70 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

const draft: QueueDraft<SiteVisitDraft> = {
  field: "businessDevelopmentReport",
  views: ["pending"],
  title: "Site visit report",
  initial: blankDraft,
  validate: (d) => {
    if (!d.location.trim()) return "Add the location description."
    if (!d.length || !d.width) return "Add the board length and width."
    if (!d.reportingOfficer.trim()) return "Name the reporting officer."
    if (!d.comments.trim()) return "Add your observations and recommendation."
    if (!d.sitePhotos.length) return "Attach at least one site photograph."
    return null
  },
  render: (d, set, row) => (
    <div className="space-y-5">
      <SitePhotos
        submissionId={row.id}
        urls={d.sitePhotos}
        onChange={(sitePhotos) => set({ sitePhotos })}
      />

      <FieldGrid>
        <TextField
          id="bd-company"
          label="Company or organisation"
          value={d.companyName}
          onChange={(companyName) => set({ companyName })}
        />
        <TextField
          id="bd-concept"
          label="Type of signage"
          value={d.typeOfConcept}
          onChange={(typeOfConcept) => set({ typeOfConcept })}
        />
        <TextField
          id="bd-count"
          label="Number of proposed signs"
          value={d.numberOfProposedSignage}
          onChange={(numberOfProposedSignage) => set({ numberOfProposedSignage })}
        />
        <TextField
          id="bd-date"
          label="Date of visit"
          type="date"
          value={d.visitDate}
          onChange={(visitDate) => set({ visitDate })}
        />
      </FieldGrid>

      <FieldGrid columns={3}>
        <TextField
          id="bd-length"
          label="Length (m)"
          value={d.length}
          placeholder="4.5"
          onChange={(length) => set({ length, area: area({ ...d, length }) })}
        />
        <TextField
          id="bd-width"
          label="Width (m)"
          value={d.width}
          placeholder="6.0"
          onChange={(width) => set({ width, area: area({ ...d, width }) })}
        />
        <TextField
          id="bd-area"
          label="Area (m²)"
          value={d.area}
          hint="Calculated from length × width"
          onChange={(a) => set({ area: a })}
        />
      </FieldGrid>

      <FieldGrid>
        <TextField
          id="bd-location"
          label="Location description"
          value={d.location}
          placeholder="Street, district, nearest landmark"
          onChange={(location) => set({ location })}
        />
        <TextField
          id="bd-gps"
          label="GPS coordinates"
          value={d.gpsCoordinates}
          mono
          placeholder="9.0765, 7.3986"
          onChange={(gpsCoordinates) => set({ gpsCoordinates })}
        />
        <TextField
          id="bd-board"
          label="Board to board distance (m)"
          value={d.boardToBoardDistance}
          onChange={(boardToBoardDistance) => set({ boardToBoardDistance })}
        />
        <TextField
          id="bd-kerb"
          label="Distance from road kerb (m)"
          value={d.roadKerbDistance}
          onChange={(roadKerbDistance) => set({ roadKerbDistance })}
        />
      </FieldGrid>

      <FieldGrid columns={4}>
        <YesNoField
          id="bd-human"
          label="Obstructs pedestrians"
          value={d.humanObstruction}
          onChange={(humanObstruction) => set({ humanObstruction })}
        />
        <YesNoField
          id="bd-vehicle"
          label="Obstructs vehicles"
          value={d.vehicleObstruction}
          onChange={(vehicleObstruction) => set({ vehicleObstruction })}
        />
        <YesNoField
          id="bd-visibility"
          label="Blocks sight lines"
          value={d.visibilityObstruction}
          onChange={(visibilityObstruction) => set({ visibilityObstruction })}
        />
        <YesNoField
          id="bd-vacant"
          label="Site is vacant"
          value={d.vacant}
          onChange={(vacant) => set({ vacant })}
        />
      </FieldGrid>

      <FieldGrid>
        <TextField
          id="bd-officer"
          label="Reporting officer"
          value={d.reportingOfficer}
          onChange={(reportingOfficer) => set({ reportingOfficer })}
        />
        <TextField
          id="bd-officer-rank"
          label="Rank"
          value={d.reportingOfficerRank}
          onChange={(reportingOfficerRank) => set({ reportingOfficerRank })}
        />
        <TextField
          id="bd-head"
          label="Head of section"
          value={d.headOfSection}
          onChange={(headOfSection) => set({ headOfSection })}
        />
        <TextField
          id="bd-head-rank"
          label="Rank"
          value={d.headOfSectionRank}
          onChange={(headOfSectionRank) => set({ headOfSectionRank })}
        />
      </FieldGrid>

      <TextareaField
        id="bd-comments"
        label="Observations and recommendation"
        value={d.comments}
        rows={4}
        placeholder="What you found on site, and whether the board should be approved as proposed."
        onChange={(comments) => set({ comments })}
      />
      <TextareaField
        id="bd-commend"
        label="Final commendation"
        value={d.commend}
        rows={2}
        onChange={(commend) => set({ commend })}
      />
    </div>
  ),
}

export function BusinessDevelopmentQueue() {
  return (
    <WorkQueue<SiteVisitDraft>
      title="Business Development"
      description="Site visits before billing, and the approval that follows payment"
      department={DEPARTMENT.businessDevelopment}
      actorId="business_development"
      draft={draft}
      views={[
        {
          value: "pending",
          label: "To visit",
          routes: ["first"],
          statuses: stage("siteVisit"),
          empty: {
            title: "No site visits booked",
            body: "First-party applications the Director accepts are sent here for inspection.",
          },
          actions: [
            {
              key: "submit",
              label: "Submit report — send to Finance",
              icon: Forward,
              status: STATUS.visitReported,
              department: DEPARTMENT.finance,
              record: "Site visit completed, sent to Finance for billing",
              needsDraft: true,
            },
          ],
        },
        {
          value: "approval",
          label: "To approve",
          routes: ["first"],
          statuses: [STATUS.paymentConfirmed],
          empty: {
            title: "Nothing to approve",
            body: "Once Finance confirms the applicant has paid, the file comes back here for your approval.",
          },
          column: { header: "Paid", render: (row) => String(row.billing?.paymentReference ?? "—") },
          actions: [
            {
              key: "approve",
              label: "Approve — recommend to Director",
              icon: Stamp,
              status: STATUS.recommended,
              department: DEPARTMENT.director,
              record: "Approved by Business Development, recommended to the Director",
              kind: "success",
            },
          ],
        },
        {
          value: "history",
          label: "Done",
          routes: ["first"],
          statuses: [
            ...stage("visitReported"),
            ...stage("awaitingPayment"),
            ...stage("recommended"),
            STATUS.approved,
            STATUS.registered,
          ],
          empty: {
            title: "Nothing completed yet",
            body: "Reports you've filed stay here so you can refer back to the measurements.",
          },
          column: { header: "With", render: (row) => row.department ?? "\u2014" },
        },
      ]}
    />
  )
}

export function BusinessDevelopmentArchive() {
  return (
    <WorkQueue
      title="All first-party applications"
      description="Every first-party file, wherever it currently sits"
      actorId="business_development"
      views={[
        {
          value: "all",
          label: "All",
          routes: ["first"],
          statuses: Object.values(STATUS),
          empty: {
            title: "No first-party applications",
            body: "Applications filed by property owners themselves appear here.",
          },
          column: { header: "With", render: (row) => row.department ?? "\u2014" },
        },
      ]}
    />
  )
}
