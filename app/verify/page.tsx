"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ScanLine } from "lucide-react"

/** Type (or scan with a barcode reader) the code printed on a DOAS document. */
export default function VerifyLookupPage() {
  const router = useRouter()
  const [code, setCode] = React.useState("")
  const go = (e: React.FormEvent) => {
    e.preventDefault()
    const clean = code.trim().toUpperCase()
    if (clean) router.push(`/verify/${encodeURIComponent(clean)}`)
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 px-4">
      <form onSubmit={go} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm">
        <ScanLine className="mx-auto h-9 w-9 text-emerald-800" />
        <h1 className="mt-3 text-center text-[18px] font-semibold text-neutral-900">Verify a DOAS document</h1>
        <p className="mt-1 text-center text-[13px] text-neutral-600">
          Scan the QR code on the letter, receipt or certificate — or enter the code under its barcode.
        </p>
        <input
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="DOAS-SOC-2026-XXXXXXXXXX"
          className="mt-5 w-full rounded-lg border border-neutral-300 px-3 py-2.5 font-mono text-[14px] uppercase outline-none focus:border-emerald-700"
        />
        <button type="submit" className="mt-3 w-full rounded-lg bg-emerald-800 px-3 py-2.5 text-[13px] font-semibold text-white hover:bg-emerald-900">
          Verify
        </button>
      </form>
    </div>
  )
}
