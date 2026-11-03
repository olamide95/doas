"use client"

import * as React from "react"
import { doc, getDoc, limit, setDoc, updateDoc, writeBatch } from "firebase/firestore"
import { Copy, FileSpreadsheet, Loader2, Plus, Save, Search, Upload, UserRoundPlus, Users } from "lucide-react"
import { auth, COL, db } from "@/lib/firebase"
import { DEPARTMENT, FILE_DEPARTMENTS } from "@/lib/workflow"
import { DESIGNATIONS } from "@/lib/roles"
import {
  EMPTY_ROLL,
  ROLL_STATUSES,
  fullNameOf,
  parseRollRows,
  retirementDate,
  rollDocId,
  rollKey,
  yearsOfService,
  type ParsedSheet,
  type RollEntry,
} from "@/lib/nominal-roll"
import { useRealtimeCollection } from "@/hooks/use-firestore"
import { formatDate } from "@/lib/format"
import { toast } from "@/components/ui/toast"
import { Sheet } from "@/components/dashboard/sheet"
import { ActionButton, FieldGrid, NumberField, SelectField, TextField, TextareaField } from "@/components/dashboard/form-kit"
import { EmptyState, Field, LoadFailed, Panel, RowsSkeleton, SectionLabel, StatTile, StatusPill } from "@/components/dashboard/kit"
import { Segmented } from "@/components/dashboard/notifications-panel"
import { cn } from "@/lib/utils"

export type RollRow = RollEntry & { id: string }

const POSTINGS = [...FILE_DEPARTMENTS, DEPARTMENT.staffAdmin]

export function useNominalRoll() {
  const { data, loading, error } = useRealtimeCollection<RollEntry>(COL.nominalRoll, [limit(3000)], [])
  const rows = React.useMemo(
    () => [...data].sort((a, b) => (b.gradeLevel ?? 0) - (a.gradeLevel ?? 0) || (a.surname ?? "").localeCompare(b.surname ?? "")) as RollRow[],
    [data],
  )
  return { rows, loading, error }
}

function retiringWithin(e: RollEntry, days: number) {
  const r = retirementDate(e)
  if (!r) return false
  const left = (new Date(r).getTime() - Date.now()) / 86_400_000
  return left <= days
}

/* ------------------------------------------------------------------ *
 * Overview tiles (used on the Staff Admin overview)
 * ------------------------------------------------------------------ */

