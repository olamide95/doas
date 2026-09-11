"use client"

import { Forward } from "lucide-react"
import { DEPARTMENT, STATUS, stage } from "@/lib/workflow"
import {
  FieldGrid,
  SelectField,
  TextField,
  TextareaField,
  YesNoField,
} from "@/components/dashboard/form-kit"
import { WorkQueue, type QueueDraft, type SubmissionRow } from "@/components/dashboard/work-queue"

interface ZoningDraft extends Record<string, unknown> {
  zoneType: string
  heightRestriction: string
  setbackRequirement: string
  signageAreaLimit: string
  landUseConflict: string
  withinSetback: string
  boardLocation: string
  gpsCoordinates: string
  assessedBy: string
  assessorRank: string
  visitDate: string
  zoningComments: string
}

const today = () => new Date().toISOString().slice(0, 10)

const draft: QueueDraft<ZoningDraft> = {
  field: "zoningReport",
  views: ["review"],
  title: "Zoning assessment",
  initial: (row: SubmissionRow) => {
    const existing = (row.zoningReport ?? {}) as Partial<ZoningDraft>
    return {
      zoneType: existing.zoneType ?? "",
      heightRestriction: existing.heightRestriction ?? "",
      setbackRequirement: existing.setbackRequirement ?? "",
      signageAreaLimit: existing.signageAreaLimit ?? "",
      landUseConflict: existing.landUseConflict ?? "No",
      withinSetback: existing.withinSetback ?? "Yes",
      boardLocation: existing.boardLocation ?? row.addressLine1 ?? "",
      gpsCoordinates: existing.gpsCoordinates ?? row.gpsCoordinates ?? "",
      assessedBy: existing.assessedBy ?? "",
      assessorRank: existing.assessorRank ?? "",
      visitDate: existing.visitDate ?? today(),
      zoningComments: existing.zoningComments ?? "",
    }
  },
  validate: (d) => {
    if (!d.zoneType) return "Select the zone type."
    if (!d.assessedBy.trim()) return "Name the assessing officer."
    if (!d.zoningComments.trim()) return "Record your zoning finding."
    return null
  },
  render: (d, set) => (
    <div className="space-y-5">
      <FieldGrid>
        <SelectField
          id="pd-zone"
          label="Zone type"
          value={d.zoneType}
          onChange={(zoneType) => set({ zoneType })}
          options={[
            { value: "Commercial", label: "Commercial" },
            { value: "Residential", label: "Residential" },
            { value: "Industrial", label: "Industrial" },
            { value: "Mixed use", label: "Mixed use" },
            { value: "Green area", label: "Green area" },
            { value: "Institutional", label: "Institutional" },
          ]}
        />
        <TextField
          id="pd-height"
          label="Height restriction (m)"
          value={d.heightRestriction}
          placeholder="10"
          onChange={(heightRestriction) => set({ heightRestriction })}
        />
        <TextField
          id="pd-setback"
          label="Setback requirement"
          value={d.setbackRequirement}
          placeholder="5m from the road"
          onChange={(setbackRequirement) => set({ setbackRequirement })}
        />
        <TextField
          id="pd-area-limit"
          label="Signage area limit"
          value={d.signageAreaLimit}
          placeholder="24 m²"
          onChange={(signageAreaLimit) => set({ signageAreaLimit })}
        />
        <TextField
          id="pd-location"
          label="Board location"
          value={d.boardLocation}
          onChange={(boardLocation) => set({ boardLocation })}
        />
        <TextField
          id="pd-gps"
          label="GPS coordinates"
          mono
          value={d.gpsCoordinates}
          onChange={(gpsCoordinates) => set({ gpsCoordinates })}
        />
      </FieldGrid>

      <FieldGrid>
        <YesNoField
          id="pd-conflict"
          label="Conflicts with land use"
          value={d.landUseConflict}
          onChange={(landUseConflict) => set({ landUseConflict })}
        />
        <YesNoField
          id="pd-within"
          label="Within setback rules"
          value={d.withinSetback}
          onChange={(withinSetback) => set({ withinSetback })}
        />
      </FieldGrid>

      <FieldGrid columns={3}>
        <TextField
          id="pd-assessor"
          label="Assessed by"
          value={d.assessedBy}
          onChange={(assessedBy) => set({ assessedBy })}
        />
        <TextField
          id="pd-rank"
          label="Rank"
          value={d.assessorRank}
          onChange={(assessorRank) => set({ assessorRank })}
        />
        <TextField
          id="pd-date"
          label="Date assessed"
          type="date"
          value={d.visitDate}
          onChange={(visitDate) => set({ visitDate })}
        />
      </FieldGrid>

      <TextareaField
        id="pd-comments"
        label="Zoning finding"
        value={d.zoningComments}
        rows={4}
        placeholder="Whether the proposed board fits the zoning for this location, and any conditions."
        onChange={(zoningComments) => set({ zoningComments })}
      />
    </div>
  ),
}

export function PlanningQueue() {
  return (
    <WorkQueue<ZoningDraft>
      title="Planning reviews"
      description="Files the Director has passed on after Monitoring's inspection"
      department={DEPARTMENT.planning}
      actorId="planning_development"
      draft={draft}
      views={[
        {
          value: "review",
          label: "To review",
          routes: ["third"],
          statuses: [STATUS.planningReview],
          empty: {
            title: "No planning reviews queued",
            body: "Once the Director accepts Monitoring's inspection, the file comes here for the zoning view.",
          },
          actions: [
            {
              key: "submit",
              label: "Submit report to Director",
              icon: Forward,
              status: STATUS.planningReported,
              department: DEPARTMENT.director,
              record: "Planning report filed",
              needsDraft: true,
            },
          ],
        },
        {
          value: "done",
          label: "Reported",
          routes: ["third"],
          statuses: [STATUS.planningReported, STATUS.approved, STATUS.registered],
          empty: {
            title: "Nothing reported yet",
            body: "Reports you return to the Director stay here for reference.",
          },
          column: { header: "With", render: (row) => row.department ?? "\u2014" },
        },
      ]}
    />
  )
}
