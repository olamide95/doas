import { NextResponse } from "next/server"
import { remitaStatus } from "@/lib/server/remita"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Server-side Remita RRR status check. Keys never reach the browser.
 * Env: REMITA_MERCHANT_ID, REMITA_API_KEY, REMITA_BASE_URL (see lib/server/remita.ts).
 */
export async function GET(request: Request) {
  const rrr = (new URL(request.url).searchParams.get("rrr") ?? "").replace(/\D/g, "")
  if (rrr.length !== 12) return NextResponse.json({ error: "RRR must be 12 digits" }, { status: 400 })
  const status = await remitaStatus(rrr)
  if (status.configured && status.found === false && status.message && /unreachable|fetch|ECONN/i.test(status.message)) {
    return NextResponse.json(status, { status: 502 })
  }
  return NextResponse.json(status)
}
