/**
 * Documents DOAS issues to applicants: the documents-request letter, the
 * e-receipt, the setting-out certificate and the approval letter.
 *
 * Each one is a Firestore doc at issuedDocuments/{code}. The code is printed
 * on the document as a Code-128 barcode and inside a QR code that opens
 * /verify/{code}, so anyone can confirm a document is genuine. The doc holds
 * everything needed to render it, so the public verify page needs only a
 * single-document read (rules: `allow get: if true`).
 */

import { doc, setDoc } from "firebase/firestore"
import { COL, db } from "@/lib/firebase"
import { REQUIRED_DOCUMENTS } from "@/lib/workflow"
import { naira } from "@/lib/format"

export type IssuedKind = "documentsRequestLetter" | "eReceipt" | "settingOutCertificate" | "approvalLetter"

export const ISSUED_META: Record<IssuedKind, { title: string; prefix: string; short: string }> = {
  documentsRequestLetter: { title: "Request for Technical Documents", prefix: "LTR", short: "Documents request letter" },
  eReceipt: { title: "Official E-Receipt", prefix: "RCT", short: "E-receipt" },
  settingOutCertificate: { title: "Setting-Out Certificate", prefix: "SOC", short: "Setting-out certificate" },
  approvalLetter: { title: "Letter of Approval", prefix: "APL", short: "Approval letter" },
}

export interface IssuedFact {
  label: string
  value: string
}

export interface IssuedDocument {
  code: string
  kind: IssuedKind
  title: string
  reference: string
  submissionId: string
  submissionRef: string
  route: "first" | "third"
  practitionerUid?: string
  practitionerId?: string
  holderName: string
  holderAddress: string
  siteAddress: string
  areaCouncil: string
  subject: string
  salutation: string
  paragraphs: string[]
  facts: IssuedFact[]
  amount?: number
  rrr?: string
  permitNumber?: string
  validFrom?: string
  validTo?: string
  signatory: string
  signatoryTitle: string
  issuedAt: string
  issuedBy: string
  status: "valid" | "revoked"
}

/** Loose shape — accepts any submission row. */
type Row = Record<string, unknown> & { id: string; route: "first" | "third" }

const s = (v: unknown) => (v === undefined || v === null ? "" : String(v))
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

function randomCode(length = 10) {
  const bytes = new Uint32Array(length)
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) crypto.getRandomValues(bytes)
  else for (let i = 0; i < length; i += 1) bytes[i] = Math.floor(Math.random() * 2 ** 32)
  return Array.from(bytes, (n) => alphabet[n % alphabet.length]).join("")
}

export function documentCode(kind: IssuedKind) {
  return `DOAS-${ISSUED_META[kind].prefix}-${new Date().getFullYear()}-${randomCode(10)}`
}

export function documentPath(code: string) {
  return `/documents/${encodeURIComponent(code)}`
}

export function verifyPath(code: string) {
  return `/verify/${encodeURIComponent(code)}`
}

export function absoluteUrl(path: string) {
  if (typeof window !== "undefined") return `${window.location.origin}${path}`
  return `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}${path}`
}

function longDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })
}

function structureOf(row: Row) {
  const m = row.measurements as { items?: { type?: string; height?: number; width?: number; faces?: number }[]; totalSqm?: number } | undefined
  const item = m?.items?.[0]
  const type = s(item?.type ?? row.applicationType ?? row.structureType)
  const dims = item?.height && item?.width ? `${item.height.toFixed(2)}m × ${item.width.toFixed(2)}m${item.faces && item.faces > 1 ? ` × ${item.faces} faces` : ""}` : s(row.signDimensions)
  return { type, dims, sqm: m?.totalSqm ?? 0 }
}

export interface IssueContext {
  now: string
  actorId: string
  permit?: string | null
  validFrom?: string
  validTo?: string
  note?: string
}

