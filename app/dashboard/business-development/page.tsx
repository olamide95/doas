"use client"

import * as React from "react"
import { Bell, Camera, CheckCircle2, ClipboardCheck, FolderOpen, LayoutDashboard, ListTodo, MessagesSquare } from "lucide-react"
import { DEPARTMENT, channelsFor, stage } from "@/lib/workflow"
import { DashboardShell, type ShellNavItem } from "@/components/dashboard/shell"
import { ChatPanel } from "@/components/dashboard/chat-panel"
import { NotificationsPanel } from "@/components/dashboard/notifications-panel"
import { TasksPanel } from "@/components/dashboard/tasks-panel"
import { PageHeading, StatTile } from "@/components/dashboard/kit"
import { useSubmissions } from "@/components/dashboard/work-queue"
import { BusinessDevelopmentArchive, BusinessDevelopmentHistory, BusinessDevelopmentQueue } from "@/components/business-development/site-visit-panel"

export default function BusinessDevelopmentDashboard() {
  const [tab, setTab] = React.useState("overview")
  const { rows } = useSubmissions()
  const fp = rows.filter((r) => r.route === "first")
  const toVisit = fp.filter((r) => stage("siteVisit").includes(r.status ?? "")).length
  const reported = fp.filter((r) => stage("visitReported").includes(r.status ?? "")).length
  const issued = fp.filter((r) => stage("issued").includes(r.status ?? "")).length

  const nav: ShellNavItem[] = [
    { value: "overview", label: "Overview", icon: LayoutDashboard },
    { value: "visits", label: "Site visits", icon: Camera, badge: toVisit },
    { value: "reported", label: "Reported", icon: ClipboardCheck },
    { value: "applications", label: "All applications", icon: FolderOpen },
    { value: "chat", label: "Chat", icon: MessagesSquare },
    { value: "tasks", label: "Tasks", icon: ListTodo },
    { value: "notifications", label: "Notifications", icon: Bell },
  ]

  return (
    <DashboardShell audience="business_development" unitName="Business Development" unitCaption="Business Development" nav={nav} active={tab} onNavigate={setTab}>
      {tab === "overview" ? (
        <div className="space-y-6">
          <PageHeading title="Business Development" description="Inspect first-party sites, measure and photograph every sign, and lock the parameters Billing prices from." />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile index={0} label="Visits to make" value={toVisit} tone="wait" icon={Camera} note="Routed by the Director" onClick={() => setTab("visits")} />
            <StatTile index={1} label="Reports with the Director" value={reported} tone="move" icon={ClipboardCheck} />
            <StatTile index={2} label="Permits issued" value={issued} tone="clear" icon={CheckCircle2} />
            <StatTile index={3} label="First-party files" value={fp.length} tone="idle" icon={FolderOpen} onClick={() => setTab("applications")} />
          </div>
          <BusinessDevelopmentQueue />
        </div>
      ) : null}
      {tab === "visits" ? <BusinessDevelopmentQueue /> : null}
      {tab === "reported" ? <BusinessDevelopmentHistory /> : null}
      {tab === "applications" ? <BusinessDevelopmentArchive /> : null}
      {tab === "chat" ? <ChatPanel role="business_development" channels={channelsFor("business_development")} /> : null}
      {tab === "tasks" ? <TasksPanel unit={DEPARTMENT.businessDevelopment} /> : null}
      {tab === "notifications" || tab === "settings" ? <NotificationsPanel audience="business_development" /> : null}
    </DashboardShell>
  )
}
