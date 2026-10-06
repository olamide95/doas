#!/usr/bin/env bash
# DOAS ERP installer — run from the project root (next to package.json).
#   bash install-doas.sh
# Overwrites the files below. Commit or back up first.
set -euo pipefail

if [ ! -f package.json ]; then
  echo "Run this from the project root (package.json not found)." >&2
  exit 1
fi

w() { mkdir -p "$(dirname "$1")"; cat > "$1"; echo "  wrote $1"; }

echo "Installing DOAS ERP files…"

# ============================================================================
w lib/firebase.ts <<'DOAS_EOF'
import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app"
import { getFirestore } from "firebase/firestore"
import { getAuth } from "firebase/auth"
import { getStorage } from "firebase/storage"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyA3R15_tAiapTQcKc_6cL8nN_FPoWRDFI0",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "doas-771c4.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "doas-771c4",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "doas-771c4.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "376823252081",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:376823252081:web:871302513d4da5fae107d0",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? "G-5RM0N8JG2W",
}

const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig)

export const db = getFirestore(app)
export const auth = getAuth(app)
export const storage = getStorage(app)
export { app }

/** Firestore collection names, in one place so a rename is a one-line change. */
export const COL = {
  firstParty: "firstPartySubmissions",
  thirdParty: "thirdPartySubmissions",
  practitioners: "practitioners",
  meetings: "meetingRequests",
  notifications: "notifications",
  tasks: "tasks",
  staff: "staff",
  activity: "activityLogs",
  chats: "chats",
  register: "permitRegister",
  tariffs: "tariffSchedules",
  compliance: "complianceIssues",
} as const
DOAS_EOF

# ============================================================================
w lib/workflow.ts <<'DOAS_EOF'
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
DOAS_EOF

# ============================================================================
w lib/tariff.ts <<'DOAS_EOF'
import * as React from "react"
import { useRealtimeCollection } from "@/hooks/use-firestore"
import { TARIFF_COLLECTION, addDaysMinusDay, addYearsMinusDay } from "@/lib/workflow"

/* ---------------- Vocabularies ---------------- */

export const SIGN_TYPES = [
  { value: "Facade_Sign", label: "Façade sign" },
  { value: "Wall_Drape", label: "Wall drape" },
  { value: "Projecting_Sign", label: "Projecting sign" },
  { value: "Roof_Sign", label: "Roof sign" },
  { value: "Ground_Pylon", label: "Ground pylon" },
  { value: "Window_Graphics", label: "Window graphics" },
]

export const STRUCTURE_TYPES = [
  { value: "Unipole", label: "Unipole" },
  { value: "Portrait_Billboard", label: "Portrait billboard" },
  { value: "Super_48_Sheet", label: "Super 48-sheet" },
  { value: "Gantry", label: "Gantry" },
  { value: "Digital_LED_Screen", label: "Digital LED screen" },
  { value: "Spectacular", label: "Spectacular" },
]

export const ILLUMINATION_TYPES = [
  { value: "Non-Illuminated", label: "Non-illuminated" },
  { value: "Front-Lit_LED", label: "Front-lit LED" },
  { value: "Back-Lit_Neon", label: "Back-lit neon" },
  { value: "Digital_Screen", label: "Digital screen" },
]

export const MATERIALS = [
  { value: "Flex_Face", label: "Flex face" },
  { value: "Alucobond", label: "Alucobond" },
  { value: "Acrylic_Letters", label: "Acrylic letters" },
  { value: "Electronic_Matrix", label: "Electronic matrix" },
]

export const OCCUPANCY_TYPES = ["Banking", "Retail", "Hospitality", "Corporate", "Oil & Gas", "Others"]

const ALL_TYPES = [...SIGN_TYPES, ...STRUCTURE_TYPES, ...ILLUMINATION_TYPES, ...MATERIALS]
export function typeLabel(value?: string) {
  if (!value) return "—"
  return ALL_TYPES.find((t) => t.value === value)?.label ?? value.replace(/_/g, " ")
}

export const isLit = (illumination?: string) => Boolean(illumination) && illumination !== "Non-Illuminated"

/* ---------------- Zones ---------------- */

export type ZoneId = "A" | "B" | "C"
export const ZONES: { id: ZoneId; label: string; multiplier: number; note: string }[] = [
  { id: "A", label: "Zone A — Premium (1.5×)", multiplier: 1.5, note: "Maitama, Wuse, Garki, Asokoro, Central Area" },
  { id: "B", label: "Zone B — Standard (1.25×)", multiplier: 1.25, note: "Jabi, Utako, Gwarinpa, Kubwa, Lugbe" },
  { id: "C", label: "Zone C — Satellite (1.0×)", multiplier: 1.0, note: "Kuje, Kwali, Abaji and outlying areas" },
]

export function zoneById(id?: string) {
  return ZONES.find((z) => z.id === id) ?? ZONES[2]
}

export function suggestZone(areaCouncil?: string): ZoneId {
  if (areaCouncil === "AMAC") return "A"
  if (areaCouncil === "Bwari" || areaCouncil === "Gwagwalada") return "B"
  return "C"
}

/* ---------------- Tariff schedules ---------------- */

export interface TariffSchedule {
  id: string
  name: string
  active?: boolean
  rates: Record<string, number>
  illuminationSurchargePct: number
  effectiveFrom?: string
}

/**
 * PLACEHOLDER RATES (₦ per m², per year). They reproduce the worked example in
 * the spec but are NOT the gazetted figures — Billing must enter the real
 * schedule from the Tariffs tab before go-live.
 */
export const DEFAULT_SCHEDULE: TariffSchedule = {
  id: "fct-gazette-2024v2",
  name: "FCT Signage Gazette 2024v2",
  active: true,
  illuminationSurchargePct: 20,
  rates: {
    Facade_Sign: 20000,
    Wall_Drape: 20000,
    Projecting_Sign: 20000,
    Roof_Sign: 25000,
    Ground_Pylon: 20000,
    Window_Graphics: 10000,
    Unipole: 35000,
    Portrait_Billboard: 30000,
    Super_48_Sheet: 30000,
    Gantry: 40000,
    Digital_LED_Screen: 50000,
    Spectacular: 45000,
  },
}

export function useTariffSchedules() {
  const { data, loading, error } = useRealtimeCollection<Partial<TariffSchedule>>(TARIFF_COLLECTION, [], [])
  const schedules = React.useMemo<TariffSchedule[]>(() => {
    const stored = data.map((d) => ({
      ...DEFAULT_SCHEDULE,
      active: false,
      ...d,
      id: d.id as string,
      rates: { ...DEFAULT_SCHEDULE.rates, ...(d.rates ?? {}) },
    }))
    return stored.length ? stored : [DEFAULT_SCHEDULE]
  }, [data])
  const active = schedules.find((s) => s.active) ?? schedules[0]
  return { schedules, active, loading, error, seeded: data.length > 0 }
}

/* ---------------- Measurements (locked by field desks) ---------------- */

export interface MeasuredItem {
  id: string
  type: string
  illumination: string
  material?: string
  height: number
  width: number
  faces: number
  sqm: number
  lat?: number | null
  lng?: number | null
}

export interface Measurements {
  source: "business_development" | "planning_development"
  items: MeasuredItem[]
  totalSqm: number
  lockedAt: string
  lockedBy: string
}

/* ---------------- Bill computation ---------------- */

export type CycleType = "Annual_Standard" | "Short_Term_Promotional" | "Multi_Year_Contract"

export const CYCLE_TYPES: { value: CycleType; label: string }[] = [
  { value: "Annual_Standard", label: "Annual — standard" },
  { value: "Short_Term_Promotional", label: "Short-term promotional" },
  { value: "Multi_Year_Contract", label: "Multi-year contract" },
]

export interface BillParams {
  rates: Record<string, number>
  illuminationSurchargePct: number
  applyIllumination: boolean
  zoneMultiplier: number
  penaltyLoadingFee: number
  waiverAmount: number
  billingCycleType: CycleType
  cycleYears: number
  promoDays: number
}

export interface BillLine {
  id: string
  type: string
  sqm: number
  rate: number
  base: number
  surcharge: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function cycleFactor(p: Pick<BillParams, "billingCycleType" | "cycleYears" | "promoDays">) {
  if (p.billingCycleType === "Multi_Year_Contract") return Math.max(1, Math.floor(Number(p.cycleYears) || 1))
  if (p.billingCycleType === "Short_Term_Promotional") return Math.max(1, Number(p.promoDays) || 1) / 365
  return 1
}

export function computeBill(items: MeasuredItem[], p: BillParams) {
  const missingRates: string[] = []
  const lines: BillLine[] = items.map((item) => {
    const rate = Number(p.rates[item.type] ?? 0)
    if (!rate) missingRates.push(item.type)
    const base = item.sqm * rate * Number(p.zoneMultiplier || 1)
    const surcharge = p.applyIllumination && isLit(item.illumination) ? (base * Number(p.illuminationSurchargePct || 0)) / 100 : 0
    return { id: item.id, type: item.type, sqm: item.sqm, rate, base: round2(base), surcharge: round2(surcharge) }
  })
  const factor = cycleFactor(p)
  const baseComputation = round2(lines.reduce((s, l) => s + l.base, 0))
  const illuminationSurcharge = round2(lines.reduce((s, l) => s + l.surcharge, 0))
  const calculatedSubtotalAmount = round2((baseComputation + illuminationSurcharge) * factor)
  const netInvoiceAmount = round2(Math.max(0, calculatedSubtotalAmount + Number(p.penaltyLoadingFee || 0) - Number(p.waiverAmount || 0)))
  return {
    lines,
    totalSqm: round2(items.reduce((s, i) => s + i.sqm, 0)),
    baseComputation,
    illuminationSurcharge,
    cycleFactor: round2(factor),
    calculatedSubtotalAmount,
    netInvoiceAmount,
    missingRates: Array.from(new Set(missingRates)),
  }
}

export function expiryFor(start: string, p: Pick<BillParams, "billingCycleType" | "cycleYears" | "promoDays">) {
  if (p.billingCycleType === "Multi_Year_Contract") return addYearsMinusDay(start, Math.max(1, Number(p.cycleYears) || 1))
  if (p.billingCycleType === "Short_Term_Promotional") return addDaysMinusDay(start, Number(p.promoDays) || 30)
  return addYearsMinusDay(start, 1)
}
DOAS_EOF

# ============================================================================
w lib/applicant.ts <<'DOAS_EOF'
import { collection, getDocs, limit, query, where } from "firebase/firestore"
import { COL, db } from "@/lib/firebase"
import { MEETING_STATUS, STATUS, isBlocked, meetingDecided, stage, stagesFor } from "@/lib/workflow"

export type Route = "first" | "third"

export interface FoundApplication {
  kind: "application"
  docId: string
  route: Route
  collectionName: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>
}

export interface FoundMeeting {
  kind: "meeting"
  docId: string
  collectionName: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>
}

export type FoundRecord = FoundApplication | FoundMeeting

async function firstMatch(path: string, field: string, value: string) {
  const snap = await getDocs(query(collection(db, path), where(field, "==", value), limit(1)))
  return snap.empty ? null : snap.docs[0]
}

/** Applications only — the edit form relies on this never returning a meeting. */
export async function findSubmission(reference: string): Promise<FoundApplication | null> {
  const ref = reference.trim()
  if (!ref) return null
  const order: { name: string; route: Route }[] = ref.toUpperCase().startsWith("TP")
    ? [{ name: COL.thirdParty, route: "third" }, { name: COL.firstParty, route: "first" }]
    : [{ name: COL.firstParty, route: "first" }, { name: COL.thirdParty, route: "third" }]
  for (const source of order) {
    const hit = await firstMatch(source.name, "submissionId", ref)
    if (hit) return { kind: "application", docId: hit.id, route: source.route, collectionName: source.name, data: hit.data() }
  }
  return null
}

/** Applications first, then meeting requests (older ones were saved without requestId). */
export async function findRecord(reference: string): Promise<FoundRecord | null> {
  const ref = reference.trim()
  if (!ref) return null
  const application = await findSubmission(ref)
  if (application) return application
  for (const field of ["requestId", "submissionId"]) {
    const hit = await firstMatch(COL.meetings, field, ref)
    if (hit) return { kind: "meeting", docId: hit.id, collectionName: COL.meetings, data: hit.data() }
  }
  return null
}

export function isEditable(status?: string | null) {
  return [...stage("withCsu"), STATUS.changesRequested].includes(status ?? "")
}

export function needsAttention(status?: string | null) {
  return isBlocked(status)
}

export function awaitingPayment(status?: string | null) {
  return stage("awaitingPayment").includes(status ?? "")
}

export interface ApplicantMessage {
  tone: "stop" | "wait" | "move" | "clear"
  headline: string
  body: string
  action: "edit" | "pay" | "new" | "none"
}

export function applicantMessage(status: string | undefined, route: Route): ApplicantMessage {
  const s = status ?? ""
  const field = route === "first" ? "a Business Development officer" : "Planning's engineers"
  const msg = (tone: ApplicantMessage["tone"], headline: string, body: string, action: ApplicantMessage["action"] = "none"): ApplicantMessage => ({
    tone,
    headline,
    body,
    action,
  })

  if (s === STATUS.declined || s === "Rejected")
    return msg("stop", "Not approved", "The Director has declined this application. The reason is below. You can file a fresh application once the issues are resolved.", "new")
  if (s === STATUS.changesRequested)
    return msg("stop", "Changes needed", "The Director has sent this back. Read the reason below, update your application and resubmit.", "edit")
  if (stage("withCsu").includes(s)) return msg("wait", "Received — being screened", "Customer Service is checking your documents. You can still edit the application.", "edit")
  if (stage("withDirector").includes(s)) return msg("move", "With the Director", "Your file has passed screening and awaits the Director's first review.")
  if (stage("siteVisit").includes(s) || stage("planningReview").includes(s))
    return msg("wait", "Site inspection scheduled", `${field} will visit the site to measure and photograph the signage.`)
  if ([...stage("visitReported"), ...stage("planningReported"), ...stage("billingQueried")].includes(s))
    return msg("move", "Inspection complete", "The Director is checking the inspection findings before your bill is prepared.")
  if (stage("billing").includes(s)) return msg("wait", "Your bill is being prepared", "Billing is applying the gazetted tariff to the measured signage.")
  if (stage("billProposed").includes(s)) return msg("move", "Bill awaiting sign-off", "The Director is confirming the charges. Your invoice appears here once approved.")
  if (s === STATUS.partPayment) return msg("stop", "Balance outstanding", "Finance has recorded part of your payment. Pay the balance below and upload the new receipt.", "pay")
  if (awaitingPayment(s)) return msg("wait", "Payment due", "Pay via Remita or at the bank, then declare your RRR and upload the receipt below.", "pay")
  if (stage("paymentFlagged").includes(s)) return msg("stop", "Payment under review", "There's a problem verifying your payment. Customer Service will contact you.")
  if (stage("paymentReconciled").includes(s)) return msg("move", "Payment confirmed", "Finance has verified your payment. The Director signs your permit next.")
  if (stage("issued").includes(s)) return msg("clear", "Permit issued", "Your permit is on the register. Keep the permit number for inspections and renewal.")
  return msg("move", "In progress", "The steps above show where your application is.")
}

export function publicStages(route: Route) {
  return stagesFor(route).map((e) => e.label)
}

export function meetingMessage(status?: string | null): ApplicantMessage {
  const s = (status ?? "").toLowerCase()
  if (s === MEETING_STATUS.declined)
    return { tone: "stop", headline: "Not granted", body: "The Director isn't able to take this meeting. Any note he left is below.", action: "none" }
  if (s === MEETING_STATUS.approved || s === MEETING_STATUS.scheduled)
    return { tone: "clear", headline: "Meeting granted", body: "Customer Service will contact you to confirm the exact time.", action: "none" }
  if (s === MEETING_STATUS.completed)
    return { tone: "clear", headline: "Meeting held", body: "This request is closed. File a new one if you need to see the Director again.", action: "none" }
  if (s === MEETING_STATUS.withDirector)
    return { tone: "move", headline: "With the Director", body: "Customer Service has passed your request to the Director.", action: "none" }
  return { tone: "move", headline: "Received", body: "Customer Service is reviewing your request before passing it on.", action: "none" }
}

export { meetingDecided }
DOAS_EOF

# ============================================================================
w components/dashboard/kit.tsx <<'DOAS_EOF'
"use client"

import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { STATUS_TONE } from "@/lib/workflow"
import { cn } from "@/lib/utils"

/* ------------------------------------------------------------------ *
 * Status vocabulary
 * Every status in DOAS is one of five things: waiting on someone,
 * moving between desks, cleared, stopped, or dormant.
 * ------------------------------------------------------------------ */

export type StateTone = "wait" | "move" | "clear" | "stop" | "idle"

export const TONE: Record<StateTone, { text: string; soft: string; dot: string; rule: string }> = {
  wait: {
    text: "text-[hsl(var(--state-wait))]",
    soft: "bg-[hsl(var(--state-wait-soft))] text-[hsl(var(--state-wait))]",
    dot: "bg-[hsl(var(--state-wait))]",
    rule: "bg-[hsl(var(--state-wait))]",
  },
  move: {
    text: "text-[hsl(var(--state-move))]",
    soft: "bg-[hsl(var(--state-move-soft))] text-[hsl(var(--state-move))]",
    dot: "bg-[hsl(var(--state-move))]",
    rule: "bg-[hsl(var(--state-move))]",
  },
  clear: {
    text: "text-[hsl(var(--state-clear))]",
    soft: "bg-[hsl(var(--state-clear-soft))] text-[hsl(var(--state-clear))]",
    dot: "bg-[hsl(var(--state-clear))]",
    rule: "bg-[hsl(var(--state-clear))]",
  },
  stop: {
    text: "text-[hsl(var(--state-stop))]",
    soft: "bg-[hsl(var(--state-stop-soft))] text-[hsl(var(--state-stop))]",
    dot: "bg-[hsl(var(--state-stop))]",
    rule: "bg-[hsl(var(--state-stop))]",
  },
  idle: {
    text: "text-[hsl(var(--state-idle))]",
    soft: "bg-[hsl(var(--state-idle-soft))] text-[hsl(var(--state-idle))]",
    dot: "bg-[hsl(var(--state-idle))]",
    rule: "bg-[hsl(var(--state-idle))]",
  },
}

export function toneForStatus(status?: string | null): StateTone {
  if (status && STATUS_TONE[status]) return STATUS_TONE[status]
  const s = (status ?? "").toLowerCase()
  if (!s) return "idle"
  if (s.includes("reject") || s.includes("suspend") || s.includes("expired") || s.includes("declin")) return "stop"
  if (s.includes("approv") || s.includes("complete") || s.includes("active") || s.includes("paid") || s.includes("issued")) return "clear"
  if (s.includes("forward") || s.includes("review") || s.includes("progress") || s.includes("schedul")) return "move"
  if (s.includes("pend") || s.includes("required") || s.includes("await") || s.includes("submitted")) return "wait"
  return "idle"
}

/** Statuses read better without their bookkeeping prefix in a narrow cell. */
export function shortStatus(status?: string | null): string {
  if (!status) return "Unknown"
  return status.replace(/^Forwarded to /i, "With ").replace(/_/g, " ")
}

export function StatusPill({ status, tone, className }: { status?: string | null; tone?: StateTone; className?: string }) {
  const t = TONE[tone ?? toneForStatus(status)]
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-[11.5px] font-semibold", t.soft, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", t.dot)} aria-hidden />
      {shortStatus(status)}
    </span>
  )
}

export function UrgencyPill({ urgency }: { urgency?: string | null }) {
  const u = (urgency ?? "low").toLowerCase()
  const tone: StateTone = u === "high" ? "stop" : u === "medium" ? "wait" : "idle"
  const label = u.charAt(0).toUpperCase() + u.slice(1)
  return <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[11.5px] font-semibold", TONE[tone].soft)}>{label}</span>
}

/* ------------------------------------------------------------------ *
 * Numbers
 * ------------------------------------------------------------------ */

export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = React.useState(value)
  const previous = React.useRef(value)

  React.useEffect(() => {
    const from = previous.current
    const to = value
    previous.current = value
    if (from === to) return

    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduce) {
      setDisplay(to)
      return
    }

    const duration = 520
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(from + (to - from) * eased))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])

  return <span className={cn("figure tnum", className)}>{display.toLocaleString("en-NG")}</span>
}

/* ------------------------------------------------------------------ *
 * Layout pieces
 * ------------------------------------------------------------------ */

