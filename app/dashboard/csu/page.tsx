"use client"

import * as React from "react"
import { limit, orderBy } from "firebase/firestore"
import {
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  Inbox,
  LayoutDashboard,
  ListTodo,
  MessagesSquare,
  Bell,
  ScrollText,
  Users,
} from "lucide-react"
import { COL } from "@/lib/firebase"
import { STATUS, stage } from "@/lib/workflow"
import { RegisterPanel } from "@/components/shared/register-panel"
import { useMergedCollections, useRealtimeCollection } from "@/hooks/use-firestore"
import { formatDate, initials, timeAgo, toMillis, truncate } from "@/lib/format"
import { DashboardShell, type ShellNavItem } from "@/components/dashboard/shell"
import { ChatPanel } from "@/components/dashboard/chat-panel"
import { NotificationsPanel } from "@/components/dashboard/notifications-panel"
import { TasksPanel } from "@/components/dashboard/tasks-panel"
import {
  EmptyState,
  PageHeading,
  Panel,
  RowsSkeleton,
  StatTile,
  StatusPill,
  TONE,
  toneForStatus,
} from "@/components/dashboard/kit"

// These already talk to Firestore — they keep their existing import paths.
import { CsuSubmissions } from "@/components/csu/submissions-queue"
import MeetingRequestsPanel from "@/components/csu/meeting-requests-panel"
import PractitionerUploadPanel from "@/components/csu/practitioner-upload-panel"

interface SubmissionRow {
  submissionId?: string
  applicantName?: string
  companyName?: string
  applicationType?: string
  status?: string
  createdAt?: unknown
}

interface ActivityRow {
  action?: string
  comment?: string
  userId?: string
  timestamp?: unknown
}

