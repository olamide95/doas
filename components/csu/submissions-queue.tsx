"use client"

import { Forward, Send } from "lucide-react"
import { DEPARTMENT, DIRECTOR_DESK, IN_FLIGHT, STATUS, stage } from "@/lib/workflow"
import { WorkQueue } from "@/components/dashboard/work-queue"

/** CSU screens intake and hands every file to the Director — never to a unit directly. */
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
          empty: { title: "Nothing waiting to be screened", body: "Portal applications land here the moment they're submitted." },
          column: { header: "Area council", render: (row) => row.areaCouncil ?? "—" },
          actions: [
            {
              key: "forward",
              label: "Documents complete — send to Director",
              icon: Forward,
              status: STATUS.withDirector,
              department: DEPARTMENT.director,
              record: "Screened by CSU — assigned to Director",
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
          statuses: [...DIRECTOR_DESK, ...IN_FLIGHT],
          empty: { title: "Nothing in progress", body: "Follow every file through each desk from here." },
          column: { header: "With", render: (row) => row.department ?? "—" },
        },
        {
          value: "issued",
          label: "Permits issued",
          routes: ["first", "third"],
          statuses: stage("issued"),
          empty: { title: "No permits issued yet", body: "Signed permits appear here for hand-over to the applicant." },
          column: { header: "Permit", render: (row) => (row.permitNumber ? <span className="font-mono text-[11.5px]">{row.permitNumber}</span> : "—") },
        },
      ]}
    />
  )
}
