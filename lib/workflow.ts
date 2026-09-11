/**
 * The permit workflow, in one place.
 *
 * FIRST PARTY  (property owner files for their own signage)
 *   CSU → Director → Business Development (site visit) → Finance (invoice)
 *   → applicant pays → Finance confirms → Business Development (approval)
 *   → Director (final acceptance) → first-party register
 *
 * THIRD PARTY  (practitioner files on behalf of a client)
 *   CSU → Director → Monitoring (inspection report) → Director
 *   → Planning (planning report) → Director → CSU registers them
 *
 * The Director can act on a file at any point in either chain. Accepting
 * moves it to the next stage; declining or returning it for changes sends it
 * back to CSU with a written reason, which is mandatory.
 *
 * Finance only sees first-party files. Third-party permits are not billed.
 */

export const DEPARTMENT = {
  csu: "CSU",
  director: "Director",
  businessDevelopment: "Business Development",
  finance: "Finance",
  planning: "Planning and Development",
  monitoring: "Monitoring and Enforcement",
} as const

export type DepartmentName = (typeof DEPARTMENT)[keyof typeof DEPARTMENT]

/** The `userId` written onto notification documents for each desk. */
export const NOTIFY_ID: Record<string, string> = {
  [DEPARTMENT.csu]: "csu",
  [DEPARTMENT.director]: "director",
  [DEPARTMENT.businessDevelopment]: "business_development",
  [DEPARTMENT.finance]: "finance",
  [DEPARTMENT.planning]: "planning_development",
  [DEPARTMENT.monitoring]: "monitoring_enforcement",
}

export function notifyIdFor(department: string): string {
  return NOTIFY_ID[department] ?? department.toLowerCase().replace(/\s+/g, "_")
}

export const STATUS = {
  /** Filed, sitting with CSU for screening. */
  withCsu: "With CSU",
  /** CSU has passed it up. */
  withDirector: "With Director",

  // First party
  siteVisit: "Site Visit Required",
  visitReported: "Site Visit Reported",
  awaitingPayment: "Awaiting Payment",
  paymentConfirmed: "Payment Confirmed",
  recommended: "Recommended for Approval",

  // Third party
  inspection: "Inspection Required",
  inspectionReported: "Inspection Reported",
  planningReview: "Planning Review",
  planningReported: "Planning Reported",

  // Terminal
  approved: "Approved",
  registered: "Registered",
  changesRequested: "Changes Requested",
  declined: "Declined",
} as const

/**
 * Statuses written by the older screens. Views accept these alongside the
 * current names so files already in the database don't disappear.
 */
export const LEGACY = {
  withCsu: ["Pending", "Under Review"],
  withDirector: ["Forwarded to Director"],
  siteVisit: ["Forwarded to Business Development"],
  visitReported: ["Site Visit Completed", "Pending Billing", "Documents Approved"],
  inspection: ["Site Visit Required"],
  inspectionReported: ["Site Visit Completed"],
  awaitingPayment: ["Billed"],
  recommended: ["Payment Verified", "Documents Submitted"],
  declined: ["Rejected"],
} as const

/** Every status a view should match for a given stage, current plus legacy. */
export function stage(key: keyof typeof STATUS): string[] {
  const legacy = (LEGACY as Record<string, string[] | undefined>)[key] ?? []
  return [STATUS[key], ...legacy]
}

export const TERMINAL = [STATUS.approved, STATUS.registered, STATUS.declined]

/* ------------------------------------------------------------------ *
 * Progress tracker
 * ------------------------------------------------------------------ */

export interface Stage {
  label: string
  desk: string
  statuses: string[]
}

export const FIRST_PARTY_STAGES: Stage[] = [
  { label: "Filed", desk: DEPARTMENT.csu, statuses: stage("withCsu") },
  { label: "Director review", desk: DEPARTMENT.director, statuses: stage("withDirector") },
  { label: "Site visit", desk: DEPARTMENT.businessDevelopment, statuses: stage("siteVisit") },
  { label: "Billing", desk: DEPARTMENT.finance, statuses: [...stage("visitReported"), ...stage("awaitingPayment")] },
  { label: "Approval", desk: DEPARTMENT.businessDevelopment, statuses: [STATUS.paymentConfirmed] },
  { label: "Final decision", desk: DEPARTMENT.director, statuses: stage("recommended") },
  { label: "Registered", desk: DEPARTMENT.csu, statuses: [STATUS.approved, STATUS.registered] },
]

