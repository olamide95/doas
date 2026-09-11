"use client"

import * as React from "react"
import {
  addDoc,
  collection,
  doc,
  limit,
  orderBy,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore"
import { AlertTriangle, Plus, ShieldCheck, X } from "lucide-react"
import { db } from "@/lib/firebase"
import { useCurrentUser, useRealtimeCollection } from "@/hooks/use-firestore"
import { formatDate, toMillis } from "@/lib/format"
import { toast } from "@/components/ui/toast"
import { Sheet } from "@/components/dashboard/sheet"
import {
  ActionButton,
  FieldGrid,
  SearchField,
  SelectField,
  TextField,
  TextareaField,
} from "@/components/dashboard/form-kit"
import {
  EmptyState,
  Field,
  LoadFailed,
  Panel,
  RowsSkeleton,
  SectionLabel,
  StatusPill,
  TONE,
  type StateTone,
} from "@/components/dashboard/kit"
import { Segmented } from "@/components/dashboard/notifications-panel"
import { cn } from "@/lib/utils"

const COLLECTION = "complianceIssues"

interface IssueDoc {
  site?: string
  owner?: string
  issue?: string
  severity?: "low" | "medium" | "high"
  status?: "Open" | "In Progress" | "Resolved"
  coordinates?: string
  dueDate?: string
  notes?: string
  raisedBy?: string
  createdAt?: unknown
  updatedAt?: unknown
}

const SEVERITY_TONE: Record<string, StateTone> = { high: "stop", medium: "wait", low: "idle" }

const emptyForm = {
  site: "",
  owner: "",
  issue: "",
  severity: "medium",
  coordinates: "",
  dueDate: "",
  notes: "",
}

export function CompliancePanel({ unit }: { unit: string }) {
  const { user } = useCurrentUser()
  const [tab, setTab] = React.useState<"open" | "resolved" | "all">("open")
  const [search, setSearch] = React.useState("")
  const [composing, setComposing] = React.useState(false)
  const [form, setForm] = React.useState(emptyForm)
  const [saving, setSaving] = React.useState(false)
  const [selected, setSelected] = React.useState<(IssueDoc & { id: string }) | null>(null)
  const [note, setNote] = React.useState("")
  const [status, setStatus] = React.useState("Open")

  const { data, loading, error } = useRealtimeCollection<IssueDoc>(
    COLLECTION,
    [orderBy("createdAt", "desc"), limit(200)],
    [],
  )

  const issues = React.useMemo(() => {
    const term = search.trim().toLowerCase()
    return data
      .filter((issue) => {
        if (tab === "open" && issue.status === "Resolved") return false
        if (tab === "resolved" && issue.status !== "Resolved") return false
        if (!term) return true
        return [issue.site, issue.owner, issue.issue]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term))
      })
      .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
  }, [data, tab, search])

  const openCount = data.filter((issue) => issue.status !== "Resolved").length

  const create = async () => {
    if (!form.site.trim() || !form.issue.trim()) {
      toast.warning({
        title: "Missing detail",
        description: "A compliance issue needs the site and what's wrong with it.",
      })
      return
    }
    setSaving(true)
    try {
      await addDoc(collection(db, COLLECTION), {
        ...form,
        site: form.site.trim(),
        issue: form.issue.trim(),
        status: "Open",
        raisedBy: user?.displayName || user?.email || unit,
        createdAt: serverTimestamp(),
      })
      toast.success({ title: "Issue logged", description: form.site.trim() })
      setForm(emptyForm)
      setComposing(false)
    } catch (err) {
      toast.error({
        title: "Issue not logged",
        description: err instanceof Error ? err.message : "Try again in a moment.",
      })
    } finally {
      setSaving(false)
    }
  }

  const save = async () => {
    if (!selected) return
    try {
      await updateDoc(doc(db, COLLECTION, selected.id), {
        status,
        notes: note || selected.notes || "",
        updatedAt: new Date().toISOString(),
      })
      toast.success({
        title: status === "Resolved" ? "Issue resolved" : "Issue updated",
        description: selected.site,
      })
      setSelected(null)
    } catch (err) {
      toast.error({
        title: "Update not saved",
        description: err instanceof Error ? err.message : "Try again in a moment.",
      })
    }
  }

  return (
    <>
      <Panel
        title="Compliance register"
        description={openCount ? `${openCount} issue${openCount > 1 ? "s" : ""} open` : "Nothing outstanding"}
        actions={
          <>
            <Segmented
              value={tab}
              onChange={(v) => setTab(v as typeof tab)}
              options={[
                { value: "open", label: "Open" },
                { value: "resolved", label: "Resolved" },
                { value: "all", label: "All" },
              ]}
            />
            <ActionButton
              icon={composing ? X : Plus}
              onClick={() => setComposing((v) => !v)}
            >
              {composing ? "Cancel" : "Log issue"}
            </ActionButton>
          </>
        }
        bodyClassName="p-0"
      >
        <div className="border-b border-border p-3 sm:px-5">
          <SearchField value={search} onChange={setSearch} placeholder="Search site, owner or issue" />
        </div>

        {composing ? (
          <div className="reveal border-b border-border bg-muted/40 p-4 sm:px-5">
            <FieldGrid>
              <TextField
                id="ci-site"
                label="Site or board"
                value={form.site}
                placeholder="Billboard at Kubwa Expressway"
                onChange={(site) => setForm({ ...form, site })}
              />
              <TextField
                id="ci-owner"
                label="Owner or operator"
                value={form.owner}
                onChange={(owner) => setForm({ ...form, owner })}
              />
              <TextField
                id="ci-coords"
                label="GPS coordinates"
                mono
                value={form.coordinates}
                placeholder="9.0765, 7.3986"
                onChange={(coordinates) => setForm({ ...form, coordinates })}
              />
              <SelectField
                id="ci-severity"
                label="Severity"
                value={form.severity}
                onChange={(severity) => setForm({ ...form, severity })}
                options={[
                  { value: "low", label: "Low" },
                  { value: "medium", label: "Medium" },
                  { value: "high", label: "High — act now" },
                ]}
              />
              <TextField
                id="ci-issue"
                label="What's wrong"
                value={form.issue}
                placeholder="Expired permit, unsafe structure, unauthorised change"
                onChange={(issue) => setForm({ ...form, issue })}
              />
              <TextField
                id="ci-due"
                label="Rectify by"
                type="date"
                value={form.dueDate}
                onChange={(dueDate) => setForm({ ...form, dueDate })}
              />
              <TextareaField
                id="ci-notes"
                label="Notes"
                value={form.notes}
                rows={2}
                onChange={(notes) => setForm({ ...form, notes })}
              />
            </FieldGrid>
            <div className="mt-3 flex justify-end">
              <ActionButton onClick={create} disabled={saving}>
                {saving ? "Logging…" : "Log issue"}
              </ActionButton>
            </div>
          </div>
        ) : null}

        <div className="p-3 sm:p-4">
          {error ? (
            <LoadFailed error={error} what="The compliance register" />
          ) : loading ? (
            <RowsSkeleton rows={5} columns={5} />
          ) : !issues.length ? (
            <EmptyState
              icon={ShieldCheck}
              title={tab === "resolved" ? "Nothing resolved yet" : "No open compliance issues"}
              description="Log an issue when an inspection finds an expired permit, an unsafe structure or an unauthorised change."
            />
          ) : (
            <div className="overflow-x-auto scroll-slim">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-border text-[11.5px] font-semibold text-muted-foreground">
                    <th className="px-3 py-2.5">Site</th>
                    <th className="hidden px-3 py-2.5 sm:table-cell">Owner</th>
                    <th className="px-3 py-2.5">Issue</th>
                    <th className="px-3 py-2.5">Severity</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="hidden px-3 py-2.5 md:table-cell">Rectify by</th>
                    <th className="px-3 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {issues.map((issue, i) => (
                    <tr
                      key={issue.id}
                      style={{ ["--i" as string]: Math.min(i, 10) }}
                      className="reveal border-b border-border/70 transition-colors last:border-0 hover:bg-muted/50"
                    >
                      <td className="px-3 py-3 text-[13.5px] font-medium text-foreground">
                        {issue.site}
                      </td>
                      <td className="hidden px-3 py-3 text-[13px] text-muted-foreground sm:table-cell">
                        {issue.owner || "—"}
                      </td>
                      <td className="px-3 py-3 text-[13px] text-muted-foreground">{issue.issue}</td>
                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            "rounded-md px-2 py-0.5 text-[11.5px] font-semibold",
                            TONE[SEVERITY_TONE[issue.severity ?? "low"] ?? "idle"].soft,
                          )}
                        >
                          {(issue.severity ?? "low").replace(/^./, (c) => c.toUpperCase())}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <StatusPill status={issue.status ?? "Open"} />
                      </td>
                      <td className="hidden px-3 py-3 text-[12.5px] text-muted-foreground md:table-cell">
                        {issue.dueDate ? formatDate(issue.dueDate) : "—"}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <ActionButton
                          tone="quiet"
                          onClick={() => {
                            setSelected(issue)
                            setNote(issue.notes ?? "")
                            setStatus(issue.status ?? "Open")
                          }}
                        >
                          Open
                        </ActionButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Panel>

      <Sheet
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Compliance issue"
        caption={selected?.site ?? ""}
        width="max-w-xl"
        footer={
          <div className="flex justify-end gap-2">
            <ActionButton tone="quiet" onClick={() => setSelected(null)}>
              Close
            </ActionButton>
            <ActionButton onClick={save}>Save changes</ActionButton>
          </div>
        }
      >
        {selected ? (
          <div className="space-y-6">
            <div>
              <SectionLabel>Details</SectionLabel>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Site" value={selected.site} />
                <Field label="Owner" value={selected.owner} />
                <Field label="Coordinates" value={selected.coordinates} mono />
                <Field label="Rectify by" value={selected.dueDate ? formatDate(selected.dueDate) : "—"} />
                <Field label="Raised by" value={selected.raisedBy} />
                <Field label="Logged" value={formatDate(selected.createdAt)} />
                <Field label="Issue" value={selected.issue} className="col-span-2" />
              </div>
            </div>

            <SelectField
              id="ci-status"
              label="Status"
              value={status}
              onChange={setStatus}
              options={[
                { value: "Open", label: "Open" },
                { value: "In Progress", label: "In progress" },
                { value: "Resolved", label: "Resolved" },
              ]}
            />

            <TextareaField
              id="ci-note"
              label="Notes"
              value={note}
              rows={4}
              placeholder="What action has been taken, and what happens next."
              onChange={setNote}
            />

            {selected.severity === "high" && status !== "Resolved" ? (
              <p className="flex items-start gap-2 rounded-lg bg-[hsl(var(--state-stop-soft))] px-3.5 py-2.5 text-[12.5px] text-[hsl(var(--state-stop))]">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Marked high severity. Structures in this state should be served notice before the
                rectification date passes.
              </p>
            ) : null}
          </div>
        ) : null}
      </Sheet>
    </>
  )
}
