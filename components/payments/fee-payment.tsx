"use client"

import * as React from "react"
import { CheckCircle2, CreditCard, ExternalLink, Loader2, Paperclip, Radar, Zap } from "lucide-react"
import { auth } from "@/lib/firebase"
import { applicationFeeFor } from "@/lib/workflow"
import { uploadRecordFile } from "@/lib/practitioner-registry"
import { naira } from "@/lib/format"
import { toast } from "@/components/ui/toast"
import { ActionButton, TextField } from "@/components/dashboard/form-kit"
import { TONE } from "@/components/dashboard/kit"
import { cn } from "@/lib/utils"

/**
 * Application fee through Remita — ₦2,500 first party, ₦100,000 third party.
 * The applicant either generates an RRR here (when the Remita API is
 * configured) and pays on Remita's page, or pays on remita.net and types the
 * RRR. Either way the RRR is checked against Remita before submission; if the
 * API isn't configured the receipt upload is required and CSU confirms it.
 */

export interface FeeState {
  rrr: string
  receiptUrl: string
  verified: boolean
  verifiedAmount: number | null
  configured: boolean | null
  message: string
}

export const EMPTY_FEE: FeeState = { rrr: "", receiptUrl: "", verified: false, verifiedAmount: null, configured: null, message: "" }

const digits = (v: string) => v.replace(/\D/g, "")

export function feeReady(fee: FeeState) {
  if (digits(fee.rrr).length !== 12) return false
  if (fee.configured) return fee.verified
  return fee.verified || Boolean(fee.receiptUrl)
}

interface PayForm {
  action: string
  fields: Record<string, string>
}

