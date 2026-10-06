"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { addDoc, arrayUnion, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore"
import { getDownloadURL, ref, uploadBytes } from "firebase/storage"
import { AlertTriangle, ChevronLeft, ChevronRight, FileText, Loader2, Paperclip, Send } from "lucide-react"
import { COL, db, storage } from "@/lib/firebase"
import { AREA_COUNCILS, DEPARTMENT, STATUS } from "@/lib/workflow"
import { SIGN_TYPES, STRUCTURE_TYPES } from "@/lib/tariff"
import { findSubmission, isEditable } from "@/lib/applicant"
import { toast } from "@/components/ui/toast"
import { ActionButton, FieldGrid, SelectField, TextField, TextareaField } from "@/components/dashboard/form-kit"
import { Panel, StatusPill } from "@/components/dashboard/kit"
import { cn } from "@/lib/utils"

type FieldKind = "text" | "tel" | "email" | "number" | "select" | "textarea"
type Check = "email" | "ngPhone" | "cac" | "tin" | "positiveInt"

interface FieldDef {
  name: string
  label: string
  kind: FieldKind
  required?: boolean
  placeholder?: string
  hint?: string
  options?: { value: string; label: string }[]
  span?: boolean
  mono?: boolean
  check?: Check
}

interface DocDef {
  name: string
  label: string
  accept: string
  required?: boolean
}

export interface FormStep {
  id: string
  title: string
  fields?: FieldDef[]
  documents?: DocDef[]
}

const opts = (list: string[]) => list.map((v) => ({ value: v, label: v }))

const CHECKS: Record<Check, { test: (v: string) => boolean; message: string }> = {
  email: { test: (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), message: "Enter a valid email address" },
  ngPhone: { test: (v) => /^(\+?234|0)[789][01]\d{8}$/.test(v.replace(/[\s-]/g, "")), message: "Use a Nigerian number, e.g. 0803 000 0000 or +234 803 000 0000" },
  cac: { test: (v) => /^(RC|BN)-?\d{4,8}$/i.test(v.trim()), message: "Format RC-XXXXXX or BN-XXXXXX" },
  tin: { test: (v) => /^\d{10,12}$/.test(v.replace(/[\s-]/g, "")), message: "TIN is 10–12 digits" },
  positiveInt: { test: (v) => /^\d+$/.test(v) && Number(v) > 0, message: "Enter a whole number above zero" },
}

const ORGANISATION_FIELDS: FieldDef[] = [
  { name: "companyName", label: "Company name", kind: "text", required: true },
  { name: "cacRegistrationNumber", label: "CAC registration number", kind: "text", required: true, mono: true, placeholder: "RC-123456", check: "cac" },
  { name: "tin", label: "Tax identification number (TIN)", kind: "text", required: true, mono: true, placeholder: "10–12 digits", check: "tin" },
  { name: "corporateAddress", label: "Corporate address", kind: "textarea", required: true, span: true },
  { name: "primaryContactName", label: "Primary contact name", kind: "text", required: true },
  { name: "primaryContactPhone", label: "Primary contact phone", kind: "tel", required: true, placeholder: "0803 000 0000", check: "ngPhone" },
  { name: "primaryContactEmail", label: "Primary contact email", kind: "email", required: true, check: "email" },
]

const SITE_FIELDS = (route: "first" | "third"): FieldDef[] => [
  { name: "signageSiteAddress", label: "Signage site address", kind: "textarea", required: true, span: true },
  { name: "areaCouncil", label: "Area council", kind: "select", required: true, options: opts(AREA_COUNCILS) },
  { name: "gpsCoordinates", label: "GPS coordinates", kind: "text", mono: true, placeholder: "9.0765, 7.3986", hint: "Optional. The inspecting officer records exact coordinates on site." },
  { name: "purposeOfApplication", label: "Purpose", kind: "select", required: true, options: opts(["New Sign", "Upgrading of Existing Sign", "Change of Existing Sign"]) },
  { name: "applicationType", label: route === "first" ? "Main sign type" : "Structure type", kind: "select", required: true, options: route === "first" ? SIGN_TYPES : STRUCTURE_TYPES },
  { name: "numberOfSigns", label: "Number of signs", kind: "number", required: true, check: "positiveInt" },
  { name: "signDimensions", label: "Declared dimensions", kind: "text", required: true, placeholder: "4m × 6m", hint: "Verified and locked by the field desk." },
]

