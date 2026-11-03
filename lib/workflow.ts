/**
 * DOAS workflow — statuses, desks and routing in one place.
 *
 * Rule 1 — Director gatekeeper. No file moves between departments without the
 * Director. Unit queues can only send to DEPARTMENT.director; only the
 * Director's queue routes outward.
 *
 * FIRST PARTY:  Applicant pays the ₦2,500 application fee (Remita) → CSU
 *               → Director → Business Development (measure, lock)
 *               → Director → Billing (price) → Director → Finance (verify,
 *               e-receipt) → Director (sign) → Registered
 *
 * THIRD PARTY (practitioner portal):
 *   1. Practitioner applies from the portal (details prefilled from the
 *      practitioner file), uploads the photo montage only, pays the
 *      ₦100,000 application fee through Remita, submits            → CSU
 *   2. CSU → Director → Planning & Development (site inspection)
 *      → Director (recommendation check) → CSU (documents request letter)
 *      → Practitioner
 *   3. Practitioner uploads structural drawing, soil test and EIA  → CSU
 *      → Director → parallel technical vetting:
 *          EIA                         → Planning & Development (PDB)
 *          Soil test, structural drawing → Monitoring
 *      Unit heads assign officers; officers file vetting reports; heads
 *      confirm. When every track is confirmed the file returns to the Director.
 *   4. Director → Billing → Director → Finance (Remita RRR) → CSU
 *      → Practitioner pays → Finance confirms and issues the e-receipt
 *   5. Practitioner requests setting out → CSU → Director → Monitoring
 *      (setting-out report) → Director approves → setting-out certificate
 *      (QR + barcode) → CSU → Practitioner → Director approval letter
 *      → CSU → Practitioner → Registered
 *
 * RENEWAL:      Billing re-bills an expiring permit → Director → Finance
 *               → Director → existing register entry extended.
 */

// No Firebase import here: this module is shared by client pages and server routes.

export const DEPARTMENT = {
  csu: "CSU",
  director: "Director",
  businessDevelopment: "Business Development",
  planning: "Planning and Development",
  billing: "Billing",
  finance: "Finance",
  monitoring: "Monitoring and Enforcement",
  staffAdmin: "Staff Admin",
} as const
export type Department = (typeof DEPARTMENT)[keyof typeof DEPARTMENT]

/** Not a desk: the file is waiting on the practitioner/applicant to act. */
export const APPLICANT_DESK = "Practitioner"

/** Desks that can hold a file. Staff Admin never holds applications. */
export const FILE_DEPARTMENTS: string[] = [
  DEPARTMENT.csu,
  DEPARTMENT.director,
  DEPARTMENT.businessDevelopment,
  DEPARTMENT.planning,
  DEPARTMENT.billing,
  DEPARTMENT.finance,
  DEPARTMENT.monitoring,
]

/** Application fees, paid through Remita before a file can be submitted. */
export const APPLICATION_FEE = {
  first: 2_500,
  third: 100_000,
} as const

export function applicationFeeFor(route: "first" | "third") {
  return APPLICATION_FEE[route]
}

export const STATUS = {
  withCsu: "With CSU",
  withDirector: "With Director",
  siteVisit: "Site Visit Required",
  visitReported: "Site Visit Reported",
  planningReview: "Site Inspection",
  planningReported: "Site Inspection Reported",
  documentsCleared: "Cleared for Documents",
  documentsRequested: "Documents Requested",
  documentsSubmitted: "Documents Submitted",
  documentsVerified: "Documents Verified",
  technicalVetting: "Technical Vetting",
  vettingReported: "Vetting Reported",
  billingAssessment: "Billing Assessment",
  billingQueried: "Billing Query",
  billProposed: "Bill Proposed",
  renewalProposed: "Renewal Proposed",
  billApproved: "Bill Approved",
  remitaGenerated: "Remita Generated",
  awaitingPayment: "Awaiting Payment",
  partPayment: "Part Payment — Balance Due",
  paymentFlagged: "Payment Flagged",
  paymentReconciled: "Payment Reconciled",
  receiptIssued: "Payment Confirmed — Receipt Issued",
  settingOutRequested: "Setting Out Requested",
  settingOutWithDirector: "Setting Out — With Director",
  settingOut: "Setting Out",
  settingOutReported: "Setting Out Reported",
  certificateIssued: "Certificate Issued",
  certificateReleased: "Certificate Released",
  approvalIssued: "Approval Letter Issued",
  registered: "Registered",
  changesRequested: "Changes Requested",
  declined: "Declined",
} as const