export function RollStats({ onOpen }: { onOpen?: () => void }) {
  const { rows } = useNominalRoll()
  const active = rows.filter((r) => (r.status ?? "Active") === "Active")
  const withLogin = rows.filter((r) => r.staffUid).length
  const retiring = active.filter((r) => retiringWithin(r, 365)).length
  const unposted = active.filter((r) => !r.department).length
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatTile index={0} label="Staff on the roll" value={active.length} tone="move" icon={Users} note={`${rows.length} records in total`} onClick={onOpen} />
      <StatTile index={1} label="With a DOAS sign-in" value={withLogin} tone="clear" icon={UserRoundPlus} />
      <StatTile index={2} label="Retiring within 12 months" value={retiring} tone={retiring ? "wait" : "clear"} icon={FileSpreadsheet} note="60 years of age or 35 years of service" />
      <StatTile index={3} label="Not posted to a unit" value={unposted} tone={unposted ? "wait" : "clear"} icon={Users} onClick={onOpen} />
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Nominal roll
 * ------------------------------------------------------------------ */

export function NominalRollPanel() {
  const { rows, loading, error } = useNominalRoll()
  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState<string>("Active")
  const [unit, setUnit] = React.useState("")
  const [openId, setOpenId] = React.useState<string | "new" | null>(null)
  const [importing, setImporting] = React.useState(false)

  const term = search.trim().toLowerCase()
  const visible = rows.filter((r) => {
    if (status && (r.status ?? "Active") !== status) return false
    if (unit === "__none" ? Boolean(r.department) : unit && r.department !== unit) return false
    if (!term) return true
    return [r.fullName, r.rank, r.phone, r.email, r.pfNumber, r.state, r.lga, r.department].filter(Boolean).some((v) => String(v).toLowerCase().includes(term))
  })

  const current = openId && openId !== "new" ? rows.find((r) => r.id === openId) ?? null : null

  return (
    <>
      <Panel
        title="Nominal roll"
        description="The Directorate's staff establishment. Import the FCTA workbook, keep records current and post staff to units."
        actions={
          <>
            <ActionButton tone="quiet" icon={Upload} onClick={() => setImporting(true)}>
              Import workbook
            </ActionButton>
            <ActionButton icon={Plus} onClick={() => setOpenId("new")}>
              Add staff
            </ActionButton>
          </>
        }
        bodyClassName="p-0"
      >
        <div className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row sm:items-center sm:px-5">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, rank, PF number, phone, state…"
              className="w-full rounded-lg border border-input bg-card py-2 pl-9 pr-3 text-[13px] outline-none focus:border-ring"
            />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-input bg-card px-3 py-2 text-[13px]">
            <option value="">All statuses</option>
            {ROLL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select value={unit} onChange={(e) => setUnit(e.target.value)} className="rounded-lg border border-input bg-card px-3 py-2 text-[13px]">
            <option value="">All units</option>
            <option value="__none">Not posted</option>
            {POSTINGS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div className="p-3 sm:p-4">
          {error ? (
            <LoadFailed error={error} what="The nominal roll" />
          ) : loading ? (
            <RowsSkeleton rows={8} columns={6} />
          ) : !visible.length ? (
            <EmptyState
              icon={Users}
              title={rows.length ? "No one matches" : "The nominal roll is empty"}
              description={rows.length ? "Change the search or filters." : "Import the FCTA nominal-roll workbook to load every member of staff."}
              action={
                !rows.length ? (
                  <ActionButton icon={Upload} onClick={() => setImporting(true)}>
                    Import workbook
                  </ActionButton>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto scroll-slim">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-border text-[11.5px] font-semibold text-muted-foreground">
                    <th className="px-3 py-2.5">Name</th>
                    <th className="hidden px-3 py-2.5 md:table-cell">Rank</th>
                    <th className="px-3 py-2.5">GL/Step</th>
                    <th className="hidden px-3 py-2.5 lg:table-cell">Unit</th>
                    <th className="hidden px-3 py-2.5 lg:table-cell">Retires</th>
                    <th className="hidden px-3 py-2.5 sm:table-cell">Sign-in</th>
                    <th className="px-3 py-2.5 text-right">Record</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => {
                    const retires = retirementDate(r)
                    const soon = retiringWithin(r, 365)
                    return (
                      <tr key={r.id} className="border-b border-border/70 last:border-0 hover:bg-muted/50">
                        <td className="px-3 py-2.5">
                          <p className="text-[13px] font-medium text-foreground">{r.fullName || fullNameOf(r)}</p>
                          <p className="text-[11.5px] text-muted-foreground">
                            {r.pfNumber ? `PF ${r.pfNumber} · ` : ""}
                            {[r.state, r.lga].filter(Boolean).join(" / ")}
                          </p>
                        </td>
                        <td className="hidden px-3 py-2.5 text-[12.5px] text-muted-foreground md:table-cell">{r.rank || "—"}</td>
                        <td className="px-3 py-2.5 font-mono text-[12px]">
                          {r.gradeLevel ?? "—"}/{r.step ?? "—"}
                        </td>
                        <td className="hidden px-3 py-2.5 text-[12.5px] lg:table-cell">{r.department || <span className="text-[hsl(var(--state-wait))]">Not posted</span>}</td>
                        <td className={cn("hidden px-3 py-2.5 text-[12.5px] lg:table-cell", soon ? "font-semibold text-[hsl(var(--state-stop))]" : "text-muted-foreground")}>
                          {retires ? formatDate(retires) : "—"}
                        </td>
                        <td className="hidden px-3 py-2.5 sm:table-cell">{r.staffUid ? <StatusPill status="Active" /> : <span className="text-[12px] text-muted-foreground">None</span>}</td>
                        <td className="px-3 py-2.5 text-right">
                          <ActionButton tone="quiet" onClick={() => setOpenId(r.id)}>
                            Open
                          </ActionButton>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <p className="mt-3 px-3 text-[12px] text-muted-foreground">
                Showing {visible.length} of {rows.length}
              </p>
            </div>
          )}
        </div>
      </Panel>

      {openId ? <RollSheet key={openId} existing={current} onClose={() => setOpenId(null)} /> : null}
      {importing ? <ImportSheet existingIds={new Set(rows.map((r) => r.id))} onClose={() => setImporting(false)} /> : null}
    </>
  )
}

/* ------------------------------------------------------------------ *
 * One record
 * ------------------------------------------------------------------ */

function tempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
  return Array.from(crypto.getRandomValues(new Uint32Array(10)), (n) => chars[n % chars.length]).join("")
}

function RollSheet({ existing, onClose }: { existing: RollRow | null; onClose: () => void }) {
  const [form, setForm] = React.useState<Omit<RollEntry, "key" | "source">>(() => ({ ...EMPTY_ROLL, ...(existing ?? {}) }))
  const [busy, setBusy] = React.useState(false)
  const [account, setAccount] = React.useState({ email: existing?.email ?? "", designation: existing?.designation ?? "", department: existing?.department ?? "" })
  const [issued, setIssued] = React.useState<{ email: string; password: string } | null>(null)
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  const save = async () => {
    if (!form.surname.trim() || !form.firstName.trim()) {
      toast.warning({ title: "Surname and first name are required" })
      return
    }
    setBusy(true)
    const now = new Date().toISOString()
    try {
      const surname = form.surname.trim().toUpperCase()
      const firstName = form.firstName.trim().toUpperCase()
      const middleName = form.middleName.trim().toUpperCase()
      const record = {
        ...form,
        surname,
        firstName,
        middleName,
        fullName: fullNameOf({ surname, firstName, middleName }),
        updatedAt: now,
      }
      if (existing) {
        const { id: _id, ...rest } = { ...existing, ...record }
        void _id
        await updateDoc(doc(db, COL.nominalRoll, existing.id), JSON.parse(JSON.stringify(rest)))
      } else {
        const key = rollKey(surname, firstName)
        await setDoc(doc(db, COL.nominalRoll, rollDocId(key)), JSON.parse(JSON.stringify({ ...record, key, source: "Added by Staff Admin", createdAt: now })), { merge: true })
      }
      toast.success({ title: existing ? "Record updated" : "Staff added to the roll" })
      onClose()
    } catch (err) {
      toast.error({ title: "Not saved", description: err instanceof Error ? err.message : "Try again." })
    } finally {
      setBusy(false)
    }
  }

  const createLogin = async () => {
    if (!existing) return
    if (!account.email.trim() || !account.department || !account.designation) {
      toast.warning({ title: "Email, unit and designation are needed" })
      return
    }
    setBusy(true)
    try {
      const password = tempPassword()
      const token = await auth.currentUser?.getIdToken()
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          name: existing.fullName || fullNameOf(existing),
          email: account.email.trim(),
          phone: existing.phone ?? "",
          department: account.department,
          designation: account.designation,
          password,
          rollId: existing.id,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? "Account not created")
      setIssued({ email: account.email.trim().toLowerCase(), password })
      toast.success({ title: "Sign-in account created" })
    } catch (err) {
      toast.error({ title: "Account not created", description: err instanceof Error ? err.message : "Try again." })
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    if (!issued) return
    try {
      await navigator.clipboard.writeText(`DOAS staff sign-in\nURL: ${window.location.origin}/login\nEmail: ${issued.email}\nTemporary password: ${issued.password}`)
      toast.success({ title: "Copied" })
    } catch {
      toast.warning({ title: "Copy blocked", description: "Select and copy the details manually." })
    }
  }

  const retires = retirementDate(form)
  const service = yearsOfService(form.firstAppointment)

  return (
    <Sheet
      open
      onClose={onClose}
      title={existing ? existing.fullName || fullNameOf(existing) : "Add to the nominal roll"}
      caption={existing ? `${existing.rank || "—"} · GL ${existing.gradeLevel ?? "—"}/${existing.step ?? "—"}` : "New record"}
      width="max-w-3xl"
      footer={
        <div className="flex justify-end gap-2">
          <ActionButton tone="quiet" onClick={onClose}>
            Close
          </ActionButton>
          <ActionButton icon={busy ? Loader2 : Save} disabled={busy} onClick={save}>
            Save record
          </ActionButton>
        </div>
      }
    >
      <div className="space-y-6">
        {existing ? (
          <div className="grid grid-cols-3 gap-4 rounded-lg bg-muted/40 p-3.5">
            <Field label="Years of service" value={service !== null ? `${service}` : "—"} />
            <Field label="Retirement due" value={retires ? formatDate(retires) : "—"} />
            <Field label="Imported from" value={existing.source} />
          </div>
        ) : null}

        <div>
          <SectionLabel>Personal</SectionLabel>
          <FieldGrid columns={3}>
            <TextField id="nr-sur" label="Surname *" value={form.surname} onChange={(v) => set({ surname: v })} />
            <TextField id="nr-first" label="First name *" value={form.firstName} onChange={(v) => set({ firstName: v })} />
            <TextField id="nr-mid" label="Middle name" value={form.middleName} onChange={(v) => set({ middleName: v })} />
            <TextField id="nr-dob" label="Date of birth" type="date" value={form.dateOfBirth} onChange={(v) => set({ dateOfBirth: v })} />
            <TextField id="nr-state" label="State of origin" value={form.state} onChange={(v) => set({ state: v })} />
            <TextField id="nr-lga" label="LGA" value={form.lga} onChange={(v) => set({ lga: v })} />
            <TextField id="nr-phone" label="Phone" type="tel" value={form.phone} onChange={(v) => set({ phone: v })} />
            <TextField id="nr-email" label="Email" type="email" value={form.email} onChange={(v) => set({ email: v })} />
            <SelectField id="nr-status" label="Status" value={form.status} onChange={(v) => set({ status: (v || "Active") as RollEntry["status"] })} options={ROLL_STATUSES.map((s) => ({ value: s, label: s }))} />
          </FieldGrid>
          <div className="mt-4">
            <TextareaField id="nr-qual" label="Highest qualification with dates" rows={2} value={form.qualification} onChange={(v) => set({ qualification: v })} />
          </div>
        </div>

        <div>
          <SectionLabel>Service</SectionLabel>
          <FieldGrid columns={3}>
            <TextField id="nr-rank" label="Rank" value={form.rank} onChange={(v) => set({ rank: v })} />
            <NumberField id="nr-gl" label="Grade level" value={form.gradeLevel ?? ""} onChange={(v) => set({ gradeLevel: Number.isFinite(v) ? v : null })} />
            <NumberField id="nr-step" label="Step" value={form.step ?? ""} onChange={(v) => set({ step: Number.isFinite(v) ? v : null })} />
            <TextField id="nr-fa" label="Date of 1st appointment" type="date" value={form.firstAppointment} onChange={(v) => set({ firstAppointment: v })} />
            <TextField id="nr-conf" label="Date of confirmation" type="date" value={form.confirmation} onChange={(v) => set({ confirmation: v })} />
            <TextField id="nr-pa" label="Date of present appointment" type="date" value={form.presentAppointment} onChange={(v) => set({ presentAppointment: v })} />
            <TextField id="nr-pf" label="PF number" mono value={form.pfNumber} onChange={(v) => set({ pfNumber: v })} />
            <SelectField id="nr-unit" label="Posted to unit" value={form.department} onChange={(v) => set({ department: v })} options={POSTINGS.map((d) => ({ value: d, label: d }))} />
            <SelectField id="nr-des" label="Designation in unit" value={form.designation} onChange={(v) => set({ designation: v })} options={DESIGNATIONS.map((d) => ({ value: d, label: d }))} />
          </FieldGrid>
        </div>

        <div>
          <SectionLabel>Payroll & pension (restricted)</SectionLabel>
          <FieldGrid columns={3}>
            <TextField id="nr-pen" label="Pension number" mono value={form.pensionNumber} onChange={(v) => set({ pensionNumber: v })} />
            <TextField id="nr-pfa" label="PFA" value={form.pfa} onChange={(v) => set({ pfa: v })} />
            <TextField id="nr-bank" label="Bank" value={form.bank} onChange={(v) => set({ bank: v })} />
            <TextField id="nr-acct" label="Account number" mono value={form.accountNumber} onChange={(v) => set({ accountNumber: v })} />
            <TextField id="nr-tax" label="Tax number" mono value={form.taxNumber} onChange={(v) => set({ taxNumber: v })} />
            <TextField id="nr-nhf" label="NHF number" mono value={form.nhfNumber} onChange={(v) => set({ nhfNumber: v })} />
          </FieldGrid>
          <div className="mt-4">
            <TextareaField id="nr-rem" label="Remarks" rows={2} value={form.remarks} onChange={(v) => set({ remarks: v })} />
          </div>
        </div>

        {existing ? (
          <div>
            <SectionLabel>DOAS sign-in account</SectionLabel>
            {existing.staffUid ? (
              <p className="text-[13px] text-muted-foreground">
                This officer has a sign-in account{existing.email ? ` (${existing.email})` : ""}. Manage it under Accounts.
              </p>
            ) : (
              <div className="space-y-3">
                <FieldGrid columns={3}>
                  <TextField id="nr-acc-email" label="Work email" type="email" value={account.email} onChange={(v) => setAccount((a) => ({ ...a, email: v }))} />
                  <SelectField id="nr-acc-unit" label="Desk" value={account.department} onChange={(v) => setAccount((a) => ({ ...a, department: v }))} options={POSTINGS.map((d) => ({ value: d, label: d }))} />
                  <SelectField id="nr-acc-des" label="Designation" value={account.designation} onChange={(v) => setAccount((a) => ({ ...a, designation: v }))} options={DESIGNATIONS.map((d) => ({ value: d, label: d }))} />
                </FieldGrid>
                <ActionButton icon={busy ? Loader2 : UserRoundPlus} disabled={busy} onClick={createLogin}>
                  Create sign-in account
                </ActionButton>
              </div>
            )}
            {issued ? (
              <div className="mt-3 rounded-lg border border-[hsl(var(--state-clear))]/30 bg-[hsl(var(--state-clear-soft))] px-3.5 py-3 text-[12.5px]">
                <p className="font-mono">Email: {issued.email}</p>
                <p className="font-mono">Temporary password: {issued.password}</p>
                <div className="mt-2">
                  <ActionButton tone="quiet" icon={Copy} onClick={copy}>
                    Copy details
                  </ActionButton>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </Sheet>
  )
}

/* ------------------------------------------------------------------ *
 * Import the FCTA workbook
 * ------------------------------------------------------------------ */

function ImportSheet({ existingIds, onClose }: { existingIds: Set<string>; onClose: () => void }) {
  const [sheets, setSheets] = React.useState<(ParsedSheet & { name: string })[]>([])
  const [pick, setPick] = React.useState("")
  const [mode, setMode] = React.useState<"overwrite" | "fill">("overwrite")
  const [reading, setReading] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [fileName, setFileName] = React.useState("")

  const read = async (file?: File) => {
    if (!file) return
    setReading(true)
    try {
      const XLSX = await import("xlsx")
      const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true })
      const parsed = wb.SheetNames.map((name) => {
        const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: true, defval: null })
        return { ...parseRollRows(rows, name), name }
      }).filter((s) => s.entries.length)
      if (!parsed.length) throw new Error("No sheet with a SURNAME / NAME header row was found.")
      setSheets(parsed)
      setPick(parsed[0].name)
      setFileName(file.name)
    } catch (err) {
      toast.error({ title: "Could not read the workbook", description: err instanceof Error ? err.message : "Use the FCTA nominal-roll .xlsx file." })
    } finally {
      setReading(false)
    }
  }

  const sheet = sheets.find((s) => s.name === pick)
  const fresh = sheet ? sheet.entries.filter((e) => !existingIds.has(rollDocId(e.key))).length : 0

  const run = async () => {
    if (!sheet) return
    setBusy(true)
    const now = new Date().toISOString()
    try {
      const seen = new Set<string>()
      for (let i = 0; i < sheet.entries.length; i += 400) {
        const batch = writeBatch(db)
        for (const e of sheet.entries.slice(i, i + 400)) {
          const id = rollDocId(e.key)
          if (seen.has(id)) continue
          seen.add(id)
          const isNew = !existingIds.has(id)
          // Fill-only mode leaves existing records to the per-field pass below.
          if (!isNew && mode === "fill") continue
          const { serial: _serial, ...fields } = e
          void _serial
          const data: Record<string, unknown> = isNew
            ? { ...EMPTY_ROLL, ...fields, source: sheet.title || sheet.name, createdAt: now, updatedAt: now }
            : { ...fields, source: sheet.title || sheet.name, updatedAt: now }
          batch.set(doc(db, COL.nominalRoll, id), JSON.parse(JSON.stringify(data)), { merge: true })
        }
        await batch.commit()
      }
      if (mode === "fill") {
        // Only add fields missing on existing records (e.g. phone numbers from the Dec 2024 sheet).
        for (const e of sheet.entries) {
          const id = rollDocId(e.key)
          if (!existingIds.has(id)) continue
          const snap = await getDoc(doc(db, COL.nominalRoll, id))
          const current = (snap.data() ?? {}) as Record<string, unknown>
          const patch: Record<string, unknown> = {}
          Object.entries(e).forEach(([k, v]) => {
            if (k === "serial" || k === "key" || k === "fullName" || k === "surname" || k === "firstName") return
            if ((current[k] === undefined || current[k] === "" || current[k] === null) && v !== undefined && v !== "") patch[k] = v
          })
          if (Object.keys(patch).length) await updateDoc(doc(db, COL.nominalRoll, id), { ...patch, updatedAt: now })
        }
      }
      toast.success({ title: "Nominal roll imported", description: `${sheet.entries.length} rows from ${sheet.title || sheet.name}` })
      onClose()
    } catch (err) {
      toast.error({ title: "Import stopped", description: err instanceof Error ? err.message : "Try again." })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Import nominal roll"
      caption="FCTA nominal-roll workbook (.xlsx)"
      width="max-w-3xl"
      footer={
        <div className="flex justify-end gap-2">
          <ActionButton tone="quiet" onClick={onClose}>
            Cancel
          </ActionButton>
          <ActionButton icon={busy ? Loader2 : Upload} disabled={!sheet || busy} onClick={run}>
            Import {sheet ? `${sheet.entries.length} rows` : ""}
          </ActionButton>
        </div>
      }
    >
      <div className="space-y-5">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border px-6 py-8 text-center hover:bg-muted/40">
          {reading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : <FileSpreadsheet className="h-6 w-6 text-muted-foreground" />}
          <span className="text-[13.5px] font-semibold text-foreground">{fileName || "Choose the nominal-roll workbook"}</span>
          <span className="text-[12px] text-muted-foreground">Every sheet with an S/N + SURNAME (or NAME) header row is detected.</span>
          <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => read(e.target.files?.[0])} />
        </label>

        {sheets.length ? (
          <>
            <div>
              <SectionLabel>Sheet</SectionLabel>
              <Segmented value={pick} onChange={setPick} options={sheets.map((s) => ({ value: s.name, label: `${s.name} (${s.entries.length})` }))} />
              {sheet ? (
                <p className="mt-2 text-[12.5px] text-muted-foreground">
                  {sheet.title} · {fresh} new · {sheet.entries.length - fresh} already on the roll{sheet.skipped ? ` · ${sheet.skipped} incomplete rows skipped` : ""}
                </p>
              ) : null}
            </div>
            <div>
              <SectionLabel>Existing records</SectionLabel>
              <Segmented
                value={mode}
                onChange={(v) => setMode(v as typeof mode)}
                options={[
                  { value: "overwrite", label: "Update with this sheet" },
                  { value: "fill", label: "Only fill missing fields" },
                ]}
              />
              <p className="mt-2 text-[12px] text-muted-foreground">
                Use &ldquo;Update&rdquo; for the latest roll (e.g. SEPT 2026). Use &ldquo;Only fill missing fields&rdquo; for older sheets — e.g. to add phone numbers from the
                December 2024 sheet without overwriting current ranks.
              </p>
            </div>
            {sheet ? (
              <div className="overflow-x-auto scroll-slim rounded-lg border border-border">
                <table className="w-full border-collapse text-left text-[12px]">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-muted-foreground">
                      <th className="px-2.5 py-2">Name</th>
                      <th className="px-2.5 py-2">Rank</th>
                      <th className="px-2.5 py-2">GL</th>
                      <th className="px-2.5 py-2">DOB</th>
                      <th className="px-2.5 py-2">1st appt</th>
                      <th className="px-2.5 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sheet.entries.slice(0, 12).map((e) => (
                      <tr key={e.key} className="border-b border-border/60 last:border-0">
                        <td className="px-2.5 py-1.5">{e.fullName}</td>
                        <td className="px-2.5 py-1.5">{e.rank ?? ""}</td>
                        <td className="px-2.5 py-1.5">{e.gradeLevel ?? ""}</td>
                        <td className="px-2.5 py-1.5">{e.dateOfBirth ?? ""}</td>
                        <td className="px-2.5 py-1.5">{e.firstAppointment ?? ""}</td>
                        <td className="px-2.5 py-1.5">{existingIds.has(rollDocId(e.key)) ? "update" : "new"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {sheet.entries.length > 12 ? <p className="px-2.5 py-2 text-[11.5px] text-muted-foreground">…and {sheet.entries.length - 12} more</p> : null}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </Sheet>
  )
}

/* ------------------------------------------------------------------ *
 * Postings by unit
 * ------------------------------------------------------------------ */

export function PostingsPanel() {
  const { rows, loading, error } = useNominalRoll()
  const active = rows.filter((r) => (r.status ?? "Active") === "Active")
  const [busyId, setBusyId] = React.useState<string | null>(null)

  const post = async (id: string, department: string) => {
    setBusyId(id)
    try {
      await updateDoc(doc(db, COL.nominalRoll, id), { department, updatedAt: new Date().toISOString() })
    } catch (err) {
      toast.error({ title: "Not posted", description: err instanceof Error ? err.message : "Try again." })
    } finally {
      setBusyId(null)
    }
  }

  const unposted = active.filter((r) => !r.department)

  return (
    <div className="space-y-4">
      <Panel title="Units" description="Staff on the roll posted to each unit of the Directorate" bodyClassName="p-3 sm:p-4">
        {error ? (
          <LoadFailed error={error} what="Postings" />
        ) : loading ? (
          <RowsSkeleton rows={4} columns={4} />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {POSTINGS.map((d) => {
              const people = active.filter((r) => r.department === d)
              return (
                <div key={d} className="rounded-lg border border-border p-3.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[13.5px] font-semibold text-foreground">{d}</p>
                    <span className="rounded-md bg-muted px-2 py-0.5 text-[12px] font-semibold">{people.length}</span>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {people.slice(0, 8).map((p) => (
                      <li key={p.id} className="flex justify-between gap-2 text-[12.5px]">
                        <span className="truncate">{p.fullName}</span>
                        <span className="shrink-0 text-muted-foreground">{p.designation || `GL ${p.gradeLevel ?? "—"}`}</span>
                      </li>
                    ))}
                    {people.length > 8 ? <li className="text-[12px] text-muted-foreground">+{people.length - 8} more</li> : null}
                    {!people.length ? <li className="text-[12px] text-muted-foreground">No one posted yet</li> : null}
                  </ul>
                </div>
              )
            })}
          </div>
        )}
      </Panel>

      <Panel title={`Not posted (${unposted.length})`} description="Choose a unit for each officer" bodyClassName="p-3 sm:p-4">
        {!unposted.length ? (
          <EmptyState icon={Users} title="Everyone is posted" description="New records from an import appear here until they are posted to a unit." />
        ) : (
          <ul className="divide-y divide-border">
            {unposted.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-foreground">{r.fullName}</span>
                  <span className="block text-[12px] text-muted-foreground">
                    {r.rank || "—"} · GL {r.gradeLevel ?? "—"}
                  </span>
                </span>
                <select
                  disabled={busyId === r.id}
                  defaultValue=""
                  onChange={(e) => e.target.value && post(r.id, e.target.value)}
                  className="rounded-lg border border-input bg-card px-3 py-1.5 text-[12.5px]"
                >
                  <option value="">Post to…</option>
                  {POSTINGS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
