"use client"

import * as React from "react"
import { AlertTriangle, Bell, ClipboardCheck, FileSearch, LayoutDashboard, ListTodo, Map, MessagesSquare, Ruler } from "lucide-react"
import { DEPARTMENT, channelsFor, stage } from "@/lib/workflow"
import { DashboardShell, type ShellNavItem } from "@/components/dashboard/shell"
import { ChatPanel } from "@/components/dashboard/chat-panel"
import { NotificationsPanel } from "@/components/dashboard/notifications-panel"
import { TasksPanel } from "@/components/dashboard/tasks-panel"
import { PageHeading, StatTile } from "@/components/dashboard/kit"
import { useSubmissions } from "@/components/dashboard/work-queue"
import { PlanningQueue } from "@/components/planning/review-panel"
import { SiteMapPanel } from "@/components/planning/site-map-panel"
import { VettingDesk } from "@/components/vetting/vetting-desk"

export default function PlanningDashboard() {
  const [tab, setTab] = React.useState("overview")
  const { rows } = useSubmissions()
  const toVet = rows.filter((r) => r.department === DEPARTMENT.planning && stage("planningReview").includes(r.status ?? "")).length
  const reported = rows.filter((r) => stage("planningReported").includes(r.status ?? "")).length
  const warnings = rows.filter((r) => ["Warning_Proximity_Issue", "Rejected_Overlap"].includes(String(r.technicalReport?.clashDetectionStatus ?? ""))).length
  const mapped = rows.filter((r) => Boolean(r.gpsCoordinates)).length
  const eiaOpen = rows.filter((r) => stage("technicalVetting").includes(r.status ?? "") && r.vetting?.eia && r.vetting.eia.state !== "confirmed").length

  const nav: ShellNavItem[] = [
    { value: "overview", label: "Overview", icon: LayoutDashboard },
    { value: "reviews", label: "Site inspections", icon: Ruler, badge: toVet },
    { value: "vetting", label: "EIA vetting", icon: FileSearch, badge: eiaOpen },
    { value: "sites", label: "Site map", icon: Map },
    { value: "chat", label: "Chat", icon: MessagesSquare },
    { value: "tasks", label: "Tasks", icon: ListTodo },
    { value: "notifications", label: "Notifications", icon: Bell },
  ]

  return (
    <DashboardShell audience="planning_development" unitName="Planning & Development" unitCaption="Planning & Development" nav={nav} active={tab} onNavigate={setTab}>
      {tab === "overview" ? (
        <div className="space-y-6">
          <PageHeading title="Planning & Development" description="Site inspection of third-party applications (measurements, setbacks, clashes, exclusion zone) and vetting of the practitioner's Environmental Impact Assessment." />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile index={0} label="Sites to inspect" value={toVet} tone="wait" icon={Ruler} onClick={() => setTab("reviews")} />
            <StatTile index={1} label="EIAs open" value={eiaOpen} tone={eiaOpen ? "wait" : "clear"} icon={FileSearch} note={`${reported} inspection reports with the Director`} onClick={() => setTab("vetting")} />
            <StatTile index={2} label="Clash warnings on file" value={warnings} tone={warnings ? "stop" : "clear"} icon={AlertTriangle} />
            <StatTile index={3} label="Sites with coordinates" value={mapped} tone="idle" icon={Map} onClick={() => setTab("sites")} />
          </div>
          <PlanningQueue />
        </div>
      ) : null}
      {tab === "reviews" ? <PlanningQueue /> : null}
      {tab === "vetting" ? <VettingDesk department={DEPARTMENT.planning} actorId="planning_development" /> : null}
      {tab === "sites" ? <SiteMapPanel /> : null}
      {tab === "chat" ? <ChatPanel role="planning_development" channels={channelsFor("planning_development")} /> : null}
      {tab === "tasks" ? <TasksPanel unit={DEPARTMENT.planning} /> : null}
      {tab === "notifications" || tab === "settings" ? <NotificationsPanel audience="planning_development" /> : null}
    </DashboardShell>
  )
}
