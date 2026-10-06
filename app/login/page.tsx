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
