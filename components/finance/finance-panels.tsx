"use client"

import * as React from "react"
import { getDownloadURL, ref, uploadBytes } from "firebase/storage"
import { BadgeCheck, Loader2, Paperclip, Radar, ShieldAlert, SplitSquareHorizontal } from "lucide-react"
import { storage } from "@/lib/firebase"
import { DEPARTMENT, LEDGER_CODES, STATUS, ledgerFor, parseDate, stage } from "@/lib/workflow"
import { formatDate, formatDateTime, naira } from "@/lib/format"
import { toast } from "@/components/ui/toast"
import { ActionButton, FieldGrid, NumberField, SelectField, TextField, TextareaField } from "@/components/dashboard/form-kit"
import { EmptyState, LoadFailed, Panel, RowsSkeleton, SectionLabel, StatusPill, TONE } from "@/components/dashboard/kit"
import { WorkQueue, useSubmissions, type QueueDraft, type SubmissionRow } from "@/components/dashboard/work-queue"
import { cn } from "@/lib/utils"

interface RemitaCheck {
  configured: boolean
  found?: boolean
  paid?: boolean
  amount?: number
  transactionTime?: string
  message?: string
  checkedAt: string
}

interface PaymentDraft extends Record<string, unknown> {
  remitaRrr: string
  paymentChannel: string
  amountCredited: number
  bankTransactionTimestamp: string
  uploadedRemitaProof: string
  financeLedgerCode: string
  reconciliationStatus: string
  remitaCheck: RemitaCheck | null
  financeNotes: string
}

interface Declared {
  rrr?: string
  amount?: number
  proofUrl?: string
  channel?: string
  declaredAt?: string
}

const RECON = [
  { value: "Unverified", label: "Unverified" },
  { value: "Reconciled_Match", label: "Reconciled — match" },
  { value: "Underpaid_Shortfall", label: "Underpaid — shortfall" },
  { value: "Overpaid_Credit", label: "Overpaid — credit" },
]

const digits = (v: string) => v.replace(/\D/g, "")
const expectedOf = (row: SubmissionRow) => Number(row.billing?.netInvoiceAmount ?? row.billing?.totalAmount ?? 0)

function suggest(expected: number, credited: number) {
  if (!(credited > 0)) return "Unverified"
  if (Math.abs(credited - expected) < 1) return "Reconciled_Match"
  return credited < expected ? "Underpaid_Shortfall" : "Overpaid_Credit"
}

