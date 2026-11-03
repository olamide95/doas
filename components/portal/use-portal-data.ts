"use client"

import * as React from "react"
import { limit, where } from "firebase/firestore"
import { COL } from "@/lib/firebase"
import { PRACTITIONER_COL, type SiteFile } from "@/lib/practitioner-registry"
import { CSU_DESK, DIRECTOR_DESK, IN_FLIGHT, stage } from "@/lib/workflow"
import { toMillis } from "@/lib/format"
import { useRealtimeCollection } from "@/hooks/use-firestore"
import type { IssuedDocument } from "@/lib/issued-documents"
import type { SubmissionRow } from "@/components/dashboard/work-queue"
import type { Announcement } from "@/components/shared/announcements-panel"
import { isOpen } from "@/components/shared/announcements-panel"
import { usePortal } from "@/components/auth/portal-context"

/** Everything the practitioner portal reads. Every query is scoped to the signed-in practitioner. */

export function usePortalApplications() {
  const { portal } = usePortal()
  const uid = portal?.uid ?? null
  const { data, loading, error } = useRealtimeCollection<Omit<SubmissionRow, "id" | "route">>(
    uid ? COL.thirdParty : null,
    uid ? [where("practitionerUid", "==", uid), limit(300)] : [],
    [uid],
  )
  const rows = React.useMemo(
    () => (data.map((r) => ({ ...r, route: "third" as const })) as SubmissionRow[]).sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)),
    [data],
  )
  return { rows, loading, error }
}

/** Statuses where the practitioner has to do something. */
export function needsPractitioner(row: SubmissionRow) {
  const s = row.status ?? ""
  return [...stage("documentsRequested"), ...stage("awaitingPayment"), ...stage("receiptIssued"), ...stage("blocked")].includes(s)
}

export function inProgress(row: SubmissionRow) {
  const s = row.status ?? ""
  return [...CSU_DESK, ...DIRECTOR_DESK, ...IN_FLIGHT].includes(s) && !needsPractitioner(row)
}

export function useOpenAnnouncements() {
  const { data, loading, error } = useRealtimeCollection<Announcement>(COL.announcements, [where("status", "==", "open"), limit(200)], [])
  const rows = React.useMemo(() => data.filter((a) => isOpen(a)).sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)), [data])
  return { rows, loading, error }
}

export function usePortalDocuments() {
  const { portal } = usePortal()
  const uid = portal?.uid ?? null
  const { data, loading, error } = useRealtimeCollection<IssuedDocument>(
    uid ? COL.issuedDocuments : null,
    uid ? [where("practitionerUid", "==", uid), limit(300)] : [],
    [uid],
  )
  const rows = React.useMemo(() => [...data].sort((a, b) => toMillis(b.issuedAt) - toMillis(a.issuedAt)), [data])
  return { rows, loading, error }
}

export interface PortalMeeting {
  requestId?: string
  purpose?: string
  preferredDate?: string
  preferredTime?: string
  urgency?: string
  status?: string
  directorComment?: string
  notes?: string
  createdAt?: unknown
}

export function usePortalMeetings() {
  const { portal } = usePortal()
  const uid = portal?.uid ?? null
  const { data, loading, error } = useRealtimeCollection<PortalMeeting>(
    uid ? COL.meetings : null,
    uid ? [where("practitionerUid", "==", uid), limit(100)] : [],
    [uid],
  )
  const rows = React.useMemo(() => [...data].sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)), [data])
  return { rows, loading, error }
}

export function usePortalSites() {
  const { portal } = usePortal()
  const pid = portal?.practitionerId ?? null
  return useRealtimeCollection<SiteFile>(pid ? PRACTITIONER_COL.sites : null, pid ? [where("practitionerId", "==", pid), limit(1000)] : [], [pid])
}
