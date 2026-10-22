"use client"

import * as React from "react"
import { collection, doc, setDoc } from "firebase/firestore"
import { RefreshCw, Save } from "lucide-react"
import { db } from "@/lib/firebase"
import {
  ARCON_CATEGORIES,
  EMPTY_PROFILE,
  PRACTITIONER_COL,
  PROFILE_FILE_SLOTS,
  generatePractitionerId,
  isPast,
  isTaken,
  logActivity,
  normalisePhone,
  normaliseRc,
  normaliseTin,
  uploadRecordFile,
  validateProfile,
  type Actor,
  type Errors,
  type PractitionerProfile,
  type ProfileDraft,
  type ProfileFileSlot,
  type StoredFile,
} from "@/lib/practitioner-registry"
import { toast } from "@/components/ui/toast"
import { Sheet } from "@/components/dashboard/sheet"
import { ActionButton, TextareaField } from "@/components/dashboard/form-kit"
import {
  ErrorSummary,
  FileSlot,
  FormGrid,
  FormSection,
  SelectInput,
  TextInput,
  YesNo,
} from "@/components/dashboard/practitioners/registry-fields"

export type ProfileRow = PractitionerProfile & { id: string }

const LABELS: Record<string, string> = {
  companyName: "Company name",
  rcNumber: "RC number",
  tin: "TIN",
  doasPractitionerId: "DOAS practitioner ID",
  arconCategory: "ARCON category",
  arconLicenseNumber: "ARCON licence number",
  arconLicenseExpiry: "ARCON licence expiry",
  managingDirector: "Managing Director",
  leadPractitionerArconNo: "Lead practitioner ARCON no.",
  hqAddress: "Head-office address",
  phonePrimary: "Primary phone",
  phoneSecondary: "Secondary phone",
  email: "Email",
}

function draftFrom(row: ProfileRow | null): ProfileDraft {
  if (!row) return { ...EMPTY_PROFILE, doasPractitionerId: generatePractitionerId() }
  const { id: _id, companyNameKey: _k, documents: _d, createdAt: _c, createdBy: _cb, updatedAt: _u, updatedBy: _ub, ...rest } = row
  return { ...EMPTY_PROFILE, ...rest }
}

