"use client"

import * as React from "react"
import { limit, orderBy } from "firebase/firestore"
import {
  BarChart3,
  BadgeCheck,
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  Gavel,
  LayoutDashboard,
  ListTodo,
  MapPinned,
  MessagesSquare,
  ScrollText,
  ShieldAlert,
  Users,
} from "lucide-react"
import { COL } from "@/lib/firebase"
import { DEPARTMENT, STATUS, channelsFor, stage } from "@/lib/workflow"
import { useRealtimeCollection } from "@/hooks/use-firestore"
import { timeAgo } from "@/lib/format"
import { DashboardShell, type ShellNavItem } from "@/components/dashboard/shell"
import { ChatPanel } from "@/components/dashboard/chat-panel"
import { NotificationsPanel } from "@/components/dashboard/notifications-panel"
import { TasksPanel } from "@/components/dashboard/tasks-panel"
import { useSubmissions } from "@/components/dashboard/work-queue"
import { DirectorMeetings, DirectorSubmissions } from "@/components/director/review-panels"
import { DirectorateReport } from "@/components/director/oversight-panel"
import { CompliancePanel } from "@/components/monitoring/compliance-panel"
import { StaffPanel } from "@/components/shared/staff-panel"
import { RegisterPanel } from "@/components/shared/register-panel"
import {
  EmptyState,
  PageHeading,
  Panel,
  RowsSkeleton,
  StatTile,
  TONE,
  toneForStatus,
} from "@/components/dashboard/kit"

// The practitioner register already talks to Firestore and keeps its path.
import PractitionerUploadPanel from "@/components/csu/practitioner-upload-panel"

interface ActivityRow {
  action?: string
  userId?: string
  timestamp?: unknown
}

