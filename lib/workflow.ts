/**
 * DOAS workflow — statuses, desks and routing in one place.
 *
 * Rule 1 — Director gatekeeper. No file moves between departments without the
 * Director. Unit queues can only send to DEPARTMENT.director; only the
 * Director's queue routes outward.
 *
 * FIRST PARTY:  CSU → Director → Business Development (measure, lock)
 *               → Director → Billing (price) → Director → Finance (verify)
 *               → Director (sign) → Registered
 * THIRD PARTY:  CSU → Director → Planning (technical vetting, lock)
 *               → Director → Billing → Director → Finance → Director → Registered
 * RENEWAL:      Billing re-bills an expiring permit → Director → Finance
 *               → Director → existing register entry extended.
 */

import { COL } from "@/lib/firebase"

export const DEPARTMENT = {
  csu: "CSU",
  director: "Director",
  businessDevelopment: "Business Development",
  planning: "Planning and Development",
  billing: "Billing",
  finance: "Finance",
  monitoring: "Monitoring and Enforcement",
} as const
export type Department = (typeof DEPARTMENT)[keyof typeof DEPARTMENT]

export const STATUS = {
  withCsu: "With CSU",
  withDirector: "With Director",
  siteVisit: "Site Visit Required",
  visitReported: "Site Visit Reported",
  planningReview: "Planning Review",
  planningReported: "Planning Reported",
  billingAssessment: "Billing Assessment",
  billingQueried: "Billing Query",
  billProposed: "Bill Proposed",
  renewalProposed: "Renewal Proposed",
  awaitingPayment: "Awaiting Payment",
  partPayment: "Part Payment — Balance Due",
  paymentFlagged: "Payment Flagged",
  paymentReconciled: "Payment Reconciled",
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
  | "billing"
  | "billingQueried"
  | "billProposed"
  | "awaitingPayment"
  | "paymentFlagged"
  | "paymentReconciled"
  | "issued"
  | "blocked"

// Only unambiguous legacy names are aliased; the rest go through /admin/migrate.
const STAGES: Record<StageKey, string[]> = {
  withCsu: [STATUS.withCsu, "Pending", "Under Review"],
  withDirector: [STATUS.withDirector, "Forwarded to Director"],
  siteVisit: [STATUS.siteVisit, "Forwarded to Business Development"],
  visitReported: [STATUS.visitReported],
  planningReview: [STATUS.planningReview],
  planningReported: [STATUS.planningReported],
  billing: [STATUS.billingAssessment],
  billingQueried: [STATUS.billingQueried],
  billProposed: [STATUS.billProposed, STATUS.renewalProposed],
  awaitingPayment: [STATUS.awaitingPayment, STATUS.partPayment, "Billed"],
  paymentFlagged: [STATUS.paymentFlagged],
  paymentReconciled: [STATUS.paymentReconciled],
  issued: [STATUS.registered],
  blocked: [STATUS.declined, STATUS.changesRequested, "Rejected"],
}

export function stage(key: StageKey): string[] {
  return [...STAGES[key]]
}

/** Every status where the file is waiting on the Director. */
export const DIRECTOR_DESK: string[] = [
  ...STAGES.withDirector,
  ...STAGES.visitReported,
  ...STAGES.planningReported,
  ...STAGES.billingQueried,
  ...STAGES.billProposed,
  ...STAGES.paymentFlagged,
  ...STAGES.paymentReconciled,
]

/** Out with a unit desk. */
export const IN_FLIGHT: string[] = [...STAGES.siteVisit, ...STAGES.planningReview, ...STAGES.billing, ...STAGES.awaitingPayment]

export const ALL_STATUSES: string[] = Array.from(new Set(Object.values(STAGES).flat()))

export type Tone = "wait" | "move" | "clear" | "stop" | "idle"

export const STATUS_TONE: Record<string, Tone> = {
  [STATUS.withCsu]: "wait",
  [STATUS.withDirector]: "move",
  [STATUS.siteVisit]: "wait",
  [STATUS.visitReported]: "move",
  [STATUS.planningReview]: "wait",
  [STATUS.planningReported]: "move",
  [STATUS.billingAssessment]: "wait",
  [STATUS.billingQueried]: "stop",
  [STATUS.billProposed]: "move",
  [STATUS.renewalProposed]: "move",
  [STATUS.awaitingPayment]: "wait",
  [STATUS.partPayment]: "stop",
  [STATUS.paymentFlagged]: "stop",
  [STATUS.paymentReconciled]: "move",
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

function chain(route: "first" | "third"): StageDef[] {
  const field: StageDef =
    route === "first"
      ? { label: "Site visit", desk: DEPARTMENT.businessDevelopment, statuses: STAGES.siteVisit }
      : { label: "Technical vetting", desk: DEPARTMENT.planning, statuses: STAGES.planningReview }
  const reported = route === "first" ? STAGES.visitReported : STAGES.planningReported
  return [
    { label: "Filed", desk: DEPARTMENT.csu, statuses: STAGES.withCsu },
    { label: "Director review", desk: DEPARTMENT.director, statuses: STAGES.withDirector },
    field,
    { label: "Measurements check", desk: DEPARTMENT.director, statuses: [...reported, ...STAGES.billingQueried] },
    { label: "Billing", desk: DEPARTMENT.billing, statuses: STAGES.billing },
    { label: "Pricing sign-off", desk: DEPARTMENT.director, statuses: STAGES.billProposed },
    { label: "Payment", desk: DEPARTMENT.finance, statuses: STAGES.awaitingPayment },
    { label: "Permit sign-off", desk: DEPARTMENT.director, statuses: [...STAGES.paymentReconciled, ...STAGES.paymentFlagged] },
    { label: "Permit issued", desk: DEPARTMENT.csu, statuses: STAGES.issued },
  ]
}

const FIRST_CHAIN = chain("first")
const THIRD_CHAIN = chain("third")

export function stagesFor(route: "first" | "third") {
  return route === "first" ? FIRST_CHAIN : THIRD_CHAIN
}

export function stageIndex(route: "first" | "third", status?: string | null) {
  if (!status) return 0
  if (isBlocked(status)) return 1
  return stagesFor(route).findIndex((s) => s.statuses.includes(status))
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
}

export function notifyIdFor(department: string) {
  return AUDIENCE[department] ?? department.toLowerCase().replace(/\s+/g, "_")
}

export const ACTOR_LABEL: Record<string, string> = {
  applicant: "Applicant portal",
  csu: "CSU Desk",
  director: "Office of Director",
  business_development: "Business Dev Room",
  planning_development: "Planning & Technical",
  billing: "Billing Desk",
  finance: "Finance Hub",
  monitoring_enforcement: "Monitoring & Enforcement",
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
  ].filter((c) => c.id !== self)
}

/* ---------------- Register, numbering, dates ---------------- */

export const REGISTER_COLLECTION = COL.register
export const TARIFF_COLLECTION = COL.tariffs
export const COMPLIANCE_COLLECTION = COL.compliance
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
        : to(STATUS.withDirector, DEPARTMENT.director, "Director to route to Planning for vetting")
    case "Billed":
      return to(STATUS.awaitingPayment, DEPARTMENT.finance, "Old invoice — Finance verifies")
    case "Payment Confirmed":
    case "Payment Verified":
    case "Recommended for Approval":
    case "Documents Submitted":
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