const PRACTITIONER_FIELDS: FieldDef[] = [
  { name: "practitionerName", label: "Practitioner name", kind: "text", required: true },
  { name: "practitionerLicenseNumber", label: "DOAS licence number", kind: "text", required: true, mono: true },
]

const COMMON_DOCS: DocDef[] = [
  { name: "cacCertificate", label: "CAC certificate (PDF)", accept: ".pdf", required: true },
  { name: "applicationLetter", label: "Application letter (PDF)", accept: ".pdf", required: true },
  { name: "siteLayoutPlan", label: "Site layout plan (PDF or JPEG)", accept: ".pdf,.jpg,.jpeg", required: true },
]

export const FIRST_PARTY_STEPS: FormStep[] = [
  { id: "organisation", title: "Organisation", fields: ORGANISATION_FIELDS },
  { id: "site", title: "Signage site", fields: SITE_FIELDS("first") },
  { id: "documents", title: "Documents", documents: COMMON_DOCS },
]

export const THIRD_PARTY_STEPS: FormStep[] = [
  { id: "organisation", title: "Client organisation", fields: ORGANISATION_FIELDS },
  { id: "site", title: "Billboard site", fields: SITE_FIELDS("third") },
  { id: "practitioner", title: "Practitioner", fields: PRACTITIONER_FIELDS },
  {
    id: "documents",
    title: "Documents",
    documents: [
      ...COMMON_DOCS,
      { name: "practitionerLicense", label: "Practitioner licence", accept: ".pdf,.jpg,.jpeg,.png", required: true },
      { name: "structuralDrawings", label: "Structural drawings (optional)", accept: ".pdf,.dwg,.dxf" },
    ],
  },
]