export type StageKey =
  | "withCsu"
  | "withDirector"
  | "siteVisit"
  | "visitReported"
  | "planningReview"
  | "planningReported"
  | "documentsCleared"
  | "documentsRequested"
  | "documentsSubmitted"
  | "documentsVerified"
  | "technicalVetting"
  | "vettingReported"
  | "billing"
  | "billingQueried"
  | "billProposed"
  | "billApproved"
  | "remitaGenerated"
  | "awaitingPayment"
  | "paymentFlagged"
  | "paymentReconciled"
  | "receiptIssued"
  | "settingOutRequested"
  | "settingOutWithDirector"
  | "settingOut"
  | "settingOutReported"
  | "certificateIssued"
  | "certificateReleased"
  | "approvalIssued"
  | "issued"
  | "blocked"

// Only unambiguous legacy names are aliased; the rest go through /admin/migrate.
const STAGES: Record<StageKey, string[]> = {
  withCsu: [STATUS.withCsu, "Pending", "Under Review"],
  withDirector: [STATUS.withDirector, "Forwarded to Director"],
  siteVisit: [STATUS.siteVisit, "Forwarded to Business Development"],
  visitReported: [STATUS.visitReported],
  planningReview: [STATUS.planningReview, "Planning Review"],
  planningReported: [STATUS.planningReported, "Planning Reported"],
  documentsCleared: [STATUS.documentsCleared],
  documentsRequested: [STATUS.documentsRequested],
  documentsSubmitted: [STATUS.documentsSubmitted],
  documentsVerified: [STATUS.documentsVerified],
  technicalVetting: [STATUS.technicalVetting],
  vettingReported: [STATUS.vettingReported],
  billing: [STATUS.billingAssessment],
  billingQueried: [STATUS.billingQueried],
  billProposed: [STATUS.billProposed, STATUS.renewalProposed],
  billApproved: [STATUS.billApproved],
  remitaGenerated: [STATUS.remitaGenerated],
  awaitingPayment: [STATUS.awaitingPayment, STATUS.partPayment, "Billed"],
  paymentFlagged: [STATUS.paymentFlagged],
  paymentReconciled: [STATUS.paymentReconciled],
  receiptIssued: [STATUS.receiptIssued],
  settingOutRequested: [STATUS.settingOutRequested],
  settingOutWithDirector: [STATUS.settingOutWithDirector],
  settingOut: [STATUS.settingOut],
  settingOutReported: [STATUS.settingOutReported],
  certificateIssued: [STATUS.certificateIssued],
  certificateReleased: [STATUS.certificateReleased],
  approvalIssued: [STATUS.approvalIssued],
  issued: [STATUS.registered],
  blocked: [STATUS.declined, STATUS.changesRequested, "Rejected"],
}

export function stage(key: StageKey): string[] {
  return [...STAGES[key]]
}

export function stages(...keys: StageKey[]): string[] {
  return keys.flatMap((k) => STAGES[k])
}

/** Every status where the file is waiting on the Director. */
export const DIRECTOR_DESK: string[] = stages(
  "withDirector",
  "visitReported",
  "planningReported",
  "documentsVerified",
  "vettingReported",
  "billingQueried",
  "billProposed",
  "paymentFlagged",
  "paymentReconciled",
  "settingOutWithDirector",
  "settingOutReported",
  "certificateReleased",
)

/** Every status where CSU has to act. */
export const CSU_DESK: string[] = stages(
  "withCsu",
  "documentsCleared",
  "documentsSubmitted",
  "remitaGenerated",
  "settingOutRequested",
  "certificateIssued",
  "approvalIssued",
)

