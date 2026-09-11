"use client"

import * as React from "react"
import {
  BadgeCheck,
  Bell,
  LayoutDashboard,
  ListTodo,
  MessagesSquare,
  Receipt,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react"
import { DEPARTMENT, STATUS, channelsFor, stage } from "@/lib/workflow"
import { naira } from "@/lib/format"
import { DashboardShell, type ShellNavItem } from "@/components/dashboard/shell"
import { ChatPanel } from "@/components/dashboard/chat-panel"
import { NotificationsPanel } from "@/components/dashboard/notifications-panel"
import { TasksPanel } from "@/components/dashboard/tasks-panel"
import { PageHeading, StatTile } from "@/components/dashboard/kit"
import { useSubmissions } from "@/components/dashboard/work-queue"
import { FinanceQueue, RevenuePanel } from "@/components/finance/finance-panels"
import { StaffPanel } from "@/components/shared/staff-panel"

export default function FinanceDashboard() {
  const [tab, setTab] = React.useState("overview")
  const { rows } = useSubmissions()

  const firstParty = rows.filter((row) => row.route === "first")

  const toInvoice = firstParty.filter((row) =>
    stage("visitReported").includes(row.status ?? ""),
  ).length

  const awaiting = firstParty.filter((row) => stage("awaitingPayment").includes(row.status ?? ""))
  const owed = awaiting.reduce((sum, row) => sum + Number(row.billing?.totalAmount ?? 0), 0)

  const collected = firstParty
    .filter((row) => String(row.billing?.paymentStatus ?? "") === "Paid")
    .reduce((sum, row) => sum + Number(row.billing?.totalAmount ?? 0), 0)

  const nav: ShellNavItem[] = [
    { value: "overview", label: "Overview", icon: LayoutDashboard },
    { value: "billing", label: "Billing", icon: Receipt, badge: toInvoice },
    { value: "revenue", label: "Revenue", icon: TrendingUp },
    { value: "staff", label: "Staff", icon: Users },
    { value: "chat", label: "Chat", icon: MessagesSquare },
    { value: "tasks", label: "Tasks", icon: ListTodo },
    { value: "notifications", label: "Notifications", icon: Bell },
  ]

  return (
    <DashboardShell
      audience="finance"
      unitName="Finance & Admin"
      unitCaption="Finance & Admin"
      nav={nav}
      active={tab}
      onNavigate={setTab}
    >
      {tab === "overview" ? (
        <div className="space-y-6">
          <PageHeading
            title="Finance & Admin"
            description="Raise the permit invoice once an application is cleared, then record the payment so the Director can give final approval."
          />

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              index={0}
              label="Waiting to be invoiced"
              value={toInvoice}
              tone="wait"
              icon={Receipt}
              note="Site visit done, measurements in"
              onClick={() => setTab("billing")}
            />
            <StatTile
              index={1}
              label="Invoices outstanding"
              value={awaiting.length}
              tone="move"
              icon={BadgeCheck}
              note={owed ? `${naira(owed)} unpaid` : "Nothing unpaid"}
              onClick={() => setTab("billing")}
            />
            <StatTile
              index={2}
              label="Collected to date"
              value={collected}
              tone="clear"
              icon={Wallet}
              note="Payments recorded against invoices"
              onClick={() => setTab("revenue")}
            />
            <StatTile
              index={3}
              label="First-party applications"
              value={firstParty.length}
              tone="idle"
              icon={TrendingUp}
              note="Third-party permits are not billed"
            />
          </div>

          <FinanceQueue />
        </div>
      ) : null}

      {tab === "billing" ? (
        <div className="space-y-5">
          <PageHeading
            title="Billing"
            description="Set the fees for each permit, issue the invoice, then confirm payment against a Remita or teller reference."
          />
          <FinanceQueue />
        </div>
      ) : null}

      {tab === "revenue" ? (
        <div className="space-y-5">
          <PageHeading
            title="Revenue"
            description="Everything here is calculated from invoices raised in Billing — no figures are entered twice."
          />
          <RevenuePanel />
        </div>
      ) : null}

      {tab === "staff" ? (
        <div className="space-y-5">
          <PageHeading title="Staff" description="Who works each desk across the directorate." />
          <StaffPanel />
        </div>
      ) : null}

      {tab === "chat" ? (
        <div className="space-y-5">
          <PageHeading title="Chat" description="Talk to the other desks without leaving the file." />
          <ChatPanel role="finance" channels={channelsFor("finance")} />
        </div>
      ) : null}

      {tab === "tasks" ? (
        <div className="space-y-5">
          <PageHeading title="Tasks" description="Follow-ups that don't belong to a single invoice." />
          <TasksPanel unit={DEPARTMENT.finance} />
        </div>
      ) : null}

      {tab === "notifications" || tab === "settings" ? (
        <div className="space-y-5">
          <PageHeading title="Notifications" description="Everything routed to the Finance desk." />
          <NotificationsPanel audience="finance" />
        </div>
      ) : null}
    </DashboardShell>
  )
}
