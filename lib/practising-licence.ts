/**
 * Practising Licence — the certificate DOAS gives a validated out-of-home
 * advertising practitioner.
 *
 * A licence is one Firestore doc at issuedDocuments/{code}, the same
 * collection as letters, e-receipts and setting-out certificates, so the
 * existing public /verify/{code} page confirms it with a single-document
 * read. The QR code printed on the certificate opens that page.
 *
 * The practitioner's file keeps a small summary at
 * practitionerProfiles/{id}.practisingLicence for the registry screens.
 *
 * Licences are written only by /api/practitioners/licence (CSU or the
 * Director), never from the browser, so a licence cannot be forged from a
 * signed-in session and licence numbers stay unique.
 *
 * This file has no Firebase imports: the API route, the dashboard and the
 * public pages all share it.
 */

import type { IssuedDocument } from "@/lib/issued-documents"

export const LICENCE_KIND = "practisingLicence" as const
export const LICENCE_TITLE = "Practising Licence"
export const LICENCE_CATEGORY = "Out-of-Home Advertising Company"
export const LICENCE_AUTHORITY = "Federal Capital Territory Administration"
export const LICENCE_DEPARTMENT = "Department of Outdoor Advertisement and Signage"
/** Printed in two lines under the practitioner's name. */
export const LICENCE_STATEMENT = [
  "is licensed to practice out-of-home advertising subject to applicable laws,",
  "regulations, guidelines and conditions governing outdoor advertising in the FCT.",
] as const
export const LICENCE_FOOTNOTE = "Non-transferable. This licence does not constitute site approval or permission to commence construction."
export const LICENCE_SIGNATORY = "Overseeing Director, DOAS"
export const LICENCE_SIGNATORY_NOTE = "Authorised signature and official stamp."

export type LicenceStatus = "valid" | "revoked"

/** What staff type in: everything else on the certificate is fixed. */
export interface LicenceInput {
  holderName: string
  licenceNumber: string
  /** YYYY-MM-DD */
  issueDate: string
}

/** Stored on the practitioner's file for lists and badges. */
export interface LicenceSummary extends LicenceInput {
  code: string
  status: LicenceStatus
  issuedAt: string
  issuedBy: string
  updatedAt?: string
  updatedBy?: string
  revokedReason?: string
}

export interface LicenceChange {
  at: string
  by: string
  action: "issued" | "corrected" | "revoked" | "restored"
  detail: string
}

/** The full issuedDocuments/{code} record. */
export type LicenceDocument = IssuedDocument & {
  kind: typeof LICENCE_KIND
  licenceNumber: string
  licenceCategory: string
  issueDate: string
  doasPractitionerId?: string
  updatedAt?: string
  updatedBy?: string
  revokedReason?: string
  history?: LicenceChange[]
}

export type LicenceErrors = Partial<Record<keyof LicenceInput, string>>

/* ------------------------------------------------------------------ *
 * Cleaning & validation — used by the form and again by the API
 * ------------------------------------------------------------------ */

/** Certificates carry the name in capitals, single-spaced. */
export function normaliseHolderName(value: string) {
  return String(value ?? "").replace(/\s+/g, " ").trim().toUpperCase()
}

/** "1294060 / 0229" → "1294060/0229". */
export function normaliseLicenceNumber(value: string) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/\s*([/\-.])\s*/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
}