/** Waiting on the practitioner / applicant. */
export const WITH_APPLICANT: string[] = stages("documentsRequested", "receiptIssued", "awaitingPayment")

/** Out with a unit desk. */
export const IN_FLIGHT: string[] = stages(
  "siteVisit",
  "planningReview",
  "technicalVetting",
  "billing",
  "billApproved",
  "awaitingPayment",
  "settingOut",
)

export const ALL_STATUSES: string[] = Array.from(new Set(Object.values(STAGES).flat()))

/** Statuses after a file has left site inspection (used by "reported" views). */
export const AFTER_INSPECTION: string[] = stages(
  "planningReported",
  "documentsCleared",
  "documentsRequested",
  "documentsSubmitted",
  "documentsVerified",
  "technicalVetting",
  "vettingReported",
  "billing",
  "billingQueried",
  "billProposed",
  "billApproved",
  "remitaGenerated",
  "awaitingPayment",
  "paymentFlagged",
  "paymentReconciled",
  "receiptIssued",
  "settingOutRequested",
  "settingOutWithDirector",
  "settingOut",
  "settingOutReported",
  "certificateIssued",
  "certificateReleased",
  "approvalIssued",
  "issued",
)

/** Statuses after Billing has committed a bill. */
export const AFTER_BILLING: string[] = stages(
  "billProposed",
  "billApproved",
  "remitaGenerated",
  "awaitingPayment",
  "paymentFlagged",
  "paymentReconciled",
  "receiptIssued",
  "settingOutRequested",
  "settingOutWithDirector",
  "settingOut",
  "settingOutReported",
  "certificateIssued",
  "certificateReleased",
  "approvalIssued",
  "issued",
)

/** Statuses after Finance has confirmed payment. */
export const AFTER_PAYMENT: string[] = stages(
  "paymentReconciled",
  "receiptIssued",
  "settingOutRequested",
  "settingOutWithDirector",
  "settingOut",
  "settingOutReported",
  "certificateIssued",
  "certificateReleased",
  "approvalIssued",
  "issued",
)

export type Tone = "wait" | "move" | "clear" | "stop" | "idle"

export const STATUS_TONE: Record<string, Tone> = {
  [STATUS.withCsu]: "wait",
  [STATUS.withDirector]: "move",
  [STATUS.siteVisit]: "wait",
  [STATUS.visitReported]: "move",
  [STATUS.planningReview]: "wait",
  [STATUS.planningReported]: "move",
  [STATUS.documentsCleared]: "move",
  [STATUS.documentsRequested]: "wait",
  [STATUS.documentsSubmitted]: "wait",
  [STATUS.documentsVerified]: "move",
  [STATUS.technicalVetting]: "wait",
  [STATUS.vettingReported]: "move",
  [STATUS.billingAssessment]: "wait",
  [STATUS.billingQueried]: "stop",
  [STATUS.billProposed]: "move",
  [STATUS.renewalProposed]: "move",
  [STATUS.billApproved]: "move",
  [STATUS.remitaGenerated]: "move",
  [STATUS.awaitingPayment]: "wait",
  [STATUS.partPayment]: "stop",
  [STATUS.paymentFlagged]: "stop",
  [STATUS.paymentReconciled]: "move",
  [STATUS.receiptIssued]: "clear",
  [STATUS.settingOutRequested]: "wait",
  [STATUS.settingOutWithDirector]: "move",
  [STATUS.settingOut]: "wait",
  [STATUS.settingOutReported]: "move",
  [STATUS.certificateIssued]: "clear",
  [STATUS.certificateReleased]: "move",
  [STATUS.approvalIssued]: "clear",
  [STATUS.registered]: "clear",
  [STATUS.changesRequested]: "stop",
  [STATUS.declined]: "stop",
  Active: "clear",
  Expired: "stop",
  "Renewal Invoiced": "wait",
  Unverified: "wait",
  Reconciled_Match: "clear",
  Underpaid_Shortfall: "stop",
  Overpaid_Credit: "move",
  Clear: "clear",
  Warning_Proximity_Issue: "wait",
  Rejected_Overlap: "stop",
  Recommended: "clear",
  "Not recommended": "stop",
  Satisfactory: "clear",
  Unsatisfactory: "stop",
  unassigned: "wait",
  assigned: "move",
  reported: "move",
  confirmed: "clear",
  returned: "stop",
}

