"use client"

import * as React from "react"
import {
  Bell,
  Camera,
  CheckCircle2,
  FolderOpen,
  LayoutDashboard,
  ListTodo,
  MessagesSquare,
} from "lucide-react"
import { DEPARTMENT, STATUS, channelsFor, stage } from "@/lib/workflow"
import { DashboardShell, type ShellNavItem } from "@/components/dashboard/shell"
import { ChatPanel } from "@/components/dashboard/chat-panel"
import { NotificationsPanel } from "@/components/dashboard/notifications-panel"
import { TasksPanel } from "@/components/dashboard/tasks-panel"
import { PageHeading, StatTile } from "@/components/dashboard/kit"
import { useSubmissions } from "@/components/dashboard/work-queue"
import {
  BusinessDevelopmentArchive,
  BusinessDevelopmentQueue,
} from "@/components/business-development/site-visit-panel"

export default function BusinessDevelopmentDashboard() {
  const [tab, setTab] = React.useState("overview")
  const { rows } = useSubmissions()

  const firstParty = rows.filter((row) => row.route === "first")
  const toVisit = firstParty.filter((row) => stage("siteVisit").includes(row.status ?? "")).length
  const toApprove = firstParty.filter((row) => row.status === STATUS.paymentConfirmed).length
  const approved = firstParty.filter((row) =>
    [STATUS.approved, STATUS.registered].includes(row.status ?? ""),
  ).length

  const nav: ShellNavItem[] = [
    { value: "overview", label: "Overview", icon: LayoutDashboard },
    { value: "visits", label: "Site visits", icon: Camera, badge: toVisit + toApprove },
    { value: "applications", label: "All applications", icon: FolderOpen },
    { value: "chat", label: "Chat", icon: MessagesSquare },
    { value: "tasks", label: "Tasks", icon: ListTodo },
    { value: "notifications", label: "Notifications", icon: Bell },
  ]

  return (
    <DashboardShell
      audience="business_development"
      unitName="Business Development"
      unitCaption="Business Development"
      nav={nav}
      active={tab}
      onNavigate={setTab}
    >
      {tab === "overview" ? (
        <div className="space-y-6">
          <PageHeading
            title="Business Development"
            description="Visit the sites behind first-party applications, photograph what's there, and send the measurements on to Finance for billing."
          />

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              index={0}
              label="Visits to make"
              value={toVisit}
              tone="wait"
              icon={Camera}
              note="Sent over by the Director"
              onClick={() => setTab("visits")}
            />
            <StatTile
              index={1}
              label="Paid — awaiting your approval"
              value={toApprove}
              tone="move"
              icon={CheckCircle2}
              note="Finance has confirmed payment"
              onClick={() => setTab("visits")}
            />
            <StatTile
              index={2}
              label="Approved permits"
              value={approved}
              tone="clear"
              icon={CheckCircle2}
              note="First-party applications cleared"
            />
            <StatTile
              index={3}
              label="First-party applications"
              value={firstParty.length}
              tone="idle"
              icon={FolderOpen}
              note="Filed by property owners directly"
              onClick={() => setTab("applications")}
            />
          </div>

          <BusinessDevelopmentQueue />
        </div>
      ) : null}

      {tab === "visits" ? (
        <div className="space-y-5">
          <PageHeading
            title="Site visits"
            description="Two jobs live here: the site visit that triggers billing, and the approval you give once the applicant has paid."
          />
          <BusinessDevelopmentQueue />
        </div>
      ) : null}

      {tab === "applications" ? (
        <div className="space-y-5">
          <PageHeading
            title="All applications"
            description="Every first-party file and the desk it's currently sitting with."
          />
          <BusinessDevelopmentArchive />
        </div>
      ) : null}

      {tab === "chat" ? (
        <div className="space-y-5">
          <PageHeading title="Chat" description="Talk to the other desks without leaving the file." />
          <ChatPanel role="business_development" channels={channelsFor("business_development")} />
        </div>
      ) : null}

      {tab === "tasks" ? (
        <div className="space-y-5">
          <PageHeading title="Tasks" description="Field work and follow-ups for the team." />
          <TasksPanel unit={DEPARTMENT.businessDevelopment} />
        </div>
      ) : null}

      {tab === "notifications" || tab === "settings" ? (
        <div className="space-y-5">
          <PageHeading title="Notifications" description="Everything routed to Business Development." />
          <NotificationsPanel audience="business_development" />
        </div>
      ) : null}
    </DashboardShell>
  )
}
