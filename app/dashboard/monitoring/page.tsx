"use client"

import * as React from "react"
import {
  Bell,
  ClipboardCheck,
  LayoutDashboard,
  ListTodo,
  MessagesSquare,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react"
import { limit, orderBy } from "firebase/firestore"
import { DEPARTMENT, STATUS, channelsFor, stage } from "@/lib/workflow"
import { useRealtimeCollection } from "@/hooks/use-firestore"
import { DashboardShell, type ShellNavItem } from "@/components/dashboard/shell"
import { ChatPanel } from "@/components/dashboard/chat-panel"
import { NotificationsPanel } from "@/components/dashboard/notifications-panel"
import { TasksPanel } from "@/components/dashboard/tasks-panel"
import { PageHeading, StatTile } from "@/components/dashboard/kit"
import { useSubmissions } from "@/components/dashboard/work-queue"
import { MonitoringQueue } from "@/components/monitoring/review-panel"
import { CompliancePanel } from "@/components/monitoring/compliance-panel"

export default function MonitoringDashboard() {
  const [tab, setTab] = React.useState("overview")
  const { rows } = useSubmissions()

  const { data: issues } = useRealtimeCollection<{ status?: string; severity?: string }>(
    "complianceIssues",
    [orderBy("createdAt", "desc"), limit(200)],
    [],
  )

  const mine = rows.filter((row) => row.department === DEPARTMENT.monitoring)
  const toInspect = mine.filter((row) => stage("inspection").includes(row.status ?? "")).length
  const sentOn = rows.filter((row) =>
    stage("inspectionReported").includes(row.status ?? ""),
  ).length

  const openIssues = issues.filter((issue) => issue.status !== "Resolved")
  const severeIssues = openIssues.filter((issue) => issue.severity === "high").length

  const nav: ShellNavItem[] = [
    { value: "overview", label: "Overview", icon: LayoutDashboard },
    { value: "inspections", label: "Inspections", icon: ScanSearch, badge: toInspect },
    { value: "compliance", label: "Compliance", icon: ShieldAlert, badge: openIssues.length },
    { value: "chat", label: "Chat", icon: MessagesSquare },
    { value: "tasks", label: "Tasks", icon: ListTodo },
    { value: "notifications", label: "Notifications", icon: Bell },
  ]

  return (
    <DashboardShell
      audience="monitoring_enforcement"
      unitName="Monitoring & Enforcement"
      unitCaption="Monitoring & Enforcement"
      nav={nav}
      active={tab}
      onNavigate={setTab}
    >
      {tab === "overview" ? (
        <div className="space-y-6">
          <PageHeading
            title="Monitoring & Enforcement"
            description="Inspect proposed sites, verify what was actually erected, and keep the register of boards that are out of compliance."
          />

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              index={0}
              label="Site inspections due"
              value={toInspect}
              tone="wait"
              icon={ScanSearch}
              note="Routed here by the Director"
              onClick={() => setTab("inspections")}
            />
            <StatTile
              index={1}
              label="Reports with the Director"
              value={sentOn}
              tone="move"
              icon={ClipboardCheck}
              note="Awaiting his decision to send on to Planning"
              onClick={() => setTab("inspections")}
            />
            <StatTile
              index={2}
              label="Compliance issues open"
              value={openIssues.length}
              tone={severeIssues ? "stop" : "wait"}
              icon={ShieldAlert}
              note={severeIssues ? `${severeIssues} marked high severity` : "None marked high severity"}
              onClick={() => setTab("compliance")}
            />
            <StatTile
              index={3}
              label="Applications on file"
              value={rows.filter((row) => row.route === "third").length}
              tone="clear"
              icon={ShieldCheck}
              note="Third-party permits in the system"
            />
          </div>

          <MonitoringQueue />
        </div>
      ) : null}

      {tab === "inspections" ? (
        <div className="space-y-5">
          <PageHeading
            title="Inspections"
            description="Fill the inspection report on site and send it to the Director. If he accepts it, the file goes on to Planning."
          />
          <MonitoringQueue />
        </div>
      ) : null}

      {tab === "compliance" ? (
        <div className="space-y-5">
          <PageHeading
            title="Compliance"
            description="Boards that are expired, unsafe, or altered without approval — and what's being done about them."
          />
          <CompliancePanel unit={DEPARTMENT.monitoring} />
        </div>
      ) : null}

      {tab === "chat" ? (
        <div className="space-y-5">
          <PageHeading title="Chat" description="Talk to the other desks without leaving the file." />
          <ChatPanel role="monitoring_enforcement" channels={channelsFor("monitoring_enforcement")} />
        </div>
      ) : null}

      {tab === "tasks" ? (
        <div className="space-y-5">
          <PageHeading title="Tasks" description="Field work and follow-ups for the enforcement team." />
          <TasksPanel unit={DEPARTMENT.monitoring} />
        </div>
      ) : null}

      {tab === "notifications" || tab === "settings" ? (
        <div className="space-y-5">
          <PageHeading title="Notifications" description="Everything routed to Monitoring & Enforcement." />
          <NotificationsPanel audience="monitoring_enforcement" />
        </div>
      ) : null}
    </DashboardShell>
  )
}