function FinanceDesk({ d, set, row }: { d: PaymentDraft; set: (p: Partial<PaymentDraft>) => void; row: SubmissionRow }) {
  const [checking, setChecking] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)
  const expected = expectedOf(row)
  const declared = (row.payment?.declared ?? null) as Declared | null
  const variance = Number(d.amountCredited || 0) - expected
  const suggested = suggest(expected, Number(d.amountCredited || 0))

  const runCheck = async () => {
    const rrr = digits(d.remitaRrr)
    if (rrr.length !== 12) {
      toast.warning({ title: "RRR must be 12 digits" })
      return
    }
    setChecking(true)
    try {
      const res = await fetch(`/api/remita/verify?rrr=${rrr}`)
      const json = await res.json()
      const check: RemitaCheck = { ...json, checkedAt: new Date().toISOString() }
      const patch: Partial<PaymentDraft> = { remitaCheck: check }
      if (check.paid && check.amount) {
        patch.amountCredited = check.amount
        if (check.transactionTime) patch.bankTransactionTimestamp = String(check.transactionTime)
      }
      set(patch)
    } catch (err) {
      toast.error({ title: "Remita check failed", description: err instanceof Error ? err.message : "Try again." })
    } finally {
      setChecking(false)
    }
  }

  const uploadProof = async (file?: File) => {
    if (!file) return
    setUploading(true)
    try {
      const target = ref(storage, `finance/${row.id}/bank-proof-${Date.now()}-${file.name.replace(/\s+/g, "-")}`)
      await uploadBytes(target, file, { contentType: file.type })
      set({ uploadedRemitaProof: await getDownloadURL(target) })
    } catch (err) {
      toast.error({ title: "Upload failed", description: err instanceof Error ? err.message : "Try again." })
    } finally {
      setUploading(false)
    }
  }

  const check = d.remitaCheck

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/40 p-3.5 text-[12.5px]">
        <div>
          <p className="text-muted-foreground">Invoice reference</p>
          <p className="font-mono font-medium text-foreground">{String(row.billing?.invoiceNumber ?? "—")}</p>
        </div>
        <div className="text-right">
          <p className="text-muted-foreground">Expected payable total</p>
          <p className="figure text-[18px] font-semibold text-foreground">{naira(expected)}</p>
        </div>
      </div>

      <div>
        <SectionLabel>Client payment proof (portal)</SectionLabel>
        {declared ? (
          <div className="grid grid-cols-3 gap-3 text-[13px]">
            <div>
              <p className="text-[11.5px] text-muted-foreground">Declared RRR</p>
              <p className="font-mono">{declared.rrr}</p>
            </div>
            <div>
              <p className="text-[11.5px] text-muted-foreground">Declared amount</p>
              <p>{naira(declared.amount)}</p>
            </div>
            <div>
              <p className="text-[11.5px] text-muted-foreground">Receipt</p>
              {declared.proofUrl ? (
                <a href={declared.proofUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent underline-offset-4 hover:underline">
                  View upload
                </a>
              ) : (
                "—"
              )}
            </div>
          </div>
        ) : (
          <p className="text-[13px] text-muted-foreground">The applicant hasn&rsquo;t declared a payment yet. You can still verify a bank-branch payment directly.</p>
        )}
      </div>

      <div>
        <SectionLabel>Remita settlement check</SectionLabel>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <TextField id="fn-rrr" label="Remita retrieval reference (RRR)" mono value={d.remitaRrr} placeholder="12 digits" onChange={(v) => set({ remitaRrr: v })} />
          </div>
          <ActionButton tone="quiet" icon={checking ? Loader2 : Radar} disabled={checking} onClick={runCheck}>
            Query Remita
          </ActionButton>
        </div>
        {check ? (
          <p className={cn("mt-2 rounded-lg px-3.5 py-2.5 text-[12.5px]", !check.configured ? "bg-muted text-muted-foreground" : check.paid ? TONE.clear.soft : TONE.stop.soft)}>
            {!check.configured
              ? "Remita API isn't configured on this server — verify against the bank statement manually."
              : check.paid
                ? `Match found: ${naira(check.amount)} settled${check.transactionTime ? ` at ${check.transactionTime}` : ""}.`
                : `No settled payment: ${check.message ?? "not found"}.`}{" "}
            <span className="opacity-70">Checked {formatDateTime(check.checkedAt)}</span>
          </p>
        ) : null}
      </div>

      <FieldGrid columns={3}>
        <SelectField
          id="fn-ch"
          label="Payment channel"
          value={d.paymentChannel}
          onChange={(v) => set({ paymentChannel: v })}
          options={[
            { value: "Remita_Portal", label: "Remita portal" },
            { value: "Bank_Branch", label: "Bank branch" },
            { value: "FCTA_Direct_Settlement", label: "FCTA direct settlement" },
          ]}
        />
        <NumberField id="fn-amt" label="Amount credited (to date)" prefix="₦" value={d.amountCredited} hint="Cumulative across part payments" onChange={(v) => set({ amountCredited: v })} />
        <TextField id="fn-ts" label="Bank transaction time" value={d.bankTransactionTimestamp} placeholder="2026-10-06 09:12" onChange={(v) => set({ bankTransactionTimestamp: v })} />
        <SelectField id="fn-ledger" label="Revenue ledger" value={d.financeLedgerCode} onChange={(v) => set({ financeLedgerCode: v })} options={LEDGER_CODES} />
        <SelectField id="fn-rec" label="Reconciliation status" value={d.reconciliationStatus} onChange={(v) => set({ reconciliationStatus: v })} options={RECON} />
        <div>
          <p className="mb-1.5 text-[12.5px] font-medium text-foreground">Bank-confirmed proof</p>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[12.5px] font-semibold hover:bg-muted">
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
            {d.uploadedRemitaProof ? "Replace" : "Attach"}
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => uploadProof(e.target.files?.[0])} />
          </label>
        </div>
      </FieldGrid>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/50 px-4 py-3 text-[13px]">
        <span>
          Variance:{" "}
          <span className={cn("figure font-semibold", Math.abs(variance) < 1 ? TONE.clear.text : variance < 0 ? TONE.stop.text : TONE.move.text)}>
            {variance >= 0 ? "+" : "−"}
            {naira(Math.abs(variance))}
          </span>
        </span>
        <span className="flex items-center gap-2">
          Suggested: <StatusPill status={suggested} />
          {suggested !== d.reconciliationStatus ? (
            <button type="button" className="text-[12px] font-semibold text-accent underline-offset-4 hover:underline" onClick={() => set({ reconciliationStatus: suggested })}>
              apply
            </button>
          ) : null}
        </span>
      </div>

      <TextareaField id="fn-notes" label="Finance notes" value={d.financeNotes} rows={2} onChange={(v) => set({ financeNotes: v })} />
    </div>
  )
}

