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
  action: "edit" | "pay" | "new" | "none"
}

export function applicantMessage(status: string | undefined, route: Route): ApplicantMessage {
  const s = status ?? ""
  const field = route === "first" ? "a Business Development officer" : "Planning's engineers"
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
  if (stage("withCsu").includes(s)) return msg("wait", "Received — being screened", "Customer Service is checking your documents. You can still edit the application.", "edit")
  if (stage("withDirector").includes(s)) return msg("move", "With the Director", "Your file has passed screening and awaits the Director's first review.")
  if (stage("siteVisit").includes(s) || stage("planningReview").includes(s))
    return msg("wait", "Site inspection scheduled", `${field} will visit the site to measure and photograph the signage.`)
  if ([...stage("visitReported"), ...stage("planningReported"), ...stage("billingQueried")].includes(s))
    return msg("move", "Inspection complete", "The Director is checking the inspection findings before your bill is prepared.")
  if (stage("billing").includes(s)) return msg("wait", "Your bill is being prepared", "Billing is applying the gazetted tariff to the measured signage.")
  if (stage("billProposed").includes(s)) return msg("move", "Bill awaiting sign-off", "The Director is confirming the charges. Your invoice appears here once approved.")
  if (s === STATUS.partPayment) return msg("stop", "Balance outstanding", "Finance has recorded part of your payment. Pay the balance below and upload the new receipt.", "pay")
  if (awaitingPayment(s)) return msg("wait", "Payment due", "Pay via Remita or at the bank, then declare your RRR and upload the receipt below.", "pay")
  if (stage("paymentFlagged").includes(s)) return msg("stop", "Payment under review", "There's a problem verifying your payment. Customer Service will contact you.")
  if (stage("paymentReconciled").includes(s)) return msg("move", "Payment confirmed", "Finance has verified your payment. The Director signs your permit next.")
  if (stage("issued").includes(s)) return msg("clear", "Permit issued", "Your permit is on the register. Keep the permit number for inspections and renewal.")
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
