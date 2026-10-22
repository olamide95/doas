"use client"

import * as React from "react"
import { collection, doc, setDoc } from "firebase/firestore"
import { AlertTriangle, Save } from "lucide-react"
import { db } from "@/lib/firebase"
import {
  AREA_COUNCILS,
  ASSET_STATUSES,
  DISTRICTS,
  EMPTY_SITE,
  FACE_OPTIONS,
  LIGHTING_TYPES,
  PAYMENT_CHANNELS,
  PAYMENT_STATUSES,
  PRACTITIONER_COL,
  SITE_FILE_SLOTS,
  SITE_MULTI_SLOTS,
  STRUCTURE_TYPES,
  daysUntil,
  expiryFrom,
  faceCountFor,
  inGracePeriod,
  isDecommissioned,
  isTaken,
  logActivity,
  needsNightPhoto,
  nextSiteReference,
  normaliseRrr,
  parseDecimal,
  round2,
  siteMissingDocs,
  surfaceArea,
  uploadRecordFile,
  validateSite,
  type Actor,
  type Errors,
  type SiteDraft,
  type SiteFile,
  type SiteFileSlot,
  type SiteMultiSlot,
  type StoredFile,
} from "@/lib/practitioner-registry"
import { formatDate, naira } from "@/lib/format"
import { toast } from "@/components/ui/toast"
import { Sheet } from "@/components/dashboard/sheet"
import { ActionButton, TextareaField } from "@/components/dashboard/form-kit"
import { Segmented } from "@/components/dashboard/notifications-panel"
import {
  ErrorSummary,
  FileSlot,
  FormGrid,
  FormSection,
  MultiFileSlot,
  ReadOnly,
  SelectInput,
  TextInput,
  YesNo,
} from "@/components/dashboard/practitioners/registry-fields"
import type { ProfileRow } from "@/components/dashboard/practitioners/practitioner-form"

export type SiteRow = SiteFile & { id: string }

type Tab = "technical" | "location" | "visuals" | "billing" | "timeline" | "status"

const TAB_FIELDS: Record<Tab, string[]> = {
  technical: ["siteReferenceCode", "structureType", "heightInput", "widthInput", "operationalFaces", "lightingType"],
  location: ["areaCouncil", "district", "landmarkAddress", "latitudeInput", "longitudeInput"],
  visuals: [],
  billing: ["demandNoticeNumber", "feeInput", "paidInput", "paymentChannel", "paymentReference", "paymentStatus"],
  timeline: ["approvalDate", "lastPaymentDate", "commencementDate"],
  status: ["assetStatus", "decommissionDate", "revenueCleared"],
}

const LABELS: Record<string, string> = {
  siteReferenceCode: "Site reference",
  structureType: "Structure type",
  heightInput: "Height",
  widthInput: "Width",
  operationalFaces: "Faces",
  lightingType: "Lighting",
  areaCouncil: "Area council",
  district: "District",
  landmarkAddress: "Landmark / axis",
  latitudeInput: "Latitude",
  longitudeInput: "Longitude",
  demandNoticeNumber: "Demand notice",
  feeInput: "Annual permit fee",
  paidInput: "Amount paid",
  paymentChannel: "Payment channel",
  paymentReference: "Payment reference",
  paymentStatus: "Payment status",
  approvalDate: "Approval date",
  lastPaymentDate: "Last payment date",
  commencementDate: "Commencement date",
  decommissionDate: "Decommission date",
  revenueCleared: "Revenue clearance",
}

function draftFrom(row: SiteRow | null, reference: string): SiteDraft {
  if (!row) return { ...EMPTY_SITE, siteReferenceCode: reference }
  return {
    ...EMPTY_SITE,
    siteReferenceCode: row.siteReferenceCode,
    structureType: row.structureType,
    heightM: row.heightM,
    widthM: row.widthM,
    heightInput: row.heightM?.toString() ?? "",
    widthInput: row.widthM?.toString() ?? "",
    operationalFaces: row.operationalFaces,
    lightingType: row.lightingType,
    areaCouncil: row.areaCouncil,
    district: row.district,
    landmarkAddress: row.landmarkAddress,
    latitude: row.latitude,
    longitude: row.longitude,
    latitudeInput: row.latitude?.toString() ?? "",
    longitudeInput: row.longitude?.toString() ?? "",
    demandNoticeNumber: row.demandNoticeNumber,
    annualPermitFee: row.annualPermitFee,
    amountPaid: row.amountPaid,
    feeInput: row.annualPermitFee?.toString() ?? "",
    paidInput: row.amountPaid?.toString() ?? "",
    paymentChannel: row.paymentChannel,
    paymentReference: row.paymentReference,
    paymentStatus: row.paymentStatus,
    approvalDate: row.approvalDate,
    lastPaymentDate: row.lastPaymentDate,
    commencementDate: row.commencementDate,
    assetStatus: row.assetStatus,
    decommissionDate: row.decommissionDate,
    revenueCleared: row.revenueCleared,
    notes: row.notes,
  }
}

