"use client"

import * as React from "react"
import { arrayUnion, collection, doc, getDocs, writeBatch } from "firebase/firestore"
import { COL, db } from "@/lib/firebase"
import { migrateLegacy } from "@/lib/workflow"
import { ActionButton } from "@/components/dashboard/form-kit"
import { Panel, StatusPill } from "@/components/dashboard/kit"

interface Plan {
  path: string
  id: string
  ref: string
  from: string
  to: string
  department: string
  note: string
}

export default function MigratePage() {
  const [plans, setPlans] = React.useState<Plan[] | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [done, setDone] = React.useState(0)
  const [error, setError] = React.useState("")

  const scan = async () => {
    setBusy(true)
    setError("")
    try {
      const found: Plan[] = []
      const sources: [string, "first" | "third"][] = [
        [COL.firstParty, "first"],
        [COL.thirdParty, "third"],
      ]
      for (const [path, route] of sources) {
        const snap = await getDocs(collection(db, path))
        snap.forEach((d) => {
          const data = d.data()
          const next = migrateLegacy(route, data.status)
          if (next) found.push({ path, id: d.id, ref: data.submissionId ?? d.id, from: data.status, to: next.status, department: next.department, note: next.note })
        })
      }
      setPlans(found)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed")
    } finally {
      setBusy(false)
    }
  }

  const apply = async () => {
    if (!plans?.length) return
    setBusy(true)
    setError("")
    const now = new Date().toISOString()
    try {
      for (let i = 0; i < plans.length; i += 400) {
        const batch = writeBatch(db)
        plans.slice(i, i + 400).forEach((p) =>
          batch.update(doc(db, p.path, p.id), {
            status: p.to,
            department: p.department,
            updatedAt: now,
            comments: arrayUnion({ timestamp: now, desk: "system", action: `Migrated from "${p.from}" — ${p.note}`, to: p.department, status: p.to }),
          }),
        )
        await batch.commit()
        setDone(Math.min(plans.length, i + 400))
      }
      setPlans([])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Migration failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Panel
        title="Legacy status migration"
        description="Moves files filed under the old workflow into the new chain. Scan first, check the list, then apply once."
        actions={
          <>
            <ActionButton tone="quiet" disabled={busy} onClick={scan}>
              Scan
            </ActionButton>
            <ActionButton disabled={busy || !plans?.length} onClick={apply}>
              Apply {plans?.length ?? 0} change(s)
            </ActionButton>
          </>
        }
      >
        {error ? <p className="mb-3 text-[13px] text-[hsl(var(--state-stop))]">{error}</p> : null}
        {done ? <p className="mb-3 text-[13px] text-[hsl(var(--state-clear))]">{done} file(s) migrated.</p> : null}
        {plans === null ? (
          <p className="text-[13px] text-muted-foreground">Nothing scanned yet.</p>
        ) : !plans.length ? (
          <p className="text-[13px] text-muted-foreground">No legacy statuses found. Nothing to do.</p>
        ) : (
          <table className="w-full text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="py-2">Reference</th>
                <th className="py-2">From</th>
                <th className="py-2">To</th>
                <th className="py-2">Note</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={`${p.path}-${p.id}`} className="border-b border-border/60">
                  <td className="py-2 font-mono">{p.ref}</td>
                  <td className="py-2">{p.from}</td>
                  <td className="py-2">
                    <StatusPill status={p.to} />
                  </td>
                  <td className="py-2 text-muted-foreground">{p.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  )
}
