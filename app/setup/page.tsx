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
