"use client"

import * as React from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { BadgeCheck, Receipt, Wallet } from "lucide-react"
import { DEFAULT_FEES, DEPARTMENT, STATUS, feesTotal, invoiceNumber, stage } from "@/lib/workflow"
import { formatDate, naira, toDate } from "@/lib/format"
import {
  FieldGrid,
  NumberField,
  SearchField,
  TextField,
  TextareaField,
} from "@/components/dashboard/form-kit"
import {
  WorkQueue,
  useSubmissions,
  type QueueDraft,
  type SubmissionRow,
} from "@/components/dashboard/work-queue"
import {
  EmptyState,
  LoadFailed,
  Panel,
  RowsSkeleton,
  StatTile,
  StatusPill,
} from "@/components/dashboard/kit"
import { Segmented } from "@/components/dashboard/notifications-panel"

/* ------------------------------------------------------------------ *
 * Billing
 * ------------------------------------------------------------------ */

interface BillingDraft extends Record<string, unknown> {
  invoiceNumber: string
  applicationFee: number
  processingFee: number
  annualFee: number
  penaltyFee: number
  totalAmount: number
  dueDate: string
  paymentStatus: string
  paymentReference: string
  paidOn: string
  billingNotes: string
}

const inThirtyDays = () =>
  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

function initialBilling(row: SubmissionRow): BillingDraft {
  const existing = (row.billing ?? {}) as Partial<BillingDraft>
  const base: BillingDraft = {
    invoiceNumber: existing.invoiceNumber ?? invoiceNumber(),
    applicationFee: Number(existing.applicationFee ?? DEFAULT_FEES.applicationFee),
    processingFee: Number(existing.processingFee ?? DEFAULT_FEES.processingFee),
    annualFee: Number(existing.annualFee ?? DEFAULT_FEES.annualFee),
    penaltyFee: Number(existing.penaltyFee ?? 0),
    totalAmount: 0,
    dueDate: existing.dueDate ? String(existing.dueDate).slice(0, 10) : inThirtyDays(),
    paymentStatus: existing.paymentStatus ?? "Pending",
    paymentReference: existing.paymentReference ?? "",
    paidOn: existing.paidOn ? String(existing.paidOn).slice(0, 10) : "",
    billingNotes: existing.billingNotes ?? "",
  }
  base.totalAmount = feesTotal(base)
  return base
}

const billingDraft: QueueDraft<BillingDraft> = {
  field: "billing",
  views: ["billing", "payment"],
  title: "Invoice",
  initial: initialBilling,
  validate: (d) => {
    if (!d.invoiceNumber.trim()) return "An invoice needs a reference number."
    if (feesTotal(d) <= 0) return "The invoice total has to be more than zero."
    if (d.paymentStatus === "Paid" && !d.paymentReference.trim())
      return "Record the payment reference before confirming."
    return null
  },
  render: (d, set) => {
    const total = feesTotal(d)
    const settling = d.paymentStatus === "Paid" || Boolean(d.paymentReference)

    return (
      <div className="space-y-5">
        <FieldGrid>
          <TextField
            id="fin-invoice"
            label="Invoice number"
            mono
            value={d.invoiceNumber}
            onChange={(v) => set({ invoiceNumber: v })}
          />
          <TextField
            id="fin-due"
            label="Payment due"
            type="date"
            value={d.dueDate}
            onChange={(dueDate) => set({ dueDate })}
          />
        </FieldGrid>

        <FieldGrid>
          <NumberField
            id="fin-application"
            label="Application fee"
            prefix="₦"
            value={d.applicationFee}
            onChange={(applicationFee) =>
              set({ applicationFee, totalAmount: feesTotal({ ...d, applicationFee }) })
            }
          />
          <NumberField
            id="fin-processing"
            label="Processing fee"
            prefix="₦"
            value={d.processingFee}
            onChange={(processingFee) =>
              set({ processingFee, totalAmount: feesTotal({ ...d, processingFee }) })
            }
          />
          <NumberField
            id="fin-annual"
            label="Annual fee"
            prefix="₦"
            value={d.annualFee}
            onChange={(annualFee) => set({ annualFee, totalAmount: feesTotal({ ...d, annualFee }) })}
          />
          <NumberField
            id="fin-penalty"
            label="Penalty"
            prefix="₦"
            hint="Late renewal or unauthorised erection"
            value={d.penaltyFee}
            onChange={(penaltyFee) =>
              set({ penaltyFee, totalAmount: feesTotal({ ...d, penaltyFee }) })
            }
          />
        </FieldGrid>

        <div className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3.5">
          <span className="text-[13px] font-medium text-muted-foreground">Invoice total</span>
          <span className="figure text-[24px] font-semibold text-foreground">{naira(total)}</span>
        </div>

        {settling ? (
          <FieldGrid>
            <TextField
              id="fin-reference"
              label="Payment reference"
              mono
              value={d.paymentReference}
              placeholder="Remita RRR or bank teller number"
              onChange={(paymentReference) => set({ paymentReference })}
            />
            <TextField
              id="fin-paid"
              label="Date paid"
              type="date"
              value={d.paidOn}
              onChange={(paidOn) => set({ paidOn })}
            />
          </FieldGrid>
        ) : null}

        <TextareaField
          id="fin-notes"
          label="Billing notes"
          value={d.billingNotes}
          rows={2}
          placeholder="Anything the applicant or the Director should know about this invoice."
          onChange={(billingNotes) => set({ billingNotes })}
        />
      </div>
    )
  },
}