export default function DirectorDashboard() {
  const [tab, setTab] = React.useState("overview")
  const { rows } = useSubmissions()

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

  const issues = useRealtimeCollection<{ status?: string }>(
    "complianceIssues",
    [orderBy("createdAt", "desc"), limit(200)],
    [],
  )

  const decisionStatuses = [
    ...stage("withDirector"),
    ...stage("inspectionReported"),
    ...stage("recommended"),
    STATUS.planningReported,
  ]
  const awaitingDecision = rows.filter((row) => decisionStatuses.includes(row.status ?? "")).length
  const reportsIn = rows.filter((row) =>
    [...stage("inspectionReported"), STATUS.planningReported, ...stage("recommended")].includes(
      row.status ?? "",
    ),
  ).length
  const approved = rows.filter((row) =>
    [STATUS.approved, STATUS.registered].includes(row.status ?? ""),
  ).length
  const meetingsWaiting = meetings.data.filter((m) => m.status === "forwarded").length
  const openIssues = issues.data.filter((issue) => issue.status !== "Resolved").length

  const nav: ShellNavItem[] = [
    { value: "overview", label: "Overview", icon: LayoutDashboard },
    { value: "applications", label: "Applications", icon: FileText, badge: awaitingDecision },
    { value: "meetings", label: "Meeting requests", icon: CalendarDays, badge: meetingsWaiting },
    { value: "reports", label: "Reports", icon: BarChart3 },
    { value: "register", label: "Permit register", icon: ScrollText },
    { value: "practitioners", label: "Practitioners", icon: BadgeCheck },
    { value: "compliance", label: "Compliance", icon: ShieldAlert, badge: openIssues },
    { value: "staff", label: "Staff", icon: Users },
    { value: "chat", label: "Chat", icon: MessagesSquare },
    { value: "tasks", label: "Tasks", icon: ListTodo },
    { value: "notifications", label: "Notifications", icon: Bell },
  ]

  return (
    <DashboardShell
      audience="director"
      unitName="Director's Office"
      unitCaption="Director's Office"
      nav={nav}
      active={tab}
      onNavigate={setTab}
    >
      {tab === "overview" ? (
        <div className="space-y-6">
          <PageHeading
            title="Director's Office"
            description="Final say on signage permits. Approve, reject, or route an application to the unit that needs to look at it next."
          />

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              index={0}
              label="Awaiting your decision"
              value={awaitingDecision}
              tone="wait"
              icon={Gavel}
              note="Forwarded from CSU and other desks"
              onClick={() => setTab("applications")}
            />
            <StatTile
              index={1}
              label="Reports back for a decision"
              value={reportsIn}
              tone="move"
              icon={MapPinned}
              note="From Monitoring, Planning and Business Development"
              onClick={() => setTab("applications")}
            />
            <StatTile
              index={2}
              label="Meeting requests"
              value={meetingsWaiting}
              tone="move"
              icon={CalendarDays}
              note="Screened by CSU"
              onClick={() => setTab("meetings")}
            />
            <StatTile
              index={3}
              label="Permits approved"
              value={approved}
              tone="clear"
              icon={CheckCircle2}
              note={`${rows.length} applications on file`}
              onClick={() => setTab("reports")}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <DirectorSubmissions />
            </div>

            <Panel
              className="lg:col-span-2"
              title="Recent activity"
              description="Decisions recorded across the directorate"
              bodyClassName="p-3 sm:p-4"
            >
              {activity.loading ? (
                <RowsSkeleton rows={5} columns={2} />
              ) : !activity.data.length ? (
                <EmptyState
                  icon={ClipboardList}
                  title="No activity recorded"
                  description="Every approval, rejection and hand-off writes an entry here."
                />
              ) : (
                <ol className="space-y-3.5">
                  {activity.data.map((entry, i) => (
                    <li
                      key={entry.id}
                      style={{ ["--i" as string]: Math.min(i, 8) }}
                      className="reveal flex gap-3"
                    >
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE[toneForStatus(entry.action)].dot}`}
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
                  ))}
                </ol>
              )}
            </Panel>
          </div>
        </div>
      ) : null}

      {tab === "applications" ? (
        <div className="space-y-5">
          <PageHeading
            title="Applications"
            description="Approve, reject, or send an application on to Business Development, Monitoring or Planning."
          />
          <DirectorSubmissions />
        </div>
      ) : null}

      {tab === "meetings" ? (
        <div className="space-y-5">
          <PageHeading
            title="Meeting requests"
            description="Visitors CSU has screened and forwarded for your decision."
          />
          <DirectorMeetings />
        </div>
      ) : null}

      {tab === "reports" ? (
        <div className="space-y-5">
          <PageHeading
            title="Reports"
            description="Where the work is sitting, what has stalled, and what the directorate has collected. Everything here is counted from live records."
          />
          <DirectorateReport />
        </div>
      ) : null}

      {tab === "register" ? (
        <div className="space-y-5">
          <PageHeading
            title="Permit register"
            description="Live permits and their expiry dates. First-party holders land here the moment you approve them."
          />
          <RegisterPanel />
        </div>
      ) : null}

      {tab === "practitioners" ? (
        <div className="space-y-5">
          <PageHeading
            title="Practitioners"
            description="The register of licensed signage practitioners. Suspend a licence here and it stops them filing on behalf of clients."
          />
          <PractitionerUploadPanel />
        </div>
      ) : null}

      {tab === "compliance" ? (
        <div className="space-y-5">
          <PageHeading
            title="Compliance"
            description="Boards flagged by Monitoring as expired, unsafe or altered without approval."
          />
          <CompliancePanel unit={DEPARTMENT.director} />
        </div>
      ) : null}

      {tab === "staff" ? (
        <div className="space-y-5">
          <PageHeading
            title="Staff"
            description="Everyone on the directorate roll, and which desk they work. Suspending access takes effect immediately."
          />
          <StaffPanel />
        </div>
      ) : null}

      {tab === "chat" ? (
        <div className="space-y-5">
          <PageHeading title="Chat" description="Talk to any desk in the directorate." />
          <ChatPanel role="director" channels={channelsFor("director")} />
        </div>
      ) : null}

      {tab === "tasks" ? (
        <div className="space-y-5">
          <PageHeading title="Tasks" description="Assign follow-ups to staff across the units." />
          <TasksPanel unit={DEPARTMENT.director} />
        </div>
      ) : null}

      {tab === "notifications" || tab === "settings" ? (
        <div className="space-y-5">
          <PageHeading title="Notifications" description="Everything routed to the Director's desk." />
          <NotificationsPanel audience="director" />
        </div>
      ) : null}
    </DashboardShell>
  )
}
