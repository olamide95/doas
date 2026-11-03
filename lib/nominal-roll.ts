/**
 * Nominal roll — the Directorate's staff establishment, maintained by Staff
 * Admin. Imported from the FCTA nominal-roll workbook (any of its sheets:
 * "SEPT 2026", "COMPREHENSIVE", the Dec 2024 sheet with phone numbers, or the
 * Aug 2024 sheet with tax/NHF numbers) and kept up to date in Firestore at
 * nominalRoll/{id}. Re-importing merges into the same records.
 *
 * Payroll fields (bank, account, pension, tax, NHF) are personal data: the
 * Firestore rules restrict the collection to Staff Admin and the Director.
 */

export const ROLL_STATUSES = ["Active", "On leave", "Seconded", "Transferred", "Retired", "Deceased"] as const
export type RollStatus = (typeof ROLL_STATUSES)[number]

export interface RollEntry {
  serial?: number
  surname: string
  firstName: string
  middleName: string
  fullName: string
  dateOfBirth: string
  qualification: string
  state: string
  lga: string
  rank: string
  firstAppointment: string
  confirmation: string
  presentAppointment: string
  gradeLevel: number | null
  step: number | null
  pensionNumber: string
  pfa: string
  bank: string
  accountNumber: string
  pfNumber: string
  taxNumber: string
  nhfNumber: string
  phone: string
  email: string
  sda: string
  remarks: string
  department: string
  designation: string
  status: RollStatus
  staffUid?: string
  key: string
  source: string
  createdAt?: string
  updatedAt?: string
}

export const EMPTY_ROLL: Omit<RollEntry, "key" | "source"> = {
  surname: "",
  firstName: "",
  middleName: "",
  fullName: "",
  dateOfBirth: "",
  qualification: "",
  state: "",
  lga: "",
  rank: "",
  firstAppointment: "",
  confirmation: "",
  presentAppointment: "",
  gradeLevel: null,
  step: null,
  pensionNumber: "",
  pfa: "",
  bank: "",
  accountNumber: "",
  pfNumber: "",
  taxNumber: "",
  nhfNumber: "",
  phone: "",
  email: "",
  sda: "",
  remarks: "",
  department: "",
  designation: "",
  status: "Active",
}

/* ---------------- Cleaning ---------------- */

/** Workbook cells often carry a trailing apostrophe (text-forced numbers) and stray spaces. */
export function clean(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (value instanceof Date) return isoDay(value)
  return String(value).replace(/[‘’']+/g, "").replace(/\s+/g, " ").trim()
}

const pad = (n: number) => String(n).padStart(2, "0")
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** d/m/y in any of the workbook's spellings → YYYY-MM-DD. Two-digit years: 00–30 → 20xx, else 19xx. */
export function parseRollDate(value: unknown): string {
  if (value === null || value === undefined || value === "") return ""
  if (value instanceof Date && !Number.isNaN(value.getTime())) return isoDay(value)
  if (typeof value === "number" && value > 1000 && value < 80000) {
    // Excel serial date (1900 system)
    const ms = Math.round((value - 25569) * 86_400_000)
    return isoDay(new Date(ms + new Date(ms).getTimezoneOffset() * 60_000))
  }
  const text = clean(value)
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) return `${iso[1]}-${pad(Number(iso[2]))}-${pad(Number(iso[3]))}`
  const m = text.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/)
  if (!m) return ""
  const day = Number(m[1])
  const month = Number(m[2])
  let year = Number(m[3])
  if (m[3].length === 2) year += year <= 30 ? 2000 : 1900
  if (month < 1 || month > 12 || day < 1 || day > 31) return ""
  return `${year}-${pad(month)}-${pad(day)}`
}

function toInt(value: unknown): number | null {
  const n = parseInt(clean(value).replace(/[^\d]/g, ""), 10)
  return Number.isFinite(n) ? n : null
}

