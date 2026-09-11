"use client"

import { Forward, Send, Stamp } from "lucide-react"
import { DEPARTMENT, STATUS, stage } from "@/lib/workflow"
import { WorkQueue } from "@/components/dashboard/work-queue"

/**
 * CSU sits at both ends of the chain: they screen what comes in, and for
 * third-party permits they're the desk that finally enters the holder in the
 * register once the Director has approved.
 */
export function CsuSubmissions() {
  return (
    <WorkQueue
      title="Submissions"
      description="Screen what has been filed, then pass it to the Director"
      actorId="csu"
      views={[
        {
          value: "new",
          label: "To screen",
          routes: ["first", "third"],
          statuses: stage("withCsu"),
          empty: {
            title: "Nothing waiting to be screened",
            body: "Applications filed from the public portal land here the moment they're submitted.",
          },
          column: {
            header: "Route",
            render: (row) => (row.route === "first" ? "First party" : "Third party"),
          },
          actions: [
            {
              key: "forward",
              label: "Send to Director",
              icon: Forward,
              status: STATUS.withDirector,
              department: DEPARTMENT.director,
              record: "Forwarded to the Director by CSU",
            },
          ],
        },
        {
          value: "returned",
          label: "Returned",
          routes: ["first", "third"],
          statuses: [STATUS.changesRequested, STATUS.declined, "Rejected"],
          empty: {
            title: "Nothing sent back",
            body: "Files the Director declines or returns for changes come here, with the reason attached.",
          },
          actions: [
            {
              key: "resend",
              label: "Applicant has updated — resend",
              icon: Send,
              status: STATUS.withDirector,
              department: DEPARTMENT.director,
              record: "Updated by the applicant and resent by CSU",
              requiresReason: true,
            },
          ],
        },
        {
          value: "register",
          label: "To register",
          routes: ["third"],
          statuses: [STATUS.approved],
          empty: {
            title: "Nothing to register",
            body: "Third-party permits the Director has approved arrive here to be entered in the register.",
          },
          actions: [
            {
              key: "register",
              label: "Register as third party",
              icon: Stamp,
              status: STATUS.registered,
              department: DEPARTMENT.csu,
              record: "Entered in the third-party register by CSU",
              kind: "success",
              register: "third-party",
            },
          ],
        },
        {
          value: "moving",
          label: "In progress",
          routes: ["first", "third"],
          statuses: [
            ...stage("withDirector"),
            ...stage("siteVisit"),
            ...stage("visitReported"),
            ...stage("awaitingPayment"),
            STATUS.paymentConfirmed,
            ...stage("recommended"),
            ...stage("inspection"),
            ...stage("inspectionReported"),
            STATUS.planningReview,
            STATUS.planningReported,
          ],
          empty: {
            title: "Nothing in progress",
            body: "Once you send a file up, you can follow it through every desk from here.",
          },
          column: { header: "With", render: (row) => row.department ?? "—" },
        },
        {
          value: "registered",
          label: "Registered",
          routes: ["first", "third"],
          statuses: [STATUS.registered],
          empty: {
            title: "No permits issued yet",
            body: "Approved permit holders appear here and in the register.",
          },
          column: {
            header: "Permit",
            render: (row) =>
              row.permitNumber ? (
                <span className="font-mono text-[11.5px]">{row.permitNumber}</span>
              ) : (
                "—"
              ),
          },
        },
      ]}
    />
  )
}
