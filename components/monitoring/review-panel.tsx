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

interface InspectionDraft extends Record<string, unknown> {
  clientName: string
  registrationWithDOAS: string
  categoryOfApplicant: string
  typeOfConcept: string
  sizeOfBoard: string
  boardLocation: string
  gpsCoordinates: string
  boardToBoardDistance: string
  roadKerb: string
  fenceBuilding: string
  humanObstruction: string
  vehicularTrafficObstruction: string
  visibilityObstruction: string
  vacant: string
  approvableComments: string
  reportingOfficer: string
  reportingOfficerRank: string
  headOfSection: string
  headOfSectionRank: string
  visitDate: string
}

const today = () => new Date().toISOString().slice(0, 10)

const draft: QueueDraft<InspectionDraft> = {
  field: "inspectionReport",
  views: ["inspect"],
  title: "Site inspection report",
  initial: (row: SubmissionRow) => {
    const existing = (row.inspectionReport ?? row.siteVisitReport ?? {}) as Partial<InspectionDraft>
    return {
      clientName: existing.clientName ?? row.companyName ?? row.applicantName ?? "",
      registrationWithDOAS: existing.registrationWithDOAS ?? "",
      categoryOfApplicant: existing.categoryOfApplicant ?? "",
      typeOfConcept: existing.typeOfConcept ?? row.applicationType ?? "",
      sizeOfBoard: existing.sizeOfBoard ?? row.signDimensions ?? "",
      boardLocation: existing.boardLocation ?? row.addressLine1 ?? "",
      gpsCoordinates: existing.gpsCoordinates ?? row.gpsCoordinates ?? "",
      boardToBoardDistance: existing.boardToBoardDistance ?? "",
      roadKerb: existing.roadKerb ?? "",
      fenceBuilding: existing.fenceBuilding ?? "",
      humanObstruction: existing.humanObstruction ?? "No",
      vehicularTrafficObstruction: existing.vehicularTrafficObstruction ?? "No",
      visibilityObstruction: existing.visibilityObstruction ?? "No",
      vacant: existing.vacant ?? "Yes",
      approvableComments: existing.approvableComments ?? "",
      reportingOfficer: existing.reportingOfficer ?? "",
      reportingOfficerRank: existing.reportingOfficerRank ?? "",
      headOfSection: existing.headOfSection ?? "",
      headOfSectionRank: existing.headOfSectionRank ?? "",
      visitDate: existing.visitDate ?? today(),
    }
  },
  validate: (d) => {
    if (!d.boardLocation.trim()) return "Add the board location."
    if (!d.gpsCoordinates.trim()) return "Add the GPS coordinates."
    if (!d.reportingOfficer.trim()) return "Name the reporting officer."
    if (!d.approvableComments.trim()) return "Record your recommendation."
    return null
  },
  render: (d, set) => (
    <div className="space-y-5">
      <FieldGrid>
        <TextField
          id="me-client"
          label="Client or company"
          value={d.clientName}
          onChange={(clientName) => set({ clientName })}
        />
        <SelectField
          id="me-registration"
          label="Registration with DOAS"
          value={d.registrationWithDOAS}
          onChange={(registrationWithDOAS) => set({ registrationWithDOAS })}
          options={[
            { value: "Registered", label: "Registered" },
            { value: "Not registered", label: "Not registered" },
            { value: "Pending", label: "Registration pending" },
          ]}
        />
        <SelectField
          id="me-category"
          label="Category of applicant"
          value={d.categoryOfApplicant}
          onChange={(categoryOfApplicant) => set({ categoryOfApplicant })}
          options={[
            { value: "Individual", label: "Individual" },
            { value: "Company", label: "Company" },
            { value: "Government", label: "Government" },
            { value: "NGO", label: "NGO" },
          ]}
        />
        <TextField
          id="me-date"
          label="Date of inspection"
          type="date"
          value={d.visitDate}
          onChange={(visitDate) => set({ visitDate })}
        />
        <TextField
          id="me-concept"
          label="Type of signage"
          value={d.typeOfConcept}
          onChange={(typeOfConcept) => set({ typeOfConcept })}
        />
        <TextField
          id="me-size"
          label="Size of board"
          value={d.sizeOfBoard}
          placeholder="4m × 6m"
          onChange={(sizeOfBoard) => set({ sizeOfBoard })}
        />
        <TextField
          id="me-location"
          label="Board location"
          value={d.boardLocation}
          onChange={(boardLocation) => set({ boardLocation })}
        />
        <TextField
          id="me-gps"
          label="GPS coordinates"
          mono
          value={d.gpsCoordinates}
          onChange={(gpsCoordinates) => set({ gpsCoordinates })}
        />
      </FieldGrid>

      <FieldGrid columns={3}>
        <TextField
          id="me-board"
          label="Board to board (m)"
          value={d.boardToBoardDistance}
          onChange={(boardToBoardDistance) => set({ boardToBoardDistance })}
        />
        <TextField
          id="me-kerb"
          label="From road kerb (m)"
          value={d.roadKerb}
          onChange={(roadKerb) => set({ roadKerb })}
        />
        <TextField
          id="me-fence"
          label="From fence or building (m)"
          value={d.fenceBuilding}
          onChange={(fenceBuilding) => set({ fenceBuilding })}
        />
      </FieldGrid>

      <FieldGrid columns={4}>
        <YesNoField
          id="me-human"
          label="Obstructs pedestrians"
          value={d.humanObstruction}
          onChange={(humanObstruction) => set({ humanObstruction })}
        />
        <YesNoField
          id="me-vehicle"
          label="Obstructs traffic"
          value={d.vehicularTrafficObstruction}
          onChange={(vehicularTrafficObstruction) => set({ vehicularTrafficObstruction })}
        />
        <YesNoField
          id="me-visibility"
          label="Blocks sight lines"
          value={d.visibilityObstruction}
          onChange={(visibilityObstruction) => set({ visibilityObstruction })}
        />
        <YesNoField
          id="me-vacant"
          label="Site is vacant"
          value={d.vacant}
          onChange={(vacant) => set({ vacant })}
        />
      </FieldGrid>

      <FieldGrid>
        <TextField
          id="me-officer"
          label="Reporting officer"
          value={d.reportingOfficer}
          onChange={(reportingOfficer) => set({ reportingOfficer })}
        />
        <TextField
          id="me-officer-rank"
          label="Rank"
          value={d.reportingOfficerRank}
          onChange={(reportingOfficerRank) => set({ reportingOfficerRank })}
        />
        <TextField
          id="me-head"
          label="Head of section"
          value={d.headOfSection}
          onChange={(headOfSection) => set({ headOfSection })}
        />
        <TextField
          id="me-head-rank"
          label="Rank"
          value={d.headOfSectionRank}
          onChange={(headOfSectionRank) => set({ headOfSectionRank })}
        />
      </FieldGrid>

      <TextareaField
        id="me-comments"
        label="Recommendation"
        value={d.approvableComments}
        rows={4}
        placeholder="State plainly whether the board is approvable, and on what conditions."
        onChange={(approvableComments) => set({ approvableComments })}
      />
    </div>
  ),
}

