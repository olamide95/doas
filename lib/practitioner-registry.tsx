/**
 * Practitioner Registry — third-party advertising practitioners and their
 * site inventory, digitised from DOAS physical files.
 *
 * This is a records module, not a workflow: CSU (or the Director) captures
 * what is already on paper. Nothing here routes between desks or waits for
 * approval.
 *
 * Firestore layout
 *   practitionerProfiles/{practitionerId}   — corporate master profile
 *   practitionerSites/{siteId}              — one doc per physical structure
 *       .practitionerId  → FK to practitionerProfiles/{id}
 *
 * Sites live in their own top-level collection (not a subcollection) so the
 * GIS / enforcement views can query every structure across every agency in
 * one call.
 *
 * Storage layout
 *   practitioners/{practitionerId}/profile/{slot}/{ts}-{name}
 *   practitioners/{practitionerId}/sites/{siteId}/{slot}/{ts}-{name}
 */

import { addMonths } from "date-fns"
import { addDoc, collection, getDocs, limit, query, where } from "firebase/firestore"
import { getDownloadURL, ref, uploadBytes } from "firebase/storage"
import { db, storage } from "@/lib/firebase"

export const PRACTITIONER_COL = {
  profiles: "practitionerProfiles",
  sites: "practitionerSites",
  logs: "activityLogs",
} as const

/* ------------------------------------------------------------------ *
 * Shared
 * ------------------------------------------------------------------ */

export interface StoredFile {
  url: string
  path: string
  name: string
  type: string
  size: number
  uploadedAt: string
}

export type Actor = "csu" | "director"

export const MAX_FILE_BYTES = 10 * 1024 * 1024

export const ACCEPT = {
  /** Registration + legal documents — PDF or PNG per the DOAS spec. */
  document: ".pdf,.png,application/pdf,image/png",
  /** Site photography — scans and phone photos come in as JPG too. */
  photo: ".png,.jpg,.jpeg,image/png,image/jpeg",
  /** Engineering drawings and certificates. */
  pdf: ".pdf,application/pdf",
  /** Receipts and deposit slips are often photographed. */
  receipt: ".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg",
} as const

const ACCEPT_MIME: Record<keyof typeof ACCEPT, string[]> = {
  document: ["application/pdf", "image/png"],
  photo: ["image/png", "image/jpeg"],
  pdf: ["application/pdf"],
  receipt: ["application/pdf", "image/png", "image/jpeg"],
}

export function checkFile(file: File, kind: keyof typeof ACCEPT): string | null {
  if (!ACCEPT_MIME[kind].includes(file.type)) {
    const allowed = ACCEPT_MIME[kind].map((m) => m.split("/")[1].toUpperCase()).join(", ")
    return `${file.name}: only ${allowed} allowed`
  }
  if (file.size > MAX_FILE_BYTES) return `${file.name}: larger than 10 MB`
  return null
}

export async function uploadRecordFile(folder: string, slot: string, file: File): Promise<StoredFile> {
  const safeName = file.name.replace(/[^\w.\-]+/g, "_")
  const path = `${folder}/${slot}/${Date.now()}-${safeName}`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file, { contentType: file.type })
  return {
    url: await getDownloadURL(storageRef),
    path,
    name: file.name,
    type: file.type,
    size: file.size,
    uploadedAt: new Date().toISOString(),
  }
}

export async function logActivity(entry: {
  actor: Actor
  action: string
  practitionerId: string
  siteId?: string
  detail?: string
}) {
  try {
    await addDoc(collection(db, PRACTITIONER_COL.logs), {
      module: "practitioner-registry",
      userId: entry.actor,
      action: entry.action,
      practitionerId: entry.practitionerId,
      siteId: entry.siteId ?? null,
      comment: entry.detail ?? "",
      timestamp: new Date().toISOString(),
    })
  } catch {
    // Audit trail is best-effort; never block a save on it.
  }
}

/** Returns true when another doc in `col` already holds `value` in `field`. */
export async function isTaken(col: string, field: string, value: string, exceptId?: string) {
  if (!value) return false
  const snap = await getDocs(query(collection(db, col), where(field, "==", value), limit(2)))
  return snap.docs.some((d) => d.id !== exceptId)
}

/* ------------------------------------------------------------------ *
 * Section 1 — Practitioner master profile
 * ------------------------------------------------------------------ */

export const ARCON_CATEGORIES = ["National", "Regional", "Specialized"] as const