export function isBlocked(status?: string | null) {
  return STAGES.blocked.includes(status ?? "")
}

/* ---------------- Route chains (drive every progress tracker) ---------------- */

export interface StageDef {
  label: string
  desk: string
  statuses: string[]
}

const FIRST_CHAIN: StageDef[] = [
  { label: "Filed", desk: DEPARTMENT.csu, statuses: STAGES.withCsu },
  { label: "Director review", desk: DEPARTMENT.director, statuses: STAGES.withDirector },
  { label: "Site visit", desk: DEPARTMENT.businessDevelopment, statuses: STAGES.siteVisit },
  { label: "Measurements check", desk: DEPARTMENT.director, statuses: [...STAGES.visitReported, ...STAGES.billingQueried] },
  { label: "Billing", desk: DEPARTMENT.billing, statuses: STAGES.billing },
  { label: "Pricing sign-off", desk: DEPARTMENT.director, statuses: STAGES.billProposed },
  { label: "Payment", desk: DEPARTMENT.finance, statuses: STAGES.awaitingPayment },
  { label: "Permit sign-off", desk: DEPARTMENT.director, statuses: [...STAGES.paymentReconciled, ...STAGES.paymentFlagged] },
  { label: "Permit issued", desk: DEPARTMENT.csu, statuses: STAGES.issued },
]

const THIRD_CHAIN: StageDef[] = [
  { label: "Filed", desk: DEPARTMENT.csu, statuses: STAGES.withCsu },
  { label: "Director review", desk: DEPARTMENT.director, statuses: STAGES.withDirector },
  { label: "Site inspection", desk: DEPARTMENT.planning, statuses: STAGES.planningReview },
  { label: "Inspection check", desk: DEPARTMENT.director, statuses: STAGES.planningReported },
  {
    label: "Documents",
    desk: APPLICANT_DESK,
    statuses: [...STAGES.documentsCleared, ...STAGES.documentsRequested, ...STAGES.documentsSubmitted],
  },
  { label: "Documents check", desk: DEPARTMENT.director, statuses: STAGES.documentsVerified },
  { label: "Technical vetting", desk: `${DEPARTMENT.planning} · ${DEPARTMENT.monitoring}`, statuses: STAGES.technicalVetting },
  { label: "Vetting sign-off", desk: DEPARTMENT.director, statuses: STAGES.vettingReported },
  { label: "Billing", desk: DEPARTMENT.billing, statuses: [...STAGES.billing, ...STAGES.billingQueried] },
  { label: "Bill sign-off", desk: DEPARTMENT.director, statuses: STAGES.billProposed },
  { label: "Remita", desk: DEPARTMENT.finance, statuses: [...STAGES.billApproved, ...STAGES.remitaGenerated] },
  {
    label: "Payment",
    desk: DEPARTMENT.finance,
    statuses: [...STAGES.awaitingPayment, ...STAGES.paymentFlagged, ...STAGES.paymentReconciled],
  },
  {
    label: "Setting out",
    desk: DEPARTMENT.monitoring,
    statuses: [
      ...STAGES.receiptIssued,
      ...STAGES.settingOutRequested,
      ...STAGES.settingOutWithDirector,
      ...STAGES.settingOut,
      ...STAGES.settingOutReported,
    ],
  },
  {
    label: "Certificate & approval",
    desk: DEPARTMENT.director,
    statuses: [...STAGES.certificateIssued, ...STAGES.certificateReleased, ...STAGES.approvalIssued],
  },
  { label: "Approved", desk: DEPARTMENT.csu, statuses: STAGES.issued },
]

export function stagesFor(route: "first" | "third") {
  return route === "first" ? FIRST_CHAIN : THIRD_CHAIN
}

