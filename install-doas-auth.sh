#!/usr/bin/env bash
# DOAS ERP — authentication add-on. Run AFTER install-doas.sh, from the project root.
#   bash install-doas-auth.sh
set -euo pipefail

if [ ! -f package.json ]; then
  echo "Run this from the project root (package.json not found)." >&2
  exit 1
fi

w() { mkdir -p "$(dirname "$1")"; cat > "$1"; echo "  wrote $1"; }

echo "Installing DOAS authentication files…"

# ============================================================================
w lib/firebase-admin.ts <<'DOAS_EOF'
import { cert, getApps, initializeApp, type App } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import { getFirestore } from "firebase-admin/firestore"

/**
 * Server-only Firebase Admin. Never import this from a "use client" file.
 * .env.local:
 *   FIREBASE_ADMIN_PROJECT_ID=doas-771c4
 *   FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxx@doas-771c4.iam.gserviceaccount.com
 *   FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
 */
function adminApp(): App {
  const existing = getApps()
  if (existing.length) return existing[0]
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n")
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin credentials are missing. Set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY in .env.local, then restart the server.",
    )
  }
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
}

export const adminAuth = () => getAuth(adminApp())
export const adminDb = () => getFirestore(adminApp())
DOAS_EOF

# ============================================================================
w lib/roles.ts <<'DOAS_EOF'
import { DEPARTMENT } from "@/lib/workflow"

export interface Desk {
  slug: string
  department: string
  path: string
  label: string
  /** Older department names still found on staff records. */
  aliases?: string[]
}

export const DESKS: Desk[] = [
  { slug: "csu", department: DEPARTMENT.csu, path: "/dashboard/csu", label: "Customer Service Unit" },
  { slug: "director", department: DEPARTMENT.director, path: "/dashboard/director", label: "Director's Office", aliases: ["Director's Office"] },
  { slug: "business-development", department: DEPARTMENT.businessDevelopment, path: "/dashboard/business-development", label: "Business Development" },
  { slug: "planning", department: DEPARTMENT.planning, path: "/dashboard/planning", label: "Planning & Development" },
  { slug: "billing", department: DEPARTMENT.billing, path: "/dashboard/billing", label: "Billing" },
  { slug: "finance", department: DEPARTMENT.finance, path: "/dashboard/finance", label: "Finance & Admin", aliases: ["Finance and Admin"] },
  { slug: "monitoring", department: DEPARTMENT.monitoring, path: "/dashboard/monitoring", label: "Monitoring & Enforcement" },
]

export function deskForDepartment(department?: string | null) {
  if (!department) return undefined
  return DESKS.find((d) => d.department === department || d.aliases?.includes(department))
}

export function deskForPath(pathname?: string | null) {
  if (!pathname) return undefined
  return DESKS.find((d) => pathname === d.path || pathname.startsWith(`${d.path}/`))
}

export const DESIGNATIONS = ["Director", "Deputy Director", "Head of Unit", "Manager", "Supervisor", "Officer", "Assistant"]
DOAS_EOF

# ============================================================================
w components/auth/staff-context.tsx <<'DOAS_EOF'
"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { onAuthStateChanged, signOut, type User } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { Loader2 } from "lucide-react"
import { auth, COL, db } from "@/lib/firebase"
import { deskForDepartment, deskForPath } from "@/lib/roles"

export interface StaffProfile {
  uid: string
  name: string
  email: string
  department: string
  designation?: string
  active: boolean
}

const StaffContext = React.createContext<{ staff: StaffProfile | null; user: User | null }>({ staff: null, user: null })

/** The signed-in staff member. Null outside a DeskGuard. */
export const useStaff = () => React.useContext(StaffContext)

/** Staff records are keyed by Firebase Auth uid. */
export async function loadStaff(user: User): Promise<StaffProfile | null> {
  const snap = await getDoc(doc(db, COL.staff, user.uid))
  if (!snap.exists()) return null
  const d = snap.data()
  return {
    uid: user.uid,
    name: String(d.name ?? user.displayName ?? user.email ?? ""),
    email: String(d.email ?? user.email ?? ""),
    department: String(d.department ?? ""),
    designation: d.designation ? String(d.designation) : undefined,
    active: d.active !== false,
  }
}

