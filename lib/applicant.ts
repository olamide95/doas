import { collection, getDocs, limit, query, where } from "firebase/firestore"
import { COL, db } from "@/lib/firebase"
import {
  MEETING_STATUS,
  STATUS,
  isBlocked,
  meetingDecided,
  stage,
  stagesFor,
} from "@/lib/workflow"

export type Route = "first" | "third"

export interface FoundApplication {
  kind: "application"
  docId: string
  route: Route
  collectionName: string
  data: Record<string, any>
}

export interface FoundMeeting {
  kind: "meeting"
  docId: string
  collectionName: string
  data: Record<string, any>
}

export type FoundRecord = FoundApplication | FoundMeeting

/**
 * Look a record up by whatever reference the person was given.
 *
 * Applications are keyed on `submissionId` (FP-… / TP-…), meeting requests on
 * `requestId` (MR-…). The old status page searched a "submissions" collection
 * that nothing writes to, and never searched meeting requests by requestId at
 * all — so a visitor with an MR reference could never track anything.
 */
export async function findRecord(reference: string): Promise<FoundRecord | null> {
  const ref = reference.trim()
  if (!ref) return null

  const applicationSources: { name: string; route: Route }[] = [
    { name: COL.firstParty, route: "first" },
    { name: COL.thirdParty, route: "third" },
  ]

  for (const source of applicationSources) {
    const snapshot = await getDocs(
      query(collection(db, source.name), where("submissionId", "==", ref), limit(1)),
    )
    if (!snapshot.empty) {
      const found = snapshot.docs[0]
      return {
        kind: "application",
        docId: found.id,
        route: source.route,
        collectionName: source.name,
        data: found.data(),
      }
    }
  }

  // Meeting requests. Older documents were saved without a requestId field,
  // so fall back to submissionId before giving up.
  for (const field of ["requestId", "submissionId"]) {
    const snapshot = await getDocs(
      query(collection(db, COL.meetings), where(field, "==", ref), limit(1)),
    )
    if (!snapshot.empty) {
      const found = snapshot.docs[0]
      return {
        kind: "meeting",
        docId: found.id,
        collectionName: COL.meetings,
        data: found.data(),
      }
    }
  }

  return null
}

/** Kept for anything still importing the old name. */
export const findSubmission = findRecord

/* ------------------------------------------------------------------ *
 * Applications
 * ------------------------------------------------------------------ */

export function isEditable(status?: string): boolean {
  return [...stage("withCsu"), STATUS.changesRequested].includes(status ?? "")
}

export function needsAttention(status?: string): boolean {
  return isBlocked(status)
}

export function awaitingPayment(status?: string): boolean {
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

  if (s === STATUS.declined || s === "Rejected") {
    return {
      tone: "stop",
      headline: "Not approved",
      body: "The Director has declined this application. The reason is below. You can file a fresh application once the issues are resolved.",
      action: "new",
    }
  }

  if (s === STATUS.changesRequested) {
    return {
      tone: "wait",
      headline: "Changes needed",
      body: "The Director has sent this back for changes. Read the reason below, update your application, and resubmit it.",
      action: "edit",
    }
  }

  if (awaitingPayment(s)) {
    return {
      tone: "wait",
      headline: "Payment due",
      body: "Your invoice is ready. Pay the total shown, then upload your proof of payment below.",
      action: "pay",
    }
  }

  if (s === STATUS.registered) {
    return {
      tone: "clear",
      headline: "Permit issued",
      body: "Your permit is approved and on the register. Keep the permit number for renewal.",
      action: "none",
    }
  }

  if (s === STATUS.approved) {
    return {
      tone: "clear",
      headline: "Approved",
      body: "The Director has approved your application. Customer Service is entering it on the register now.",
      action: "none",
    }
  }

  if (stage("withCsu").includes(s)) {
    return {
      tone: "move",
      headline: "Received",
      body: "Your application has been received and is being checked before it goes up for a decision. You can still make changes.",
      action: "edit",
    }
  }

  return {
    tone: "move",
    headline: "In progress",
    body:
      route === "first"
        ? "Your application is moving through review, site inspection and billing. The steps above show where it is."
        : "Your application is moving through review, inspection and planning review. The steps above show where it is.",
    action: "none",
  }
}

export function publicStages(route: Route) {
  return stagesFor(route).map((entry) => entry.label)
}

/* ------------------------------------------------------------------ *
 * Meeting requests
 * ------------------------------------------------------------------ */

export function meetingMessage(status?: string): ApplicantMessage {
  const s = (status ?? "").toLowerCase()

  if (s === MEETING_STATUS.declined) {
    return {
      tone: "stop",
      headline: "Not granted",
      body: "The Director isn't able to take this meeting. Any note he left is below. Customer Service can suggest another way to help.",
      action: "none",
    }
  }

  if (s === MEETING_STATUS.approved || s === MEETING_STATUS.scheduled) {
    return {
      tone: "clear",
      headline: "Meeting granted",
      body: "The Director has approved your request. Customer Service will contact you to confirm the exact time.",
      action: "none",
    }
  }

  if (s === MEETING_STATUS.completed) {
    return {
      tone: "clear",
      headline: "Meeting held",
      body: "This request is closed. File a new one if you need to see the Director again.",
      action: "none",
    }
  }

  if (s === MEETING_STATUS.withDirector) {
    return {
      tone: "move",
      headline: "With the Director",
      body: "Customer Service has passed your request to the Director. You'll see his decision here.",
      action: "none",
    }
  }

  return {
    tone: "move",
    headline: "Received",
    body: "Customer Service has your request and is reviewing it before passing it to the Director.",
    action: "none",
  }
}

export { meetingDecided }