export function stageIndex(route: "first" | "third", status?: string | null) {
  if (!status) return 0
  if (isBlocked(status)) return 1
  return stagesFor(route).findIndex((s) => s.statuses.includes(status))
}

/* ---------------- Practitioner documents & parallel technical vetting ---------------- */

/** Documents the practitioner uploads after the Director clears the site inspection. */
export const REQUIRED_DOCUMENTS = [
  { key: "structuralDrawing", label: "Structural drawing (sealed by a COREN engineer)", accept: ".pdf,.dwg,.dxf,application/pdf" },
  { key: "soilTest", label: "Soil test report", accept: ".pdf,application/pdf" },
  { key: "eia", label: "Environmental Impact Assessment (EIA)", accept: ".pdf,application/pdf" },
] as const

export type RequiredDocumentKey = (typeof REQUIRED_DOCUMENTS)[number]["key"]

export type VettingTrackKey = "eia" | "soilTest" | "structuralDrawing"

export interface VettingTrackDef {
  key: VettingTrackKey
  label: string
  short: string
  department: string
  checklist: string[]
}

/** EIA goes to Planning & Development (PDB); soil test and structural drawing go to Monitoring. */
export const VETTING_TRACKS: VettingTrackDef[] = [
  {
    key: "eia",
    label: "Environmental Impact Assessment",
    short: "EIA",
    department: DEPARTMENT.planning,
    checklist: [
      "EIA is site-specific and matches the inspected location",
      "Environmental mitigation measures are adequate",
      "Impact on adjoining properties and right-of-way assessed",
      "Signed by a registered environmental consultant",
    ],
  },
  {
    key: "soilTest",
    label: "Soil test report",
    short: "Soil test",
    department: DEPARTMENT.monitoring,
    checklist: [
      "Test was carried out on the inspected site",
      "Bearing capacity supports the proposed foundation",
      "Laboratory and engineer are identifiable and accredited",
      "Report is recent (within 12 months)",
    ],
  },
  {
    key: "structuralDrawing",
    label: "Structural drawing",
    short: "Structural",
    department: DEPARTMENT.monitoring,
    checklist: [
      "Drawing is sealed by a COREN-registered engineer",
      "Dimensions match the inspected structure",
      "Foundation and wind-load design are shown",
      "Setback and height comply with DOAS regulations",
    ],
  },
]

export function vettingTrack(key: string) {
  return VETTING_TRACKS.find((t) => t.key === key)
}

export function tracksFor(department?: string | null) {
  return VETTING_TRACKS.filter((t) => t.department === department)
}

export type VettingState = "unassigned" | "assigned" | "reported" | "confirmed" | "returned"

export interface VettingReport {
  findings: string
  checklist: Record<string, boolean>
  recommendation: "Satisfactory" | "Unsatisfactory" | ""
  attachmentUrl?: string
  submittedAt: string
  submittedBy: string
  submittedByName: string
}

export interface VettingTrackState {
  department: string
  state: VettingState
  documentUrl?: string
  assignedTo?: string
  assignedToName?: string
  assignedAt?: string
  assignedBy?: string
  report?: VettingReport
  headNote?: string
  returnReason?: string
  confirmedAt?: string
  confirmedBy?: string
  confirmedByName?: string
}

export function initialVetting(files?: Record<string, unknown>): Record<VettingTrackKey, VettingTrackState> {
  const out = {} as Record<VettingTrackKey, VettingTrackState>
  VETTING_TRACKS.forEach((t) => {
    out[t.key] = { department: t.department, state: "unassigned", documentUrl: typeof files?.[t.key] === "string" ? String(files[t.key]) : "" }
  })
  return out
}

export function vettingComplete(vetting?: Record<string, VettingTrackState> | null) {
  if (!vetting) return false
  return VETTING_TRACKS.every((t) => vetting[t.key]?.state === "confirmed")
}

/* ---------------- Desks: notifications, audit labels, chat ---------------- */

