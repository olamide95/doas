"use client"

import * as React from "react"
import { Award, Ban, Copy, ExternalLink, Loader2, Pencil, RotateCcw, Save, Search } from "lucide-react"
import { auth } from "@/lib/firebase"
import { documentPath } from "@/lib/issued-documents"
import {
  cleanLicenceInput,
  formatIssueDate,
  licenceVerifyUrl,
  normaliseHolderName,
  todayIso,
  validateLicenceInput,
  type LicenceErrors,
  type LicenceInput,
  type LicenceSummary,
} from "@/lib/practising-licence"
import { formatDateTime } from "@/lib/format"
import { toast } from "@/components/ui/toast"
import { Sheet } from "@/components/dashboard/sheet"
import { ActionButton } from "@/components/dashboard/form-kit"
import { EmptyState, Field, SectionLabel, StatusPill } from "@/components/dashboard/kit"
import { TextInput } from "@/components/dashboard/practitioners/registry-fields"
import { LicenceCertificate, useInlineLogo } from "@/components/documents/licence-certificate"
import { cn } from "@/lib/utils"

/**
 * Practising licence for one practitioner, generated from their registry file
 * by CSU or the Director once the practitioner has been validated.
 *
 * Staff type the name as it should appear, the licence number and the date of
 * issue. The certificate, its verification code and its QR code are produced
 * by /api/practitioners/licence. The same three fields can be corrected
 * afterwards; the QR code on copies already printed keeps working and shows
 * the corrected details.
 */

export interface LicenceFields {
  id: string
  companyName: string
  doasPractitionerId?: string
  practisingLicence?: LicenceSummary
}

class LicenceRequestError extends Error {
  fields?: Record<string, string>
}

