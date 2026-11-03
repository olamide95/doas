"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, Lock, Megaphone, Send } from "lucide-react"
import { AREA_COUNCILS, APPLICATION_FEE } from "@/lib/workflow"
import { ILLUMINATION_TYPES, STRUCTURE_TYPES, typeLabel } from "@/lib/tariff"
import { DISTRICTS, uploadRecordFile } from "@/lib/practitioner-registry"
import { naira } from "@/lib/format"
import { toast } from "@/components/ui/toast"
import { ActionButton, FieldGrid, SelectField, TextField, TextareaField } from "@/components/dashboard/form-kit"
import { Field, Panel, SectionLabel } from "@/components/dashboard/kit"
import { EMPTY_FEE, FeePayment, feeReady, type FeeState } from "@/components/payments/fee-payment"
import { portalApi, usePortal } from "@/components/auth/portal-context"
import type { Announcement } from "@/components/shared/announcements-panel"
import { cn } from "@/lib/utils"

/**
 * New third-party application from the portal.
 *
 * The practitioner's details are never typed here — they come from the DOAS
 * practitioner file on the server. At this stage only the photo montage is
 * uploaded; the structural drawing, soil test and EIA are requested later by
 * letter, after the site inspection. The ₦100,000 application fee is paid
 * through Remita before the application can be submitted.
 */

interface SiteDraft {
  signageSiteAddress: string
  areaCouncil: string
  district: string
  gpsCoordinates: string
  applicationType: string
  lightingType: string
  numberOfFaces: string
  signDimensions: string
  numberOfSigns: string
  purposeOfApplication: string
  notes: string
}

const STEPS = ["Site", "Photo montage", "Your details", "Application fee", "Review & submit"]

function fromAnnouncement(a?: (Announcement & { id: string }) | null): SiteDraft {
  return {
    signageSiteAddress: a?.address ?? "",
    areaCouncil: a?.areaCouncil ?? "",
    district: a?.district ?? "",
    gpsCoordinates: a?.latitude && a?.longitude ? `${a.latitude}, ${a.longitude}` : "",
    applicationType: a?.structureType ?? "",
    lightingType: "",
    numberOfFaces: a?.faces ?? "1",
    signDimensions: a?.dimensions ?? "",
    numberOfSigns: "1",
    purposeOfApplication: "New Sign",
    notes: "",
  }
}

