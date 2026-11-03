import { NextResponse } from "next/server"
import { FieldValue } from "firebase-admin/firestore"
import { adminAuth, adminDb } from "@/lib/firebase-admin"
import { staffCaller } from "@/lib/server/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Practitioner portal logins, created from the practitioner registry by CSU
 * or the Director.
 *
 *   POST  { practitionerId, email?, password }          create the login
 *   PATCH { practitionerId, active?: boolean, password? } suspend / restore / reset password
 *
 * A login is a Firebase Auth user plus portalUsers/{uid} → practitionerId.
 * The profile keeps portalUid / portalEmail / portalActive for the registry UI.
 */

const MANAGERS = ["CSU", "Director"]
const fail = (status: number, error: string) => NextResponse.json({ error }, { status })
const codeOf = (err: unknown) => (err as { code?: string })?.code ?? ""
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

async function manager(req: Request) {
  const caller = await staffCaller(req)
  return caller && MANAGERS.includes(caller.department) ? caller : null
}

export async function POST(req: Request) {
  try {
    const caller = await manager(req)
    if (!caller) return fail(403, "Only CSU or the Director can create practitioner logins.")

    const body = await req.json().catch(() => ({}))
    const practitionerId = String(body.practitionerId ?? "")
    const password = String(body.password ?? "")
    if (!practitionerId) return fail(400, "Missing practitioner.")
    if (password.length < 8) return fail(400, "The temporary password must be at least 8 characters.")

    const profileRef = adminDb().collection("practitionerProfiles").doc(practitionerId)
    const profileSnap = await profileRef.get()
    if (!profileSnap.exists) return fail(404, "Practitioner file not found.")
    const profile = profileSnap.data() ?? {}
    if (profile.portalUid) return fail(409, "This practitioner already has a portal login. Reset the password instead.")

    const email = String(body.email || profile.email || "").trim().toLowerCase()
    if (!EMAIL.test(email)) return fail(400, "Give a valid email for the login.")
    const companyName = String(profile.companyName ?? "")

    let uid: string
    try {
      const existing = await adminAuth().getUserByEmail(email)
      const staff = await adminDb().collection("staff").doc(existing.uid).get()
      if (staff.exists) return fail(409, "That email belongs to a staff account. Use a different email for the portal.")
      const linked = await adminDb().collection("portalUsers").doc(existing.uid).get()
      if (linked.exists && linked.data()?.practitionerId !== practitionerId) return fail(409, "That email is already linked to another practitioner.")
      uid = existing.uid
      await adminAuth().updateUser(uid, { password, disabled: false, displayName: companyName })
    } catch (err) {
      if (codeOf(err) !== "auth/user-not-found") {
        if (codeOf(err) === "auth/invalid-password") return fail(400, "Password rejected — use at least 8 characters.")
        throw err
      }
      try {
        const user = await adminAuth().createUser({ email, password, displayName: companyName })
        uid = user.uid
      } catch (inner) {
        const code = codeOf(inner)
        if (code === "auth/invalid-email") return fail(400, "That email address isn't valid.")
        if (code === "auth/invalid-password") return fail(400, "Password rejected — use at least 8 characters.")
        throw inner
      }
    }

    await adminAuth().setCustomUserClaims(uid, { portal: "practitioner", practitionerId })
    const now = new Date().toISOString()
    await adminDb().collection("portalUsers").doc(uid).set({
      type: "practitioner",
      practitionerId,
      doasPractitionerId: String(profile.doasPractitionerId ?? ""),
      companyName,
      email,
      active: true,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: caller.uid,
      createdByDesk: caller.department,
    })
    await profileRef.update({ portalUid: uid, portalEmail: email, portalActive: true, portalCreatedAt: now, portalCreatedBy: caller.department })
    await adminDb().collection("activityLogs").add({
      module: "practitioner-portal",
      practitionerId,
      action: `Portal login created for ${companyName}`,
      comment: email,
      userId: caller.department === "CSU" ? "csu" : "director",
      timestamp: now,
    })

    return NextResponse.json({ uid, email })
  } catch (err) {
    return fail(500, err instanceof Error ? err.message : "Unexpected error")
  }
}

export async function PATCH(req: Request) {
  try {
    const caller = await manager(req)
    if (!caller) return fail(403, "Only CSU or the Director can change practitioner logins.")

    const body = await req.json().catch(() => ({}))
    const practitionerId = String(body.practitionerId ?? "")
    const profileRef = adminDb().collection("practitionerProfiles").doc(practitionerId)
    const profileSnap = await profileRef.get()
    if (!profileSnap.exists) return fail(404, "Practitioner file not found.")
    const uid = String(profileSnap.data()?.portalUid ?? "")
    if (!uid) return fail(400, "This practitioner has no portal login yet.")

    const now = new Date().toISOString()
    if (typeof body.active === "boolean") {
      await adminAuth().updateUser(uid, { disabled: !body.active })
      if (!body.active) await adminAuth().revokeRefreshTokens(uid)
      await adminDb().collection("portalUsers").doc(uid).update({ active: body.active, updatedAt: now })
      await profileRef.update({ portalActive: body.active, portalUpdatedAt: now })
    }
    if (body.password !== undefined) {
      const password = String(body.password)
      if (password.length < 8) return fail(400, "The temporary password must be at least 8 characters.")
      await adminAuth().updateUser(uid, { password })
      await adminAuth().revokeRefreshTokens(uid)
      await profileRef.update({ portalPasswordResetAt: now })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    return fail(500, err instanceof Error ? err.message : "Unexpected error")
  }
}