export const THIRD_PARTY_STAGES: Stage[] = [
  { label: "Filed", desk: DEPARTMENT.csu, statuses: stage("withCsu") },
  { label: "Director review", desk: DEPARTMENT.director, statuses: stage("withDirector") },
  { label: "Inspection", desk: DEPARTMENT.monitoring, statuses: stage("inspection") },
  { label: "Report reviewed", desk: DEPARTMENT.director, statuses: stage("inspectionReported") },
  { label: "Planning", desk: DEPARTMENT.planning, statuses: [STATUS.planningReview] },
  { label: "Final decision", desk: DEPARTMENT.director, statuses: [STATUS.planningReported] },
  { label: "Registered", desk: DEPARTMENT.csu, statuses: [STATUS.approved, STATUS.registered] },
]

export function stagesFor(route: "first" | "third") {
  return route === "first" ? FIRST_PARTY_STAGES : THIRD_PARTY_STAGES
}

/** Index of the stage a file is currently at, or -1 if it fell out of the chain. */
export function stageIndex(route: "first" | "third", status?: string): number {
  if (!status) return 0
  return stagesFor(route).findIndex((entry) => entry.statuses.includes(status))
}

export function isBlocked(status?: string): boolean {
  return status === STATUS.declined || status === STATUS.changesRequested ||
    (LEGACY.declined as readonly string[]).includes(status ?? "")
}

/* ------------------------------------------------------------------ *
 * Register of permit holders
 * ------------------------------------------------------------------ */

export const REGISTER_COLLECTION = "permitRegister"

export type RegisterCategory = "first-party" | "third-party"

export function permitNumber(category: RegisterCategory): string {
  const prefix = category === "first-party" ? "FP" : "TP"
  const year = new Date().getFullYear()
  const tail = Math.random().toString(36).slice(2, 7).toUpperCase()
  return `DOAS/${prefix}/${year}/${tail}`
}

/** Permits run for a year from the date of approval. */
export function expiryFrom(date = new Date()): string {
  const expires = new Date(date)
  expires.setFullYear(expires.getFullYear() + 1)
  return expires.toISOString()
}

/* ------------------------------------------------------------------ *
 * Billing — first party only
 * ------------------------------------------------------------------ */

export const DEFAULT_FEES = {
  applicationFee: 25000,
  processingFee: 10000,
  annualFee: 150000,
}

export function invoiceNumber(): string {
  const stamp = new Date()
  const ym = `${stamp.getFullYear()}${String(stamp.getMonth() + 1).padStart(2, "0")}`
  return `DOAS-${ym}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
}

export function feesTotal(fees: { [key: string]: unknown }): number {
  return ["applicationFee", "processingFee", "annualFee", "penaltyFee"].reduce((sum, key) => {
    const value = Number(fees[key] ?? 0)
    return sum + (Number.isFinite(value) ? value : 0)
  }, 0)
}

/** Chat channels available to each unit — everyone except themselves. */
export function channelsFor(self: string) {
  return [
    { id: "director", name: "Director" },
    { id: "csu", name: "Customer Service" },
    { id: "business_development", name: "Business Development" },
    { id: "finance", name: "Finance & Admin" },
    { id: "planning_development", name: "Planning & Development" },
    { id: "monitoring_enforcement", name: "Monitoring & Enforcement" },
  ].filter((channel) => channel.id !== self)
}

/* ------------------------------------------------------------------ *
 * Meeting requests
 *
 * A visitor asks to see the Director. CSU screens the request, forwards
 * what's worth his time, and the Director approves or declines. Both CSU
 * and the visitor see that decision.
 *
 * These statuses are lowercase because that's what the existing screens
 * already write. The public form used to write "Pending" with a capital P,
 * which matched none of the dashboard filters.
 * ------------------------------------------------------------------ */

export const MEETING_STATUS = {
  withCsu: "pending",
  withDirector: "forwarded",
  approved: "approved",
  declined: "rejected",
  scheduled: "scheduled",
  completed: "completed",
} as const

export const MEETING_STAGES = [
  { label: "Received", statuses: [MEETING_STATUS.withCsu, "Pending"] },
  { label: "With the Director", statuses: [MEETING_STATUS.withDirector] },
  {
    label: "Decision",
    statuses: [
      MEETING_STATUS.approved,
      MEETING_STATUS.declined,
      MEETING_STATUS.scheduled,
      MEETING_STATUS.completed,
    ],
  },
]

export function meetingStageIndex(status?: string): number {
  const value = (status ?? "").toLowerCase()
  return MEETING_STAGES.findIndex((entry) =>
    entry.statuses.some((candidate) => candidate.toLowerCase() === value),
  )
}

export function meetingDecided(status?: string): boolean {
  return [
    MEETING_STATUS.approved,
    MEETING_STATUS.declined,
    MEETING_STATUS.scheduled,
    MEETING_STATUS.completed,
  ].includes((status ?? "").toLowerCase() as never)
}

export function meetingRequestId(): string {
  return `MR-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}
