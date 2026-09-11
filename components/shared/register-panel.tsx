"use client"

import * as React from "react"
import { limit, orderBy } from "firebase/firestore"
import { BadgeCheck, ScrollText } from "lucide-react"
import { REGISTER_COLLECTION } from "@/lib/workflow"
import { useRealtimeCollection } from "@/hooks/use-firestore"
import { formatDate, toDate, truncate } from "@/lib/format"
import { SearchField } from "@/components/dashboard/form-kit"
import {
  EmptyState,
  LoadFailed,
  Panel,
  RowsSkeleton,
  StatusPill,
  TONE,
} from "@/components/dashboard/kit"
import { Segmented } from "@/components/dashboard/notifications-panel"
import { cn } from "@/lib/utils"

interface RegisterDoc {
  category?: "first-party" | "third-party"
  permitNumber?: string
  holderName?: string
  companyName?: string
  email?: string
  phone?: string
  address?: string
  gpsCoordinates?: string
  signageType?: string
  practitionerName?: string
  practitionerLicenseNumber?: string
  status?: string
  approvedAt?: unknown
  expiresAt?: unknown
}

function daysToExpiry(value: unknown): number | null {
  const expires = toDate(value)
  if (!expires) return null
  return Math.ceil((expires.getTime() - Date.now()) / 86_400_000)
}

/**
 * The permit register — who currently holds a live DOAS permit.
 *
 * First-party holders are written here when the Director gives final
 * approval. Third-party holders are written when CSU registers them after
 * the Director's approval. Both carry a permit number and a one-year expiry.
 */
export function RegisterPanel() {
  const [category, setCategory] = React.useState<"all" | "first-party" | "third-party">("all")
  const [search, setSearch] = React.useState("")

  const { data, loading, error } = useRealtimeCollection<RegisterDoc>(
    REGISTER_COLLECTION,
    [orderBy("approvedAt", "desc"), limit(300)],
    [],
  )

  const holders = React.useMemo(() => {
    const term = search.trim().toLowerCase()
    return data
      .filter((entry) => (category === "all" ? true : entry.category === category))
      .filter((entry) =>
        term
          ? [entry.holderName, entry.companyName, entry.permitNumber, entry.email]
              .filter(Boolean)
              .some((value) => String(value).toLowerCase().includes(term))
          : true,
      )
  }, [data, category, search])

  const firstParty = data.filter((entry) => entry.category === "first-party").length
  const thirdParty = data.filter((entry) => entry.category === "third-party").length
  const expiringSoon = data.filter((entry) => {
    const days = daysToExpiry(entry.expiresAt)
    return days !== null && days <= 60 && days > 0
  }).length

  return (
    <Panel
      title="Permit register"
      description={
        data.length
          ? `${firstParty} first-party · ${thirdParty} third-party${
              expiringSoon ? ` · ${expiringSoon} expiring within 60 days` : ""
            }`
          : "Approved permit holders appear here automatically"
      }
      actions={
        <Segmented
          value={category}
          onChange={(v) => setCategory(v as typeof category)}
          options={[
            { value: "all", label: "All" },
            { value: "first-party", label: "First party" },
            { value: "third-party", label: "Third party" },
          ]}
        />
      }
      bodyClassName="p-0"
    >
      <div className="border-b border-border p-3 sm:px-5">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Search holder, company or permit number"
        />
      </div>

      <div className="p-3 sm:p-4">
        {error ? (
          <LoadFailed error={error} what="The permit register" />
        ) : loading ? (
          <RowsSkeleton rows={5} columns={5} />
        ) : !holders.length ? (
          <EmptyState
            icon={ScrollText}
            title="No permits on the register"
            description="A holder is entered here the moment a permit is approved — first party by the Director, third party by CSU."
          />
        ) : (
          <div className="overflow-x-auto scroll-slim">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border text-[11.5px] font-semibold text-muted-foreground">
                  <th className="px-3 py-2.5">Permit</th>
                  <th className="px-3 py-2.5">Holder</th>
                  <th className="hidden px-3 py-2.5 md:table-cell">Category</th>
                  <th className="hidden px-3 py-2.5 lg:table-cell">Site</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Expires</th>
                </tr>
              </thead>
              <tbody>
                {holders.map((entry, i) => {
                  const days = daysToExpiry(entry.expiresAt)
                  const expired = days !== null && days <= 0
                  const soon = days !== null && days > 0 && days <= 60
                  return (
                    <tr
                      key={entry.id}
                      style={{ ["--i" as string]: Math.min(i, 10) }}
                      className="reveal border-b border-border/70 last:border-0 hover:bg-muted/50"
                    >
                      <td className="px-3 py-3 font-mono text-[12px] text-muted-foreground">
                        {entry.permitNumber ?? "—"}
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-[13.5px] font-medium text-foreground">
                          {entry.holderName || entry.companyName || "—"}
                        </p>
                        <p className="text-[11.5px] text-muted-foreground">
                          {entry.practitionerName
                            ? `via ${entry.practitionerName}`
                            : entry.email ?? ""}
                        </p>
                      </td>
                      <td className="hidden px-3 py-3 text-[13px] text-muted-foreground md:table-cell">
                        {entry.category === "first-party" ? "First party" : "Third party"}
                      </td>
                      <td className="hidden px-3 py-3 text-[12.5px] text-muted-foreground lg:table-cell">
                        {truncate(entry.address || entry.gpsCoordinates, 30)}
                      </td>
                      <td className="px-3 py-3">
                        <StatusPill status={expired ? "Expired" : (entry.status ?? "Active")} />
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            "text-[12.5px]",
                            expired
                              ? TONE.stop.text
                              : soon
                                ? TONE.wait.text
                                : "text-muted-foreground",
                          )}
                        >
                          {formatDate(entry.expiresAt)}
                          {soon ? ` · ${days}d` : null}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Panel>
  )
}

export const RegisterIcon = BadgeCheck
