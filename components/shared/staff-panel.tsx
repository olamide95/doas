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