export function FinanceQueue() {
  return (
    <WorkQueue<BillingDraft>
      title="Billing"
      description="First-party permits only — third-party applications are not billed"
      actorId="finance"
      draft={billingDraft}
      views={[
        {
          value: "billing",
          label: "To invoice",
          routes: ["first"],
          statuses: stage("visitReported"),
          empty: {
            title: "Nothing to invoice",
            body: "Business Development sends a file here once the site visit is done and the measurements are in.",
          },
          actions: [
            {
              key: "issue",
              label: "Issue invoice",
              icon: Receipt,
              status: STATUS.awaitingPayment,
              department: DEPARTMENT.finance,
              record: "Invoice issued by Finance",
              notify: "csu",
              needsDraft: true,
            },
          ],
        },
        {
          value: "payment",
          label: "Awaiting payment",
          routes: ["first"],
          statuses: stage("awaitingPayment"),
          empty: {
            title: "No invoices outstanding",
            body: "Issued invoices sit here until you record the payment reference against them.",
          },
          column: {
            header: "Total",
            render: (row) => <span className="figure">{naira(row.billing?.totalAmount as number)}</span>,
          },
          actions: [
            {
              key: "confirm",
              label: "Confirm payment — back to Business Development",
              icon: BadgeCheck,
              status: STATUS.paymentConfirmed,
              department: DEPARTMENT.businessDevelopment,
              record: "Payment confirmed by Finance",
              kind: "success",
              needsDraft: true,
            },
          ],
        },
        {
          value: "settled",
          label: "Settled",
          routes: ["first"],
          statuses: [STATUS.paymentConfirmed, ...stage("recommended"), STATUS.approved, STATUS.registered],
          empty: {
            title: "Nothing settled yet",
            body: "Paid applications stay here as the revenue record for the year.",
          },
          column: {
            header: "Total",
            render: (row) => <span className="figure">{naira(row.billing?.totalAmount as number)}</span>,
          },
        },
      ]}
    />
  )
}

/* ------------------------------------------------------------------ *
 * Revenue
 * ------------------------------------------------------------------ */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const SLICE_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
]

interface Invoice {
  key: string
  reference: string
  applicant: string
  type: string
  total: number
  status: string
  issued: Date | null
  paid: Date | null
}

