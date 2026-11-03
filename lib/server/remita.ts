import crypto from "crypto"

/**
 * Server-side Remita helpers. Keys never reach the browser.
 *
 * Env (.env.local):
 *   REMITA_MERCHANT_ID         merchant id
 *   REMITA_API_KEY             API key
 *   REMITA_BASE_URL            https://login.remita.net (live) or https://demo.remita.net (demo)
 *   REMITA_SERVICE_TYPE_ID     service type for permit bills
 *   REMITA_FEE_SERVICE_TYPE_ID service type for application fees (optional — falls back to the above)
 *
 * Confirm the paths and hash schemes against your Remita integration pack.
 */

const sha512 = (value: string) => crypto.createHash("sha512").update(value).digest("hex")

export function remitaConfig() {
  const merchantId = process.env.REMITA_MERCHANT_ID ?? ""
  const apiKey = process.env.REMITA_API_KEY ?? ""
  const base = (process.env.REMITA_BASE_URL ?? "").replace(/\/+$/, "")
  const serviceTypeId = process.env.REMITA_SERVICE_TYPE_ID ?? ""
  const feeServiceTypeId = process.env.REMITA_FEE_SERVICE_TYPE_ID || serviceTypeId
  return { merchantId, apiKey, base, serviceTypeId, feeServiceTypeId, ready: Boolean(merchantId && apiKey && base) }
}

function parseJsonp(text: string) {
  return JSON.parse(text.trim().replace(/^jsonp\s*\(/, "").replace(/\)\s*;?\s*$/, ""))
}

export interface RemitaStatus {
  configured: boolean
  found?: boolean
  paid?: boolean
  amount?: number
  transactionTime?: string
  message?: string
}

export async function remitaStatus(rawRrr: string): Promise<RemitaStatus> {
  const rrr = rawRrr.replace(/\D/g, "")
  const cfg = remitaConfig()
  if (!cfg.ready) return { configured: false }
  const hash = sha512(rrr + cfg.apiKey + cfg.merchantId)
  const url = `${cfg.base}/remita/exapp/api/v1/send/api/echannelsvc/${cfg.merchantId}/${rrr}/${hash}/status.reg`
  try {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json", Authorization: `remitaConsumerKey=${cfg.merchantId},remitaConsumerToken=${hash}` },
      cache: "no-store",
    })
    const json = parseJsonp(await res.text())
    return {
      configured: true,
      found: Boolean(json.RRR ?? json.rrr),
      paid: ["00", "01"].includes(String(json.status)),
      amount: Number(json.amount ?? 0) || undefined,
      transactionTime: json.transactiontime ?? json.paymentDate ?? undefined,
      message: json.message ?? json.status,
    }
  } catch (err) {
    return { configured: true, found: false, paid: false, message: err instanceof Error ? err.message : "Remita unreachable" }
  }
}

export interface RemitaInvoice {
  configured: boolean
  rrr?: string
  orderId?: string
  amount?: number
  message?: string
  /** Fields for the browser to POST to Remita's hosted payment page. */
  pay?: { action: string; fields: Record<string, string> }
}

export async function remitaGenerate(input: {
  amount: number
  orderId: string
  payerName: string
  payerEmail: string
  payerPhone: string
  description: string
  serviceTypeId?: string
  responseUrl?: string
}): Promise<RemitaInvoice> {
  const cfg = remitaConfig()
  const serviceTypeId = input.serviceTypeId || cfg.serviceTypeId
  if (!cfg.ready || !serviceTypeId) return { configured: false }

  const amount = String(Math.round(input.amount * 100) / 100)
  const hash = sha512(cfg.merchantId + serviceTypeId + input.orderId + amount + cfg.apiKey)
  try {
    const res = await fetch(`${cfg.base}/remita/exapp/api/v1/send/api/echannelsvc/merchant/api/paymentinit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `remitaConsumerKey=${cfg.merchantId},remitaConsumerToken=${hash}` },
      body: JSON.stringify({
        serviceTypeId,
        amount,
        orderId: input.orderId,
        payerName: input.payerName,
        payerEmail: input.payerEmail,
        payerPhone: input.payerPhone,
        description: input.description,
      }),
      cache: "no-store",
    })
    const json = parseJsonp(await res.text())
    const rrr = String(json.RRR ?? json.rrr ?? "").replace(/\D/g, "")
    if (!rrr) return { configured: true, message: json.status ?? json.statusMessage ?? "Remita did not return an RRR" }
    const payHash = sha512(cfg.merchantId + rrr + cfg.apiKey)
    return {
      configured: true,
      rrr,
      orderId: input.orderId,
      amount: Number(amount),
      message: json.status ?? "Payment reference created",
      pay: {
        action: `${cfg.base}/remita/ecomm/finalize.reg`,
        fields: { merchantId: cfg.merchantId, hash: payHash, rrr, responseurl: input.responseUrl ?? "" },
      },
    }
  } catch (err) {
    return { configured: true, message: err instanceof Error ? err.message : "Remita unreachable" }
  }
}

/** Payment page fields for an RRR that already exists (e.g. one Finance generated). */
export function remitaPayFields(rawRrr: string, responseUrl = "") {
  const cfg = remitaConfig()
  const rrr = rawRrr.replace(/\D/g, "")
  if (!cfg.ready || rrr.length !== 12) return null
  return {
    action: `${cfg.base}/remita/ecomm/finalize.reg`,
    fields: { merchantId: cfg.merchantId, hash: sha512(cfg.merchantId + rrr + cfg.apiKey), rrr, responseurl: responseUrl },
  }
}
