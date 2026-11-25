import { randomInt } from "crypto"
import { NextResponse } from "next/server"
import { FieldValue } from "firebase-admin/firestore"
import { adminDb } from "@/lib/firebase-admin"
import { staffCaller, type StaffCaller } from "@/lib/server/auth"
import {
  LICENCE_KIND,
  buildLicenceDocument,
  cleanLicenceInput,
  formatIssueDate,
  issuedAtFor,
  summaryOf,
  validateLicenceInput,
  type LicenceChange,
  type LicenceDocument,
  type LicenceInput,
} from "@/lib/practising-licence"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Practising licences, generated from the practitioner registry by CSU or
 * the Director.
 *
 *   POST  { practitionerId, holderName, licenceNumber, issueDate }
 *         generate the licence for a validated practitioner
 *   PATCH { practitionerId, holderName?, licenceNumber?, issueDate? }
 *         correct what is printed on it (the QR code stays the same)
 *   PATCH { practitionerId, status: "revoked" | "valid", reason? }
 *         revoke or restore it
 *
 * The licence is issuedDocuments/{code}; the practitioner's file keeps a
 * summary in practisingLicence. Both are written together.
 */

const MANAGERS = ["CSU", "Director"]
const ISSUED = "issuedDocuments"
const PROFILES = "practitionerProfiles"
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

const fail = (status: number, error: string, fields?: Record<string, string>) => NextResponse.json({ error, ...(fields ? { fields } : {}) }, { status })

async function manager(req: Request) {
  const caller = await staffCaller(req)
  return caller && MANAGERS.includes(caller.department) ? caller : null
}

const deskOf = (caller: StaffCaller) => (caller.department === "CSU" ? "csu" : "director")
const actorOf = (caller: StaffCaller) => (caller.name ? `${caller.name} (${caller.department})` : caller.department)

function newCode() {
  let tail = ""
  for (let i = 0; i < 10; i += 1) tail += ALPHABET[randomInt(ALPHABET.length)]
  return `DOAS-LIC-${new Date().getFullYear()}-${tail}`
}

/** True when another licence already carries this number. */
async function numberTaken(licenceNumber: string, exceptCode?: string) {
  const snap = await adminDb().collection(ISSUED).where("licenceNumber", "==", licenceNumber).limit(5).get()
  return snap.docs.some((d) => d.id !== exceptCode && d.data()?.kind === LICENCE_KIND)
}

async function log(caller: StaffCaller, practitionerId: string, action: string, comment: string, now: string) {
  try {
    await adminDb().collection("activityLogs").add({
      module: "practising-licence",
      practitionerId,
      action,
      comment,
      userId: deskOf(caller),
      timestamp: now,
    })
  } catch {
    // The audit trail is best-effort; the licence itself is already saved.
  }
}

export async function POST(req: Request) {
  try {
    const caller = await manager(req)
    if (!caller) return fail(403, "Only CSU or the Director can generate a practising licence.")

    const body = await req.json().catch(() => ({}))
    const practitionerId = String(body.practitionerId ?? "").trim()
    if (!practitionerId) return fail(400, "Missing practitioner.")

    const input = cleanLicenceInput({
      holderName: String(body.holderName ?? ""),
      licenceNumber: String(body.licenceNumber ?? ""),
      issueDate: String(body.issueDate ?? ""),
    })
    const errors = validateLicenceInput(input)
    if (Object.keys(errors).length) return fail(400, Object.values(errors)[0] ?? "Check the licence details.", errors as Record<string, string>)

    const profileRef = adminDb().collection(PROFILES).doc(practitionerId)
    const profileSnap = await profileRef.get()
    if (!profileSnap.exists) return fail(404, "Practitioner file not found.")
    const profile = profileSnap.data() ?? {}

    const current = profile.practisingLicence as { code?: string; licenceNumber?: string } | undefined
    if (current?.code) {
      return fail(409, `This practitioner already holds licence ${current.licenceNumber ?? current.code}. Correct that licence instead of generating another.`)
    }
    if (await numberTaken(input.licenceNumber)) {
      return fail(409, `Licence number ${input.licenceNumber} is already on another practitioner's licence.`, { licenceNumber: "Already used on another licence" })
    }

    // Collisions are astronomically unlikely, but a licence must never overwrite another.
    let code = newCode()
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const clash = await adminDb().collection(ISSUED).doc(code).get()
      if (!clash.exists) break
      code = newCode()
    }

    const now = new Date().toISOString()
    const licence = buildLicenceDocument({
      code,
      input,
      practitionerId,
      doasPractitionerId: String(profile.doasPractitionerId ?? "") || undefined,
      practitionerUid: String(profile.portalUid ?? "") || undefined,
      holderAddress: String(profile.hqAddress ?? ""),
      actor: actorOf(caller),
      now,
    })

    const batch = adminDb().batch()
    batch.create(adminDb().collection(ISSUED).doc(code), licence)
    batch.update(profileRef, { practisingLicence: summaryOf(licence) })
    await batch.commit()

    await log(caller, practitionerId, `Practising licence generated for ${input.holderName}`, `${input.licenceNumber} · ${formatIssueDate(input.issueDate)} · ${code}`, now)
    return NextResponse.json({ licence: summaryOf(licence) })
  } catch (err) {
    return fail(500, err instanceof Error ? err.message : "Unexpected error")
  }
}

