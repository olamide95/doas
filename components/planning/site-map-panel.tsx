"use client"

import * as React from "react"
import { MapPin, Compass, ExternalLink } from "lucide-react"
import { useSubmissions } from "@/components/dashboard/work-queue"
import { SearchField } from "@/components/dashboard/form-kit"
import { EmptyState, LoadFailed, Panel, RowsSkeleton, StatusPill, TONE, toneForStatus } from "@/components/dashboard/kit"
import { Segmented } from "@/components/dashboard/notifications-panel"
import { formatDate, truncate } from "@/lib/format"
import { cn } from "@/lib/utils"

interface Site {
  id: string
  label: string
  owner: string
  status: string
  type: string
  lat: number
  lng: number
  raw: string
  createdAt: unknown
}

function parseCoordinates(value?: string): { lat: number; lng: number } | null {
  if (!value) return null
  const match = value.match(/(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/)
  if (!match) return null
  const lat = Number(match[1])
  const lng = Number(match[2])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return { lat, lng }
}

export function SiteMapPanel() {
  const { rows, loading, error } = useSubmissions()
  const [search, setSearch] = React.useState("")
  const [mode, setMode] = React.useState<"plot" | "list">("plot")
  const [active, setActive] = React.useState<string | null>(null)

  const sites = React.useMemo<Site[]>(() => {
    const term = search.trim().toLowerCase()
    return rows
      .map((row) => {
        const point = parseCoordinates(row.gpsCoordinates)
        if (!point) return null
        return {
          id: `${row.route}-${row.id}`,
          label: row.addressLine1 || row.submissionId || row.id.slice(0, 8),
          owner: row.companyName || row.applicantName || "Unnamed applicant",
          status: row.status ?? "Pending",
          type: row.typeOfSign || row.applicationType || "Signage",
          lat: point.lat,
          lng: point.lng,
          raw: row.gpsCoordinates ?? "",
          createdAt: row.createdAt,
        } as Site
      })
      .filter((site): site is Site => Boolean(site))
      .filter((site) =>
        term
          ? [site.label, site.owner, site.type, site.status]
              .join(" ")
              .toLowerCase()
              .includes(term)
          : true,
      )
  }, [rows, search])

  return (
    <Panel
      title="Sites on record"
      description={
        sites.length
          ? `${sites.length} application${sites.length > 1 ? "s" : ""} with usable coordinates`
          : "Applications carrying GPS coordinates appear here"
      }
      actions={
        <Segmented
          value={mode}
          onChange={(v) => setMode(v as typeof mode)}
          options={[
            { value: "plot", label: "Plot" },
            { value: "list", label: "List" },
          ]}
        />
      }
      bodyClassName="p-0"
    >
      <div className="border-b border-border p-3 sm:px-5">
        <SearchField value={search} onChange={setSearch} placeholder="Search site, owner or sign type" />
      </div>

      <div className="p-3 sm:p-4">
        {error ? (
          <LoadFailed error={error} what="Sites" />
        ) : loading ? (
          <RowsSkeleton rows={5} columns={4} />
        ) : !sites.length ? (
          <EmptyState
            icon={Compass}
            title="No mapped sites yet"
            description="A site appears here once its application carries coordinates in the form 9.0765, 7.3986."
          />
        ) : mode === "plot" ? (
          <CoordinatePlot sites={sites} active={active} onActivate={setActive} />
        ) : (
          <SiteList sites={sites} />
        )}
      </div>
    </Panel>
  )
}

/**
 * A true basemap needs a Google Maps key. Until that's wired up this plots the
 * real coordinates against their own bounding box, which is honest about what
 * the data actually is and still shows clustering along the main corridors.
 */
function CoordinatePlot({
  sites,
  active,
  onActivate,
}: {
  sites: Site[]
  active: string | null
  onActivate: (id: string | null) => void
}) {
  const bounds = React.useMemo(() => {
    const lats = sites.map((s) => s.lat)
    const lngs = sites.map((s) => s.lng)
    const pad = 0.01
    return {
      minLat: Math.min(...lats) - pad,
      maxLat: Math.max(...lats) + pad,
      minLng: Math.min(...lngs) - pad,
      maxLng: Math.max(...lngs) + pad,
    }
  }, [sites])

  const position = (site: Site) => {
    const x = ((site.lng - bounds.minLng) / (bounds.maxLng - bounds.minLng || 1)) * 100
    const y = 100 - ((site.lat - bounds.minLat) / (bounds.maxLat - bounds.minLat || 1)) * 100
    return { left: `${x}%`, top: `${y}%` }
  }

  const selected = sites.find((site) => site.id === active)

  return (
    <div className="space-y-3">
      <div className="grid-paper relative h-[clamp(320px,50vh,520px)] w-full overflow-hidden rounded-xl border border-border bg-muted/20">
        {sites.map((site) => {
          const tone = toneForStatus(site.status)
          const isActive = site.id === active
          return (
            <button
              key={site.id}
              type="button"
              style={position(site)}
              onClick={() => onActivate(isActive ? null : site.id)}
              aria-label={`${site.owner} at ${site.raw}`}
              className="absolute -translate-x-1/2 -translate-y-1/2"
            >
              <span
                className={cn(
                  "relative block rounded-full ring-2 ring-card transition-all",
                  TONE[tone].dot,
                  isActive ? "h-4 w-4" : "h-2.5 w-2.5 hover:h-3.5 hover:w-3.5",
                )}
              />
            </button>
          )
        })}

        <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-card/90 px-2.5 py-1.5 font-mono text-[10.5px] text-muted-foreground backdrop-blur">
          {bounds.minLat.toFixed(3)},{bounds.minLng.toFixed(3)} → {bounds.maxLat.toFixed(3)},
          {bounds.maxLng.toFixed(3)}
        </div>
      </div>

      {selected ? (
        <div className="reveal flex flex-col gap-2 rounded-lg border border-border p-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold text-foreground">{selected.owner}</p>
            <p className="text-[12.5px] text-muted-foreground">
              {truncate(selected.label, 60)} · {selected.type}
            </p>
            <p className="mt-0.5 font-mono text-[11.5px] text-muted-foreground">{selected.raw}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StatusPill status={selected.status} />
            <a
              href={`https://www.google.com/maps?q=${selected.lat},${selected.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors hover:bg-muted"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open in Maps
            </a>
          </div>
        </div>
      ) : (
        <p className="text-center text-[12.5px] text-muted-foreground">
          Select a point to see the application behind it.
        </p>
      )}
    </div>
  )
}

function SiteList({ sites }: { sites: Site[] }) {
  return (
    <ul className="space-y-2">
      {sites.map((site, i) => (
        <li
          key={site.id}
          style={{ ["--i" as string]: Math.min(i, 10) }}
          className="reveal flex flex-col gap-2 rounded-lg border border-border px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold text-foreground">{site.owner}</p>
            <p className="text-[12.5px] text-muted-foreground">
              {truncate(site.label, 60)} · {site.type}
            </p>
            <p className="mt-0.5 inline-flex items-center gap-1 font-mono text-[11.5px] text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {site.raw}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-[11.5px] text-muted-foreground">{formatDate(site.createdAt)}</span>
            <StatusPill status={site.status} />
          </div>
        </li>
      ))}
    </ul>
  )
}