const AUDIENCE: Record<string, string> = {
  [DEPARTMENT.csu]: "csu",
  [DEPARTMENT.director]: "director",
  [DEPARTMENT.businessDevelopment]: "business_development",
  [DEPARTMENT.planning]: "planning_development",
  [DEPARTMENT.billing]: "billing",
  [DEPARTMENT.finance]: "finance",
  [DEPARTMENT.monitoring]: "monitoring_enforcement",
  [DEPARTMENT.staffAdmin]: "staff_admin",
}

export function notifyIdFor(department: string) {
  return AUDIENCE[department] ?? department.toLowerCase().replace(/\s+/g, "_")
}

/** Practitioner notifications are keyed by their portal uid. */
export function practitionerAudience(uid: string) {
  return `pr_${uid}`
}

export const ACTOR_LABEL: Record<string, string> = {
  applicant: "Applicant portal",
  practitioner: "Practitioner portal",
  csu: "CSU Desk",
  director: "Office of Director",
  business_development: "Business Dev Room",
  planning_development: "Planning & Technical",
  billing: "Billing Desk",
  finance: "Finance Hub",
  monitoring_enforcement: "Monitoring & Enforcement",
  staff_admin: "Staff Admin",
  system: "System",
}

export function deskLabel(id?: string) {
  if (!id) return "Unknown desk"
  return ACTOR_LABEL[id] ?? id
}

/** Channel ids match the existing chat rooms, so history is kept. */
export function channelsFor(self: string) {
  return [
    { id: "director", name: "Director" },
    { id: "csu", name: "Customer Service" },
    { id: "business_development", name: "Business Development" },
    { id: "planning_development", name: "Planning & Development" },
    { id: "billing", name: "Billing" },
    { id: "finance", name: "Finance & Admin" },
    { id: "monitoring_enforcement", name: "Monitoring & Enforcement" },
    { id: "staff_admin", name: "Staff Admin" },
  ].filter((c) => c.id !== self)
}

/* ---------------- Register, numbering, dates ---------------- */

// Must match COL.register / COL.tariffs / COL.compliance in lib/firebase.ts.
export const REGISTER_COLLECTION = "permitRegister"
export const TARIFF_COLLECTION = "tariffSchedules"
export const COMPLIANCE_COLLECTION = "complianceIssues"
export type RegisterCategory = "first-party" | "third-party"

const tail = (n = 6) => Math.random().toString(36).slice(2, 2 + n).toUpperCase().padEnd(n, "0")
const year = () => new Date().getFullYear()

export function permitNumber(category: RegisterCategory) {
  return `FCTA/DOAS/${year()}/${category === "first-party" ? "FP" : "TP"}-${tail(6)}`
}

export function invoiceNumber(cycle = 1) {
  const core = `INV-DOAS-${year()}-${Date.now().toString().slice(-6)}`
  return cycle > 1 ? `${core}-C${cycle}` : core
}

export function submissionReference(route: "first" | "third") {
  return `${route === "first" ? "FP" : "TP"}-${Date.now()}-${tail(6)}`
}

const pad = (n: number) => String(n).padStart(2, "0")
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const todayISO = () => isoDate(new Date())

export function parseDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === "object" && value && "toDate" in value && typeof (value as { toDate: unknown }).toDate === "function")
    return (value as { toDate: () => Date }).toDate()
  if (typeof value === "string") {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (typeof value === "number") return new Date(value)
  return null
}

/** Start + N years − 1 day: 2026-10-06 → 2027-10-05. */
export function addYearsMinusDay(start: string | Date, years = 1) {
  const d = parseDate(start) ?? new Date()
  const out = new Date(d.getFullYear() + years, d.getMonth(), d.getDate())
  out.setDate(out.getDate() - 1)
  return isoDate(out)
}

export function addDaysMinusDay(start: string | Date, days: number) {
  const d = parseDate(start) ?? new Date()
  return isoDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + Math.max(1, days) - 1))
}

export function expiryFrom(start: Date = new Date(), years = 1) {
  return addYearsMinusDay(start, years)
}