/**
 * Locks a page to one desk. `desk` is a DEPARTMENT value; if omitted it is
 * worked out from the URL (/dashboard/<desk>). Anyone on the wrong desk is
 * sent to their own dashboard; anyone signed out goes to /login.
 */
export function DeskGuard({ desk, children }: { desk?: string; children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [state, setState] = React.useState<{ user: User | null; staff: StaffProfile | null; ready: boolean }>({
    user: null,
    staff: null,
    ready: false,
  })

  React.useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({ user: null, staff: null, ready: false })
        router.replace(`/login?next=${encodeURIComponent(pathname)}`)
        return
      }
      try {
        const staff = await loadStaff(user)
        if (!staff || !staff.active) {
          await signOut(auth)
          router.replace(`/login?error=${staff ? "suspended" : "unregistered"}`)
          return
        }
        const own = deskForDepartment(staff.department)
        if (!own) {
          await signOut(auth)
          router.replace("/login?error=nodesk")
          return
        }
        const required = desk ?? deskForPath(pathname)?.department
        if (required && own.department !== required) {
          router.replace(own.path)
          return
        }
        setState({ user, staff, ready: true })
      } catch {
        await signOut(auth)
        router.replace("/login?error=failed")
      }
    })
  }, [desk, pathname, router])

  if (!state.ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Checking your access" />
      </div>
    )
  }

  return <StaffContext.Provider value={{ staff: state.staff, user: state.user }}>{children}</StaffContext.Provider>
}
DOAS_EOF

# ============================================================================
w app/dashboard/layout.tsx <<'DOAS_EOF'
"use client"

import { DeskGuard } from "@/components/auth/staff-context"

/** Every /dashboard/<desk> page is locked to staff of that desk. */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DeskGuard>{children}</DeskGuard>
}
DOAS_EOF

# ============================================================================
w app/admin/layout.tsx <<'DOAS_EOF'
"use client"

import { DEPARTMENT } from "@/lib/workflow"
import { DeskGuard } from "@/components/auth/staff-context"

/** Admin tools (e.g. /admin/migrate) are for the Director only. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <DeskGuard desk={DEPARTMENT.director}>{children}</DeskGuard>
}
DOAS_EOF

# ============================================================================
w app/desks/page.tsx <<'DOAS_EOF'
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { onAuthStateChanged } from "firebase/auth"
import { Loader2 } from "lucide-react"
import { auth } from "@/lib/firebase"
import { deskForDepartment } from "@/lib/roles"
import { loadStaff } from "@/components/auth/staff-context"

/** Sends whoever is signed in to their own dashboard, or to /login. */
export default function DesksRedirect() {
  const router = useRouter()

  React.useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login")
        return
      }
      const staff = await loadStaff(user).catch(() => null)
      router.replace(deskForDepartment(staff?.department)?.path ?? "/login")
    })
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )
}
DOAS_EOF

# ============================================================================
w app/login/page.tsx <<'DOAS_EOF'
"use client"

import * as React from "react"
import { Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, type User } from "firebase/auth"
import { KeyRound, Loader2, LogIn } from "lucide-react"
import { auth } from "@/lib/firebase"
import { deskForDepartment, deskForPath } from "@/lib/roles"
import { loadStaff } from "@/components/auth/staff-context"
import { ActionButton, TextField } from "@/components/dashboard/form-kit"
import { Panel } from "@/components/dashboard/kit"

const ERRORS: Record<string, string> = {
  suspended: "Your access has been suspended. Contact the Director's office.",
  unregistered: "This account isn't on the staff register. Ask the Director to add you.",
  nodesk: "Your account has no desk assigned. Ask the Director to set your department.",
  failed: "We couldn't check your access. Check your connection and try again.",
}

function authMessage(err: unknown) {
  const code = (err as { code?: string })?.code ?? ""
  if (["auth/invalid-credential", "auth/user-not-found", "auth/wrong-password", "auth/invalid-email"].includes(code)) return "Email or password is incorrect."
  if (code === "auth/user-disabled") return ERRORS.suspended
  if (code === "auth/too-many-requests") return "Too many attempts. Wait a few minutes, or reset your password."
  if (code === "auth/network-request-failed") return "No connection. Check your internet and try again."
  return err instanceof Error ? err.message : "Sign-in failed."
}