export default function CSUDashboard() {
  const [tab, setTab] = React.useState("overview")

  const submissions = useMergedCollections<SubmissionRow>(
    [
      { path: COL.firstParty, constraints: [orderBy("createdAt", "desc"), limit(200)], tag: "first" },
      { path: COL.thirdParty, constraints: [orderBy("createdAt", "desc"), limit(200)], tag: "third" },
    ],
    (row) => toMillis(row.createdAt),
  )

  const practitioners = useRealtimeCollection<{ status?: string }>(
    COL.practitioners,
    [orderBy("timestamp", "desc"), limit(400)],
    [],
  )

  const meetings = useRealtimeCollection<{ status?: string }>(
    COL.meetings,
    [orderBy("createdAt", "desc"), limit(200)],
    [],
  )

  const activity = useRealtimeCollection<ActivityRow>(
    COL.activity,
    [orderBy("timestamp", "desc"), limit(12)],
    [],
  )

  const rows = submissions.data
  const waiting = rows.filter((r) => stage("withCsu").includes(r.status ?? "")).length
  const toRegister = rows.filter((r) => r.route === "third" && r.status === STATUS.approved).length
  const returned = rows.filter((r) =>
    [STATUS.changesRequested, STATUS.declined, "Rejected"].includes(r.status ?? ""),
  ).length
  const approved = rows.filter((r) => (r.status ?? "").toLowerCase().includes("approv")).length
  const meetingsWaiting = meetings.data.filter((m) => (m.status ?? "") === "pending").length
  const activePractitioners = practitioners.data.filter((p) => (p.status ?? "active") === "active").length

  const nav: ShellNavItem[] = [
    { value: "overview", label: "Overview", icon: LayoutDashboard },
    { value: "submissions", label: "Submissions", icon: FileText, badge: waiting + toRegister + returned },
    { value: "register", label: "Permit register", icon: ScrollText },
    { value: "meetings", label: "Meeting requests", icon: CalendarDays, badge: meetingsWaiting },
    { value: "practitioners", label: "Practitioners", icon: Users },
    { value: "chat", label: "Chat", icon: MessagesSquare },
    { value: "tasks", label: "Tasks", icon: ListTodo },
    { value: "notifications", label: "Notifications", icon: Bell },
  ]

  return (
    <DashboardShell
      audience="csu"
      unitName="Customer Service Unit"
      unitCaption="Customer Service Unit"
      nav={nav}
      active={tab}
      onNavigate={setTab}
    >
      {tab === "overview" ? (
        <div className="space-y-6">
          <PageHeading
            title="Customer Service Unit"
            description="First point of contact for signage applications. Screen what comes in, forward it to the right desk, and keep the practitioner register current."
          />

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              index={0}
              label="Waiting on your review"
              value={waiting}
              tone="wait"
              icon={Inbox}
              note="Pending and under review"
              onClick={() => setTab("submissions")}
            />
            <StatTile
              index={1}
              label="Meeting requests to screen"
              value={meetingsWaiting}
              tone="move"
              icon={CalendarDays}
              note="Not yet sent to the Director"
              onClick={() => setTab("meetings")}
            />
            <StatTile
              index={2}
              label="Approved applications"
              value={approved}
              tone="clear"
              icon={CheckCircle2}
              note="Cleared end to end"
            />
            <StatTile
              index={3}
              label="Active practitioners"
              value={activePractitioners}
              tone="idle"
              icon={BadgeCheck}
              note={`${practitioners.data.length} on the register`}
              onClick={() => setTab("practitioners")}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <Panel
              className="lg:col-span-3"
              title="Latest submissions"
              description="Newest first, across both application routes"
              actions={
                <button
                  type="button"
                  onClick={() => setTab("submissions")}
                  className="rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors hover:bg-muted"
                >
                  Open queue
                </button>
              }
              bodyClassName="p-3 sm:p-4"
            >
              {submissions.loading ? (
                <RowsSkeleton rows={5} columns={4} />
              ) : !rows.length ? (
                <EmptyState
                  icon={FileText}
                  title="No submissions yet"
                  description="Applications filed from the public portal land here the moment they're submitted."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {rows.slice(0, 6).map((row, i) => (
                    <li
                      key={`${row.source}-${row.id}`}
                      style={{ ["--i" as string]: Math.min(i, 6) }}
                      className="reveal flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted font-display text-[11.5px] font-semibold text-muted-foreground">
                        {initials(row.companyName || row.applicantName)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-medium text-foreground">
                          {row.applicantName ?? "Unnamed applicant"}
                        </p>
                        <p className="truncate text-[12px] text-muted-foreground">
                          {truncate(row.applicationType, 40)} · {formatDate(row.createdAt)}
                        </p>
                      </div>
                      <StatusPill status={row.status} />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel
              className="lg:col-span-2"
              title="Recent activity"
              description="Every decision recorded across the directorate"
              bodyClassName="p-3 sm:p-4"
            >
              {activity.loading ? (
                <RowsSkeleton rows={4} columns={2} />
              ) : !activity.data.length ? (
                <EmptyState
                  icon={ClipboardList}
                  title="No activity recorded"
                  description="Forwarding, approving or rejecting an application writes an entry here."
                />
              ) : (
                <ol className="space-y-3.5">
                  {activity.data.map((entry, i) => {
                    const tone = toneForStatus(entry.action)
                    return (
                      <li
                        key={entry.id}
                        style={{ ["--i" as string]: Math.min(i, 8) }}
                        className="reveal flex gap-3"
                      >
                        <span
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE[tone].dot}`}
                          aria-hidden
                        />
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium leading-snug text-foreground">
                            {entry.action ?? "Update"}
                          </p>
                          <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                            {entry.userId ? `${entry.userId} · ` : ""}
                            {timeAgo(entry.timestamp)}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              )}
            </Panel>
          </div>
        </div>
      ) : null}

      {tab === "submissions" ? (
        <div className="space-y-5">
          <PageHeading
            title="Submissions"
            description="Review what has been filed, then forward it to Business Development or the Director."
          />
          <CsuSubmissions />
        </div>
      ) : null}

      {tab === "register" ? (
        <div className="space-y-5">
          <PageHeading
            title="Permit register"
            description="Everyone currently holding a live DOAS permit. First-party holders are entered by the Director, third-party holders by you."
          />
          <RegisterPanel />
        </div>
      ) : null}

      {tab === "meetings" ? (
        <div className="space-y-5">
          <PageHeading
            title="Meeting requests"
            description="Screen visitor requests before they reach the Director's diary."
          />
          <MeetingRequestsPanel />
        </div>
      ) : null}

      {tab === "practitioners" ? (
        <div className="space-y-5">
          <PageHeading
            title="Practitioners"
            description="The register of licensed signage practitioners and the firms they work for."
          />
          <PractitionerUploadPanel />
        </div>
      ) : null}

      {tab === "chat" ? (
        <div className="space-y-5">
          <PageHeading title="Chat" description="Talk to the other desks without leaving the file." />
          <ChatPanel
            role="csu"
            channels={[
              { id: "director", name: "Director" },
              { id: "business_development", name: "Business Development" },
              { id: "finance", name: "Finance & Admin" },
              { id: "planning", name: "Planning & Development" },
              { id: "monitoring", name: "Monitoring & Enforcement" },
            ]}
          />
        </div>
      ) : null}

      {tab === "tasks" ? (
        <div className="space-y-5">
          <PageHeading title="Tasks" description="Follow-ups that don't belong to a single application." />
          <TasksPanel unit="CSU" />
        </div>
      ) : null}

      {tab === "notifications" || tab === "settings" ? (
        <div className="space-y-5">
          <PageHeading title="Notifications" description="Everything routed to the CSU desk." />
          <NotificationsPanel audience="csu" />
        </div>
      ) : null}
    </DashboardShell>
  )
}