export function daysUntil(value: unknown): number | null {
  const d = parseDate(value)
  if (!d) return null
  const t = new Date()
  return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(t.getFullYear(), t.getMonth(), t.getDate())) / 86_400_000)
}

/* ---------------- Reference data ---------------- */

export const AREA_COUNCILS = ["AMAC", "Bwari", "Gwagwalada", "Kuje", "Kwali", "Abaji"]

export const LEDGER_CODES = [
  { value: "100201", label: "100201 — First Party Signage Levy" },
  { value: "100202", label: "100202 — Third Party Billboard Tax" },
  { value: "100203", label: "100203 — Penalties and Fines" },
  { value: "100204", label: "100204 — Application / Processing Fees" },
]

export function ledgerFor(route: "first" | "third") {
  return route === "first" ? "100201" : "100202"
}

/* ---------------- Legacy migration map (used by /admin/migrate) ---------------- */

export function migrateLegacy(route: "first" | "third", status?: string): { status: string; department: string; note: string } | null {
  const s = status ?? ""
  const to = (status: string, department: string, note: string) => ({ status, department, note })
  switch (s) {
    case "Pending":
    case "Under Review":
      return to(STATUS.withCsu, DEPARTMENT.csu, "Renamed")
    case "Forwarded to Director":
      return to(STATUS.withDirector, DEPARTMENT.director, "Renamed")
    case "Planning Review":
      return to(STATUS.planningReview, DEPARTMENT.planning, "Renamed — site inspection")
    case "Planning Reported":
      return to(STATUS.planningReported, DEPARTMENT.director, "Renamed — site inspection reported")
    case "Forwarded to Business Development":
    case "Site Visit Required":
    case "Inspection Required":
      return route === "first"
        ? to(STATUS.siteVisit, DEPARTMENT.businessDevelopment, "Awaiting site visit")
        : to(STATUS.withDirector, DEPARTMENT.director, "Old Monitoring inspection — Director to route to Planning")
    case "Site Visit Completed":
    case "Pending Billing":
    case "Documents Approved":
    case "Inspection Reported":
      return route === "first"
        ? to(STATUS.visitReported, DEPARTMENT.director, "No locked measurements — Director should send back to BD")
        : to(STATUS.withDirector, DEPARTMENT.director, "Director to route to Planning for site inspection")
    case "Billed":
      return to(STATUS.awaitingPayment, DEPARTMENT.finance, "Old invoice — Finance verifies")
    case "Payment Confirmed":
    case "Payment Verified":
    case "Recommended for Approval":
    case "Approved":
      return to(STATUS.paymentReconciled, DEPARTMENT.director, "Ready for Director's permit sign-off")
    case "Rejected":
      return to(STATUS.declined, DEPARTMENT.csu, "Renamed")
    default:
      return null
  }
}

/* ---------------- Meeting requests ---------------- */

export const MEETING_STATUS = {
  withCsu: "pending",
  withDirector: "forwarded",
  approved: "approved",
  declined: "rejected",
  scheduled: "scheduled",
  completed: "completed",
} as const

export const MEETING_STAGES = [
  { label: "Received", statuses: [MEETING_STATUS.withCsu, "Pending"] as string[] },
  { label: "With the Director", statuses: [MEETING_STATUS.withDirector] as string[] },
  {
    label: "Decision",
    statuses: [MEETING_STATUS.approved, MEETING_STATUS.declined, MEETING_STATUS.scheduled, MEETING_STATUS.completed] as string[],
  },
]

export function meetingStageIndex(status?: string | null): number {
  const v = (status ?? "").toLowerCase()
  return MEETING_STAGES.findIndex((e) => e.statuses.some((c) => c.toLowerCase() === v))
}

export function meetingDecided(status?: string | null): boolean {
  return (
    [MEETING_STATUS.approved, MEETING_STATUS.declined, MEETING_STATUS.scheduled, MEETING_STATUS.completed] as string[]
  ).includes((status ?? "").toLowerCase())
}

export function meetingRequestId() {
  return `MR-${Date.now()}-${tail(6)}`
}