function LoginInner() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get("next")

  const [checking, setChecking] = React.useState(true)
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState(ERRORS[params.get("error") ?? ""] ?? "")
  const [notice, setNotice] = React.useState("")
  const [needsSetup, setNeedsSetup] = React.useState(false)

  const routeUser = React.useCallback(
    async (user: User) => {
      const staff = await loadStaff(user)
      if (!staff) {
        await signOut(auth)
        setError(ERRORS.unregistered)
        return false
      }
      if (!staff.active) {
        await signOut(auth)
        setError(ERRORS.suspended)
        return false
      }
      const desk = deskForDepartment(staff.department)
      if (!desk) {
        await signOut(auth)
        setError(ERRORS.nodesk)
        return false
      }
      const target = next && deskForPath(next)?.department === desk.department ? next : desk.path
      router.replace(target)
      return true
    },
    [next, router],
  )

  React.useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (user) {
        const ok = await routeUser(user).catch(() => {
          setError(ERRORS.failed)
          return false
        })
        if (ok) return
      }
      setBusy(false)
      setChecking(false)
    })
  }, [routeUser])

  React.useEffect(() => {
    fetch("/api/staff")
      .then((r) => r.json())
      .then((j) => setNeedsSetup(Boolean(j.needsSetup)))
      .catch(() => undefined)
  }, [])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!email.trim() || !password) {
      setError("Enter your email and password.")
      return
    }
    setBusy(true)
    setError("")
    setNotice("")
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password)
      // onAuthStateChanged takes it from here and routes to the right desk.
    } catch (err) {
      setError(authMessage(err))
      setBusy(false)
    }
  }

  const reset = async () => {
    if (!email.trim()) {
      setError("Enter your email above first, then click reset.")
      return
    }
    setError("")
    try {
      await sendPasswordResetEmail(auth, email.trim())
      setNotice(`If ${email.trim()} has an account, a reset link is on its way.`)
    } catch (err) {
      setError(authMessage(err))
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary font-display text-[14px] font-bold text-primary-foreground">DO</span>
          <div>
            <p className="font-display text-[18px] font-semibold text-foreground">DOAS staff sign-in</p>
            <p className="text-[12.5px] text-muted-foreground">Directorate of Outdoor Advertisement and Signage</p>
          </div>
        </div>

        <Panel bodyClassName="p-5">
          <form onSubmit={submit} className="space-y-4">
            <TextField id="login-email" label="Work email" type="email" value={email} onChange={setEmail} placeholder="name@doas.gov.ng" />
            <div>
              <label htmlFor="login-password" className="mb-1.5 block text-[12.5px] font-medium text-foreground">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-[13.5px] text-foreground outline-none transition-colors focus:border-ring"
              />
            </div>

            {error ? <p className="rounded-lg bg-[hsl(var(--state-stop-soft))] px-3 py-2 text-[12.5px] text-[hsl(var(--state-stop))]">{error}</p> : null}
            {notice ? <p className="rounded-lg bg-[hsl(var(--state-clear-soft))] px-3 py-2 text-[12.5px] text-[hsl(var(--state-clear))]">{notice}</p> : null}

            <div className="flex items-center justify-between gap-2">
              <button type="button" onClick={reset} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-muted-foreground hover:text-foreground">
                <KeyRound className="h-3.5 w-3.5" /> Forgot password
              </button>
              <ActionButton type="submit" icon={busy ? Loader2 : LogIn} disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
              </ActionButton>
            </div>
          </form>
        </Panel>

        {needsSetup ? (
          <p className="mt-4 text-center text-[12.5px] text-muted-foreground">
            No staff accounts exist yet.{" "}
            <Link href="/setup" className="font-semibold text-accent underline-offset-4 hover:underline">
              Create the Director account
            </Link>
          </p>
        ) : null}

        <p className="mt-6 text-center text-[12.5px] text-muted-foreground">
          Applying for a permit?{" "}
          <Link href="/submission-status" className="font-semibold text-accent underline-offset-4 hover:underline">
            Track your application
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <LoginInner />
    </Suspense>
  )
}
DOAS_EOF

# ============================================================================
w app/setup/page.tsx <<'DOAS_EOF'
"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signInWithEmailAndPassword } from "firebase/auth"
import { Loader2, ShieldCheck } from "lucide-react"
import { auth } from "@/lib/firebase"
import { ActionButton, FieldGrid, TextField } from "@/components/dashboard/form-kit"
import { Panel } from "@/components/dashboard/kit"

