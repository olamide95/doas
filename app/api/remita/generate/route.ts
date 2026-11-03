import { NextResponse } from "next/server"
import { FieldValue } from "firebase-admin/firestore"
import { adminDb } from "@/lib/firebase-admin"
import { portalCaller, staffCaller } from "@/lib/server/auth"
import { remitaConfig, remitaGenerate, remitaPayFields } from "@/lib/server/remita"
import { APPLICATION_FEE, DEPARTMENT, STATUS } from "@/lib/workflow"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const fail = (status: number, error: string) => NextResponse.json({ error }, { status })
const tail = () => Math.random().toString(36).slice(2, 8).toUpperCase()

/**
 * Creates a Remita RRR. Amounts are always decided here, never by the browser.
 *
 *   { purpose: "application-fee", route: "first" | "third", payerName, payerEmail, payerPhone }
 *       First-party: open to the public (₦2,500). Third-party: practitioners only (₦100,000).
 *   { purpose: "bill", docId, route }
 *       Finance only. Amount is the bill the Director confirmed.
 *   { purpose: "pay-link", rrr }
 *       Hosted-payment fields for an existing RRR (practitioner or public).
 *
 * When Remita isn't configured the response is { configured: false } and the
 * caller falls back to paying on remita.net and entering the RRR by hand.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const purpose = String(body.purpose ?? "")
    const origin = new URL(req.url).origin

    if (purpose === "pay-link") {
      const pay = remitaPayFields(String(body.rrr ?? ""), `${origin}/portal`)
      return NextResponse.json({ configured: Boolean(pay), pay })
    }

    if (purpose === "application-fee") {
      const route = body.route === "third" ? "third" : "first"
      const cfg = remitaConfig()
      let payerName = String(body.payerName ?? "").trim()
      let payerEmail = String(body.payerEmail ?? "").trim()
      let payerPhone = String(body.payerPhone ?? "").trim()

      if (route === "third") {
        const caller = await portalCaller(req)
        if (!caller) return fail(403, "Sign in to the practitioner portal to pay the third-party application fee.")
        const profile = (await adminDb().collection("practitionerProfiles").doc(caller.practitionerId).get()).data() ?? {}
        payerName = String(profile.companyName ?? payerName)
        payerEmail = String(profile.email ?? caller.email ?? payerEmail)
        payerPhone = String(profile.phonePrimary ?? payerPhone)
      }
      if (!payerName || !payerEmail) return fail(400, "Payer name and email are required.")

      const amount = APPLICATION_FEE[route]
      const invoice = await remitaGenerate({
        amount,
        orderId: `DOAS-FEE-${route === "first" ? "FP" : "TP"}-${Date.now()}-${tail()}`,
        payerName,
        payerEmail,
        payerPhone,
        description: `DOAS ${route === "first" ? "first-party" : "third-party"} application fee`,
        serviceTypeId: cfg.feeServiceTypeId,
        responseUrl: route === "third" ? `${origin}/portal` : `${origin}/submission-status`,
      })
      return NextResponse.json({ ...invoice, amount })
    }

    if (purpose === "bill") {
      const caller = await staffCaller(req)
      if (!caller || ![DEPARTMENT.finance, DEPARTMENT.director].includes(caller.department as never)) return fail(403, "Only Finance can generate a bill RRR.")
      const route = body.route === "first" ? "first" : "third"
      const docId = String(body.docId ?? "")
      if (!docId) return fail(400, "Missing file id.")
      const ref = adminDb().collection(route === "first" ? "firstPartySubmissions" : "thirdPartySubmissions").doc(docId)
      const snap = await ref.get()
      if (!snap.exists) return fail(404, "File not found.")
      const d = snap.data() ?? {}
      if (![STATUS.billApproved, STATUS.awaitingPayment, STATUS.partPayment].includes(d.status)) return fail(400, `This file is at "${d.status}" — no approved bill to raise.`)
      const billing = (d.billing ?? {}) as Record<string, unknown>
      const payment = (d.payment ?? {}) as Record<string, unknown>
      const amount = d.status === STATUS.partPayment ? Number(payment.balanceDue ?? 0) : Number(billing.netInvoiceAmount ?? 0)
      if (!(amount > 0)) return fail(400, "The bill has no payable amount.")
      const invoice = await remitaGenerate({
        amount,
        orderId: `${String(billing.invoiceNumber ?? "DOAS-BILL")}-${tail()}`,
        payerName: String(d.companyName ?? d.applicantName ?? "Applicant"),
        payerEmail: String(d.primaryContactEmail ?? d.email ?? ""),
        payerPhone: String(d.primaryContactPhone ?? d.contactPhoneNumber ?? ""),
        description: `DOAS permit bill ${String(billing.invoiceNumber ?? "")} — ${String(d.submissionId ?? docId)}`,
        responseUrl: `${origin}/portal`,
      })
      if (invoice.rrr) {
        await ref.update({ "remita.lastGenerated": { rrr: invoice.rrr, amount, at: new Date().toISOString(), by: caller.uid }, updatedAt: new Date().toISOString() })
        await adminDb().collection("activityLogs").add({ submissionId: docId, action: `Remita RRR ${invoice.rrr} generated`, timestamp: new Date().toISOString(), userId: "finance", createdAt: FieldValue.serverTimestamp() })
      }
      return NextResponse.json(invoice)
    }

    return fail(400, "Unknown purpose.")
  } catch (err) {
    return fail(500, err instanceof Error ? err.message : "Unexpected error")
  }
}
