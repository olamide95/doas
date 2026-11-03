"use client"

import * as React from "react"
import QRCode from "qrcode"
import JsBarcode from "jsbarcode"
import { doc, getDoc } from "firebase/firestore"
import { BadgeCheck, Loader2, Printer, ShieldAlert } from "lucide-react"
import { COL, db } from "@/lib/firebase"
import { ISSUED_META, absoluteUrl, verifyPath, type IssuedDocument } from "@/lib/issued-documents"
import { cn } from "@/lib/utils"

/** Loads one issued document by code (public single-document read). */
export function useIssuedDocument(code: string) {
  const [state, setState] = React.useState<{ loading: boolean; doc: IssuedDocument | null; error: string }>({ loading: true, doc: null, error: "" })
  React.useEffect(() => {
    if (!code) return
    let cancelled = false
    setState({ loading: true, doc: null, error: "" })
    getDoc(doc(db, COL.issuedDocuments, code))
      .then((snap) => {
        if (cancelled) return
        setState({ loading: false, doc: snap.exists() ? (snap.data() as IssuedDocument) : null, error: "" })
      })
      .catch((err) => !cancelled && setState({ loading: false, doc: null, error: err instanceof Error ? err.message : "Could not load" }))
    return () => {
      cancelled = true
    }
  }, [code])
  return state
}

export function QrImage({ value, size = 112, className }: { value: string; size?: number; className?: string }) {
  const [src, setSrc] = React.useState("")
  React.useEffect(() => {
    QRCode.toDataURL(value, { margin: 1, width: size * 2, errorCorrectionLevel: "M" })
      .then(setSrc)
      .catch(() => setSrc(""))
  }, [value, size])
  if (!src) return <div style={{ width: size, height: size }} className={cn("bg-muted", className)} />
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} width={size} height={size} alt="QR code — scan to verify this document" className={className} />
}

export function Barcode({ value, className }: { value: string; className?: string }) {
  const ref = React.useRef<SVGSVGElement>(null)
  React.useEffect(() => {
    if (!ref.current) return
    try {
      JsBarcode(ref.current, value, { format: "CODE128", height: 42, width: 1.4, fontSize: 11, margin: 0, displayValue: true, font: "monospace" })
    } catch {
      // Invalid characters for CODE128 — leave blank.
    }
  }, [value])
  return <svg ref={ref} className={className} role="img" aria-label={`Barcode ${value}`} />
}

const longDate = (iso?: string) => {
  if (!iso) return ""
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })
}

