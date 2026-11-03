import { adminAuth, adminDb } from "@/lib/firebase-admin"

export interface StaffCaller {
  kind: "staff"
  uid: string
  name: string
  department: string
  designation: string
}

export interface PortalCaller {
  kind: "practitioner"
  uid: string
  email: string
  practitionerId: string
}

async function decode(req: Request) {
  const header = req.headers.get("authorization") ?? ""
  if (!header.startsWith("Bearer ")) return null
  try {
    return await adminAuth().verifyIdToken(header.slice(7), true)
  } catch {
    return null
  }
}

/** The signed-in, active staff member making the request, or null. */
export async function staffCaller(req: Request): Promise<StaffCaller | null> {
  const decoded = await decode(req)
  if (!decoded) return null
  const snap = await adminDb().collection("staff").doc(decoded.uid).get()
  if (!snap.exists) return null
  const d = snap.data() ?? {}
  if (d.active === false) return null
  return {
    kind: "staff",
    uid: decoded.uid,
    name: String(d.name ?? decoded.name ?? decoded.email ?? ""),
    department: String(d.department ?? ""),
    designation: String(d.designation ?? ""),
  }
}

/** The signed-in, active practitioner making the request, or null. */
export async function portalCaller(req: Request): Promise<PortalCaller | null> {
  const decoded = await decode(req)
  if (!decoded) return null
  const snap = await adminDb().collection("portalUsers").doc(decoded.uid).get()
  if (!snap.exists) return null
  const d = snap.data() ?? {}
  if (d.active === false || !d.practitionerId) return null
  return { kind: "practitioner", uid: decoded.uid, email: String(d.email ?? decoded.email ?? ""), practitionerId: String(d.practitionerId) }
}