/** One-time creation of the first Director. Disabled once any staff exists. */
export default function SetupPage() {
  const router = useRouter()
  const [status, setStatus] = React.useState<"loading" | "open" | "closed" | "error">("loading")
  const [serverError, setServerError] = React.useState("")
  const [form, setForm] = React.useState({ name: "", email: "", phone: "", password: "", confirm: "", setupKey: "" })
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState("")

  React.useEffect(() => {
    fetch("/api/staff")
      .then(async (r) => {
        const j = await r.json()
        if (!r.ok) throw new Error(j.error ?? "Server error")
        setStatus(j.needsSetup ? "open" : "closed")
      })
      .catch((err) => {
        setServerError(err instanceof Error ? err.message : "Server error")
        setStatus("error")
      })
  }, [])

  const submit = async () => {
    setError("")
    if (!form.name.trim() || !form.email.trim()) return setError("Name and email are required.")
    if (form.password.length < 8) return setError("Password must be at least 8 characters.")
    if (form.password !== form.confirm) return setError("Passwords don't match.")
    if (!form.setupKey) return setError("Enter the setup key from your server's .env.local (DOAS_SETUP_KEY).")
    setBusy(true)
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          department: "Director",
          designation: "Director",
          password: form.password,
          setupKey: form.setupKey,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? "Setup failed")
      await signInWithEmailAndPassword(auth, form.email.trim(), form.password)
      router.replace("/dashboard/director")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed")
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-[hsl(var(--state-clear))]" />
          <div>
            <p className="font-display text-[18px] font-semibold text-foreground">First-time setup</p>
            <p className="text-[12.5px] text-muted-foreground">Create the Director&rsquo;s account. Every other account is created by the Director.</p>
          </div>
        </div>

        {status === "loading" ? (
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        ) : status === "error" ? (
          <Panel>
            <p className="text-[13px] text-[hsl(var(--state-stop))]">{serverError}</p>
          </Panel>
        ) : status === "closed" ? (
          <Panel>
            <p className="text-[13.5px] text-foreground">Setup is already done — the staff register isn&rsquo;t empty.</p>
            <Link href="/login" className="mt-3 inline-block text-[13px] font-semibold text-accent underline-offset-4 hover:underline">
              Go to sign-in
            </Link>
          </Panel>
        ) : (
          <Panel bodyClassName="p-5">
            <FieldGrid>
              <TextField id="su-name" label="Director's full name" value={form.name} onChange={(name) => setForm({ ...form, name })} />
              <TextField id="su-email" label="Work email" type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} />
              <TextField id="su-phone" label="Phone" type="tel" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} />
              <TextField id="su-key" label="Setup key" value={form.setupKey} hint="DOAS_SETUP_KEY in .env.local" onChange={(setupKey) => setForm({ ...form, setupKey })} />
              <div>
                <label htmlFor="su-pass" className="mb-1.5 block text-[12.5px] font-medium text-foreground">
                  Password
                </label>
                <input
                  id="su-pass"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 text-[13.5px] outline-none focus:border-ring"
                />
              </div>
              <div>
                <label htmlFor="su-confirm" className="mb-1.5 block text-[12.5px] font-medium text-foreground">
                  Confirm password
                </label>
                <input
                  id="su-confirm"
                  type="password"
                  value={form.confirm}
                  onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 text-[13.5px] outline-none focus:border-ring"
                />
              </div>
            </FieldGrid>
            {error ? <p className="mt-3 rounded-lg bg-[hsl(var(--state-stop-soft))] px-3 py-2 text-[12.5px] text-[hsl(var(--state-stop))]">{error}</p> : null}
            <div className="mt-4 flex justify-end">
              <ActionButton icon={busy ? Loader2 : ShieldCheck} disabled={busy} onClick={submit}>
                {busy ? "Creating…" : "Create Director account"}
              </ActionButton>
            </div>
          </Panel>
        )}
      </div>
    </div>
  )
}
DOAS_EOF

# ============================================================================
w app/api/staff/route.ts <<'DOAS_EOF'
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
DOAS_EOF

# ============================================================================
w components/shared/staff-panel.tsx <<'DOAS_EOF'
"use client"