function reference(route: "first" | "third") {
  return `${route === "first" ? "FP" : "TP"}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

export function ApplicationForm({ route, steps, title, intro }: { route: "first" | "third"; steps: FormStep[]; title: string; intro: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const editingRef = params.get("id")

  const [stepIndex, setStepIndex] = React.useState(0)
  const [values, setValues] = React.useState<Record<string, string>>({})
  const [files, setFiles] = React.useState<Record<string, File | null>>({})
  const [existingUrls, setExistingUrls] = React.useState<Record<string, string>>({})
  const [existing, setExisting] = React.useState<Awaited<ReturnType<typeof findSubmission>>>(null)
  const [loading, setLoading] = React.useState(Boolean(editingRef))
  const [submitting, setSubmitting] = React.useState(false)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  const allFields = React.useMemo(() => steps.flatMap((s) => s.fields ?? []), [steps])

  React.useEffect(() => {
    if (!editingRef) return
    let cancelled = false
    findSubmission(editingRef)
      .then((found) => {
        if (cancelled) return
        if (!found) {
          toast.error({ title: "Application not found", description: `No application matches ${editingRef}.` })
          setLoading(false)
          return
        }
        if (!isEditable(found.data.status)) {
          toast.warning({ title: "This application can't be edited", description: "It has moved past screening." })
          router.push(`/submission-status?id=${editingRef}`)
          return
        }
        setExisting(found)
        const loaded: Record<string, string> = {}
        allFields.forEach((f) => (loaded[f.name] = String(found.data[f.name] ?? "")))
        setValues(loaded)
        setExistingUrls(found.data.files ?? {})
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingRef])

  const set = (name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => {
      if (!prev[name]) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
  }

  const validateStep = (index: number) => {
    const found: Record<string, string> = {}
    ;(steps[index].fields ?? []).forEach((f) => {
      const v = (values[f.name] ?? "").trim()
      if (f.required && !v) found[f.name] = "Required"
      else if (v && f.check && !CHECKS[f.check].test(v)) found[f.name] = CHECKS[f.check].message
    })
    ;(steps[index].documents ?? []).forEach((d) => {
      if (d.required && !files[d.name] && !existingUrls[d.name]) found[d.name] = "This document is required"
    })
    setErrors(found)
    if (Object.keys(found).length) {
      toast.warning({ title: "Some fields need attention", description: "Fix the highlighted items before continuing." })
      return false
    }
    return true
  }

  const uploadDocs = async (submissionRef: string) => {
    const urls: Record<string, string> = { ...existingUrls }
    for (const [key, file] of Object.entries(files)) {
      if (!file) continue
      const target = ref(storage, `submissions/${submissionRef}/${key}-${file.name.replace(/\s+/g, "-")}`)
      await uploadBytes(target, file, { contentType: file.type })
      urls[key] = await getDownloadURL(target)
    }
    return urls
  }

  const submit = async () => {
    for (let i = 0; i < steps.length; i += 1) {
      if (!validateStep(i)) {
        setStepIndex(i)
        return
      }
    }
    setSubmitting(true)
    const submissionId = existing?.data.submissionId ?? reference(route)
    const now = new Date().toISOString()

    try {
      const fileUrls = await uploadDocs(submissionId)
      const clean = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()]))
      const cac = (clean.cacRegistrationNumber ?? "").toUpperCase()
      const payload: Record<string, unknown> = {
        ...clean,
        cacRegistrationNumber: cac,
        tin: (clean.tin ?? "").replace(/\D/g, ""),
        applicantType: route === "first" ? "First-Party" : "Third-Party Agency",
        // Legacy aliases — the register, search and notifications read these.
        applicantName: clean.companyName,
        email: clean.primaryContactEmail,
        contactPhoneNumber: clean.primaryContactPhone,
        addressLine1: clean.signageSiteAddress,
        companyAddress: clean.corporateAddress,
        companyRegistrationNumber: cac,
        submissionId,
        isFirstParty: route === "first",
        status: STATUS.withCsu,
        department: DEPARTMENT.csu,
        files: fileUrls,
        updatedAt: now,
      }

      if (existing) {
        await updateDoc(doc(db, existing.collectionName, existing.docId), {
          ...payload,
          directorReason: "",
          resubmittedAt: now,
          comments: arrayUnion({ timestamp: now, desk: "applicant", action: "Updated and resubmitted by applicant", to: DEPARTMENT.csu, status: STATUS.withCsu }),
        })
      } else {
        await addDoc(collection(db, route === "first" ? COL.firstParty : COL.thirdParty), {
          ...payload,
          createdAt: serverTimestamp(),
          comments: [{ timestamp: now, desk: "applicant", action: "File opened via portal upload", to: DEPARTMENT.csu, status: STATUS.withCsu }],
        })
      }

      await addDoc(collection(db, COL.notifications), {
        userId: "csu",
        content: existing ? `${clean.companyName} has updated application ${submissionId}` : `New ${route === "first" ? "first-party" : "third-party"} application from ${clean.companyName}`,
        type: "submission",
        referenceId: submissionId,
        isRead: false,
        createdAt: now,
      })

      toast.success({ title: existing ? "Application updated" : "Application submitted", description: `Keep your reference: ${submissionId}`, duration: 9000 })
      router.push(`/submission-status?id=${submissionId}`)
    } catch (err) {
      toast.error({ title: "Submission failed", description: err instanceof Error ? err.message : "Check your connection and try again." })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const step = steps[stepIndex]
  const last = stepIndex === steps.length - 1

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="mx-auto w-full max-w-3xl px-4">
        <header className="mb-6">
          <h1 className="font-display text-[26px] font-semibold text-foreground sm:text-[30px]">{title}</h1>
          <p className="mt-1 max-w-[62ch] text-[13.5px] leading-relaxed text-muted-foreground">{intro}</p>
        </header>

        {existing ? (
          <div className="mb-5 rounded-xl border border-[hsl(var(--state-wait))]/35 bg-[hsl(var(--state-wait-soft))] p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--state-wait))]" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[13.5px] font-semibold text-foreground">Editing {existing.data.submissionId}</p>
                  <StatusPill status={existing.data.status} />
                </div>
                {existing.data.directorReason ? (
                  <p className="mt-2 text-[13px] leading-relaxed text-foreground">
                    <span className="font-semibold">What to change: </span>
                    {existing.data.directorReason}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <ol className="mb-5 flex items-stretch gap-1">
          {steps.map((entry, index) => (
            <li key={entry.id} className="min-w-0 flex-1">
              <button type="button" onClick={() => index < stepIndex && setStepIndex(index)} className="w-full text-left" disabled={index > stepIndex}>
                <span className={cn("block h-1 rounded-full", index < stepIndex ? "bg-[hsl(var(--state-clear))]" : index === stepIndex ? "bg-[hsl(var(--state-wait))]" : "bg-border")} />
                <span className={cn("mt-1.5 block truncate text-[11px]", index === stepIndex ? "font-semibold text-foreground" : "text-muted-foreground")}>{entry.title}</span>
              </button>
            </li>
          ))}
        </ol>

        <Panel title={step.title} bodyClassName="p-4 sm:p-5">
          {step.fields ? (
            <FieldGrid>
              {step.fields.map((f) => {
                const label = f.required ? `${f.label} *` : f.label
                const value = values[f.name] ?? ""
                return (
                  <div key={f.name} className={cn(f.span && "sm:col-span-2")}>
                    {f.kind === "select" ? (
                      <SelectField id={f.name} label={label} value={value} onChange={(v) => set(f.name, v)} hint={f.hint} options={f.options ?? []} />
                    ) : f.kind === "textarea" ? (
                      <TextareaField id={f.name} label={label} value={value} onChange={(v) => set(f.name, v)} hint={f.hint} placeholder={f.placeholder} span={false} />
                    ) : (
                      <TextField
                        id={f.name}
                        label={label}
                        type={f.kind === "number" ? "text" : (f.kind as "text" | "email" | "tel")}
                        value={value}
                        onChange={(v) => set(f.name, v)}
                        hint={f.hint}
                        placeholder={f.placeholder}
                        mono={f.mono}
                      />
                    )}
                    {errors[f.name] ? <p className="mt-1 text-[11.5px] font-medium text-[hsl(var(--state-stop))]">{errors[f.name]}</p> : null}
                  </div>
                )
              })}
            </FieldGrid>
          ) : null}

          {step.documents ? (
            <div className="space-y-3">
              <p className="text-[13px] text-muted-foreground">Up to 10 MB each. Items marked * are required.</p>
              {step.documents.map((d) => {
                const picked = files[d.name]
                const already = existingUrls[d.name]
                return (
                  <div key={d.name}>
                    <div className="flex flex-col gap-2 rounded-lg border border-border px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <label htmlFor={d.name} className="text-[13.5px] font-medium text-foreground">
                          {d.label}
                          {d.required ? " *" : ""}
                        </label>
                        <p className="mt-0.5 text-[12px] text-muted-foreground">{picked ? `${picked.name} · ready to upload` : already ? "Already uploaded" : "Not uploaded yet"}</p>
                      </div>
                      <label htmlFor={d.name} className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] font-semibold hover:bg-muted">
                        <Paperclip className="h-3.5 w-3.5" />
                        {already || picked ? "Replace" : "Choose file"}
                        <input
                          id={d.name}
                          type="file"
                          accept={d.accept}
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0] ?? null
                            if (file && file.size > 10 * 1024 * 1024) {
                              toast.warning({ title: "File too large", description: `${file.name} is over 10 MB.` })
                              return
                            }
                            setFiles((prev) => ({ ...prev, [d.name]: file }))
                            setErrors((prev) => ({ ...prev, [d.name]: "" }))
                          }}
                        />
                      </label>
                    </div>
                    {errors[d.name] ? <p className="mt-1 text-[11.5px] font-medium text-[hsl(var(--state-stop))]">{errors[d.name]}</p> : null}
                  </div>
                )
              })}
            </div>
          ) : null}

          <div className="mt-6 flex items-center justify-between gap-2 border-t border-border pt-4">
            <ActionButton tone="quiet" icon={ChevronLeft} disabled={stepIndex === 0} onClick={() => setStepIndex((i) => Math.max(0, i - 1))}>
              Back
            </ActionButton>
            {last ? (
              <ActionButton icon={submitting ? Loader2 : Send} disabled={submitting} onClick={submit}>
                {submitting ? "Submitting…" : existing ? "Resubmit application" : "Submit application"}
              </ActionButton>
            ) : (
              <ActionButton
                icon={ChevronRight}
                onClick={() => {
                  if (validateStep(stepIndex)) setStepIndex((i) => i + 1)
                }}
              >
                Continue
              </ActionButton>
            )}
          </div>
        </Panel>

        <p className="mt-4 flex items-start gap-2 text-[12.5px] leading-relaxed text-muted-foreground">
          <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          You&rsquo;ll get a reference number when you submit. It&rsquo;s how you track progress, pay and renew.
        </p>
      </div>
    </div>
  )
}