export function SiteForm({
  open,
  practitioner,
  existing,
  siblingCodes,
  actor,
  onClose,
  onSaved,
}: {
  open: boolean
  practitioner: ProfileRow
  existing: SiteRow | null
  /** Reference codes already used by this practitioner's other sites. */
  siblingCodes: string[]
  actor: Actor
  onClose: () => void
  onSaved: () => void
}) {
  const suggested = React.useMemo(
    () => nextSiteReference(practitioner.doasPractitionerId, siblingCodes),
    [practitioner.doasPractitionerId, siblingCodes],
  )

  const [tab, setTab] = React.useState<Tab>("technical")
  const [draft, setDraft] = React.useState<SiteDraft>(() => draftFrom(existing, suggested))
  const [documents, setDocuments] = React.useState<Partial<Record<SiteFileSlot, StoredFile>>>(existing?.documents ?? {})
  const [staged, setStaged] = React.useState<Partial<Record<SiteFileSlot, File | null>>>({})
  const [receipts, setReceipts] = React.useState<Partial<Record<SiteMultiSlot, StoredFile[]>>>(existing?.receipts ?? {})
  const [stagedReceipts, setStagedReceipts] = React.useState<Partial<Record<SiteMultiSlot, File[]>>>({})
  const [errors, setErrors] = React.useState<Errors>({})
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setTab("technical")
    setDraft(draftFrom(existing, suggested))
    setDocuments(existing?.documents ?? {})
    setStaged({})
    setReceipts(existing?.receipts ?? {})
    setStagedReceipts({})
    setErrors({})
    // `suggested` intentionally excluded — it shifts when a sibling saves and
    // would wipe a half-filled form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing])

  const set = <K extends keyof SiteDraft>(key: K, value: SiteDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }))
    if (errors[key as string])
      setErrors((e) => {
        const { [key as string]: _drop, ...rest } = e
        return rest
      })
  }

  /* ---- Derived values shown live ---- */
  const h = parseDecimal(draft.heightInput)
  const w = parseDecimal(draft.widthInput)
  const area = surfaceArea(h, w)
  const faces = faceCountFor(draft.operationalFaces)
  const totalArea = area && faces ? round2(area * faces) : null
  const expiry = expiryFrom(draft.commencementDate)
  const grace = inGracePeriod({
    expiryDate: expiry,
    paymentStatus: draft.paymentStatus,
    lastPaymentDate: draft.lastPaymentDate,
    demandNoticeNumber: draft.demandNoticeNumber,
    assetStatus: draft.assetStatus,
  })
  const left = daysUntil(expiry)
  const archived = isDecommissioned(draft.assetStatus)

  const effectiveDocs: Partial<Record<SiteFileSlot, StoredFile | File>> = { ...documents }
  Object.entries(staged).forEach(([k, f]) => {
    if (f) effectiveDocs[k as SiteFileSlot] = f
  })
  const effectiveReceipts: Partial<Record<SiteMultiSlot, unknown[]>> = {}
  SITE_MULTI_SLOTS.forEach((s) => {
    effectiveReceipts[s.key] = [...(receipts[s.key] ?? []), ...(stagedReceipts[s.key] ?? [])]
  })
  const missing = siteMissingDocs(
    draft,
    effectiveDocs as Partial<Record<SiteFileSlot, StoredFile>>,
    effectiveReceipts as Partial<Record<SiteMultiSlot, StoredFile[]>>,
  )

  const tabHasError = (t: Tab) => TAB_FIELDS[t].some((f) => errors[f])

  const save = async () => {
    if (busy) return
    const found = validateSite(draft)
    if (Object.keys(found).length) {
      setErrors(found)
      const first = (Object.keys(TAB_FIELDS) as Tab[]).find((t) => TAB_FIELDS[t].some((f) => found[f]))
      if (first) setTab(first)
      toast.warning({ title: "Check the highlighted fields", description: `${Object.keys(found).length} to fix before saving.` })
      return
    }

    setBusy(true)
    try {
      const code = draft.siteReferenceCode.trim().toUpperCase()
      const notice = draft.demandNoticeNumber.trim().toUpperCase()
      const [codeTaken, noticeTaken] = await Promise.all([
        isTaken(PRACTITIONER_COL.sites, "siteReferenceCode", code, existing?.id),
        notice ? isTaken(PRACTITIONER_COL.sites, "demandNoticeNumber", notice, existing?.id) : Promise.resolve(false),
      ])
      if (codeTaken || noticeTaken) {
        const clash: Errors = {}
        if (codeTaken) clash.siteReferenceCode = "Another site already uses this reference"
        if (noticeTaken) clash.demandNoticeNumber = "This demand notice is already linked to another site"
        setErrors(clash)
        setTab(codeTaken ? "technical" : "billing")
        return
      }

      const ref = existing ? doc(db, PRACTITIONER_COL.sites, existing.id) : doc(collection(db, PRACTITIONER_COL.sites))
      const folder = `practitioners/${practitioner.id}/sites/${ref.id}`

      const nextDocs = { ...documents }
      for (const slot of SITE_FILE_SLOTS) {
        const file = staged[slot.key]
        if (file) nextDocs[slot.key] = await uploadRecordFile(folder, slot.key, file)
      }
      const nextReceipts = { ...receipts }
      for (const slot of SITE_MULTI_SLOTS) {
        const files = stagedReceipts[slot.key] ?? []
        if (!files.length) continue
        const uploaded: StoredFile[] = []
        for (const file of files) uploaded.push(await uploadRecordFile(folder, slot.key, file))
        nextReceipts[slot.key] = [...(nextReceipts[slot.key] ?? []), ...uploaded]
      }

      const missingNow = siteMissingDocs(draft, nextDocs, nextReceipts)
      const now = new Date().toISOString()
      const lat = parseDecimal(draft.latitudeInput)
      const lng = parseDecimal(draft.longitudeInput)
      const fee = parseDecimal(draft.feeInput)
      const paid = parseDecimal(draft.paidInput)

      const record: SiteFile = {
        practitionerId: practitioner.id,
        doasPractitionerId: practitioner.doasPractitionerId,
        practitionerName: practitioner.companyName,

        siteReferenceCode: code,
        structureType: draft.structureType,
        heightM: h,
        widthM: w,
        surfaceAreaM2: area,
        operationalFaces: draft.operationalFaces,
        faceCount: faces,
        totalDisplayAreaM2: totalArea,
        lightingType: draft.lightingType,

        areaCouncil: draft.areaCouncil,
        district: draft.district.trim(),
        landmarkAddress: draft.landmarkAddress.trim(),
        latitude: lat !== null ? Number(lat.toFixed(6)) : null,
        longitude: lng !== null ? Number(lng.toFixed(6)) : null,

        documents: nextDocs,

        demandNoticeNumber: notice,
        annualPermitFee: fee,
        amountPaid: draft.paymentStatus === "Fully Paid" && paid === null ? fee : paid,
        paymentChannel: draft.paymentChannel,
        paymentReference:
          draft.paymentChannel === "Remita RRR" ? normaliseRrr(draft.paymentReference) : draft.paymentReference.trim(),
        paymentStatus: draft.paymentStatus,
        receipts: nextReceipts,

        approvalDate: draft.approvalDate,
        lastPaymentDate: draft.lastPaymentDate,
        commencementDate: draft.commencementDate,
        expiryDate: expiryFrom(draft.commencementDate),

        assetStatus: draft.assetStatus,
        decommissionDate: isDecommissioned(draft.assetStatus) ? draft.decommissionDate : "",
        revenueCleared: isDecommissioned(draft.assetStatus) ? draft.revenueCleared : null,

        missingDocuments: missingNow,
        recordComplete: missingNow.length === 0,
        notes: draft.notes,
        createdAt: existing?.createdAt ?? now,
        createdBy: existing?.createdBy ?? actor,
        updatedAt: now,
        updatedBy: actor,
      }
      await setDoc(ref, record)

      await logActivity({
        actor,
        action: existing ? "Site file updated" : "Site file digitised",
        practitionerId: practitioner.id,
        siteId: ref.id,
        detail: `${code} · ${draft.structureType} · ${draft.district}`,
      })

      toast.success({
        title: existing ? "Site updated" : "Site added",
        description: missingNow.length ? `${code} — ${missingNow.length} document${missingNow.length === 1 ? "" : "s"} still missing` : code,
      })
      onSaved()
    } catch (err) {
      toast.error({ title: "Not saved", description: err instanceof Error ? err.message : "Try again in a moment." })
    } finally {
      setBusy(false)
    }
  }

  const districts = draft.areaCouncil ? DISTRICTS[draft.areaCouncil] : []

  return (
    <Sheet
      open={open}
      onClose={busy ? () => undefined : onClose}
      title={existing ? "Edit site file" : "Add site file"}
      caption={`${practitioner.companyName} · ${draft.siteReferenceCode || "new site"}`}
      width="max-w-3xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12px] text-muted-foreground">
            {missing.length ? `${missing.length} document${missing.length === 1 ? "" : "s"} missing — saves as incomplete` : "All documents on file"}
          </p>
          <div className="flex gap-2">
            <ActionButton tone="quiet" disabled={busy} onClick={onClose}>
              Cancel
            </ActionButton>
            <ActionButton icon={Save} disabled={busy} onClick={save}>
              {busy ? "Saving…" : existing ? "Save changes" : "Save site"}
            </ActionButton>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <Segmented
            value={tab}
            onChange={(v) => setTab(v as Tab)}
            options={(
              [
                ["technical", "Technical"],
                ["location", "Location"],
                ["visuals", "Visuals"],
                ["billing", "Billing"],
                ["timeline", "Timeline"],
                ["status", "Status"],
              ] as [Tab, string][]
            ).map(([value, label]) => ({ value, label: tabHasError(value) ? `${label} •` : label }))}
          />
        </div>

        <ErrorSummary errors={errors} labels={LABELS} />

        {tab === "technical" ? (
          <FormSection title="Core technical details">
            <FormGrid>
              <TextInput
                id="s-ref"
                label="Site reference code"
                required
                value={draft.siteReferenceCode}
                onChange={(v) => set("siteReferenceCode", v.toUpperCase())}
                error={errors.siteReferenceCode}
                hint={`Maps to ${practitioner.doasPractitionerId}. Keep the legacy code if the file has one.`}
                className="sm:col-span-2"
              />
              <SelectInput
                id="s-type"
                label="Structure type"
                required
                value={draft.structureType}
                options={STRUCTURE_TYPES}
                onChange={(v) => {
                  set("structureType", v as SiteDraft["structureType"])
                  if (v === "LED Digital Screen") set("lightingType", "Self-Luminous LED")
                }}
                error={errors.structureType}
              />
              <SelectInput
                id="s-faces"
                label="Operational faces"
                required
                value={draft.operationalFaces}
                options={FACE_OPTIONS.map((f) => f.value)}
                onChange={(v) => set("operationalFaces", v as SiteDraft["operationalFaces"])}
                error={errors.operationalFaces}
              />
              <TextInput
                id="s-height"
                label="Height"
                required
                inputMode="decimal"
                suffix="m"
                value={draft.heightInput}
                onChange={(v) => set("heightInput", v)}
                error={errors.heightInput}
              />
              <TextInput
                id="s-width"
                label="Width"
                required
                inputMode="decimal"
                suffix="m"
                value={draft.widthInput}
                onChange={(v) => set("widthInput", v)}
                error={errors.widthInput}
              />
              <ReadOnly label="Surface area per face" value={area ? `${area.toLocaleString()} m²` : null} />
              <ReadOnly
                label="Total display area"
                value={totalArea ? `${totalArea.toLocaleString()} m² (${faces} face${faces === 1 ? "" : "s"})` : null}
              />
              <SelectInput
                id="s-light"
                label="Lighting type"
                required
                value={draft.lightingType}
                options={LIGHTING_TYPES}
                onChange={(v) => set("lightingType", v as SiteDraft["lightingType"])}
                error={errors.lightingType}
                className="sm:col-span-2"
              />
            </FormGrid>
          </FormSection>
        ) : null}

        {tab === "location" ? (
          <FormSection title="Geolocation" description="Decimal degrees, latitude and longitude separately — GIS-ready.">
            <FormGrid>
              <SelectInput
                id="s-council"
                label="Area council"
                required
                value={draft.areaCouncil}
                options={AREA_COUNCILS}
                onChange={(v) => set("areaCouncil", v as SiteDraft["areaCouncil"])}
                error={errors.areaCouncil}
              />
              <TextInput
                id="s-district"
                label="District / zone"
                required
                list="s-district-list"
                value={draft.district}
                onChange={(v) => set("district", v)}
                placeholder={draft.areaCouncil ? "Pick or type" : "Pick an area council first"}
                error={errors.district}
              />
              <datalist id="s-district-list">
                {districts.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
              <TextInput
                id="s-landmark"
                label="Landmark / axis address"
                required
                value={draft.landmarkAddress}
                onChange={(v) => set("landmarkAddress", v)}
                placeholder="Along Herbert Macaulay Way, 50m before Sky Memorial Complex"
                error={errors.landmarkAddress}
                className="sm:col-span-2"
              />
              <TextInput
                id="s-lat"
                label="Latitude"
                required
                inputMode="decimal"
                value={draft.latitudeInput}
                onChange={(v) => set("latitudeInput", v.trim())}
                placeholder="9.0765"
                error={errors.latitudeInput}
              />
              <TextInput
                id="s-lng"
                label="Longitude"
                required
                inputMode="decimal"
                value={draft.longitudeInput}
                onChange={(v) => set("longitudeInput", v.trim())}
                placeholder="7.3986"
                error={errors.longitudeInput}
              />
            </FormGrid>
            {parseDecimal(draft.latitudeInput) !== null && parseDecimal(draft.longitudeInput) !== null && !errors.latitudeInput && !errors.longitudeInput ? (
              <a
                href={`https://www.google.com/maps?q=${parseDecimal(draft.latitudeInput)},${parseDecimal(draft.longitudeInput)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex text-[12px] font-semibold text-primary underline-offset-2 hover:underline"
              >
                Check this point on a map →
              </a>
            ) : null}
          </FormSection>
        ) : null}

        {tab === "visuals" ? (
          <FormSection
            title="Visuals, montage & engineering"
            description="Photos as JPG/PNG, blueprint and insurance as PDF — 10 MB each."
          >
            <div className="grid gap-3">
              {SITE_FILE_SLOTS.filter((s) => s.key !== "restorationProof").map((slot) => (
                <FileSlot
                  key={slot.key}
                  id={`s-file-${slot.key}`}
                  label={slot.label}
                  hint={slot.hint}
                  accept={slot.accept}
                  required={slot.key !== "nighttimePhoto" || needsNightPhoto(draft.lightingType)}
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
        ) : null}

        {tab === "billing" ? (
          <FormSection title="Billing & revenue">
            <FormGrid>
              <TextInput
                id="s-notice"
                label="Current DOAS demand notice no."
                value={draft.demandNoticeNumber}
                onChange={(v) => set("demandNoticeNumber", v.toUpperCase())}
                error={errors.demandNoticeNumber}
                hint="Unique across all sites"
              />
              <TextInput
                id="s-fee"
                label="Annual permit fee"
                inputMode="decimal"
                suffix="₦"
                value={draft.feeInput}
                onChange={(v) => set("feeInput", v)}
                error={errors.feeInput}
                hint={parseDecimal(draft.feeInput) !== null ? naira(parseDecimal(draft.feeInput) as number) : "Valuation by size, zone tier and faces"}
              />
              <SelectInput
                id="s-paystatus"
                label="Payment status"
                value={draft.paymentStatus}
                options={PAYMENT_STATUSES}
                onChange={(v) => set("paymentStatus", v as SiteDraft["paymentStatus"])}
                error={errors.paymentStatus}
              />
              <TextInput
                id="s-paid"
                label="Amount paid"
                inputMode="decimal"
                suffix="₦"
                value={draft.paidInput}
                onChange={(v) => set("paidInput", v)}
                error={errors.paidInput}
                hint={draft.paymentStatus === "Fully Paid" ? "Leave blank to record the full fee" : undefined}
              />
              <SelectInput
                id="s-channel"
                label="Payment collection channel"
                value={draft.paymentChannel}
                options={PAYMENT_CHANNELS}
                onChange={(v) => set("paymentChannel", v as SiteDraft["paymentChannel"])}
                error={errors.paymentChannel}
              />
              <TextInput
                id="s-payref"
                label={draft.paymentChannel === "Remita RRR" ? "Remita RRR" : "TSA / transaction reference"}
                inputMode={draft.paymentChannel === "Remita RRR" ? "numeric" : undefined}
                value={draft.paymentReference}
                onChange={(v) => set("paymentReference", v)}
                placeholder={draft.paymentChannel === "Remita RRR" ? "1234-5678-9012" : undefined}
                error={errors.paymentReference}
              />
            </FormGrid>
            <div className="grid gap-3">
              {SITE_MULTI_SLOTS.map((slot) => (
                <MultiFileSlot
                  key={slot.key}
                  id={`s-multi-${slot.key}`}
                  label={slot.label}
                  accept={slot.accept}
                  stored={receipts[slot.key] ?? []}
                  staged={stagedReceipts[slot.key] ?? []}
                  onStage={(files) => setStagedReceipts((s) => ({ ...s, [slot.key]: files }))}
                  onRemoveStored={(i) =>
                    setReceipts((r) => ({ ...r, [slot.key]: (r[slot.key] ?? []).filter((_, j) => j !== i) }))
                  }
                />
              ))}
            </div>
          </FormSection>
        ) : null}

        {tab === "timeline" ? (
          <FormSection title="Timelines & subscription runtime">
            <FormGrid>
              <TextInput
                id="s-approved"
                label="Site approval / vetting date"
                type="date"
                value={draft.approvalDate}
                onChange={(v) => set("approvalDate", v)}
                error={errors.approvalDate}
              />
              <TextInput
                id="s-lastpay"
                label="Date of last payment processing"
                type="date"
                value={draft.lastPaymentDate}
                onChange={(v) => set("lastPaymentDate", v)}
                error={errors.lastPaymentDate}
              />
              <TextInput
                id="s-start"
                label="Subscription commencement date"
                type="date"
                required={draft.assetStatus === "Active"}
                value={draft.commencementDate}
                onChange={(v) => set("commencementDate", v)}
                error={errors.commencementDate}
                hint="Activation date for the current cycle"
              />
              <ReadOnly
                label="Expiration date"
                value={expiry ? `${formatDate(expiry)}${left !== null && !archived ? ` · ${left >= 0 ? `${left} days left` : `${Math.abs(left)} days ago`}` : ""}` : null}
              />
            </FormGrid>
            {grace ? (
              <div className="flex items-start gap-2 rounded-lg border border-[hsl(var(--state-stop))]/30 bg-[hsl(var(--state-stop-soft))] px-3.5 py-2.5 text-[12.5px]">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--state-stop))]" />
                <span>
                  <strong>Grace period.</strong> The cycle expired on {formatDate(expiry)} and no fully paid demand notice dated on or
                  after expiry is on file.
                </span>
              </div>
            ) : null}
          </FormSection>
        ) : null}

        {tab === "status" ? (
          <FormSection title="Asset status & historical archive">
            <FormGrid>
              <SelectInput
                id="s-status"
                label="Current asset status"
                required
                value={draft.assetStatus}
                options={ASSET_STATUSES}
                onChange={(v) => set("assetStatus", (v || "Active") as SiteDraft["assetStatus"])}
                error={errors.assetStatus}
                className="sm:col-span-2"
              />
              {archived ? (
                <>
                  <TextInput
                    id="s-decom"
                    label="Decommissioning date"
                    type="date"
                    required
                    value={draft.decommissionDate}
                    onChange={(v) => set("decommissionDate", v)}
                    error={errors.decommissionDate}
                  />
                  <YesNo
                    id="s-cleared"
                    label="Final revenue clearance"
                    required
                    value={draft.revenueCleared}
                    yes="Back-taxes cleared"
                    no="Outstanding"
                    onChange={(v) => set("revenueCleared", v)}
                    error={errors.revenueCleared}
                  />
                </>
              ) : null}
            </FormGrid>
            {archived ? (
              <FileSlot
                id="s-file-restorationProof"
                label="Proof of site restoration"
                hint="Median / ground repaired and cleared after removal"
                accept="photo"
                required
                stored={documents.restorationProof}
                staged={staged.restorationProof ?? null}
                onStage={(file) => setStaged((s) => ({ ...s, restorationProof: file }))}
                onClear={() =>
                  setDocuments((d) => {
                    const { restorationProof: _drop, ...rest } = d
                    return rest
                  })
                }
              />
            ) : null}
            <TextareaField
              id="s-notes"
              label="Notes from the physical file"
              value={draft.notes}
              rows={2}
              onChange={(v: string) => set("notes", v)}
            />
            {missing.length ? (
              <div className="rounded-lg bg-muted/50 px-3.5 py-2.5 text-[12px] text-muted-foreground">
                <span className="font-semibold text-foreground">Missing from this file:</span> {missing.join(" · ")}
              </div>
            ) : null}
          </FormSection>
        ) : null}
      </div>
    </Sheet>
  )
}