export type ProfileFileSlot = "cacCertificate" | "arconLicense" | "doasFeeEvidence"

export const PROFILE_FILE_SLOTS: { key: ProfileFileSlot; label: string; accept: keyof typeof ACCEPT }[] = [
  { key: "cacCertificate", label: "CAC Certificate of Incorporation", accept: "document" },
  { key: "arconLicense", label: "Valid ARCON Corporate Practice License", accept: "document" },
  { key: "doasFeeEvidence", label: "Evidence of up-to-date annual DOAS registration fee", accept: "document" },
]

export interface PractitionerProfile {
  // Corporate identification
  companyName: string
  /** Lower-cased copy for case-insensitive duplicate checks. */
  companyNameKey: string
  rcNumber: string
  tin: string
  doasPractitionerId: string
  isLegacyId: boolean

  // Compliance & licensing
  arconCategory: (typeof ARCON_CATEGORIES)[number] | ""
  arconLicenseNumber: string
  arconLicenseExpiry: string
  managingDirector: string
  leadPractitionerArconNo: string

  // Contact
  hqAddress: string
  phonePrimary: string
  phoneSecondary: string
  email: string

  // Attachments
  documents: Partial<Record<ProfileFileSlot, StoredFile>>

  // Record keeping
  notes: string
  createdAt: string
  createdBy: Actor
  updatedAt: string
  updatedBy: Actor
}

export type ProfileDraft = Omit<
  PractitionerProfile,
  "companyNameKey" | "documents" | "createdAt" | "createdBy" | "updatedAt" | "updatedBy"
>

export const EMPTY_PROFILE: ProfileDraft = {
  companyName: "",
  rcNumber: "",
  tin: "",
  doasPractitionerId: "",
  isLegacyId: false,
  arconCategory: "",
  arconLicenseNumber: "",
  arconLicenseExpiry: "",
  managingDirector: "",
  leadPractitionerArconNo: "",
  hqAddress: "",
  phonePrimary: "",
  phoneSecondary: "",
  email: "",
  notes: "",
}

/** RC 123456 · RC-123456 · RC123456 → "RC 123456". CAC company numbers only. */
export function normaliseRc(value: string) {
  const digits = value.toUpperCase().replace(/^RC[\s\-]*/, "").replace(/\s+/g, "")
  return digits ? `RC ${digits}` : ""
}
export const RC_PATTERN = /^RC \d{1,8}$/

/** JTB TIN: 8 digits + "-" + 4 digits (legacy FIRS) or the 10-digit JTB-issued number. */
export function normaliseTin(value: string) {
  const raw = value.replace(/\s+/g, "")
  if (/^\d{12}$/.test(raw)) return `${raw.slice(0, 8)}-${raw.slice(8)}`
  return raw
}
export const TIN_PATTERN = /^(\d{8}-\d{4}|\d{10})$/

/** 0803 123 4567 · 803… · +234 803… → +2348031234567. */
export function normalisePhone(value: string) {
  let v = value.replace(/[\s\-()]/g, "")
  if (!v) return ""
  if (v.startsWith("+234")) return v
  if (v.startsWith("234")) return `+${v}`
  if (v.startsWith("0")) v = v.slice(1)
  return `+234${v}`
}
/** Mobile (10 digits after +234) or Abuja/landline (8–9 digits). */
export const PHONE_PATTERN = /^\+234[1-9]\d{7,9}$/

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function generatePractitionerId() {
  const year = new Date().getFullYear()
  const tail = Math.random().toString(36).slice(2, 7).toUpperCase()
  return `DOAS-PRC-${year}-${tail}`
}

export type Errors = Record<string, string>