export function PageHeading({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-[26px] font-semibold leading-tight text-foreground sm:text-[30px]">{title}</h1>
        {description ? <p className="mt-1 max-w-[62ch] text-[13.5px] leading-relaxed text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function StatTile({
  label,
  value,
  tone = "idle",
  icon: Icon,
  note,
  onClick,
  index = 0,
}: {
  label: string
  value: number
  tone?: StateTone
  icon: LucideIcon
  note?: string
  onClick?: () => void
  index?: number
}) {
  const Wrapper = onClick ? "button" : "div"
  return (
    <Wrapper
      {...(onClick ? { type: "button" as const, onClick } : {})}
      style={{ ["--i" as string]: index }}
      className={cn(
        "reveal group relative overflow-hidden rounded-xl surface px-4 py-4 text-left transition-shadow",
        onClick && "hover:surface-raised focus-visible:surface-raised",
      )}
    >
      <span className={cn("absolute inset-y-0 left-0 w-[3px]", TONE[tone].rule)} aria-hidden />
      <div className="flex items-start justify-between gap-3 pl-1">
        <div className="min-w-0">
          <p className="truncate text-[12.5px] font-medium text-muted-foreground">{label}</p>
          <p className="mt-1.5 text-[32px] font-semibold leading-none text-foreground">
            <AnimatedNumber value={value} />
          </p>
          {note ? <p className="mt-2 text-[11.5px] text-muted-foreground">{note}</p> : null}
        </div>
        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-transform", TONE[tone].soft, onClick && "group-hover:scale-105")}>
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        </span>
      </div>
    </Wrapper>
  )
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: string
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={cn("rounded-xl surface", className)}>
      {title || actions ? (
        <header className="flex flex-col gap-3 border-b border-border px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            {title ? <h2 className="font-display text-[15px] font-semibold text-foreground">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-[12.5px] text-muted-foreground">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cn("p-4 sm:p-5", bodyClassName)}>{children}</div>
    </section>
  )
}

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="fade-in flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-14 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <p className="mt-3 font-display text-[15px] font-semibold text-foreground">{title}</p>
      {description ? <p className="mt-1 max-w-[46ch] text-[13px] leading-relaxed text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function RowsSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-px overflow-hidden rounded-lg" aria-hidden>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 bg-card px-3 py-3.5">
          {Array.from({ length: columns }).map((_, c) => (
            <div key={c} className="skeleton h-3 rounded" style={{ width: c === 0 ? "18%" : c === columns - 1 ? "10%" : "16%" }} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function LoadFailed({ error, what }: { error: Error; what: string }) {
  return (
    <div className="rounded-lg border border-[hsl(var(--state-stop))]/30 bg-[hsl(var(--state-stop-soft))] px-4 py-3.5">
      <p className="text-[13px] font-semibold text-[hsl(var(--state-stop))]">{what} could not load</p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
        {error.message.includes("index")
          ? "Firestore needs an index for this query. Open the browser console and follow the link Firebase printed to create it."
          : error.message}
      </p>
    </div>
  )
}

export function Field({ label, value, mono, className }: { label: string; value?: React.ReactNode; mono?: boolean; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[11.5px] font-medium text-muted-foreground">{label}</p>
      <div className={cn("mt-0.5 break-words text-[13.5px] text-foreground", mono && "font-mono text-[12.5px]")}>
        {value === undefined || value === null || value === "" ? "—" : value}
      </div>
    </div>
  )
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-3 border-b border-border pb-1.5 font-display text-[13px] font-semibold text-foreground">{children}</h3>
}
DOAS_EOF

# ============================================================================
w components/dashboard/shell.tsx <<'DOAS_EOF'
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { signOut } from "firebase/auth"
import { limit, where } from "firebase/firestore"
import type { LucideIcon } from "lucide-react"
import { Bell, ChevronsLeft, LayoutGrid, LogOut, Menu, PanelsTopLeft, Settings, User, X } from "lucide-react"
import { auth, COL } from "@/lib/firebase"
import { useCurrentUser, useRealtimeCollection } from "@/hooks/use-firestore"
import { formatLongDate, initials } from "@/lib/format"
import { toast } from "@/components/ui/toast"
import { FileTracker } from "@/components/dashboard/audit-timeline"
import { cn } from "@/lib/utils"

export interface ShellNavItem {
  value: string
  label: string
  icon: LucideIcon
  badge?: number
}

interface ShellProps {
  audience: string
  unitName: string
  unitCaption: string
  nav: ShellNavItem[]
  active: string
  onNavigate: (value: string) => void
  children: React.ReactNode
}

export function DashboardShell({ audience, unitName, unitCaption, nav, active, onNavigate, children }: ShellProps) {
  const router = useRouter()
  const { user } = useCurrentUser()
  const [collapsed, setCollapsed] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)

  const { data: notifications } = useRealtimeCollection<Record<string, unknown>>(COL.notifications, [where("userId", "==", audience), limit(100)], [audience])
  const unread = notifications.filter((n) => !(n.isRead ?? n.read ?? false)).length

  const displayName = user?.displayName || user?.email?.split("@")[0] || unitName
  const activeItem = nav.find((item) => item.value === active)

  const handleSignOut = async () => {
    try {
      if (auth.currentUser) await signOut(auth)
      router.push("/desks")
    } catch (error) {
      toast.error({ title: "Sign out failed", description: error instanceof Error ? error.message : "Try again in a moment." })
    }
  }

  const Rail = ({ onPick }: { onPick?: () => void }) => (
    <div className="flex h-full flex-col bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))]">
      <div className="flex h-16 items-center gap-2.5 border-b border-[hsl(var(--sidebar-border))] px-4">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[hsl(var(--sidebar-primary))] font-display text-[13px] font-bold text-[hsl(var(--sidebar-primary-foreground))]">
          DO
        </span>
        {!collapsed ? (
          <div className="min-w-0 leading-tight">
            <p className="font-display text-[14px] font-semibold text-white">DOAS</p>
            <p className="truncate text-[11px] text-[hsl(var(--sidebar-foreground))]/70">{unitCaption}</p>
          </div>
        ) : null}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto scroll-slim p-2.5">
        {nav.map((item) => {
          const isActive = item.value === active
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => {
                onNavigate(item.value)
                onPick?.()
              }}
              title={collapsed ? item.label : undefined}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors",
                isActive
                  ? "bg-[hsl(var(--sidebar-accent))] text-white"
                  : "text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))]/60 hover:text-white",
              )}
            >
              <item.icon className="h-[17px] w-[17px] shrink-0" aria-hidden />
              {!collapsed ? <span className="flex-1 truncate text-left">{item.label}</span> : null}
              {!collapsed && item.badge ? (
                <span className="tnum rounded-md bg-[hsl(var(--sidebar-primary))] px-1.5 py-0.5 text-[10.5px] font-bold text-[hsl(var(--sidebar-primary-foreground))]">
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              ) : null}
              {collapsed && item.badge ? <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--sidebar-primary))]" /> : null}
            </button>
          )
        })}
      </nav>

      <div className="border-t border-[hsl(var(--sidebar-border))] p-2.5">
        <button
          type="button"
          onClick={() => router.push("/desks")}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[12.5px] text-[hsl(var(--sidebar-foreground))]/80 transition-colors hover:bg-[hsl(var(--sidebar-accent))] hover:text-white"
        >
          <LayoutGrid className="h-4 w-4" aria-hidden />
          {!collapsed ? "All desks" : null}
        </button>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="hidden w-full items-center gap-3 rounded-lg px-3 py-2 text-[12.5px] text-[hsl(var(--sidebar-foreground))]/80 transition-colors hover:bg-[hsl(var(--sidebar-accent))] hover:text-white lg:flex"
        >
          <ChevronsLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} aria-hidden />
          {!collapsed ? "Collapse" : null}
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-background">
      <aside className={cn("sticky top-0 hidden h-screen shrink-0 transition-[width] duration-200 lg:block", collapsed ? "w-[68px]" : "w-[232px]")}>
        <Rail />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close menu" onClick={() => setMobileOpen(false)} className="fade-in absolute inset-0 bg-foreground/40 backdrop-blur-[2px]" />
          <div className="reveal absolute inset-y-0 left-0 w-[248px]">
            <Rail onPick={() => setMobileOpen(false)} />
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-4 rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-[15px] font-semibold text-foreground">{activeItem?.label ?? unitName}</p>
              <p className="truncate text-[11.5px] text-muted-foreground">{formatLongDate()}</p>
            </div>

            <button
              type="button"
              onClick={() => onNavigate("notifications")}
              aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
              className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Bell className="h-[18px] w-[18px]" />
              {unread > 0 ? (
                <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-[hsl(var(--state-stop))] px-1 text-[9.5px] font-bold leading-none text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </button>

            <AccountMenu name={displayName} email={user?.email ?? undefined} unit={unitName} onProfile={() => onNavigate("settings")} onSignOut={handleSignOut} />
          </div>
        </header>

        <main className="flex-1 px-4 py-5 sm:px-6 sm:py-7">
          {children}
          <div className="mt-8">
            <FileTracker />
          </div>
        </main>
      </div>
    </div>
  )
}