export function cleanLicenceInput(input: LicenceInput): LicenceInput {
  return {
    holderName: normaliseHolderName(input.holderName),
    licenceNumber: normaliseLicenceNumber(input.licenceNumber),
    issueDate: String(input.issueDate ?? "").trim(),
  }
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function dateParts(value: string) {
  const m = DATE_PATTERN.exec(value ?? "")
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  const d = new Date(Date.UTC(year, month - 1, day))
  // Rejects 2026-02-31 and friends.
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null
  return { year, month, day }
}

/** Today in local time as YYYY-MM-DD (date inputs speak this format). */
export function todayIso(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

/** Expects input already passed through cleanLicenceInput. */
export function validateLicenceInput(input: LicenceInput): LicenceErrors {
  const e: LicenceErrors = {}

  if (input.holderName.length < 2) e.holderName = "Enter the practitioner's name as it should appear on the licence"
  else if (input.holderName.length > 90) e.holderName = "Too long for the certificate — 90 characters at most"

  if (!input.licenceNumber) e.licenceNumber = "Enter the licence number"
  else if (!/^[A-Z0-9][A-Z0-9/\-. ]{1,38}[A-Z0-9]$/.test(input.licenceNumber)) e.licenceNumber = "3–40 characters: letters, numbers, / - . only"

  const parts = dateParts(input.issueDate)
  if (!parts) e.issueDate = "Pick the date of issue"
  else if (parts.year < 2000) e.issueDate = "Check the year"
  else {
    // One day of slack so a server in UTC never rejects "today" in Abuja.
    const limit = new Date()
    limit.setDate(limit.getDate() + 1)
    if (input.issueDate > todayIso(limit)) e.issueDate = "The date of issue can't be in the future"
  }
  return e
}

/* ------------------------------------------------------------------ *
 * Display
 * ------------------------------------------------------------------ */

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

/** "2026-11-06" → "November 6, 2026". No Date maths, so no timezone drift. */
export function formatIssueDate(value?: string | null) {
  const parts = dateParts(String(value ?? "").slice(0, 10))
  if (!parts) return String(value ?? "")
  return `${MONTHS[parts.month - 1]} ${parts.day}, ${parts.year}`
}

export function isLicence(doc: Pick<IssuedDocument, "kind"> | null | undefined): doc is LicenceDocument {
  return !!doc && doc.kind === LICENCE_KIND
}

/**
 * The address printed inside the QR code. Set NEXT_PUBLIC_SITE_URL to the
 * live address so a licence printed from a preview or test deployment still
 * scans to the real site.
 */
export function licenceVerifyUrl(code: string) {
  const path = `/verify/${encodeURIComponent(code)}`
  const configured = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "")
  if (configured) return `${configured}${path}`
  if (typeof window !== "undefined") return `${window.location.origin}${path}`
  return path
}

/* ------------------------------------------------------------------ *
 * Records
 * ------------------------------------------------------------------ */

/** Noon UTC keeps the calendar day the same in every timezone. */
export function issuedAtFor(issueDate: string) {
  return `${issueDate}T12:00:00.000Z`
}

export function buildLicenceDocument(args: {
  code: string
  input: LicenceInput
  practitionerId: string
  doasPractitionerId?: string
  practitionerUid?: string
  holderAddress?: string
  actor: string
  now: string
}): LicenceDocument {
  const { code, input, now } = args
  return {
    code,
    kind: LICENCE_KIND,
    title: LICENCE_TITLE,
    reference: input.licenceNumber,
    submissionId: "",
    submissionRef: "",
    route: "third",
    ...(args.practitionerUid ? { practitionerUid: args.practitionerUid } : {}),
    practitionerId: args.practitionerId,
    ...(args.doasPractitionerId ? { doasPractitionerId: args.doasPractitionerId } : {}),
    holderName: input.holderName,
    holderAddress: args.holderAddress ?? "",
    siteAddress: "",
    areaCouncil: "",
    subject: `${LICENCE_TITLE.toUpperCase()} — ${LICENCE_CATEGORY.toUpperCase()}`,
    salutation: "",
    paragraphs: [`This is to certify that ${input.holderName} ${LICENCE_STATEMENT.join(" ")}`, LICENCE_FOOTNOTE],
    facts: [
      { label: "Licence No.", value: input.licenceNumber },
      { label: "Date of issue", value: formatIssueDate(input.issueDate) },
      { label: "Category", value: LICENCE_CATEGORY },
    ],
    signatory: LICENCE_SIGNATORY,
    signatoryTitle: LICENCE_SIGNATORY_NOTE,
    issuedAt: issuedAtFor(input.issueDate),
    issuedBy: args.actor,
    status: "valid",
    licenceNumber: input.licenceNumber,
    licenceCategory: LICENCE_CATEGORY,
    issueDate: input.issueDate,
    updatedAt: now,
    updatedBy: args.actor,
    history: [{ at: now, by: args.actor, action: "issued", detail: `${input.licenceNumber} · ${input.holderName}` }],
  }
}

export function summaryOf(doc: LicenceDocument): LicenceSummary {
  return {
    code: doc.code,
    holderName: doc.holderName,
    licenceNumber: doc.licenceNumber,
    issueDate: doc.issueDate,
    status: doc.status,
    issuedAt: doc.issuedAt,
    issuedBy: doc.issuedBy,
    ...(doc.updatedAt ? { updatedAt: doc.updatedAt } : {}),
    ...(doc.updatedBy ? { updatedBy: doc.updatedBy } : {}),
    ...(doc.revokedReason ? { revokedReason: doc.revokedReason } : {}),
  }
}
