"use client"

import { FileCheck2, FileWarning, Forward, MailCheck, Receipt, Send, Stamp } from "lucide-react"
import { APPLICANT_DESK, DEPARTMENT, DIRECTOR_DESK, IN_FLIGHT, STATUS, WITH_APPLICANT, stage } from "@/lib/workflow"
import { naira } from "@/lib/format"
import { WorkQueue, type QueueAction, type SubmissionRow } from "@/components/dashboard/work-queue"

/** CSU screens intake, carries letters and documents to and from practitioners, and hands every file to the Director — never to a unit directly. */

function screeningActions(row: SubmissionRow): QueueAction[] {
  const feeOk = !row.applicationFee?.rrr || row.applicationFee.verified
  return [
    {
      key: "forward",
      label: feeOk ? "Documents complete — send to Director" : "Fee receipt checked — send to Director",
      icon: Forward,
      status: STATUS.withDirector,
      department: DEPARTMENT.director,
      record: feeOk ? "Screened by CSU — assigned to Director" : "Application fee receipt checked and screened by CSU — assigned to Director",
      patch: () => (row.applicationFee?.rrr ? { "applicationFee.confirmedByCsu": true } : {}),
      notifyApplicant: "Your application has been screened and sent to the Director",
    },
  ]
}

export function CsuSubmissions() {
  return (
    <WorkQueue
      title="Submissions"
      description="Screen what has been filed, send letters and documents, and pass every file to the Director"
      actorId="csu"
      views={[
        {
          value: "new",
          label: "To screen",
          routes: ["first", "third"],
          statuses: stage("withCsu"),
          empty: { title: "Nothing waiting to be screened", body: "Portal applications land here the moment they're submitted and the fee is paid." },
          column: {
            header: "Fee",
            render: (row) =>
              row.applicationFee?.rrr ? (
                <span className={row.applicationFee.verified ? "text-[hsl(var(--state-clear))]" : "text-[hsl(var(--state-wait))]"}>
                  {naira(row.applicationFee.amount)} · {row.applicationFee.verified ? "Remita settled" : "Check receipt"}
                </span>
              ) : (
                (row.areaCouncil ?? "—")
              ),
          },
          actionsFor: screeningActions,
        },
        {
          value: "letters",
          label: "Letters to send",
          routes: ["third"],
          statuses: stage("documentsCleared"),
          empty: { title: "No letters to send", body: "When the Director confirms a site inspection, the file comes here so you can send the documents request letter." },
          actions: [
            {
              key: "letter",
              label: "Issue documents request letter",
              icon: MailCheck,
              status: STATUS.documentsRequested,
              department: APPLICANT_DESK,
              record: "Documents request letter issued by CSU to the practitioner",
              issue: "documentsRequestLetter",
              notifyApplicant: "Upload your structural drawing, soil test and EIA",
              kind: "success",
            },
          ],
        },
        {
          value: "documents",
          label: "Documents received",
          routes: ["third"],
          statuses: stage("documentsSubmitted"),
          empty: { title: "No documents to check", body: "Structural drawings, soil tests and EIAs uploaded by practitioners arrive here." },
          actions: [
            {
              key: "incomplete",
              label: "Return — documents incomplete",
              tone: "danger",
              icon: FileWarning,
              status: STATUS.documentsRequested,
              department: APPLICANT_DESK,
              record: "Documents returned to the practitioner by CSU",
              requiresReason: true,
              kind: "error",
              notifyApplicant: "Your documents need attention",
            },
            {
              key: "docs-to-director",
              label: "Documents complete — send to Director",
              icon: FileCheck2,
              status: STATUS.documentsVerified,
              department: DEPARTMENT.director,
              record: "Technical documents confirmed by CSU — sent to the Director",
            },
          ],
        },
        {
          value: "remita",
          label: "Remita to send",
          routes: ["third"],
          statuses: stage("remitaGenerated"),
          empty: { title: "No Remita invoices to send", body: "Finance's Remita references for approved bills arrive here for you to send to the practitioner." },
          column: { header: "RRR", render: (row) => <span className="font-mono text-[11.5px]">{String(row.remita?.rrr ?? "—")}</span> },
          actions: [
            {
              key: "send-remita",
              label: "Send Remita invoice to practitioner",
              icon: Receipt,
              status: STATUS.awaitingPayment,
              department: DEPARTMENT.finance,
              record: "Remita invoice sent to the practitioner by CSU",
              notify: "finance",
              notifyApplicant: "Your bill is ready — pay through Remita",
            },
          ],
        },
        {
          value: "setting-out",
          label: "Setting-out requests",
          routes: ["third"],
          statuses: stage("settingOutRequested"),
          empty: { title: "No setting-out requests", body: "Practitioners request setting out after Finance issues their e-receipt." },
          actions: [
            {
              key: "setting-out-director",
              label: "Send request to Director",
              icon: Forward,
              status: STATUS.settingOutWithDirector,
              department: DEPARTMENT.director,
              record: "Setting-out request received by CSU — sent to the Director",
            },
          ],
        },
        {
          value: "release",
          label: "To release",
          routes: ["third"],
          statuses: [...stage("certificateIssued"), ...stage("approvalIssued")],
          empty: { title: "Nothing to release", body: "Signed setting-out certificates and approval letters come here for you to send to the practitioner." },
          actionsFor: (row) =>
            stage("certificateIssued").includes(row.status ?? "")
              ? [
                  {
                    key: "release-certificate",
                    label: "Send certificate to practitioner",
                    icon: Stamp,
                    status: STATUS.certificateReleased,
                    department: DEPARTMENT.director,
                    record: "Setting-out certificate released to the practitioner by CSU",
                    notifyApplicant: "Your setting-out certificate is ready",
                    kind: "success",
                  },
                ]
              : [
                  {
                    key: "release-approval",
                    label: "Send approval letter to practitioner",
                    icon: MailCheck,
                    status: STATUS.registered,
                    department: DEPARTMENT.csu,
                    record: "Approval letter released to the practitioner by CSU — file closed",
                    notifyApplicant: "Your approval letter is ready",
                    kind: "success",
                  },
                ],
        },
        {
          value: "returned",
          label: "Returned",
          routes: ["first", "third"],
          statuses: stage("blocked"),
          empty: { title: "Nothing sent back", body: "Declined or returned files come here with the reason attached." },
          actions: [
            {
              key: "resend",
              label: "Applicant has updated — resend",
              icon: Send,
              status: STATUS.withDirector,
              department: DEPARTMENT.director,
              record: "Updated by applicant and resent by CSU",
              requiresReason: true,
            },
          ],
        },
        {
          value: "moving",
          label: "In progress",
          routes: ["first", "third"],
          statuses: [...DIRECTOR_DESK, ...IN_FLIGHT, ...WITH_APPLICANT],
          empty: { title: "Nothing in progress", body: "Follow every file through each desk from here." },
          column: { header: "With", render: (row) => row.department ?? "—" },
        },
        {
          value: "issued",
          label: "Approved",
          routes: ["first", "third"],
          statuses: stage("issued"),
          empty: { title: "No permits issued yet", body: "Signed permits appear here for hand-over to the applicant." },
          column: { header: "Permit", render: (row) => (row.permitNumber ? <span className="font-mono text-[11.5px]">{row.permitNumber}</span> : "—") },
          actions: [],
        },
      ]}
    />
  )
}