export function buildIssuedDocument(kind: IssuedKind, row: Row, ctx: IssueContext): IssuedDocument {
  const code = documentCode(kind)
  const meta = ISSUED_META[kind]
  const holder = s(row.companyName || row.applicantName)
  const holderAddress = s(row.corporateAddress || row.companyAddress)
  const site = s(row.signageSiteAddress || row.addressLine1)
  const council = s(row.areaCouncil)
  const ref = s(row.submissionId || row.id)
  const { type, dims, sqm } = structureOf(row)
  const billing = (row.billing ?? {}) as Record<string, unknown>
  const payment = (row.payment ?? {}) as Record<string, unknown>
  const remita = (row.remita ?? {}) as Record<string, unknown>
  const gps = s(row.gpsCoordinates)
  const reference = `FCTA/DOAS/${meta.prefix}/${new Date(ctx.now).getFullYear()}/${code.slice(-6)}`

  const base: IssuedDocument = {
    code,
    kind,
    title: meta.title,
    reference,
    submissionId: ref,
    submissionRef: row.id,
    route: row.route,
    practitionerUid: s(row.practitionerUid) || undefined,
    practitionerId: s(row.practitionerId) || undefined,
    holderName: holder,
    holderAddress,
    siteAddress: site,
    areaCouncil: council,
    subject: "",
    salutation: "Sir/Madam,",
    paragraphs: [],
    facts: [],
    signatory: "Director",
    signatoryTitle: "Department of Outdoor Advertisement and Signage, FCTA",
    issuedAt: ctx.now,
    issuedBy: ctx.actorId,
    status: "valid",
  }

  if (kind === "documentsRequestLetter") {
    return {
      ...base,
      subject: `RE: REQUEST FOR SUBMISSION OF TECHNICAL DOCUMENTS — APPLICATION ${ref}`,
      paragraphs: [
        `Following the site inspection carried out by the Planning and Development unit on your proposed ${type || "structure"} at ${site}${council ? `, ${council} Area Council` : ""}, the Directorate has considered the inspection report and is pleased to inform you that the site has been found suitable to proceed.`,
        "In continuation of the application, you are requested to upload the following documents to your DOAS practitioner portal:",
        ...REQUIRED_DOCUMENTS.map((d, i) => `${i + 1}. ${d.label}`),
        "The documents will be vetted by the relevant technical units of the Directorate. Please note that the application cannot proceed to billing until all three documents have been received and found satisfactory.",
        ctx.note ? `Additional note: ${ctx.note}` : "",
        "Accept the assurances of the Director's highest regards.",
      ].filter(Boolean),
      facts: [
        { label: "Application reference", value: ref },
        { label: "Site", value: site },
        { label: "Structure (declared)", value: [type, dims].filter(Boolean).join(" · ") },
      ],
    }
  }

  if (kind === "eReceipt") {
    const amount = Number(payment.amountCredited ?? 0)
    const rrr = s(payment.remitaRrr || remita.rrr)
    return {
      ...base,
      subject: "OFFICIAL RECEIPT OF PAYMENT",
      salutation: "",
      amount,
      rrr,
      paragraphs: [
        `Received from ${holder} the sum of ${naira(amount)} being payment for the outdoor advertisement permit on application ${ref}.`,
        "This receipt is generated electronically on confirmation of settlement through Remita and is valid without a signature. Scan the QR code to confirm it.",
      ],
      facts: [
        { label: "Receipt number", value: reference },
        { label: "Amount paid", value: naira(amount) },
        { label: "Remita RRR", value: rrr || "—" },
        { label: "Invoice", value: s(billing.invoiceNumber) || "—" },
        { label: "Payment channel", value: s(payment.paymentChannel).replace(/_/g, " ") || "Remita" },
        { label: "Revenue ledger", value: s(payment.financeLedgerCode) || "—" },
        { label: "Transaction time", value: s(payment.bankTransactionTimestamp) || longDate(ctx.now) },
        { label: "Payer", value: holder },
        { label: "Site", value: site },
      ],
      signatory: "Finance",
      signatoryTitle: "Finance & Accounts, DOAS",
    }
  }

  if (kind === "settingOutCertificate") {
    const report = (row.settingOutReport ?? {}) as Record<string, unknown>
    return {
      ...base,
      subject: "CERTIFICATE OF SETTING OUT",
      salutation: "",
      permitNumber: ctx.permit ?? s(row.permitNumber),
      validFrom: ctx.validFrom,
      validTo: ctx.validTo,
      paragraphs: [
        `This is to certify that the site for the ${type || "advertisement structure"} applied for by ${holder} at ${site}${council ? `, ${council} Area Council` : ""} has been set out by the Monitoring and Enforcement department of the Department of Outdoor Advertisement and Signage in accordance with the approved structural drawing and site inspection report.`,
        "The structure shall be erected only at the position set out, to the approved dimensions, and in compliance with all DOAS regulations. Any deviation renders this certificate void.",
      ],
      facts: [
        { label: "Permit number", value: ctx.permit ?? s(row.permitNumber) },
        { label: "Application reference", value: ref },
        { label: "Structure", value: type || "—" },
        { label: "Dimensions", value: dims || "—" },
        { label: "Display area", value: sqm ? `${sqm.toFixed(2)} m²` : "—" },
        { label: "Coordinates set out", value: s(report.confirmedCoordinates) || gps || "—" },
        { label: "Setback from road", value: report.setbackMeters ? `${report.setbackMeters} m` : "—" },
        { label: "Set out on", value: s(report.settingOutDate) ? longDate(s(report.settingOutDate)) : "—" },
        { label: "Setting-out officer", value: s(report.officerName) || "—" },
        { label: "Valid", value: ctx.validFrom && ctx.validTo ? `${longDate(ctx.validFrom)} to ${longDate(ctx.validTo)}` : "—" },
      ],
    }
  }

  // approvalLetter
  return {
    ...base,
    subject: `RE: APPROVAL FOR THE ERECTION OF ${(type || "ADVERTISEMENT STRUCTURE").toUpperCase()} AT ${site.toUpperCase()}`,
    permitNumber: ctx.permit ?? s(row.permitNumber),
    validFrom: ctx.validFrom ?? s(row.startsAt),
    validTo: ctx.validTo ?? s(row.expiresAt),
    paragraphs: [
      `I am directed to refer to your application ${ref} and to convey the approval of the Director for the erection and display of the ${type || "advertisement structure"} at the above location, in line with the setting-out certificate issued and the approved technical documents.`,
      `The approval is valid${s(row.startsAt) && s(row.expiresAt) ? ` from ${longDate(s(row.startsAt))} to ${longDate(s(row.expiresAt))}` : " for one year from the date of this letter"} and is subject to the following conditions:`,
      "1. The structure shall be erected strictly at the set-out position and to the approved dimensions.",
      "2. The permit number shall be displayed legibly on the structure.",
      "3. The structure shall be maintained in a safe and clean condition at all times.",
      "4. Renewal shall be applied for before expiry; a lapsed permit attracts enforcement and penalties.",
      "5. Any content displayed shall comply with ARCON and DOAS regulations.",
      ctx.note ? `Additional note: ${ctx.note}` : "",
      "Please accept the assurances of the Director's best regards.",
    ].filter(Boolean),
    facts: [
      { label: "Permit number", value: ctx.permit ?? s(row.permitNumber) },
      { label: "Application reference", value: ref },
      { label: "Structure", value: [type, dims].filter(Boolean).join(" · ") || "—" },
      { label: "Site", value: site },
    ],
  }
}

/** Writes the document and returns the summary stored on the submission. */
export async function issueDocument(kind: IssuedKind, row: Row, ctx: IssueContext) {
  const issued = buildIssuedDocument(kind, row, ctx)
  // Firestore rejects undefined values.
  const clean = JSON.parse(JSON.stringify(issued)) as IssuedDocument
  await setDoc(doc(db, COL.issuedDocuments, issued.code), clean)
  return { code: issued.code, title: issued.title, reference: issued.reference, issuedAt: ctx.now, issuedBy: ctx.actorId }
}

export interface IssuedSummary {
  code: string
  title: string
  reference: string
  issuedAt: string
  issuedBy: string
}