export function validateProfile(d: ProfileDraft): Errors {
  const e: Errors = {}
  if (d.companyName.trim().length < 2) e.companyName = "Enter the name exactly as on the CAC certificate"
  if (!RC_PATTERN.test(d.rcNumber)) e.rcNumber = "Format: RC followed by up to 8 digits, e.g. RC 1234567"
  if (!TIN_PATTERN.test(d.tin)) e.tin = "TIN must be 12345678-0001 or a 10-digit JTB TIN"
  if (!d.doasPractitionerId.trim()) e.doasPractitionerId = "Generate an ID or enter the legacy ID from the file"
  else if (!/^[A-Z0-9\-/]{4,40}$/i.test(d.doasPractitionerId)) e.doasPractitionerId = "Letters, numbers, - and / only"

  if (!d.arconCategory) e.arconCategory = "Pick the ARCON licence category"
  if (!d.arconLicenseNumber.trim()) e.arconLicenseNumber = "ARCON licence number is required"
  if (!d.arconLicenseExpiry) e.arconLicenseExpiry = "Enter the expiry date printed on the licence"
  if (d.managingDirector.trim().length < 3) e.managingDirector = "Managing Director / CEO name is required"
  if (!d.leadPractitionerArconNo.trim()) e.leadPractitionerArconNo = "Lead practitioner's ARCON membership number is required"

  if (d.hqAddress.trim().length < 8) e.hqAddress = "Enter the full head-office address"
  if (!PHONE_PATTERN.test(d.phonePrimary)) e.phonePrimary = "Use a Nigerian number, e.g. +2348031234567"
  if (d.phoneSecondary && !PHONE_PATTERN.test(d.phoneSecondary)) e.phoneSecondary = "Use a Nigerian number, e.g. +2348031234567"
  if (d.phoneSecondary && d.phoneSecondary === d.phonePrimary) e.phoneSecondary = "Same as the primary number"
  if (!EMAIL_PATTERN.test(d.email)) e.email = "Enter a valid corporate email"
  return e
}

export function profileMissingDocs(p: Pick<PractitionerProfile, "documents">) {
  return PROFILE_FILE_SLOTS.filter((s) => !p.documents?.[s.key]).map((s) => s.label)
}

export function isPast(date?: string) {
  if (!date) return false
  const d = new Date(date)
  return !Number.isNaN(d.getTime()) && d.getTime() < startOfToday()
}

function startOfToday() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
}

/* ------------------------------------------------------------------ *
 * Section 2 — Site file
 * ------------------------------------------------------------------ */

export const STRUCTURE_TYPES = [
  "Unipole",
  "Portrait",
  "LED Digital Screen",
  "Gantry",
  "Bridge Panel",
  "Rooftop",
  "Backlit",
  "Wall Drapery",
] as const

export const FACE_OPTIONS = [
  { value: "Single-sided", faces: 1 },
  { value: "Double-sided", faces: 2 },
  { value: "V-shape", faces: 2 },
  { value: "3-sided", faces: 3 },
] as const

export const LIGHTING_TYPES = ["Static/Non-lit", "Front-lit", "Internally Illuminated", "Self-Luminous LED"] as const

export const AREA_COUNCILS = ["AMAC", "Bwari", "Gwagwalada", "Kuje", "Kwali", "Abaji"] as const

/** Suggestions only — the district field stays free text for corridors and new layouts. */
export const DISTRICTS: Record<(typeof AREA_COUNCILS)[number], string[]> = {
  AMAC: [
    "Central Business District", "Garki I", "Garki II", "Wuse I", "Wuse II", "Maitama", "Asokoro",
    "Jabi", "Utako", "Wuye", "Jahi", "Kado", "Katampe", "Gwarinpa", "Life Camp", "Mabushi", "Gudu",
    "Durumi", "Apo", "Lokogoma", "Kabusa", "Guzape", "Lugbe", "Karu", "Nyanya", "Karshi",
    "Airport Road Corridor", "Kubwa Expressway Corridor", "Nnamdi Azikiwe Expressway",
  ],
  Bwari: ["Kubwa", "Dutse", "Bwari Town", "Ushafa", "Dawaki", "Sabon Gari"],
  Gwagwalada: ["Gwagwalada Town", "Dobi", "Zuba", "Paikon Kore", "Ibwa"],
  Kuje: ["Kuje Town", "Chibiri", "Gaube", "Rubochi", "Kiyi"],
  Kwali: ["Kwali Town", "Sheda", "Pai", "Yangoji", "Kilankwa"],
  Abaji: ["Abaji Town", "Yaba", "Gurdi", "Pandagi", "Nuku"],
}

export const PAYMENT_CHANNELS = [
  "CBN Treasury Single Account (TSA)",
  "Remita RRR",
  "Legacy Bank Draft",
] as const

export const PAYMENT_STATUSES = ["Fully Paid", "Partially Paid", "Unpaid/Defaulted"] as const

export const ASSET_STATUSES = [
  "Active",
  "Pending",
  "Dismantled by Enforcement",
  "Voluntarily Removed",
  "Relocated",
  "Infrastructural Development Displacement",
] as const

export type AssetStatus = (typeof ASSET_STATUSES)[number]

export function isDecommissioned(status?: string) {
  return !!status && status !== "Active" && status !== "Pending"
}