const paymentDraft: QueueDraft<PaymentDraft> = {
  field: "payment",
  views: ["verify"],
  title: "Finance reconciliation",
  initial: (row) => {
    const p = (row.payment ?? {}) as Partial<PaymentDraft> & { declared?: Declared }
    return {
      remitaRrr: p.remitaRrr ?? p.declared?.rrr ?? "",
      paymentChannel: p.paymentChannel ?? p.declared?.channel ?? "Remita_Portal",
      amountCredited: Number(p.amountCredited ?? 0),
      bankTransactionTimestamp: p.bankTransactionTimestamp ?? "",
      uploadedRemitaProof: p.uploadedRemitaProof ?? "",
      financeLedgerCode: p.financeLedgerCode ?? ledgerFor(row.route),
      reconciliationStatus: p.reconciliationStatus ?? "Unverified",
      remitaCheck: p.remitaCheck ?? null,
      financeNotes: p.financeNotes ?? "",
    }
  },
  validate: (d) => {
    if (digits(d.remitaRrr).length !== 12) return "Enter the 12-digit Remita RRR."
    if (!(d.amountCredited > 0)) return "Enter the amount credited."
    if (!d.bankTransactionTimestamp || !parseDate(d.bankTransactionTimestamp)) return "Enter the bank transaction time."
    if (!d.financeLedgerCode) return "Select the revenue ledger."
    return null
  },
  derive: (d, row, { now, actorId }) => {
    const expected = expectedOf(row)
    const credited = Number(d.amountCredited || 0)
    return {
      payment: {
        ...d,
        remitaRrr: digits(d.remitaRrr),
        expectedAmount: expected,
        balanceDue: Math.max(0, Math.round((expected - credited) * 100) / 100),
        creditBalance: Math.max(0, Math.round((credited - expected) * 100) / 100),
        declared: row.payment?.declared ?? null,
        reconciledAt: now,
        reconciledBy: actorId,
      },
    }
  },
  render: (d, set, row) => <FinanceDesk d={d} set={set} row={row} />,
}

const statusIs = (allowed: string[], message: string) => (draft: Record<string, unknown> | null) =>
  allowed.includes(String(draft?.reconciliationStatus ?? "")) ? null : message

export function FinanceQueue() {
  return (
    <WorkQueue<PaymentDraft>
      title="Payment reconciliation"
      description="Verify declared payments against Remita and the bank ledger"
      department={DEPARTMENT.finance}
      actorId="finance"
      draft={paymentDraft}
      views={[
        {
          value: "verify",
          label: "To verify",
          routes: ["first", "third"],
          statuses: stage("awaitingPayment"),
          empty: { title: "No payments to verify", body: "Invoices the Director confirms arrive here until payment is reconciled." },
          column: { header: "Expected", render: (row) => <span className="figure">{naira(expectedOf(row))}</span> },
          actions: [
            {
              key: "flag",
              label: "Flag receipt invalid",
              tone: "danger",
              icon: ShieldAlert,
              status: STATUS.paymentFlagged,
              department: DEPARTMENT.director,
              record: "Payment flagged as invalid by Finance",
              requiresReason: true,
              needsDraft: true,
              kind: "error",
            },
            {
              key: "partial",
              label: "Record part payment",
              tone: "danger",
              icon: SplitSquareHorizontal,
              status: STATUS.partPayment,
              department: DEPARTMENT.finance,
              record: "Part payment recorded — balance issued",
              needsDraft: true,
              notify: "csu",
              check: statusIs(["Underpaid_Shortfall"], "Set reconciliation status to Underpaid — shortfall first."),
            },
            {
              key: "reconcile",
              label: "Dispatch receipt — route to Director",
              icon: BadgeCheck,
              status: STATUS.paymentReconciled,
              department: DEPARTMENT.director,
              record: "Payment reconciled by Finance",
              needsDraft: true,
              kind: "success",
              check: statusIs(["Reconciled_Match", "Overpaid_Credit"], "Only a matched or overpaid payment can be dispatched."),
            },
          ],
        },
        {
          value: "done",
          label: "Reconciled",
          routes: ["first", "third"],
          statuses: [...stage("paymentReconciled"), ...stage("issued")],
          empty: { title: "Nothing reconciled yet", body: "Verified payments stay here as the receipt record." },
          column: { header: "Credited", render: (row) => <span className="figure">{naira(row.payment?.amountCredited as number)}</span> },
        },
      ]}
    />
  )
}

