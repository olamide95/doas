import { collection, getDocs, limit, query, where } from "firebase/firestore"
import { COL, db } from "@/lib/firebase"
import { MEETING_STATUS, STATUS, isBlocked, meetingDecided, stage, stagesFor } from "@/lib/workflow"

export type Route = "first" | "third"

export interface FoundApplication {
  kind: "application"
  docId: string
  route: Route
  collectionName: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>
}

export interface FoundMeeting {
  kind: "meeting"
  docId: string
  collectionName: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>
}

export type FoundRecord = FoundApplication | FoundMeeting

async function firstMatch(path: string, field: string, value: string) {
  const snap = await getDocs(query(collection(db, path), where(field, "==", value), limit(1)))
  return snap.empty ? null : snap.docs[0]
}

/** Applications only — the edit form relies on this never returning a meeting. */
export async function findSubmission(reference: string): Promise<FoundApplication | null> {
  const ref = reference.trim()
  if (!ref) return null
  const order: { name: string; route: Route }[] = ref.toUpperCase().startsWith("TP")
    ? [{ name: COL.thirdParty, route: "third" }, { name: COL.firstParty, route: "first" }]
    : [{ name: COL.firstParty, route: "first" }, { name: COL.thirdParty, route: "third" }]
  for (const source of order) {
    const hit = await firstMatch(source.name, "submissionId", ref)
    if (hit) return { kind: "application", docId: hit.id, route: source.route, collectionName: source.name, data: hit.data() }
  }
  return null
}

/** Applications first, then meeting requests (older ones were saved without requestId). */
export async function findRecord(reference: string): Promise<FoundRecord | null> {
  const ref = reference.trim()
  if (!ref) return null
  const application = await findSubmission(ref)
  if (application) return application
  for (const field of ["requestId", "submissionId"]) {
    const hit = await firstMatch(COL.meetings, field, ref)
    if (hit) return { kind: "meeting", docId: hit.id, collectionName: COL.meetings, data: hit.data() }
  }
  return null
}

export function isEditable(status?: string | null) {
  return [...stage("withCsu"), STATUS.changesRequested].includes(status ?? "")
}

export function needsAttention(status?: string | null) {
  return isBlocked(status)
}

export function awaitingPayment(status?: string | null) {
  return stage("awaitingPayment").includes(status ?? "")
}

export interface ApplicantMessage {
  tone: "stop" | "wait" | "move" | "clear"
  headline: string
  body: string
  action: "edit" | "pay" | "new" | "documents" | "settingOut" | "none"
}

