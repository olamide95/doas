"use client"

import * as React from "react"
import { addDoc, arrayUnion, collection, doc, getDoc, limit, orderBy, updateDoc, writeBatch } from "firebase/firestore"
import { AlertTriangle, CalendarClock, Forward, RefreshCcw, Save, Undo2 } from "lucide-react"
import { COL, db } from "@/lib/firebase"
import { DEPARTMENT, REGISTER_COLLECTION, STATUS, TARIFF_COLLECTION, daysUntil, invoiceNumber, parseDate, isoDate, stage, todayISO } from "@/lib/workflow"
import {
  CYCLE_TYPES,
  DEFAULT_SCHEDULE,
  SIGN_TYPES,
  STRUCTURE_TYPES,
  ZONES,
  computeBill,
  expiryFor,
  suggestZone,
  typeLabel,
  useTariffSchedules,
  zoneById,
  type CycleType,
  type MeasuredItem,
  type Measurements,
  type ZoneId,
} from "@/lib/tariff"
import { useRealtimeCollection } from "@/hooks/use-firestore"
import { formatDate, naira } from "@/lib/format"
import { toast } from "@/components/ui/toast"
import { Sheet } from "@/components/dashboard/sheet"
import { ActionButton, FieldGrid, NumberField, SearchField, SelectField, TextField, TextareaField } from "@/components/dashboard/form-kit"
import { EmptyState, LoadFailed, Panel, RowsSkeleton, SectionLabel, StatusPill, TONE } from "@/components/dashboard/kit"
import { Segmented } from "@/components/dashboard/notifications-panel"
import { WorkQueue, collectionFor, type QueueDraft, type SubmissionRow } from "@/components/dashboard/work-queue"
import { cn } from "@/lib/utils"

/* ================= Billing assessment ================= */

interface BillingDraft extends Record<string, unknown> {
  scheduleId: string
  scheduleName: string
  rates: Record<string, number>
  illuminationSurchargePct: number
  applyIllumination: boolean
  zone: ZoneId
  zoneMultiplier: number
  penaltyLoadingFee: number
  waiverAmount: number
  waiverReason: string
  billingCycleType: CycleType
  cycleYears: number
  promoDays: number
  subscriptionStartDate: string
  subscriptionExpiryDate: string
  invoiceNarration: string
  invoiceNumber: string
  cycle: number
}

const itemsOf = (row: SubmissionRow): MeasuredItem[] => (row.measurements as Measurements | undefined)?.items ?? []

function initialBilling(row: SubmissionRow): BillingDraft {
  const prev = (row.billing ?? {}) as Partial<BillingDraft>
  const zone = (prev.zone as ZoneId) ?? suggestZone(row.areaCouncil)
  const start = prev.subscriptionStartDate ?? todayISO()
  const cycle = Number(prev.cycle ?? 1)
  const base: BillingDraft = {
    scheduleId: prev.scheduleId ?? DEFAULT_SCHEDULE.id,
    scheduleName: prev.scheduleName ?? DEFAULT_SCHEDULE.name,
    rates: prev.rates ?? DEFAULT_SCHEDULE.rates,
    illuminationSurchargePct: prev.illuminationSurchargePct ?? DEFAULT_SCHEDULE.illuminationSurchargePct,
    applyIllumination: prev.applyIllumination ?? true,
    zone,
    zoneMultiplier: zoneById(zone).multiplier,
    penaltyLoadingFee: Number(prev.penaltyLoadingFee ?? 0),
    waiverAmount: Number(prev.waiverAmount ?? 0),
    waiverReason: prev.waiverReason ?? "No waiver applied",
    billingCycleType: prev.billingCycleType ?? "Annual_Standard",
    cycleYears: Number(prev.cycleYears ?? 2),
    promoDays: Number(prev.promoDays ?? 90),
    subscriptionStartDate: start,
    subscriptionExpiryDate: "",
    invoiceNarration:
      prev.invoiceNarration ?? `Outdoor advertisement and signage permit levy — ${row.companyName ?? row.applicantName ?? ""}, ${row.signageSiteAddress ?? row.addressLine1 ?? ""}`.trim(),
    invoiceNumber: prev.invoiceNumber ?? invoiceNumber(cycle),
    cycle,
  }
  base.subscriptionExpiryDate = prev.subscriptionExpiryDate ?? expiryFor(start, base)
  return base
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="figure text-foreground">{value}</span>
    </div>
  )
}