export function IssuedDocumentView({ document: d }: { document: IssuedDocument }) {
  const verifyUrl = absoluteUrl(verifyPath(d.code))
  const certificate = d.kind === "settingOutCertificate"
  const receipt = d.kind === "eReceipt"
  const revoked = d.status === "revoked"

  return (
    <article
      className={cn(
        "relative mx-auto w-full max-w-[820px] bg-white px-8 py-10 text-[13.5px] leading-relaxed text-neutral-900 shadow-sm print:max-w-none print:px-10 print:py-8 print:shadow-none sm:px-12",
        certificate && "border-[10px] border-double border-emerald-800",
      )}
    >
      {revoked ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="rotate-[-24deg] rounded-lg border-4 border-red-600 px-6 py-2 text-[48px] font-black uppercase tracking-widest text-red-600/70">Revoked</span>
        </div>
      ) : null}

      <header className="text-center">
        <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-neutral-600">Federal Capital Territory Administration</p>
        <p className="mt-1 text-[16px] font-bold uppercase tracking-wide text-emerald-900">Department of Outdoor Advertisement and Signage</p>
        <p className="text-[11.5px] text-neutral-500">Abuja, Federal Capital Territory</p>
        <div className="mx-auto mt-3 h-[3px] w-full bg-emerald-800" />
      </header>

      {certificate ? (
        <div className="mt-8 text-center">
          <p className="text-[12px] uppercase tracking-[0.3em] text-neutral-500">This certificate is issued to</p>
          <h1 className="mt-2 font-serif text-[28px] font-bold text-neutral-900">{d.holderName}</h1>
          <p className="mt-6 font-serif text-[22px] font-semibold uppercase tracking-wider text-emerald-900">{d.title}</p>
          <p className="mt-1 font-mono text-[12px] text-neutral-600">{d.reference}</p>
        </div>
      ) : (
        <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            {!receipt ? (
              <>
                <p className="font-semibold">{d.holderName}</p>
                {d.holderAddress ? <p className="max-w-[44ch] whitespace-pre-line text-neutral-700">{d.holderAddress}</p> : null}
              </>
            ) : (
              <h1 className="text-[20px] font-bold uppercase tracking-wide text-emerald-900">{d.title}</h1>
            )}
          </div>
          <div className="text-right text-[12.5px]">
            <p>
              Ref: <span className="font-mono">{d.reference}</span>
            </p>
            <p>Date: {longDate(d.issuedAt)}</p>
          </div>
        </div>
      )}

      {d.salutation && !certificate ? <p className="mt-6">{d.salutation}</p> : null}
      {d.subject && !certificate && !receipt ? <p className="mt-3 font-bold underline underline-offset-2">{d.subject}</p> : null}

      <div className={cn("mt-4 space-y-3", certificate && "text-center")}>
        {d.paragraphs.map((p, i) => (
          <p key={i} className={cn(/^\d+\./.test(p) && "pl-4")}>
            {p}
          </p>
        ))}
      </div>

      {d.facts.length ? (
        <table className="mt-6 w-full border-collapse text-[12.5px]">
          <tbody>
            {d.facts.map((f) => (
              <tr key={f.label} className="border-b border-neutral-200">
                <th className="w-[40%] py-1.5 pr-3 text-left font-semibold text-neutral-600">{f.label}</th>
                <td className="py-1.5">{f.value || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      <div className="mt-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="h-10 w-48 border-b border-neutral-800" />
          <p className="mt-1 font-semibold">{d.signatory}</p>
          <p className="text-[12px] text-neutral-600">{d.signatoryTitle}</p>
          <p className="text-[11.5px] text-neutral-500">Digitally issued {longDate(d.issuedAt)}</p>
        </div>
        <div className="flex items-end gap-4">
          <div className="text-center">
            <Barcode value={d.code} className="h-[62px] max-w-[260px]" />
          </div>
          <div className="text-center">
            <QrImage value={verifyUrl} size={104} />
            <p className="mt-1 text-[10px] text-neutral-500">Scan to verify</p>
          </div>
        </div>
      </div>

      <footer className="mt-8 border-t border-neutral-200 pt-3 text-center text-[11px] text-neutral-500">
        Verify this document at {verifyUrl.replace(/^https?:\/\//, "")} · Code {d.code} · {ISSUED_META[d.kind]?.short}
      </footer>
    </article>
  )
}

export function DocumentPage({ code }: { code: string }) {
  const { loading, doc: d, error } = useIssuedDocument(code)
  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-100">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-500" />
      </div>
    )
  if (!d)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-neutral-100 px-4 text-center">
        <ShieldAlert className="h-8 w-8 text-red-600" />
        <p className="text-[16px] font-semibold">Document not found</p>
        <p className="max-w-sm text-[13px] text-neutral-600">{error || `No DOAS document has the code ${code}. Check the code and try again.`}</p>
      </div>
    )
  return (
    <div className="min-h-screen bg-neutral-100 py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[820px] items-center justify-between gap-3 px-4 print:hidden">
        <span className={cn("inline-flex items-center gap-1.5 text-[13px] font-semibold", d.status === "revoked" ? "text-red-700" : "text-emerald-800")}>
          {d.status === "revoked" ? <ShieldAlert className="h-4 w-4" /> : <BadgeCheck className="h-4 w-4" />}
          {d.status === "revoked" ? "This document has been revoked" : "Genuine DOAS document"}
        </span>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-800 px-3 py-2 text-[13px] font-semibold text-white hover:bg-emerald-900"
        >
          <Printer className="h-4 w-4" /> Print / save PDF
        </button>
      </div>
      <IssuedDocumentView document={d} />
    </div>
  )
}
