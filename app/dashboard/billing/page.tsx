"use client"

import * as React from "react"
import { limit, orderBy } from "firebase/firestore"
import { AlertTriangle, Bell, CalendarClock, Calculator, LayoutDashboard, ListTodo, MessagesSquare, Receipt, Table2 } from "lucide-react"
import { DEPARTMENT, REGISTER_COLLECTION, channelsFor, stage } from "@/lib/workflow"
import { useRealtimeCollection } from "@/hooks/use-firestore"
import { DashboardShell, type ShellNavItem } from "@/components/dashboard/shell"
import { ChatPanel } from "@/components/dashboard/chat-panel"
import { NotificationsPanel } from "@/components/dashboard/notifications-panel"
import { TasksPanel } from "@/components/dashboard/tasks-panel"
import { PageHeading, StatTile } from "@/components/dashboard/kit"
import { useSubmissions } from "@/components/dashboard/work-queue"
import { BillingQueue, SubscriptionTracker, TariffSchedulePanel, lifecycleOf } from "@/components/billing/billing-panels"

export default function BillingDashboard() {
  const [tab, setTab] = React.useState("overview")
  const { rows } = useSubmissions()
  const { data: register } = useRealtimeCollection<{ expiresAt?: string; status?: string }>(REGISTER_COLLECTION, [orderBy("expiresAt", "asc"), limit(500)], [])

  const toAssess = rows.filter((r) => r.department === DEPARTMENT.billing && stage("billing").includes(r.status ?? "")).length
  const proposed = rows.filter((r) => stage("billProposed").includes(r.status ?? "")).length
  const states = register.filter((e) => e.status !== "Renewal Invoiced").map((e) => lifecycleOf(e.expiresAt).state)
  const expired = states.filter((s) => s === "expired").length
  const warning = states.filter((s) => s === "warning").length

  const nav: ShellNavItem[] = [
    { value: "overview", label: "Overview", icon: LayoutDashboard },
    { value: "assess", label: "Assessments", icon: Calculator, badge: toAssess },
    { value: "lifecycle", label: "Subscriptions", icon: CalendarClock, badge: expired + warning },
    { value: "tariffs", label: "Tariff schedule", icon: Table2 },
    { value: "chat", label: "Chat", icon: MessagesSquare },
    { value: "tasks", label: "Tasks", icon: ListTodo },
    { value: "notifications", label: "Notifications", icon: Bell },
  ]

  return (
    <DashboardShell audience="billing" unitName="Billing" unitCaption="Billing Department" nav={nav} active={tab} onNavigate={setTab}>
      {tab === "overview" ? (
        <div className="space-y-6">
          <PageHeading title="Billing" description="Price locked field measurements against the gazette, set permit validity, and re-bill expiring subscriptions. Billing never handles payment." />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile index={0} label="Files to price" value={toAssess} tone="wait" icon={Calculator} note="Measurements verified by the Director" onClick={() => setTab("assess")} />
            <StatTile index={1} label="Bills with the Director" value={proposed} tone="move" icon={Receipt} note="Awaiting pricing sign-off" />
            <StatTile index={2} label="Expired — re-bill outstanding" value={expired} tone="stop" icon={AlertTriangle} onClick={() => setTab("lifecycle")} />
            <StatTile index={3} label="Expiring within 30 days" value={warning} tone="wait" icon={CalendarClock} onClick={() => setTab("lifecycle")} />
          </div>
          <BillingQueue />
        </div>
      ) : null}
      {tab === "assess" ? (
        <div className="space-y-5">
          <PageHeading title="Assessments" description="Dimensions are read-only. If they look wrong, raise a query — the Director routes it back to the field desk." />
          <BillingQueue />
        </div>
      ) : null}
      {tab === "lifecycle" ? (
        <div className="space-y-5">
          <PageHeading title="Subscriptions" description="Continuous expiry monitoring. Re-billing clones the last measured parameters." />
          <SubscriptionTracker />
        </div>
      ) : null}
      {tab === "tariffs" ? (
        <div className="space-y-5">
          <PageHeading title="Tariff schedule" description="The gazetted base rates every assessment pulls from. Saving creates a new version; existing bills keep their snapshot." />
          <TariffSchedulePanel />
        </div>
      ) : null}
      {tab === "chat" ? <ChatPanel role="billing" channels={channelsFor("billing")} /> : null}
      {tab === "tasks" ? <TasksPanel unit={DEPARTMENT.billing} /> : null}
      {tab === "notifications" || tab === "settings" ? <NotificationsPanel audience="billing" /> : null}
    </DashboardShell>
  )
}