/* ================= Ledger ================= */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export function useLedger() {
  const { rows, loading, error } = useSubmissions()
  return React.useMemo(() => {
    const credited = (r: SubmissionRow) => Number(r.payment?.amountCredited ?? 0)
    const reconciled = rows.filter((r) => ["Reconciled_Match", "Overpaid_Credit"].includes(String(r.payment?.reconciliationStatus ?? "")))
    const outstanding = rows.filter((r) => stage("awaitingPayment").includes(r.status ?? ""))
    const collected = reconciled.reduce((s, r) => s + credited(r), 0)
    const owed = outstanding.reduce((s, r) => s + Math.max(0, expectedOf(r) - credited(r)), 0)
    return { rows, reconciled, outstanding, collected, owed, credited, loading, error }
  }, [rows, loading, error])
}

export function LedgerPanel() {
  const { reconciled, outstanding, collected, owed, credited, loading, error } = useLedger()
  const year = new Date().getFullYear()

  const byCode = LEDGER_CODES.map((c) => ({
    ...c,
    total: reconciled.filter((r) => r.payment?.financeLedgerCode === c.value).reduce((s, r) => s + credited(r), 0),
  }))

  const monthly = MONTHS.map((m, i) => ({
    m,
    total: reconciled
      .filter((r) => {
        const d = parseDate(r.payment?.bankTransactionTimestamp)
        return d !== null && d.getFullYear() === year && d.getMonth() === i
      })
      .reduce((s, r) => s + credited(r), 0),
  }))
  const peak = Math.max(1, ...monthly.map((x) => x.total))

  if (error) return <LoadFailed error={error} what="The ledger" />

  return (
    <div className="space-y-4">
      <Panel title="Revenue ledger" description={`${naira(collected)} reconciled · ${naira(owed)} outstanding across ${outstanding.length} invoice(s)`}>
        {loading ? (
          <RowsSkeleton rows={3} columns={2} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {byCode.map((c) => (
              <div key={c.value} className="rounded-lg border border-border p-3.5">
                <p className="text-[12px] text-muted-foreground">{c.label}</p>
                <p className="figure mt-1 text-[20px] font-semibold text-foreground">{naira(c.total)}</p>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title={`Collections by month, ${year}`}>
        <div className="flex h-44 items-end gap-2">
          {monthly.map((x) => (
            <div key={x.m} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={naira(x.total)}>
              <div className="w-full rounded-t bg-[hsl(var(--chart-2))]" style={{ height: `${(x.total / peak) * 100}%`, minHeight: x.total ? 4 : 0 }} />
              <span className="text-[10.5px] text-muted-foreground">{x.m}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Recent reconciliations" bodyClassName="p-3 sm:p-4">
        {!reconciled.length ? (
          <EmptyState icon={BadgeCheck} title="Nothing reconciled yet" description="Verified payments appear here." />
        ) : (
          <table className="w-full text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-2 py-2">RRR</th>
                <th className="px-2 py-2">Payer</th>
                <th className="px-2 py-2">Ledger</th>
                <th className="px-2 py-2 text-right">Credited</th>
                <th className="px-2 py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {reconciled.slice(0, 20).map((r) => (
                <tr key={`${r.route}-${r.id}`} className="border-b border-border/60">
                  <td className="px-2 py-2 font-mono">{String(r.payment?.remitaRrr ?? "")}</td>
                  <td className="px-2 py-2">{r.companyName ?? r.applicantName}</td>
                  <td className="px-2 py-2">{String(r.payment?.financeLedgerCode ?? "")}</td>
                  <td className="figure px-2 py-2 text-right">{naira(credited(r))}</td>
                  <td className="px-2 py-2">{formatDate(r.payment?.bankTransactionTimestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  )
}
