import { NextResponse } from "next/server"
import { FieldValue } from "firebase-admin/firestore"
import { adminDb } from "@/lib/firebase-admin"
import { portalCaller } from "@/lib/server/auth"
import { remitaStatus } from "@/lib/server/remita"
import { APPLICATION_FEE, DEPARTMENT, REQUIRED_DOCUMENTS, STATUS, submissionReference } from "@/lib/workflow"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Practitioner portal actions. Every write a practitioner makes goes through
 * here so the server — not the browser — decides what changes:
 *
 *   submit          new third-party application (details come from the practitioner file)
 *   documents       structural drawing, soil test and EIA after the documents letter
 *   declarePayment  RRR + receipt for the bill Finance raised
 *   settingOut      request setting out once the e-receipt is issued
 *   meeting         meeting request with the Director (prefilled)
 */

const fail = (status: number, error: string) => NextResponse.json({ error }, { status })
const str = (v: unknown, max = 500) => String(v ?? "").trim().slice(0, max)
const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "")

function isFileUrl(url: string) {
  return /^https:\/\/(firebasestorage\.googleapis\.com|storage\.googleapis\.com|[\w.-]+\.firebasestorage\.app)\//.test(url)
}

async function notify(userId: string, content: string, referenceId: string, type = "submission") {
  await adminDb().collection("notifications").add({ userId, content, type, referenceId, isRead: false, createdAt: new Date().toISOString() })
}

async function ownedFile(docId: string, uid: string) {
  const ref = adminDb().collection("thirdPartySubmissions").doc(docId)
  const snap = await ref.get()
  if (!snap.exists) return null
  const data = snap.data() ?? {}
  if (data.practitionerUid !== uid) return null
  return { ref, data }
}

