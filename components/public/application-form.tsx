"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore"
import { getDownloadURL, ref, uploadBytes } from "firebase/storage"
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  Paperclip,
  Send,
} from "lucide-react"
import { COL, db, storage } from "@/lib/firebase"
import { DEPARTMENT, STATUS } from "@/lib/workflow"
import { findSubmission, isEditable } from "@/lib/applicant"
import { toast } from "@/components/ui/toast"
import {
  ActionButton,
  FieldGrid,
  SelectField,
  TextField,
  TextareaField,
} from "@/components/dashboard/form-kit"
import { Panel, StatusPill } from "@/components/dashboard/kit"
import { cn } from "@/lib/utils"

type FieldKind = "text" | "tel" | "email" | "number" | "select" | "textarea"

interface FieldDef {
  name: string
  label: string
  kind: FieldKind
  required?: boolean
  placeholder?: string
  hint?: string
  options?: string[]
  span?: boolean
  mono?: boolean
}

interface DocDef {
  name: string
  label: string
  accept: string
}

export interface FormStep {
  id: string
  title: string
  fields?: FieldDef[]
  documents?: DocDef[]
}

const PURPOSES = ["New Sign", "Upgrading of Existing Sign", "Change of Existing Sign"]
const APPLICATION_TYPES = ["Billboard", "Gantry", "Unipole", "Wall Drape", "Roof Sign"]
const SIGN_TYPES = ["Static", "Digital", "LED", "Scrolling"]
const DURATIONS = ["Temporary", "Permanent"]

const APPLICANT_FIELDS: FieldDef[] = [
  { name: "applicantName", label: "Applicant name", kind: "text", required: true },
  { name: "contactPhoneNumber", label: "Phone number", kind: "tel", required: true, placeholder: "+234 800 000 0000" },
  { name: "email", label: "Email address", kind: "email", required: true },
  { name: "addressLine1", label: "Address", kind: "text", required: true },
  { name: "addressLine2", label: "Address line 2", kind: "text", span: true },
]

const SIGNAGE_FIELDS: FieldDef[] = [
  { name: "purposeOfApplication", label: "Purpose", kind: "select", required: true, options: PURPOSES },
  { name: "applicationType", label: "Structure type", kind: "select", required: true, options: APPLICATION_TYPES },
  {
    name: "gpsCoordinates",
    label: "GPS coordinates",
    kind: "text",
    required: true,
    mono: true,
    placeholder: "9.0765, 7.3986",
    hint: "Latitude, longitude. Take this standing at the site.",
  },
  { name: "structureDuration", label: "Duration", kind: "select", required: true, options: DURATIONS },
  { name: "numberOfSigns", label: "Number of signs", kind: "number", required: true },
  { name: "typeOfSign", label: "Type of sign", kind: "select", required: true, options: SIGN_TYPES },
  { name: "signDimensions", label: "Sign dimensions", kind: "text", required: true, placeholder: "4m × 6m" },
  { name: "structuralHeight", label: "Structural height", kind: "text", required: true, placeholder: "Metres above ground" },
]

const COMPANY_FIELDS: FieldDef[] = [
  { name: "companyName", label: "Company name", kind: "text", required: true },
  { name: "companyRegistrationNumber", label: "CAC registration number", kind: "text", required: true, placeholder: "RC-123456" },
  { name: "companyAddress", label: "Company address", kind: "textarea", required: true, span: true },
]

const PRACTITIONER_FIELDS: FieldDef[] = [
  { name: "practitionerName", label: "Practitioner name", kind: "text", required: true },
  { name: "practitionerLicenseNumber", label: "DOAS licence number", kind: "text", required: true, mono: true },
]

const COMMON_DOCS: DocDef[] = [
  { name: "eiaReport", label: "Environmental Impact Assessment", accept: ".pdf,.doc,.docx" },
  { name: "soilTestReport", label: "Soil test report", accept: ".pdf,.doc,.docx" },
  { name: "proofOfPayment", label: "Proof of application fee", accept: ".pdf,.jpg,.jpeg,.png" },
  { name: "structuralEngineeringDrawings", label: "Structural engineering drawings", accept: ".pdf,.dwg,.dxf" },
]

const THIRD_PARTY_DOCS: DocDef[] = [
  ...COMMON_DOCS,
  { name: "practitionerLicense", label: "Practitioner licence", accept: ".pdf,.jpg,.jpeg,.png" },
  { name: "companyRegistration", label: "CAC certificate", accept: ".pdf,.jpg,.jpeg,.png" },
]

export const FIRST_PARTY_STEPS: FormStep[] = [
  { id: "applicant", title: "About you", fields: APPLICANT_FIELDS },
  { id: "signage", title: "The signage", fields: SIGNAGE_FIELDS },
  { id: "documents", title: "Documents", documents: COMMON_DOCS },
]

