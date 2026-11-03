"use client"

import * as React from "react"
import { Bell, Building2, KeyRound, LayoutDashboard, ListTodo, MessagesSquare, Users } from "lucide-react"
import { DEPARTMENT, channelsFor } from "@/lib/workflow"
import { DashboardShell, type ShellNavItem } from "@/components/dashboard/shell"
import { ChatPanel } from "@/components/dashboard/chat-panel"
import { NotificationsPanel } from "@/components/dashboard/notifications-panel"
import { TasksPanel } from "@/components/dashboard/tasks-panel"
import { PageHeading } from "@/components/dashboard/kit"
import { StaffPanel } from "@/components/shared/staff-panel"
import { NominalRollPanel, PostingsPanel, RollStats, useNominalRoll } from "@/components/staff-admin/nominal-roll-panel"

export default function StaffAdminDashboard() {
  const [tab, setTab] = React.useState("overview")
  const { rows } = useNominalRoll()
  const unposted = rows.filter((r) => (r.status ?? "Active") === "Active" && !r.department).length

  const nav: ShellNavItem[] = [
    { value: "overview", label: "Overview", icon: LayoutDashboard },
    { value: "roll", label: "Nominal roll", icon: Users },
    { value: "postings", label: "Units & postings", icon: Building2, badge: unposted },
    { value: "accounts", label: "Sign-in accounts", icon: KeyRound },
    { value: "chat", label: "Chat", icon: MessagesSquare },
    { value: "tasks", label: "Tasks", icon: ListTodo },
    { value: "notifications", label: "Notifications", icon: Bell },
  ]

  return (
    <DashboardShell audience="staff_admin" unitName="Staff Admin" unitCaption="Staff Administration" nav={nav} active={tab} onNavigate={setTab}>
      {tab === "overview" ? (
        <div className="space-y-6">
          <PageHeading
            title="Staff Administration"
            description="Keep the nominal roll current, post staff to units and give officers their DOAS sign-in accounts."
          />
          <RollStats onOpen={() => setTab("roll")} />
          <NominalRollPanel />
        </div>
      ) : null}
      {tab === "roll" ? (
        <div className="space-y-5">
          <PageHeading title="Nominal roll" description="Import the FCTA workbook, correct records and track retirements." />
          <NominalRollPanel />
        </div>
      ) : null}
      {tab === "postings" ? (
        <div className="space-y-5">
          <PageHeading title="Units & postings" description="Who works in each unit. Heads of unit assign technical vetting to the officers posted to them." />
          <PostingsPanel />
        </div>
      ) : null}
      {tab === "accounts" ? (
        <div className="space-y-5">
          <PageHeading title="Sign-in accounts" description="Staff accounts for every desk. Only the Director can create or change a Director account." />
          <StaffPanel />
        </div>
      ) : null}
      {tab === "chat" ? <ChatPanel role="staff_admin" channels={channelsFor("staff_admin")} /> : null}
      {tab === "tasks" ? <TasksPanel unit={DEPARTMENT.staffAdmin} /> : null}
      {tab === "notifications" || tab === "settings" ? <NotificationsPanel audience="staff_admin" /> : null}
    </DashboardShell>
  )
}