export async function POST(req: Request) {
  try {
    const caller = await portalCaller(req)
    if (!caller) return fail(401, "Your portal session has ended. Sign in again.")

    const body = await req.json().catch(() => ({}))
    const action = String(body.action ?? "")
    const now = new Date().toISOString()

    const profileSnap = await adminDb().collection("practitionerProfiles").doc(caller.practitionerId).get()
    if (!profileSnap.exists) return fail(404, "Your practitioner file could not be found. Contact Customer Service.")
    const p = profileSnap.data() ?? {}
    const company = String(p.companyName ?? "")

    /* ---------------- New application ---------------- */
    if (action === "submit") {
      const site = (body.site ?? {}) as Record<string, unknown>
      const signageSiteAddress = str(site.signageSiteAddress)
      const areaCouncil = str(site.areaCouncil, 40)
      const applicationType = str(site.applicationType, 80)
      if (!signageSiteAddress || !areaCouncil || !applicationType) return fail(400, "Site address, area council and structure type are required.")

      const photoMontage = str(body.photoMontage, 2000)
      if (!photoMontage || !isFileUrl(photoMontage)) return fail(400, "Upload the photo montage of the site.")

      const fee = (body.fee ?? {}) as Record<string, unknown>
      const rrr = digits(fee.rrr)
      if (rrr.length !== 12) return fail(400, "Enter the 12-digit Remita RRR for the application fee.")
      const receiptUrl = str(fee.receiptUrl, 2000)
      if (receiptUrl && !isFileUrl(receiptUrl)) return fail(400, "The receipt upload is not valid.")

      const reused = await adminDb().collection("thirdPartySubmissions").where("applicationFee.rrr", "==", rrr).limit(1).get()
      if (!reused.empty) return fail(409, "That RRR has already been used for another application.")

      const amount = APPLICATION_FEE.third
      const check = await remitaStatus(rrr)
      if (check.configured) {
        if (!check.paid) return fail(402, `Remita has not confirmed payment for RRR ${rrr} yet${check.message ? ` (${check.message})` : ""}. Complete the payment, then try again.`)
        if ((check.amount ?? 0) + 0.5 < amount) return fail(402, `RRR ${rrr} was paid for ${check.amount}, but the third-party application fee is ₦${amount.toLocaleString()}.`)
      } else if (!receiptUrl) {
        return fail(400, "Upload the Remita receipt so Customer Service can confirm the fee.")
      }

      let announcement: Record<string, unknown> | null = null
      const announcementId = str(body.announcementId, 120)
      if (announcementId) {
        const a = await adminDb().collection("announcements").doc(announcementId).get()
        if (a.exists && a.data()?.status === "open") announcement = a.data() ?? null
      }

      const submissionId = submissionReference("third")
      const rc = String(p.rcNumber ?? "")
      const entry = { timestamp: now, desk: "practitioner", action: "File opened from the practitioner portal — application fee paid", to: DEPARTMENT.csu, status: STATUS.withCsu }
      const doc = {
        submissionId,
        source: "practitioner-portal",
        applicantType: "Third-Party Agency",
        isFirstParty: false,
        // Practitioner details come from the practitioner file — never typed by the applicant.
        practitionerUid: caller.uid,
        practitionerId: caller.practitionerId,
        doasPractitionerId: String(p.doasPractitionerId ?? ""),
        companyName: company,
        applicantName: company,
        cacRegistrationNumber: rc,
        companyRegistrationNumber: rc,
        tin: String(p.tin ?? ""),
        corporateAddress: String(p.hqAddress ?? ""),
        companyAddress: String(p.hqAddress ?? ""),
        primaryContactName: String(p.managingDirector ?? ""),
        primaryContactPhone: String(p.phonePrimary ?? ""),
        primaryContactEmail: String(p.email ?? caller.email),
        email: String(p.email ?? caller.email),
        contactPhoneNumber: String(p.phonePrimary ?? ""),
        practitionerName: company,
        practitionerLicenseNumber: String(p.arconLicenseNumber ?? p.doasPractitionerId ?? ""),
        arconCategory: String(p.arconCategory ?? ""),
        arconLicenseExpiry: String(p.arconLicenseExpiry ?? ""),
        // Site
        signageSiteAddress,
        addressLine1: signageSiteAddress,
        areaCouncil,
        district: str(site.district, 80),
        gpsCoordinates: str(site.gpsCoordinates, 60),
        applicationType,
        lightingType: str(site.lightingType, 60),
        numberOfFaces: str(site.numberOfFaces, 10),
        signDimensions: str(site.signDimensions, 60),
        numberOfSigns: str(site.numberOfSigns, 6) || "1",
        purposeOfApplication: str(site.purposeOfApplication, 80) || "New Sign",
        practitionerNote: str(site.notes, 1000),
        announcementId: announcement ? announcementId : "",
        announcementTitle: announcement ? String(announcement.title ?? "") : "",
        files: { photoMontage },
        applicationFee: {
          amount,
          rrr,
          receiptUrl,
          verified: Boolean(check.configured && check.paid),
          verifiedAmount: check.amount ?? null,
          transactionTime: check.transactionTime ?? null,
          checkedAt: now,
        },
        status: STATUS.withCsu,
        department: DEPARTMENT.csu,
        comments: [entry],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: now,
      }
      const created = await adminDb().collection("thirdPartySubmissions").add(doc)
      await adminDb().collection("activityLogs").add({ submissionId: created.id, action: "Practitioner portal application filed", comment: submissionId, timestamp: now, userId: "practitioner" })
      await notify("csu", `New third-party application from ${company} (${submissionId})${doc.applicationFee.verified ? "" : " — application fee to confirm"}`, submissionId)
      return NextResponse.json({ id: created.id, submissionId })
    }

    /* ---------------- Technical documents ---------------- */
    if (action === "documents") {
      const owned = await ownedFile(str(body.docId, 120), caller.uid)
      if (!owned) return fail(404, "Application not found.")
      if (owned.data.status !== STATUS.documentsRequested) return fail(400, "This application isn't waiting for documents.")
      const files = (body.files ?? {}) as Record<string, unknown>
      const update: Record<string, unknown> = {}
      for (const d of REQUIRED_DOCUMENTS) {
        const url = str(files[d.key], 2000) || String(owned.data.files?.[d.key] ?? "")
        if (!url || !isFileUrl(url)) return fail(400, `Upload the ${d.label}.`)
        update[`files.${d.key}`] = url
      }
      await owned.ref.update({
        ...update,
        status: STATUS.documentsSubmitted,
        department: DEPARTMENT.csu,
        documentsSubmittedAt: now,
        updatedAt: now,
        comments: FieldValue.arrayUnion({ timestamp: now, desk: "practitioner", action: "Structural drawing, soil test and EIA uploaded by the practitioner", to: DEPARTMENT.csu, status: STATUS.documentsSubmitted }),
      })
      await notify("csu", `${company} has uploaded the technical documents for ${owned.data.submissionId}`, String(owned.data.submissionId))
      return NextResponse.json({ ok: true })
    }

    /* ---------------- Bill payment declaration ---------------- */
    if (action === "declarePayment") {
      const owned = await ownedFile(str(body.docId, 120), caller.uid)
      if (!owned) return fail(404, "Application not found.")
      if (![STATUS.awaitingPayment, STATUS.partPayment].includes(owned.data.status)) return fail(400, "No bill is waiting for payment on this application.")
      const rrr = digits(body.rrr)
      if (rrr.length !== 12) return fail(400, "Enter the 12-digit RRR you paid with.")
      const amount = Number(body.amount ?? 0)
      if (!(amount > 0)) return fail(400, "Enter the amount you paid.")
      const proofUrl = str(body.proofUrl, 2000)
      if (proofUrl && !isFileUrl(proofUrl)) return fail(400, "The receipt upload is not valid.")
      const check = await remitaStatus(rrr)
      await owned.ref.update({
        "payment.declared": {
          rrr,
          amount,
          proofUrl,
          channel: str(body.channel, 40) || "Remita_Portal",
          declaredAt: now,
          remitaPaid: check.configured ? Boolean(check.paid) : null,
          remitaAmount: check.amount ?? null,
        },
        updatedAt: now,
        comments: FieldValue.arrayUnion({ timestamp: now, desk: "practitioner", action: `Payment declared — RRR ${rrr}`, to: DEPARTMENT.finance, status: owned.data.status }),
      })
      await notify("finance", `${company} declared payment of ₦${amount.toLocaleString()} (RRR ${rrr}) for ${owned.data.submissionId}`, String(owned.data.submissionId), "info")
      return NextResponse.json({ ok: true, remita: check })
    }

    /* ---------------- Setting-out request ---------------- */
    if (action === "settingOut") {
      const owned = await ownedFile(str(body.docId, 120), caller.uid)
      if (!owned) return fail(404, "Application not found.")
      if (owned.data.status !== STATUS.receiptIssued) return fail(400, "Setting out can be requested once Finance has issued your e-receipt.")
      const request = {
        preferredDate: str(body.preferredDate, 20),
        contactName: str(body.contactName, 120) || String(p.managingDirector ?? ""),
        contactPhone: str(body.contactPhone, 30) || String(p.phonePrimary ?? ""),
        note: str(body.note, 1000),
        requestedAt: now,
      }
      if (!request.preferredDate) return fail(400, "Choose a preferred date for the setting out.")
      await owned.ref.update({
        settingOutRequest: request,
        status: STATUS.settingOutRequested,
        department: DEPARTMENT.csu,
        updatedAt: now,
        comments: FieldValue.arrayUnion({ timestamp: now, desk: "practitioner", action: "Setting out requested by the practitioner", text: request.note || "Setting out requested by the practitioner", to: DEPARTMENT.csu, status: STATUS.settingOutRequested }),
      })
      await notify("csu", `${company} has requested setting out for ${owned.data.submissionId}`, String(owned.data.submissionId))
      return NextResponse.json({ ok: true })
    }

    /* ---------------- Meeting request ---------------- */
    if (action === "meeting") {
      const purpose = str(body.purpose, 2000)
      const preferredDate = str(body.preferredDate, 20)
      if (!purpose || !preferredDate) return fail(400, "Give the purpose and a preferred date.")
      const requestId = `MR-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
      await adminDb()
        .collection("meetingRequests")
        .add({
          requestId,
          submissionId: requestId,
          source: "practitioner-portal",
          practitionerUid: caller.uid,
          practitionerId: caller.practitionerId,
          fullName: str(body.contactName, 120) || String(p.managingDirector ?? company),
          organization: company,
          email: String(p.email ?? caller.email),
          phoneNumber: String(p.phonePrimary ?? ""),
          purpose,
          preferredDate,
          preferredTime: str(body.preferredTime, 20),
          urgency: ["low", "medium", "high"].includes(String(body.urgency)) ? String(body.urgency) : "low",
          relatedApplication: str(body.relatedApplication, 60),
          status: "pending",
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: now,
        })
      await notify("csu", `Meeting request from ${company}: ${purpose.slice(0, 80)}`, requestId, "info")
      return NextResponse.json({ ok: true, requestId })
    }

    return fail(400, "Unknown action.")
  } catch (err) {
    return fail(500, err instanceof Error ? err.message : "Unexpected error")
  }
}