export function ApplicationWizard({
  announcement,
  onDone,
  onCancel,
}: {
  announcement?: (Announcement & { id: string }) | null
  onDone: (submissionId: string) => void
  onCancel: () => void
}) {
  const { portal, profile } = usePortal()
  const [step, setStep] = React.useState(0)
  const [site, setSite] = React.useState<SiteDraft>(() => fromAnnouncement(announcement))
  const [montage, setMontage] = React.useState<{ url: string; name: string; type: string } | null>(null)
  const [uploading, setUploading] = React.useState(false)
  const [fee, setFee] = React.useState<FeeState>(EMPTY_FEE)
  const [busy, setBusy] = React.useState(false)
  const locked = Boolean(announcement)

  React.useEffect(() => setSite(fromAnnouncement(announcement)), [announcement])

  const set = (patch: Partial<SiteDraft>) => setSite((s) => ({ ...s, ...patch }))
  const districts = (DISTRICTS as Record<string, string[]>)[site.areaCouncil] ?? []

  const uploadMontage = async (file?: File) => {
    if (!file || !portal) return
    if (!["image/jpeg", "image/png", "application/pdf"].includes(file.type)) {
      toast.warning({ title: "Use JPG, PNG or PDF" })
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.warning({ title: "File too large", description: "Keep the montage under 10 MB." })
      return
    }
    setUploading(true)
    try {
      const stored = await uploadRecordFile(`portal/${portal.uid}/applications`, "photo-montage", file)
      setMontage({ url: stored.url, name: file.name, type: file.type })
    } catch (err) {
      toast.error({ title: "Upload failed", description: err instanceof Error ? err.message : "Try again." })
    } finally {
      setUploading(false)
    }
  }

  const problem = (index: number): string | null => {
    if (index === 0) {
      if (!site.signageSiteAddress.trim()) return "Enter the site address."
      if (!site.areaCouncil) return "Choose the area council."
      if (!site.applicationType) return "Choose the structure type."
      if (site.gpsCoordinates && !/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(site.gpsCoordinates.trim())) return "Coordinates should look like 9.0765, 7.3986."
      if (!/^\d+$/.test(site.numberOfFaces || "1")) return "Faces must be a whole number."
    }
    if (index === 1 && !montage) return "Upload the photo montage of the site."
    if (index === 2 && !profile) return "Your practitioner file could not be loaded. Contact Customer Service."
    if (index === 3 && !feeReady(fee)) return fee.configured ? "Pay the fee, then click Check payment." : "Enter the RRR and check the payment, or upload the Remita receipt."
    return null
  }

  const next = () => {
    const p = problem(step)
    if (p) {
      toast.warning({ title: "Not yet", description: p })
      return
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1))
  }

  const submit = async () => {
    for (let i = 0; i < STEPS.length - 1; i += 1) {
      const p = problem(i)
      if (p) {
        setStep(i)
        toast.warning({ title: "Not yet", description: p })
        return
      }
    }
    setBusy(true)
    try {
      const json = await portalApi<{ submissionId: string }>("/api/portal", {
        action: "submit",
        announcementId: announcement?.id ?? "",
        site: { ...site, purposeOfApplication: site.purposeOfApplication || "New Sign" },
        photoMontage: montage?.url,
        fee: { rrr: fee.rrr, receiptUrl: fee.receiptUrl },
      })
      toast.success({ title: "Application submitted", description: `Reference ${json.submissionId}`, duration: 9000 })
      onDone(json.submissionId)
    } catch (err) {
      toast.error({ title: "Not submitted", description: err instanceof Error ? err.message : "Try again." })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel
      title={announcement ? `Apply for: ${announcement.title}` : "New site application"}
      description={`Third-party application · ${naira(APPLICATION_FEE.third)} application fee through Remita`}
      actions={
        <ActionButton tone="quiet" onClick={onCancel}>
          Cancel
        </ActionButton>
      }
    >
      <ol className="mb-5 flex items-stretch gap-1">
        {STEPS.map((label, i) => (
          <li key={label} className="min-w-0 flex-1">
            <button type="button" className="w-full text-left" disabled={i > step} onClick={() => i < step && setStep(i)}>
              <span className={cn("block h-1 rounded-full", i < step ? "bg-[hsl(var(--state-clear))]" : i === step ? "bg-[hsl(var(--state-wait))]" : "bg-border")} />
              <span className={cn("mt-1.5 block truncate text-[11px]", i === step ? "font-semibold text-foreground" : "text-muted-foreground")}>{label}</span>
            </button>
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <div className="space-y-4">
          {locked ? (
            <p className="flex items-center gap-2 rounded-lg bg-muted/50 px-3.5 py-2.5 text-[12.5px] text-muted-foreground">
              <Megaphone className="h-3.5 w-3.5" /> Location and structure come from the DOAS announcement and can&rsquo;t be changed.
            </p>
          ) : null}
          <FieldGrid>
            <div className="sm:col-span-2">
              <TextareaField
                id="pw-address"
                label="Site address *"
                rows={2}
                value={site.signageSiteAddress}
                onChange={(v) => !locked && set({ signageSiteAddress: v })}
                span={false}
              />
            </div>
            <SelectField
              id="pw-council"
              label="Area council *"
              value={site.areaCouncil}
              onChange={(v) => !locked && set({ areaCouncil: v, district: "" })}
              options={AREA_COUNCILS.map((c) => ({ value: c, label: c }))}
            />
            <div>
              <TextField id="pw-district" label="District" value={site.district} onChange={(v) => set({ district: v })} hint={districts.length ? `e.g. ${districts.slice(0, 3).join(", ")}` : undefined} />
            </div>
            <TextField
              id="pw-gps"
              label="GPS coordinates"
              mono
              value={site.gpsCoordinates}
              placeholder="9.0765, 7.3986"
              onChange={(v) => !locked && set({ gpsCoordinates: v })}
              hint="Optional — Planning records the exact point at inspection."
            />
            <SelectField id="pw-type" label="Structure type *" value={site.applicationType} onChange={(v) => !locked && set({ applicationType: v })} options={STRUCTURE_TYPES} />
            <SelectField id="pw-light" label="Illumination" value={site.lightingType} onChange={(v) => set({ lightingType: v })} options={ILLUMINATION_TYPES} />
            <TextField id="pw-faces" label="Number of faces" value={site.numberOfFaces} onChange={(v) => set({ numberOfFaces: v })} />
            <TextField id="pw-dims" label="Proposed dimensions" value={site.signDimensions} placeholder="12m × 4m" onChange={(v) => set({ signDimensions: v })} />
            <SelectField
              id="pw-purpose"
              label="Purpose"
              value={site.purposeOfApplication}
              onChange={(v) => set({ purposeOfApplication: v })}
              options={["New Sign", "Upgrading of Existing Sign", "Change of Existing Sign"].map((v) => ({ value: v, label: v }))}
            />
          </FieldGrid>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-4">
          <p className="text-[13px] text-muted-foreground">
            Upload a photo montage showing the proposed structure on the site. This is the only document needed now — the structural drawing, soil test
            and EIA are requested by letter after the site inspection.
          </p>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border px-6 py-10 text-center hover:bg-muted/40">
            {uploading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : <ImagePlus className="h-6 w-6 text-muted-foreground" />}
            <span className="text-[13.5px] font-semibold text-foreground">{montage ? "Replace photo montage" : "Upload photo montage"}</span>
            <span className="text-[12px] text-muted-foreground">JPG, PNG or PDF · up to 10 MB</span>
            <input type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden" onChange={(e) => uploadMontage(e.target.files?.[0])} />
          </label>
          {montage ? (
            montage.type.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={montage.url} alt="Photo montage" className="max-h-72 rounded-lg border border-border object-contain" />
            ) : (
              <a href={montage.url} target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold text-accent underline-offset-4 hover:underline">
                {montage.name}
              </a>
            )
          ) : null}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <p className="flex items-center gap-2 rounded-lg bg-muted/50 px-3.5 py-2.5 text-[12.5px] text-muted-foreground">
            <Lock className="h-3.5 w-3.5" /> These details come from your DOAS practitioner file. If anything is wrong, ask Customer Service to update your
            file — you don&rsquo;t need to re-enter them.
          </p>
          {profile ? (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Company" value={profile.companyName} />
              <Field label="DOAS practitioner ID" value={profile.doasPractitionerId} mono />
              <Field label="RC number" value={profile.rcNumber} mono />
              <Field label="TIN" value={profile.tin} mono />
              <Field label="ARCON category" value={profile.arconCategory} />
              <Field label="ARCON licence" value={`${profile.arconLicenseNumber}${profile.arconLicenseExpiry ? ` · expires ${profile.arconLicenseExpiry}` : ""}`} />
              <Field label="Managing Director" value={profile.managingDirector} />
              <Field label="Phone" value={profile.phonePrimary} />
              <Field label="Email" value={profile.email} />
              <Field label="Head office" value={profile.hqAddress} className="col-span-2" />
            </div>
          ) : (
            <p className="text-[13px] text-[hsl(var(--state-stop))]">Your practitioner file could not be loaded.</p>
          )}
        </div>
      ) : null}

      {step === 3 ? (
        <FeePayment
          route="third"
          value={fee}
          onChange={setFee}
          payer={profile ? { name: profile.companyName, email: profile.email, phone: profile.phonePrimary } : undefined}
          uploadFolder={`portal/${portal?.uid ?? "unknown"}/fees`}
        />
      ) : null}

      {step === 4 ? (
        <div className="space-y-5">
          <div>
            <SectionLabel>Site</SectionLabel>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Address" value={site.signageSiteAddress} className="col-span-2" />
              <Field label="Area council" value={site.areaCouncil} />
              <Field label="District" value={site.district} />
              <Field label="Structure" value={typeLabel(site.applicationType)} />
              <Field label="Dimensions" value={site.signDimensions} />
              <Field label="Faces" value={site.numberOfFaces} />
              <Field label="Coordinates" value={site.gpsCoordinates} mono />
            </div>
          </div>
          <div>
            <SectionLabel>Uploads & payment</SectionLabel>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Photo montage" value={montage?.name} />
              <Field label="Application fee" value={`${naira(APPLICATION_FEE.third)} · RRR ${fee.rrr}`} />
              <Field label="Remita check" value={fee.verified ? "Confirmed" : "Receipt uploaded — CSU will confirm"} />
            </div>
          </div>
          <TextareaField id="pw-notes" label="Anything else Customer Service should know? (optional)" rows={2} value={site.notes} onChange={(v) => set({ notes: v })} />
        </div>
      ) : null}

      <div className="mt-6 flex items-center justify-between gap-2 border-t border-border pt-4">
        <ActionButton tone="quiet" icon={ChevronLeft} disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
          Back
        </ActionButton>
        {step === STEPS.length - 1 ? (
          <ActionButton icon={busy ? Loader2 : Send} disabled={busy} onClick={submit}>
            {busy ? "Submitting…" : "Submit application"}
          </ActionButton>
        ) : (
          <ActionButton icon={ChevronRight} disabled={uploading} onClick={next}>
            Continue
          </ActionButton>
        )}
      </div>
    </Panel>
  )
}