function BillingEngine({ d, set, row }: { d: BillingDraft; set: (p: Partial<BillingDraft>) => void; row: SubmissionRow }) {
  const { schedules, active } = useTariffSchedules()
  const items = itemsOf(row)
  const bill = computeBill(items, d)

  React.useEffect(() => {
    if (!row.billing?.scheduleId && d.scheduleId === DEFAULT_SCHEDULE.id && active.id !== DEFAULT_SCHEDULE.id) {
      set({ scheduleId: active.id, scheduleName: active.name, rates: active.rates, illuminationSurchargePct: active.illuminationSurchargePct })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active.id])

  const cyclePatch = (patch: Partial<BillingDraft>) => {
    const next = { ...d, ...patch }
    set({ ...patch, subscriptionExpiryDate: expiryFor(next.subscriptionStartDate, next) })
  }

  if (!items.length) {
    return (
      <p className="flex items-start gap-2 rounded-lg bg-[hsl(var(--state-stop-soft))] px-3.5 py-3 text-[13px] text-[hsl(var(--state-stop))]">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        No locked field measurements on this file. Raise a query so the Director can send it back for inspection.
      </p>
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3 rounded-lg bg-muted/40 p-3.5 text-[12.5px]">
        <div>
          <p className="text-muted-foreground">Applicant</p>
          <p className="font-medium text-foreground">{row.companyName ?? row.applicantName}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Area council</p>
          <p className="font-medium text-foreground">{row.areaCouncil ?? "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Source</p>
          <p className="font-medium text-foreground">{row.measurements?.source === "planning_development" ? "Planning vetting" : "BD field visit"}</p>
        </div>
      </div>

      <div>
        <SectionLabel>Tariff engine</SectionLabel>
        <FieldGrid columns={3}>
          <SelectField
            id="bl-sched"
            label="Base rate matrix"
            value={d.scheduleId}
            onChange={(id) => {
              const s = schedules.find((x) => x.id === id)
              if (s) set({ scheduleId: s.id, scheduleName: s.name, rates: s.rates, illuminationSurchargePct: s.illuminationSurchargePct })
            }}
            options={schedules.map((s) => ({ value: s.id, label: `${s.name}${s.active ? " (active)" : ""}` }))}
          />
          <SelectField
            id="bl-zone"
            label="Zone premium multiplier"
            value={d.zone}
            hint={zoneById(d.zone).note}
            onChange={(z) => set({ zone: z as ZoneId, zoneMultiplier: zoneById(z).multiplier })}
            options={ZONES.map((z) => ({ value: z.id, label: z.label }))}
          />
          <SelectField
            id="bl-ill"
            label="Illumination premium"
            value={d.applyIllumination ? "yes" : "no"}
            onChange={(v) => set({ applyIllumination: v === "yes" })}
            options={[
              { value: "yes", label: `Yes (+${d.illuminationSurchargePct}% on lit signs)` },
              { value: "no", label: "Not applied" },
            ]}
          />
        </FieldGrid>

        <table className="mt-4 w-full text-left text-[12.5px]">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="py-1.5">Sign</th>
              <th className="py-1.5 text-right">m²</th>
              <th className="py-1.5 text-right">Rate</th>
              <th className="py-1.5 text-right">Base × zone</th>
              <th className="py-1.5 text-right">Surcharge</th>
            </tr>
          </thead>
          <tbody>
            {bill.lines.map((l) => (
              <tr key={l.id} className="border-b border-border/60">
                <td className="py-1.5">
                  {l.id} {typeLabel(l.type)}
                </td>
                <td className="py-1.5 text-right font-mono">{l.sqm.toFixed(2)}</td>
                <td className={cn("py-1.5 text-right", !l.rate && TONE.stop.text)}>{l.rate ? naira(l.rate) : "no rate"}</td>
                <td className="py-1.5 text-right">{naira(l.base)}</td>
                <td className="py-1.5 text-right">{naira(l.surcharge)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4">
          <FieldGrid columns={3}>
            <NumberField id="bl-pen" label="Penalty loading fee" prefix="₦" value={d.penaltyLoadingFee} hint="Historical non-compliance" onChange={(v) => set({ penaltyLoadingFee: v })} />
            <NumberField id="bl-waive" label="Discretionary rebate / waiver" prefix="₦" value={d.waiverAmount} onChange={(v) => set({ waiverAmount: v })} />
            <SelectField
              id="bl-waive-r"
              label="Waiver reason"
              value={d.waiverReason}
              onChange={(v) => set({ waiverReason: v })}
              options={[
                { value: "No waiver applied", label: "No waiver applied" },
                { value: "Government / public institution", label: "Government / public institution" },
                { value: "Director-approved concession", label: "Director-approved concession" },
                { value: "Correction of prior overbilling", label: "Correction of prior overbilling" },
              ]}
            />
          </FieldGrid>
        </div>

        <div className="mt-4 space-y-1 rounded-xl bg-muted/50 px-4 py-3.5 text-[13px]">
          <Row label="Base computation" value={naira(bill.baseComputation)} />
          <Row label="Illumination surcharge" value={naira(bill.illuminationSurcharge)} />
          {bill.cycleFactor !== 1 ? <Row label="Cycle factor" value={`× ${bill.cycleFactor}`} /> : null}
          <Row label="Penalty − waiver" value={`${naira(d.penaltyLoadingFee)} − ${naira(d.waiverAmount)}`} />
          <div className="flex items-center justify-between border-t border-border pt-2">
            <span className="font-medium text-muted-foreground">Generated net invoice</span>
            <span className="figure text-[24px] font-semibold text-foreground">{naira(bill.netInvoiceAmount)}</span>
          </div>
        </div>
      </div>

      <div>
        <SectionLabel>Subscription validity</SectionLabel>
        <FieldGrid columns={4}>
          <SelectField id="bl-cycle" label="Billing cycle" value={d.billingCycleType} onChange={(v) => cyclePatch({ billingCycleType: v as CycleType })} options={CYCLE_TYPES} />
          {d.billingCycleType === "Multi_Year_Contract" ? (
            <NumberField id="bl-years" label="Years" value={d.cycleYears} onChange={(v) => cyclePatch({ cycleYears: v })} />
          ) : d.billingCycleType === "Short_Term_Promotional" ? (
            <NumberField id="bl-days" label="Days" value={d.promoDays} hint="Prorated on 365 days" onChange={(v) => cyclePatch({ promoDays: v })} />
          ) : (
            <TextField id="bl-len" label="Length" value="12 months" onChange={() => undefined} />
          )}
          <TextField id="bl-start" label="Activation date" type="date" value={d.subscriptionStartDate} onChange={(v) => cyclePatch({ subscriptionStartDate: v })} />
          <TextField id="bl-exp" label="Expiration date" type="date" value={d.subscriptionExpiryDate} hint="Auto-calculated" onChange={(v) => set({ subscriptionExpiryDate: v })} />
        </FieldGrid>
      </div>

      <FieldGrid>
        <TextField id="bl-inv" label="Invoice number" mono value={d.invoiceNumber} onChange={(v) => set({ invoiceNumber: v })} />
        <TextField id="bl-cyc" label="Cycle" value={`#${d.cycle}`} onChange={() => undefined} />
      </FieldGrid>
      <TextareaField id="bl-narr" label="Invoice narration" value={d.invoiceNarration} rows={2} onChange={(v) => set({ invoiceNarration: v })} />
    </div>
  )
}

const billingDraft: QueueDraft<BillingDraft> = {
  field: "billing",
  views: ["assess"],
  title: "Billing engine",
  initial: initialBilling,
  validate: (d, row) => {
    const items = itemsOf(row)
    if (!items.length) return "There are no locked measurements to bill against."
    const bill = computeBill(items, d)
    if (bill.missingRates.length) return `No tariff rate for: ${bill.missingRates.map(typeLabel).join(", ")}.`
    if (!(bill.netInvoiceAmount > 0)) return "The net invoice must be above zero."
    if (d.waiverAmount > 0 && (!d.waiverReason || d.waiverReason === "No waiver applied")) return "Give a reason for the waiver."
    if (!d.subscriptionStartDate || !d.subscriptionExpiryDate || d.subscriptionExpiryDate <= d.subscriptionStartDate) return "Check the validity dates."
    if (!d.invoiceNumber.trim()) return "An invoice number is required."
    return null
  },
  derive: (d, row, { now, actorId }) => {
    const bill = computeBill(itemsOf(row), d)
    return { billing: { ...d, ...bill, measurementsSource: row.measurements?.source ?? "", assessedAt: now, assessedBy: actorId } }
  },
  render: (d, set, row) => <BillingEngine d={d} set={set} row={row} />,
}

export function BillingQueue() {
  return (
    <WorkQueue<BillingDraft>
      title="Billing assessments"
      description="Price locked field measurements against the gazetted tariff"
      department={DEPARTMENT.billing}
      actorId="billing"
      draft={billingDraft}
      views={[
        {
          value: "assess",
          label: "To assess",
          routes: ["first", "third"],
          statuses: stage("billing"),
          empty: { title: "Nothing to price", body: "The Director sends files here once field measurements are verified." },
          actions: [
            {
              key: "query",
              label: "Query measurements (via Director)",
              tone: "danger",
              icon: Undo2,
              status: STATUS.billingQueried,
              department: DEPARTMENT.director,
              record: "Billing raised a query on the field measurements",
              requiresReason: true,
              kind: "error",
            },
            {
              key: "commit",
              label: "Commit bill — forward to Director",
              icon: Forward,
              status: STATUS.billProposed,
              department: DEPARTMENT.director,
              record: "Bill computed by Billing",
              needsDraft: true,
            },
          ],
        },
        {
          value: "sent",
          label: "Billed",
          routes: ["first", "third"],
          statuses: [...stage("billProposed"), ...stage("awaitingPayment"), ...stage("paymentReconciled"), ...stage("issued")],
          empty: { title: "Nothing billed yet", body: "Bills you've committed stay here for reference." },
          column: { header: "Net invoice", render: (row) => <span className="figure">{naira(row.billing?.netInvoiceAmount as number)}</span> },
        },
      ]}
    />
  )
}

/* ================= Subscription lifecycle tracker ================= */

interface RegisterDoc {
  id: string
  category?: string
  route?: "first" | "third"
  permitNumber?: string
  holderName?: string
  submissionId?: string
  submissionRef?: string
  totalSqm?: number
  status?: string
  expiresAt?: string
  cycle?: number
}

export const EXPIRY_WARNING_DAYS = 30

export function lifecycleOf(expiresAt?: unknown) {
  const days = daysUntil(expiresAt)
  if (days === null) return { days, state: "unknown" as const }
  if (days < 0) return { days, state: "expired" as const }
  if (days <= EXPIRY_WARNING_DAYS) return { days, state: "warning" as const }
  return { days, state: "active" as const }
}

export function SubscriptionTracker() {
  const { active: schedule } = useTariffSchedules()
  const { data, loading, error } = useRealtimeCollection<Omit<RegisterDoc, "id">>(REGISTER_COLLECTION, [orderBy("expiresAt", "asc"), limit(500)], [])
  const [filter, setFilter] = React.useState<"due" | "expired" | "warning" | "active" | "all">("due")
  const [search, setSearch] = React.useState("")
  const [target, setTarget] = React.useState<RegisterDoc | null>(null)
  const [busy, setBusy] = React.useState(false)

  const rows = React.useMemo(() => {
    const term = search.trim().toLowerCase()
    return (data as RegisterDoc[])
      .map((e) => ({ ...e, ...lifecycleOf(e.expiresAt) }))
      .filter((e) => {
        if (filter === "due" && !(e.state === "expired" || e.state === "warning")) return false
        if ((filter === "expired" || filter === "warning" || filter === "active") && e.state !== filter) return false
        return term ? [e.holderName, e.permitNumber, e.submissionId].join(" ").toLowerCase().includes(term) : true
      })
  }, [data, filter, search])

  const rebill = async (entry: RegisterDoc, mode: "clone" | "adjust") => {
    if (!entry.submissionRef || !entry.route) {
      toast.error({ title: "Register entry has no source file" })
      return
    }
    setBusy(true)
    try {
      const ref = doc(db, collectionFor(entry.route), entry.submissionRef)
      const snap = await getDoc(ref)
      if (!snap.exists()) throw new Error("Source file not found.")
      const file = snap.data() as SubmissionRow
      if (!stage("issued").includes(file.status ?? "")) throw new Error(`File is already in progress (${file.status}).`)
      const now = new Date().toISOString()
      const prev = (file.billing ?? {}) as Partial<BillingDraft> & Record<string, unknown>
      const cycle = Number(prev.cycle ?? 1) + 1

      // New cycle starts the day after the old one ends.
      const ended = parseDate(entry.expiresAt) ?? new Date()
      const nextStart = isoDate(new Date(ended.getFullYear(), ended.getMonth(), ended.getDate() + 1))

      const params: BillingDraft = {
        ...initialBilling({ ...file, id: entry.submissionRef, route: entry.route, billing: undefined }),
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        rates: schedule.rates,
        illuminationSurchargePct: schedule.illuminationSurchargePct,
        zone: (prev.zone as ZoneId) ?? suggestZone(file.areaCouncil),
        zoneMultiplier: zoneById((prev.zone as string) ?? suggestZone(file.areaCouncil)).multiplier,
        applyIllumination: prev.applyIllumination ?? true,
        billingCycleType: (prev.billingCycleType as CycleType) ?? "Annual_Standard",
        cycleYears: Number(prev.cycleYears ?? 2),
        promoDays: Number(prev.promoDays ?? 90),
        penaltyLoadingFee: 0,
        waiverAmount: 0,
        waiverReason: "No waiver applied",
        subscriptionStartDate: nextStart,
        subscriptionExpiryDate: "",
        invoiceNumber: invoiceNumber(cycle),
        cycle,
      }
      params.subscriptionExpiryDate = expiryFor(nextStart, params)
      params.invoiceNarration = `Renewal (cycle ${cycle}) — ${params.invoiceNarration}`

      const items = (file.measurements as Measurements | undefined)?.items ?? []
      if (mode === "clone" && !items.length) throw new Error("This file has no locked measurements to clone. Use 'Adjustments needed'.")
      const bill = computeBill(items, params)
      const clone = mode === "clone"
      const status = clone ? STATUS.renewalProposed : STATUS.billingAssessment
      const to = clone ? DEPARTMENT.director : DEPARTMENT.billing
      const record = clone ? `Renewal invoice ${params.invoiceNumber} generated from historical parameters` : `Renewal cycle ${cycle} opened for re-assessment`

      await updateDoc(ref, {
        billingHistory: arrayUnion(prev),
        paymentHistory: arrayUnion(file.payment ?? {}),
        billing: clone
          ? { ...params, ...bill, measurementsSource: file.measurements?.source ?? "", assessedAt: now, assessedBy: "billing", renewal: true }
          : { ...params, renewal: true },
        payment: {},
        status,
        department: to,
        updatedAt: now,
        comments: arrayUnion({ timestamp: now, desk: "billing", action: record, from: DEPARTMENT.billing, to, status }),
      })
      await updateDoc(doc(db, REGISTER_COLLECTION, entry.id), { status: "Renewal Invoiced", renewalStartedAt: now })
      await addDoc(collection(db, COL.activity), { submissionId: entry.submissionRef, action: record, timestamp: now, userId: "billing" })
      if (clone) {
        await addDoc(collection(db, COL.notifications), {
          userId: "director",
          content: `${record} — ${entry.holderName ?? ""} (${naira(bill.netInvoiceAmount)})`,
          type: "info",
          referenceId: entry.submissionRef,
          isRead: false,
          createdAt: now,
        })
      }
      toast.success({ title: clone ? "Renewal sent to Director" : "Opened in Billing queue", description: entry.holderName })
      setTarget(null)
    } catch (err) {
      toast.error({ title: "Re-bill failed", description: err instanceof Error ? err.message : "Try again." })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Panel
        title="Subscription lifecycle monitor"
        description={`Live permits by expiry. Warning window: ${EXPIRY_WARNING_DAYS} days.`}
        actions={
          <Segmented
            value={filter}
            onChange={(v) => setFilter(v as typeof filter)}
            options={[
              { value: "due", label: "Needs action" },
              { value: "expired", label: "Expired" },
              { value: "warning", label: "Expiring" },
              { value: "active", label: "Active" },
              { value: "all", label: "All" },
            ]}
          />
        }
        bodyClassName="p-0"
      >
        <div className="border-b border-border p-3 sm:px-5">
          <SearchField value={search} onChange={setSearch} placeholder="Company name, permit or file number" />
        </div>
        <div className="p-3 sm:p-4">
          {error ? (
            <LoadFailed error={error} what="The permit register" />
          ) : loading ? (
            <RowsSkeleton rows={5} columns={5} />
          ) : !rows.length ? (
            <EmptyState icon={CalendarClock} title="Nothing in this view" description="Permits appear here once the Director signs them off." />
          ) : (
            <div className="overflow-x-auto scroll-slim">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-border text-[11.5px] font-semibold text-muted-foreground">
                    <th className="px-3 py-2.5">Client account</th>
                    <th className="px-3 py-2.5">Type</th>
                    <th className="px-3 py-2.5">Expires</th>
                    <th className="px-3 py-2.5">Counter</th>
                    <th className="px-3 py-2.5">Lifecycle state</th>
                    <th className="px-3 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id} className="border-b border-border/70 last:border-0 hover:bg-muted/50">
                      <td className="px-3 py-3">
                        <p className="text-[13.5px] font-medium text-foreground">{e.holderName}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">{e.permitNumber}</p>
                      </td>
                      <td className="px-3 py-3 text-[12.5px]">{e.category === "first-party" ? "FP" : "3P"}</td>
                      <td className="px-3 py-3 text-[12.5px]">{formatDate(e.expiresAt)}</td>
                      <td className={cn("px-3 py-3 text-[12.5px] font-semibold", e.state === "expired" ? TONE.stop.text : e.state === "warning" ? TONE.wait.text : TONE.clear.text)}>
                        {e.days === null ? "—" : e.days < 0 ? `${-e.days} days ago` : `${e.days} days left`}
                      </td>
                      <td className="px-3 py-3">
                        {e.status === "Renewal Invoiced" ? (
                          <StatusPill status="Renewal Invoiced" />
                        ) : (
                          <StatusPill
                            tone={e.state === "expired" ? "stop" : e.state === "warning" ? "wait" : "clear"}
                            status={e.state === "expired" ? "Expired — re-bill outstanding" : e.state === "warning" ? "Warning — send renewal invoice" : "Active"}
                          />
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {(e.state === "expired" || e.state === "warning") && e.status !== "Renewal Invoiced" ? (
                          <ActionButton tone="quiet" icon={RefreshCcw} onClick={() => setTarget(e)}>
                            Re-bill
                          </ActionButton>
                        ) : null}
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
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        title="Generate renewal invoice"
        caption={target ? `${target.holderName} · ${target.permitNumber}` : ""}
        width="max-w-lg"
        footer={
          target ? (
            <div className="flex flex-wrap justify-end gap-2">
              <ActionButton tone="quiet" disabled={busy} onClick={() => rebill(target, "adjust")}>
                Adjustments needed — open in Billing
              </ActionButton>
              <ActionButton icon={Forward} disabled={busy} onClick={() => rebill(target, "clone")}>
                {busy ? "Generating…" : `Generate cycle ${(target.cycle ?? 1) + 1} — route to Director`}
              </ActionButton>
            </div>
          ) : null
        }
      >
        {target ? (
          <p className="text-[13.5px] leading-relaxed text-foreground">
            The system will clone the historical physical parameters for <strong>{target.holderName}</strong> (total {Number(target.totalSqm ?? 0).toFixed(2)} m²), price them on{" "}
            <strong>{schedule.name}</strong> with the previous zone and cycle settings, and start the new cycle the day after {formatDate(target.expiresAt)}. The renewal goes to the
            Director for pricing sign-off, then Finance.
          </p>
        ) : null}
      </Sheet>
    </>
  )
}

/* ================= Tariff schedule (gazette table) ================= */

export function TariffSchedulePanel() {
  const { schedules, active, seeded } = useTariffSchedules()
  const [name, setName] = React.useState(active.name)
  const [pct, setPct] = React.useState(active.illuminationSurchargePct)
  const [rates, setRates] = React.useState<Record<string, number>>(active.rates)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    setName(active.name)
    setPct(active.illuminationSurchargePct)
    setRates(active.rates)
  }, [active.id, active.name, active.illuminationSurchargePct, active.rates])

  const save = async () => {
    if (!name.trim()) {
      toast.warning({ title: "Name the schedule" })
      return
    }
    setSaving(true)
    try {
      const batch = writeBatch(db)
      if (seeded) schedules.forEach((s) => s.active && batch.update(doc(db, TARIFF_COLLECTION, s.id), { active: false }))
      batch.set(doc(collection(db, TARIFF_COLLECTION)), { name: name.trim(), illuminationSurchargePct: pct, rates, active: true, effectiveFrom: todayISO(), createdAt: new Date().toISOString() })
      await batch.commit()
      toast.success({ title: "Schedule saved and activated", description: "New assessments use it. Existing bills are unchanged." })
    } catch (err) {
      toast.error({ title: "Not saved", description: err instanceof Error ? err.message : "Try again." })
    } finally {
      setSaving(false)
    }
  }

  const groups: [string, { value: string; label: string }[]][] = [
    ["First-party sign types", SIGN_TYPES],
    ["Third-party structures", STRUCTURE_TYPES],
  ]

  return (
    <Panel
      title="Tariff schedule"
      description={seeded ? `Active: ${active.name}` : "Using built-in placeholder rates — enter the gazetted figures and save."}
      actions={
        <ActionButton icon={Save} disabled={saving} onClick={save}>
          {saving ? "Saving…" : "Save as new active schedule"}
        </ActionButton>
      }
    >
      <FieldGrid>
        <TextField id="ts-name" label="Schedule name" value={name} onChange={setName} />
        <NumberField id="ts-pct" label="Illumination surcharge (%)" value={pct} onChange={setPct} />
      </FieldGrid>
      {groups.map(([title, list]) => (
        <div key={title} className="mt-5">
          <SectionLabel>{title} — ₦ per m² per year</SectionLabel>
          <FieldGrid columns={3}>
            {list.map((t) => (
              <NumberField key={t.value} id={`ts-${t.value}`} label={t.label} prefix="₦" value={rates[t.value] ?? 0} onChange={(v) => setRates((r) => ({ ...r, [t.value]: v }))} />
            ))}
          </FieldGrid>
        </div>
      ))}
    </Panel>
  )
}
