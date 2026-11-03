"use client"

import * as React from "react"
import { CalendarCheck, CreditCard, ExternalLink, FileText, FileUp, Inbox, Loader2, Paperclip, Plus, Send } from "lucide-react"
import { REQUIRED_DOCUMENTS, STATUS, stage } from "@/lib/workflow"
import { ISSUED_META, documentPath, type IssuedKind, type IssuedSummary } from "@/lib/issued-documents"
import { applicantMessage } from "@/lib/applicant"
import { uploadRecordFile } from "@/lib/practitioner-registry"
import { formatDate, formatDateTime, naira, truncate } from "@/lib/format"
import { typeLabel } from "@/lib/tariff"
import { toast } from "@/components/ui/toast"
import { Sheet } from "@/components/dashboard/sheet"
import { ActionButton, NumberField, SearchField, TextField, TextareaField } from "@/components/dashboard/form-kit"
import { EmptyState, Field, LoadFailed, Panel, RowsSkeleton, SectionLabel, StatusPill, TONE } from "@/components/dashboard/kit"
import { Segmented } from "@/components/dashboard/notifications-panel"
import { StageTracker, type SubmissionRow } from "@/components/dashboard/work-queue"
import { AuditTimeline } from "@/components/dashboard/audit-timeline"
import { portalApi, usePortal } from "@/components/auth/portal-context"
import { inProgress, needsPractitioner, usePortalApplications } from "@/components/portal/use-portal-data"
import { cn } from "@/lib/utils"

type Filter = "all" | "action" | "progress" | "approved"

