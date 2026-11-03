"use client"

import * as React from "react"
import { Copy, KeyRound, Loader2, ShieldCheck, ShieldOff, UserRoundPlus } from "lucide-react"
import { auth } from "@/lib/firebase"
import { formatDateTime } from "@/lib/format"
import { toast } from "@/components/ui/toast"
import { ActionButton, TextField } from "@/components/dashboard/form-kit"
import { Field, SectionLabel, StatusPill } from "@/components/dashboard/kit"

/**
 * Portal login for a practitioner, created from their registry file by CSU or
 * the Director. The practitioner then signs in at /login and lands on /portal,
 * where every application is prefilled from this file.
 */

export interface PortalFields {
  id: string
  companyName: string
  email: string
  portalUid?: string
  portalEmail?: string
  portalActive?: boolean
  portalCreatedAt?: string
  portalCreatedBy?: string
  portalPasswordResetAt?: string
}

function tempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
  return Array.from(crypto.getRandomValues(new Uint32Array(10)), (n) => chars[n % chars.length]).join("")
}

async function call(method: "POST" | "PATCH", body: Record<string, unknown>) {
  const token = await auth.currentUser?.getIdToken()
  const res = await fetch("/api/practitioners/account", {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`)
  return json
}

export function PortalAccess({ profile }: { profile: PortalFields }) {
  const [email, setEmail] = React.useState(profile.portalEmail ?? profile.email ?? "")
  const [password, setPassword] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [issued, setIssued] = React.useState<{ email: string; password: string } | null>(null)

  React.useEffect(() => {
    setEmail(profile.portalEmail ?? profile.email ?? "")
    setIssued(null)
    setPassword("")
  }, [profile.id, profile.portalEmail, profile.email])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
    } catch (err) {
      toast.error({ title: "Not done", description: err instanceof Error ? err.message : "Try again." })
    } finally {
      setBusy(false)
    }
  }

  const create = () =>
    run(async () => {
      const pwd = password || tempPassword()
      if (pwd.length < 8) throw new Error("Use at least 8 characters, or leave blank to generate one.")
      const json = await call("POST", { practitionerId: profile.id, email: email.trim(), password: pwd })
      setIssued({ email: String(json.email ?? email), password: pwd })
      setPassword("")
      toast.success({ title: "Portal login created", description: `${profile.companyName} can now sign in.` })
    })

  const reset = () =>
    run(async () => {
      const pwd = tempPassword()
      await call("PATCH", { practitionerId: profile.id, password: pwd })
      setIssued({ email: profile.portalEmail ?? email, password: pwd })
      toast.success({ title: "Password reset", description: "Share the new temporary password with the practitioner." })
    })

  const toggle = (active: boolean) =>
    run(async () => {
      await call("PATCH", { practitionerId: profile.id, active })
      toast.success({ title: active ? "Portal access restored" : "Portal access suspended" })
    })

  const copy = async () => {
    if (!issued) return
    const text = `DOAS practitioner portal\nSign in: ${window.location.origin}/login\nEmail: ${issued.email}\nTemporary password: ${issued.password}\nChange it after your first sign-in using "Forgot password".`
    try {
      await navigator.clipboard.writeText(text)
      toast.success({ title: "Copied", description: "Paste it into an email or letter to the practitioner." })
    } catch {
      toast.warning({ title: "Copy blocked", description: "Select and copy the details manually." })
    }
  }

  return (
    <div>
      <SectionLabel>Practitioner portal access</SectionLabel>
      {profile.portalUid ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Portal login" value={profile.portalEmail} />
            <Field label="Status" value={<StatusPill status={profile.portalActive === false ? "Suspended" : "Active"} />} />
            <Field label="Created" value={`${formatDateTime(profile.portalCreatedAt)}${profile.portalCreatedBy ? ` · ${profile.portalCreatedBy}` : ""}`} />
            {profile.portalPasswordResetAt ? <Field label="Password last reset" value={formatDateTime(profile.portalPasswordResetAt)} /> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton tone="quiet" icon={busy ? Loader2 : KeyRound} disabled={busy} onClick={reset}>
              Reset password
            </ActionButton>
            {profile.portalActive === false ? (
              <ActionButton tone="quiet" icon={ShieldCheck} disabled={busy} onClick={() => toggle(true)}>
                Restore access
              </ActionButton>
            ) : (
              <ActionButton tone="danger" icon={ShieldOff} disabled={busy} onClick={() => toggle(false)}>
                Suspend access
              </ActionButton>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[12.5px] text-muted-foreground">
            Give this practitioner a portal login. They will see new site announcements, apply with their details prefilled, pay fees through Remita and
            follow every application.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField id="portal-email" label="Login email" type="email" value={email} onChange={setEmail} />
            <TextField id="portal-password" label="Temporary password" value={password} onChange={setPassword} placeholder="Leave blank to generate" mono />
          </div>
          <ActionButton icon={busy ? Loader2 : UserRoundPlus} disabled={busy} onClick={create}>
            Create portal login
          </ActionButton>
        </div>
      )}

      {issued ? (
        <div className="mt-3 rounded-lg border border-[hsl(var(--state-clear))]/30 bg-[hsl(var(--state-clear-soft))] px-3.5 py-3 text-[12.5px]">
          <p className="font-semibold text-foreground">Share these sign-in details with the practitioner</p>
          <p className="mt-1 font-mono text-foreground">Email: {issued.email}</p>
          <p className="font-mono text-foreground">Temporary password: {issued.password}</p>
          <div className="mt-2">
            <ActionButton tone="quiet" icon={Copy} onClick={copy}>
              Copy details
            </ActionButton>
          </div>
        </div>
      ) : null}
    </div>
  )
}