export function rollKey(surname: string, firstName: string) {
  return `${surname}|${firstName}`.toUpperCase().replace(/[^A-Z|]/g, "")
}

export function rollDocId(key: string) {
  return `roll_${key.replace(/\|/g, "_")}`
}

export function fullNameOf(e: Pick<RollEntry, "surname" | "firstName" | "middleName">) {
  return [e.surname, e.firstName, e.middleName].filter(Boolean).join(" ")
}

/* ---------------- Retirement ---------------- */

/** Public service rule: 60 years of age or 35 years of service, whichever comes first. */
export function retirementDate(e: Pick<RollEntry, "dateOfBirth" | "firstAppointment">): string {
  const dates: Date[] = []
  if (e.dateOfBirth) {
    const d = new Date(e.dateOfBirth)
    if (!Number.isNaN(d.getTime())) dates.push(new Date(d.getFullYear() + 60, d.getMonth(), d.getDate()))
  }
  if (e.firstAppointment) {
    const d = new Date(e.firstAppointment)
    if (!Number.isNaN(d.getTime())) dates.push(new Date(d.getFullYear() + 35, d.getMonth(), d.getDate()))
  }
  if (!dates.length) return ""
  return isoDay(new Date(Math.min(...dates.map((d) => d.getTime()))))
}

export function yearsOfService(firstAppointment: string) {
  const d = new Date(firstAppointment)
  if (!firstAppointment || Number.isNaN(d.getTime())) return null
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 86_400_000))
}

/* ---------------- Workbook parsing ---------------- */

type Field = keyof RollEntry | "otherNames" | "stateLga" | "serial"

const HEADERS: [RegExp, Field][] = [
  [/^S\/?N$/, "serial"],
  [/^SURNAME$/, "surname"],
  [/^NAME$/, "surname"],
  [/^FIRST NAME$/, "firstName"],
  [/^MIDDLE NAME$/, "middleName"],
  [/^OTHER NAMES?$/, "otherNames"],
  [/^DATE OF BIRTH$/, "dateOfBirth"],
  [/^HIGHEST QUALIFICATION/, "qualification"],
  [/^STATE\s*\/\s*LG/, "stateLga"],
  [/^STATE$/, "state"],
  [/^LGA$/, "lga"],
  [/^RANK$/, "rank"],
  [/^DESIGNATION$/, "rank"],
  [/^DATE OF 1ST APP/, "firstAppointment"],
  [/^DATE OF CONFIRMATION/, "confirmation"],
  [/^DATE OF PRESENT APP/, "presentAppointment"],
  [/^GL$/, "gradeLevel"],
  [/^STEP$/, "step"],
  [/^PENSION/, "pensionNumber"],
  [/^PFA$/, "pfa"],
  [/^BANK$/, "bank"],
  [/^ACC(OUN)?T/, "accountNumber"],
  [/^PF NO/, "pfNumber"],
  [/^TAX/, "taxNumber"],
  [/^NHF/, "nhfNumber"],
  [/^PHONE/, "phone"],
  [/^SDA$/, "sda"],
  [/^REMARKS?$/, "remarks"],
]

export interface ParsedSheet {
  title: string
  entries: (Partial<RollEntry> & { surname: string; firstName: string; key: string })[]
  columns: string[]
  skipped: number
}