async function call(method: "POST" | "PATCH", body: Record<string, unknown>): Promise<{ licence: LicenceSummary; unchanged?: boolean }> {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error("Your session has ended. Sign in again and retry.")
  const res = await fetch("/api/practitioners/licence", {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new LicenceRequestError(json.error ?? `Request failed (${res.status})`)
    err.fields = json.fields
    throw err
  }
  return json
}

function draftFor(profile: LicenceFields): LicenceInput {
  const licence = profile.practisingLicence
  return {
    holderName: licence?.holderName ?? normaliseHolderName(profile.companyName ?? ""),
    licenceNumber: licence?.licenceNumber ?? "",
    issueDate: licence?.issueDate ?? todayIso(),
  }
}

export function PractisingLicencePanel({ profile, heading = true }: { profile: LicenceFields; heading?: boolean }) {
  const licence = profile.practisingLicence
  const logo = useInlineLogo()
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState<LicenceInput>(() => draftFor(profile))
  const [errors, setErrors] = React.useState<LicenceErrors>({})
  const [busy, setBusy] = React.useState(false)
  const [revoking, setRevoking] = React.useState(false)
  const [reason, setReason] = React.useState("")

  // A different practitioner was opened: start clean.
  React.useEffect(() => {
    setEditing(false)
    setRevoking(false)
    setReason("")
    setErrors({})
    setDraft(draftFor(profile))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id])

  const set = <K extends keyof LicenceInput>(key: K, value: LicenceInput[K]) => {
    setDraft((d) => ({ ...d, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const form = !licence || editing
  const idp = `lic-${profile.id}`

  const submit = async () => {
    if (busy) return
    const clean = cleanLicenceInput(draft)
    setDraft(clean)
    const found = validateLicenceInput(clean)
    if (Object.keys(found).length) {
      setErrors(found)
      toast.warning({ title: "Check the licence details", description: Object.values(found)[0] })
      return
    }
    setBusy(true)
    try {
      if (licence) {
        const res = await call("PATCH", { practitionerId: profile.id, ...clean })
        setEditing(false)
        if (res.unchanged) toast.info({ title: "Nothing to change", description: "The licence already carries these details." })
        else toast.success({ title: "Licence corrected", description: "The certificate and the verification page now show the new details." })
      } else {
        const res = await call("POST", { practitionerId: profile.id, ...clean })
        toast.success({ title: "Practising licence generated", description: `${res.licence.holderName} · ${res.licence.licenceNumber}` })
      }
    } catch (err) {
      const fields = err instanceof LicenceRequestError ? err.fields : undefined
      if (fields) setErrors(fields as LicenceErrors)
      toast.error({ title: licence ? "Not corrected" : "Not generated", description: err instanceof Error ? err.message : "Try again." })
    } finally {
      setBusy(false)
    }
  }

  const setStatus = async (status: "valid" | "revoked") => {
    if (busy) return
    if (status === "revoked" && reason.trim().length < 5) {
      toast.warning({ title: "Give a reason", description: "It is recorded on the licence history." })
      return
    }
    setBusy(true)
    try {
      await call("PATCH", { practitionerId: profile.id, status, reason: reason.trim() })
      setRevoking(false)
      setReason("")
      toast.success({
        title: status === "revoked" ? "Licence revoked" : "Licence restored",
        description: status === "revoked" ? "Anyone who scans the QR code will now see it is revoked." : "The QR code shows it as valid again.",
      })
    } catch (err) {
      toast.error({ title: "Not done", description: err instanceof Error ? err.message : "Try again." })
    } finally {
      setBusy(false)
    }
  }

  const copyLink = async () => {
    if (!licence) return
    try {
      await navigator.clipboard.writeText(licenceVerifyUrl(licence.code))
      toast.success({ title: "Verification link copied" })
    } catch {
      toast.warning({ title: "Copy blocked", description: licenceVerifyUrl(licence.code) })
    }
  }

  // The preview shows the details exactly as they will be saved.
  const shown: LicenceInput = form ? cleanLicenceInput(draft) : (licence as LicenceSummary)

  return (
    <div>
      {heading ? <SectionLabel>Practising licence</SectionLabel> : null}

      {licence && !editing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Licence No." value={licence.licenceNumber} mono />
            <Field label="Status" value={<StatusPill status={licence.status === "revoked" ? "Revoked" : "Valid"} tone={licence.status === "revoked" ? "stop" : "clear"} />} />
            <Field label="Name on licence" value={licence.holderName} className="col-span-2" />
            <Field label="Date of issue" value={formatIssueDate(licence.issueDate)} />
            <Field label="Verification code" value={licence.code} mono />
            <Field
              label="Generated by"
              value={`${licence.issuedBy}${licence.updatedAt ? ` · last changed ${formatDateTime(licence.updatedAt)}` : ""}`}
              className="col-span-2"
            />
            {licence.status === "revoked" && licence.revokedReason ? <Field label="Reason revoked" value={licence.revokedReason} className="col-span-2" /> : null}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[12.5px] text-muted-foreground">
            {licence
              ? "Correct what is printed on the licence. The QR code stays the same, so copies already printed will show the corrected details when scanned."
              : "Generate the practising licence once this practitioner has been validated. Check the name and enter the licence number exactly as it should be printed."}
          </p>
          <TextInput
            id={`${idp}-name`}
            label="Practitioner name on the licence"
            required
            value={draft.holderName}
            onChange={(v) => set("holderName", v)}
            onBlur={() => set("holderName", normaliseHolderName(draft.holderName))}
            error={errors.holderName}
            hint="Printed in capitals. Taken from the practitioner's file — correct it here if needed."
            disabled={busy}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput
              id={`${idp}-number`}
              label="Licence No."
              required
              value={draft.licenceNumber}
              onChange={(v) => set("licenceNumber", v)}
              error={errors.licenceNumber}
              placeholder="e.g. 1294060/0229"
              hint="Each licence number can be used once."
              disabled={busy}
            />
            <TextInput
              id={`${idp}-date`}
              label="Date of issue"
              type="date"
              required
              value={draft.issueDate}
              onChange={(v) => set("issueDate", v)}
              error={errors.issueDate}
              disabled={busy}
            />
          </div>
        </div>
      )}

      {/* The certificate exactly as it will print */}
      <div className="mt-3 overflow-hidden rounded-lg border border-border bg-white">
        <LicenceCertificate
          logoSrc={logo}
          holderName={shown.holderName}
          licenceNumber={shown.licenceNumber}
          issueDate={shown.issueDate}
          verifyUrl={licence && !editing ? licenceVerifyUrl(licence.code) : undefined}
          code={licence?.code}
          status={licence && !editing ? licence.status : "valid"}
          preview={form}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {form ? (
          <>
            <ActionButton icon={busy ? Loader2 : licence ? Save : Award} disabled={busy} onClick={submit}>
              {busy ? "Working…" : licence ? "Save correction" : "Generate licence"}
            </ActionButton>
            {licence ? (
              <ActionButton
                tone="quiet"
                disabled={busy}
                onClick={() => {
                  setEditing(false)
                  setErrors({})
                  setDraft(draftFor(profile))
                }}
              >
                Cancel
              </ActionButton>
            ) : null}
          </>
        ) : licence ? (
          <>
            <a
              href={documentPath(licence.code)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[13px] font-semibold text-primary-foreground transition-colors hover:opacity-90"
            >
              <ExternalLink className="h-4 w-4" aria-hidden /> Open / print licence
            </a>
            <ActionButton tone="quiet" icon={Copy} onClick={copyLink}>
              Copy verify link
            </ActionButton>
            <ActionButton
              tone="quiet"
              icon={Pencil}
              disabled={busy}
              onClick={() => {
                setDraft(draftFor(profile))
                setErrors({})
                setRevoking(false)
                setEditing(true)
              }}
            >
              Correct details
            </ActionButton>
            {licence.status === "revoked" ? (
              <ActionButton tone="quiet" icon={busy ? Loader2 : RotateCcw} disabled={busy} onClick={() => setStatus("valid")}>
                Restore licence
              </ActionButton>
            ) : (
              <ActionButton tone="danger" icon={Ban} disabled={busy} onClick={() => setRevoking((v) => !v)}>
                Revoke
              </ActionButton>
            )}
          </>
        ) : null}
      </div>

      {revoking && licence && licence.status !== "revoked" && !editing ? (
        <div className="mt-3 space-y-2 rounded-lg border border-[hsl(var(--state-stop))]/30 bg-[hsl(var(--state-stop-soft))] px-3.5 py-3">
          <TextInput
            id={`${idp}-reason`}
            label="Reason for revoking"
            required
            value={reason}
            onChange={setReason}
            placeholder="e.g. Issued in error"
            hint="The QR code will show this licence as revoked. You can restore it later."
            disabled={busy}
          />
          <div className="flex flex-wrap gap-2">
            <ActionButton tone="danger" icon={busy ? Loader2 : Ban} disabled={busy} onClick={() => setStatus("revoked")}>
              Confirm revoke
            </ActionButton>
            <ActionButton tone="quiet" disabled={busy} onClick={() => setRevoking(false)}>
              Keep licence
            </ActionButton>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Licence register — every practitioner and whether they hold a licence
 * ------------------------------------------------------------------ */

type LicenceFilter = "all" | "issued" | "none" | "revoked"

export function LicenceRegister({ profiles, search }: { profiles: LicenceFields[]; search: string }) {
  const [filter, setFilter] = React.useState<LicenceFilter>("all")
  const [openId, setOpenId] = React.useState<string | null>(null)

  const counts = React.useMemo(() => {
    let issued = 0
    let revoked = 0
    profiles.forEach((p) => {
      if (p.practisingLicence?.status === "revoked") revoked += 1
      else if (p.practisingLicence) issued += 1
    })
    return { issued, revoked, none: profiles.length - issued - revoked }
  }, [profiles])

  const term = search.trim().toLowerCase()
  const rows = React.useMemo(
    () =>
      profiles.filter((p) => {
        const l = p.practisingLicence
        const pass =
          filter === "all" || (filter === "issued" && !!l && l.status !== "revoked") || (filter === "none" && !l) || (filter === "revoked" && l?.status === "revoked")
        if (!pass) return false
        if (!term) return true
        return [p.companyName, p.doasPractitionerId, l?.licenceNumber, l?.holderName, l?.code].some((v) => !!v && v.toLowerCase().includes(term))
      }),
    [profiles, filter, term],
  )

  const current = openId ? profiles.find((p) => p.id === openId) ?? null : null
  const tabs: { value: LicenceFilter; label: string }[] = [
    { value: "all", label: `All (${profiles.length})` },
    { value: "none", label: `To generate (${counts.none})` },
    { value: "issued", label: `Licensed (${counts.issued})` },
    { value: "revoked", label: `Revoked (${counts.revoked})` },
  ]

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {tabs.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setFilter(t.value)}
            aria-pressed={filter === t.value}
            className={cn(
              "rounded-lg border px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors",
              filter === t.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!rows.length ? (
        <EmptyState
          icon={term ? Search : Award}
          title={term ? "No practitioner matches that search" : filter === "none" ? "Every practitioner on file has a licence" : "Nothing here yet"}
          description="Practitioners come from the registry. Add the practitioner's file first, then generate their licence."
        />
      ) : (
        <ul className="space-y-2">
          {rows.map((p, i) => {
            const l = p.practisingLicence
            return (
              <li key={p.id} style={{ ["--i" as string]: Math.min(i, 8) }} className="reveal">
                <div className="flex flex-col gap-2 rounded-lg border border-border bg-card px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-semibold text-foreground">{l?.holderName || p.companyName}</p>
                    <p className="text-[12px] text-muted-foreground">
                      {l ? (
                        <>
                          Licence No. <span className="font-mono text-foreground">{l.licenceNumber}</span> · issued {formatIssueDate(l.issueDate)}
                        </>
                      ) : (
                        <>
                          <span className="font-mono">{p.doasPractitionerId}</span> · no licence generated
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {l ? <StatusPill status={l.status === "revoked" ? "Revoked" : "Licensed"} tone={l.status === "revoked" ? "stop" : "clear"} /> : null}
                    {l ? (
                      <a
                        href={documentPath(l.code)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted"
                      >
                        <ExternalLink className="h-4 w-4" aria-hidden /> Print
                      </a>
                    ) : null}
                    <ActionButton tone={l ? "quiet" : "primary"} icon={l ? Pencil : Award} onClick={() => setOpenId(p.id)}>
                      {l ? "Manage" : "Generate licence"}
                    </ActionButton>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Sheet
        open={!!current}
        onClose={() => setOpenId(null)}
        title="Practising licence"
        caption={current ? `${current.companyName}${current.doasPractitionerId ? ` · ${current.doasPractitionerId}` : ""}` : ""}
        width="max-w-3xl"
        footer={
          <div className="flex justify-end">
            <ActionButton tone="quiet" onClick={() => setOpenId(null)}>
              Close
            </ActionButton>
          </div>
        }
      >
        {current ? <PractisingLicencePanel profile={current} heading={false} /> : null}
      </Sheet>
    </div>
  )
}
