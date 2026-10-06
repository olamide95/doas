import { NextResponse } from "next/server"
import { FieldValue } from "firebase-admin/firestore"
import { adminAuth, adminDb } from "@/lib/firebase-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Must match the DEPARTMENT values in lib/workflow.ts.
const DEPARTMENTS = ["CSU", "Director", "Business Development", "Planning and Development", "Billing", "Finance", "Monitoring and Enforcement"]
const DIRECTOR = "Director"

const fail = (status: number, error: string) => NextResponse.json({ error }, { status })
const message = (err: unknown) => (err instanceof Error ? err.message : "Unexpected error")
const codeOf = (err: unknown) => (err as { code?: string })?.code ?? ""

async function getCaller(req: Request) {
  const header = req.headers.get("authorization") ?? ""
  if (!header.startsWith("Bearer ")) return null
  try {
    const decoded = await adminAuth().verifyIdToken(header.slice(7), true)
    const snap = await adminDb().collection("staff").doc(decoded.uid).get()
    if (!snap.exists) return null
    const data = snap.data() ?? {}
    if (data.active === false) return null
    return { uid: decoded.uid, department: String(data.department ?? "") }
  } catch {
    return null
  }
}

async function registerIsEmpty() {
  const snap = await adminDb().collection("staff").limit(1).get()
  return snap.empty
}

/** Public: tells the login/setup pages whether first-time setup is needed. */
export async function GET() {
  try {
    return NextResponse.json({ needsSetup: await registerIsEmpty() })
  } catch (err) {
    return fail(500, message(err))
  }
}

/** Create a staff member with a sign-in account. Director only (or first-time setup). */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const name = String(body.name ?? body.fullName ?? "").trim()
    const email = String(body.email ?? "").trim().toLowerCase()
    const phone = String(body.phone ?? "").trim()
    const department = String(body.department ?? "")
    const designation = String(body.designation ?? "")
    const password = String(body.password ?? "")

    if (!name || !email || !department || !designation) return fail(400, "Name, email, department and designation are required.")
    if (!DEPARTMENTS.includes(department)) return fail(400, `Unknown department: ${department}`)
    if (password.length < 8) return fail(400, "The temporary password must be at least 8 characters.")

    let createdBy = "setup"
    if (await registerIsEmpty()) {
      const key = process.env.DOAS_SETUP_KEY
      if (!key) return fail(500, "DOAS_SETUP_KEY is not set on the server.")
      if (body.setupKey !== key) return fail(403, "The setup key is incorrect.")
      if (department !== DIRECTOR) return fail(400, "The first account must be the Director.")
    } else {
      const caller = await getCaller(req)
      if (!caller || caller.department !== DIRECTOR) return fail(403, "Only the Director can create staff accounts.")
      createdBy = caller.uid
    }

    let uid: string
    try {
      const user = await adminAuth().createUser({ email, password, displayName: name })
      uid = user.uid
    } catch (err) {
      const code = codeOf(err)
      if (code === "auth/email-already-exists") return fail(409, "An account with this email already exists.")
      if (code === "auth/invalid-password") return fail(400, "Password rejected — use at least 8 characters.")
      if (code === "auth/invalid-email") return fail(400, "That email address isn't valid.")
      throw err
    }

    await adminAuth().setCustomUserClaims(uid, { department })
    await adminDb().collection("staff").doc(uid).set({
      name,
      email,
      phone,
      department,
      designation,
      active: true,
      hasAccount: true,
      createdAt: FieldValue.serverTimestamp(),
      createdBy,
    })

    return NextResponse.json({ uid })
  } catch (err) {
    return fail(500, message(err))
  }
}

/** Suspend / restore, change desk or designation. Director only. */
export async function PATCH(req: Request) {
  try {
    const caller = await getCaller(req)
    if (!caller || caller.department !== DIRECTOR) return fail(403, "Only the Director can change staff accounts.")

    const body = await req.json().catch(() => ({}))
    const uid = String(body.uid ?? "")
    if (!uid) return fail(400, "Missing staff id.")

    const ref = adminDb().collection("staff").doc(uid)
    const snap = await ref.get()
    if (!snap.exists) return fail(404, "Staff member not found.")

    const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp(), updatedBy: caller.uid }

    // Older directory entries may have no sign-in account; skip auth calls for those.
    const authCall = async (fn: () => Promise<unknown>) => {
      try {
        await fn()
      } catch (err) {
        if (codeOf(err) !== "auth/user-not-found") throw err
      }
    }

    if (typeof body.active === "boolean") {
      if (uid === caller.uid && !body.active) return fail(400, "You can't suspend your own account.")
      update.active = body.active
      await authCall(() => adminAuth().updateUser(uid, { disabled: !body.active }))
      if (!body.active) await authCall(() => adminAuth().revokeRefreshTokens(uid))
    }

    if (body.department !== undefined) {
      const department = String(body.department)
      if (!DEPARTMENTS.includes(department)) return fail(400, `Unknown department: ${department}`)
      if (uid === caller.uid && department !== DIRECTOR) return fail(400, "You can't move yourself off the Director's desk.")
      update.department = department
      await authCall(() => adminAuth().setCustomUserClaims(uid, { department }))
    }

    if (body.designation !== undefined) update.designation = String(body.designation)

    await ref.update(update)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return fail(500, message(err))
  }
}
