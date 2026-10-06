"use client"

import * as React from "react"
import { addDoc, collection, limit, orderBy, serverTimestamp } from "firebase/firestore"
import { ShieldAlert, ShieldCheck } from "lucide-react"
import { db } from "@/lib/firebase"
import { COMPLIANCE_COLLECTION, REGISTER_COLLECTION, daysUntil } from "@/lib/workflow"
import { useCurrentUser, useRealtimeCollection } from "@/hooks/use-firestore"
import { formatDate } from "@/lib/format"
import { toast } from "@/components/ui/toast"
import { ActionButton } from "@/components/dashboard/form-kit"
import { EmptyState, LoadFailed, Panel, RowsSkeleton, StatusPill, TONE } from "@/components/dashboard/kit"
import { Segmented } from "@/components/dashboard/notifications-panel"
import { cn } from "@/lib/utils"

interface RegisterDoc {
  permitNumber?: string
  holderName?: string
  address?: string
  gpsCoordinates?: string
  category?: string
  status?: string
  expiresAt?: string
}

export function useEnforcementTargets() {
  const register = useRealtimeCollection<RegisterDoc>(REGISTER_COLLECTION, [orderBy("expiresAt", "asc"), limit(500)], [])
  const issues = useRealtimeCollection<{ permitNumber?: string; status?: string }>(COMPLIANCE_COLLECTION, [limit(500)], [])
  const flagged = new Set(issues.data.filter((i) => i.status !== "Resolved" && i.permitNumber).map((i) => i.permitNumber))
  const rows = register.data.map((e) => ({ ...e, days: daysUntil(e.expiresAt), flagged: flagged.has(e.permitNumber) }))
  return {
    rows,
    expired: rows.filter((r) => r.days !== null && r.days < 0 && r.status !== "Renewal Invoiced"),
    expiring: rows.filter((r) => r.days !== null && r.days >= 0 && r.days <= 30),
    loading: register.loading,
    error: register.error,
  }
}

export function EnforcementPanel() {
  const { user } = useCurrentUser()
  const { expired, expiring, loading, error } = useEnforcementTargets()
  const [tab, setTab] = React.useState<"expired" | "expiring">("expired")
  const [busy, setBusy] = React.useState<string | null>(null)
  const rows = tab === "expired" ? expired : expiring

  const log = async (e: (typeof rows)[number]) => {
    setBusy(e.id)
    try {
      await addDoc(collection(db, COMPLIANCE_COLLECTION), {
        site: e.address || e.permitNumber,
        owner: e.holderName ?? "",
        coordinates: e.gpsCoordinates ?? "",
        permitNumber: e.permitNumber,
        issue: `Permit ${e.permitNumber} expired on ${formatDate(e.expiresAt)} — board still standing`,
        severity: (e.days ?? 0) < -30 ? "high" : "medium",
        status: "Open",
        raisedBy: user?.displayName || user?.email || "Monitoring and Enforcement",
        createdAt: serverTimestamp(),
      })
      toast.success({ title: "Compliance issue logged", description: e.holderName })
    } catch (err) {
      toast.error({ title: "Not logged", description: err instanceof Error ? err.message : "Try again." })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Panel
      title="Field enforcement targets"
      description="Permits past expiry are boards standing without a valid permit."
      actions={
        <Segmented
          value={tab}
          onChange={(v) => setTab(v as typeof tab)}
          options={[
            { value: "expired", label: `Expired (${expired.length})` },
            { value: "expiring", label: `Expiring ≤30d (${expiring.length})` },
          ]}
        />
      }
      bodyClassName="p-3 sm:p-4"
    >
      {error ? (
        <LoadFailed error={error} what="The permit register" />
      ) : loading ? (
        <RowsSkeleton rows={4} columns={4} />
      ) : !rows.length ? (
        <EmptyState icon={ShieldCheck} title="Nothing in this view" description="Every permit on the register is currently valid." />
      ) : (
        <ul className="space-y-2">
          {rows.map((e) => (
            <li key={e.id} className="flex flex-col gap-2 rounded-lg border border-border px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[13.5px] font-semibold text-foreground">{e.holderName}</p>
                <p className="text-[12px] text-muted-foreground">
                  {e.permitNumber} · {e.address}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={cn("text-[12px] font-semibold", (e.days ?? 0) < 0 ? TONE.stop.text : TONE.wait.text)}>
                  {(e.days ?? 0) < 0 ? `${-(e.days ?? 0)} days overdue` : `${e.days} days left`}
                </span>
                {e.flagged ? (
                  <StatusPill status="Issue open" tone="wait" />
                ) : tab === "expired" ? (
                  <ActionButton tone="quiet" icon={ShieldAlert} disabled={busy === e.id} onClick={() => log(e)}>
                    Log issue
                  </ActionButton>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