export const THIRD_PARTY_STEPS: FormStep[] = [
  { id: "applicant", title: "About the client", fields: APPLICANT_FIELDS },
  { id: "signage", title: "The signage", fields: SIGNAGE_FIELDS },
  { id: "company", title: "Company", fields: COMPANY_FIELDS },
  { id: "practitioner", title: "Practitioner", fields: PRACTITIONER_FIELDS },
  { id: "documents", title: "Documents", documents: THIRD_PARTY_DOCS },
]

function reference(route: "first" | "third") {
  const prefix = route === "first" ? "FP" : "TP"
  const tail = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `${prefix}-${Date.now()}-${tail}`
}

export function ApplicationForm({
  route,
  steps,
  title,
  intro,
}: {
  route: "first" | "third"
  steps: FormStep[]
  title: string
  intro: string
}) {
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

  const allFields = React.useMemo(
    () => steps.flatMap((step) => step.fields ?? []),
    [steps],
  )

  // ---- Edit mode: pull the existing application in -------------------
  React.useEffect(() => {
    if (!editingRef) return
    let cancelled = false

    findSubmission(editingRef)
      .then((found) => {
        if (cancelled) return
        if (!found) {
          toast.error({
            title: "Application not found",
            description: `No application matches ${editingRef}. Check the reference and try again.`,
          })
          setLoading(false)
          return
        }

        if (!isEditable(found.data.status)) {
          toast.warning({
            title: "This application can't be edited",
            description: "It has already moved past the point where changes are accepted.",
            duration: 8000,
          })
          router.push(`/submission-status?id=${editingRef}`)
          return
        }

        setExisting(found)
        const loaded: Record<string, string> = {}
        allFields.forEach((field) => {
          loaded[field.name] = found.data[field.name] ?? ""
        })
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
    ;(steps[index].fields ?? []).forEach((field) => {
      const value = (values[field.name] ?? "").trim()
      if (field.required && !value) found[field.name] = "Required"
      else if (field.kind === "email" && value && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value))
        found[field.name] = "Enter a valid email address"
      else if (field.kind === "tel" && value && value.replace(/\D/g, "").length < 10)
        found[field.name] = "Enter a valid phone number"
    })
    setErrors(found)
    if (Object.keys(found).length) {
      toast.warning({
        title: "Some fields need attention",
        description: "The highlighted fields have to be filled in before you continue.",
      })
      return false
    }
    return true
  }

  const uploadDocs = async (submissionRef: string) => {
    const urls: Record<string, string> = { ...existingUrls }
    const pending = Object.entries(files).filter(([, file]) => file)

    for (const [key, file] of pending) {
      if (!file) continue
      const path = `submissions/${submissionRef}/${key}-${file.name.replace(/\s+/g, "-")}`
      const target = ref(storage, path)
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

      const payload: Record<string, unknown> = {
        ...values,
        submissionId,
        isFirstParty: route === "first",
        // Both routes start with CSU. Resubmitting after a change request
        // sends it back to CSU to be screened again, not straight upward.
        status: STATUS.withCsu,
        department: DEPARTMENT.csu,
        files: fileUrls,
        updatedAt: now,
      }

      if (existing) {
        // Never overwrite the original filing date on an edit.
        await updateDoc(doc(db, existing.collectionName, existing.docId), {
          ...payload,
          directorReason: "",
          resubmittedAt: now,
        })
      } else {
        await addDoc(collection(db, route === "first" ? COL.firstParty : COL.thirdParty), {
          ...payload,
          createdAt: serverTimestamp(),
        })
      }

      // The old forms notified "csu_department" and "director_office". No
      // dashboard listens on those, so nobody was ever told.
      await addDoc(collection(db, COL.notifications), {
        userId: "csu",
        content: existing
          ? `${values.applicantName} has updated application ${submissionId}`
          : `New ${route === "first" ? "first-party" : "third-party"} application from ${values.applicantName}`,
        type: "submission",
        referenceId: submissionId,
        isRead: false,
        createdAt: now,
      })

      toast.success({
        title: existing ? "Application updated" : "Application submitted",
        description: `Keep your reference: ${submissionId}`,
        duration: 9000,
      })

      router.push(`/submission-status?id=${submissionId}`)
    } catch (err) {
      toast.error({
        title: "Submission failed",
        description: err instanceof Error ? err.message : "Check your connection and try again.",
      })
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
          <h1 className="font-display text-[26px] font-semibold text-foreground sm:text-[30px]">
            {title}
          </h1>
          <p className="mt-1 max-w-[62ch] text-[13.5px] leading-relaxed text-muted-foreground">
            {intro}
          </p>
        </header>

        {existing ? (
          <div className="mb-5 rounded-xl border border-[hsl(var(--state-wait))]/35 bg-[hsl(var(--state-wait-soft))] p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--state-wait))]" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[13.5px] font-semibold text-foreground">
                    Editing {existing.data.submissionId}
                  </p>
                  <StatusPill status={existing.data.status} />
                </div>
                {existing.data.directorReason ? (
                  <>
                    <p className="mt-2 text-[12.5px] font-semibold text-foreground">
                      What you were asked to change
                    </p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-foreground">
                      {existing.data.directorReason}
                    </p>
                  </>
                ) : null}
                <p className="mt-2 text-[12.5px] text-muted-foreground">
                  Your answers are loaded below. Change what you need to and resubmit — documents you
                  already uploaded stay unless you replace them.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <ol className="mb-5 flex items-stretch gap-1">
          {steps.map((entry, index) => (
            <li key={entry.id} className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => index < stepIndex && setStepIndex(index)}
                className="w-full text-left"
                disabled={index > stepIndex}
              >
                <span
                  className={cn(
                    "block h-1 rounded-full transition-colors",
                    index < stepIndex
                      ? "bg-[hsl(var(--state-clear))]"
                      : index === stepIndex
                        ? "bg-[hsl(var(--state-wait))]"
                        : "bg-border",
                  )}
                />
                <span
                  className={cn(
                    "mt-1.5 block truncate text-[11px]",
                    index === stepIndex ? "font-semibold text-foreground" : "text-muted-foreground",
                  )}
                >
                  {entry.title}
                </span>
              </button>
            </li>
          ))}
        </ol>

        <Panel title={step.title} bodyClassName="p-4 sm:p-5">
          {step.fields ? (
            <FieldGrid>
              {step.fields.map((field) => (
                <div key={field.name} className={cn(field.span && "sm:col-span-2")}>
                  {field.kind === "select" ? (
                    <SelectField
                      id={field.name}
                      label={field.required ? `${field.label} *` : field.label}
                      value={values[field.name] ?? ""}
                      onChange={(value) => set(field.name, value)}
                      hint={errors[field.name] ?? field.hint}
                      options={(field.options ?? []).map((option) => ({
                        value: option,
                        label: option,
                      }))}
                    />
                  ) : field.kind === "textarea" ? (
                    <TextareaField
                      id={field.name}
                      label={field.required ? `${field.label} *` : field.label}
                      value={values[field.name] ?? ""}
                      onChange={(value) => set(field.name, value)}
                      hint={errors[field.name] ?? field.hint}
                      placeholder={field.placeholder}
                      span={false}
                    />
                  ) : (
                    <TextField
                      id={field.name}
                      label={field.required ? `${field.label} *` : field.label}
                      type={field.kind === "number" ? "text" : (field.kind as "text" | "email" | "tel")}
                      value={values[field.name] ?? ""}
                      onChange={(value) => set(field.name, value)}
                      hint={errors[field.name] ?? field.hint}
                      placeholder={field.placeholder}
                      mono={field.mono}
                    />
                  )}
                  {errors[field.name] ? (
                    <p className="mt-1 text-[11.5px] font-medium text-[hsl(var(--state-stop))]">
                      {errors[field.name]}
                    </p>
                  ) : null}
                </div>
              ))}
            </FieldGrid>
          ) : null}

          {step.documents ? (
            <div className="space-y-3">
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                PDF, Word or image files, up to 10 MB each.
              </p>
              {step.documents.map((docDef) => {
                const picked = files[docDef.name]
                const already = existingUrls[docDef.name]
                return (
                  <div
                    key={docDef.name}
                    className="flex flex-col gap-2 rounded-lg border border-border px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <label
                        htmlFor={docDef.name}
                        className="text-[13.5px] font-medium text-foreground"
                      >
                        {docDef.label}
                      </label>
                      {picked ? (
                        <p className="mt-0.5 text-[12px] text-[hsl(var(--state-clear))]">
                          {picked.name} · ready to upload
                        </p>
                      ) : already ? (
                        <p className="mt-0.5 text-[12px] text-muted-foreground">
                          Already uploaded ·{" "}
                          <a
                            href={already}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-accent underline-offset-4 hover:underline"
                          >
                            view
                          </a>
                        </p>
                      ) : (
                        <p className="mt-0.5 text-[12px] text-muted-foreground">Not uploaded yet</p>
                      )}
                    </div>
                    <label
                      htmlFor={docDef.name}
                      className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors hover:bg-muted"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      {already || picked ? "Replace" : "Choose file"}
                      <input
                        id={docDef.name}
                        type="file"
                        accept={docDef.accept}
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null
                          if (file && file.size > 10 * 1024 * 1024) {
                            toast.warning({
                              title: "File too large",
                              description: `${file.name} is over 10 MB.`,
                            })
                            return
                          }
                          setFiles((prev) => ({ ...prev, [docDef.name]: file }))
                        }}
                      />
                    </label>
                  </div>
                )
              })}
            </div>
          ) : null}

          <div className="mt-6 flex items-center justify-between gap-2 border-t border-border pt-4">
            <ActionButton
              tone="quiet"
              icon={ChevronLeft}
              disabled={stepIndex === 0}
              onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            >
              Back
            </ActionButton>

            {last ? (
              <ActionButton icon={submitting ? Loader2 : Send} disabled={submitting} onClick={submit}>
                {submitting
                  ? "Submitting…"
                  : existing
                    ? "Resubmit application"
                    : "Submit application"}
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
          You'll get a reference number when you submit. Keep it — it's how you check progress and
          make changes later.
        </p>
      </div>
    </div>
  )
}