export type SiteFileSlot =
  | "contextMontage"
  | "daytimePhoto"
  | "nighttimePhoto"
  | "structuralBlueprint"
  | "liabilityInsurance"
  | "restorationProof"

export type SiteMultiSlot = "revenueReceipts" | "tsaDepositSlips"

export const SITE_FILE_SLOTS: {
  key: SiteFileSlot
  label: string
  accept: keyof typeof ACCEPT
  hint: string
}[] = [
  { key: "contextMontage", label: "Context / location montage", accept: "photo", hint: "Structure framed in its surroundings — used for spacing compliance" },
  { key: "daytimePhoto", label: "Close-up daytime photograph", accept: "photo", hint: "High-resolution shot showing physical condition" },
  { key: "nighttimePhoto", label: "Nighttime photograph", accept: "photo", hint: "Required for illuminated and LED sites" },
  { key: "structuralBlueprint", label: "Approved structural engineering blueprint", accept: "pdf", hint: "Mandatory — proves integrity against wind load / collapse" },
  { key: "liabilityInsurance", label: "Third-party public liability insurance certificate", accept: "pdf", hint: "Current certificate on file" },
  { key: "restorationProof", label: "Proof of site restoration", accept: "photo", hint: "Ground / median repaired and cleared after removal" },
]

export const SITE_MULTI_SLOTS: { key: SiteMultiSlot; label: string; accept: keyof typeof ACCEPT }[] = [
  { key: "revenueReceipts", label: "Official FCTA / DOAS revenue receipts", accept: "receipt" },
  { key: "tsaDepositSlips", label: "TSA bank deposit slips", accept: "receipt" },
]

export interface SiteFile {
  practitionerId: string
  doasPractitionerId: string
  practitionerName: string

  // 1. Core technical details
  siteReferenceCode: string
  structureType: (typeof STRUCTURE_TYPES)[number] | ""
  heightM: number | null
  widthM: number | null
  /** height × width, per face (m²). */
  surfaceAreaM2: number | null
  operationalFaces: (typeof FACE_OPTIONS)[number]["value"] | ""
  faceCount: number
  /** surfaceAreaM2 × faceCount (m²) — what billing tiers usually price on. */
  totalDisplayAreaM2: number | null
  lightingType: (typeof LIGHTING_TYPES)[number] | ""

  // 2. Geolocation
  areaCouncil: (typeof AREA_COUNCILS)[number] | ""
  district: string
  landmarkAddress: string
  latitude: number | null
  longitude: number | null

  // 3. Visuals & engineering
  documents: Partial<Record<SiteFileSlot, StoredFile>>

  // 4. Billing & revenue
  demandNoticeNumber: string
  annualPermitFee: number | null
  amountPaid: number | null
  paymentChannel: (typeof PAYMENT_CHANNELS)[number] | ""
  paymentReference: string
  paymentStatus: (typeof PAYMENT_STATUSES)[number] | ""
  receipts: Partial<Record<SiteMultiSlot, StoredFile[]>>

  // 5. Timelines
  approvalDate: string
  lastPaymentDate: string
  commencementDate: string
  /** commencementDate + 12 calendar months. Derived, stored for querying. */
  expiryDate: string

  // 6. Status & archive
  assetStatus: AssetStatus
  decommissionDate: string
  revenueCleared: boolean | null

  // Record keeping
  missingDocuments: string[]
  recordComplete: boolean
  notes: string
  createdAt: string
  createdBy: Actor
  updatedAt: string
  updatedBy: Actor
}

export type SiteDraft = Omit<
  SiteFile,
  | "practitionerId"
  | "doasPractitionerId"
  | "practitionerName"
  | "surfaceAreaM2"
  | "faceCount"
  | "totalDisplayAreaM2"
  | "expiryDate"
  | "documents"
  | "receipts"
  | "missingDocuments"
  | "recordComplete"
  | "createdAt"
  | "createdBy"
  | "updatedAt"
  | "updatedBy"
> & {
  heightInput: string
  widthInput: string
  latitudeInput: string
  longitudeInput: string
  feeInput: string
  paidInput: string
}

export const EMPTY_SITE: SiteDraft = {
  siteReferenceCode: "",
  structureType: "",
  heightM: null,
  widthM: null,
  heightInput: "",
  widthInput: "",
  operationalFaces: "",
  lightingType: "",
  areaCouncil: "",
  district: "",
  landmarkAddress: "",
  latitude: null,
  longitude: null,
  latitudeInput: "",
  longitudeInput: "",
  demandNoticeNumber: "",
  annualPermitFee: null,
  amountPaid: null,
  feeInput: "",
  paidInput: "",
  paymentChannel: "",
  paymentReference: "",
  paymentStatus: "",
  approvalDate: "",
  lastPaymentDate: "",
  commencementDate: "",
  assetStatus: "Active",
  decommissionDate: "",
  revenueCleared: null,
  notes: "",
}