function AccountMenu({
  name,
  email,
  unit,
  onProfile,
  onSignOut,
}: {
  name: string
  email?: string
  unit: string
  onProfile: () => void
  onSignOut: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg p-1 transition-colors hover:bg-muted"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-primary font-display text-[12px] font-semibold text-primary-foreground">{initials(name)}</span>
        <span className="hidden min-w-0 text-left sm:block">
          <span className="block max-w-[140px] truncate text-[13px] font-medium text-foreground">{name}</span>
          <span className="block text-[11px] text-muted-foreground">{unit}</span>
        </span>
      </button>

      {open ? (
        <div role="menu" className="reveal absolute right-0 top-[calc(100%+8px)] w-60 overflow-hidden rounded-xl surface-raised">
          <div className="border-b border-border px-3.5 py-3">
            <p className="truncate text-[13px] font-semibold text-foreground">{name}</p>
            <p className="truncate text-[11.5px] text-muted-foreground">{email ?? unit}</p>
          </div>
          <div className="p-1.5">
            <MenuItem
              icon={User}
              label="Profile"
              onClick={() => {
                setOpen(false)
                onProfile()
              }}
            />
            <MenuItem
              icon={Settings}
              label="Settings"
              onClick={() => {
                setOpen(false)
                onProfile()
              }}
            />
            <MenuItem
              icon={PanelsTopLeft}
              label="Keyboard shortcuts"
              onClick={() => {
                setOpen(false)
                toast.info({ title: "Shortcuts", description: "Press / to search a table, Esc to close any dialog." })
              }}
            />
          </div>
          <div className="border-t border-border p-1.5">
            <MenuItem
              icon={LogOut}
              label="Leave desk"
              destructive
              onClick={() => {
                setOpen(false)
                onSignOut()
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

function MenuItem({ icon: Icon, label, onClick, destructive }: { icon: LucideIcon; label: string; onClick: () => void; destructive?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
        destructive ? "text-[hsl(var(--state-stop))] hover:bg-[hsl(var(--state-stop-soft))]" : "text-foreground hover:bg-muted",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {label}
    </button>
  )
}
DOAS_EOF

# ============================================================================
w components/dashboard/audit-timeline.tsx <<'DOAS_EOF'
"use client"

import * as React from "react"
import { doc, onSnapshot } from "firebase/firestore"
import { History, Loader2, Search } from "lucide-react"
import { db } from "@/lib/firebase"
import { findSubmission } from "@/lib/applicant"
import { deskLabel, parseDate } from "@/lib/workflow"
import { Panel, StatusPill } from "@/components/dashboard/kit"
import { ActionButton } from "@/components/dashboard/form-kit"

export interface AuditEntry {
  text?: string
  timestamp?: string
  action?: string
  desk?: string
  from?: string
  to?: string
  status?: string
}

interface TimelineRow {
  comments?: AuditEntry[]
  createdAt?: unknown
  status?: string
  department?: string
}

const pad = (n: number) => String(n).padStart(2, "0")
function stamp(value: unknown) {
  const d = parseDate(value)
  if (!d) return "—"
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Read-only file movement log, built from the trail every action appends. */
export function AuditTimeline({ row }: { row: TimelineRow }) {
  const entries = React.useMemo(() => {
    const list = (row.comments ?? []).slice()
    list.sort((a, b) => (parseDate(a.timestamp)?.getTime() ?? 0) - (parseDate(b.timestamp)?.getTime() ?? 0))
    const opened = list.some((e) => e.desk === "applicant" && /opened/i.test(e.action ?? ""))
    if (opened) return list
    const created = parseDate(row.createdAt)
    return [{ timestamp: created ? created.toISOString() : "", desk: "applicant", action: "File opened via portal upload", to: "CSU" } as AuditEntry, ...list]
  }, [row.comments, row.createdAt])

  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-[12.5px] font-semibold text-foreground">
        <History className="h-3.5 w-3.5" /> Audit log — file movement
      </p>
      <ol className="space-y-1.5 font-mono text-[11.5px] leading-relaxed text-muted-foreground">
        {entries.map((e, i) => (
          <li key={i} className="flex gap-2">
            <span className="shrink-0 text-border">{i === entries.length - 1 ? "└──" : "├──"}</span>
            <span className="min-w-0">
              <span className="text-foreground">[{stamp(e.timestamp)}]</span> — {deskLabel(e.desk)}: {e.action}
              {e.text && e.text !== e.action ? <span className="italic"> “{e.text}”</span> : null}
              {e.to ? <span> Route → {e.to}.</span> : null}
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
        Current file state → <StatusPill status={row.status} /> with {row.department ?? "—"}
      </div>
    </div>
  )
}

/** Anchored at the base of every dashboard (mounted from DashboardShell). */
export function FileTracker() {
  const [reference, setReference] = React.useState("")
  const [target, setTarget] = React.useState<{ path: string; id: string; ref: string } | null>(null)
  const [row, setRow] = React.useState<TimelineRow | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [missing, setMissing] = React.useState(false)

  React.useEffect(() => {
    if (!target) return
    return onSnapshot(doc(db, target.path, target.id), (snap) => setRow(snap.exists() ? (snap.data() as TimelineRow) : null))
  }, [target])

  const look = async () => {
    if (!reference.trim()) return
    setBusy(true)
    setMissing(false)
    try {
      const found = await findSubmission(reference)
      if (!found) {
        setMissing(true)
        setTarget(null)
        setRow(null)
      } else setTarget({ path: found.collectionName, id: found.docId, ref: found.data.submissionId })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel title="File movement history" description="Look up any file reference to see every desk it has passed through.">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && look()}
          placeholder="FP-… or TP-…"
          className="flex-1 rounded-lg border border-input bg-card px-3 py-2 font-mono text-[13px] outline-none focus:border-ring"
        />
        <ActionButton tone="quiet" icon={busy ? Loader2 : Search} onClick={look} disabled={busy}>
          Trace file
        </ActionButton>
      </div>
      {missing ? <p className="mt-2 text-[12.5px] text-[hsl(var(--state-stop))]">No file matches that reference.</p> : null}
      {target && row ? (
        <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3.5">
          <p className="mb-2 font-mono text-[12px] text-foreground">{target.ref}</p>
          <AuditTimeline row={row} />
        </div>
      ) : null}
    </Panel>
  )
}
DOAS_EOF

# ============================================================================
w components/dashboard/work-queue.tsx <<'DOAS_EOF'
"use client"

import * as React from "react"
import { addDoc, arrayUnion, collection, doc, limit, orderBy, updateDoc } from "firebase/firestore"
import type { LucideIcon } from "lucide-react"
import { Check, Inbox, Lock, MapPin } from "lucide-react"
import { COL, db } from "@/lib/firebase"
import { REGISTER_COLLECTION, STATUS, expiryFrom, isBlocked, notifyIdFor, permitNumber, stageIndex, stagesFor, type RegisterCategory } from "@/lib/workflow"
import { isLit, typeLabel, type Measurements } from "@/lib/tariff"
import { useMergedCollections } from "@/hooks/use-firestore"
import { formatDate, formatDateTime, naira, toMillis, truncate } from "@/lib/format"
import { toast } from "@/components/ui/toast"
import { Sheet } from "@/components/dashboard/sheet"
import { ActionButton, SearchField, TextareaField } from "@/components/dashboard/form-kit"
import { EmptyState, Field, LoadFailed, Panel, RowsSkeleton, SectionLabel, StatusPill } from "@/components/dashboard/kit"
import { Segmented } from "@/components/dashboard/notifications-panel"
import { AuditTimeline, type AuditEntry } from "@/components/dashboard/audit-timeline"
import { cn } from "@/lib/utils"

export type Route = "first" | "third"

export interface SubmissionRow {
  id: string
  route: Route
  submissionId?: string
  applicantType?: string
  applicantName?: string
  companyName?: string
  cacRegistrationNumber?: string
  tin?: string
  corporateAddress?: string
  primaryContactName?: string
  primaryContactPhone?: string
  primaryContactEmail?: string
  signageSiteAddress?: string
  areaCouncil?: string
  email?: string
  contactPhoneNumber?: string
  applicationType?: string
  purposeOfApplication?: string
  addressLine1?: string
  addressLine2?: string
  gpsCoordinates?: string
  signDimensions?: string
  structuralHeight?: string
  numberOfSigns?: string
  typeOfSign?: string
  structureDuration?: string
  practitionerName?: string
  practitionerLicenseNumber?: string
  companyRegistrationNumber?: string
  companyAddress?: string
  status?: string
  department?: string
  directorReason?: string
  deskQuery?: string
  permitNumber?: string
  registerId?: string
  startsAt?: string
  expiresAt?: string
  measurements?: Measurements
  billing?: Record<string, unknown>
  payment?: Record<string, unknown>
  businessDevelopmentReport?: Record<string, unknown>
  technicalReport?: Record<string, unknown>
  siteVisitReport?: Record<string, unknown>
  inspectionReport?: Record<string, unknown>
  files?: Record<string, unknown>
  documents?: Record<string, unknown>
  comments?: AuditEntry[]
  createdAt?: unknown
  updatedAt?: unknown
}

export interface QueueAction {
  key: string
  label: string
  icon?: LucideIcon
  tone?: "primary" | "danger"
  status: string
  department: string
  /** Text recorded in the audit trail. */
  record: string
  notify?: string
  kind?: "success" | "error" | "info"
  needsDraft?: boolean
  requiresReason?: boolean
  /** Extra guard evaluated against the draft and row before running. */
  check?: (draft: Record<string, unknown> | null, row: SubmissionRow) => string | null
  /** Final sign-off: issue the permit and write/refresh the register entry. */
  register?: RegisterCategory
}

export interface QueueView {
  value: string
  label: string
  routes: Route[]
  statuses: string[]
  empty: { title: string; body: string }
  actions?: QueueAction[]
  actionsFor?: (row: SubmissionRow) => QueueAction[]
  column?: { header: string; render: (row: SubmissionRow) => React.ReactNode }
}

export interface QueueDraft<T extends Record<string, unknown>> {
  field: string
  views: string[]
  title: string
  initial: (row: SubmissionRow) => T
  render: (draft: T, set: (patch: Partial<T>) => void, row: SubmissionRow) => React.ReactNode
  validate?: (draft: T, row: SubmissionRow) => string | null
  /** Additional fields written alongside the draft (e.g. locked measurements). */
  derive?: (draft: T, row: SubmissionRow, ctx: { now: string; actorId: string }) => Record<string, unknown>
}

export function useSubmissions(max = 250) {
  const { data, loading, error } = useMergedCollections<Omit<SubmissionRow, "id" | "route">>(
    [
      { path: COL.firstParty, constraints: [orderBy("createdAt", "desc"), limit(max)], tag: "first" },
      { path: COL.thirdParty, constraints: [orderBy("createdAt", "desc"), limit(max)], tag: "third" },
    ],
    (row) => toMillis(row.createdAt),
  )
  const rows = React.useMemo(() => data.map((row) => ({ ...row, route: row.source as Route })) as SubmissionRow[], [data])
  return { rows, loading, error }
}

export function collectionFor(route: Route) {
  return route === "first" ? COL.firstParty : COL.thirdParty
}

export function matches(row: SubmissionRow, view: QueueView, department?: string) {
  if (!view.routes.includes(row.route)) return false
  if (department && row.department !== department) return false
  return view.statuses.includes(row.status ?? "")
}

interface WorkQueueProps<T extends Record<string, unknown>> {
  title: string
  description?: string
  department?: string
  actorId: string
  views: QueueView[]
  draft?: QueueDraft<T>
  extraDetail?: (row: SubmissionRow) => React.ReactNode
}

export function WorkQueue<T extends Record<string, unknown>>({ title, description, department, actorId, views, draft, extraDetail }: WorkQueueProps<T>) {
  const { rows, loading, error } = useSubmissions()
  const [viewValue, setViewValue] = React.useState(views[0]?.value ?? "")
  const [search, setSearch] = React.useState("")
  const [selected, setSelected] = React.useState<SubmissionRow | null>(null)
  const [note, setNote] = React.useState("")
  const [draftValue, setDraftValue] = React.useState<T | null>(null)
  const [busy, setBusy] = React.useState(false)

  const view = views.find((v) => v.value === viewValue) ?? views[0]

  const visible = React.useMemo(() => {
    const term = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (!matches(row, view, department)) return false
      if (!term) return true
      return [row.applicantName, row.companyName, row.submissionId, row.email, row.permitNumber]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term))
    })
  }, [rows, view, department, search])

  React.useEffect(() => {
    if (!selected) return
    const fresh = rows.find((r) => r.id === selected.id && r.route === selected.route)
    if (fresh && fresh.updatedAt !== selected.updatedAt) setSelected(fresh)
  }, [rows, selected])

  const draftActive = Boolean(draft && draft.views.includes(view.value))

  const open = (row: SubmissionRow) => {
    setSelected(row)
    setNote("")
    setDraftValue(draft && draft.views.includes(view.value) ? draft.initial(row) : null)
  }

  const close = () => {
    setSelected(null)
    setNote("")
    setDraftValue(null)
  }

  const run = async (action: QueueAction) => {
    if (!selected || busy) return

    if (action.requiresReason && !note.trim()) {
      toast.warning({ title: "Give a reason", description: "This is recorded on the file, so it can't be blank." })
      return
    }
    if (action.needsDraft && draft && draftValue) {
      const problem = draft.validate?.(draftValue, selected)
      if (problem) {
        toast.warning({ title: "Not ready", description: problem })
        return
      }
    }
    const blocked = action.check?.(draftValue as Record<string, unknown> | null, selected)
    if (blocked) {
      toast.warning({ title: "Can't do that yet", description: blocked })
      return
    }

    setBusy(true)
    const now = new Date().toISOString()
    const entry: AuditEntry = {
      text: note.trim() || action.record,
      timestamp: now,
      action: action.record,
      desk: actorId,
      from: selected.department ?? "",
      to: action.department,
      status: action.status,
    }
    const payload: Record<string, unknown> = {
      status: action.status,
      department: action.department,
      comments: arrayUnion(entry),
      updatedAt: now,
    }

    if (action.requiresReason) payload[isBlocked(action.status) ? "directorReason" : "deskQuery"] = note.trim()

    if (action.needsDraft && draft && draftValue) {
      payload[draft.field] = { ...draftValue, submittedAt: now, submittedBy: actorId }
      Object.assign(payload, draft.derive?.(draftValue, selected, { now, actorId }) ?? {})
    }

    let permit: string | null = null
    let startsAt = ""
    let expiresAt = ""
    if (action.register) {
      const billing = (selected.billing ?? {}) as Record<string, unknown>
      startsAt = String(billing.subscriptionStartDate ?? now.slice(0, 10))
      expiresAt = String(billing.subscriptionExpiryDate ?? expiryFrom(new Date(now)))
      permit = selected.permitNumber ?? permitNumber(action.register)
      Object.assign(payload, { permitNumber: permit, approvedAt: now, startsAt, expiresAt })
    }

    try {
      const ref = doc(db, collectionFor(selected.route), selected.id)
      await updateDoc(ref, payload)

      if (action.register && permit) {
        const billing = (selected.billing ?? {}) as Record<string, unknown>
        const registerEntry = {
          category: action.register,
          permitNumber: permit,
          submissionId: selected.submissionId ?? selected.id,
          submissionRef: selected.id,
          route: selected.route,
          holderName: selected.companyName ?? selected.applicantName ?? "",
          companyName: selected.companyName ?? "",
          email: selected.primaryContactEmail ?? selected.email ?? "",
          phone: selected.primaryContactPhone ?? selected.contactPhoneNumber ?? "",
          address: selected.signageSiteAddress ?? selected.addressLine1 ?? "",
          areaCouncil: selected.areaCouncil ?? "",
          gpsCoordinates: selected.gpsCoordinates ?? "",
          signageType: selected.applicationType ?? "",
          totalSqm: selected.measurements?.totalSqm ?? 0,
          practitionerName: selected.practitionerName ?? "",
          practitionerLicenseNumber: selected.practitionerLicenseNumber ?? "",
          invoiceNumber: billing.invoiceNumber ?? "",
          lastInvoiceAmount: billing.netInvoiceAmount ?? 0,
          cycle: Number(billing.cycle ?? 1),
          status: "Active",
          approvedAt: now,
          startsAt,
          expiresAt,
          registeredBy: actorId,
        }
        if (selected.registerId) {
          await updateDoc(doc(db, REGISTER_COLLECTION, selected.registerId), { ...registerEntry, renewedAt: now })
        } else {
          const created = await addDoc(collection(db, REGISTER_COLLECTION), registerEntry)
          await updateDoc(ref, { registerId: created.id })
        }
      }

      await addDoc(collection(db, COL.activity), { submissionId: selected.id, action: action.record, comment: note, timestamp: now, userId: actorId })

      await addDoc(collection(db, COL.notifications), {
        userId: action.notify ?? notifyIdFor(action.department),
        content: `${action.record} — ${selected.companyName ?? selected.applicantName ?? "application"}${note.trim() ? `: ${note.trim()}` : ""}`,
        type: action.kind ?? "info",
        referenceId: selected.id,
        isRead: false,
        createdAt: now,
      })

      toast.success({ title: action.record, description: permit ? `Permit ${permit}` : selected.submissionId })
      close()
    } catch (err) {
      toast.error({ title: "Action not saved", description: err instanceof Error ? err.message : "Try again in a moment." })
    } finally {
      setBusy(false)
    }
  }

  const actions = selected ? (view.actionsFor?.(selected) ?? view.actions ?? []) : []
  const needsReason = actions.some((a) => a.requiresReason)
  const showQuery = selected?.deskQuery && ([STATUS.billingQueried, STATUS.paymentFlagged] as string[]).includes(selected.status ?? "")

  return (
    <>
      <Panel
        title={title}
        description={description}
        actions={views.length > 1 ? <Segmented value={view.value} onChange={setViewValue} options={views.map((v) => ({ value: v.value, label: v.label }))} /> : null}
        bodyClassName="p-0"
      >
        <div className="border-b border-border p-3 sm:px-5">
          <SearchField value={search} onChange={setSearch} placeholder="Search by company, reference, email or permit" />
        </div>
        <div className="p-3 sm:p-4">
          {error ? (
            <LoadFailed error={error} what="Applications" />
          ) : loading ? (
            <RowsSkeleton rows={6} columns={6} />
          ) : !visible.length ? (
            <EmptyState icon={Inbox} title={view.empty.title} description={view.empty.body} />
          ) : (
            <QueueTable rows={visible} view={view} onOpen={open} />
          )}
        </div>
      </Panel>

      <Sheet
        open={Boolean(selected)}
        onClose={close}
        title={draftActive && draft ? draft.title : "File review"}
        caption={selected ? `${selected.submissionId ?? selected.id} · ${selected.companyName ?? selected.applicantName ?? ""}` : ""}
        width={draftActive ? "max-w-4xl" : "max-w-2xl"}
        footer={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <ActionButton tone="quiet" onClick={close}>
              Close
            </ActionButton>
            {actions.map((a) => (
              <ActionButton key={a.key} tone={a.tone ?? "primary"} icon={a.icon} disabled={busy} onClick={() => run(a)}>
                {busy ? "Saving…" : a.label}
              </ActionButton>
            ))}
          </div>
        }
      >
        {selected ? (
          <div className="space-y-6">
            <StageTracker row={selected} />

            {selected.directorReason && isBlocked(selected.status) ? <Notice title="Reason given" body={selected.directorReason} /> : null}
            {showQuery ? <Notice title="Query raised" body={selected.deskQuery as string} /> : null}

            <ApplicationSummary row={selected} />
            {selected.measurements ? <LockedMeasurements m={selected.measurements} /> : null}

            {draftActive && draft && draftValue ? (
              <div>
                <SectionLabel>{draft.title}</SectionLabel>
                {draft.render(draftValue, (patch) => setDraftValue((prev) => ({ ...(prev as T), ...patch })), selected)}
              </div>
            ) : null}

            {extraDetail?.(selected)}
            <ExistingReports row={selected} />
            <Attachments row={selected} />
            <AuditTimeline row={selected} />

            <TextareaField
              id="queue-note"
              label={needsReason ? "Reason or note" : "Note for the next desk"}
              value={note}
              onChange={setNote}
              placeholder={needsReason ? "Required for declines, returns, queries and flags. Recorded on the file." : "Saved to the audit log and shown to whoever picks this up next."}
            />
          </div>
        ) : null}
      </Sheet>
    </>
  )
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-[hsl(var(--state-stop))]/30 bg-[hsl(var(--state-stop-soft))] px-4 py-3">
      <p className="text-[12.5px] font-semibold text-[hsl(var(--state-stop))]">{title}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-foreground">{body}</p>
    </div>
  )
}

export function StageTracker({ row }: { row: SubmissionRow }) {
  const stages = stagesFor(row.route)
  const current = stageIndex(row.route, row.status)
  const blocked = isBlocked(row.status)
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[12.5px] font-medium text-muted-foreground">{row.route === "first" ? "First-party route" : "Third-party route"}</p>
        <StatusPill status={row.status} />
      </div>
      <ol className="flex items-stretch gap-1">
        {stages.map((entry, index) => {
          const done = current > index
          const active = current === index && !blocked
          return (
            <li key={`${entry.label}-${index}`} className="min-w-0 flex-1">
              <span
                className={cn(
                  "block h-1 rounded-full",
                  blocked ? "bg-[hsl(var(--state-stop))]/30" : done ? "bg-[hsl(var(--state-clear))]" : active ? "bg-[hsl(var(--state-wait))]" : "bg-border",
                )}
              />
              <p className={cn("mt-1.5 truncate text-[10.5px] leading-tight", active ? "font-semibold text-foreground" : "text-muted-foreground")} title={`${entry.label} · ${entry.desk}`}>
                {done ? <Check className="mr-0.5 inline h-2.5 w-2.5" aria-hidden /> : null}
                {entry.label}
              </p>
            </li>
          )
        })}
      </ol>
      {blocked ? <p className="mt-2 text-[12px] text-[hsl(var(--state-stop))]">Held at the Director&rsquo;s decision. The applicant has to act first.</p> : null}
    </div>
  )
}

function QueueTable({ rows, view, onOpen }: { rows: SubmissionRow[]; view: QueueView; onOpen: (row: SubmissionRow) => void }) {
  return (
    <div className="overflow-x-auto scroll-slim">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-border text-[11.5px] font-semibold text-muted-foreground">
            <th className="px-3 py-2.5">Reference</th>
            <th className="px-3 py-2.5">Applicant</th>
            <th className="hidden px-3 py-2.5 md:table-cell">Type</th>
            <th className="hidden px-3 py-2.5 lg:table-cell">{view.column?.header ?? "Site"}</th>
            <th className="px-3 py-2.5">Status</th>
            <th className="hidden px-3 py-2.5 sm:table-cell">Received</th>
            <th className="px-3 py-2.5 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={`${row.route}-${row.id}`} style={{ ["--i" as string]: Math.min(i, 10) }} className="reveal border-b border-border/70 last:border-0 hover:bg-muted/50">
              <td className="px-3 py-3 font-mono text-[12px] text-muted-foreground">{row.submissionId ?? row.id.slice(0, 8)}</td>
              <td className="px-3 py-3">
                <p className="text-[13.5px] font-medium text-foreground">{row.companyName ?? row.applicantName ?? "—"}</p>
                <p className="text-[11.5px] text-muted-foreground">{row.primaryContactName ?? row.email ?? ""}</p>
              </td>
              <td className="hidden px-3 py-3 text-[13px] text-muted-foreground md:table-cell">
                {row.route === "first" ? "FP" : "3P"} · {truncate(typeLabel(row.applicationType), 22)}
              </td>
              <td className="hidden px-3 py-3 text-[12.5px] text-muted-foreground lg:table-cell">
                {view.column ? (
                  view.column.render(row)
                ) : row.gpsCoordinates ? (
                  <span className="inline-flex items-center gap-1 font-mono text-[11.5px]">
                    <MapPin className="h-3 w-3" />
                    {truncate(row.gpsCoordinates, 22)}
                  </span>
                ) : (
                  (row.areaCouncil ?? "—")
                )}
              </td>
              <td className="px-3 py-3">
                <StatusPill status={row.status} />
              </td>
              <td className="hidden px-3 py-3 text-[12.5px] text-muted-foreground sm:table-cell">{formatDate(row.createdAt)}</td>
              <td className="px-3 py-3 text-right">
                <ActionButton tone="quiet" onClick={() => onOpen(row)}>
                  Open
                </ActionButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ApplicationSummary({ row }: { row: SubmissionRow }) {
  return (
    <div>
      <SectionLabel>Application</SectionLabel>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Organisation" value={row.companyName ?? row.applicantName} />
        <Field label="Applicant type" value={row.applicantType ?? (row.route === "first" ? "First-Party" : "Third-Party Agency")} />
        <Field label="CAC number" value={row.cacRegistrationNumber ?? row.companyRegistrationNumber} mono />
        <Field label="TIN" value={row.tin} mono />
        <Field label="Contact" value={row.primaryContactName} />
        <Field label="Phone" value={row.primaryContactPhone ?? row.contactPhoneNumber} />
        <Field label="Email" value={row.primaryContactEmail ?? row.email} />
        <Field label="Area council" value={row.areaCouncil} />
        <Field label="Reference" value={row.submissionId} mono />
        <Field label="Received" value={formatDateTime(row.createdAt)} />
        {row.permitNumber ? <Field label="Permit number" value={row.permitNumber} mono /> : null}
        <Field label="Currently with" value={row.department} />
        <Field label="Corporate address" value={row.corporateAddress ?? row.companyAddress} className="col-span-2" />
        <Field label="Signage site" value={row.signageSiteAddress ?? row.addressLine1} className="col-span-2" />
        {row.gpsCoordinates ? <Field label="Declared coordinates" value={row.gpsCoordinates} mono className="col-span-2" /> : null}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 rounded-lg bg-muted/40 p-3.5">
        <Field label="Declared structure" value={typeLabel(row.applicationType)} />
        <Field label="Purpose" value={row.purposeOfApplication} />
        <Field label="Declared dimensions" value={row.signDimensions} />
        <Field label="Declared number of signs" value={row.numberOfSigns} />
        {row.practitionerName ? <Field label="Practitioner" value={row.practitionerName} /> : null}
        {row.practitionerLicenseNumber ? <Field label="Licence" value={row.practitionerLicenseNumber} mono /> : null}
      </div>
    </div>
  )
}

export function LockedMeasurements({ m }: { m: Measurements }) {
  return (
    <div>
      <SectionLabel>
        <span className="inline-flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5" /> Locked field parameters
        </span>
      </SectionLabel>
      <ul className="space-y-1.5 font-mono text-[12px] text-foreground">
        {m.items.map((item, i) => (
          <li key={item.id} className="rounded-md bg-muted/40 px-3 py-2">
            Structure {i + 1}: {typeLabel(item.type)} [{isLit(item.illumination) ? "Illuminated" : "Non-lit"}] | Dim: {item.height.toFixed(2)}m × {item.width.toFixed(2)}m
            {item.faces > 1 ? ` × ${item.faces} faces` : ""} | Area: {item.sqm.toFixed(2)} SQM
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[12.5px] text-muted-foreground">
        Total exposure <span className="font-semibold text-foreground">{m.totalSqm.toFixed(2)} SQM</span> · locked by{" "}
        {m.source === "business_development" ? "Business Development" : "Planning"} on {formatDateTime(m.lockedAt)}
      </p>
    </div>
  )
}

function ExistingReports({ row }: { row: SubmissionRow }) {
  const bd = row.businessDevelopmentReport as Record<string, unknown> | undefined
  const tech = row.technicalReport as Record<string, unknown> | undefined
  const billing = row.billing as Record<string, unknown> | undefined
  const payment = row.payment as Record<string, unknown> | undefined
  const declared = (payment?.declared ?? undefined) as Record<string, unknown> | undefined

  const bdPhotos =
    bd && Array.isArray(bd.signs) ? (bd.signs as Record<string, string>[]).flatMap((s) => [s.sitePhotoFront, s.sitePhotoContext]).filter(Boolean) : []

  return (
    <>
      {bd ? (
        <div>
          <SectionLabel>Business Development inspection</SectionLabel>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Inspected" value={formatDateTime(bd.inspectionTimestamp)} />
            <Field label="Officer" value={String(bd.assignedOfficerName || bd.assignedOfficerId || "")} />
            <Field label="Occupancy" value={String(bd.buildingOccupancyType ?? "")} />
            <Field label="Signs on site" value={String(bd.numberOfSignagesOnSite ?? "")} />
            <Field label="Field notes" value={String(bd.fieldNotes ?? "")} className="col-span-2" />
          </div>
          <PhotoGrid urls={bdPhotos as string[]} />
        </div>
      ) : null}

      {tech ? (
        <div>
          <SectionLabel>Planning technical vetting</SectionLabel>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Structure" value={typeLabel(String(tech.structureType ?? ""))} />
            <Field label="Foundation depth" value={tech.foundationDepthMeters ? `${tech.foundationDepthMeters} m` : ""} />
            <Field label="COREN engineer" value={String(tech.corenEngineerName ?? "")} />
            <Field label="COREN licence" value={String(tech.corenLicenseNumber ?? "")} mono />
            <Field label="Setback from road" value={tech.setbackFromRoadMeters ? `${tech.setbackFromRoadMeters} m` : ""} />
            <Field label="Clash detection" value={<StatusPill status={String(tech.clashDetectionStatus ?? "")} />} />
            <Field label="Traffic sightline" value={tech.trafficSightlineClearance ? "Clear" : "Not clear"} />
            <Field label="Utility lines" value={tech.utilityLineClearance ? "Clear" : "Not clear"} />
            {tech.structuralIntegrityCert ? (
              <Field
                label="Structural certificate"
                value={
                  <a className="text-accent underline-offset-4 hover:underline" href={String(tech.structuralIntegrityCert)} target="_blank" rel="noopener noreferrer">
                    Open
                  </a>
                }
              />
            ) : null}
            <Field label="Notes" value={String(tech.vettingNotes ?? "")} className="col-span-2" />
          </div>
        </div>
      ) : null}

      {billing && billing.netInvoiceAmount !== undefined ? (
        <div>
          <SectionLabel>Billing</SectionLabel>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Invoice" value={String(billing.invoiceNumber ?? "")} mono />
            <Field label="Cycle" value={`#${billing.cycle ?? 1} · ${String(billing.billingCycleType ?? "").replace(/_/g, " ")}`} />
            <Field label="Schedule" value={String(billing.scheduleName ?? "")} />
            <Field label="Zone" value={`${billing.zone ?? ""} (${billing.zoneMultiplier ?? ""}×)`} />
            <Field label="Base computation" value={naira(billing.baseComputation as number)} />
            <Field label="Illumination surcharge" value={naira(billing.illuminationSurcharge as number)} />
            <Field label="Penalty" value={naira(billing.penaltyLoadingFee as number)} />
            <Field label="Waiver" value={naira(billing.waiverAmount as number)} />
            <Field label="Net invoice" value={<span className="figure text-[16px] font-semibold">{naira(billing.netInvoiceAmount as number)}</span>} />
            <Field label="Validity" value={`${formatDate(billing.subscriptionStartDate)} → ${formatDate(billing.subscriptionExpiryDate)}`} />
          </div>
        </div>
      ) : null}

      {payment && (declared || payment.reconciliationStatus) ? (
        <div>
          <SectionLabel>Payment</SectionLabel>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Declared RRR" value={String(declared?.rrr ?? "")} mono />
            <Field label="Declared amount" value={naira(declared?.amount as number)} />
            <Field label="Verified RRR" value={String(payment.remitaRrr ?? "")} mono />
            <Field label="Amount credited" value={naira(payment.amountCredited as number)} />
            <Field label="Ledger" value={String(payment.financeLedgerCode ?? "")} />
            <Field label="Reconciliation" value={<StatusPill status={String(payment.reconciliationStatus ?? "Unverified")} />} />
            {Number(payment.balanceDue) > 0 ? <Field label="Balance due" value={naira(payment.balanceDue as number)} /> : null}
          </div>
        </div>
      ) : null}
    </>
  )
}

export function PhotoGrid({ urls }: { urls: string[] }) {
  if (!urls?.length) return null
  return (
    <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
      {urls.map((url, i) => (
        <a key={`${url}-${i}`} href={url} target="_blank" rel="noopener noreferrer" className="aspect-square overflow-hidden rounded-lg border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={`Site photograph ${i + 1}`} loading="lazy" className="h-full w-full object-cover" />
        </a>
      ))}
    </div>
  )
}

function Attachments({ row }: { row: SubmissionRow }) {
  const source = row.files ?? row.documents
  if (!source) return null
  const entries = Object.entries(source).filter(([, v]) => typeof v === "string" && v)
  if (!entries.length) return null
  return (
    <div>
      <SectionLabel>Documents</SectionLabel>
      <ul className="space-y-2">
        {entries.map(([key, url]) => (
          <li key={key} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3.5 py-2.5">
            <span className="text-[13px] font-medium text-foreground">{labelise(key)}</span>
            <a href={String(url)} target="_blank" rel="noopener noreferrer" className="text-[12.5px] font-semibold text-accent underline-offset-4 hover:underline">
              Open
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function labelise(key: string) {
  const spaced = key.replace(/([A-Z])/g, " $1").replace(/[_-]+/g, " ").trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase()
}
DOAS_EOF

# ============================================================================
w components/public/application-form.tsx <<'DOAS_EOF'
"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { addDoc, arrayUnion, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore"
import { getDownloadURL, ref, uploadBytes } from "firebase/storage"
import { AlertTriangle, ChevronLeft, ChevronRight, FileText, Loader2, Paperclip, Send } from "lucide-react"
import { COL, db, storage } from "@/lib/firebase"
import { AREA_COUNCILS, DEPARTMENT, STATUS } from "@/lib/workflow"
import { SIGN_TYPES, STRUCTURE_TYPES } from "@/lib/tariff"
import { findSubmission, isEditable } from "@/lib/applicant"
import { toast } from "@/components/ui/toast"
import { ActionButton, FieldGrid, SelectField, TextField, TextareaField } from "@/components/dashboard/form-kit"
import { Panel, StatusPill } from "@/components/dashboard/kit"
import { cn } from "@/lib/utils"

type FieldKind = "text" | "tel" | "email" | "number" | "select" | "textarea"
type Check = "email" | "ngPhone" | "cac" | "tin" | "positiveInt"

interface FieldDef {
  name: string
  label: string
  kind: FieldKind
  required?: boolean
  placeholder?: string
  hint?: string
  options?: { value: string; label: string }[]
  span?: boolean
  mono?: boolean
  check?: Check
}

interface DocDef {
  name: string
  label: string
  accept: string
  required?: boolean
}

export interface FormStep {
  id: string
  title: string
  fields?: FieldDef[]
  documents?: DocDef[]
}

const opts = (list: string[]) => list.map((v) => ({ value: v, label: v }))

const CHECKS: Record<Check, { test: (v: string) => boolean; message: string }> = {
  email: { test: (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), message: "Enter a valid email address" },
  ngPhone: { test: (v) => /^(\+?234|0)[789][01]\d{8}$/.test(v.replace(/[\s-]/g, "")), message: "Use a Nigerian number, e.g. 0803 000 0000 or +234 803 000 0000" },
  cac: { test: (v) => /^(RC|BN)-?\d{4,8}$/i.test(v.trim()), message: "Format RC-XXXXXX or BN-XXXXXX" },
  tin: { test: (v) => /^\d{10,12}$/.test(v.replace(/[\s-]/g, "")), message: "TIN is 10–12 digits" },
  positiveInt: { test: (v) => /^\d+$/.test(v) && Number(v) > 0, message: "Enter a whole number above zero" },
}

const ORGANISATION_FIELDS: FieldDef[] = [
  { name: "companyName", label: "Company name", kind: "text", required: true },
  { name: "cacRegistrationNumber", label: "CAC registration number", kind: "text", required: true, mono: true, placeholder: "RC-123456", check: "cac" },
  { name: "tin", label: "Tax identification number (TIN)", kind: "text", required: true, mono: true, placeholder: "10–12 digits", check: "tin" },
  { name: "corporateAddress", label: "Corporate address", kind: "textarea", required: true, span: true },
  { name: "primaryContactName", label: "Primary contact name", kind: "text", required: true },
  { name: "primaryContactPhone", label: "Primary contact phone", kind: "tel", required: true, placeholder: "0803 000 0000", check: "ngPhone" },
  { name: "primaryContactEmail", label: "Primary contact email", kind: "email", required: true, check: "email" },
]

const SITE_FIELDS = (route: "first" | "third"): FieldDef[] => [
  { name: "signageSiteAddress", label: "Signage site address", kind: "textarea", required: true, span: true },
  { name: "areaCouncil", label: "Area council", kind: "select", required: true, options: opts(AREA_COUNCILS) },
  { name: "gpsCoordinates", label: "GPS coordinates", kind: "text", mono: true, placeholder: "9.0765, 7.3986", hint: "Optional. The inspecting officer records exact coordinates on site." },
  { name: "purposeOfApplication", label: "Purpose", kind: "select", required: true, options: opts(["New Sign", "Upgrading of Existing Sign", "Change of Existing Sign"]) },
  { name: "applicationType", label: route === "first" ? "Main sign type" : "Structure type", kind: "select", required: true, options: route === "first" ? SIGN_TYPES : STRUCTURE_TYPES },
  { name: "numberOfSigns", label: "Number of signs", kind: "number", required: true, check: "positiveInt" },
  { name: "signDimensions", label: "Declared dimensions", kind: "text", required: true, placeholder: "4m × 6m", hint: "Verified and locked by the field desk." },
]

const PRACTITIONER_FIELDS: FieldDef[] = [
  { name: "practitionerName", label: "Practitioner name", kind: "text", required: true },
  { name: "practitionerLicenseNumber", label: "DOAS licence number", kind: "text", required: true, mono: true },
]

const COMMON_DOCS: DocDef[] = [
  { name: "cacCertificate", label: "CAC certificate (PDF)", accept: ".pdf", required: true },
  { name: "applicationLetter", label: "Application letter (PDF)", accept: ".pdf", required: true },
  { name: "siteLayoutPlan", label: "Site layout plan (PDF or JPEG)", accept: ".pdf,.jpg,.jpeg", required: true },
]

export const FIRST_PARTY_STEPS: FormStep[] = [
  { id: "organisation", title: "Organisation", fields: ORGANISATION_FIELDS },
  { id: "site", title: "Signage site", fields: SITE_FIELDS("first") },
  { id: "documents", title: "Documents", documents: COMMON_DOCS },
]

export const THIRD_PARTY_STEPS: FormStep[] = [
  { id: "organisation", title: "Client organisation", fields: ORGANISATION_FIELDS },
  { id: "site", title: "Billboard site", fields: SITE_FIELDS("third") },
  { id: "practitioner", title: "Practitioner", fields: PRACTITIONER_FIELDS },
  {
    id: "documents",
    title: "Documents",
    documents: [
      ...COMMON_DOCS,
      { name: "practitionerLicense", label: "Practitioner licence", accept: ".pdf,.jpg,.jpeg,.png", required: true },
      { name: "structuralDrawings", label: "Structural drawings (optional)", accept: ".pdf,.dwg,.dxf" },
    ],
  },
]

function reference(route: "first" | "third") {
  return `${route === "first" ? "FP" : "TP"}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

export function ApplicationForm({ route, steps, title, intro }: { route: "first" | "third"; steps: FormStep[]; title: string; intro: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const editingRef = params.get("id")

  const [stepIndex, setStepIndex] = React.useState(0)
  const [values, setValues] = React.useState<Record<string, string>>({})
  const [files, setFiles] = React.useState<Record<string, File | null>>({})
  const [existingUrls, setExistingUrls] = React.useState<Record<string, string>>({})
  const [existing, setExisting] = React.useState<Awaited<ReturnType<typeof findSubmission>>>(null)
  const [loading, setLoading] = React.useState(Boolean(editingRef))
  const [submitting, setSubmitting] = React.useState(false)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  const allFields = React.useMemo(() => steps.flatMap((s) => s.fields ?? []), [steps])

  React.useEffect(() => {
    if (!editingRef) return
    let cancelled = false
    findSubmission(editingRef)
      .then((found) => {
        if (cancelled) return
        if (!found) {
          toast.error({ title: "Application not found", description: `No application matches ${editingRef}.` })
          setLoading(false)
          return
        }
        if (!isEditable(found.data.status)) {
          toast.warning({ title: "This application can't be edited", description: "It has moved past screening." })
          router.push(`/submission-status?id=${editingRef}`)
          return
        }
        setExisting(found)
        const loaded: Record<string, string> = {}
        allFields.forEach((f) => (loaded[f.name] = String(found.data[f.name] ?? "")))
        setValues(loaded)
        setExistingUrls(found.data.files ?? {})
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingRef])

  const set = (name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => {
      if (!prev[name]) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
  }

  const validateStep = (index: number) => {
    const found: Record<string, string> = {}
    ;(steps[index].fields ?? []).forEach((f) => {
      const v = (values[f.name] ?? "").trim()
      if (f.required && !v) found[f.name] = "Required"
      else if (v && f.check && !CHECKS[f.check].test(v)) found[f.name] = CHECKS[f.check].message
    })
    ;(steps[index].documents ?? []).forEach((d) => {
      if (d.required && !files[d.name] && !existingUrls[d.name]) found[d.name] = "This document is required"
    })
    setErrors(found)
    if (Object.keys(found).length) {
      toast.warning({ title: "Some fields need attention", description: "Fix the highlighted items before continuing." })
      return false
    }
    return true
  }

  const uploadDocs = async (submissionRef: string) => {
    const urls: Record<string, string> = { ...existingUrls }
    for (const [key, file] of Object.entries(files)) {
      if (!file) continue
      const target = ref(storage, `submissions/${submissionRef}/${key}-${file.name.replace(/\s+/g, "-")}`)
      await uploadBytes(target, file, { contentType: file.type })
      urls[key] = await getDownloadURL(target)
    }
    return urls
  }

  const submit = async () => {
    for (let i = 0; i < steps.length; i += 1) {
      if (!validateStep(i)) {
        setStepIndex(i)
        return
      }
    }
    setSubmitting(true)
    const submissionId = existing?.data.submissionId ?? reference(route)
    const now = new Date().toISOString()

    try {
      const fileUrls = await uploadDocs(submissionId)
      const clean = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()]))
      const cac = (clean.cacRegistrationNumber ?? "").toUpperCase()
      const payload: Record<string, unknown> = {
        ...clean,
        cacRegistrationNumber: cac,
        tin: (clean.tin ?? "").replace(/\D/g, ""),
        applicantType: route === "first" ? "First-Party" : "Third-Party Agency",
        // Legacy aliases — the register, search and notifications read these.
        applicantName: clean.companyName,
        email: clean.primaryContactEmail,
        contactPhoneNumber: clean.primaryContactPhone,
        addressLine1: clean.signageSiteAddress,
        companyAddress: clean.corporateAddress,
        companyRegistrationNumber: cac,
        submissionId,
        isFirstParty: route === "first",
        status: STATUS.withCsu,
        department: DEPARTMENT.csu,
        files: fileUrls,
        updatedAt: now,
      }

      if (existing) {
        await updateDoc(doc(db, existing.collectionName, existing.docId), {
          ...payload,
          directorReason: "",
          resubmittedAt: now,
          comments: arrayUnion({ timestamp: now, desk: "applicant", action: "Updated and resubmitted by applicant", to: DEPARTMENT.csu, status: STATUS.withCsu }),
        })
      } else {
        await addDoc(collection(db, route === "first" ? COL.firstParty : COL.thirdParty), {
          ...payload,
          createdAt: serverTimestamp(),
          comments: [{ timestamp: now, desk: "applicant", action: "File opened via portal upload", to: DEPARTMENT.csu, status: STATUS.withCsu }],
        })
      }

      await addDoc(collection(db, COL.notifications), {
        userId: "csu",
        content: existing ? `${clean.companyName} has updated application ${submissionId}` : `New ${route === "first" ? "first-party" : "third-party"} application from ${clean.companyName}`,
        type: "submission",
        referenceId: submissionId,
        isRead: false,
        createdAt: now,
      })

      toast.success({ title: existing ? "Application updated" : "Application submitted", description: `Keep your reference: ${submissionId}`, duration: 9000 })
      router.push(`/submission-status?id=${submissionId}`)
    } catch (err) {
      toast.error({ title: "Submission failed", description: err instanceof Error ? err.message : "Check your connection and try again." })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const step = steps[stepIndex]
  const last = stepIndex === steps.length - 1

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="mx-auto w-full max-w-3xl px-4">
        <header className="mb-6">
          <h1 className="font-display text-[26px] font-semibold text-foreground sm:text-[30px]">{title}</h1>
          <p className="mt-1 max-w-[62ch] text-[13.5px] leading-relaxed text-muted-foreground">{intro}</p>
        </header>

        {existing ? (
          <div className="mb-5 rounded-xl border border-[hsl(var(--state-wait))]/35 bg-[hsl(var(--state-wait-soft))] p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--state-wait))]" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[13.5px] font-semibold text-foreground">Editing {existing.data.submissionId}</p>
                  <StatusPill status={existing.data.status} />
                </div>
                {existing.data.directorReason ? (
                  <p className="mt-2 text-[13px] leading-relaxed text-foreground">
                    <span className="font-semibold">What to change: </span>
                    {existing.data.directorReason}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <ol className="mb-5 flex items-stretch gap-1">
          {steps.map((entry, index) => (
            <li key={entry.id} className="min-w-0 flex-1">
              <button type="button" onClick={() => index < stepIndex && setStepIndex(index)} className="w-full text-left" disabled={index > stepIndex}>
                <span className={cn("block h-1 rounded-full", index < stepIndex ? "bg-[hsl(var(--state-clear))]" : index === stepIndex ? "bg-[hsl(var(--state-wait))]" : "bg-border")} />
                <span className={cn("mt-1.5 block truncate text-[11px]", index === stepIndex ? "font-semibold text-foreground" : "text-muted-foreground")}>{entry.title}</span>
              </button>
            </li>
          ))}
        </ol>

        <Panel title={step.title} bodyClassName="p-4 sm:p-5">
          {step.fields ? (
            <FieldGrid>
              {step.fields.map((f) => {
                const label = f.required ? `${f.label} *` : f.label
                const value = values[f.name] ?? ""
                return (
                  <div key={f.name} className={cn(f.span && "sm:col-span-2")}>
                    {f.kind === "select" ? (
                      <SelectField id={f.name} label={label} value={value} onChange={(v) => set(f.name, v)} hint={f.hint} options={f.options ?? []} />
                    ) : f.kind === "textarea" ? (
                      <TextareaField id={f.name} label={label} value={value} onChange={(v) => set(f.name, v)} hint={f.hint} placeholder={f.placeholder} span={false} />
                    ) : (
                      <TextField
                        id={f.name}
                        label={label}
                        type={f.kind === "number" ? "text" : (f.kind as "text" | "email" | "tel")}
                        value={value}
                        onChange={(v) => set(f.name, v)}
                        hint={f.hint}
                        placeholder={f.placeholder}
                        mono={f.mono}
                      />
                    )}
                    {errors[f.name] ? <p className="mt-1 text-[11.5px] font-medium text-[hsl(var(--state-stop))]">{errors[f.name]}</p> : null}
                  </div>
                )
              })}
            </FieldGrid>
          ) : null}

          {step.documents ? (
            <div className="space-y-3">
              <p className="text-[13px] text-muted-foreground">Up to 10 MB each. Items marked * are required.</p>
              {step.documents.map((d) => {
                const picked = files[d.name]
                const already = existingUrls[d.name]
                return (
                  <div key={d.name}>
                    <div className="flex flex-col gap-2 rounded-lg border border-border px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <label htmlFor={d.name} className="text-[13.5px] font-medium text-foreground">
                          {d.label}
                          {d.required ? " *" : ""}
                        </label>
                        <p className="mt-0.5 text-[12px] text-muted-foreground">{picked ? `${picked.name} · ready to upload` : already ? "Already uploaded" : "Not uploaded yet"}</p>
                      </div>
                      <label htmlFor={d.name} className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] font-semibold hover:bg-muted">
                        <Paperclip className="h-3.5 w-3.5" />
                        {already || picked ? "Replace" : "Choose file"}
                        <input
                          id={d.name}
                          type="file"
                          accept={d.accept}
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0] ?? null
                            if (file && file.size > 10 * 1024 * 1024) {
                              toast.warning({ title: "File too large", description: `${file.name} is over 10 MB.` })
                              return
                            }
                            setFiles((prev) => ({ ...prev, [d.name]: file }))
                            setErrors((prev) => ({ ...prev, [d.name]: "" }))
                          }}
                        />
                      </label>
                    </div>
                    {errors[d.name] ? <p className="mt-1 text-[11.5px] font-medium text-[hsl(var(--state-stop))]">{errors[d.name]}</p> : null}
                  </div>
                )
              })}
            </div>
          ) : null}

          <div className="mt-6 flex items-center justify-between gap-2 border-t border-border pt-4">
            <ActionButton tone="quiet" icon={ChevronLeft} disabled={stepIndex === 0} onClick={() => setStepIndex((i) => Math.max(0, i - 1))}>
              Back
            </ActionButton>
            {last ? (
              <ActionButton icon={submitting ? Loader2 : Send} disabled={submitting} onClick={submit}>
                {submitting ? "Submitting…" : existing ? "Resubmit application" : "Submit application"}
              </ActionButton>
            ) : (
              <ActionButton
                icon={ChevronRight}
                onClick={() => {
                  if (validateStep(stepIndex)) setStepIndex((i) => i + 1)
                }}
              >
                Continue
              </ActionButton>
            )}
          </div>
        </Panel>

        <p className="mt-4 flex items-start gap-2 text-[12.5px] leading-relaxed text-muted-foreground">
          <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          You&rsquo;ll get a reference number when you submit. It&rsquo;s how you track progress, pay and renew.
        </p>
      </div>
    </div>
  )
}
DOAS_EOF

# ============================================================================
w app/submission-status/page.tsx <<'DOAS_EOF'
"use client"

import * as React from "react"
import { Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { addDoc, arrayUnion, collection, doc, updateDoc } from "firebase/firestore"
import { getDownloadURL, ref, uploadBytes } from "firebase/storage"
import { ArrowRight, Check, Home, Loader2, Paperclip, PencilLine, Search, Upload } from "lucide-react"
import { COL, db, storage } from "@/lib/firebase"
import { DEPARTMENT, MEETING_STAGES, MEETING_STATUS, STATUS, meetingDecided, meetingStageIndex, stage, stageIndex, stagesFor } from "@/lib/workflow"
import { typeLabel } from "@/lib/tariff"
import { applicantMessage, awaitingPayment, findRecord, isEditable, meetingMessage, type FoundRecord } from "@/lib/applicant"
import { formatDate, formatDateTime, naira } from "@/lib/format"
import { toast } from "@/components/ui/toast"
import { ActionButton, FieldGrid, SelectField, TextField } from "@/components/dashboard/form-kit"
import { Field, Panel, SectionLabel, StatusPill, TONE } from "@/components/dashboard/kit"
import { cn } from "@/lib/utils"

const INVOICE_VISIBLE = [...stage("awaitingPayment"), ...stage("paymentFlagged"), ...stage("paymentReconciled"), ...stage("issued")]

interface BillLineView {
  id: string
  type: string
  sqm: number
  base: number
  surcharge: number
}

function StatusPageInner() {
  const params = useSearchParams()
  const [reference, setReference] = React.useState(params.get("id") ?? "")
  const [looking, setLooking] = React.useState(false)
  const [found, setFound] = React.useState<FoundRecord | null>(null)
  const [missing, setMissing] = React.useState(false)
  const [proof, setProof] = React.useState<File | null>(null)
  const [rrr, setRrr] = React.useState("")
  const [amount, setAmount] = React.useState("")
  const [channel, setChannel] = React.useState("Remita_Portal")
  const [uploading, setUploading] = React.useState(false)

  const lookUp = React.useCallback(async (value: string) => {
    if (!value.trim()) return
    setLooking(true)
    setMissing(false)
    try {
      const result = await findRecord(value)
      setFound(result)
      setMissing(!result)
    } catch (err) {
      toast.error({ title: "Lookup failed", description: err instanceof Error ? err.message : "Try again." })
    } finally {
      setLooking(false)
    }
  }, [])

  React.useEffect(() => {
    const initial = params.get("id")
    if (initial) lookUp(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const declare = async () => {
    if (!found || found.kind !== "application") return
    const digits = rrr.replace(/\D/g, "")
    if (digits.length !== 12) return toast.warning({ title: "Check the RRR", description: "A Remita RRR is 12 digits." })
    if (!(Number(amount) > 0)) return toast.warning({ title: "Enter the amount paid" })
    if (!proof) return toast.warning({ title: "Attach your receipt" })

    setUploading(true)
    const now = new Date().toISOString()
    try {
      const target = ref(storage, `submissions/${found.data.submissionId}/payment-proof-${Date.now()}-${proof.name.replace(/\s+/g, "-")}`)
      await uploadBytes(target, proof, { contentType: proof.type })
      const url = await getDownloadURL(target)

      // Only the declaration is written here — Finance verifies it.
      await updateDoc(doc(db, found.collectionName, found.docId), {
        "payment.declared": { rrr: digits, amount: Number(amount), channel, proofUrl: url, declaredAt: now },
        updatedAt: now,
        comments: arrayUnion({ timestamp: now, desk: "applicant", action: `Payment proof uploaded (RRR ${digits})`, to: DEPARTMENT.finance }),
      })
      await addDoc(collection(db, COL.notifications), {
        userId: "finance",
        content: `Payment proof (RRR ${digits}, ${naira(Number(amount))}) uploaded for ${found.data.submissionId}`,
        type: "info",
        referenceId: found.docId,
        isRead: false,
        createdAt: now,
      })
      toast.success({ title: "Proof sent to Finance", description: "They'll verify it against the bank record." })
      setProof(null)
      await lookUp(found.data.submissionId)
    } catch (err) {
      toast.error({ title: "Upload failed", description: err instanceof Error ? err.message : "Try again." })
    } finally {
      setUploading(false)
    }
  }

  const data = found?.data
  const isMeeting = found?.kind === "meeting"
  const route = found?.kind === "application" ? found.route : "first"
  const message = !data ? null : isMeeting ? meetingMessage(data.status) : applicantMessage(data.status, route)
  const stages: { label: string }[] = !found ? [] : isMeeting ? MEETING_STAGES : stagesFor(route)
  const current = !found ? -1 : isMeeting ? meetingStageIndex(data?.status) : stageIndex(route, data?.status)
  const blocked = isMeeting
    ? (data?.status ?? "").toLowerCase() === MEETING_STATUS.declined
    : message?.tone === "stop" && data?.status !== STATUS.partPayment && data?.status !== STATUS.paymentFlagged
  const billing = data?.billing ?? {}
  const payment = data?.payment ?? {}
  const formPath = route === "first" ? "first-party" : "third-party"

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="mx-auto w-full max-w-3xl px-4">
        <header className="mb-6">
          <h1 className="font-display text-[26px] font-semibold text-foreground sm:text-[30px]">Track your application</h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground">Applications look like FP-… or TP-…, meeting requests like MR-….</p>
        </header>

        <Panel bodyClassName="p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && lookUp(reference)}
              placeholder="Your reference"
              className="flex-1 rounded-lg border border-input bg-card px-3.5 py-2.5 font-mono text-[13.5px] outline-none focus:border-ring"
            />
            <ActionButton icon={looking ? Loader2 : Search} onClick={() => lookUp(reference)} disabled={looking || !reference.trim()}>
              {looking ? "Checking…" : "Check"}
            </ActionButton>
          </div>
          {missing ? <p className="mt-3 text-[13px] text-[hsl(var(--state-stop))]">No record matches that reference. It&rsquo;s case sensitive.</p> : null}
        </Panel>

        {found && data && message ? (
          <div className="mt-4 space-y-4">
            <Panel bodyClassName="p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-[18px] font-semibold text-foreground">{message.headline}</p>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">{message.body}</p>
                </div>
                <StatusPill status={data.status} />
              </div>
              <ol className="mt-5 flex items-stretch gap-1">
                {stages.map((entry, index) => {
                  const done = current > index
                  const active = current === index && !blocked
                  return (
                    <li key={`${entry.label}-${index}`} className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block h-1 rounded-full",
                          blocked ? "bg-[hsl(var(--state-stop))]/30" : done ? "bg-[hsl(var(--state-clear))]" : active ? "bg-[hsl(var(--state-wait))]" : "bg-border",
                        )}
                      />
                      <p className={cn("mt-1.5 truncate text-[10.5px]", active ? "font-semibold text-foreground" : "text-muted-foreground")}>
                        {done ? <Check className="mr-0.5 inline h-2.5 w-2.5" /> : null}
                        {entry.label}
                      </p>
                    </li>
                  )
                })}
              </ol>
            </Panel>

            {isMeeting ? (
              <Panel title="Your request" bodyClassName="p-4 sm:p-5">
                {meetingDecided(data.status) ? (
                  <p className="mb-4 rounded-lg bg-muted/50 px-3.5 py-3 text-[13.5px] text-foreground">
                    <span className="font-semibold">The Director&rsquo;s decision: </span>
                    {data.directorComment || (blocked ? "No reason given — contact Customer Service." : "Approved. Customer Service will confirm the time.")}
                  </p>
                ) : null}
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Reference" value={data.requestId ?? data.submissionId} mono />
                  <Field label="Submitted" value={formatDateTime(data.createdAt)} />
                  <Field label="Name" value={data.fullName} />
                  <Field label="Organisation" value={data.organization} />
                  <Field label="Preferred date" value={formatDate(data.preferredDate)} />
                  <Field label="Preferred time" value={data.preferredTime} />
                  <Field label="Purpose" value={data.purpose} className="col-span-2" />
                </div>
              </Panel>
            ) : null}

            {!isMeeting && data.directorReason && blocked ? (
              <div className="rounded-xl border border-[hsl(var(--state-stop))]/30 bg-[hsl(var(--state-stop-soft))] p-4 sm:p-5">
                <p className="text-[12.5px] font-semibold text-[hsl(var(--state-stop))]">
                  {data.status === STATUS.changesRequested ? "What you need to change" : "Why this was declined"}
                </p>
                <p className="mt-1.5 text-[14px] text-foreground">{data.directorReason}</p>
                <Link
                  href={isEditable(data.status) ? `/submissions/${formPath}?id=${data.submissionId}` : `/submissions/${formPath}`}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[13px] font-semibold text-primary-foreground"
                >
                  {isEditable(data.status) ? (
                    <>
                      <PencilLine className="h-4 w-4" /> Update and resubmit
                    </>
                  ) : (
                    <>
                      File a new application <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </Link>
              </div>
            ) : null}

            {!isMeeting && INVOICE_VISIBLE.includes(data.status) && (billing.netInvoiceAmount !== undefined || billing.totalAmount !== undefined) ? (
              <Panel title="Your invoice" bodyClassName="p-4 sm:p-5">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Invoice number" value={billing.invoiceNumber} mono />
                  <Field label="Billing cycle" value={String(billing.billingCycleType ?? "Annual").replace(/_/g, " ")} />
                  <Field label="Total measured area" value={billing.totalSqm ? `${Number(billing.totalSqm).toFixed(2)} m²` : "—"} />
                  <Field label="Permit validity" value={billing.subscriptionStartDate ? `${formatDate(billing.subscriptionStartDate)} → ${formatDate(billing.subscriptionExpiryDate)}` : "—"} />
                </div>
                {Array.isArray(billing.lines) ? (
                  <table className="mt-4 w-full text-left text-[12.5px]">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="py-1.5">Sign</th>
                        <th className="py-1.5 text-right">Area</th>
                        <th className="py-1.5 text-right">Charge</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(billing.lines as BillLineView[]).map((l) => (
                        <tr key={l.id} className="border-b border-border/60">
                          <td className="py-1.5">
                            {l.id} {typeLabel(l.type)}
                          </td>
                          <td className="py-1.5 text-right">{l.sqm.toFixed(2)} m²</td>
                          <td className="py-1.5 text-right">{naira(l.base + l.surcharge)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
                {billing.invoiceNarration ? <p className="mt-3 text-[12.5px] text-muted-foreground">{billing.invoiceNarration}</p> : null}
                <div className="mt-4 flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                  <span className="text-[13px] font-medium text-muted-foreground">Total due</span>
                  <span className="figure text-[22px] font-semibold text-foreground">{naira(billing.netInvoiceAmount ?? billing.totalAmount)}</span>
                </div>

                {data.status === STATUS.partPayment ? (
                  <p className="mt-3 rounded-lg bg-[hsl(var(--state-stop-soft))] px-3.5 py-2.5 text-[13px] text-[hsl(var(--state-stop))]">
                    Finance recorded {naira(payment.amountCredited)}. Balance outstanding: <strong>{naira(payment.balanceDue)}</strong>.
                  </p>
                ) : null}

                {awaitingPayment(data.status) ? (
                  <div className="mt-4 border-t border-border pt-4">
                    <SectionLabel>Declare your payment</SectionLabel>
                    {payment.declared ? (
                      <p className="mb-3 text-[12.5px] text-muted-foreground">
                        Last declared: RRR {payment.declared.rrr} · {naira(payment.declared.amount)} · {formatDateTime(payment.declared.declaredAt)}. Upload again only for a new payment.
                      </p>
                    ) : null}
                    <FieldGrid columns={3}>
                      <TextField id="rrr" label="Remita RRR" mono value={rrr} placeholder="2209-1108-4432" onChange={setRrr} />
                      <TextField id="amt" label="Amount paid (₦)" value={amount} onChange={setAmount} />
                      <SelectField
                        id="channel"
                        label="Paid via"
                        value={channel}
                        onChange={setChannel}
                        options={[
                          { value: "Remita_Portal", label: "Remita portal" },
                          { value: "Bank_Branch", label: "Bank branch" },
                          { value: "FCTA_Direct_Settlement", label: "FCTA direct settlement" },
                        ]}
                      />
                    </FieldGrid>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[13px] font-semibold hover:bg-muted">
                        <Paperclip className="h-3.5 w-3.5" />
                        {proof ? "Change receipt" : "Attach receipt"}
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => setProof(e.target.files?.[0] ?? null)} />
                      </label>
                      {proof ? <span className="truncate text-[12.5px] text-muted-foreground">{proof.name}</span> : null}
                      <ActionButton icon={uploading ? Loader2 : Upload} disabled={uploading} onClick={declare}>
                        {uploading ? "Sending…" : "Send to Finance"}
                      </ActionButton>
                    </div>
                  </div>
                ) : null}
              </Panel>
            ) : null}

            {!isMeeting && data.permitNumber ? (
              <Panel bodyClassName="p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[12.5px] text-muted-foreground">Permit number</p>
                    <p className="font-display text-[18px] font-semibold text-foreground">{data.permitNumber}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[12.5px] text-muted-foreground">Valid</p>
                    <p className={cn("text-[15px] font-semibold", TONE.clear.text)}>
                      {formatDate(data.startsAt ?? data.approvedAt)} → {formatDate(data.expiresAt)}
                    </p>
                  </div>
                </div>
              </Panel>
            ) : null}

            {!isMeeting ? (
              <Panel title="What you filed" bodyClassName="p-4 sm:p-5">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Reference" value={data.submissionId} mono />
                  <Field label="Filed on" value={formatDateTime(data.createdAt)} />
                  <Field label="Organisation" value={data.companyName ?? data.applicantName} />
                  <Field label="Applicant type" value={data.applicantType} />
                  <Field label="CAC" value={data.cacRegistrationNumber ?? data.companyRegistrationNumber} mono />
                  <Field label="Contact" value={data.primaryContactName} />
                  <Field label="Phone" value={data.primaryContactPhone ?? data.contactPhoneNumber} />
                  <Field label="Area council" value={data.areaCouncil} />
                  <Field label="Structure" value={typeLabel(data.applicationType)} />
                  <Field label="Declared dimensions" value={data.signDimensions} />
                  <Field label="Site" value={data.signageSiteAddress ?? data.addressLine1} className="col-span-2" />
                </div>
                {isEditable(data.status) && !blocked ? (
                  <Link
                    href={`/submissions/${formPath}?id=${data.submissionId}`}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[13px] font-semibold hover:bg-muted"
                  >
                    <PencilLine className="h-4 w-4" /> Edit application
                  </Link>
                ) : null}
              </Panel>
            ) : null}

            <Link href="/" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
              <Home className="h-3.5 w-3.5" /> Back to home
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default function SubmissionStatusPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <StatusPageInner />
    </Suspense>
  )
}
DOAS_EOF

# ============================================================================
w components/business-development/site-visit-panel.tsx <<'DOAS_EOF'
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
DOAS_EOF

# ============================================================================
w components/planning/review-panel.tsx <<'DOAS_EOF'
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
DOAS_EOF

# ============================================================================
w components/billing/billing-panels.tsx <<'DOAS_EOF'
"use client"

import * as React from "react"
import { addDoc, arrayUnion, collection, doc, getDoc, limit, orderBy, updateDoc, writeBatch } from "firebase/firestore"
import { AlertTriangle, CalendarClock, Forward, RefreshCcw, Save, Undo2 } from "lucide-react"
import { COL, db } from "@/lib/firebase"
import { DEPARTMENT, REGISTER_COLLECTION, STATUS, TARIFF_COLLECTION, daysUntil, invoiceNumber, parseDate, isoDate, stage, todayISO } from "@/lib/workflow"
import {
  CYCLE_TYPES,
  DEFAULT_SCHEDULE,
  SIGN_TYPES,
  STRUCTURE_TYPES,
  ZONES,
  computeBill,
  expiryFor,
  suggestZone,
  typeLabel,
  useTariffSchedules,
  zoneById,
  type CycleType,
  type MeasuredItem,
  type Measurements,
  type ZoneId,
} from "@/lib/tariff"
import { useRealtimeCollection } from "@/hooks/use-firestore"
import { formatDate, naira } from "@/lib/format"
import { toast } from "@/components/ui/toast"
import { Sheet } from "@/components/dashboard/sheet"
import { ActionButton, FieldGrid, NumberField, SearchField, SelectField, TextField, TextareaField } from "@/components/dashboard/form-kit"
import { EmptyState, LoadFailed, Panel, RowsSkeleton, SectionLabel, StatusPill, TONE } from "@/components/dashboard/kit"
import { Segmented } from "@/components/dashboard/notifications-panel"
import { WorkQueue, collectionFor, type QueueDraft, type SubmissionRow } from "@/components/dashboard/work-queue"
import { cn } from "@/lib/utils"

/* ================= Billing assessment ================= */

interface BillingDraft extends Record<string, unknown> {
  scheduleId: string
  scheduleName: string
  rates: Record<string, number>
  illuminationSurchargePct: number
  applyIllumination: boolean
  zone: ZoneId
  zoneMultiplier: number
  penaltyLoadingFee: number
  waiverAmount: number
  waiverReason: string
  billingCycleType: CycleType
  cycleYears: number
  promoDays: number
  subscriptionStartDate: string
  subscriptionExpiryDate: string
  invoiceNarration: string
  invoiceNumber: string
  cycle: number
}

const itemsOf = (row: SubmissionRow): MeasuredItem[] => (row.measurements as Measurements | undefined)?.items ?? []

function initialBilling(row: SubmissionRow): BillingDraft {
  const prev = (row.billing ?? {}) as Partial<BillingDraft>
  const zone = (prev.zone as ZoneId) ?? suggestZone(row.areaCouncil)
  const start = prev.subscriptionStartDate ?? todayISO()
  const cycle = Number(prev.cycle ?? 1)
  const base: BillingDraft = {
    scheduleId: prev.scheduleId ?? DEFAULT_SCHEDULE.id,
    scheduleName: prev.scheduleName ?? DEFAULT_SCHEDULE.name,
    rates: prev.rates ?? DEFAULT_SCHEDULE.rates,
    illuminationSurchargePct: prev.illuminationSurchargePct ?? DEFAULT_SCHEDULE.illuminationSurchargePct,
    applyIllumination: prev.applyIllumination ?? true,
    zone,
    zoneMultiplier: zoneById(zone).multiplier,
    penaltyLoadingFee: Number(prev.penaltyLoadingFee ?? 0),
    waiverAmount: Number(prev.waiverAmount ?? 0),
    waiverReason: prev.waiverReason ?? "No waiver applied",
    billingCycleType: prev.billingCycleType ?? "Annual_Standard",
    cycleYears: Number(prev.cycleYears ?? 2),
    promoDays: Number(prev.promoDays ?? 90),
    subscriptionStartDate: start,
    subscriptionExpiryDate: "",
    invoiceNarration:
      prev.invoiceNarration ?? `Outdoor advertisement and signage permit levy — ${row.companyName ?? row.applicantName ?? ""}, ${row.signageSiteAddress ?? row.addressLine1 ?? ""}`.trim(),
    invoiceNumber: prev.invoiceNumber ?? invoiceNumber(cycle),
    cycle,
  }
  base.subscriptionExpiryDate = prev.subscriptionExpiryDate ?? expiryFor(start, base)
  return base
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="figure text-foreground">{value}</span>
    </div>
  )
}

function BillingEngine({ d, set, row }: { d: BillingDraft; set: (p: Partial<BillingDraft>) => void; row: SubmissionRow }) {
  const { schedules, active } = useTariffSchedules()
  const items = itemsOf(row)
  const bill = computeBill(items, d)

  React.useEffect(() => {
    if (!row.billing?.scheduleId && d.scheduleId === DEFAULT_SCHEDULE.id && active.id !== DEFAULT_SCHEDULE.id) {
      set({ scheduleId: active.id, scheduleName: active.name, rates: active.rates, illuminationSurchargePct: active.illuminationSurchargePct })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active.id])

  const cyclePatch = (patch: Partial<BillingDraft>) => {
    const next = { ...d, ...patch }
    set({ ...patch, subscriptionExpiryDate: expiryFor(next.subscriptionStartDate, next) })
  }

  if (!items.length) {
    return (
      <p className="flex items-start gap-2 rounded-lg bg-[hsl(var(--state-stop-soft))] px-3.5 py-3 text-[13px] text-[hsl(var(--state-stop))]">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        No locked field measurements on this file. Raise a query so the Director can send it back for inspection.
      </p>
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3 rounded-lg bg-muted/40 p-3.5 text-[12.5px]">
        <div>
          <p className="text-muted-foreground">Applicant</p>
          <p className="font-medium text-foreground">{row.companyName ?? row.applicantName}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Area council</p>
          <p className="font-medium text-foreground">{row.areaCouncil ?? "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Source</p>
          <p className="font-medium text-foreground">{row.measurements?.source === "planning_development" ? "Planning vetting" : "BD field visit"}</p>
        </div>
      </div>

      <div>
        <SectionLabel>Tariff engine</SectionLabel>
        <FieldGrid columns={3}>
          <SelectField
            id="bl-sched"
            label="Base rate matrix"
            value={d.scheduleId}
            onChange={(id) => {
              const s = schedules.find((x) => x.id === id)
              if (s) set({ scheduleId: s.id, scheduleName: s.name, rates: s.rates, illuminationSurchargePct: s.illuminationSurchargePct })
            }}
            options={schedules.map((s) => ({ value: s.id, label: `${s.name}${s.active ? " (active)" : ""}` }))}
          />
          <SelectField
            id="bl-zone"
            label="Zone premium multiplier"
            value={d.zone}
            hint={zoneById(d.zone).note}
            onChange={(z) => set({ zone: z as ZoneId, zoneMultiplier: zoneById(z).multiplier })}
            options={ZONES.map((z) => ({ value: z.id, label: z.label }))}
          />
          <SelectField
            id="bl-ill"
            label="Illumination premium"
            value={d.applyIllumination ? "yes" : "no"}
            onChange={(v) => set({ applyIllumination: v === "yes" })}
            options={[
              { value: "yes", label: `Yes (+${d.illuminationSurchargePct}% on lit signs)` },
              { value: "no", label: "Not applied" },
            ]}
          />
        </FieldGrid>

        <table className="mt-4 w-full text-left text-[12.5px]">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="py-1.5">Sign</th>
              <th className="py-1.5 text-right">m²</th>
              <th className="py-1.5 text-right">Rate</th>
              <th className="py-1.5 text-right">Base × zone</th>
              <th className="py-1.5 text-right">Surcharge</th>
            </tr>
          </thead>
          <tbody>
            {bill.lines.map((l) => (
              <tr key={l.id} className="border-b border-border/60">
                <td className="py-1.5">
                  {l.id} {typeLabel(l.type)}
                </td>
                <td className="py-1.5 text-right font-mono">{l.sqm.toFixed(2)}</td>
                <td className={cn("py-1.5 text-right", !l.rate && TONE.stop.text)}>{l.rate ? naira(l.rate) : "no rate"}</td>
                <td className="py-1.5 text-right">{naira(l.base)}</td>
                <td className="py-1.5 text-right">{naira(l.surcharge)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4">
          <FieldGrid columns={3}>
            <NumberField id="bl-pen" label="Penalty loading fee" prefix="₦" value={d.penaltyLoadingFee} hint="Historical non-compliance" onChange={(v) => set({ penaltyLoadingFee: v })} />
            <NumberField id="bl-waive" label="Discretionary rebate / waiver" prefix="₦" value={d.waiverAmount} onChange={(v) => set({ waiverAmount: v })} />
            <SelectField
              id="bl-waive-r"
              label="Waiver reason"
              value={d.waiverReason}
              onChange={(v) => set({ waiverReason: v })}
              options={[
                { value: "No waiver applied", label: "No waiver applied" },
                { value: "Government / public institution", label: "Government / public institution" },
                { value: "Director-approved concession", label: "Director-approved concession" },
                { value: "Correction of prior overbilling", label: "Correction of prior overbilling" },
              ]}
            />
          </FieldGrid>
        </div>

        <div className="mt-4 space-y-1 rounded-xl bg-muted/50 px-4 py-3.5 text-[13px]">
          <Row label="Base computation" value={naira(bill.baseComputation)} />
          <Row label="Illumination surcharge" value={naira(bill.illuminationSurcharge)} />
          {bill.cycleFactor !== 1 ? <Row label="Cycle factor" value={`× ${bill.cycleFactor}`} /> : null}
          <Row label="Penalty − waiver" value={`${naira(d.penaltyLoadingFee)} − ${naira(d.waiverAmount)}`} />
          <div className="flex items-center justify-between border-t border-border pt-2">
            <span className="font-medium text-muted-foreground">Generated net invoice</span>
            <span className="figure text-[24px] font-semibold text-foreground">{naira(bill.netInvoiceAmount)}</span>
          </div>
        </div>
      </div>

      <div>
        <SectionLabel>Subscription validity</SectionLabel>
        <FieldGrid columns={4}>
          <SelectField id="bl-cycle" label="Billing cycle" value={d.billingCycleType} onChange={(v) => cyclePatch({ billingCycleType: v as CycleType })} options={CYCLE_TYPES} />
          {d.billingCycleType === "Multi_Year_Contract" ? (
            <NumberField id="bl-years" label="Years" value={d.cycleYears} onChange={(v) => cyclePatch({ cycleYears: v })} />
          ) : d.billingCycleType === "Short_Term_Promotional" ? (
            <NumberField id="bl-days" label="Days" value={d.promoDays} hint="Prorated on 365 days" onChange={(v) => cyclePatch({ promoDays: v })} />
          ) : (
            <TextField id="bl-len" label="Length" value="12 months" onChange={() => undefined} />
          )}
          <TextField id="bl-start" label="Activation date" type="date" value={d.subscriptionStartDate} onChange={(v) => cyclePatch({ subscriptionStartDate: v })} />
          <TextField id="bl-exp" label="Expiration date" type="date" value={d.subscriptionExpiryDate} hint="Auto-calculated" onChange={(v) => set({ subscriptionExpiryDate: v })} />
        </FieldGrid>
      </div>

      <FieldGrid>
        <TextField id="bl-inv" label="Invoice number" mono value={d.invoiceNumber} onChange={(v) => set({ invoiceNumber: v })} />
        <TextField id="bl-cyc" label="Cycle" value={`#${d.cycle}`} onChange={() => undefined} />
      </FieldGrid>
      <TextareaField id="bl-narr" label="Invoice narration" value={d.invoiceNarration} rows={2} onChange={(v) => set({ invoiceNarration: v })} />
    </div>
  )
}

const billingDraft: QueueDraft<BillingDraft> = {
  field: "billing",
  views: ["assess"],
  title: "Billing engine",
  initial: initialBilling,
  validate: (d, row) => {
    const items = itemsOf(row)
    if (!items.length) return "There are no locked measurements to bill against."
    const bill = computeBill(items, d)
    if (bill.missingRates.length) return `No tariff rate for: ${bill.missingRates.map(typeLabel).join(", ")}.`
    if (!(bill.netInvoiceAmount > 0)) return "The net invoice must be above zero."
    if (d.waiverAmount > 0 && (!d.waiverReason || d.waiverReason === "No waiver applied")) return "Give a reason for the waiver."
    if (!d.subscriptionStartDate || !d.subscriptionExpiryDate || d.subscriptionExpiryDate <= d.subscriptionStartDate) return "Check the validity dates."
    if (!d.invoiceNumber.trim()) return "An invoice number is required."
    return null
  },
  derive: (d, row, { now, actorId }) => {
    const bill = computeBill(itemsOf(row), d)
    return { billing: { ...d, ...bill, measurementsSource: row.measurements?.source ?? "", assessedAt: now, assessedBy: actorId } }
  },
  render: (d, set, row) => <BillingEngine d={d} set={set} row={row} />,
}

export function BillingQueue() {
  return (
    <WorkQueue<BillingDraft>
      title="Billing assessments"
      description="Price locked field measurements against the gazetted tariff"
      department={DEPARTMENT.billing}
      actorId="billing"
      draft={billingDraft}
      views={[
        {
          value: "assess",
          label: "To assess",
          routes: ["first", "third"],
          statuses: stage("billing"),
          empty: { title: "Nothing to price", body: "The Director sends files here once field measurements are verified." },
          actions: [
            {
              key: "query",
              label: "Query measurements (via Director)",
              tone: "danger",
              icon: Undo2,
              status: STATUS.billingQueried,
              department: DEPARTMENT.director,
              record: "Billing raised a query on the field measurements",
              requiresReason: true,
              kind: "error",
            },
            {
              key: "commit",
              label: "Commit bill — forward to Director",
              icon: Forward,
              status: STATUS.billProposed,
              department: DEPARTMENT.director,
              record: "Bill computed by Billing",
              needsDraft: true,
            },
          ],
        },
        {
          value: "sent",
          label: "Billed",
          routes: ["first", "third"],
          statuses: [...stage("billProposed"), ...stage("awaitingPayment"), ...stage("paymentReconciled"), ...stage("issued")],
          empty: { title: "Nothing billed yet", body: "Bills you've committed stay here for reference." },
          column: { header: "Net invoice", render: (row) => <span className="figure">{naira(row.billing?.netInvoiceAmount as number)}</span> },
        },
      ]}
    />
  )
}

/* ================= Subscription lifecycle tracker ================= */

interface RegisterDoc {
  id: string
  category?: string
  route?: "first" | "third"
  permitNumber?: string
  holderName?: string
  submissionId?: string
  submissionRef?: string
  totalSqm?: number
  status?: string
  expiresAt?: string
  cycle?: number
}

export const EXPIRY_WARNING_DAYS = 30

export function lifecycleOf(expiresAt?: unknown) {
  const days = daysUntil(expiresAt)
  if (days === null) return { days, state: "unknown" as const }
  if (days < 0) return { days, state: "expired" as const }
  if (days <= EXPIRY_WARNING_DAYS) return { days, state: "warning" as const }
  return { days, state: "active" as const }
}

export function SubscriptionTracker() {
  const { active: schedule } = useTariffSchedules()
  const { data, loading, error } = useRealtimeCollection<Omit<RegisterDoc, "id">>(REGISTER_COLLECTION, [orderBy("expiresAt", "asc"), limit(500)], [])
  const [filter, setFilter] = React.useState<"due" | "expired" | "warning" | "active" | "all">("due")
  const [search, setSearch] = React.useState("")
  const [target, setTarget] = React.useState<RegisterDoc | null>(null)
  const [busy, setBusy] = React.useState(false)

  const rows = React.useMemo(() => {
    const term = search.trim().toLowerCase()
    return (data as RegisterDoc[])
      .map((e) => ({ ...e, ...lifecycleOf(e.expiresAt) }))
      .filter((e) => {
        if (filter === "due" && !(e.state === "expired" || e.state === "warning")) return false
        if ((filter === "expired" || filter === "warning" || filter === "active") && e.state !== filter) return false
        return term ? [e.holderName, e.permitNumber, e.submissionId].join(" ").toLowerCase().includes(term) : true
      })
  }, [data, filter, search])

  const rebill = async (entry: RegisterDoc, mode: "clone" | "adjust") => {
    if (!entry.submissionRef || !entry.route) {
      toast.error({ title: "Register entry has no source file" })
      return
    }
    setBusy(true)
    try {
      const ref = doc(db, collectionFor(entry.route), entry.submissionRef)
      const snap = await getDoc(ref)
      if (!snap.exists()) throw new Error("Source file not found.")
      const file = snap.data() as SubmissionRow
      if (!stage("issued").includes(file.status ?? "")) throw new Error(`File is already in progress (${file.status}).`)
      const now = new Date().toISOString()
      const prev = (file.billing ?? {}) as Partial<BillingDraft> & Record<string, unknown>
      const cycle = Number(prev.cycle ?? 1) + 1

      // New cycle starts the day after the old one ends.
      const ended = parseDate(entry.expiresAt) ?? new Date()
      const nextStart = isoDate(new Date(ended.getFullYear(), ended.getMonth(), ended.getDate() + 1))

      const params: BillingDraft = {
        ...initialBilling({ ...file, id: entry.submissionRef, route: entry.route, billing: undefined }),
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        rates: schedule.rates,
        illuminationSurchargePct: schedule.illuminationSurchargePct,
        zone: (prev.zone as ZoneId) ?? suggestZone(file.areaCouncil),
        zoneMultiplier: zoneById((prev.zone as string) ?? suggestZone(file.areaCouncil)).multiplier,
        applyIllumination: prev.applyIllumination ?? true,
        billingCycleType: (prev.billingCycleType as CycleType) ?? "Annual_Standard",
        cycleYears: Number(prev.cycleYears ?? 2),
        promoDays: Number(prev.promoDays ?? 90),
        penaltyLoadingFee: 0,
        waiverAmount: 0,
        waiverReason: "No waiver applied",
        subscriptionStartDate: nextStart,
        subscriptionExpiryDate: "",
        invoiceNumber: invoiceNumber(cycle),
        cycle,
      }
      params.subscriptionExpiryDate = expiryFor(nextStart, params)
      params.invoiceNarration = `Renewal (cycle ${cycle}) — ${params.invoiceNarration}`

      const items = (file.measurements as Measurements | undefined)?.items ?? []
      if (mode === "clone" && !items.length) throw new Error("This file has no locked measurements to clone. Use 'Adjustments needed'.")
      const bill = computeBill(items, params)
      const clone = mode === "clone"
      const status = clone ? STATUS.renewalProposed : STATUS.billingAssessment
      const to = clone ? DEPARTMENT.director : DEPARTMENT.billing
      const record = clone ? `Renewal invoice ${params.invoiceNumber} generated from historical parameters` : `Renewal cycle ${cycle} opened for re-assessment`

      await updateDoc(ref, {
        billingHistory: arrayUnion(prev),
        paymentHistory: arrayUnion(file.payment ?? {}),
        billing: clone
          ? { ...params, ...bill, measurementsSource: file.measurements?.source ?? "", assessedAt: now, assessedBy: "billing", renewal: true }
          : { ...params, renewal: true },
        payment: {},
        status,
        department: to,
        updatedAt: now,
        comments: arrayUnion({ timestamp: now, desk: "billing", action: record, from: DEPARTMENT.billing, to, status }),
      })
      await updateDoc(doc(db, REGISTER_COLLECTION, entry.id), { status: "Renewal Invoiced", renewalStartedAt: now })
      await addDoc(collection(db, COL.activity), { submissionId: entry.submissionRef, action: record, timestamp: now, userId: "billing" })
      if (clone) {
        await addDoc(collection(db, COL.notifications), {
          userId: "director",
          content: `${record} — ${entry.holderName ?? ""} (${naira(bill.netInvoiceAmount)})`,
          type: "info",
          referenceId: entry.submissionRef,
          isRead: false,
          createdAt: now,
        })
      }
      toast.success({ title: clone ? "Renewal sent to Director" : "Opened in Billing queue", description: entry.holderName })
      setTarget(null)
    } catch (err) {
      toast.error({ title: "Re-bill failed", description: err instanceof Error ? err.message : "Try again." })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Panel
        title="Subscription lifecycle monitor"
        description={`Live permits by expiry. Warning window: ${EXPIRY_WARNING_DAYS} days.`}
        actions={
          <Segmented
            value={filter}
            onChange={(v) => setFilter(v as typeof filter)}
            options={[
              { value: "due", label: "Needs action" },
              { value: "expired", label: "Expired" },
              { value: "warning", label: "Expiring" },
              { value: "active", label: "Active" },
              { value: "all", label: "All" },
            ]}
          />
        }
        bodyClassName="p-0"
      >
        <div className="border-b border-border p-3 sm:px-5">
          <SearchField value={search} onChange={setSearch} placeholder="Company name, permit or file number" />
        </div>
        <div className="p-3 sm:p-4">
          {error ? (
            <LoadFailed error={error} what="The permit register" />
          ) : loading ? (
            <RowsSkeleton rows={5} columns={5} />
          ) : !rows.length ? (
            <EmptyState icon={CalendarClock} title="Nothing in this view" description="Permits appear here once the Director signs them off." />
          ) : (
            <div className="overflow-x-auto scroll-slim">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-border text-[11.5px] font-semibold text-muted-foreground">
                    <th className="px-3 py-2.5">Client account</th>
                    <th className="px-3 py-2.5">Type</th>
                    <th className="px-3 py-2.5">Expires</th>
                    <th className="px-3 py-2.5">Counter</th>
                    <th className="px-3 py-2.5">Lifecycle state</th>
                    <th className="px-3 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id} className="border-b border-border/70 last:border-0 hover:bg-muted/50">
                      <td className="px-3 py-3">
                        <p className="text-[13.5px] font-medium text-foreground">{e.holderName}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">{e.permitNumber}</p>
                      </td>
                      <td className="px-3 py-3 text-[12.5px]">{e.category === "first-party" ? "FP" : "3P"}</td>
                      <td className="px-3 py-3 text-[12.5px]">{formatDate(e.expiresAt)}</td>
                      <td className={cn("px-3 py-3 text-[12.5px] font-semibold", e.state === "expired" ? TONE.stop.text : e.state === "warning" ? TONE.wait.text : TONE.clear.text)}>
                        {e.days === null ? "—" : e.days < 0 ? `${-e.days} days ago` : `${e.days} days left`}
                      </td>
                      <td className="px-3 py-3">
                        {e.status === "Renewal Invoiced" ? (
                          <StatusPill status="Renewal Invoiced" />
                        ) : (
                          <StatusPill
                            tone={e.state === "expired" ? "stop" : e.state === "warning" ? "wait" : "clear"}
                            status={e.state === "expired" ? "Expired — re-bill outstanding" : e.state === "warning" ? "Warning — send renewal invoice" : "Active"}
                          />
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {(e.state === "expired" || e.state === "warning") && e.status !== "Renewal Invoiced" ? (
                          <ActionButton tone="quiet" icon={RefreshCcw} onClick={() => setTarget(e)}>
                            Re-bill
                          </ActionButton>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Panel>

      <Sheet
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        title="Generate renewal invoice"
        caption={target ? `${target.holderName} · ${target.permitNumber}` : ""}
        width="max-w-lg"
        footer={
          target ? (
            <div className="flex flex-wrap justify-end gap-2">
              <ActionButton tone="quiet" disabled={busy} onClick={() => rebill(target, "adjust")}>
                Adjustments needed — open in Billing
              </ActionButton>
              <ActionButton icon={Forward} disabled={busy} onClick={() => rebill(target, "clone")}>
                {busy ? "Generating…" : `Generate cycle ${(target.cycle ?? 1) + 1} — route to Director`}
              </ActionButton>
            </div>
          ) : null
        }
      >
        {target ? (
          <p className="text-[13.5px] leading-relaxed text-foreground">
            The system will clone the historical physical parameters for <strong>{target.holderName}</strong> (total {Number(target.totalSqm ?? 0).toFixed(2)} m²), price them on{" "}
            <strong>{schedule.name}</strong> with the previous zone and cycle settings, and start the new cycle the day after {formatDate(target.expiresAt)}. The renewal goes to the
            Director for pricing sign-off, then Finance.
          </p>
        ) : null}
      </Sheet>
    </>
  )
}

/* ================= Tariff schedule (gazette table) ================= */

export function TariffSchedulePanel() {
  const { schedules, active, seeded } = useTariffSchedules()
  const [name, setName] = React.useState(active.name)
  const [pct, setPct] = React.useState(active.illuminationSurchargePct)
  const [rates, setRates] = React.useState<Record<string, number>>(active.rates)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    setName(active.name)
    setPct(active.illuminationSurchargePct)
    setRates(active.rates)
  }, [active.id, active.name, active.illuminationSurchargePct, active.rates])

  const save = async () => {
    if (!name.trim()) {
      toast.warning({ title: "Name the schedule" })
      return
    }
    setSaving(true)
    try {
      const batch = writeBatch(db)
      if (seeded) schedules.forEach((s) => s.active && batch.update(doc(db, TARIFF_COLLECTION, s.id), { active: false }))
      batch.set(doc(collection(db, TARIFF_COLLECTION)), { name: name.trim(), illuminationSurchargePct: pct, rates, active: true, effectiveFrom: todayISO(), createdAt: new Date().toISOString() })
      await batch.commit()
      toast.success({ title: "Schedule saved and activated", description: "New assessments use it. Existing bills are unchanged." })
    } catch (err) {
      toast.error({ title: "Not saved", description: err instanceof Error ? err.message : "Try again." })
    } finally {
      setSaving(false)
    }
  }

  const groups: [string, { value: string; label: string }[]][] = [
    ["First-party sign types", SIGN_TYPES],
    ["Third-party structures", STRUCTURE_TYPES],
  ]

  return (
    <Panel
      title="Tariff schedule"
      description={seeded ? `Active: ${active.name}` : "Using built-in placeholder rates — enter the gazetted figures and save."}
      actions={
        <ActionButton icon={Save} disabled={saving} onClick={save}>
          {saving ? "Saving…" : "Save as new active schedule"}
        </ActionButton>
      }
    >
      <FieldGrid>
        <TextField id="ts-name" label="Schedule name" value={name} onChange={setName} />
        <NumberField id="ts-pct" label="Illumination surcharge (%)" value={pct} onChange={setPct} />
      </FieldGrid>
      {groups.map(([title, list]) => (
        <div key={title} className="mt-5">
          <SectionLabel>{title} — ₦ per m² per year</SectionLabel>
          <FieldGrid columns={3}>
            {list.map((t) => (
              <NumberField key={t.value} id={`ts-${t.value}`} label={t.label} prefix="₦" value={rates[t.value] ?? 0} onChange={(v) => setRates((r) => ({ ...r, [t.value]: v }))} />
            ))}
          </FieldGrid>
        </div>
      ))}
    </Panel>
  )
}
DOAS_EOF

# ============================================================================
w components/finance/finance-panels.tsx <<'DOAS_EOF'
"use client"

import * as React from "react"
import { getDownloadURL, ref, uploadBytes } from "firebase/storage"
import { BadgeCheck, Loader2, Paperclip, Radar, ShieldAlert, SplitSquareHorizontal } from "lucide-react"
import { storage } from "@/lib/firebase"
import { DEPARTMENT, LEDGER_CODES, STATUS, ledgerFor, parseDate, stage } from "@/lib/workflow"
import { formatDate, formatDateTime, naira } from "@/lib/format"
import { toast } from "@/components/ui/toast"
import { ActionButton, FieldGrid, NumberField, SelectField, TextField, TextareaField } from "@/components/dashboard/form-kit"
import { EmptyState, LoadFailed, Panel, RowsSkeleton, SectionLabel, StatusPill, TONE } from "@/components/dashboard/kit"
import { WorkQueue, useSubmissions, type QueueDraft, type SubmissionRow } from "@/components/dashboard/work-queue"
import { cn } from "@/lib/utils"

interface RemitaCheck {
  configured: boolean
  found?: boolean
  paid?: boolean
  amount?: number
  transactionTime?: string
  message?: string
  checkedAt: string
}

interface PaymentDraft extends Record<string, unknown> {
  remitaRrr: string
  paymentChannel: string
  amountCredited: number
  bankTransactionTimestamp: string
  uploadedRemitaProof: string
  financeLedgerCode: string
  reconciliationStatus: string
  remitaCheck: RemitaCheck | null
  financeNotes: string
}

interface Declared {
  rrr?: string
  amount?: number
  proofUrl?: string
  channel?: string
  declaredAt?: string
}

const RECON = [
  { value: "Unverified", label: "Unverified" },
  { value: "Reconciled_Match", label: "Reconciled — match" },
  { value: "Underpaid_Shortfall", label: "Underpaid — shortfall" },
  { value: "Overpaid_Credit", label: "Overpaid — credit" },
]

const digits = (v: string) => v.replace(/\D/g, "")
const expectedOf = (row: SubmissionRow) => Number(row.billing?.netInvoiceAmount ?? row.billing?.totalAmount ?? 0)

function suggest(expected: number, credited: number) {
  if (!(credited > 0)) return "Unverified"
  if (Math.abs(credited - expected) < 1) return "Reconciled_Match"
  return credited < expected ? "Underpaid_Shortfall" : "Overpaid_Credit"
}

function FinanceDesk({ d, set, row }: { d: PaymentDraft; set: (p: Partial<PaymentDraft>) => void; row: SubmissionRow }) {
  const [checking, setChecking] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)
  const expected = expectedOf(row)
  const declared = (row.payment?.declared ?? null) as Declared | null
  const variance = Number(d.amountCredited || 0) - expected
  const suggested = suggest(expected, Number(d.amountCredited || 0))

  const runCheck = async () => {
    const rrr = digits(d.remitaRrr)
    if (rrr.length !== 12) {
      toast.warning({ title: "RRR must be 12 digits" })
      return
    }
    setChecking(true)
    try {
      const res = await fetch(`/api/remita/verify?rrr=${rrr}`)
      const json = await res.json()
      const check: RemitaCheck = { ...json, checkedAt: new Date().toISOString() }
      const patch: Partial<PaymentDraft> = { remitaCheck: check }
      if (check.paid && check.amount) {
        patch.amountCredited = check.amount
        if (check.transactionTime) patch.bankTransactionTimestamp = String(check.transactionTime)
      }
      set(patch)
    } catch (err) {
      toast.error({ title: "Remita check failed", description: err instanceof Error ? err.message : "Try again." })
    } finally {
      setChecking(false)
    }
  }

  const uploadProof = async (file?: File) => {
    if (!file) return
    setUploading(true)
    try {
      const target = ref(storage, `finance/${row.id}/bank-proof-${Date.now()}-${file.name.replace(/\s+/g, "-")}`)
      await uploadBytes(target, file, { contentType: file.type })
      set({ uploadedRemitaProof: await getDownloadURL(target) })
    } catch (err) {
      toast.error({ title: "Upload failed", description: err instanceof Error ? err.message : "Try again." })
    } finally {
      setUploading(false)
    }
  }

  const check = d.remitaCheck

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/40 p-3.5 text-[12.5px]">
        <div>
          <p className="text-muted-foreground">Invoice reference</p>
          <p className="font-mono font-medium text-foreground">{String(row.billing?.invoiceNumber ?? "—")}</p>
        </div>
        <div className="text-right">
          <p className="text-muted-foreground">Expected payable total</p>
          <p className="figure text-[18px] font-semibold text-foreground">{naira(expected)}</p>
        </div>
      </div>

      <div>
        <SectionLabel>Client payment proof (portal)</SectionLabel>
        {declared ? (
          <div className="grid grid-cols-3 gap-3 text-[13px]">
            <div>
              <p className="text-[11.5px] text-muted-foreground">Declared RRR</p>
              <p className="font-mono">{declared.rrr}</p>
            </div>
            <div>
              <p className="text-[11.5px] text-muted-foreground">Declared amount</p>
              <p>{naira(declared.amount)}</p>
            </div>
            <div>
              <p className="text-[11.5px] text-muted-foreground">Receipt</p>
              {declared.proofUrl ? (
                <a href={declared.proofUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent underline-offset-4 hover:underline">
                  View upload
                </a>
              ) : (
                "—"
              )}
            </div>
          </div>
        ) : (
          <p className="text-[13px] text-muted-foreground">The applicant hasn&rsquo;t declared a payment yet. You can still verify a bank-branch payment directly.</p>
        )}
      </div>

      <div>
        <SectionLabel>Remita settlement check</SectionLabel>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <TextField id="fn-rrr" label="Remita retrieval reference (RRR)" mono value={d.remitaRrr} placeholder="12 digits" onChange={(v) => set({ remitaRrr: v })} />
          </div>
          <ActionButton tone="quiet" icon={checking ? Loader2 : Radar} disabled={checking} onClick={runCheck}>
            Query Remita
          </ActionButton>
        </div>
        {check ? (
          <p className={cn("mt-2 rounded-lg px-3.5 py-2.5 text-[12.5px]", !check.configured ? "bg-muted text-muted-foreground" : check.paid ? TONE.clear.soft : TONE.stop.soft)}>
            {!check.configured
              ? "Remita API isn't configured on this server — verify against the bank statement manually."
              : check.paid
                ? `Match found: ${naira(check.amount)} settled${check.transactionTime ? ` at ${check.transactionTime}` : ""}.`
                : `No settled payment: ${check.message ?? "not found"}.`}{" "}
            <span className="opacity-70">Checked {formatDateTime(check.checkedAt)}</span>
          </p>
        ) : null}
      </div>

      <FieldGrid columns={3}>
        <SelectField
          id="fn-ch"
          label="Payment channel"
          value={d.paymentChannel}
          onChange={(v) => set({ paymentChannel: v })}
          options={[
            { value: "Remita_Portal", label: "Remita portal" },
            { value: "Bank_Branch", label: "Bank branch" },
            { value: "FCTA_Direct_Settlement", label: "FCTA direct settlement" },
          ]}
        />
        <NumberField id="fn-amt" label="Amount credited (to date)" prefix="₦" value={d.amountCredited} hint="Cumulative across part payments" onChange={(v) => set({ amountCredited: v })} />
        <TextField id="fn-ts" label="Bank transaction time" value={d.bankTransactionTimestamp} placeholder="2026-10-06 09:12" onChange={(v) => set({ bankTransactionTimestamp: v })} />
        <SelectField id="fn-ledger" label="Revenue ledger" value={d.financeLedgerCode} onChange={(v) => set({ financeLedgerCode: v })} options={LEDGER_CODES} />
        <SelectField id="fn-rec" label="Reconciliation status" value={d.reconciliationStatus} onChange={(v) => set({ reconciliationStatus: v })} options={RECON} />
        <div>
          <p className="mb-1.5 text-[12.5px] font-medium text-foreground">Bank-confirmed proof</p>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[12.5px] font-semibold hover:bg-muted">
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
            {d.uploadedRemitaProof ? "Replace" : "Attach"}
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => uploadProof(e.target.files?.[0])} />
          </label>
        </div>
      </FieldGrid>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/50 px-4 py-3 text-[13px]">
        <span>
          Variance:{" "}
          <span className={cn("figure font-semibold", Math.abs(variance) < 1 ? TONE.clear.text : variance < 0 ? TONE.stop.text : TONE.move.text)}>
            {variance >= 0 ? "+" : "−"}
            {naira(Math.abs(variance))}
          </span>
        </span>
        <span className="flex items-center gap-2">
          Suggested: <StatusPill status={suggested} />
          {suggested !== d.reconciliationStatus ? (
            <button type="button" className="text-[12px] font-semibold text-accent underline-offset-4 hover:underline" onClick={() => set({ reconciliationStatus: suggested })}>
              apply
            </button>
          ) : null}
        </span>
      </div>

      <TextareaField id="fn-notes" label="Finance notes" value={d.financeNotes} rows={2} onChange={(v) => set({ financeNotes: v })} />
    </div>
  )
}

const paymentDraft: QueueDraft<PaymentDraft> = {
  field: "payment",
  views: ["verify"],
  title: "Finance reconciliation",
  initial: (row) => {
    const p = (row.payment ?? {}) as Partial<PaymentDraft> & { declared?: Declared }
    return {
      remitaRrr: p.remitaRrr ?? p.declared?.rrr ?? "",
      paymentChannel: p.paymentChannel ?? p.declared?.channel ?? "Remita_Portal",
      amountCredited: Number(p.amountCredited ?? 0),
      bankTransactionTimestamp: p.bankTransactionTimestamp ?? "",
      uploadedRemitaProof: p.uploadedRemitaProof ?? "",
      financeLedgerCode: p.financeLedgerCode ?? ledgerFor(row.route),
      reconciliationStatus: p.reconciliationStatus ?? "Unverified",
      remitaCheck: p.remitaCheck ?? null,
      financeNotes: p.financeNotes ?? "",
    }
  },
  validate: (d) => {
    if (digits(d.remitaRrr).length !== 12) return "Enter the 12-digit Remita RRR."
    if (!(d.amountCredited > 0)) return "Enter the amount credited."
    if (!d.bankTransactionTimestamp || !parseDate(d.bankTransactionTimestamp)) return "Enter the bank transaction time."
    if (!d.financeLedgerCode) return "Select the revenue ledger."
    return null
  },
  derive: (d, row, { now, actorId }) => {
    const expected = expectedOf(row)
    const credited = Number(d.amountCredited || 0)
    return {
      payment: {
        ...d,
        remitaRrr: digits(d.remitaRrr),
        expectedAmount: expected,
        balanceDue: Math.max(0, Math.round((expected - credited) * 100) / 100),
        creditBalance: Math.max(0, Math.round((credited - expected) * 100) / 100),
        declared: row.payment?.declared ?? null,
        reconciledAt: now,
        reconciledBy: actorId,
      },
    }
  },
  render: (d, set, row) => <FinanceDesk d={d} set={set} row={row} />,
}

const statusIs = (allowed: string[], message: string) => (draft: Record<string, unknown> | null) =>
  allowed.includes(String(draft?.reconciliationStatus ?? "")) ? null : message

export function FinanceQueue() {
  return (
    <WorkQueue<PaymentDraft>
      title="Payment reconciliation"
      description="Verify declared payments against Remita and the bank ledger"
      department={DEPARTMENT.finance}
      actorId="finance"
      draft={paymentDraft}
      views={[
        {
          value: "verify",
          label: "To verify",
          routes: ["first", "third"],
          statuses: stage("awaitingPayment"),
          empty: { title: "No payments to verify", body: "Invoices the Director confirms arrive here until payment is reconciled." },
          column: { header: "Expected", render: (row) => <span className="figure">{naira(expectedOf(row))}</span> },
          actions: [
            {
              key: "flag",
              label: "Flag receipt invalid",
              tone: "danger",
              icon: ShieldAlert,
              status: STATUS.paymentFlagged,
              department: DEPARTMENT.director,
              record: "Payment flagged as invalid by Finance",
              requiresReason: true,
              needsDraft: true,
              kind: "error",
            },
            {
              key: "partial",
              label: "Record part payment",
              tone: "danger",
              icon: SplitSquareHorizontal,
              status: STATUS.partPayment,
              department: DEPARTMENT.finance,
              record: "Part payment recorded — balance issued",
              needsDraft: true,
              notify: "csu",
              check: statusIs(["Underpaid_Shortfall"], "Set reconciliation status to Underpaid — shortfall first."),
            },
            {
              key: "reconcile",
              label: "Dispatch receipt — route to Director",
              icon: BadgeCheck,
              status: STATUS.paymentReconciled,
              department: DEPARTMENT.director,
              record: "Payment reconciled by Finance",
              needsDraft: true,
              kind: "success",
              check: statusIs(["Reconciled_Match", "Overpaid_Credit"], "Only a matched or overpaid payment can be dispatched."),
            },
          ],
        },
        {
          value: "done",
          label: "Reconciled",
          routes: ["first", "third"],
          statuses: [...stage("paymentReconciled"), ...stage("issued")],
          empty: { title: "Nothing reconciled yet", body: "Verified payments stay here as the receipt record." },
          column: { header: "Credited", render: (row) => <span className="figure">{naira(row.payment?.amountCredited as number)}</span> },
        },
      ]}
    />
  )
}

/* ================= Ledger ================= */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export function useLedger() {
  const { rows, loading, error } = useSubmissions()
  return React.useMemo(() => {
    const credited = (r: SubmissionRow) => Number(r.payment?.amountCredited ?? 0)
    const reconciled = rows.filter((r) => ["Reconciled_Match", "Overpaid_Credit"].includes(String(r.payment?.reconciliationStatus ?? "")))
    const outstanding = rows.filter((r) => stage("awaitingPayment").includes(r.status ?? ""))
    const collected = reconciled.reduce((s, r) => s + credited(r), 0)
    const owed = outstanding.reduce((s, r) => s + Math.max(0, expectedOf(r) - credited(r)), 0)
    return { rows, reconciled, outstanding, collected, owed, credited, loading, error }
  }, [rows, loading, error])
}

export function LedgerPanel() {
  const { reconciled, outstanding, collected, owed, credited, loading, error } = useLedger()
  const year = new Date().getFullYear()

  const byCode = LEDGER_CODES.map((c) => ({
    ...c,
    total: reconciled.filter((r) => r.payment?.financeLedgerCode === c.value).reduce((s, r) => s + credited(r), 0),
  }))

  const monthly = MONTHS.map((m, i) => ({
    m,
    total: reconciled
      .filter((r) => {
        const d = parseDate(r.payment?.bankTransactionTimestamp)
        return d !== null && d.getFullYear() === year && d.getMonth() === i
      })
      .reduce((s, r) => s + credited(r), 0),
  }))
  const peak = Math.max(1, ...monthly.map((x) => x.total))

  if (error) return <LoadFailed error={error} what="The ledger" />

  return (
    <div className="space-y-4">
      <Panel title="Revenue ledger" description={`${naira(collected)} reconciled · ${naira(owed)} outstanding across ${outstanding.length} invoice(s)`}>
        {loading ? (
          <RowsSkeleton rows={3} columns={2} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {byCode.map((c) => (
              <div key={c.value} className="rounded-lg border border-border p-3.5">
                <p className="text-[12px] text-muted-foreground">{c.label}</p>
                <p className="figure mt-1 text-[20px] font-semibold text-foreground">{naira(c.total)}</p>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title={`Collections by month, ${year}`}>
        <div className="flex h-44 items-end gap-2">
          {monthly.map((x) => (
            <div key={x.m} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={naira(x.total)}>
              <div className="w-full rounded-t bg-[hsl(var(--chart-2))]" style={{ height: `${(x.total / peak) * 100}%`, minHeight: x.total ? 4 : 0 }} />
              <span className="text-[10.5px] text-muted-foreground">{x.m}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Recent reconciliations" bodyClassName="p-3 sm:p-4">
        {!reconciled.length ? (
          <EmptyState icon={BadgeCheck} title="Nothing reconciled yet" description="Verified payments appear here." />
        ) : (
          <table className="w-full text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-2 py-2">RRR</th>
                <th className="px-2 py-2">Payer</th>
                <th className="px-2 py-2">Ledger</th>
                <th className="px-2 py-2 text-right">Credited</th>
                <th className="px-2 py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {reconciled.slice(0, 20).map((r) => (
                <tr key={`${r.route}-${r.id}`} className="border-b border-border/60">
                  <td className="px-2 py-2 font-mono">{String(r.payment?.remitaRrr ?? "")}</td>
                  <td className="px-2 py-2">{r.companyName ?? r.applicantName}</td>
                  <td className="px-2 py-2">{String(r.payment?.financeLedgerCode ?? "")}</td>
                  <td className="figure px-2 py-2 text-right">{naira(credited(r))}</td>
                  <td className="px-2 py-2">{formatDate(r.payment?.bankTransactionTimestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  )
}
DOAS_EOF

# ============================================================================
w app/api/remita/verify/route.ts <<'DOAS_EOF'
import crypto from "crypto"
import { NextResponse } from "next/server"

/**
 * Server-side Remita RRR status check. Keys never reach the browser.
 * Env (.env.local): REMITA_MERCHANT_ID, REMITA_API_KEY, REMITA_BASE_URL
 *   (e.g. https://login.remita.net for live, https://demo.remita.net for demo).
 * Confirm the path and hash scheme against your Remita integration pack.
 */
export async function GET(request: Request) {
  const rrr = (new URL(request.url).searchParams.get("rrr") ?? "").replace(/\D/g, "")
  if (rrr.length !== 12) return NextResponse.json({ error: "RRR must be 12 digits" }, { status: 400 })

  const merchantId = process.env.REMITA_MERCHANT_ID
  const apiKey = process.env.REMITA_API_KEY
  const base = process.env.REMITA_BASE_URL
  if (!merchantId || !apiKey || !base) return NextResponse.json({ configured: false })

  const hash = crypto.createHash("sha512").update(rrr + apiKey + merchantId).digest("hex")
  const url = `${base}/remita/exapp/api/v1/send/api/echannelsvc/${merchantId}/${rrr}/${hash}/status.reg`

  try {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json", Authorization: `remitaConsumerKey=${merchantId},remitaConsumerToken=${hash}` },
      cache: "no-store",
    })
    const text = await res.text()
    const json = JSON.parse(text.replace(/^jsonp\s*\(|\)\s*;?$/g, ""))
    const paid = ["00", "01"].includes(String(json.status))
    return NextResponse.json({
      configured: true,
      found: Boolean(json.RRR ?? json.rrr),
      paid,
      amount: Number(json.amount ?? 0) || undefined,
      transactionTime: json.transactiontime ?? json.paymentDate ?? undefined,
      message: json.message ?? json.status,
    })
  } catch (err) {
    return NextResponse.json({ configured: true, found: false, paid: false, message: err instanceof Error ? err.message : "Remita unreachable" }, { status: 502 })
  }
}
DOAS_EOF

# ============================================================================
w components/director/review-panels.tsx <<'DOAS_EOF'
"use client"

import * as React from "react"
import { addDoc, collection, doc, limit, orderBy, updateDoc } from "firebase/firestore"
import { BadgeCheck, CalendarCheck, CalendarDays, CalendarX, Clock3, Forward, Receipt, RotateCcw, Stamp, Undo2, XCircle } from "lucide-react"
import { COL, db } from "@/lib/firebase"
import { DEPARTMENT, DIRECTOR_DESK, IN_FLIGHT, STATUS, stage } from "@/lib/workflow"
import { useRealtimeCollection } from "@/hooks/use-firestore"
import { formatDate, formatDateTime, naira, truncate } from "@/lib/format"
import { toast } from "@/components/ui/toast"
import { Sheet } from "@/components/dashboard/sheet"
import { ActionButton, TextareaField } from "@/components/dashboard/form-kit"
import { EmptyState, Field, LoadFailed, Panel, RowsSkeleton, SectionLabel, StatusPill, UrgencyPill } from "@/components/dashboard/kit"
import { WorkQueue, type QueueAction, type SubmissionRow } from "@/components/dashboard/work-queue"

/* ------------------------------------------------------------------ *
 * The gatekeeper desk. Every inter-department move is decided here.
 * ------------------------------------------------------------------ */

const decline: QueueAction = {
  key: "decline",
  label: "Decline",
  tone: "danger",
  icon: XCircle,
  status: STATUS.declined,
  department: DEPARTMENT.csu,
  record: "Declined by the Director",
  kind: "error",
  requiresReason: true,
}

const returnForChanges: QueueAction = {
  key: "return",
  label: "Return for changes",
  tone: "danger",
  icon: RotateCcw,
  status: STATUS.changesRequested,
  department: DEPARTMENT.csu,
  record: "Returned to applicant for changes by the Director",
  kind: "error",
  requiresReason: true,
}

function fieldDesk(row: SubmissionRow) {
  return row.route === "first"
    ? { status: STATUS.siteVisit, department: DEPARTMENT.businessDevelopment, name: "Business Development", verb: "site visit" }
    : { status: STATUS.planningReview, department: DEPARTMENT.planning, name: "Planning", verb: "technical vetting" }
}

function directorActions(row: SubmissionRow): QueueAction[] {
  const s = row.status ?? ""
  const field = fieldDesk(row)

  const toField = (reason: boolean): QueueAction => ({
    key: reason ? "back-to-field" : "to-field",
    label: reason ? `Send back to ${field.name}` : `Accept — send for ${field.verb}`,
    tone: reason ? "danger" : "primary",
    icon: reason ? Undo2 : Forward,
    status: field.status,
    department: field.department,
    record: reason ? `Returned to ${field.name} for re-inspection by the Director` : `Digital signature appended — routed to ${field.name}`,
    requiresReason: reason,
  })

  const toBilling = (label: string, record: string, reason = false): QueueAction => ({
    key: reason ? "billing-reason" : "to-billing",
    label,
    tone: reason ? "danger" : "primary",
    icon: Receipt,
    status: STATUS.billingAssessment,
    department: DEPARTMENT.billing,
    record,
    requiresReason: reason,
  })

  if (stage("withDirector").includes(s)) return [decline, returnForChanges, toField(false)]

  if ((row.route === "first" && stage("visitReported").includes(s)) || (row.route === "third" && stage("planningReported").includes(s))) {
    const clash = String(row.technicalReport?.clashDetectionStatus ?? "")
    const actions: QueueAction[] = clash === "Rejected_Overlap" ? [decline, toField(true)] : [toField(true)]
    if (row.measurements?.items?.length) actions.push(toBilling("Verify measurements — send to Billing", "Measurements verified by the Director — routed to Billing"))
    return actions
  }

  if (stage("billingQueried").includes(s)) return [toField(true), toBilling("Overrule query — return to Billing", "Billing query overruled by the Director", true)]

  if (stage("billProposed").includes(s))
    return [
      toBilling("Return for repricing", "Pricing returned to Billing by the Director", true),
      {
        key: "confirm-price",
        label: `Confirm ${naira(row.billing?.netInvoiceAmount as number)} — issue invoice`,
        icon: BadgeCheck,
        status: STATUS.awaitingPayment,
        department: DEPARTMENT.finance,
        record: s === STATUS.renewalProposed ? "Renewal pricing confirmed by the Director — invoice issued" : "Pricing confirmed by the Director — invoice issued",
      },
    ]

  if (stage("paymentFlagged").includes(s))
    return [
      decline,
      {
        key: "reverify",
        label: "Return to Finance to re-verify",
        tone: "danger",
        icon: Undo2,
        status: STATUS.awaitingPayment,
        department: DEPARTMENT.finance,
        record: "Flagged payment returned to Finance by the Director",
        requiresReason: true,
      },
    ]

  if (stage("paymentReconciled").includes(s))
    return [
      {
        key: "sign",
        label: row.registerId ? "Sign renewal — extend permit" : "Sign off — issue permit",
        icon: Stamp,
        status: STATUS.registered,
        department: DEPARTMENT.csu,
        record: row.registerId ? "Permit renewed and signed by the Director" : "Permit signed and issued by the Director",
        kind: "success",
        notify: "csu",
        register: row.route === "first" ? "first-party" : "third-party",
      },
    ]

  return []
}

export function DirectorSubmissions() {
  return (
    <WorkQueue
      title="Director's desk"
      description="Every file waiting for your signature before it can move"
      actorId="director"
      views={[
        {
          value: "decisions",
          label: "Your decision",
          routes: ["first", "third"],
          statuses: DIRECTOR_DESK,
          empty: { title: "Nothing waiting on you", body: "Files arrive here between every desk — intake, field reports, bills and payments." },
          actionsFor: directorActions,
          column: { header: "Stage", render: (row) => row.status ?? "—" },
        },
        {
          value: "moving",
          label: "With other desks",
          routes: ["first", "third"],
          statuses: IN_FLIGHT,
          empty: { title: "Nothing out with other desks", body: "Files you've routed onward show here until they come back." },
          column: { header: "With", render: (row) => row.department ?? "—" },
        },
        {
          value: "closed",
          label: "Closed",
          routes: ["first", "third"],
          statuses: [...stage("issued"), ...stage("blocked")],
          empty: { title: "Nothing closed yet", body: "Issued, declined and returned files stay here." },
          column: { header: "Permit", render: (row) => (row.permitNumber ? <span className="font-mono text-[11.5px]">{row.permitNumber}</span> : "—") },
        },
      ]}
    />
  )
}

/* ------------------------------------------------------------------ *
 * Meeting requests
 * ------------------------------------------------------------------ */

interface MeetingDoc {
  fullName?: string
  email?: string
  phoneNumber?: string
  organization?: string
  purpose?: string
  preferredDate?: string
  preferredTime?: string
  urgency?: string
  status?: string
  notes?: string
  directorComment?: string
  responseDate?: string
  createdAt?: unknown
}

export function DirectorMeetings() {
  const [selected, setSelected] = React.useState<(MeetingDoc & { id: string }) | null>(null)
  const [reply, setReply] = React.useState("")
  const [busy, setBusy] = React.useState(false)

  const { data, loading, error } = useRealtimeCollection<MeetingDoc>(COL.meetings, [orderBy("createdAt", "desc"), limit(150)], [])
  const rows = React.useMemo(() => data.filter((m) => ["forwarded", "approved", "rejected", "scheduled"].includes(m.status ?? "")), [data])

  const decide = async (decision: "approved" | "rejected") => {
    if (!selected || busy) return
    if (decision === "rejected" && !reply.trim()) {
      toast.warning({ title: "Give a reason", description: "The visitor sees this." })
      return
    }
    setBusy(true)
    const now = new Date().toISOString()
    try {
      await updateDoc(doc(db, COL.meetings, selected.id), { status: decision, directorComment: reply, responseDate: now, updatedAt: now })
      await addDoc(collection(db, COL.notifications), {
        userId: "csu",
        content: `Meeting request for ${selected.fullName ?? "a visitor"} was ${decision} by the Director.${reply ? ` Note: ${reply}` : ""}`,
        type: decision === "approved" ? "success" : "error",
        referenceId: selected.id,
        isRead: false,
        createdAt: now,
      })
      toast.success({ title: decision === "approved" ? "Meeting approved" : "Meeting rejected", description: selected.fullName })
      setSelected(null)
      setReply("")
    } catch (err) {
      toast.error({ title: "Decision not saved", description: err instanceof Error ? err.message : "Try again." })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Panel title="Meeting requests" description="Visitors CSU has forwarded for your decision" bodyClassName="p-3 sm:p-4">
        {error ? (
          <LoadFailed error={error} what="Meeting requests" />
        ) : loading ? (
          <RowsSkeleton rows={4} columns={4} />
        ) : !rows.length ? (
          <EmptyState icon={CalendarDays} title="No meeting requests" description="CSU screens requests first — the ones worth your time arrive here." />
        ) : (
          <ul className="space-y-2">
            {rows.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(m)
                    setReply("")
                  }}
                  className="flex w-full flex-col gap-2 rounded-lg border border-border bg-card px-3.5 py-3 text-left hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-semibold text-foreground">{m.fullName}</p>
                    <p className="text-[12.5px] text-muted-foreground">{m.organization || m.email}</p>
                    <p className="mt-1 text-[12.5px] text-muted-foreground">{truncate(m.purpose, 72)}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatDate(m.preferredDate)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground">
                      <Clock3 className="h-3.5 w-3.5" />
                      {m.preferredTime || "—"}
                    </span>
                    <UrgencyPill urgency={m.urgency} />
                    <StatusPill status={m.status} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Sheet
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Meeting request"
        caption={selected?.fullName ?? ""}
        width="max-w-xl"
        footer={
          selected ? (
            <div className="flex flex-wrap justify-end gap-2">
              <ActionButton tone="quiet" onClick={() => setSelected(null)}>
                Close
              </ActionButton>
              {selected.status === "forwarded" ? (
                <>
                  <ActionButton tone="danger" icon={CalendarX} disabled={busy} onClick={() => decide("rejected")}>
                    Reject
                  </ActionButton>
                  <ActionButton icon={CalendarCheck} disabled={busy} onClick={() => decide("approved")}>
                    Approve
                  </ActionButton>
                </>
              ) : null}
            </div>
          ) : null
        }
      >
        {selected ? (
          <div className="space-y-6">
            <div>
              <SectionLabel>Visitor</SectionLabel>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Name" value={selected.fullName} />
                <Field label="Organisation" value={selected.organization} />
                <Field label="Email" value={selected.email} />
                <Field label="Phone" value={selected.phoneNumber} />
                <Field label="Preferred date" value={formatDate(selected.preferredDate)} />
                <Field label="Preferred time" value={selected.preferredTime} />
                <Field label="Urgency" value={<UrgencyPill urgency={selected.urgency} />} />
                <Field label="Requested" value={formatDateTime(selected.createdAt)} />
                <Field label="Purpose" value={selected.purpose} className="col-span-2" />
                {selected.notes ? <Field label="CSU notes" value={selected.notes} className="col-span-2" /> : null}
              </div>
            </div>
            {selected.status !== "forwarded" ? (
              <div>
                <SectionLabel>Your decision</SectionLabel>
                <StatusPill status={selected.status} />
                {selected.directorComment ? <p className="mt-2 text-[13px] text-muted-foreground">{selected.directorComment}</p> : null}
              </div>
            ) : (
              <TextareaField id="meeting-reply" label="Note for CSU" value={reply} rows={3} placeholder="Required when rejecting." onChange={setReply} />
            )}
          </div>
        ) : null}
      </Sheet>
    </>
  )
}
DOAS_EOF

# ============================================================================
w components/csu/submissions-queue.tsx <<'DOAS_EOF'
"use client"

import { Forward, Send } from "lucide-react"
import { DEPARTMENT, DIRECTOR_DESK, IN_FLIGHT, STATUS, stage } from "@/lib/workflow"
import { WorkQueue } from "@/components/dashboard/work-queue"

/** CSU screens intake and hands every file to the Director — never to a unit directly. */
export function CsuSubmissions() {
  return (
    <WorkQueue
      title="Submissions"
      description="Screen what has been filed, then pass it to the Director"
      actorId="csu"
      views={[
        {
          value: "new",
          label: "To screen",
          routes: ["first", "third"],
          statuses: stage("withCsu"),
          empty: { title: "Nothing waiting to be screened", body: "Portal applications land here the moment they're submitted." },
          column: { header: "Area council", render: (row) => row.areaCouncil ?? "—" },
          actions: [
            {
              key: "forward",
              label: "Documents complete — send to Director",
              icon: Forward,
              status: STATUS.withDirector,
              department: DEPARTMENT.director,
              record: "Screened by CSU — assigned to Director",
            },
          ],
        },
        {
          value: "returned",
          label: "Returned",
          routes: ["first", "third"],
          statuses: stage("blocked"),
          empty: { title: "Nothing sent back", body: "Declined or returned files come here with the reason attached." },
          actions: [
            {
              key: "resend",
              label: "Applicant has updated — resend",
              icon: Send,
              status: STATUS.withDirector,
              department: DEPARTMENT.director,
              record: "Updated by applicant and resent by CSU",
              requiresReason: true,
            },
          ],
        },
        {
          value: "moving",
          label: "In progress",
          routes: ["first", "third"],
          statuses: [...DIRECTOR_DESK, ...IN_FLIGHT],
          empty: { title: "Nothing in progress", body: "Follow every file through each desk from here." },
          column: { header: "With", render: (row) => row.department ?? "—" },
        },
        {
          value: "issued",
          label: "Permits issued",
          routes: ["first", "third"],
          statuses: stage("issued"),
          empty: { title: "No permits issued yet", body: "Signed permits appear here for hand-over to the applicant." },
          column: { header: "Permit", render: (row) => (row.permitNumber ? <span className="font-mono text-[11.5px]">{row.permitNumber}</span> : "—") },
        },
      ]}
    />
  )
}
DOAS_EOF

# ============================================================================
w components/monitoring/review-panel.tsx <<'DOAS_EOF'
"use client"

import * as React from "react"
import { addDoc, collection, limit, orderBy, serverTimestamp } from "firebase/firestore"
import { ShieldAlert, ShieldCheck } from "lucide-react"
import { db } from "@/lib/firebase"
import { COMPLIANCE_COLLECTION, REGISTER_COLLECTION, daysUntil } from "@/lib/workflow"
import { useCurrentUser, useRealtimeCollection } from "@/hooks/use-firestore"
import { formatDate } from "@/lib/format"
import { toast } from "@/components/ui/toast"
import { ActionButton } from "@/components/dashboard/form-kit"
import { EmptyState, LoadFailed, Panel, RowsSkeleton, StatusPill, TONE } from "@/components/dashboard/kit"
import { Segmented } from "@/components/dashboard/notifications-panel"
import { cn } from "@/lib/utils"

interface RegisterDoc {
  permitNumber?: string
  holderName?: string
  address?: string
  gpsCoordinates?: string
  category?: string
  status?: string
  expiresAt?: string
}

export function useEnforcementTargets() {
  const register = useRealtimeCollection<RegisterDoc>(REGISTER_COLLECTION, [orderBy("expiresAt", "asc"), limit(500)], [])
  const issues = useRealtimeCollection<{ permitNumber?: string; status?: string }>(COMPLIANCE_COLLECTION, [limit(500)], [])
  const flagged = new Set(issues.data.filter((i) => i.status !== "Resolved" && i.permitNumber).map((i) => i.permitNumber))
  const rows = register.data.map((e) => ({ ...e, days: daysUntil(e.expiresAt), flagged: flagged.has(e.permitNumber) }))
  return {
    rows,
    expired: rows.filter((r) => r.days !== null && r.days < 0 && r.status !== "Renewal Invoiced"),
    expiring: rows.filter((r) => r.days !== null && r.days >= 0 && r.days <= 30),
    loading: register.loading,
    error: register.error,
  }
}

export function EnforcementPanel() {
  const { user } = useCurrentUser()
  const { expired, expiring, loading, error } = useEnforcementTargets()
  const [tab, setTab] = React.useState<"expired" | "expiring">("expired")
  const [busy, setBusy] = React.useState<string | null>(null)
  const rows = tab === "expired" ? expired : expiring

  const log = async (e: (typeof rows)[number]) => {
    setBusy(e.id)
    try {
      await addDoc(collection(db, COMPLIANCE_COLLECTION), {
        site: e.address || e.permitNumber,
        owner: e.holderName ?? "",
        coordinates: e.gpsCoordinates ?? "",
        permitNumber: e.permitNumber,
        issue: `Permit ${e.permitNumber} expired on ${formatDate(e.expiresAt)} — board still standing`,
        severity: (e.days ?? 0) < -30 ? "high" : "medium",
        status: "Open",
        raisedBy: user?.displayName || user?.email || "Monitoring and Enforcement",
        createdAt: serverTimestamp(),
      })
      toast.success({ title: "Compliance issue logged", description: e.holderName })
    } catch (err) {
      toast.error({ title: "Not logged", description: err instanceof Error ? err.message : "Try again." })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Panel
      title="Field enforcement targets"
      description="Permits past expiry are boards standing without a valid permit."
      actions={
        <Segmented
          value={tab}
          onChange={(v) => setTab(v as typeof tab)}
          options={[
            { value: "expired", label: `Expired (${expired.length})` },
            { value: "expiring", label: `Expiring ≤30d (${expiring.length})` },
          ]}
        />
      }
      bodyClassName="p-3 sm:p-4"
    >
      {error ? (
        <LoadFailed error={error} what="The permit register" />
      ) : loading ? (
        <RowsSkeleton rows={4} columns={4} />
      ) : !rows.length ? (
        <EmptyState icon={ShieldCheck} title="Nothing in this view" description="Every permit on the register is currently valid." />
      ) : (
        <ul className="space-y-2">
          {rows.map((e) => (
            <li key={e.id} className="flex flex-col gap-2 rounded-lg border border-border px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[13.5px] font-semibold text-foreground">{e.holderName}</p>
                <p className="text-[12px] text-muted-foreground">
                  {e.permitNumber} · {e.address}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={cn("text-[12px] font-semibold", (e.days ?? 0) < 0 ? TONE.stop.text : TONE.wait.text)}>
                  {(e.days ?? 0) < 0 ? `${-(e.days ?? 0)} days overdue` : `${e.days} days left`}
                </span>
                {e.flagged ? (
                  <StatusPill status="Issue open" tone="wait" />
                ) : tab === "expired" ? (
                  <ActionButton tone="quiet" icon={ShieldAlert} disabled={busy === e.id} onClick={() => log(e)}>
                    Log issue
                  </ActionButton>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
DOAS_EOF

# ============================================================================
w app/dashboard/csu/page.tsx <<'DOAS_EOF'
"use client"

import * as React from "react"
import { limit, orderBy } from "firebase/firestore"
import { BadgeCheck, Bell, CalendarDays, CheckCircle2, ClipboardList, FileText, Inbox, LayoutDashboard, ListTodo, MessagesSquare, ScrollText, Users } from "lucide-react"
import { COL } from "@/lib/firebase"
import { channelsFor, stage } from "@/lib/workflow"
import { RegisterPanel } from "@/components/shared/register-panel"
import { useRealtimeCollection } from "@/hooks/use-firestore"
import { formatDate, initials, timeAgo, truncate } from "@/lib/format"
import { typeLabel } from "@/lib/tariff"
import { DashboardShell, type ShellNavItem } from "@/components/dashboard/shell"
import { ChatPanel } from "@/components/dashboard/chat-panel"
import { NotificationsPanel } from "@/components/dashboard/notifications-panel"
import { TasksPanel } from "@/components/dashboard/tasks-panel"
import { useSubmissions } from "@/components/dashboard/work-queue"
import { EmptyState, PageHeading, Panel, RowsSkeleton, StatTile, StatusPill, TONE, toneForStatus } from "@/components/dashboard/kit"
import { CsuSubmissions } from "@/components/csu/submissions-queue"
import MeetingRequestsPanel from "@/components/csu/meeting-requests-panel"
import PractitionerUploadPanel from "@/components/csu/practitioner-upload-panel"

interface ActivityRow {
  action?: string
  comment?: string
  userId?: string
  timestamp?: unknown
}

export default function CSUDashboard() {
  const [tab, setTab] = React.useState("overview")
  const { rows, loading } = useSubmissions(200)

  const practitioners = useRealtimeCollection<{ status?: string }>(COL.practitioners, [orderBy("timestamp", "desc"), limit(400)], [])
  const meetings = useRealtimeCollection<{ status?: string }>(COL.meetings, [orderBy("createdAt", "desc"), limit(200)], [])
  const activity = useRealtimeCollection<ActivityRow>(COL.activity, [orderBy("timestamp", "desc"), limit(12)], [])

  const waiting = rows.filter((r) => stage("withCsu").includes(r.status ?? "")).length
  const returned = rows.filter((r) => stage("blocked").includes(r.status ?? "")).length
  const issued = rows.filter((r) => stage("issued").includes(r.status ?? "")).length
  const meetingsWaiting = meetings.data.filter((m) => (m.status ?? "") === "pending").length
  const activePractitioners = practitioners.data.filter((p) => (p.status ?? "active") === "active").length

  const nav: ShellNavItem[] = [
    { value: "overview", label: "Overview", icon: LayoutDashboard },
    { value: "submissions", label: "Submissions", icon: FileText, badge: waiting + returned },
    { value: "register", label: "Permit register", icon: ScrollText },
    { value: "meetings", label: "Meeting requests", icon: CalendarDays, badge: meetingsWaiting },
    { value: "practitioners", label: "Practitioners", icon: Users },
    { value: "chat", label: "Chat", icon: MessagesSquare },
    { value: "tasks", label: "Tasks", icon: ListTodo },
    { value: "notifications", label: "Notifications", icon: Bell },
  ]

  return (
    <DashboardShell audience="csu" unitName="Customer Service Unit" unitCaption="Customer Service Unit" nav={nav} active={tab} onNavigate={setTab}>
      {tab === "overview" ? (
        <div className="space-y-6">
          <PageHeading
            title="Customer Service Unit"
            description="First point of contact. Screen what comes in, send complete files to the Director, and hand issued permits back to applicants."
          />

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile index={0} label="Waiting on your screening" value={waiting} tone="wait" icon={Inbox} onClick={() => setTab("submissions")} />
            <StatTile index={1} label="Meeting requests to screen" value={meetingsWaiting} tone="move" icon={CalendarDays} onClick={() => setTab("meetings")} />
            <StatTile index={2} label="Permits issued" value={issued} tone="clear" icon={CheckCircle2} onClick={() => setTab("register")} />
            <StatTile
              index={3}
              label="Active practitioners"
              value={activePractitioners}
              tone="idle"
              icon={BadgeCheck}
              note={`${practitioners.data.length} on the register`}
              onClick={() => setTab("practitioners")}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <Panel
              className="lg:col-span-3"
              title="Latest submissions"
              description="Newest first, across both routes"
              actions={
                <button type="button" onClick={() => setTab("submissions")} className="rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] font-semibold hover:bg-muted">
                  Open queue
                </button>
              }
              bodyClassName="p-3 sm:p-4"
            >
              {loading ? (
                <RowsSkeleton rows={5} columns={4} />
              ) : !rows.length ? (
                <EmptyState icon={FileText} title="No submissions yet" description="Applications filed from the public portal land here the moment they're submitted." />
              ) : (
                <ul className="divide-y divide-border">
                  {rows.slice(0, 6).map((row) => (
                    <li key={`${row.route}-${row.id}`} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted font-display text-[11.5px] font-semibold text-muted-foreground">
                        {initials(row.companyName || row.applicantName)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-medium text-foreground">{row.companyName ?? row.applicantName ?? "Unnamed applicant"}</p>
                        <p className="truncate text-[12px] text-muted-foreground">
                          {truncate(typeLabel(row.applicationType), 40)} · {formatDate(row.createdAt)}
                        </p>
                      </div>
                      <StatusPill status={row.status} />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel className="lg:col-span-2" title="Recent activity" description="Every decision recorded across the directorate" bodyClassName="p-3 sm:p-4">
              {activity.loading ? (
                <RowsSkeleton rows={4} columns={2} />
              ) : !activity.data.length ? (
                <EmptyState icon={ClipboardList} title="No activity recorded" description="Every hand-off writes an entry here." />
              ) : (
                <ol className="space-y-3.5">
                  {activity.data.map((entry) => (
                    <li key={entry.id} className="flex gap-3">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE[toneForStatus(entry.action)].dot}`} aria-hidden />
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium leading-snug text-foreground">{entry.action ?? "Update"}</p>
                        <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                          {entry.userId ? `${entry.userId} · ` : ""}
                          {timeAgo(entry.timestamp)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          </div>
        </div>
      ) : null}

      {tab === "submissions" ? (
        <div className="space-y-5">
          <PageHeading title="Submissions" description="Screen what has been filed, then send it to the Director. CSU never routes to a unit directly." />
          <CsuSubmissions />
        </div>
      ) : null}

      {tab === "register" ? (
        <div className="space-y-5">
          <PageHeading title="Permit register" description="Everyone holding a live DOAS permit. Entries are written when the Director signs the permit." />
          <RegisterPanel />
        </div>
      ) : null}

      {tab === "meetings" ? (
        <div className="space-y-5">
          <PageHeading title="Meeting requests" description="Screen visitor requests before they reach the Director's diary." />
          <MeetingRequestsPanel />
        </div>
      ) : null}

      {tab === "practitioners" ? (
        <div className="space-y-5">
          <PageHeading title="Practitioners" description="The register of licensed signage practitioners and the firms they work for." />
          <PractitionerUploadPanel />
        </div>
      ) : null}

      {tab === "chat" ? <ChatPanel role="csu" channels={channelsFor("csu")} /> : null}
      {tab === "tasks" ? <TasksPanel unit="CSU" /> : null}
      {tab === "notifications" || tab === "settings" ? <NotificationsPanel audience="csu" /> : null}
    </DashboardShell>
  )
}
DOAS_EOF

# ============================================================================
w app/dashboard/director/page.tsx <<'DOAS_EOF'
"use client"

import * as React from "react"
import { limit, orderBy } from "firebase/firestore"
import { BadgeCheck, BarChart3, Bell, CalendarDays, CheckCircle2, FileText, Gavel, LayoutDashboard, ListTodo, MessagesSquare, Receipt, ScrollText, ShieldAlert, Stamp, Users } from "lucide-react"
import { COL } from "@/lib/firebase"
import { COMPLIANCE_COLLECTION, DEPARTMENT, DIRECTOR_DESK, channelsFor, stage } from "@/lib/workflow"
import { useRealtimeCollection } from "@/hooks/use-firestore"
import { DashboardShell, type ShellNavItem } from "@/components/dashboard/shell"
import { ChatPanel } from "@/components/dashboard/chat-panel"
import { NotificationsPanel } from "@/components/dashboard/notifications-panel"
import { TasksPanel } from "@/components/dashboard/tasks-panel"
import { useSubmissions } from "@/components/dashboard/work-queue"
import { DirectorMeetings, DirectorSubmissions } from "@/components/director/review-panels"
import { DirectorateReport } from "@/components/director/oversight-panel"
import { CompliancePanel } from "@/components/monitoring/compliance-panel"
import { StaffPanel } from "@/components/shared/staff-panel"
import { RegisterPanel } from "@/components/shared/register-panel"
import { PageHeading, StatTile } from "@/components/dashboard/kit"
import PractitionerUploadPanel from "@/components/csu/practitioner-upload-panel"

export default function DirectorDashboard() {
  const [tab, setTab] = React.useState("overview")
  const { rows } = useSubmissions()
  const meetings = useRealtimeCollection<{ status?: string }>(COL.meetings, [orderBy("createdAt", "desc"), limit(200)], [])
  const issues = useRealtimeCollection<{ status?: string }>(COMPLIANCE_COLLECTION, [limit(300)], [])

  const has = (statuses: string[]) => rows.filter((r) => statuses.includes(r.status ?? "")).length
  const onDesk = has(DIRECTOR_DESK)
  const pricing = has(stage("billProposed"))
  const signoffs = has(stage("paymentReconciled"))
  const issued = has(stage("issued"))
  const meetingsWaiting = meetings.data.filter((m) => m.status === "forwarded").length
  const openIssues = issues.data.filter((i) => i.status !== "Resolved").length

  const nav: ShellNavItem[] = [
    { value: "overview", label: "Overview", icon: LayoutDashboard },
    { value: "applications", label: "Director's desk", icon: FileText, badge: onDesk },
    { value: "meetings", label: "Meeting requests", icon: CalendarDays, badge: meetingsWaiting },
    { value: "reports", label: "Reports", icon: BarChart3 },
    { value: "register", label: "Permit register", icon: ScrollText },
    { value: "practitioners", label: "Practitioners", icon: BadgeCheck },
    { value: "compliance", label: "Compliance", icon: ShieldAlert, badge: openIssues },
    { value: "staff", label: "Staff", icon: Users },
    { value: "chat", label: "Chat", icon: MessagesSquare },
    { value: "tasks", label: "Tasks", icon: ListTodo },
    { value: "notifications", label: "Notifications", icon: Bell },
  ]

  return (
    <DashboardShell audience="director" unitName="Director's Office" unitCaption="Director's Office" nav={nav} active={tab} onNavigate={setTab}>
      {tab === "overview" ? (
        <div className="space-y-6">
          <PageHeading title="Director's Office" description="No file moves between departments without your signature. Everything waiting on you is below." />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile index={0} label="On your desk" value={onDesk} tone="wait" icon={Gavel} onClick={() => setTab("applications")} />
            <StatTile index={1} label="Bills to confirm" value={pricing} tone="move" icon={Receipt} note="From Billing, incl. renewals" onClick={() => setTab("applications")} />
            <StatTile index={2} label="Permits to sign" value={signoffs} tone="move" icon={Stamp} note="Payment reconciled by Finance" onClick={() => setTab("applications")} />
            <StatTile index={3} label="Permits issued" value={issued} tone="clear" icon={CheckCircle2} note={`${rows.length} files on record`} onClick={() => setTab("register")} />
          </div>
          <DirectorSubmissions />
        </div>
      ) : null}
      {tab === "applications" ? (
        <div className="space-y-5">
          <PageHeading title="Director's desk" description="Accept, return, or route each file to the next desk." />
          <DirectorSubmissions />
        </div>
      ) : null}
      {tab === "meetings" ? <DirectorMeetings /> : null}
      {tab === "reports" ? <DirectorateReport /> : null}
      {tab === "register" ? <RegisterPanel /> : null}
      {tab === "practitioners" ? <PractitionerUploadPanel /> : null}
      {tab === "compliance" ? <CompliancePanel unit={DEPARTMENT.director} /> : null}
      {tab === "staff" ? <StaffPanel /> : null}
      {tab === "chat" ? <ChatPanel role="director" channels={channelsFor("director")} /> : null}
      {tab === "tasks" ? <TasksPanel unit={DEPARTMENT.director} /> : null}
      {tab === "notifications" || tab === "settings" ? <NotificationsPanel audience="director" /> : null}
    </DashboardShell>
  )
}
DOAS_EOF

# ============================================================================
w app/dashboard/business-development/page.tsx <<'DOAS_EOF'
"use client"

import * as React from "react"
import { Bell, Camera, CheckCircle2, ClipboardCheck, FolderOpen, LayoutDashboard, ListTodo, MessagesSquare } from "lucide-react"
import { DEPARTMENT, channelsFor, stage } from "@/lib/workflow"
import { DashboardShell, type ShellNavItem } from "@/components/dashboard/shell"
import { ChatPanel } from "@/components/dashboard/chat-panel"
import { NotificationsPanel } from "@/components/dashboard/notifications-panel"
import { TasksPanel } from "@/components/dashboard/tasks-panel"
import { PageHeading, StatTile } from "@/components/dashboard/kit"
import { useSubmissions } from "@/components/dashboard/work-queue"
import { BusinessDevelopmentArchive, BusinessDevelopmentHistory, BusinessDevelopmentQueue } from "@/components/business-development/site-visit-panel"

export default function BusinessDevelopmentDashboard() {
  const [tab, setTab] = React.useState("overview")
  const { rows } = useSubmissions()
  const fp = rows.filter((r) => r.route === "first")
  const toVisit = fp.filter((r) => stage("siteVisit").includes(r.status ?? "")).length
  const reported = fp.filter((r) => stage("visitReported").includes(r.status ?? "")).length
  const issued = fp.filter((r) => stage("issued").includes(r.status ?? "")).length

  const nav: ShellNavItem[] = [
    { value: "overview", label: "Overview", icon: LayoutDashboard },
    { value: "visits", label: "Site visits", icon: Camera, badge: toVisit },
    { value: "reported", label: "Reported", icon: ClipboardCheck },
    { value: "applications", label: "All applications", icon: FolderOpen },
    { value: "chat", label: "Chat", icon: MessagesSquare },
    { value: "tasks", label: "Tasks", icon: ListTodo },
    { value: "notifications", label: "Notifications", icon: Bell },
  ]

  return (
    <DashboardShell audience="business_development" unitName="Business Development" unitCaption="Business Development" nav={nav} active={tab} onNavigate={setTab}>
      {tab === "overview" ? (
        <div className="space-y-6">
          <PageHeading title="Business Development" description="Inspect first-party sites, measure and photograph every sign, and lock the parameters Billing prices from." />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile index={0} label="Visits to make" value={toVisit} tone="wait" icon={Camera} note="Routed by the Director" onClick={() => setTab("visits")} />
            <StatTile index={1} label="Reports with the Director" value={reported} tone="move" icon={ClipboardCheck} />
            <StatTile index={2} label="Permits issued" value={issued} tone="clear" icon={CheckCircle2} />
            <StatTile index={3} label="First-party files" value={fp.length} tone="idle" icon={FolderOpen} onClick={() => setTab("applications")} />
          </div>
          <BusinessDevelopmentQueue />
        </div>
      ) : null}
      {tab === "visits" ? <BusinessDevelopmentQueue /> : null}
      {tab === "reported" ? <BusinessDevelopmentHistory /> : null}
      {tab === "applications" ? <BusinessDevelopmentArchive /> : null}
      {tab === "chat" ? <ChatPanel role="business_development" channels={channelsFor("business_development")} /> : null}
      {tab === "tasks" ? <TasksPanel unit={DEPARTMENT.businessDevelopment} /> : null}
      {tab === "notifications" || tab === "settings" ? <NotificationsPanel audience="business_development" /> : null}
    </DashboardShell>
  )
}
DOAS_EOF

# ============================================================================
w app/dashboard/planning/page.tsx <<'DOAS_EOF'
"use client"

import * as React from "react"
import { AlertTriangle, Bell, ClipboardCheck, LayoutDashboard, ListTodo, Map, MessagesSquare, Ruler } from "lucide-react"
import { DEPARTMENT, channelsFor, stage } from "@/lib/workflow"
import { DashboardShell, type ShellNavItem } from "@/components/dashboard/shell"
import { ChatPanel } from "@/components/dashboard/chat-panel"
import { NotificationsPanel } from "@/components/dashboard/notifications-panel"
import { TasksPanel } from "@/components/dashboard/tasks-panel"
import { PageHeading, StatTile } from "@/components/dashboard/kit"
import { useSubmissions } from "@/components/dashboard/work-queue"
import { PlanningQueue } from "@/components/planning/review-panel"
import { SiteMapPanel } from "@/components/planning/site-map-panel"

export default function PlanningDashboard() {
  const [tab, setTab] = React.useState("overview")
  const { rows } = useSubmissions()
  const toVet = rows.filter((r) => r.department === DEPARTMENT.planning && stage("planningReview").includes(r.status ?? "")).length
  const reported = rows.filter((r) => stage("planningReported").includes(r.status ?? "")).length
  const warnings = rows.filter((r) => ["Warning_Proximity_Issue", "Rejected_Overlap"].includes(String(r.technicalReport?.clashDetectionStatus ?? ""))).length
  const mapped = rows.filter((r) => Boolean(r.gpsCoordinates)).length

  const nav: ShellNavItem[] = [
    { value: "overview", label: "Overview", icon: LayoutDashboard },
    { value: "reviews", label: "Technical vetting", icon: Ruler, badge: toVet },
    { value: "sites", label: "Site map", icon: Map },
    { value: "chat", label: "Chat", icon: MessagesSquare },
    { value: "tasks", label: "Tasks", icon: ListTodo },
    { value: "notifications", label: "Notifications", icon: Bell },
  ]

  return (
    <DashboardShell audience="planning_development" unitName="Planning & Development" unitCaption="Planning & Development" nav={nav} active={tab} onNavigate={setTab}>
      {tab === "overview" ? (
        <div className="space-y-6">
          <PageHeading title="Planning & Development" description="Engineering and planning vetting for third-party structures: foundations, COREN sign-off, setbacks, clashes and the exclusion zone." />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile index={0} label="Structures to vet" value={toVet} tone="wait" icon={Ruler} onClick={() => setTab("reviews")} />
            <StatTile index={1} label="Reports with the Director" value={reported} tone="move" icon={ClipboardCheck} />
            <StatTile index={2} label="Clash warnings on file" value={warnings} tone={warnings ? "stop" : "clear"} icon={AlertTriangle} />
            <StatTile index={3} label="Sites with coordinates" value={mapped} tone="idle" icon={Map} onClick={() => setTab("sites")} />
          </div>
          <PlanningQueue />
        </div>
      ) : null}
      {tab === "reviews" ? <PlanningQueue /> : null}
      {tab === "sites" ? <SiteMapPanel /> : null}
      {tab === "chat" ? <ChatPanel role="planning_development" channels={channelsFor("planning_development")} /> : null}
      {tab === "tasks" ? <TasksPanel unit={DEPARTMENT.planning} /> : null}
      {tab === "notifications" || tab === "settings" ? <NotificationsPanel audience="planning_development" /> : null}
    </DashboardShell>
  )
}
DOAS_EOF

# ============================================================================
w app/dashboard/billing/page.tsx <<'DOAS_EOF'
"use client"

import * as React from "react"
import { limit, orderBy } from "firebase/firestore"
import { AlertTriangle, Bell, CalendarClock, Calculator, LayoutDashboard, ListTodo, MessagesSquare, Receipt, Table2 } from "lucide-react"
import { DEPARTMENT, REGISTER_COLLECTION, channelsFor, stage } from "@/lib/workflow"
import { useRealtimeCollection } from "@/hooks/use-firestore"
import { DashboardShell, type ShellNavItem } from "@/components/dashboard/shell"
import { ChatPanel } from "@/components/dashboard/chat-panel"
import { NotificationsPanel } from "@/components/dashboard/notifications-panel"
import { TasksPanel } from "@/components/dashboard/tasks-panel"
import { PageHeading, StatTile } from "@/components/dashboard/kit"
import { useSubmissions } from "@/components/dashboard/work-queue"
import { BillingQueue, SubscriptionTracker, TariffSchedulePanel, lifecycleOf } from "@/components/billing/billing-panels"

export default function BillingDashboard() {
  const [tab, setTab] = React.useState("overview")
  const { rows } = useSubmissions()
  const { data: register } = useRealtimeCollection<{ expiresAt?: string; status?: string }>(REGISTER_COLLECTION, [orderBy("expiresAt", "asc"), limit(500)], [])

  const toAssess = rows.filter((r) => r.department === DEPARTMENT.billing && stage("billing").includes(r.status ?? "")).length
  const proposed = rows.filter((r) => stage("billProposed").includes(r.status ?? "")).length
  const states = register.filter((e) => e.status !== "Renewal Invoiced").map((e) => lifecycleOf(e.expiresAt).state)
  const expired = states.filter((s) => s === "expired").length
  const warning = states.filter((s) => s === "warning").length

  const nav: ShellNavItem[] = [
    { value: "overview", label: "Overview", icon: LayoutDashboard },
    { value: "assess", label: "Assessments", icon: Calculator, badge: toAssess },
    { value: "lifecycle", label: "Subscriptions", icon: CalendarClock, badge: expired + warning },
    { value: "tariffs", label: "Tariff schedule", icon: Table2 },
    { value: "chat", label: "Chat", icon: MessagesSquare },
    { value: "tasks", label: "Tasks", icon: ListTodo },
    { value: "notifications", label: "Notifications", icon: Bell },
  ]

  return (
    <DashboardShell audience="billing" unitName="Billing" unitCaption="Billing Department" nav={nav} active={tab} onNavigate={setTab}>
      {tab === "overview" ? (
        <div className="space-y-6">
          <PageHeading title="Billing" description="Price locked field measurements against the gazette, set permit validity, and re-bill expiring subscriptions. Billing never handles payment." />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile index={0} label="Files to price" value={toAssess} tone="wait" icon={Calculator} note="Measurements verified by the Director" onClick={() => setTab("assess")} />
            <StatTile index={1} label="Bills with the Director" value={proposed} tone="move" icon={Receipt} note="Awaiting pricing sign-off" />
            <StatTile index={2} label="Expired — re-bill outstanding" value={expired} tone="stop" icon={AlertTriangle} onClick={() => setTab("lifecycle")} />
            <StatTile index={3} label="Expiring within 30 days" value={warning} tone="wait" icon={CalendarClock} onClick={() => setTab("lifecycle")} />
          </div>
          <BillingQueue />
        </div>
      ) : null}
      {tab === "assess" ? (
        <div className="space-y-5">
          <PageHeading title="Assessments" description="Dimensions are read-only. If they look wrong, raise a query — the Director routes it back to the field desk." />
          <BillingQueue />
        </div>
      ) : null}
      {tab === "lifecycle" ? (
        <div className="space-y-5">
          <PageHeading title="Subscriptions" description="Continuous expiry monitoring. Re-billing clones the last measured parameters." />
          <SubscriptionTracker />
        </div>
      ) : null}
      {tab === "tariffs" ? (
        <div className="space-y-5">
          <PageHeading title="Tariff schedule" description="The gazetted base rates every assessment pulls from. Saving creates a new version; existing bills keep their snapshot." />
          <TariffSchedulePanel />
        </div>
      ) : null}
      {tab === "chat" ? <ChatPanel role="billing" channels={channelsFor("billing")} /> : null}
      {tab === "tasks" ? <TasksPanel unit={DEPARTMENT.billing} /> : null}
      {tab === "notifications" || tab === "settings" ? <NotificationsPanel audience="billing" /> : null}
    </DashboardShell>
  )
}
DOAS_EOF

# ============================================================================
w app/dashboard/finance/page.tsx <<'DOAS_EOF'
"use client"

import * as React from "react"
import { BadgeCheck, Bell, BookOpen, LayoutDashboard, ListTodo, MessagesSquare, ShieldAlert, SplitSquareHorizontal, Users, Wallet } from "lucide-react"
import { DEPARTMENT, STATUS, channelsFor, stage } from "@/lib/workflow"
import { naira } from "@/lib/format"
import { DashboardShell, type ShellNavItem } from "@/components/dashboard/shell"
import { ChatPanel } from "@/components/dashboard/chat-panel"
import { NotificationsPanel } from "@/components/dashboard/notifications-panel"
import { TasksPanel } from "@/components/dashboard/tasks-panel"
import { PageHeading, StatTile } from "@/components/dashboard/kit"
import { FinanceQueue, LedgerPanel, useLedger } from "@/components/finance/finance-panels"
import { StaffPanel } from "@/components/shared/staff-panel"

export default function FinanceDashboard() {
  const [tab, setTab] = React.useState("overview")
  const { rows, collected, owed } = useLedger()

  const toVerify = rows.filter((r) => [STATUS.awaitingPayment, "Billed"].includes(r.status ?? "")).length
  const part = rows.filter((r) => r.status === STATUS.partPayment).length
  const flagged = rows.filter((r) => stage("paymentFlagged").includes(r.status ?? "")).length

  const nav: ShellNavItem[] = [
    { value: "overview", label: "Overview", icon: LayoutDashboard },
    { value: "reconcile", label: "Reconciliation", icon: BadgeCheck, badge: toVerify + part },
    { value: "ledger", label: "Ledger", icon: BookOpen },
    { value: "staff", label: "Staff", icon: Users },
    { value: "chat", label: "Chat", icon: MessagesSquare },
    { value: "tasks", label: "Tasks", icon: ListTodo },
    { value: "notifications", label: "Notifications", icon: Bell },
  ]

  return (
    <DashboardShell audience="finance" unitName="Finance & Admin" unitCaption="Finance & Admin" nav={nav} active={tab} onNavigate={setTab}>
      {tab === "overview" ? (
        <div className="space-y-6">
          <PageHeading title="Finance & Admin" description="Verify Remita and bank payments, post them to the right ledger, and reconcile. Finance never sets prices." />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile index={0} label="Payments to verify" value={toVerify} tone="wait" icon={BadgeCheck} onClick={() => setTab("reconcile")} />
            <StatTile index={1} label="Part payments open" value={part} tone="stop" icon={SplitSquareHorizontal} note={owed ? `${naira(owed)} outstanding` : "Nothing outstanding"} />
            <StatTile index={2} label="Collected (reconciled)" value={collected} tone="clear" icon={Wallet} onClick={() => setTab("ledger")} />
            <StatTile index={3} label="Flagged with the Director" value={flagged} tone="stop" icon={ShieldAlert} />
          </div>
          <FinanceQueue />
        </div>
      ) : null}
      {tab === "reconcile" ? (
        <div className="space-y-5">
          <PageHeading title="Reconciliation" description="Match the declared RRR against settlement, then dispatch the receipt to the Director for permit sign-off." />
          <FinanceQueue />
        </div>
      ) : null}
      {tab === "ledger" ? (
        <div className="space-y-5">
          <PageHeading title="Ledger" description="Every figure is computed from reconciled payments — nothing is entered twice." />
          <LedgerPanel />
        </div>
      ) : null}
      {tab === "staff" ? <StaffPanel /> : null}
      {tab === "chat" ? <ChatPanel role="finance" channels={channelsFor("finance")} /> : null}
      {tab === "tasks" ? <TasksPanel unit={DEPARTMENT.finance} /> : null}
      {tab === "notifications" || tab === "settings" ? <NotificationsPanel audience="finance" /> : null}
    </DashboardShell>
  )
}
DOAS_EOF

# ============================================================================
w app/dashboard/monitoring/page.tsx <<'DOAS_EOF'
"use client"

import * as React from "react"
import { limit } from "firebase/firestore"
import { AlertTriangle, Bell, CalendarClock, LayoutDashboard, ListTodo, MessagesSquare, ShieldAlert, ShieldCheck } from "lucide-react"
import { COMPLIANCE_COLLECTION, DEPARTMENT, channelsFor } from "@/lib/workflow"
import { useRealtimeCollection } from "@/hooks/use-firestore"
import { DashboardShell, type ShellNavItem } from "@/components/dashboard/shell"
import { ChatPanel } from "@/components/dashboard/chat-panel"
import { NotificationsPanel } from "@/components/dashboard/notifications-panel"
import { TasksPanel } from "@/components/dashboard/tasks-panel"
import { PageHeading, StatTile } from "@/components/dashboard/kit"
import { EnforcementPanel, useEnforcementTargets } from "@/components/monitoring/review-panel"
import { CompliancePanel } from "@/components/monitoring/compliance-panel"

export default function MonitoringDashboard() {
  const [tab, setTab] = React.useState("overview")
  const { rows, expired, expiring } = useEnforcementTargets()
  const { data: issues } = useRealtimeCollection<{ status?: string; severity?: string }>(COMPLIANCE_COLLECTION, [limit(300)], [])
  const open = issues.filter((i) => i.status !== "Resolved")

  const nav: ShellNavItem[] = [
    { value: "overview", label: "Overview", icon: LayoutDashboard },
    { value: "enforcement", label: "Enforcement", icon: AlertTriangle, badge: expired.length },
    { value: "compliance", label: "Compliance", icon: ShieldAlert, badge: open.length },
    { value: "chat", label: "Chat", icon: MessagesSquare },
    { value: "tasks", label: "Tasks", icon: ListTodo },
    { value: "notifications", label: "Notifications", icon: Bell },
  ]

  return (
    <DashboardShell audience="monitoring_enforcement" unitName="Monitoring & Enforcement" unitCaption="Monitoring & Enforcement" nav={nav} active={tab} onNavigate={setTab}>
      {tab === "overview" ? (
        <div className="space-y-6">
          <PageHeading title="Monitoring & Enforcement" description="Find boards standing on lapsed permits and keep the compliance register current." />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile index={0} label="Expired permits" value={expired.length} tone="stop" icon={AlertTriangle} onClick={() => setTab("enforcement")} />
            <StatTile index={1} label="Expiring ≤30 days" value={expiring.length} tone="wait" icon={CalendarClock} />
            <StatTile
              index={2}
              label="Compliance issues open"
              value={open.length}
              tone={open.some((i) => i.severity === "high") ? "stop" : "wait"}
              icon={ShieldAlert}
              onClick={() => setTab("compliance")}
            />
            <StatTile index={3} label="Permits on register" value={rows.length} tone="clear" icon={ShieldCheck} />
          </div>
          <EnforcementPanel />
        </div>
      ) : null}
      {tab === "enforcement" ? <EnforcementPanel /> : null}
      {tab === "compliance" ? <CompliancePanel unit={DEPARTMENT.monitoring} /> : null}
      {tab === "chat" ? <ChatPanel role="monitoring_enforcement" channels={channelsFor("monitoring_enforcement")} /> : null}
      {tab === "tasks" ? <TasksPanel unit={DEPARTMENT.monitoring} /> : null}
      {tab === "notifications" || tab === "settings" ? <NotificationsPanel audience="monitoring_enforcement" /> : null}
    </DashboardShell>
  )
}
DOAS_EOF

# ============================================================================
w app/desks/page.tsx <<'DOAS_EOF'
import Link from "next/link"

const DESKS = [
  { href: "/dashboard/csu", name: "Customer Service Unit", note: "Intake and screening" },
  { href: "/dashboard/director", name: "Director's Office", note: "Signs every hand-off" },
  { href: "/dashboard/business-development", name: "Business Development", note: "First-party site visits" },
  { href: "/dashboard/planning", name: "Planning & Development", note: "Third-party technical vetting" },
  { href: "/dashboard/billing", name: "Billing", note: "Tariffs, invoices, renewals" },
  { href: "/dashboard/finance", name: "Finance & Admin", note: "Remita verification, ledger" },
  { href: "/dashboard/monitoring", name: "Monitoring & Enforcement", note: "Expired permits, compliance" },
]

const PUBLIC = [
  { href: "/submissions/first-party", name: "First-party application" },
  { href: "/submissions/third-party", name: "Third-party application" },
  { href: "/submission-status", name: "Track an application" },
  { href: "/admin/migrate", name: "Legacy migration (run once)" },
]

export default function DesksPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-[28px] font-semibold text-foreground">DOAS desks</h1>
      <p className="mt-1 text-[13.5px] text-muted-foreground">Staff access by URL. Put sign-in in front of these before go-live.</p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {DESKS.map((d) => (
          <li key={d.href}>
            <Link href={d.href} className="block rounded-xl surface px-4 py-4 transition-shadow hover:surface-raised">
              <p className="font-display text-[15px] font-semibold text-foreground">{d.name}</p>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">{d.note}</p>
              <p className="mt-2 font-mono text-[11.5px] text-muted-foreground">{d.href}</p>
            </Link>
          </li>
        ))}
      </ul>
      <h2 className="mt-10 font-display text-[16px] font-semibold text-foreground">Public &amp; admin</h2>
      <ul className="mt-3 space-y-1.5">
        {PUBLIC.map((p) => (
          <li key={p.href}>
            <Link href={p.href} className="text-[13.5px] text-accent underline-offset-4 hover:underline">
              {p.name}
            </Link>{" "}
            <span className="font-mono text-[11.5px] text-muted-foreground">{p.href}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
DOAS_EOF

# ============================================================================
w app/admin/migrate/page.tsx <<'DOAS_EOF'
"use client"

import * as React from "react"
import { arrayUnion, collection, doc, getDocs, writeBatch } from "firebase/firestore"
import { COL, db } from "@/lib/firebase"
import { migrateLegacy } from "@/lib/workflow"
import { ActionButton } from "@/components/dashboard/form-kit"
import { Panel, StatusPill } from "@/components/dashboard/kit"

interface Plan {
  path: string
  id: string
  ref: string
  from: string
  to: string
  department: string
  note: string
}

export default function MigratePage() {
  const [plans, setPlans] = React.useState<Plan[] | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [done, setDone] = React.useState(0)
  const [error, setError] = React.useState("")

  const scan = async () => {
    setBusy(true)
    setError("")
    try {
      const found: Plan[] = []
      const sources: [string, "first" | "third"][] = [
        [COL.firstParty, "first"],
        [COL.thirdParty, "third"],
      ]
      for (const [path, route] of sources) {
        const snap = await getDocs(collection(db, path))
        snap.forEach((d) => {
          const data = d.data()
          const next = migrateLegacy(route, data.status)
          if (next) found.push({ path, id: d.id, ref: data.submissionId ?? d.id, from: data.status, to: next.status, department: next.department, note: next.note })
        })
      }
      setPlans(found)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed")
    } finally {
      setBusy(false)
    }
  }

  const apply = async () => {
    if (!plans?.length) return
    setBusy(true)
    setError("")
    const now = new Date().toISOString()
    try {
      for (let i = 0; i < plans.length; i += 400) {
        const batch = writeBatch(db)
        plans.slice(i, i + 400).forEach((p) =>
          batch.update(doc(db, p.path, p.id), {
            status: p.to,
            department: p.department,
            updatedAt: now,
            comments: arrayUnion({ timestamp: now, desk: "system", action: `Migrated from "${p.from}" — ${p.note}`, to: p.department, status: p.to }),
          }),
        )
        await batch.commit()
        setDone(Math.min(plans.length, i + 400))
      }
      setPlans([])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Migration failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Panel
        title="Legacy status migration"
        description="Moves files filed under the old workflow into the new chain. Scan first, check the list, then apply once."
        actions={
          <>
            <ActionButton tone="quiet" disabled={busy} onClick={scan}>
              Scan
            </ActionButton>
            <ActionButton disabled={busy || !plans?.length} onClick={apply}>
              Apply {plans?.length ?? 0} change(s)
            </ActionButton>
          </>
        }
      >
        {error ? <p className="mb-3 text-[13px] text-[hsl(var(--state-stop))]">{error}</p> : null}
        {done ? <p className="mb-3 text-[13px] text-[hsl(var(--state-clear))]">{done} file(s) migrated.</p> : null}
        {plans === null ? (
          <p className="text-[13px] text-muted-foreground">Nothing scanned yet.</p>
        ) : !plans.length ? (
          <p className="text-[13px] text-muted-foreground">No legacy statuses found. Nothing to do.</p>
        ) : (
          <table className="w-full text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="py-2">Reference</th>
                <th className="py-2">From</th>
                <th className="py-2">To</th>
                <th className="py-2">Note</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={`${p.path}-${p.id}`} className="border-b border-border/60">
                  <td className="py-2 font-mono">{p.ref}</td>
                  <td className="py-2">{p.from}</td>
                  <td className="py-2">
                    <StatusPill status={p.to} />
                  </td>
                  <td className="py-2 text-muted-foreground">{p.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  )
}
DOAS_EOF

echo ""
echo "Done — 27 files written."
echo "Next:"
echo "  1. npm run dev"
echo "  2. Open /admin/migrate → Scan → Apply (once)"
echo "  3. Open /desks to reach every unit"
echo "Optional: add REMITA_MERCHANT_ID, REMITA_API_KEY, REMITA_BASE_URL to .env.local"
