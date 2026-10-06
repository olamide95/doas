"use client"

import * as React from "react"
import { Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { addDoc, arrayUnion, collection, doc, updateDoc } from "firebase/firestore"
import { getDownloadURL, ref, uploadBytes } from "firebase/storage"
import { ArrowRight, Check, Home, Loader2, Paperclip, PencilLine, Search, Upload } from "lucide-react"
import { COL, db, storage } from "@/lib/firebase"
import { DEPARTMENT, MEETING_STAGES, MEETING_STATUS, STATUS, meetingDecided, meetingStageIndex, stage, stageIndex, stagesFor } from "@/lib/workflow"
import { typeLabel } from "@/lib/tariff"
import { applicantMessage, awaitingPayment, findRecord, isEditable, meetingMessage, type FoundRecord } from "@/lib/applicant"
import { formatDate, formatDateTime, naira } from "@/lib/format"
import { toast } from "@/components/ui/toast"
import { ActionButton, FieldGrid, SelectField, TextField } from "@/components/dashboard/form-kit"
import { Field, Panel, SectionLabel, StatusPill, TONE } from "@/components/dashboard/kit"
import { cn } from "@/lib/utils"

const INVOICE_VISIBLE = [...stage("awaitingPayment"), ...stage("paymentFlagged"), ...stage("paymentReconciled"), ...stage("issued")]

interface BillLineView {
  id: string
  type: string
  sqm: number
  base: number
  surcharge: number
}

function StatusPageInner() {
  const params = useSearchParams()
  const [reference, setReference] = React.useState(params.get("id") ?? "")
  const [looking, setLooking] = React.useState(false)
  const [found, setFound] = React.useState<FoundRecord | null>(null)
  const [missing, setMissing] = React.useState(false)
  const [proof, setProof] = React.useState<File | null>(null)
  const [rrr, setRrr] = React.useState("")
  const [amount, setAmount] = React.useState("")
  const [channel, setChannel] = React.useState("Remita_Portal")
  const [uploading, setUploading] = React.useState(false)

  const lookUp = React.useCallback(async (value: string) => {
    if (!value.trim()) return
    setLooking(true)
    setMissing(false)
    try {
      const result = await findRecord(value)
      setFound(result)
      setMissing(!result)
    } catch (err) {
      toast.error({ title: "Lookup failed", description: err instanceof Error ? err.message : "Try again." })
    } finally {
      setLooking(false)
    }
  }, [])

  React.useEffect(() => {
    const initial = params.get("id")
    if (initial) lookUp(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const declare = async () => {
    if (!found || found.kind !== "application") return
    const digits = rrr.replace(/\D/g, "")
    if (digits.length !== 12) return toast.warning({ title: "Check the RRR", description: "A Remita RRR is 12 digits." })
    if (!(Number(amount) > 0)) return toast.warning({ title: "Enter the amount paid" })
    if (!proof) return toast.warning({ title: "Attach your receipt" })

    setUploading(true)
    const now = new Date().toISOString()
    try {
      const target = ref(storage, `submissions/${found.data.submissionId}/payment-proof-${Date.now()}-${proof.name.replace(/\s+/g, "-")}`)
      await uploadBytes(target, proof, { contentType: proof.type })
      const url = await getDownloadURL(target)

      // Only the declaration is written here — Finance verifies it.
      await updateDoc(doc(db, found.collectionName, found.docId), {
        "payment.declared": { rrr: digits, amount: Number(amount), channel, proofUrl: url, declaredAt: now },
        updatedAt: now,
        comments: arrayUnion({ timestamp: now, desk: "applicant", action: `Payment proof uploaded (RRR ${digits})`, to: DEPARTMENT.finance }),
      })
      await addDoc(collection(db, COL.notifications), {
        userId: "finance",
        content: `Payment proof (RRR ${digits}, ${naira(Number(amount))}) uploaded for ${found.data.submissionId}`,
        type: "info",
        referenceId: found.docId,
        isRead: false,
        createdAt: now,
      })
      toast.success({ title: "Proof sent to Finance", description: "They'll verify it against the bank record." })
      setProof(null)
      await lookUp(found.data.submissionId)
    } catch (err) {
      toast.error({ title: "Upload failed", description: err instanceof Error ? err.message : "Try again." })
    } finally {
      setUploading(false)
    }
  }

  const data = found?.data
  const isMeeting = found?.kind === "meeting"
  const route = found?.kind === "application" ? found.route : "first"
  const message = !data ? null : isMeeting ? meetingMessage(data.status) : applicantMessage(data.status, route)
  const stages: { label: string }[] = !found ? [] : isMeeting ? MEETING_STAGES : stagesFor(route)
  const current = !found ? -1 : isMeeting ? meetingStageIndex(data?.status) : stageIndex(route, data?.status)
  const blocked = isMeeting
    ? (data?.status ?? "").toLowerCase() === MEETING_STATUS.declined
    : message?.tone === "stop" && data?.status !== STATUS.partPayment && data?.status !== STATUS.paymentFlagged
  const billing = data?.billing ?? {}
  const payment = data?.payment ?? {}
  const formPath = route === "first" ? "first-party" : "third-party"

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="mx-auto w-full max-w-3xl px-4">
        <header className="mb-6">
          <h1 className="font-display text-[26px] font-semibold text-foreground sm:text-[30px]">Track your application</h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground">Applications look like FP-… or TP-…, meeting requests like MR-….</p>
        </header>

        <Panel bodyClassName="p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && lookUp(reference)}
              placeholder="Your reference"
              className="flex-1 rounded-lg border border-input bg-card px-3.5 py-2.5 font-mono text-[13.5px] outline-none focus:border-ring"
            />
            <ActionButton icon={looking ? Loader2 : Search} onClick={() => lookUp(reference)} disabled={looking || !reference.trim()}>
              {looking ? "Checking…" : "Check"}
            </ActionButton>
          </div>
          {missing ? <p className="mt-3 text-[13px] text-[hsl(var(--state-stop))]">No record matches that reference. It&rsquo;s case sensitive.</p> : null}
        </Panel>

        {found && data && message ? (
          <div className="mt-4 space-y-4">
            <Panel bodyClassName="p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-[18px] font-semibold text-foreground">{message.headline}</p>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">{message.body}</p>
                </div>
                <StatusPill status={data.status} />
              </div>
              <ol className="mt-5 flex items-stretch gap-1">
                {stages.map((entry, index) => {
                  const done = current > index
                  const active = current === index && !blocked
                  return (
                    <li key={`${entry.label}-${index}`} className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block h-1 rounded-full",
                          blocked ? "bg-[hsl(var(--state-stop))]/30" : done ? "bg-[hsl(var(--state-clear))]" : active ? "bg-[hsl(var(--state-wait))]" : "bg-border",
                        )}
                      />
                      <p className={cn("mt-1.5 truncate text-[10.5px]", active ? "font-semibold text-foreground" : "text-muted-foreground")}>
                        {done ? <Check className="mr-0.5 inline h-2.5 w-2.5" /> : null}
                        {entry.label}
                      </p>
                    </li>
                  )
                })}
              </ol>
            </Panel>

            {isMeeting ? (
              <Panel title="Your request" bodyClassName="p-4 sm:p-5">
                {meetingDecided(data.status) ? (
                  <p className="mb-4 rounded-lg bg-muted/50 px-3.5 py-3 text-[13.5px] text-foreground">
                    <span className="font-semibold">The Director&rsquo;s decision: </span>
                    {data.directorComment || (blocked ? "No reason given — contact Customer Service." : "Approved. Customer Service will confirm the time.")}
                  </p>
                ) : null}
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Reference" value={data.requestId ?? data.submissionId} mono />
                  <Field label="Submitted" value={formatDateTime(data.createdAt)} />
                  <Field label="Name" value={data.fullName} />
                  <Field label="Organisation" value={data.organization} />
                  <Field label="Preferred date" value={formatDate(data.preferredDate)} />
                  <Field label="Preferred time" value={data.preferredTime} />
                  <Field label="Purpose" value={data.purpose} className="col-span-2" />
                </div>
              </Panel>
            ) : null}

            {!isMeeting && data.directorReason && blocked ? (
              <div className="rounded-xl border border-[hsl(var(--state-stop))]/30 bg-[hsl(var(--state-stop-soft))] p-4 sm:p-5">
                <p className="text-[12.5px] font-semibold text-[hsl(var(--state-stop))]">
                  {data.status === STATUS.changesRequested ? "What you need to change" : "Why this was declined"}
                </p>
                <p className="mt-1.5 text-[14px] text-foreground">{data.directorReason}</p>
                <Link
                  href={isEditable(data.status) ? `/submissions/${formPath}?id=${data.submissionId}` : `/submissions/${formPath}`}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[13px] font-semibold text-primary-foreground"
                >
                  {isEditable(data.status) ? (
                    <>
                      <PencilLine className="h-4 w-4" /> Update and resubmit
                    </>
                  ) : (
                    <>
                      File a new application <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </Link>
              </div>
            ) : null}

            {!isMeeting && INVOICE_VISIBLE.includes(data.status) && (billing.netInvoiceAmount !== undefined || billing.totalAmount !== undefined) ? (
              <Panel title="Your invoice" bodyClassName="p-4 sm:p-5">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Invoice number" value={billing.invoiceNumber} mono />
                  <Field label="Billing cycle" value={String(billing.billingCycleType ?? "Annual").replace(/_/g, " ")} />
                  <Field label="Total measured area" value={billing.totalSqm ? `${Number(billing.totalSqm).toFixed(2)} m²` : "—"} />
                  <Field label="Permit validity" value={billing.subscriptionStartDate ? `${formatDate(billing.subscriptionStartDate)} → ${formatDate(billing.subscriptionExpiryDate)}` : "—"} />
                </div>
                {Array.isArray(billing.lines) ? (
                  <table className="mt-4 w-full text-left text-[12.5px]">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="py-1.5">Sign</th>
                        <th className="py-1.5 text-right">Area</th>
                        <th className="py-1.5 text-right">Charge</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(billing.lines as BillLineView[]).map((l) => (
                        <tr key={l.id} className="border-b border-border/60">
                          <td className="py-1.5">
                            {l.id} {typeLabel(l.type)}
                          </td>
                          <td className="py-1.5 text-right">{l.sqm.toFixed(2)} m²</td>
                          <td className="py-1.5 text-right">{naira(l.base + l.surcharge)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
                {billing.invoiceNarration ? <p className="mt-3 text-[12.5px] text-muted-foreground">{billing.invoiceNarration}</p> : null}
                <div className="mt-4 flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                  <span className="text-[13px] font-medium text-muted-foreground">Total due</span>
                  <span className="figure text-[22px] font-semibold text-foreground">{naira(billing.netInvoiceAmount ?? billing.totalAmount)}</span>
                </div>

                {data.status === STATUS.partPayment ? (
                  <p className="mt-3 rounded-lg bg-[hsl(var(--state-stop-soft))] px-3.5 py-2.5 text-[13px] text-[hsl(var(--state-stop))]">
                    Finance recorded {naira(payment.amountCredited)}. Balance outstanding: <strong>{naira(payment.balanceDue)}</strong>.
                  </p>
                ) : null}

                {awaitingPayment(data.status) ? (
                  <div className="mt-4 border-t border-border pt-4">
                    <SectionLabel>Declare your payment</SectionLabel>
                    {payment.declared ? (
                      <p className="mb-3 text-[12.5px] text-muted-foreground">
                        Last declared: RRR {payment.declared.rrr} · {naira(payment.declared.amount)} · {formatDateTime(payment.declared.declaredAt)}. Upload again only for a new payment.
                      </p>
                    ) : null}
                    <FieldGrid columns={3}>
                      <TextField id="rrr" label="Remita RRR" mono value={rrr} placeholder="2209-1108-4432" onChange={setRrr} />
                      <TextField id="amt" label="Amount paid (₦)" value={amount} onChange={setAmount} />
                      <SelectField
                        id="channel"
                        label="Paid via"
                        value={channel}
                        onChange={setChannel}
                        options={[
                          { value: "Remita_Portal", label: "Remita portal" },
                          { value: "Bank_Branch", label: "Bank branch" },
                          { value: "FCTA_Direct_Settlement", label: "FCTA direct settlement" },
                        ]}
                      />
                    </FieldGrid>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[13px] font-semibold hover:bg-muted">
                        <Paperclip className="h-3.5 w-3.5" />
                        {proof ? "Change receipt" : "Attach receipt"}
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => setProof(e.target.files?.[0] ?? null)} />
                      </label>
                      {proof ? <span className="truncate text-[12.5px] text-muted-foreground">{proof.name}</span> : null}
                      <ActionButton icon={uploading ? Loader2 : Upload} disabled={uploading} onClick={declare}>
                        {uploading ? "Sending…" : "Send to Finance"}
                      </ActionButton>
                    </div>
                  </div>
                ) : null}
              </Panel>
            ) : null}

            {!isMeeting && data.permitNumber ? (
              <Panel bodyClassName="p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[12.5px] text-muted-foreground">Permit number</p>
                    <p className="font-display text-[18px] font-semibold text-foreground">{data.permitNumber}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[12.5px] text-muted-foreground">Valid</p>
                    <p className={cn("text-[15px] font-semibold", TONE.clear.text)}>
                      {formatDate(data.startsAt ?? data.approvedAt)} → {formatDate(data.expiresAt)}
                    </p>
                  </div>
                </div>
              </Panel>
            ) : null}

            {!isMeeting ? (
              <Panel title="What you filed" bodyClassName="p-4 sm:p-5">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Reference" value={data.submissionId} mono />
                  <Field label="Filed on" value={formatDateTime(data.createdAt)} />
                  <Field label="Organisation" value={data.companyName ?? data.applicantName} />
                  <Field label="Applicant type" value={data.applicantType} />
                  <Field label="CAC" value={data.cacRegistrationNumber ?? data.companyRegistrationNumber} mono />
                  <Field label="Contact" value={data.primaryContactName} />
                  <Field label="Phone" value={data.primaryContactPhone ?? data.contactPhoneNumber} />
                  <Field label="Area council" value={data.areaCouncil} />
                  <Field label="Structure" value={typeLabel(data.applicationType)} />
                  <Field label="Declared dimensions" value={data.signDimensions} />
                  <Field label="Site" value={data.signageSiteAddress ?? data.addressLine1} className="col-span-2" />
                </div>
                {isEditable(data.status) && !blocked ? (
                  <Link
                    href={`/submissions/${formPath}?id=${data.submissionId}`}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[13px] font-semibold hover:bg-muted"
                  >
                    <PencilLine className="h-4 w-4" /> Edit application
                  </Link>
                ) : null}
              </Panel>
            ) : null}

            <Link href="/" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
              <Home className="h-3.5 w-3.5" /> Back to home
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default function SubmissionStatusPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <StatusPageInner />
    </Suspense>
  )
}
