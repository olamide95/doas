"use client"

import * as React from "react"
import { addDoc, collection, doc, orderBy, serverTimestamp, updateDoc } from "firebase/firestore"
import { Building2, Plus, UserRound, UserRoundPlus, X } from "lucide-react"
import { COL, db } from "@/lib/firebase"
import { DEPARTMENT } from "@/lib/workflow"
import { useRealtimeCollection } from "@/hooks/use-firestore"
import { initials } from "@/lib/format"
import { toast } from "@/components/ui/toast"
import {
  ActionButton,
  FieldGrid,
  SearchField,
  SelectField,
  TextField,
} from "@/components/dashboard/form-kit"
import {
  EmptyState,
  LoadFailed,
  Panel,
  RowsSkeleton,
  StatusPill,
} from "@/components/dashboard/kit"
import { Segmented } from "@/components/dashboard/notifications-panel"

interface StaffDoc {
  name?: string
  email?: string
  phone?: string
  department?: string
  designation?: string
  active?: boolean
  createdAt?: unknown
}

const DEPARTMENTS = Object.values(DEPARTMENT)
const DESIGNATIONS = ["Director", "Manager", "Supervisor", "Officer", "Assistant"]

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  department: "",
  designation: "",
  password: "",
}

export function StaffPanel({ scopeTo }: { scopeTo?: string }) {
  const [search, setSearch] = React.useState("")
  const [tab, setTab] = React.useState<"people" | "units">("people")
  const [composing, setComposing] = React.useState(false)
  const [form, setForm] = React.useState(emptyForm)
  const [saving, setSaving] = React.useState(false)

  const { data, loading, error } = useRealtimeCollection<StaffDoc>(
    COL.staff,
    [orderBy("createdAt", "desc")],
    [],
  )

  const staff = React.useMemo(() => {
    const term = search.trim().toLowerCase()
    return data
      .filter((person) => (scopeTo ? person.department === scopeTo : true))
      .filter((person) =>
        term
          ? [person.name, person.email, person.department, person.designation]
              .filter(Boolean)
              .some((value) => String(value).toLowerCase().includes(term))
          : true,
      )
  }, [data, search, scopeTo])

  const create = async () => {
    const { name, email, department, designation, phone, password } = form
    if (!name.trim() || !email.trim() || !department || !designation) {
      toast.warning({
        title: "Missing detail",
        description: "Name, email, department and designation are all needed.",
      })
      return
    }

    setSaving(true)
    let accountCreated = false

    // Creating a Firebase Auth user from the browser would sign the current
    // admin out, so account creation goes through the server route. If that
    // route isn't deployed yet we still record the person in the directory and
    // say plainly that they can't sign in yet.
    try {
      const response = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, fullName: name }),
      })
      accountCreated = response.ok
    } catch {
      accountCreated = false
    }

    try {
      await addDoc(collection(db, COL.staff), {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        department,
        designation,
        active: true,
        hasAccount: accountCreated,
        createdAt: serverTimestamp(),
      })

      if (accountCreated) {
        toast.success({ title: "Staff member added", description: `${name.trim()} can now sign in.` })
      } else {
        toast.warning({
          title: "Added to the directory",
          description: `${name.trim()} is on file, but no sign-in account was created. Deploy /api/staff to enable that.`,
          duration: 8000,
        })
      }

      setForm(emptyForm)
      setComposing(false)
    } catch (err) {
      toast.error({
        title: "Staff member not added",
        description: err instanceof Error ? err.message : "Try again in a moment.",
      })
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (id: string, active: boolean, name?: string) => {
    try {
      await updateDoc(doc(db, COL.staff, id), { active: !active, updatedAt: new Date().toISOString() })
      toast.success({
        title: active ? "Access suspended" : "Access restored",
        description: name,
      })
    } catch {
      toast.error({ title: "Access not changed", description: "Check your connection and try again." })
    }
  }

  return (
    <Panel
      title="Staff"
      description={`${data.length} ${data.length === 1 ? "person" : "people"} on the directorate roll`}
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
          <ActionButton icon={composing ? X : Plus} onClick={() => setComposing((v) => !v)}>
            {composing ? "Cancel" : "Add staff"}
          </ActionButton>
        </>
      }
      bodyClassName="p-0"
    >
      <div className="border-b border-border p-3 sm:px-5">
        <SearchField value={search} onChange={setSearch} placeholder="Search name, email or unit" />
      </div>

      {composing ? (
        <div className="reveal border-b border-border bg-muted/40 p-4 sm:px-5">
          <FieldGrid>
            <TextField
              id="st-name"
              label="Full name"
              value={form.name}
              onChange={(name) => setForm({ ...form, name })}
            />
            <TextField
              id="st-email"
              label="Work email"
              type="email"
              value={form.email}
              onChange={(email) => setForm({ ...form, email })}
            />
            <TextField
              id="st-phone"
              label="Phone"
              type="tel"
              value={form.phone}
              placeholder="+234 800 000 0000"
              onChange={(phone) => setForm({ ...form, phone })}
            />
            <TextField
              id="st-password"
              label="Temporary password"
              value={form.password}
              hint="They'll be asked to change it on first sign-in."
              onChange={(password) => setForm({ ...form, password })}
            />
            <SelectField
              id="st-department"
              label="Department"
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
              {saving ? "Adding…" : "Add staff member"}
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
          <EmptyState
            icon={UserRound}
            title="Nobody on the directory yet"
            description="Add the people who work each desk so tasks and reports can be assigned to them by name."
          />
        ) : tab === "people" ? (
          <div className="overflow-x-auto scroll-slim">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border text-[11.5px] font-semibold text-muted-foreground">
                  <th className="px-3 py-2.5">Name</th>
                  <th className="hidden px-3 py-2.5 sm:table-cell">Email</th>
                  <th className="px-3 py-2.5">Unit</th>
                  <th className="hidden px-3 py-2.5 md:table-cell">Designation</th>
                  <th className="px-3 py-2.5">Access</th>
                  <th className="px-3 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((person, i) => (
                  <tr
                    key={person.id}
                    style={{ ["--i" as string]: Math.min(i, 10) }}
                    className="reveal border-b border-border/70 last:border-0 hover:bg-muted/50"
                  >
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted font-display text-[11px] font-semibold text-muted-foreground">
                          {initials(person.name)}
                        </span>
                        <span className="text-[13.5px] font-medium text-foreground">
                          {person.name}
                        </span>
                      </div>
                    </td>
                    <td className="hidden px-3 py-3 text-[13px] text-muted-foreground sm:table-cell">
                      {person.email}
                    </td>
                    <td className="px-3 py-3 text-[13px] text-muted-foreground">
                      {person.department}
                    </td>
                    <td className="hidden px-3 py-3 text-[13px] text-muted-foreground md:table-cell">
                      {person.designation}
                    </td>
                    <td className="px-3 py-3">
                      <StatusPill status={person.active === false ? "Suspended" : "Active"} />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <ActionButton
                        tone={person.active === false ? "primary" : "quiet"}
                        onClick={() => toggle(person.id, person.active !== false, person.name)}
                      >
                        {person.active === false ? "Restore access" : "Suspend"}
                      </ActionButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {DEPARTMENTS.map((department, i) => {
              const members = staff.filter((person) => person.department === department)
              return (
                <div
                  key={department}
                  style={{ ["--i" as string]: Math.min(i, 8) }}
                  className="reveal rounded-lg border border-border p-4"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden />
                    <p className="text-[13.5px] font-semibold text-foreground">{department}</p>
                    <span className="tnum ml-auto text-[12px] text-muted-foreground">
                      {members.length}
                    </span>
                  </div>
                  {members.length ? (
                    <ul className="space-y-2">
                      {members.slice(0, 5).map((person) => (
                        <li key={person.id} className="flex items-center gap-2.5">
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-[10.5px] font-semibold text-muted-foreground">
                            {initials(person.name)}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                            {person.name}
                          </span>
                          <span className="text-[11.5px] text-muted-foreground">
                            {person.designation}
                          </span>
                        </li>
                      ))}
                      {members.length > 5 ? (
                        <li className="text-[12px] text-muted-foreground">
                          and {members.length - 5} more
                        </li>
                      ) : null}
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