function useInvoices() {
  const { rows, loading, error } = useSubmissions()

  const invoices = React.useMemo<Invoice[]>(
    () =>
      rows
        .filter((row) => row.route === "first" && row.billing && Object.keys(row.billing).length)
        .map((row) => {
          const billing = row.billing as Record<string, unknown>
          return {
            key: `${row.route}-${row.id}`,
            reference: String(billing.invoiceNumber ?? row.submissionId ?? row.id.slice(0, 8)),
            applicant: row.companyName || row.applicantName || "Unnamed applicant",
            type: row.applicationType || "Signage permit",
            total: Number(billing.totalAmount ?? 0),
            status: String(billing.paymentStatus ?? "Pending"),
            issued: toDate(billing.generatedDate ?? billing.submittedAt ?? row.updatedAt),
            paid: toDate(billing.paidOn),
          }
        }),
    [rows],
  )

  return { invoices, loading, error }
}

export function RevenuePanel() {
  const { invoices, loading, error } = useInvoices()
  const [search, setSearch] = React.useState("")
  const [view, setView] = React.useState<"trend" | "invoices">("trend")

  const years = React.useMemo(() => {
    const set = new Set<number>()
    invoices.forEach((invoice) => {
      const when = invoice.paid ?? invoice.issued
      if (when) set.add(when.getFullYear())
    })
    if (!set.size) set.add(new Date().getFullYear())
    return [...set].sort((a, b) => b - a)
  }, [invoices])

  const [year, setYear] = React.useState<number>(years[0])
  React.useEffect(() => {
    if (!years.includes(year)) setYear(years[0])
  }, [years, year])

  const settled = invoices.filter((invoice) => invoice.status === "Paid")
  const outstanding = invoices.filter((invoice) => invoice.status !== "Paid")

  const collected = settled.reduce((sum, invoice) => sum + invoice.total, 0)
  const owed = outstanding.reduce((sum, invoice) => sum + invoice.total, 0)

  const monthly = React.useMemo(() => {
    const totals = new Array(12).fill(0)
    settled.forEach((invoice) => {
      const when = invoice.paid ?? invoice.issued
      if (when && when.getFullYear() === year) totals[when.getMonth()] += invoice.total
    })
    return MONTHS.map((month, index) => ({ month, revenue: totals[index] }))
  }, [settled, year])

  const byType = React.useMemo(() => {
    const totals = new Map<string, number>()
    settled.forEach((invoice) => {
      totals.set(invoice.type, (totals.get(invoice.type) ?? 0) + invoice.total)
    })
    return [...totals.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
  }, [settled])

  const listed = React.useMemo(() => {
    const term = search.trim().toLowerCase()
    return invoices
      .filter((invoice) =>
        term
          ? [invoice.reference, invoice.applicant, invoice.type]
              .join(" ")
              .toLowerCase()
              .includes(term)
          : true,
      )
      .sort((a, b) => (b.issued?.getTime() ?? 0) - (a.issued?.getTime() ?? 0))
  }, [invoices, search])

  if (error) {
    return (
      <Panel title="Revenue">
        <LoadFailed error={error} what="Revenue" />
      </Panel>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          index={0}
          label="Collected to date"
          value={collected}
          tone="clear"
          icon={Wallet}
          note={`${settled.length} invoice${settled.length === 1 ? "" : "s"} settled`}
        />
        <StatTile
          index={1}
          label="Outstanding"
          value={owed}
          tone="wait"
          icon={Receipt}
          note={`${outstanding.length} awaiting payment`}
        />
        <StatTile
          index={2}
          label="Invoices raised"
          value={invoices.length}
          tone="idle"
          icon={BadgeCheck}
          note="Across both application routes"
        />
      </div>

      <Panel
        title={view === "trend" ? "Revenue" : "Invoices"}
        description={
          view === "trend"
            ? "Payments recorded against issued invoices"
            : "Every invoice raised, newest first"
        }
        actions={
          <>
            <Segmented
              value={view}
              onChange={(v) => setView(v as typeof view)}
              options={[
                { value: "trend", label: "Revenue" },
                { value: "invoices", label: "Invoices" },
              ]}
            />
            {view === "trend" && years.length > 1 ? (
              <Segmented
                value={String(year)}
                onChange={(v) => setYear(Number(v))}
                options={years.map((y) => ({ value: String(y), label: String(y) }))}
              />
            ) : null}
          </>
        }
        bodyClassName="p-3 sm:p-5"
      >
        {loading ? (
          <RowsSkeleton rows={5} columns={4} />
        ) : !invoices.length ? (
          <EmptyState
            icon={Receipt}
            title="No invoices raised yet"
            description="Revenue is calculated from invoices issued in Billing — raise one and the figures appear here."
          />
        ) : view === "trend" ? (
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <p className="mb-3 text-[12.5px] font-medium text-muted-foreground">
                Collected by month, {year}
              </p>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthly} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="month"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={52}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={(value: number) =>
                        value >= 1_000_000 ? `₦${(value / 1_000_000).toFixed(1)}M` : `₦${value / 1000}k`
                      }
                    />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted))" }}
                      contentStyle={{
                        borderRadius: 10,
                        border: "1px solid hsl(var(--border))",
                        background: "hsl(var(--card))",
                        fontSize: 12,
                      }}
                      formatter={(value: number) => [naira(value), "Collected"]}
                    />
                    <Bar dataKey="revenue" radius={[5, 5, 0, 0]} fill="hsl(var(--chart-2))" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="lg:col-span-2">
              <p className="mb-3 text-[12.5px] font-medium text-muted-foreground">
                Where the money comes from
              </p>
              {byType.length ? (
                <>
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={byType}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={52}
                          outerRadius={86}
                          paddingAngle={2}
                          stroke="hsl(var(--card))"
                          strokeWidth={2}
                        >
                          {byType.map((entry, index) => (
                            <Cell key={entry.name} fill={SLICE_COLORS[index % SLICE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            borderRadius: 10,
                            border: "1px solid hsl(var(--border))",
                            background: "hsl(var(--card))",
                            fontSize: 12,
                          }}
                          formatter={(value: number) => naira(value)}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="mt-3 space-y-1.5">
                    {byType.map((entry, index) => (
                      <li key={entry.name} className="flex items-center gap-2 text-[12.5px]">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-sm"
                          style={{ background: SLICE_COLORS[index % SLICE_COLORS.length] }}
                        />
                        <span className="min-w-0 flex-1 truncate text-muted-foreground">
                          {entry.name}
                        </span>
                        <span className="figure text-foreground">{naira(entry.value)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-[13px] text-muted-foreground">
                  Nothing settled yet, so there's no split to show.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder="Search invoice, applicant or type"
            />
            <div className="overflow-x-auto scroll-slim">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-border text-[11.5px] font-semibold text-muted-foreground">
                    <th className="px-3 py-2.5">Invoice</th>
                    <th className="px-3 py-2.5">Applicant</th>
                    <th className="hidden px-3 py-2.5 md:table-cell">Type</th>
                    <th className="px-3 py-2.5 text-right">Amount</th>
                    <th className="px-3 py-2.5">Payment</th>
                    <th className="hidden px-3 py-2.5 sm:table-cell">Issued</th>
                  </tr>
                </thead>
                <tbody>
                  {listed.map((invoice, i) => (
                    <tr
                      key={invoice.key}
                      style={{ ["--i" as string]: Math.min(i, 10) }}
                      className="reveal border-b border-border/70 last:border-0 hover:bg-muted/50"
                    >
                      <td className="px-3 py-3 font-mono text-[12px] text-muted-foreground">
                        {invoice.reference}
                      </td>
                      <td className="px-3 py-3 text-[13.5px] font-medium text-foreground">
                        {invoice.applicant}
                      </td>
                      <td className="hidden px-3 py-3 text-[13px] text-muted-foreground md:table-cell">
                        {invoice.type}
                      </td>
                      <td className="figure px-3 py-3 text-right text-[13.5px] text-foreground">
                        {naira(invoice.total)}
                      </td>
                      <td className="px-3 py-3">
                        <StatusPill status={invoice.status} />
                      </td>
                      <td className="hidden px-3 py-3 text-[12.5px] text-muted-foreground sm:table-cell">
                        {invoice.issued ? formatDate(invoice.issued) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Panel>
    </div>
  )
}