import * as React from "react"
import { orderBy } from "firebase/firestore"
import { sendPasswordResetEmail } from "firebase/auth"
import { Building2, Copy, KeyRound, Plus, RefreshCw, UserRound, UserRoundPlus, X } from "lucide-react"
import { auth, COL } from "@/lib/firebase"
import { DEPARTMENT } from "@/lib/workflow"
import { DESIGNATIONS } from "@/lib/roles"
import { useRealtimeCollection } from "@/hooks/use-firestore"
import { initials } from "@/lib/format"
import { toast } from "@/components/ui/toast"
import { ActionButton, FieldGrid, SearchField, SelectField, TextField } from "@/components/dashboard/form-kit"
import { EmptyState, LoadFailed, Panel, RowsSkeleton, StatusPill } from "@/components/dashboard/kit"
import { Segmented } from "@/components/dashboard/notifications-panel"
import { useStaff } from "@/components/auth/staff-context"

interface StaffDoc {
  name?: string
  email?: string
  phone?: string
  department?: string
  designation?: string
  active?: boolean
  hasAccount?: boolean
  createdAt?: unknown
}

const DEPARTMENTS = Object.values(DEPARTMENT) as string[]
const emptyForm = { name: "", email: "", phone: "", department: "", designation: "", password: "" }