export function applicantMessage(status: string | undefined, route: Route): ApplicantMessage {
  const s = status ?? ""
  const field = route === "first" ? "a Business Development officer" : "Planning & Development"
  const msg = (tone: ApplicantMessage["tone"], headline: string, body: string, action: ApplicantMessage["action"] = "none"): ApplicantMessage => ({
    tone,
    headline,
    body,
    action,
  })

  if (s === STATUS.declined || s === "Rejected")
    return msg("stop", "Not approved", "The Director has declined this application. The reason is below. You can file a fresh application once the issues are resolved.", "new")
  if (s === STATUS.changesRequested)
    return msg("stop", "Changes needed", "The Director has sent this back. Read the reason below, update your application and resubmit.", "edit")
  if (stage("withCsu").includes(s))
    return msg("wait", "Received — being screened", "Customer Service is checking your application and application fee.", route === "first" ? "edit" : "none")
  if (stage("withDirector").includes(s)) return msg("move", "With the Director", "Your file has passed screening and awaits the Director's first review.")
  if (stage("siteVisit").includes(s) || stage("planningReview").includes(s))
    return msg("wait", "Site inspection scheduled", `${field} will visit the site to inspect, measure and photograph it.`)
  if (stage("visitReported").includes(s) || stage("planningReported").includes(s))
    return msg("move", "Inspection complete", "The Director is reviewing the site inspection report.")
  if (stage("documentsCleared").includes(s))
    return msg("move", "Site cleared", "The Director has accepted the inspection. Customer Service is preparing your documents request letter.")
  if (stage("documentsRequested").includes(s))
    return msg("stop", "Upload your technical documents", "Read the letter from the Directorate, then upload the structural drawing, soil test report and EIA below.", "documents")
  if (stage("documentsSubmitted").includes(s)) return msg("wait", "Documents received", "Customer Service is checking the documents you uploaded.")
  if (stage("documentsVerified").includes(s)) return msg("move", "Documents with the Director", "The Director is confirming your documents before technical vetting.")
  if (stage("technicalVetting").includes(s))
    return msg("wait", "Technical vetting", "Planning & Development is vetting the EIA; Monitoring is vetting the soil test and structural drawing.")
  if (stage("vettingReported").includes(s)) return msg("move", "Vetting complete", "The Director is reviewing the vetting reports before your bill is prepared.")
  if (stage("billingQueried").includes(s)) return msg("move", "Measurements being rechecked", "The Director is resolving a query on the measured signage.")
  if (stage("billing").includes(s)) return msg("wait", "Your bill is being prepared", "Billing is applying the gazetted tariff to the measured signage.")
  if (stage("billProposed").includes(s)) return msg("move", "Bill awaiting sign-off", "The Director is confirming the charges.")
  if (stage("billApproved").includes(s)) return msg("move", "Remita invoice being raised", "Finance is generating the Remita reference for your bill.")
  if (stage("remitaGenerated").includes(s)) return msg("move", "Invoice on its way", "Customer Service is sending you the Remita payment reference.")
  if (s === STATUS.partPayment) return msg("stop", "Balance outstanding", "Finance has recorded part of your payment. Pay the balance and upload the new receipt.", "pay")
  if (awaitingPayment(s)) return msg("wait", "Payment due", "Pay the bill through Remita using the RRR shown, then declare the payment and upload the receipt.", "pay")
  if (stage("paymentFlagged").includes(s)) return msg("stop", "Payment under review", "There's a problem verifying your payment. Customer Service will contact you.")
  if (stage("paymentReconciled").includes(s)) return msg("move", "Payment confirmed", "Finance has verified your payment. The Director signs your permit next.")
  if (stage("receiptIssued").includes(s))
    return msg("clear", "Payment confirmed — e-receipt issued", "Your e-receipt is ready. Request setting out when you are ready for Monitoring to mark the site.", "settingOut")
  if (stage("settingOutRequested").includes(s) || stage("settingOutWithDirector").includes(s))
    return msg("move", "Setting out requested", "Your request is with the Directorate. Monitoring will contact you with the date.")
  if (stage("settingOut").includes(s)) return msg("wait", "Setting out in progress", "Monitoring & Enforcement is setting out the site.")
  if (stage("settingOutReported").includes(s)) return msg("move", "Setting out reported", "The Director is reviewing the setting-out report.")
  if (stage("certificateIssued").includes(s)) return msg("clear", "Certificate issued", "Your setting-out certificate has been signed. Customer Service is releasing it to you.")
  if (stage("certificateReleased").includes(s)) return msg("clear", "Certificate released", "Your setting-out certificate is below. The Director's approval letter follows.")
  if (stage("approvalIssued").includes(s)) return msg("clear", "Approval letter signed", "Customer Service is releasing the approval letter to you.")
  if (stage("issued").includes(s))
    return msg("clear", route === "first" ? "Permit issued" : "Approved", "Your permit is on the register. Keep the permit number for inspections and renewal.")
  return msg("move", "In progress", "The steps above show where your application is.")
}

export function publicStages(route: Route) {
  return stagesFor(route).map((e) => e.label)
}

export function meetingMessage(status?: string | null): ApplicantMessage {
  const s = (status ?? "").toLowerCase()
  if (s === MEETING_STATUS.declined)
    return { tone: "stop", headline: "Not granted", body: "The Director isn't able to take this meeting. Any note he left is below.", action: "none" }
  if (s === MEETING_STATUS.approved || s === MEETING_STATUS.scheduled)
    return { tone: "clear", headline: "Meeting granted", body: "Customer Service will contact you to confirm the exact time.", action: "none" }
  if (s === MEETING_STATUS.completed)
    return { tone: "clear", headline: "Meeting held", body: "This request is closed. File a new one if you need to see the Director again.", action: "none" }
  if (s === MEETING_STATUS.withDirector)
    return { tone: "move", headline: "With the Director", body: "Customer Service has passed your request to the Director.", action: "none" }
  return { tone: "move", headline: "Received", body: "Customer Service is reviewing your request before passing it on.", action: "none" }
}

export { meetingDecided }
