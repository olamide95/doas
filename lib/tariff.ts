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