export function MonitoringQueue() {
  return (
    <WorkQueue<InspectionDraft>
      title="Inspections"
      description="Third-party applications the Director has sent for a site inspection"
      department={DEPARTMENT.monitoring}
      actorId="monitoring_enforcement"
      draft={draft}
      views={[
        {
          value: "inspect",
          label: "To inspect",
          routes: ["third"],
          statuses: stage("inspection"),
          empty: {
            title: "No inspections outstanding",
            body: "Third-party files the Director accepts come straight here for inspection.",
          },
          actions: [
            {
              key: "submit",
              label: "Submit report to Director",
              icon: Forward,
              status: STATUS.inspectionReported,
              department: DEPARTMENT.director,
              record: "Inspection report filed by Monitoring",
              needsDraft: true,
            },
          ],
        },
        {
          value: "done",
          label: "Reported",
          routes: ["third"],
          statuses: [
            ...stage("inspectionReported"),
            STATUS.planningReview,
            STATUS.planningReported,
            STATUS.approved,
            STATUS.registered,
          ],
          empty: {
            title: "Nothing reported yet",
            body: "Reports you send to the Director stay here, and you can follow what happens next.",
          },
          column: { header: "With", render: (row) => row.department ?? "\u2014" },
        },
      ]}
    />
  )
}