export function ApplicationsPanel({ onNew, focus }: { onNew: () => void; focus?: string | null }) {
  const { rows, loading, error } = usePortalApplications()
  const [filter, setFilter] = React.useState<Filter>("all")
  const [search, setSearch] = React.useState("")
  const [openId, setOpenId] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!focus) return
    const hit = rows.find((r) => r.submissionId === focus || r.id === focus)
    if (hit) setOpenId(hit.id)
  }, [focus, rows])

  const term = search.trim().toLowerCase()
  const visible = rows.filter((r) => {
    const pass =
      filter === "all" ||
      (filter === "action" && needsPractitioner(r)) ||
      (filter === "progress" && inProgress(r)) ||
      (filter === "approved" && stage("issued").includes(r.status ?? ""))
    if (!pass) return false
    return term ? [r.submissionId, r.signageSiteAddress, r.areaCouncil, r.permitNumber].filter(Boolean).some((v) => String(v).toLowerCase().includes(term)) : true
  })
  const current = rows.find((r) => r.id === openId) ?? null

  return (
    <>
      <Panel
        title="My applications"
        description="Every site you have applied for, where it is, and what you need to do next"
        actions={
          <>
            <Segmented
              value={filter}
              onChange={(v) => setFilter(v as Filter)}
              options={[
                { value: "all", label: "All" },
                { value: "action", label: `Your action (${rows.filter(needsPractitioner).length})` },
                { value: "progress", label: "In progress" },
                { value: "approved", label: "Approved" },
              ]}
            />
            <ActionButton icon={Plus} onClick={onNew}>
              New application
            </ActionButton>
          </>
        }
        bodyClassName="p-0"
      >
        <div className="border-b border-border p-3 sm:px-5">
          <SearchField value={search} onChange={setSearch} placeholder="Search by reference, site or permit" />
        </div>
        <div className="p-3 sm:p-4">
          {error ? (
            <LoadFailed error={error} what="Your applications" />
          ) : loading ? (
            <RowsSkeleton rows={4} columns={5} />
          ) : !visible.length ? (
            <EmptyState
              icon={Inbox}
              title={rows.length ? "Nothing matches" : "No applications yet"}
              description="Apply for an announced site from your dashboard, or start a new application."
              action={
                <ActionButton icon={Plus} onClick={onNew}>
                  New application
                </ActionButton>
              }
            />
          ) : (
            <ul className="space-y-2">
              {visible.map((r, i) => {
                const msg = applicantMessage(r.status, "third")
                return (
                  <li key={r.id} style={{ ["--i" as string]: Math.min(i, 8) }} className="reveal">
                    <button
                      type="button"
                      onClick={() => setOpenId(r.id)}
                      className="flex w-full flex-col gap-2 rounded-lg border border-border bg-card px-3.5 py-3 text-left hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-[12px] text-muted-foreground">{r.submissionId}</p>
                        <p className="text-[13.5px] font-semibold text-foreground">{truncate(r.signageSiteAddress, 70)}</p>
                        <p className="text-[12px] text-muted-foreground">
                          {typeLabel(r.applicationType)} · {r.areaCouncil} · filed {formatDate(r.createdAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
                        <StatusPill status={r.status} />
                        <span className={cn("text-[12px] font-medium", needsPractitioner(r) ? TONE.stop.text : "text-muted-foreground")}>{msg.headline}</span>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </Panel>

      {current ? <ApplicationSheet row={current} onClose={() => setOpenId(null)} /> : null}
    </>
  )
}

function ApplicationSheet({ row, onClose }: { row: SubmissionRow; onClose: () => void }) {
  const msg = applicantMessage(row.status, "third")
  const issued = Object.entries(row.issued ?? {}).filter(([, v]) => v?.code) as [IssuedKind, IssuedSummary][]

  return (
    <Sheet open onClose={onClose} title={row.submissionId ?? "Application"} caption={row.signageSiteAddress ?? ""} width="max-w-3xl">
      <div className="space-y-6">
        <StageTracker row={row} />

        <div className={cn("rounded-lg px-4 py-3", TONE[msg.tone].soft)}>
          <p className="text-[13.5px] font-semibold">{msg.headline}</p>
          <p className="mt-0.5 text-[13px] text-foreground">{msg.body}</p>
          {row.directorReason && stage("blocked").includes(row.status ?? "") ? (
            <p className="mt-2 text-[13px] text-foreground">
              <span className="font-semibold">Reason: </span>
              {row.directorReason}
            </p>
          ) : null}
          {row.deskQuery && row.status === STATUS.documentsRequested ? (
            <p className="mt-2 text-[13px] text-foreground">
              <span className="font-semibold">What to correct: </span>
              {row.deskQuery}
            </p>
          ) : null}
        </div>

        {msg.action === "documents" ? <DocumentsUpload row={row} /> : null}
        {msg.action === "pay" ? <BillPayment row={row} /> : null}
        {msg.action === "settingOut" ? <SettingOutRequest row={row} /> : null}

        {issued.length ? (
          <div>
            <SectionLabel>Letters, receipts & certificates</SectionLabel>
            <ul className="space-y-2">
              {issued.map(([kind, d]) => (
                <li key={kind} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3.5 py-2.5">
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-foreground">{ISSUED_META[kind]?.title}</span>
                    <span className="block font-mono text-[11.5px] text-muted-foreground">
                      {d.reference} · {formatDate(d.issuedAt)}
                    </span>
                  </span>
                  <a
                    href={documentPath(d.code)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-semibold text-accent underline-offset-4 hover:underline"
                  >
                    Open / print <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div>
          <SectionLabel>Application</SectionLabel>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Reference" value={row.submissionId} mono />
            <Field label="Filed" value={formatDateTime(row.createdAt)} />
            <Field label="Site" value={row.signageSiteAddress} className="col-span-2" />
            <Field label="Area council" value={row.areaCouncil} />
            <Field label="District" value={row.district} />
            <Field label="Structure" value={typeLabel(row.applicationType)} />
            <Field label="Proposed dimensions" value={row.signDimensions} />
            {row.measurements ? <Field label="Measured area" value={`${row.measurements.totalSqm.toFixed(2)} m²`} /> : null}
            {row.permitNumber ? <Field label="Permit number" value={row.permitNumber} mono /> : null}
            {row.expiresAt ? <Field label="Valid until" value={formatDate(row.expiresAt)} /> : null}
            <Field label="Application fee" value={row.applicationFee ? `${naira(row.applicationFee.amount)} · RRR ${row.applicationFee.rrr}` : "—"} />
          </div>
        </div>

        {row.billing?.netInvoiceAmount !== undefined ? (
          <div>
            <SectionLabel>Bill</SectionLabel>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Invoice" value={String(row.billing.invoiceNumber ?? "")} mono />
              <Field label="Amount" value={<span className="figure text-[16px] font-semibold">{naira(row.billing.netInvoiceAmount as number)}</span>} />
              {row.remita?.rrr ? <Field label="Remita RRR" value={String(row.remita.rrr)} mono /> : null}
              <Field label="Validity" value={`${formatDate(row.billing.subscriptionStartDate)} → ${formatDate(row.billing.subscriptionExpiryDate)}`} />
            </div>
          </div>
        ) : null}

        <div>
          <SectionLabel>Your uploads</SectionLabel>
          <ul className="space-y-1.5">
            {[{ key: "photoMontage", label: "Photo montage" }, ...REQUIRED_DOCUMENTS].map((d) => {
              const url = row.files?.[d.key]
              return (
                <li key={d.key} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-[12.5px]">
                  <span>{d.label}</span>
                  {typeof url === "string" && url ? (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent hover:underline">
                      View
                    </a>
                  ) : (
                    <span className="text-muted-foreground">Not uploaded</span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>

        <AuditTimeline row={row} />
      </div>
    </Sheet>
  )
}

function DocumentsUpload({ row }: { row: SubmissionRow }) {
  const { portal } = usePortal()
  const [urls, setUrls] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(REQUIRED_DOCUMENTS.map((d) => [d.key, typeof row.files?.[d.key] === "string" ? String(row.files?.[d.key]) : ""])),
  )
  const [uploading, setUploading] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  const upload = async (key: string, file?: File) => {
    if (!file || !portal) return
    if (file.size > 20 * 1024 * 1024) {
      toast.warning({ title: "File too large", description: "Keep each document under 20 MB." })
      return
    }
    setUploading(key)
    try {
      const stored = await uploadRecordFile(`portal/${portal.uid}/applications/${row.id}`, key, file)
      setUrls((u) => ({ ...u, [key]: stored.url }))
    } catch (err) {
      toast.error({ title: "Upload failed", description: err instanceof Error ? err.message : "Try again." })
    } finally {
      setUploading(null)
    }
  }

  const send = async () => {
    const missing = REQUIRED_DOCUMENTS.filter((d) => !urls[d.key])
    if (missing.length) {
      toast.warning({ title: "Upload all three documents", description: missing.map((d) => d.label).join(", ") })
      return
    }
    setBusy(true)
    try {
      await portalApi("/api/portal", { action: "documents", docId: row.id, files: urls })
      toast.success({ title: "Documents sent", description: "Customer Service will check them and pass them to the Director." })
    } catch (err) {
      toast.error({ title: "Not sent", description: err instanceof Error ? err.message : "Try again." })
    } finally {
      setBusy(false)
    }
  }

  const letter = row.issued?.documentsRequestLetter

  return (
    <div className="rounded-xl border border-border p-4">
      <SectionLabel>Upload technical documents</SectionLabel>
      {letter ? (
        <p className="mb-3 text-[12.5px] text-muted-foreground">
          Requested by{" "}
          <a href={documentPath(letter.code)} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent underline-offset-4 hover:underline">
            letter {letter.reference}
          </a>
          .
        </p>
      ) : null}
      <ul className="space-y-2">
        {REQUIRED_DOCUMENTS.map((d) => (
          <li key={d.key} className="flex flex-col gap-2 rounded-lg border border-border px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[13.5px] font-medium text-foreground">{d.label} *</p>
              <p className="text-[12px] text-muted-foreground">
                {urls[d.key] ? (
                  <a href={urls[d.key]} target="_blank" rel="noopener noreferrer" className="text-accent underline-offset-4 hover:underline">
                    Uploaded — view
                  </a>
                ) : (
                  "Not uploaded yet"
                )}
              </p>
            </div>
            <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] font-semibold hover:bg-muted">
              {uploading === d.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
              {urls[d.key] ? "Replace" : "Choose file"}
              <input type="file" accept={d.accept} className="hidden" onChange={(e) => upload(d.key, e.target.files?.[0])} />
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex justify-end">
        <ActionButton icon={busy ? Loader2 : FileUp} disabled={busy || Boolean(uploading)} onClick={send}>
          Submit documents to CSU
        </ActionButton>
      </div>
    </div>
  )
}

function BillPayment({ row }: { row: SubmissionRow }) {
  const { portal } = usePortal()
  const balance = Number(row.payment?.balanceDue ?? 0)
  const due = row.status === STATUS.partPayment && balance > 0 ? balance : Number(row.billing?.netInvoiceAmount ?? 0)
  const declared = row.payment?.declared as { rrr?: string; amount?: number; declaredAt?: string } | undefined
  const [rrr, setRrr] = React.useState(String(row.remita?.rrr ?? ""))
  const [amount, setAmount] = React.useState(due)
  const [proof, setProof] = React.useState("")
  const [uploading, setUploading] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const formRef = React.useRef<HTMLFormElement>(null)
  const [pay, setPay] = React.useState<{ action: string; fields: Record<string, string> } | null>(null)

  const openRemita = async () => {
    const clean = rrr.replace(/\D/g, "")
    const res = await fetch("/api/remita/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ purpose: "pay-link", rrr: clean }) })
    const json = await res.json().catch(() => ({}))
    if (!json.pay) {
      window.open("https://remita.net", "_blank", "noopener,noreferrer")
      return
    }
    setPay(json.pay)
    setTimeout(() => formRef.current?.submit(), 50)
  }

  const upload = async (file?: File) => {
    if (!file || !portal) return
    setUploading(true)
    try {
      const stored = await uploadRecordFile(`portal/${portal.uid}/applications/${row.id}`, "bill-receipt", file)
      setProof(stored.url)
    } catch (err) {
      toast.error({ title: "Upload failed", description: err instanceof Error ? err.message : "Try again." })
    } finally {
      setUploading(false)
    }
  }

  const declare = async () => {
    if (rrr.replace(/\D/g, "").length !== 12) {
      toast.warning({ title: "Enter the 12-digit RRR" })
      return
    }
    setBusy(true)
    try {
      await portalApi("/api/portal", { action: "declarePayment", docId: row.id, rrr, amount, proofUrl: proof, channel: "Remita_Portal" })
      toast.success({ title: "Payment declared", description: "Finance will confirm it and issue your e-receipt." })
    } catch (err) {
      toast.error({ title: "Not sent", description: err instanceof Error ? err.message : "Try again." })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-border p-4">
      <SectionLabel>Pay your bill</SectionLabel>
      <div className="mb-3 grid grid-cols-2 gap-3 rounded-lg bg-muted/40 p-3.5 text-[12.5px]">
        <div>
          <p className="text-muted-foreground">Remita RRR from Finance</p>
          <p className="font-mono text-[15px] font-semibold text-foreground">{String(row.remita?.rrr ?? "—")}</p>
        </div>
        <div className="text-right">
          <p className="text-muted-foreground">{row.status === STATUS.partPayment ? "Balance due" : "Amount due"}</p>
          <p className="figure text-[18px] font-semibold text-foreground">{naira(due)}</p>
        </div>
      </div>
      {declared?.rrr ? (
        <p className={cn("mb-3 rounded-lg px-3.5 py-2.5 text-[12.5px]", TONE.move.soft)}>
          You declared {naira(declared.amount)} with RRR {declared.rrr} on {formatDateTime(declared.declaredAt)}. Finance is confirming it.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <ActionButton icon={CreditCard} onClick={openRemita}>
          Pay on Remita <ExternalLink className="h-3 w-3" />
        </ActionButton>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <TextField id="bp-rrr" label="RRR you paid with" mono value={rrr} onChange={setRrr} />
        <NumberField id="bp-amt" label="Amount paid" prefix="₦" value={amount} onChange={setAmount} />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[12.5px] font-semibold hover:bg-muted">
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
          {proof ? "Replace receipt" : "Upload Remita receipt"}
          <input type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
        </label>
        <ActionButton icon={busy ? Loader2 : Send} disabled={busy || uploading} onClick={declare}>
          I have paid — notify Finance
        </ActionButton>
      </div>
      {pay ? (
        <form ref={formRef} action={pay.action} method="POST" target="_blank" className="hidden">
          {Object.entries(pay.fields).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
        </form>
      ) : null}
    </div>
  )
}

function SettingOutRequest({ row }: { row: SubmissionRow }) {
  const { profile } = usePortal()
  const [preferredDate, setDate] = React.useState("")
  const [contactName, setName] = React.useState(profile?.managingDirector ?? "")
  const [contactPhone, setPhone] = React.useState(profile?.phonePrimary ?? "")
  const [note, setNote] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const receipt = row.issued?.eReceipt

  const send = async () => {
    if (!preferredDate) {
      toast.warning({ title: "Choose a preferred date" })
      return
    }
    setBusy(true)
    try {
      await portalApi("/api/portal", { action: "settingOut", docId: row.id, preferredDate, contactName, contactPhone, note })
      toast.success({ title: "Setting out requested", description: "Customer Service will pass it to the Director." })
    } catch (err) {
      toast.error({ title: "Not sent", description: err instanceof Error ? err.message : "Try again." })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-border p-4">
      <SectionLabel>Request setting out</SectionLabel>
      {receipt ? (
        <p className="mb-3 text-[12.5px] text-muted-foreground">
          <FileText className="mr-1 inline h-3.5 w-3.5" />
          Your{" "}
          <a href={documentPath(receipt.code)} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent underline-offset-4 hover:underline">
            e-receipt
          </a>{" "}
          has been issued.
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <TextField id="so-date" label="Preferred date *" type="date" value={preferredDate} onChange={setDate} />
        <TextField id="so-name" label="Site contact" value={contactName} onChange={setName} />
        <TextField id="so-phone" label="Contact phone" type="tel" value={contactPhone} onChange={setPhone} />
      </div>
      <div className="mt-3">
        <TextareaField id="so-note" label="Note (optional)" rows={2} value={note} onChange={setNote} />
      </div>
      <div className="mt-3 flex justify-end">
        <ActionButton icon={busy ? Loader2 : CalendarCheck} disabled={busy} onClick={send}>
          Request setting out
        </ActionButton>
      </div>
    </div>
  )
}