async function callStaffApi(method: "POST" | "PATCH", body: Record<string, unknown>) {
  const token = await auth.currentUser?.getIdToken()
  const res = await fetch("/api/staff", {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`)
  return json
}

function tempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
  return Array.from(crypto.getRandomValues(new Uint32Array(10)), (n) => chars[n % chars.length]).join("")
}

export function StaffPanel({ scopeTo }: { scopeTo?: string }) {
  const { staff: me } = useStaff()
  const canManage = me?.department === DEPARTMENT.director

  const [search, setSearch] = React.useState("")
  const [tab, setTab] = React.useState<"people" | "units">("people")
  const [composing, setComposing] = React.useState(false)
  const [form, setForm] = React.useState(emptyForm)
  const [saving, setSaving] = React.useState(false)
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [created, setCreated] = React.useState<{ name: string; email: string; password: string } | null>(null)

  const { data, loading, error } = useRealtimeCollection<StaffDoc>(COL.staff, [orderBy("createdAt", "desc")], [])

  const staff = React.useMemo(() => {
    const term = search.trim().toLowerCase()
    return data
      .filter((p) => (scopeTo ? p.department === scopeTo : true))
      .filter((p) => (term ? [p.name, p.email, p.department, p.designation].filter(Boolean).some((v) => String(v).toLowerCase().includes(term)) : true))
  }, [data, search, scopeTo])

  const create = async () => {
    const { name, email, department, designation, password } = form
    if (!name.trim() || !email.trim() || !department || !designation) {
      toast.warning({ title: "Missing detail", description: "Name, email, department and designation are all needed." })
      return
    }
    if (password.length < 8) {
      toast.warning({ title: "Password too short", description: "Use at least 8 characters, or click Generate." })
      return
    }
    setSaving(true)
    try {
      await callStaffApi("POST", { ...form, name: name.trim(), email: email.trim() })
      setCreated({ name: name.trim(), email: email.trim().toLowerCase(), password })
      setForm(emptyForm)
      setComposing(false)
      toast.success({ title: "Staff account created", description: `${name.trim()} can now sign in.` })
    } catch (err) {
      toast.error({ title: "Account not created", description: err instanceof Error ? err.message : "Try again." })
    } finally {
      setSaving(false)
    }
  }

  const patch = async (id: string, body: Record<string, unknown>, success: string) => {
    setBusyId(id)
    try {
      await callStaffApi("PATCH", { uid: id, ...body })
      toast.success({ title: success })
    } catch (err) {
      toast.error({ title: "Not changed", description: err instanceof Error ? err.message : "Try again." })
    } finally {
      setBusyId(null)
    }
  }

  const resetPassword = async (email?: string) => {
    if (!email) return
    try {
      await sendPasswordResetEmail(auth, email)
      toast.success({ title: "Reset email sent", description: email })
    } catch (err) {
      toast.error({ title: "Reset failed", description: err instanceof Error ? err.message : "Try again." })
    }
  }

  const copyCreds = async () => {
    if (!created) return
    const text = `DOAS staff sign-in\nURL: ${window.location.origin}/login\nEmail: ${created.email}\nTemporary password: ${created.password}`
    try {
      await navigator.clipboard.writeText(text)
      toast.success({ title: "Copied" })
    } catch {
      toast.warning({ title: "Copy failed", description: "Select the text and copy it manually." })
    }
  }

  return (
    <Panel
      title="Staff"
      description={`${data.length} ${data.length === 1 ? "person" : "people"} on the directorate roll${canManage ? "" : " · view only"}`}
      actions={
        <>
          <Segmented
            value={tab}
            onChange={(v) => setTab(v as typeof tab)}
            options={[
              { value: "people", label: "People" },
              { value: "units", label: "By unit" },
            ]}
          />
          {canManage ? (
            <ActionButton icon={composing ? X : Plus} onClick={() => setComposing((v) => !v)}>
              {composing ? "Cancel" : "Add staff"}
            </ActionButton>
          ) : null}
        </>
      }
      bodyClassName="p-0"
    >
      {created ? (
        <div className="border-b border-border bg-[hsl(var(--state-clear-soft))] p-4 sm:px-5">
          <p className="text-[13px] font-semibold text-foreground">Login created for {created.name}</p>
          <p className="mt-1 font-mono text-[12.5px] text-foreground">
            {created.email} · {created.password}
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">This password is shown once. Pass it on securely; they can change it with &ldquo;Forgot password&rdquo; on the login page.</p>
          <div className="mt-2 flex gap-2">
            <ActionButton tone="quiet" icon={Copy} onClick={copyCreds}>
              Copy sign-in details
            </ActionButton>
            <ActionButton tone="quiet" icon={X} onClick={() => setCreated(null)}>
              Dismiss
            </ActionButton>
          </div>
        </div>
      ) : null}

      <div className="border-b border-border p-3 sm:px-5">
        <SearchField value={search} onChange={setSearch} placeholder="Search name, email or unit" />
      </div>

      {composing && canManage ? (
        <div className="reveal border-b border-border bg-muted/40 p-4 sm:px-5">
          <FieldGrid>
            <TextField id="st-name" label="Full name" value={form.name} onChange={(name) => setForm({ ...form, name })} />
            <TextField id="st-email" label="Work email (their login)" type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} />
            <TextField id="st-phone" label="Phone" type="tel" value={form.phone} placeholder="0803 000 0000" onChange={(phone) => setForm({ ...form, phone })} />
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <TextField id="st-password" label="Temporary password" mono value={form.password} hint="At least 8 characters" onChange={(password) => setForm({ ...form, password })} />
              </div>
              <div className="pb-[22px]">
                <ActionButton tone="quiet" icon={RefreshCw} onClick={() => setForm({ ...form, password: tempPassword() })}>
                  Generate
                </ActionButton>
              </div>
            </div>
            <SelectField
              id="st-department"
              label="Desk (decides which dashboard they see)"
              value={form.department}
              onChange={(department) => setForm({ ...form, department })}
              options={DEPARTMENTS.map((d) => ({ value: d, label: d }))}
            />
            <SelectField
              id="st-designation"
              label="Designation"
              value={form.designation}
              onChange={(designation) => setForm({ ...form, designation })}
              options={DESIGNATIONS.map((d) => ({ value: d, label: d }))}
            />
          </FieldGrid>
          <div className="mt-3 flex justify-end">
            <ActionButton icon={UserRoundPlus} onClick={create} disabled={saving}>
              {saving ? "Creating account…" : "Create staff account"}
            </ActionButton>
          </div>
        </div>
      ) : null}

      <div className="p-3 sm:p-4">
        {error ? (
          <LoadFailed error={error} what="The staff directory" />
        ) : loading ? (
          <RowsSkeleton rows={5} columns={5} />
        ) : !staff.length ? (
          <EmptyState icon={UserRound} title="Nobody on the directory yet" description="The Director adds staff here, and each person gets a login for their own desk." />
        ) : tab === "people" ? (
          <div className="overflow-x-auto scroll-slim">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border text-[11.5px] font-semibold text-muted-foreground">
                  <th className="px-3 py-2.5">Name</th>
                  <th className="hidden px-3 py-2.5 sm:table-cell">Email</th>
                  <th className="px-3 py-2.5">Desk</th>
                  <th className="hidden px-3 py-2.5 md:table-cell">Designation</th>
                  <th className="px-3 py-2.5">Access</th>
                  {canManage ? <th className="px-3 py-2.5 text-right">Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {staff.map((person) => {
                  const isMe = person.id === me?.uid
                  const busy = busyId === person.id
                  return (
                    <tr key={person.id} className="border-b border-border/70 last:border-0 hover:bg-muted/50">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted font-display text-[11px] font-semibold text-muted-foreground">
                            {initials(person.name)}
                          </span>
                          <span className="text-[13.5px] font-medium text-foreground">
                            {person.name}
                            {isMe ? <span className="ml-1 text-[11px] text-muted-foreground">(you)</span> : null}
                          </span>
                        </div>
                      </td>
                      <td className="hidden px-3 py-3 text-[13px] text-muted-foreground sm:table-cell">{person.email}</td>
                      <td className="px-3 py-3 text-[13px] text-muted-foreground">
                        {canManage && !isMe && person.hasAccount ? (
                          <select
                            value={person.department ?? ""}
                            disabled={busy}
                            onChange={(e) => patch(person.id, { department: e.target.value }, `Moved to ${e.target.value}`)}
                            className="rounded-md border border-input bg-card px-2 py-1 text-[12.5px] outline-none focus:border-ring"
                          >
                            {DEPARTMENTS.map((d) => (
                              <option key={d} value={d}>
                                {d}
                              </option>
                            ))}
                          </select>
                        ) : (
                          person.department
                        )}
                      </td>
                      <td className="hidden px-3 py-3 text-[13px] text-muted-foreground md:table-cell">{person.designation}</td>
                      <td className="px-3 py-3">
                        {person.hasAccount === false ? (
                          <StatusPill status="No login" tone="idle" />
                        ) : (
                          <StatusPill status={person.active === false ? "Suspended" : "Active"} />
                        )}
                      </td>
                      {canManage ? (
                        <td className="px-3 py-3">
                          <div className="flex justify-end gap-1.5">
                            {person.hasAccount !== false ? (
                              <ActionButton tone="quiet" icon={KeyRound} disabled={busy} onClick={() => resetPassword(person.email)}>
                                Reset
                              </ActionButton>
                            ) : null}
                            {!isMe ? (
                              <ActionButton
                                tone={person.active === false ? "primary" : "danger"}
                                disabled={busy}
                                onClick={() =>
                                  patch(person.id, { active: person.active === false }, person.active === false ? `Access restored — ${person.name}` : `Access suspended — ${person.name}`)
                                }
                              >
                                {person.active === false ? "Restore" : "Suspend"}
                              </ActionButton>
                            ) : null}
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {canManage && staff.some((p) => p.hasAccount === false) ? (
              <p className="mt-3 px-3 text-[12px] text-muted-foreground">
                &ldquo;No login&rdquo; entries came from the old directory and can&rsquo;t sign in. Add them again with &ldquo;Add staff&rdquo;, then suspend the old entry.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {DEPARTMENTS.map((department) => {
              const members = staff.filter((p) => p.department === department)
              return (
                <div key={department} className="rounded-lg border border-border p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden />
                    <p className="text-[13.5px] font-semibold text-foreground">{department}</p>
                    <span className="tnum ml-auto text-[12px] text-muted-foreground">{members.length}</span>
                  </div>
                  {members.length ? (
                    <ul className="space-y-2">
                      {members.slice(0, 6).map((p) => (
                        <li key={p.id} className="flex items-center gap-2.5">
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-[10.5px] font-semibold text-muted-foreground">{initials(p.name)}</span>
                          <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">{p.name}</span>
                          <span className="text-[11.5px] text-muted-foreground">{p.designation}</span>
                        </li>
                      ))}
                      {members.length > 6 ? <li className="text-[12px] text-muted-foreground">and {members.length - 6} more</li> : null}
                    </ul>
                  ) : (
                    <p className="text-[12.5px] text-muted-foreground">Nobody assigned yet.</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Panel>
  )
}
DOAS_EOF

# ============================================================================
w firestore.rules <<'DOAS_EOF'
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function signedIn() { return request.auth != null; }
    function staffPath() { return /databases/$(database)/documents/staff/$(request.auth.uid); }
    function isStaff() { return signedIn() && exists(staffPath()) && get(staffPath()).data.active != false; }
    function isDirector() { return isStaff() && get(staffPath()).data.department == 'Director'; }
    // Public tracker lookups are single-document queries by reference.
    function publicLookup() { return request.query.limit <= 1; }

    // Staff records are written only by /api/staff (Admin SDK bypasses rules).
    match /staff/{uid} {
      allow read: if isStaff() || (signedIn() && request.auth.uid == uid);
      allow write: if false;
    }

    function submissionRules() { return true; }

    match /firstPartySubmissions/{id} {
      allow get: if isStaff();
      allow list: if isStaff() || publicLookup();
      allow create: if request.resource.data.status == 'With CSU' && request.resource.data.department == 'CSU';
      allow update: if isStaff()
        // Applicant editing a file that is still with CSU or was returned for changes
        || (resource.data.status in ['With CSU', 'Changes Requested', 'Pending', 'Under Review']
            && request.resource.data.status == 'With CSU'
            && request.resource.data.department == 'CSU')
        // Applicant declaring a payment — only payment.declared, comments and updatedAt may change
        || (resource.data.status in ['Awaiting Payment', 'Part Payment — Balance Due', 'Billed']
            && request.resource.data.status == resource.data.status
            && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['payment', 'comments', 'updatedAt'])
            && request.resource.data.get('payment', {}).diff(resource.data.get('payment', {})).affectedKeys().hasOnly(['declared']));
      allow delete: if isDirector();
    }

    match /thirdPartySubmissions/{id} {
      allow get: if isStaff();
      allow list: if isStaff() || publicLookup();
      allow create: if request.resource.data.status == 'With CSU' && request.resource.data.department == 'CSU';
      allow update: if isStaff()
        || (resource.data.status in ['With CSU', 'Changes Requested', 'Pending', 'Under Review']
            && request.resource.data.status == 'With CSU'
            && request.resource.data.department == 'CSU')
        || (resource.data.status in ['Awaiting Payment', 'Part Payment — Balance Due', 'Billed']
            && request.resource.data.status == resource.data.status
            && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['payment', 'comments', 'updatedAt'])
            && request.resource.data.get('payment', {}).diff(resource.data.get('payment', {})).affectedKeys().hasOnly(['declared']));
      allow delete: if isDirector();
    }

    match /meetingRequests/{id} {
      allow get: if isStaff();
      allow list: if isStaff() || publicLookup();
      allow create: if request.resource.data.status == 'pending';
      allow update, delete: if isStaff();
    }

    // Public forms notify CSU and Finance; only staff read them.
    match /notifications/{id} {
      allow create: if true;
      allow read, update: if isStaff();
      allow delete: if isDirector();
    }

    match /activityLogs/{id} {
      allow read, create: if isStaff();
      allow update, delete: if false;
    }

    match /permitRegister/{id} { allow read, write: if isStaff(); }
    match /tariffSchedules/{id} { allow read, write: if isStaff(); }
    match /complianceIssues/{id} { allow read, write: if isStaff(); }
    match /tasks/{id} { allow read, write: if isStaff(); }
    match /practitioners/{id} { allow read, write: if isStaff(); }
    match /chats/{room}/messages/{id} { allow read, write: if isStaff(); }

    // Everything else is closed.
    match /{document=**} { allow read, write: if false; }
  }
}
DOAS_EOF

# ============================================================================
w storage.rules <<'DOAS_EOF'
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    function isStaff() {
      return request.auth != null
        && firestore.exists(/databases/(default)/documents/staff/$(request.auth.uid))
        && firestore.get(/databases/(default)/documents/staff/$(request.auth.uid)).data.active != false;
    }
    function smallFile() { return request.resource.size < 10 * 1024 * 1024; }

    // Applicant uploads (documents, payment proof). Download URLs are needed right after upload.
    match /submissions/{ref}/{file} {
      allow read: if true;
      allow create: if smallFile();
      allow update, delete: if isStaff();
    }

    match /meeting-requests/{ref}/{file} {
      allow read: if true;
      allow create: if smallFile();
      allow update, delete: if isStaff();
    }

    // Site photos, certificates, finance proofs, practitioner documents — staff only.
    match /{allPaths=**} {
      allow read, write: if isStaff() && (request.resource == null || smallFile());
    }
  }
}
DOAS_EOF

echo ""
echo "Installing firebase-admin…"
npm install firebase-admin || echo "!! npm install firebase-admin failed — run it yourself."

echo ""
echo "Done — 11 files written."
echo "Next: add the Admin credentials and DOAS_SETUP_KEY to .env.local (see instructions), then:"
echo "  npm run dev  →  /setup  →  /login"