export function PractitionerForm({
  open,
  existing,
  actor,
  onClose,
  onSaved,
}: {
  open: boolean
  existing: ProfileRow | null
  actor: Actor
  onClose: () => void
  onSaved: (id: string) => void
}) {
  const [draft, setDraft] = React.useState<ProfileDraft>(() => draftFrom(existing))
  const [documents, setDocuments] = React.useState<Partial<Record<ProfileFileSlot, StoredFile>>>(existing?.documents ?? {})
  const [staged, setStaged] = React.useState<Partial<Record<ProfileFileSlot, File | null>>>({})
  const [errors, setErrors] = React.useState<Errors>({})
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setDraft(draftFrom(existing))
    setDocuments(existing?.documents ?? {})
    setStaged({})
    setErrors({})
  }, [open, existing])

  const set = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }))
    if (errors[key as string]) setErrors((e) => {
      const { [key as string]: _drop, ...rest } = e
      return rest
    })
  }

  const save = async () => {
    if (busy) return
    const clean: ProfileDraft = {
      ...draft,
      companyName: draft.companyName.trim().replace(/\s+/g, " "),
      rcNumber: normaliseRc(draft.rcNumber),
      tin: normaliseTin(draft.tin),
      doasPractitionerId: draft.doasPractitionerId.trim().toUpperCase(),
      email: draft.email.trim().toLowerCase(),
      phonePrimary: normalisePhone(draft.phonePrimary),
      phoneSecondary: normalisePhone(draft.phoneSecondary),
    }
    setDraft(clean)

    const found = validateProfile(clean)
    if (Object.keys(found).length) {
      setErrors(found)
      toast.warning({ title: "Check the highlighted fields", description: `${Object.keys(found).length} to fix before saving.` })
      return
    }

    setBusy(true)
    try {
      // Uniqueness — email is mandated unique; RC and DOAS ID must not collide either.
      const exceptId = existing?.id
      const [emailTaken, rcTaken, idTaken] = await Promise.all([
        isTaken(PRACTITIONER_COL.profiles, "email", clean.email, exceptId),
        isTaken(PRACTITIONER_COL.profiles, "rcNumber", clean.rcNumber, exceptId),
        isTaken(PRACTITIONER_COL.profiles, "doasPractitionerId", clean.doasPractitionerId, exceptId),
      ])
      const clash: Errors = {}
      if (emailTaken) clash.email = "Another practitioner already uses this email"
      if (rcTaken) clash.rcNumber = "This RC number is already registered"
      if (idTaken) clash.doasPractitionerId = "This DOAS ID is already in use"
      if (Object.keys(clash).length) {
        setErrors(clash)
        toast.warning({ title: "Duplicate record", description: "This practitioner may already be on file." })
        return
      }

      const ref = existing ? doc(db, PRACTITIONER_COL.profiles, existing.id) : doc(collection(db, PRACTITIONER_COL.profiles))
      const folder = `practitioners/${ref.id}/profile`

      const nextDocs = { ...documents }
      for (const slot of PROFILE_FILE_SLOTS) {
        const file = staged[slot.key]
        if (file) nextDocs[slot.key] = await uploadRecordFile(folder, slot.key, file)
      }

      const now = new Date().toISOString()
      const record: PractitionerProfile = {
        ...clean,
        companyNameKey: clean.companyName.toLowerCase(),
        documents: nextDocs,
        createdAt: existing?.createdAt ?? now,
        createdBy: existing?.createdBy ?? actor,
        updatedAt: now,
        updatedBy: actor,
      }
      await setDoc(ref, record)

      await logActivity({
        actor,
        action: existing ? "Practitioner profile updated" : "Practitioner profile digitised",
        practitionerId: ref.id,
        detail: clean.companyName,
      })

      toast.success({ title: existing ? "Profile updated" : "Practitioner added", description: clean.companyName })
      onSaved(ref.id)
    } catch (err) {
      toast.error({ title: "Not saved", description: err instanceof Error ? err.message : "Try again in a moment." })
    } finally {
      setBusy(false)
    }
  }

  const licenceExpired = isPast(draft.arconLicenseExpiry)

  return (
    <Sheet
      open={open}
      onClose={busy ? () => undefined : onClose}
      title={existing ? "Edit practitioner" : "Add practitioner"}
      caption={existing ? `${existing.doasPractitionerId} · ${existing.companyName}` : "Digitise a practitioner file from the physical record"}
      width="max-w-3xl"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ActionButton tone="quiet" disabled={busy} onClick={onClose}>
            Cancel
          </ActionButton>
          <ActionButton icon={Save} disabled={busy} onClick={save}>
            {busy ? "Saving…" : existing ? "Save changes" : "Save practitioner"}
          </ActionButton>
        </div>
      }
    >
      <div className="space-y-7">
        <ErrorSummary errors={errors} labels={LABELS} />

        <FormSection title="Corporate identification" description="Enter exactly as printed on the CAC certificate.">
          <FormGrid>
            <TextInput
              id="p-name"
              label="Company registered name"
              required
              value={draft.companyName}
              onChange={(v) => set("companyName", v)}
              placeholder="e.g. Skyline Outdoor Media Ltd"
              error={errors.companyName}
              className="sm:col-span-2"
            />
            <TextInput
              id="p-rc"
              label="CAC registration number"
              required
              value={draft.rcNumber}
              onChange={(v) => set("rcNumber", v)}
              onBlur={() => set("rcNumber", normaliseRc(draft.rcNumber))}
              placeholder="RC 1234567"
              error={errors.rcNumber}
            />
            <TextInput
              id="p-tin"
              label="Tax Identification Number (TIN)"
              required
              value={draft.tin}
              onChange={(v) => set("tin", v)}
              onBlur={() => set("tin", normaliseTin(draft.tin))}
              placeholder="12345678-0001"
              inputMode="numeric"
              error={errors.tin}
              hint="JTB format — 8 digits, hyphen, 4 digits; or 10-digit JTB TIN"
            />
            <div className="flex flex-col gap-2 sm:col-span-2">
              <YesNo
                id="p-legacy"
                label="Does the physical file carry an existing DOAS practitioner ID?"
                value={draft.isLegacyId}
                yes="Yes — use the legacy ID"
                no="No — generate one"
                onChange={(legacy) => {
                  set("isLegacyId", legacy)
                  if (!legacy && !existing) set("doasPractitionerId", generatePractitionerId())
                  if (legacy && !existing) set("doasPractitionerId", "")
                }}
              />
              <div className="flex items-end gap-2">
                <TextInput
                  id="p-doasid"
                  label="DOAS unique practitioner ID"
                  required
                  value={draft.doasPractitionerId}
                  onChange={(v) => set("doasPractitionerId", v.toUpperCase())}
                  placeholder={draft.isLegacyId ? "As written on the file" : "DOAS-PRC-2026-XXXXX"}
                  error={errors.doasPractitionerId}
                  disabled={!draft.isLegacyId && !existing}
                  className="flex-1"
                />
                {!draft.isLegacyId && !existing ? (
                  <button
                    type="button"
                    aria-label="Regenerate ID"
                    onClick={() => set("doasPractitionerId", generatePractitionerId())}
                    className="mb-px inline-flex h-[38px] items-center rounded-lg border border-border px-3 text-muted-foreground hover:bg-muted"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>
          </FormGrid>
        </FormSection>

        <FormSection title="Compliance & licensing" description="From the ARCON corporate practice licence.">
          <FormGrid>
            <SelectInput
              id="p-arcon-cat"
              label="ARCON corporate licence category"
              required
              value={draft.arconCategory}
              options={ARCON_CATEGORIES}
              onChange={(v) => set("arconCategory", v as ProfileDraft["arconCategory"])}
              error={errors.arconCategory}
            />
            <TextInput
              id="p-arcon-no"
              label="ARCON licence number"
              required
              value={draft.arconLicenseNumber}
              onChange={(v) => set("arconLicenseNumber", v.toUpperCase())}
              error={errors.arconLicenseNumber}
            />
            <TextInput
              id="p-arcon-exp"
              label="ARCON licence expiry date"
              type="date"
              required
              value={draft.arconLicenseExpiry}
              onChange={(v) => set("arconLicenseExpiry", v)}
              error={errors.arconLicenseExpiry}
              hint={licenceExpired ? "This licence has expired — it will be flagged on the record" : undefined}
            />
            <TextInput
              id="p-md"
              label="Managing Director / CEO"
              required
              value={draft.managingDirector}
              onChange={(v) => set("managingDirector", v)}
              error={errors.managingDirector}
            />
            <TextInput
              id="p-lead"
              label="Lead practitioner ARCON membership no."
              required
              value={draft.leadPractitionerArconNo}
              onChange={(v) => set("leadPractitionerArconNo", v.toUpperCase())}
              error={errors.leadPractitionerArconNo}
              hint="Individual membership number of the certified practitioner"
              className="sm:col-span-2"
            />
          </FormGrid>
        </FormSection>

        <FormSection title="Contact & location">
          <FormGrid>
            <TextareaField
              id="p-hq"
              label="Corporate headquarters address *"
              value={draft.hqAddress}
              rows={2}
              placeholder="Plot, street, district, city"
              onChange={(v: string) => set("hqAddress", v)}
            />
            <div className="flex flex-col gap-4">
              <TextInput
                id="p-email"
                label="Official corporate email"
                type="email"
                required
                value={draft.email}
                onChange={(v) => set("email", v)}
                placeholder="info@company.ng"
                error={errors.email}
                hint="Must be unique across all practitioners"
              />
            </div>
            {errors.hqAddress ? (
              <p className="-mt-2 text-[11.5px] text-[hsl(var(--state-stop))] sm:col-span-2">{errors.hqAddress}</p>
            ) : null}
            <TextInput
              id="p-phone1"
              label="Primary phone"
              type="tel"
              required
              value={draft.phonePrimary}
              onChange={(v) => set("phonePrimary", v)}
              onBlur={() => set("phonePrimary", normalisePhone(draft.phonePrimary))}
              placeholder="+234 803 123 4567"
              error={errors.phonePrimary}
            />
            <TextInput
              id="p-phone2"
              label="Secondary phone"
              type="tel"
              value={draft.phoneSecondary}
              onChange={(v) => set("phoneSecondary", v)}
              onBlur={() => set("phoneSecondary", normalisePhone(draft.phoneSecondary))}
              placeholder="Optional"
              error={errors.phoneSecondary}
            />
          </FormGrid>
        </FormSection>

        <FormSection
          title="Registration attachments"
          description="Scan from the physical file — PDF or PNG, 10 MB max. Missing documents can be added later; the record is flagged until they are."
        >
          <div className="grid gap-3">
            {PROFILE_FILE_SLOTS.map((slot) => (
              <FileSlot
                key={slot.key}
                id={`p-file-${slot.key}`}
                label={slot.label}
                accept={slot.accept}
                required
                stored={documents[slot.key]}
                staged={staged[slot.key] ?? null}
                onStage={(file) => setStaged((s) => ({ ...s, [slot.key]: file }))}
                onClear={() =>
                  setDocuments((d) => {
                    const { [slot.key]: _drop, ...rest } = d
                    return rest
                  })
                }
              />
            ))}
          </div>
        </FormSection>

        <FormSection title="File notes">
          <TextareaField
            id="p-notes"
            label="Notes from the physical file"
            value={draft.notes}
            rows={2}
            placeholder="Anything on the paper file that has no field above"
            onChange={(v: string) => set("notes", v)}
          />
        </FormSection>
      </div>
    </Sheet>
  )
}