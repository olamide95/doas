"use client"

import * as React from "react"
import {
  Bell,
  ClipboardCheck,
  Compass,
  LayoutDashboard,
  ListTodo,
  Map,
  MessagesSquare,
  Ruler,
} from "lucide-react"
import { DEPARTMENT, STATUS, channelsFor, stage } from "@/lib/workflow"
import { DashboardShell, type ShellNavItem } from "@/components/dashboard/shell"
import { ChatPanel } from "@/components/dashboard/chat-panel"
import { NotificationsPanel } from "@/components/dashboard/notifications-panel"
import { TasksPanel } from "@/components/dashboard/tasks-panel"
import { PageHeading, StatTile } from "@/components/dashboard/kit"
import { useSubmissions } from "@/components/dashboard/work-queue"
import { PlanningQueue } from "@/components/planning/review-panel"
import { SiteMapPanel } from "@/components/planning/site-map-panel"

export default function PlanningDashboard() {
  const [tab, setTab] = React.useState("overview")
  const { rows } = useSubmissions()

  const mine = rows.filter((row) => row.department === DEPARTMENT.planning)
  const toReview = mine.filter((row) => row.status === STATUS.planningReview).length
  const reported = rows.filter((row) => row.status === STATUS.planningReported).length
  const upstream = rows.filter((row) => stage("inspection").includes(row.status ?? "")).length
  const mapped = rows.filter((row) => Boolean(row.gpsCoordinates)).length

  const nav: ShellNavItem[] = [
    { value: "overview", label: "Overview", icon: LayoutDashboard },
    { value: "reviews", label: "Reviews", icon: Ruler, badge: toReview },
    { value: "sites", label: "Site map", icon: Map },
    { value: "chat", label: "Chat", icon: MessagesSquare },
    { value: "tasks", label: "Tasks", icon: ListTodo },
    { value: "notifications", label: "Notifications", icon: Bell },
  ]

  return (
    <DashboardShell
      audience="planning_development"
      unitName="Planning & Development"
      unitCaption="Planning & Development"
      nav={nav}
      active={tab}
      onNavigate={setTab}
    >
      {tab === "overview" ? (
        <div className="space-y-6">
          <PageHeading
            title="Planning & Development"
            description="Check each proposed board against the zoning for its location — land use, height, setback and signage area — before the Director signs it off."
          />

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              index={0}
              label="Reviews due"
              value={toReview}
              tone="wait"
              icon={Ruler}
              note="Sent on after Monitoring's inspection"
              onClick={() => setTab("reviews")}
            />
            <StatTile
              index={1}
              label="Reports with the Director"
              value={reported}
              tone="move"
              icon={ClipboardCheck}
              note="Awaiting his final decision"
              onClick={() => setTab("reviews")}
            />
            <StatTile
              index={2}
              label="Still with Monitoring"
              value={upstream}
              tone="idle"
              icon={Compass}
              note="Not yet your turn"
            />
            <StatTile
              index={3}
              label="Sites with coordinates"
              value={mapped}
              tone="idle"
              icon={Map}
              note="Plottable against the register"
              onClick={() => setTab("sites")}
            />
          </div>

          <PlanningQueue />
        </div>
      ) : null}

      {tab === "reviews" ? (
        <div className="space-y-5">
          <PageHeading
            title="Reviews"
            description="Record the zoning assessment, then return the file to the Director for his final decision."
          />
          <PlanningQueue />
        </div>
      ) : null}

      {tab === "sites" ? (
        <div className="space-y-5">
          <PageHeading
            title="Site map"
            description="Every application that carries GPS coordinates, plotted against its own bounds. Clustering shows where boards are competing for the same corridor."
          />
          <SiteMapPanel />
        </div>
      ) : null}

      {tab === "chat" ? (
        <div className="space-y-5">
          <PageHeading title="Chat" description="Talk to the other desks without leaving the file." />
          <ChatPanel role="planning_development" channels={channelsFor("planning_development")} />
        </div>
      ) : null}

      {tab === "tasks" ? (
        <div className="space-y-5">
          <PageHeading title="Tasks" description="Follow-ups for the planning team." />
          <TasksPanel unit={DEPARTMENT.planning} />
        </div>
      ) : null}

      {tab === "notifications" || tab === "settings" ? (
        <div className="space-y-5">
          <PageHeading title="Notifications" description="Everything routed to Planning & Development." />
          <NotificationsPanel audience="planning_development" />
        </div>
      ) : null}
    </DashboardShell>
  )
}