export async function PATCH(req: Request) {
  try {
    const caller = await manager(req)
    if (!caller) return fail(403, "Only CSU or the Director can change a practising licence.")

    const body = await req.json().catch(() => ({}))
    const practitionerId = String(body.practitionerId ?? "").trim()
    if (!practitionerId) return fail(400, "Missing practitioner.")

    const profileRef = adminDb().collection(PROFILES).doc(practitionerId)
    const profileSnap = await profileRef.get()
    if (!profileSnap.exists) return fail(404, "Practitioner file not found.")
    const code = String((profileSnap.data()?.practisingLicence as { code?: string } | undefined)?.code ?? "")
    if (!code) return fail(400, "This practitioner has no practising licence yet.")

    const licenceRef = adminDb().collection(ISSUED).doc(code)
    const licenceSnap = await licenceRef.get()
    if (!licenceSnap.exists) return fail(404, "The licence record is missing. Contact the administrator.")
    const existing = licenceSnap.data() as LicenceDocument

    const now = new Date().toISOString()
    const actor = actorOf(caller)
    const changes: Record<string, unknown> = {}
    const history: LicenceChange[] = []
    const next: LicenceDocument = { ...existing }

    /* ---- Corrections to the printed details ---- */
    const correcting = body.holderName !== undefined || body.licenceNumber !== undefined || body.issueDate !== undefined
    if (correcting) {
      const input: LicenceInput = cleanLicenceInput({
        holderName: body.holderName !== undefined ? String(body.holderName) : existing.holderName,
        licenceNumber: body.licenceNumber !== undefined ? String(body.licenceNumber) : existing.licenceNumber,
        issueDate: body.issueDate !== undefined ? String(body.issueDate) : existing.issueDate,
      })
      const errors = validateLicenceInput(input)
      if (Object.keys(errors).length) return fail(400, Object.values(errors)[0] ?? "Check the licence details.", errors as Record<string, string>)

      const diffs: string[] = []
      if (input.holderName !== existing.holderName) diffs.push(`name "${existing.holderName}" → "${input.holderName}"`)
      if (input.licenceNumber !== existing.licenceNumber) diffs.push(`number ${existing.licenceNumber} → ${input.licenceNumber}`)
      if (input.issueDate !== existing.issueDate) diffs.push(`date ${formatIssueDate(existing.issueDate)} → ${formatIssueDate(input.issueDate)}`)

      if (diffs.length) {
        if (input.licenceNumber !== existing.licenceNumber && (await numberTaken(input.licenceNumber, code))) {
          return fail(409, `Licence number ${input.licenceNumber} is already on another practitioner's licence.`, { licenceNumber: "Already used on another licence" })
        }
        // Rebuild the derived text so the stored record always matches the certificate.
        const rebuilt = buildLicenceDocument({ code, input, practitionerId, actor, now })
        Object.assign(changes, {
          holderName: input.holderName,
          licenceNumber: input.licenceNumber,
          issueDate: input.issueDate,
          reference: rebuilt.reference,
          paragraphs: rebuilt.paragraphs,
          facts: rebuilt.facts,
          issuedAt: issuedAtFor(input.issueDate),
        })
        Object.assign(next, changes)
        history.push({ at: now, by: actor, action: "corrected", detail: diffs.join("; ") })
      }
    }

    /* ---- Revoke / restore ---- */
    if (body.status !== undefined) {
      const status = String(body.status)
      if (status !== "valid" && status !== "revoked") return fail(400, "Status must be valid or revoked.")
      if (status !== existing.status) {
        const reason = String(body.reason ?? "").trim().slice(0, 300)
        if (status === "revoked" && reason.length < 5) return fail(400, "Give the reason for revoking this licence.")
        changes.status = status
        changes.revokedReason = status === "revoked" ? reason : FieldValue.delete()
        next.status = status
        if (status === "revoked") next.revokedReason = reason
        else delete next.revokedReason
        history.push({ at: now, by: actor, action: status === "revoked" ? "revoked" : "restored", detail: status === "revoked" ? reason : "Licence restored" })
      }
    }

    if (!history.length) return NextResponse.json({ licence: summaryOf(existing), unchanged: true })

    next.updatedAt = now
    next.updatedBy = actor
    const batch = adminDb().batch()
    batch.update(licenceRef, { ...changes, updatedAt: now, updatedBy: actor, history: FieldValue.arrayUnion(...history) })
    batch.update(profileRef, { practisingLicence: summaryOf(next) })
    await batch.commit()

    for (const entry of history) {
      const action =
        entry.action === "corrected" ? "Practising licence corrected" : entry.action === "revoked" ? "Practising licence revoked" : "Practising licence restored"
      await log(caller, practitionerId, `${action} — ${next.holderName}`, `${entry.detail} · ${code}`, now)
    }
    return NextResponse.json({ licence: summaryOf(next) })
  } catch (err) {
    return fail(500, err instanceof Error ? err.message : "Unexpected error")
  }
}