/** Rows as returned by SheetJS `sheet_to_json(sheet, { header: 1, raw: true })`. */
export function parseRollRows(rows: unknown[][], sheetName: string): ParsedSheet {
  let headerRow = -1
  let title = sheetName
  for (let i = 0; i < Math.min(rows.length, 15); i += 1) {
    const cells = (rows[i] ?? []).map((c) => clean(c).toUpperCase())
    if (cells.some((c) => /NOMINAL ROLL/.test(c))) title = clean((rows[i] ?? []).find((c) => /NOMINAL ROLL/i.test(String(c))))
    if (cells.some((c) => /^S\/?N$/.test(c)) && cells.some((c) => c === "SURNAME" || c === "NAME")) {
      headerRow = i
      break
    }
  }
  if (headerRow < 0) return { title, entries: [], columns: [], skipped: 0 }

  const header = (rows[headerRow] ?? []).map((c) => clean(c).toUpperCase())
  const map = new Map<number, Field>()
  header.forEach((h, idx) => {
    const hit = HEADERS.find(([re]) => re.test(h))
    if (hit && ![...map.values()].includes(hit[1])) map.set(idx, hit[1])
  })

  const entries: ParsedSheet["entries"] = []
  let skipped = 0
  for (let r = headerRow + 1; r < rows.length; r += 1) {
    const row = rows[r] ?? []
    const raw: Partial<Record<Field, unknown>> = {}
    map.forEach((field, idx) => (raw[field] = row[idx]))
    let surname = clean(raw.surname).toUpperCase()
    let firstName = clean(raw.firstName).toUpperCase()
    let middleName = clean(raw.middleName).toUpperCase()
    if (raw.otherNames !== undefined && !firstName) {
      const parts = clean(raw.otherNames).toUpperCase().split(" ").filter(Boolean)
      firstName = parts[0] ?? ""
      middleName = parts.slice(1).join(" ")
    }
    if (!surname || !firstName) {
      if (surname || firstName) skipped += 1
      continue
    }
    // Some cells hold "SURNAME FIRSTNAME" — leave as-is; Staff Admin can split by editing.
    surname = surname.replace(/\s+/g, " ")

    let state = clean(raw.state).toUpperCase()
    let lga = clean(raw.lga).toUpperCase()
    if (raw.stateLga !== undefined) {
      const [s, l] = clean(raw.stateLga).toUpperCase().split("/").map((x) => x.trim())
      state = state || s || ""
      lga = lga || l || ""
    }
    if (state.includes("/") && !lga) {
      const [s, l] = state.split("/").map((x) => x.trim())
      state = s
      lga = l ?? ""
    }

    const entry: ParsedSheet["entries"][number] = {
      serial: toInt(raw.serial) ?? undefined,
      surname,
      firstName,
      middleName,
      fullName: fullNameOf({ surname, firstName, middleName }),
      key: rollKey(surname, firstName),
    }
    const text = (f: Field) => (raw[f] !== undefined ? clean(raw[f]) : undefined)
    const date = (f: Field) => (raw[f] !== undefined ? parseRollDate(raw[f]) : undefined)
    const set = <K extends keyof RollEntry>(k: K, v: RollEntry[K] | undefined) => {
      if (v !== undefined && v !== "" && v !== null) entry[k] = v as never
    }
    set("dateOfBirth", date("dateOfBirth"))
    set("qualification", text("qualification"))
    set("state", state || undefined)
    set("lga", lga || undefined)
    set("rank", text("rank")?.toUpperCase())
    set("firstAppointment", date("firstAppointment"))
    set("confirmation", date("confirmation"))
    set("presentAppointment", date("presentAppointment"))
    set("gradeLevel", raw.gradeLevel !== undefined ? toInt(raw.gradeLevel) : undefined)
    set("step", raw.step !== undefined ? toInt(raw.step) : undefined)
    set("pensionNumber", text("pensionNumber"))
    set("pfa", text("pfa")?.toUpperCase())
    set("bank", text("bank")?.toUpperCase())
    set("accountNumber", text("accountNumber"))
    set("pfNumber", text("pfNumber"))
    set("taxNumber", text("taxNumber"))
    set("nhfNumber", text("nhfNumber"))
    const phone = text("phone")
    set("phone", phone ? (/^\d{10}$/.test(phone) ? `0${phone}` : phone) : undefined)
    set("sda", text("sda"))
    set("remarks", text("remarks"))
    entries.push(entry)
  }
  return { title, entries, columns: [...map.values()].map(String), skipped }
}
