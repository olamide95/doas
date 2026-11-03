"use client"

import * as React from "react"
import { limit } from "firebase/firestore"
import { AlertTriangle, Bell, Crosshair, FileSearch, LayoutDashboard, ListTodo, MessagesSquare, ShieldAlert } from "lucide-react"
import { COMPLIANCE_COLLECTION, DEPARTMENT, channelsFor, stage } from "@/lib/workflow"
import { useRealtimeCollection } from "@/hooks/use-firestore"
import { DashboardShell, type ShellNavItem } from "@/components/dashboard/shell"
import { ChatPanel } from "@/components/dashboard/chat-panel"
import { NotificationsPanel } from "@/components/dashboard/notifications-panel"
import { TasksPanel } from "@/components/dashboard/tasks-panel"
import { PageHeading, StatTile } from "@/components/dashboard/kit"
import { EnforcementPanel, useEnforcementTargets } from "@/components/monitoring/review-panel"
import { CompliancePanel } from "@/components/monitoring/compliance-panel"
import { SettingOutQueue } from "@/components/monitoring/setting-out-panel"
import { VettingDesk } from "@/components/vetting/vetting-desk"
import { useSubmissions } from "@/components/dashboard/work-queue"

export default function MonitoringDashboard() {
  const [tab, setTab] = React.useState("overview")
  const { rows, expired, expiring } = useEnforcementTargets()
  const { data: issues } = useRealtimeCollection<{ status?: string; severity?: string }>(COMPLIANCE_COLLECTION, [limit(300)], [])
  const open = issues.filter((i) => i.status !== "Resolved")
  const { rows: files } = useSubmissions()
  const vettingOpen = files.filter(
    (r) => stage("technicalVetting").includes(r.status ?? "") && (["soilTest", "structuralDrawing"] as const).some((k) => r.vetting?.[k] && r.vetting[k].state !== "confirmed"),
  ).length
  const settingOut = files.filter((r) => r.department === DEPARTMENT.monitoring && stage("settingOut").includes(r.status ?? "")).length

  const nav: ShellNavItem[] = [
    { value: "overview", label: "Overview", icon: LayoutDashboard },
    { value: "vetting", label: "Soil & structural vetting", icon: FileSearch, badge: vettingOpen },
    { value: "setting-out", label: "Setting out", icon: Crosshair, badge: settingOut },
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
          <PageHeading
            title="Monitoring & Enforcement"
            description="Vet soil tests and structural drawings, set out paid sites, find boards on lapsed permits and keep the compliance register current."
          />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile index={0} label="Expired permits" value={expired.length} tone="stop" icon={AlertTriangle} onClick={() => setTab("enforcement")} />
            <StatTile index={1} label="Vetting open" value={vettingOpen} tone={vettingOpen ? "wait" : "clear"} icon={FileSearch} note="Soil tests & structural drawings" onClick={() => setTab("vetting")} />
            <StatTile
              index={2}
              label="Compliance issues open"
              value={open.length}
              tone={open.some((i) => i.severity === "high") ? "stop" : "wait"}
              icon={ShieldAlert}
              onClick={() => setTab("compliance")}
            />
            <StatTile index={3} label="Sites to set out" value={settingOut} tone={settingOut ? "wait" : "clear"} icon={Crosshair} note={`${expiring.length} permits expiring ≤30 days · ${rows.length} on register`} onClick={() => setTab("setting-out")} />
          </div>
          <EnforcementPanel />
        </div>
      ) : null}
      {tab === "vetting" ? <VettingDesk department={DEPARTMENT.monitoring} actorId="monitoring_enforcement" /> : null}
      {tab === "setting-out" ? <SettingOutQueue /> : null}
      {tab === "enforcement" ? <EnforcementPanel /> : null}
      {tab === "compliance" ? <CompliancePanel unit={DEPARTMENT.monitoring} /> : null}
      {tab === "chat" ? <ChatPanel role="monitoring_enforcement" channels={channelsFor("monitoring_enforcement")} /> : null}
      {tab === "tasks" ? <TasksPanel unit={DEPARTMENT.monitoring} /> : null}
      {tab === "notifications" || tab === "settings" ? <NotificationsPanel audience="monitoring_enforcement" /> : null}
    </DashboardShell>
  )
}