export function faceCountFor(faces: string) {
  return FACE_OPTIONS.find((f) => f.value === faces)?.faces ?? 0
}

export function parseDecimal(value: string): number | null {
  const cleaned = value.replace(/[,₦\s]/g, "")
  if (!cleaned) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

export function round2(n: number) {
  return Math.round(n * 100) / 100
}

export function surfaceArea(h: number | null, w: number | null) {
  return h && w && h > 0 && w > 0 ? round2(h * w) : null
}

/** Exactly 12 calendar months on — date-fns clamps 31 Jan → 28/29 Feb correctly. */
export function expiryFrom(commencement: string) {
  if (!commencement) return ""
  const start = new Date(`${commencement}T00:00:00`)
  if (Number.isNaN(start.getTime())) return ""
  const end = addMonths(start, 12)
  return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`
}

/**
 * Grace period: the cycle has expired and nothing on file shows a fully paid
 * demand notice dated on or after expiry. Computed on read so it never goes
 * stale between edits.
 */
export function inGracePeriod(site: Pick<SiteFile, "expiryDate" | "paymentStatus" | "lastPaymentDate" | "demandNoticeNumber" | "assetStatus">) {
  if (isDecommissioned(site.assetStatus) || !site.expiryDate) return false
  if (!isPast(site.expiryDate)) return false
  const renewed =
    site.paymentStatus === "Fully Paid" &&
    !!site.demandNoticeNumber &&
    !!site.lastPaymentDate &&
    site.lastPaymentDate >= site.expiryDate
  return !renewed
}

export function daysUntil(date?: string) {
  if (!date) return null
  const d = new Date(`${date}T00:00:00`).getTime()
  if (Number.isNaN(d)) return null
  return Math.round((d - startOfToday()) / 86_400_000)
}

/** FCT bounding box with a small margin — catches swapped or mistyped coordinates. */
export const FCT_BOUNDS = { latMin: 8.3, latMax: 9.5, lngMin: 6.7, lngMax: 7.7 }

/** Remita RRR is 12 digits; it's usually printed as 1234-5678-9012. */
export function normaliseRrr(value: string) {
  return value.replace(/[\s\-]/g, "")
}

export function needsNightPhoto(lighting: string) {
  return !!lighting && lighting !== "Static/Non-lit"
}

export function siteMissingDocs(
  draft: Pick<SiteDraft, "lightingType" | "assetStatus" | "paymentStatus">,
  documents: Partial<Record<SiteFileSlot, StoredFile>>,
  receipts: Partial<Record<SiteMultiSlot, StoredFile[]>>,
) {
  const missing: string[] = []
  const has = (k: SiteFileSlot) => !!documents[k]
  if (!has("contextMontage")) missing.push("Context montage")
  if (!has("daytimePhoto")) missing.push("Daytime photograph")
  if (needsNightPhoto(draft.lightingType) && !has("nighttimePhoto")) missing.push("Nighttime photograph")
  if (!has("structuralBlueprint")) missing.push("Structural blueprint")
  if (!has("liabilityInsurance")) missing.push("Liability insurance certificate")
  if (draft.paymentStatus && draft.paymentStatus !== "Unpaid/Defaulted" && !receipts.revenueReceipts?.length)
    missing.push("Revenue receipt")
  if (isDecommissioned(draft.assetStatus) && !has("restorationProof")) missing.push("Site restoration proof")
  return missing
}

export function validateSite(d: SiteDraft): Errors {
  const e: Errors = {}

  if (!d.siteReferenceCode.trim()) e.siteReferenceCode = "Site reference code is required"
  if (!d.structureType) e.structureType = "Pick the structure type"
  const h = parseDecimal(d.heightInput)
  const w = parseDecimal(d.widthInput)
  if (h === null || h <= 0 || h > 100) e.heightInput = "Height in metres, between 0 and 100"
  if (w === null || w <= 0 || w > 200) e.widthInput = "Width in metres, between 0 and 200"
  if (!d.operationalFaces) e.operationalFaces = "Pick the number of faces"
  if (!d.lightingType) e.lightingType = "Pick the lighting type"
  if (d.structureType === "LED Digital Screen" && d.lightingType && d.lightingType !== "Self-Luminous LED")
    e.lightingType = "LED screens must be recorded as Self-Luminous LED"

  if (!d.areaCouncil) e.areaCouncil = "Pick the area council"
  if (d.district.trim().length < 2) e.district = "Enter the district or corridor"
  if (d.landmarkAddress.trim().length < 10) e.landmarkAddress = "Describe the axis and nearest landmark"
  const lat = parseDecimal(d.latitudeInput)
  const lng = parseDecimal(d.longitudeInput)
  if (lat === null) e.latitudeInput = "Decimal degrees, e.g. 9.0765"
  else if (lat < FCT_BOUNDS.latMin || lat > FCT_BOUNDS.latMax) e.latitudeInput = "Outside the FCT — check for swapped or mistyped values"
  if (lng === null) e.longitudeInput = "Decimal degrees, e.g. 7.3986"
  else if (lng < FCT_BOUNDS.lngMin || lng > FCT_BOUNDS.lngMax) e.longitudeInput = "Outside the FCT — check for swapped or mistyped values"
  if (d.latitudeInput && !/^-?\d{1,2}(\.\d{4,8})?$/.test(d.latitudeInput.trim()) && !e.latitudeInput)
    e.latitudeInput = "Use at least 4 decimal places (≈11 m accuracy)"
  if (d.longitudeInput && !/^-?\d{1,3}(\.\d{4,8})?$/.test(d.longitudeInput.trim()) && !e.longitudeInput)
    e.longitudeInput = "Use at least 4 decimal places (≈11 m accuracy)"

  const fee = parseDecimal(d.feeInput)
  const paid = parseDecimal(d.paidInput)
  if (d.feeInput && (fee === null || fee < 0)) e.feeInput = "Enter an amount in naira"
  if (d.paidInput && (paid === null || paid < 0)) e.paidInput = "Enter an amount in naira"
  if (d.paymentStatus === "Partially Paid") {
    if (paid === null) e.paidInput = "Enter how much has been paid"
    else if (fee !== null && paid >= fee) e.paidInput = "Partially paid must be less than the fee"
  }
  if (d.paymentStatus === "Fully Paid" && fee !== null && paid !== null && paid < fee)
    e.paidInput = "Less than the fee — mark as Partially Paid"
  if (d.paymentStatus && d.paymentStatus !== "Unpaid/Defaulted") {
    if (!d.demandNoticeNumber.trim()) e.demandNoticeNumber = "The demand notice this payment settles"
    if (!d.paymentChannel) e.paymentChannel = "How was it paid?"
    if (!d.paymentReference.trim()) e.paymentReference = "RRR or TSA transaction reference"
    if (!d.lastPaymentDate) e.lastPaymentDate = "Date the payment was processed"
  }
  if (d.paymentChannel === "Remita RRR" && d.paymentReference && !/^\d{12}$/.test(normaliseRrr(d.paymentReference)))
    e.paymentReference = "Remita RRR is 12 digits"

  if (d.assetStatus === "Active" && !d.commencementDate) e.commencementDate = "Active sites need a cycle start date"
  if (d.approvalDate && d.commencementDate && d.commencementDate < d.approvalDate)
    e.commencementDate = "Cycle can't start before the site was approved"
  const today = new Date().toISOString().slice(0, 10)
  if (d.approvalDate && d.approvalDate > today) e.approvalDate = "Can't be in the future"
  if (d.lastPaymentDate && d.lastPaymentDate > today) e.lastPaymentDate = "Can't be in the future"

  if (isDecommissioned(d.assetStatus)) {
    if (!d.decommissionDate) e.decommissionDate = "When was the structure removed?"
    else if (d.decommissionDate > today) e.decommissionDate = "Can't be in the future"
    if (d.revenueCleared === null) e.revenueCleared = "Confirm whether back-taxes were cleared"
  }
  return e
}

/** Next free reference for a practitioner: DOAS-PRC-2026-AB12C-S007. */
export function nextSiteReference(doasPractitionerId: string, existing: string[]) {
  const prefix = `${doasPractitionerId}-S`
  const used = existing
    .filter((code) => code.startsWith(prefix))
    .map((code) => Number(code.slice(prefix.length)))
    .filter((n) => Number.isFinite(n))
  const next = (used.length ? Math.max(...used) : 0) + 1
  return `${prefix}${String(next).padStart(3, "0")}`
}