"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { BadgeCheck, ExternalLink, Loader2, ShieldAlert } from "lucide-react"
import { ISSUED_META, documentPath } from "@/lib/issued-documents"
import { useIssuedDocument } from "@/components/documents/document-view"

/** Opened by scanning a document's QR code, or from /verify. */
export default function VerifyDocumentPage() {
  const params = useParams<{ code: string }>()
  const code = decodeURIComponent(params?.code ?? "").trim().toUpperCase()
  const { loading, doc: d } = useIssuedDocument(code)

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-center text-[11.5px] font-semibold uppercase tracking-[0.18em] text-neutral-500">DOAS document verification</p>
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-neutral-500" />
          </div>
        ) : !d ? (
          <div className="py-6 text-center">
            <ShieldAlert className="mx-auto h-10 w-10 text-red-600" />
            <p className="mt-3 text-[17px] font-semibold text-neutral-900">Not a valid DOAS document</p>
            <p className="mt-1 text-[13px] text-neutral-600">
              No document was issued with the code <span className="font-mono">{code}</span>. Treat the paper as unverified and contact DOAS.
            </p>
          </div>
        ) : (
          <div className="py-4">
            <div className="text-center">
              {d.status === "revoked" ? <ShieldAlert className="mx-auto h-10 w-10 text-red-600" /> : <BadgeCheck className="mx-auto h-10 w-10 text-emerald-700" />}
              <p className={`mt-3 text-[17px] font-semibold ${d.status === "revoked" ? "text-red-700" : "text-emerald-800"}`}>
                {d.status === "revoked" ? "This document has been revoked" : "Genuine — issued by DOAS"}
              </p>
            </div>
            <dl className="mt-5 space-y-2 text-[13px]">
              {[
                ["Document", ISSUED_META[d.kind]?.title ?? d.title],
                ["Code", d.code],
                ["Reference", d.reference],
                ["Issued to", d.holderName],
                ["Site", d.siteAddress],
                ["Application", d.submissionId],
                ...(d.permitNumber ? [["Permit number", d.permitNumber]] : []),
                ...(d.validFrom && d.validTo ? [["Valid", `${d.validFrom} to ${d.validTo}`]] : []),
                ["Issued", new Date(d.issuedAt).toLocaleString("en-NG")],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-neutral-100 pb-1.5">
                  <dt className="text-neutral-500">{k}</dt>
                  <dd className="text-right font-medium text-neutral-900">{v}</dd>
                </div>
              ))}
            </dl>
            <Link
              href={documentPath(d.code)}
              className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-800 px-3 py-2.5 text-[13px] font-semibold text-white hover:bg-emerald-900"
            >
              View the full document <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
        <p className="mt-4 text-center text-[12px] text-neutral-500">
          <Link href="/verify" className="underline underline-offset-4">
            Check another code
          </Link>
        </p>
      </div>
    </div>
  )
}