async function authHeader(): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken().catch(() => undefined)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function FeePayment({
  route,
  value,
  onChange,
  payer,
  uploadFolder,
}: {
  route: "first" | "third"
  value: FeeState
  onChange: (next: FeeState) => void
  payer?: { name: string; email: string; phone: string }
  uploadFolder: string
}) {
  const amount = applicationFeeFor(route)
  const [generating, setGenerating] = React.useState(false)
  const [checking, setChecking] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)
  const [pay, setPay] = React.useState<PayForm | null>(null)
  const formRef = React.useRef<HTMLFormElement>(null)

  const set = (patch: Partial<FeeState>) => onChange({ ...value, ...patch })

  const generate = async () => {
    if (route === "first" && (!payer?.name || !payer?.email)) {
      toast.warning({ title: "Fill in the organisation step first", description: "Remita needs the payer's name and email." })
      return
    }
    setGenerating(true)
    try {
      const res = await fetch("/api/remita/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ purpose: "application-fee", route, payerName: payer?.name, payerEmail: payer?.email, payerPhone: payer?.phone }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Remita request failed")
      if (!json.configured) {
        set({ configured: false, message: "Online RRR generation isn't available. Pay the fee on remita.net, then enter the RRR and upload the receipt." })
        return
      }
      if (!json.rrr) throw new Error(json.message ?? "Remita did not return an RRR")
      set({ rrr: json.rrr, configured: true, verified: false, message: `RRR ${json.rrr} created for ${naira(amount)}. Pay it, then check the payment.` })
      setPay(json.pay ?? null)
    } catch (err) {
      toast.error({ title: "Could not create the RRR", description: err instanceof Error ? err.message : "Try again." })
    } finally {
      setGenerating(false)
    }
  }

  const openPayment = async () => {
    let form = pay
    if (!form && digits(value.rrr).length === 12) {
      const res = await fetch("/api/remita/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "pay-link", rrr: digits(value.rrr) }),
      })
      const json = await res.json().catch(() => ({}))
      form = json.pay ?? null
      setPay(form)
    }
    if (!form) {
      window.open("https://remita.net", "_blank", "noopener,noreferrer")
      return
    }
    // Let React render the hidden form, then submit it into a new tab.
    setTimeout(() => formRef.current?.submit(), 0)
  }

  const check = async () => {
    const rrr = digits(value.rrr)
    if (rrr.length !== 12) {
      toast.warning({ title: "RRR must be 12 digits" })
      return
    }
    setChecking(true)
    try {
      const res = await fetch(`/api/remita/verify?rrr=${rrr}`)
      const json = await res.json()
      if (!json.configured) {
        set({ rrr, configured: false, verified: false, message: "Remita can't be checked from here right now. Upload your Remita receipt — Customer Service will confirm it." })
        return
      }
      const enough = (json.amount ?? 0) + 0.5 >= amount
      set({
        rrr,
        configured: true,
        verified: Boolean(json.paid && enough),
        verifiedAmount: json.amount ?? null,
        message: json.paid
          ? enough
            ? `Payment confirmed: ${naira(json.amount)}.`
            : `RRR paid for ${naira(json.amount)}, but the fee is ${naira(amount)}.`
          : `Not paid yet${json.message ? ` (${json.message})` : ""}. Complete the payment and check again.`,
      })
    } catch (err) {
      toast.error({ title: "Check failed", description: err instanceof Error ? err.message : "Try again." })
    } finally {
      setChecking(false)
    }
  }

  const upload = async (file?: File) => {
    if (!file) return
    if (!["application/pdf", "image/png", "image/jpeg"].includes(file.type) || file.size > 10 * 1024 * 1024) {
      toast.warning({ title: "Use a PDF, PNG or JPG under 10 MB" })
      return
    }
    setUploading(true)
    try {
      const stored = await uploadRecordFile(uploadFolder, "application-fee-receipt", file)
      set({ receiptUrl: stored.url })
    } catch (err) {
      toast.error({ title: "Upload failed", description: err instanceof Error ? err.message : "Try again." })
    } finally {
      setUploading(false)
    }
  }

  const tone = value.verified ? TONE.clear.soft : value.message ? (value.configured === false ? "bg-muted text-muted-foreground" : TONE.wait.soft) : ""

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/50 px-4 py-3.5">
        <div>
          <p className="text-[12.5px] text-muted-foreground">{route === "first" ? "First-party" : "Third-party"} application fee</p>
          <p className="figure text-[22px] font-semibold text-foreground">{naira(amount)}</p>
        </div>
        <p className="max-w-[40ch] text-[12.5px] text-muted-foreground">Paid through Remita before the application can be submitted. Non-refundable.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <ActionButton icon={generating ? Loader2 : Zap} disabled={generating || value.verified} onClick={generate}>
          Generate Remita RRR
        </ActionButton>
        <ActionButton tone="quiet" icon={CreditCard} disabled={value.verified} onClick={openPayment}>
          {digits(value.rrr).length === 12 ? "Pay this RRR on Remita" : "Open Remita"} <ExternalLink className="h-3 w-3" />
        </ActionButton>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <TextField
            id="fee-rrr"
            label="Remita retrieval reference (RRR)"
            mono
            value={value.rrr}
            placeholder="12 digits"
            onChange={(v) => set({ rrr: v, verified: false, verifiedAmount: null })}
          />
        </div>
        <ActionButton tone="quiet" icon={checking ? Loader2 : Radar} disabled={checking} onClick={check}>
          Check payment
        </ActionButton>
      </div>

      <div>
        <p className="mb-1.5 text-[12.5px] font-medium text-foreground">Remita receipt {value.configured === false ? "*" : "(optional)"}</p>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[12.5px] font-semibold hover:bg-muted">
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
          {value.receiptUrl ? "Replace receipt" : "Upload receipt"}
          <input type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
        </label>
        {value.receiptUrl ? (
          <a href={value.receiptUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-[12px] text-accent underline-offset-4 hover:underline">
            view
          </a>
        ) : null}
      </div>

      {value.message ? (
        <p className={cn("flex items-start gap-2 rounded-lg px-3.5 py-2.5 text-[12.5px]", tone)}>
          {value.verified ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : null}
          {value.message}
        </p>
      ) : null}

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
