"use client"

import * as React from "react"
import { limit } from "firebase/firestore"
import { AlertTriangle, Bell, CalendarClock, LayoutDashboard, ListTodo, MessagesSquare, ShieldAlert, ShieldCheck } from "lucide-react"
import { COMPLIANCE_COLLECTION, DEPARTMENT, channelsFor } from "@/lib/workflow"
import { useRealtimeCollection } from "@/hooks/use-firestore"
import { DashboardShell, type ShellNavItem } from "@/components/dashboard/shell"
import { ChatPanel } from "@/components/dashboard/chat-panel"
import { NotificationsPanel } from "@/components/dashboard/notifications-panel"
import { TasksPanel } from "@/components/dashboard/tasks-panel"
import { PageHeading, StatTile } from "@/components/dashboard/kit"
import { EnforcementPanel, useEnforcementTargets } from "@/components/monitoring/review-panel"
import { CompliancePanel } from "@/components/monitoring/compliance-panel"

export default function MonitoringDashboard() {
  const [tab, setTab] = React.useState("overview")
  const { rows, expired, expiring } = useEnforcementTargets()
  const { data: issues } = useRealtimeCollection<{ status?: string; severity?: string }>(COMPLIANCE_COLLECTION, [limit(300)], [])
  const open = issues.filter((i) => i.status !== "Resolved")

  const nav: ShellNavItem[] = [
    { value: "overview", label: "Overview", icon: LayoutDashboard },
    { value: "enforcement", label: "Enforcement", icon: AlertTriangle, badge: expired.length },
    { value: "compliance", label: "Compliance", icon: ShieldAlert, badge: open.length },
    { value: "chat", label: "Chat", icon: MessagesSquare },
    { value: "tasks", label: "Tasks", icon: ListTodo },
    { value: "notifications", label: "Notifications", icon: Bell },
  ]

  return (
    <DashboardShell audience="monitoring_enforcement" unitName="Monitoring & Enforcement" unitCaption="Monitoring & Enforcement" nav={nav} active={tab} onNavigate={setTab}>
      {tab === "overview" ? (
        <div className="space-y-6">
          <PageHeading title="Monitoring & Enforcement" description="Find boards standing on lapsed permits and keep the compliance register current." />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile index={0} label="Expired permits" value={expired.length} tone="stop" icon={AlertTriangle} onClick={() => setTab("enforcement")} />
            <StatTile index={1} label="Expiring ≤30 days" value={expiring.length} tone="wait" icon={CalendarClock} />
            <StatTile
              index={2}
              label="Compliance issues open"
              value={open.length}
              tone={open.some((i) => i.severity === "high") ? "stop" : "wait"}
              icon={ShieldAlert}
              onClick={() => setTab("compliance")}
            />
            <StatTile index={3} label="Permits on register" value={rows.length} tone="clear" icon={ShieldCheck} />
          </div>
          <EnforcementPanel />
        </div>
      ) : null}
      {tab === "enforcement" ? <EnforcementPanel /> : null}
      {tab === "compliance" ? <CompliancePanel unit={DEPARTMENT.monitoring} /> : null}
      {tab === "chat" ? <ChatPanel role="monitoring_enforcement" channels={channelsFor("monitoring_enforcement")} /> : null}
      {tab === "tasks" ? <TasksPanel unit={DEPARTMENT.monitoring} /> : null}
      {tab === "notifications" || tab === "settings" ? <NotificationsPanel audience="monitoring_enforcement" /> : null}
    </DashboardShell>
  )
}
