import crypto from "crypto"
import { NextResponse } from "next/server"

/**
 * Server-side Remita RRR status check. Keys never reach the browser.
 * Env (.env.local): REMITA_MERCHANT_ID, REMITA_API_KEY, REMITA_BASE_URL
 *   (e.g. https://login.remita.net for live, https://demo.remita.net for demo).
 * Confirm the path and hash scheme against your Remita integration pack.
 */
export async function GET(request: Request) {
  const rrr = (new URL(request.url).searchParams.get("rrr") ?? "").replace(/\D/g, "")
  if (rrr.length !== 12) return NextResponse.json({ error: "RRR must be 12 digits" }, { status: 400 })

  const merchantId = process.env.REMITA_MERCHANT_ID
  const apiKey = process.env.REMITA_API_KEY
  const base = process.env.REMITA_BASE_URL
  if (!merchantId || !apiKey || !base) return NextResponse.json({ configured: false })

  const hash = crypto.createHash("sha512").update(rrr + apiKey + merchantId).digest("hex")
  const url = `${base}/remita/exapp/api/v1/send/api/echannelsvc/${merchantId}/${rrr}/${hash}/status.reg`

  try {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json", Authorization: `remitaConsumerKey=${merchantId},remitaConsumerToken=${hash}` },
      cache: "no-store",
    })
    const text = await res.text()
    const json = JSON.parse(text.replace(/^jsonp\s*\(|\)\s*;?$/g, ""))
    const paid = ["00", "01"].includes(String(json.status))
    return NextResponse.json({
      configured: true,
      found: Boolean(json.RRR ?? json.rrr),
      paid,
      amount: Number(json.amount ?? 0) || undefined,
      transactionTime: json.transactiontime ?? json.paymentDate ?? undefined,
      message: json.message ?? json.status,
    })
  } catch (err) {
    return NextResponse.json({ configured: true, found: false, paid: false, message: err instanceof Error ? err.message : "Remita unreachable" }, { status: 502 })
  }
}
