"use client"

import * as React from "react"
import { Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { addDoc, collection, doc, updateDoc } from "firebase/firestore"
import { getDownloadURL, ref, uploadBytes } from "firebase/storage"
import {
  ArrowRight,
  Check,
  Home,
  Loader2,
  Paperclip,
  PencilLine,
  Search,
  Upload,
} from "lucide-react"
import { COL, db, storage } from "@/lib/firebase"
import {
  MEETING_STATUS,
  STATUS,
  MEETING_STAGES,
  meetingDecided,
  meetingStageIndex,
  stageIndex,
  stagesFor,
} from "@/lib/workflow"
import {
  applicantMessage,
  awaitingPayment,
  findRecord,
  isEditable,
  meetingMessage,
  type FoundRecord,
} from "@/lib/applicant"
import { formatDate, formatDateTime, naira } from "@/lib/format"
import { toast } from "@/components/ui/toast"
import { ActionButton } from "@/components/dashboard/form-kit"
import { Field, Panel, SectionLabel, StatusPill, TONE } from "@/components/dashboard/kit"
import { cn } from "@/lib/utils"

function StatusPageInner() {
  const params = useSearchParams()
  const [reference, setReference] = React.useState(params.get("id") ?? "")
  const [looking, setLooking] = React.useState(false)
  const [found, setFound] = React.useState<FoundRecord | null>(null)
  const [missing, setMissing] = React.useState(false)
  const [proof, setProof] = React.useState<File | null>(null)
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
      toast.error({
        title: "Lookup failed",
        description: err instanceof Error ? err.message : "Check your connection and try again.",
      })
    } finally {
      setLooking(false)
    }
  }, [])

  React.useEffect(() => {
    const initial = params.get("id")
    if (initial) lookUp(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const uploadProof = async () => {
    if (!proof || !found) return
    setUploading(true)
    const now = new Date().toISOString()

    try {
      const path = `submissions/${found.data.submissionId}/payment-proof-${proof.name.replace(/\s+/g, "-")}`
      const target = ref(storage, path)
      await uploadBytes(target, proof, { contentType: proof.type })
      const url = await getDownloadURL(target)

      // Payment is verified by Finance, not by the upload. The file stays put
      // and only the payment state changes.
      await updateDoc(doc(db, found.collectionName, found.docId), {
        billing: { ...(found.data.billing ?? {}), paymentStatus: "Proof uploaded", paymentProof: url },
        updatedAt: now,
      })

      await addDoc(collection(db, COL.notifications), {
        userId: "finance",
        content: `Payment proof uploaded by ${found.data.applicantName ?? "an applicant"} for ${found.data.submissionId}`,
        type: "info",
        referenceId: found.docId,
        isRead: false,
        createdAt: now,
      })

      toast.success({
        title: "Proof uploaded",
        description: "Finance will confirm your payment and the application will move on.",
        duration: 8000,
      })
      setProof(null)
      await lookUp(found.data.submissionId)
    } catch (err) {
      toast.error({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Check your connection and try again.",
      })
    } finally {
      setUploading(false)
    }
  }

  const data = found?.data
  const isMeeting = found?.kind === "meeting"

  const message = !data
    ? null
    : isMeeting
      ? meetingMessage(data.status)
      : applicantMessage(data.status, (found as { route: "first" | "third" }).route)

  const stages = !found
    ? []
    : isMeeting
      ? MEETING_STAGES
      : stagesFor((found as { route: "first" | "third" }).route)

  const current = !found
    ? -1
    : isMeeting
      ? meetingStageIndex(data?.status)
      : stageIndex((found as { route: "first" | "third" }).route, data?.status)

  const blocked = isMeeting
    ? (data?.status ?? "").toLowerCase() === MEETING_STATUS.declined
    : message?.tone === "stop" || data?.status === STATUS.changesRequested

  const formRoute = isMeeting ? null : (found as { route: "first" | "third" } | null)?.route

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="mx-auto w-full max-w-3xl px-4">
        <header className="mb-6">
          <h1 className="font-display text-[26px] font-semibold text-foreground sm:text-[30px]">
            Track your application
          </h1>
          <p className="mt-1 max-w-[62ch] text-[13.5px] leading-relaxed text-muted-foreground">
            Enter the reference you were given. Applications look like FP-1737… or TP-1737…, meeting
            requests like MR-1737….
          </p>
        </header>

        <Panel bodyClassName="p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && lookUp(reference)}
              placeholder="Your application reference"
              className="flex-1 rounded-lg border border-input bg-card px-3.5 py-2.5 text-[13.5px] font-mono outline-none transition-colors focus:border-ring"
            />
            <ActionButton
              icon={looking ? Loader2 : Search}
              onClick={() => lookUp(reference)}
              disabled={looking || !reference.trim()}
            >
              {looking ? "Checking…" : "Check"}
            </ActionButton>
          </div>

          {missing ? (
            <p className="mt-3 text-[13px] text-[hsl(var(--state-stop))]">
              No application matches that reference. Check for typos — it's case sensitive.
            </p>
          ) : null}
        </Panel>

        {found && data && message ? (
          <div className="mt-4 space-y-4">
            {/* ---- What's happening, in one line ---- */}
            <Panel bodyClassName="p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-[18px] font-semibold text-foreground">
                    {message.headline}
                  </p>
                  <p className="mt-1 max-w-[60ch] text-[13.5px] leading-relaxed text-muted-foreground">
                    {message.body}
                  </p>
                </div>
                <StatusPill status={data.status} />
              </div>

              {/* ---- Where it is ---- */}
              <ol className="mt-5 flex items-stretch gap-1">
                {stages.map((entry, index) => {
                  const done = current > index
                  const active = current === index && !blocked
                  return (
                    <li key={entry.label} className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block h-1 rounded-full",
                          blocked
                            ? "bg-[hsl(var(--state-stop))]/30"
                            : done
                              ? "bg-[hsl(var(--state-clear))]"
                              : active
                                ? "bg-[hsl(var(--state-wait))]"
                                : "bg-border",
                        )}
                      />
                      <p
                        className={cn(
                          "mt-1.5 truncate text-[10.5px] leading-tight",
                          active ? "font-semibold text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {done ? <Check className="mr-0.5 inline h-2.5 w-2.5" aria-hidden /> : null}
                        {entry.label}
                      </p>
                    </li>
                  )
                })}
              </ol>
            </Panel>

            {/* ---- The Director's answer on a meeting request ---- */}
            {isMeeting && meetingDecided(data.status) ? (
              <div
                className={cn(
                  "rounded-xl border p-4 sm:p-5",
                  blocked
                    ? "border-[hsl(var(--state-stop))]/30 bg-[hsl(var(--state-stop-soft))]"
                    : "border-[hsl(var(--state-clear))]/30 bg-[hsl(var(--state-clear-soft))]",
                )}
              >
                <p
                  className={cn(
                    "text-[12.5px] font-semibold",
                    blocked ? "text-[hsl(var(--state-stop))]" : "text-[hsl(var(--state-clear))]",
                  )}
                >
                  The Director&rsquo;s decision
                </p>
                <p className="mt-1.5 text-[14px] leading-relaxed text-foreground">
                  {data.directorComment
                    ? data.directorComment
                    : blocked
                      ? "No further reason was given. Customer Service can tell you more."
                      : "Your request was approved. Customer Service will be in touch to confirm the time."}
                </p>
                {data.responseDate ? (
                  <p className="mt-2 text-[11.5px] text-muted-foreground">
                    Decided {formatDateTime(data.responseDate)}
                  </p>
                ) : null}
              </div>
            ) : null}

            {/* ---- Meeting request details ---- */}
            {isMeeting ? (
              <Panel title="Your request" bodyClassName="p-4 sm:p-5">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Reference" value={data.requestId ?? data.submissionId} mono />
                  <Field label="Submitted" value={formatDateTime(data.createdAt)} />
                  <Field label="Name" value={data.fullName} />
                  <Field label="Organisation" value={data.organization} />
                  <Field label="Email" value={data.email} />
                  <Field label="Phone" value={data.phoneNumber} />
                  <Field label="Preferred date" value={formatDate(data.preferredDate)} />
                  <Field label="Preferred time" value={data.preferredTime} />
                  <Field label="Purpose" value={data.purpose} className="col-span-2" />
                </div>

                {data.supportingDocumentUrl ? (
                  <p className="mt-4 text-[13px] text-muted-foreground">
                    Supporting document attached ·{" "}
                    <a
                      href={String(data.supportingDocumentUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-accent underline-offset-4 hover:underline"
                    >
                      view what you sent
                    </a>
                  </p>
                ) : null}
              </Panel>
            ) : null}

            {/* ---- What you were told to fix ---- */}
            {!isMeeting && data.directorReason && blocked ? (
              <div className="rounded-xl border border-[hsl(var(--state-stop))]/30 bg-[hsl(var(--state-stop-soft))] p-4 sm:p-5">
                <p className="text-[12.5px] font-semibold text-[hsl(var(--state-stop))]">
                  {data.status === STATUS.changesRequested
                    ? "What you need to change"
                    : "Why this was declined"}
                </p>
                <p className="mt-1.5 text-[14px] leading-relaxed text-foreground">
                  {data.directorReason}
                </p>
                {isEditable(data.status) ? (
                  <Link
                    href={`/submissions/${formRoute === "first" ? "first-party" : "third-party"}?id=${data.submissionId}`}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    <PencilLine className="h-4 w-4" />
                    Update and resubmit
                  </Link>
                ) : (
                  <Link
                    href={`/submissions/${formRoute === "first" ? "first-party" : "third-party"}`}
                    className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent underline-offset-4 hover:underline"
                  >
                    File a new application
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            ) : null}

            {/* ---- Invoice and payment ---- */}
            {!isMeeting && data.billing && Object.keys(data.billing).length ? (
              <Panel title="Your invoice" bodyClassName="p-4 sm:p-5">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Invoice number" value={data.billing.invoiceNumber} mono />
                  <Field label="Payment due by" value={formatDate(data.billing.dueDate)} />
                  <Field label="Application fee" value={naira(data.billing.applicationFee)} />
                  <Field label="Processing fee" value={naira(data.billing.processingFee)} />
                  <Field label="Annual fee" value={naira(data.billing.annualFee)} />
                  {Number(data.billing.penaltyFee) > 0 ? (
                    <Field label="Penalty" value={naira(data.billing.penaltyFee)} />
                  ) : null}
                </div>

                <div className="mt-4 flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                  <span className="text-[13px] font-medium text-muted-foreground">Total due</span>
                  <span className="figure text-[22px] font-semibold text-foreground">
                    {naira(data.billing.totalAmount)}
                  </span>
                </div>

                {awaitingPayment(data.status) ? (
                  <div className="mt-4 border-t border-border pt-4">
                    <p className="text-[13px] font-semibold text-foreground">
                      Upload your proof of payment
                    </p>
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
                      A bank teller slip or Remita receipt. Finance confirms it against the invoice
                      before your application moves on.
                    </p>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                      <label
                        htmlFor="payment-proof"
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[13px] font-semibold transition-colors hover:bg-muted"
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                        {proof ? "Change file" : "Choose file"}
                        <input
                          id="payment-proof"
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          className="hidden"
                          onChange={(event) => setProof(event.target.files?.[0] ?? null)}
                        />
                      </label>
                      {proof ? (
                        <span className="truncate text-[12.5px] text-muted-foreground">
                          {proof.name}
                        </span>
                      ) : null}
                      <ActionButton
                        icon={uploading ? Loader2 : Upload}
                        disabled={!proof || uploading}
                        onClick={uploadProof}
                      >
                        {uploading ? "Uploading…" : "Send to Finance"}
                      </ActionButton>
                    </div>
                  </div>
                ) : data.billing.paymentProof ? (
                  <p className="mt-4 border-t border-border pt-4 text-[13px] text-muted-foreground">
                    Proof of payment received.{" "}
                    <a
                      href={String(data.billing.paymentProof)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-accent underline-offset-4 hover:underline"
                    >
                      View what you sent
                    </a>
                  </p>
                ) : null}
              </Panel>
            ) : null}

            {/* ---- Permit ---- */}
            {!isMeeting && data.permitNumber ? (
              <Panel bodyClassName="p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[12.5px] font-medium text-muted-foreground">Permit number</p>
                    <p className="font-display text-[20px] font-semibold text-foreground">
                      {data.permitNumber}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[12.5px] font-medium text-muted-foreground">Valid until</p>
                    <p className={cn("text-[15px] font-semibold", TONE.clear.text)}>
                      {formatDate(data.expiresAt)}
                    </p>
                  </div>
                </div>
              </Panel>
            ) : null}

            {/* ---- What you filed ---- */}
            {!isMeeting ? (
            <Panel title="What you filed" bodyClassName="p-4 sm:p-5">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Reference" value={data.submissionId} mono />
                <Field label="Filed on" value={formatDateTime(data.createdAt)} />
                <Field label="Applicant" value={data.applicantName} />
                <Field label="Phone" value={data.contactPhoneNumber} />
                {data.companyName ? <Field label="Company" value={data.companyName} /> : null}
                {data.practitionerName ? (
                  <Field label="Practitioner" value={data.practitionerName} />
                ) : null}
                <Field label="Structure" value={data.applicationType} />
                <Field label="Purpose" value={data.purposeOfApplication} />
                <Field label="Sign dimensions" value={data.signDimensions} />
                <Field label="Height" value={data.structuralHeight} />
                <Field
                  label="Site"
                  value={[data.addressLine1, data.addressLine2].filter(Boolean).join(", ")}
                  className="col-span-2"
                />
                <Field label="Coordinates" value={data.gpsCoordinates} mono className="col-span-2" />
              </div>

              {data.updatedAt ? (
                <p className="mt-4 text-[12px] text-muted-foreground">
                  Last updated {formatDateTime(data.updatedAt)}
                </p>
              ) : null}

              {isEditable(data.status) && !blocked ? (
                <div className="mt-4 border-t border-border pt-4">
                  <SectionLabel>Need to change something?</SectionLabel>
                  <p className="text-[13px] leading-relaxed text-muted-foreground">
                    Your application hasn't been sent up for a decision yet, so you can still edit it.
                  </p>
                  <Link
                    href={`/submissions/${formRoute === "first" ? "first-party" : "third-party"}?id=${data.submissionId}`}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[13px] font-semibold transition-colors hover:bg-muted"
                  >
                    <PencilLine className="h-4 w-4" />
                    Edit application
                  </Link>
                </div>
              ) : null}
            </Panel>
            ) : null}

            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              <Home className="h-3.5 w-3.5" />
              Back to home
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
