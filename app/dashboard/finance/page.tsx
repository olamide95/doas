"use client"

import * as React from "react"
import { BadgeCheck, Bell, BookOpen, LayoutDashboard, ListTodo, MessagesSquare, ShieldAlert, SplitSquareHorizontal, Users, Wallet } from "lucide-react"
import { DEPARTMENT, STATUS, channelsFor, stage } from "@/lib/workflow"
import { naira } from "@/lib/format"
import { DashboardShell, type ShellNavItem } from "@/components/dashboard/shell"
import { ChatPanel } from "@/components/dashboard/chat-panel"
import { NotificationsPanel } from "@/components/dashboard/notifications-panel"
import { TasksPanel } from "@/components/dashboard/tasks-panel"
import { PageHeading, StatTile } from "@/components/dashboard/kit"
import { FinanceQueue, LedgerPanel, useLedger } from "@/components/finance/finance-panels"
import { StaffPanel } from "@/components/shared/staff-panel"

export default function FinanceDashboard() {
  const [tab, setTab] = React.useState("overview")
  const { rows, collected, owed } = useLedger()

  const toVerify = rows.filter((r) => [STATUS.awaitingPayment, "Billed"].includes(r.status ?? "")).length
  const part = rows.filter((r) => r.status === STATUS.partPayment).length
  const flagged = rows.filter((r) => stage("paymentFlagged").includes(r.status ?? "")).length

  const nav: ShellNavItem[] = [
    { value: "overview", label: "Overview", icon: LayoutDashboard },
    { value: "reconcile", label: "Reconciliation", icon: BadgeCheck, badge: toVerify + part },
    { value: "ledger", label: "Ledger", icon: BookOpen },
    { value: "staff", label: "Staff", icon: Users },
    { value: "chat", label: "Chat", icon: MessagesSquare },
    { value: "tasks", label: "Tasks", icon: ListTodo },
    { value: "notifications", label: "Notifications", icon: Bell },
  ]

  return (
    <DashboardShell audience="finance" unitName="Finance & Admin" unitCaption="Finance & Admin" nav={nav} active={tab} onNavigate={setTab}>
      {tab === "overview" ? (
        <div className="space-y-6">
          <PageHeading title="Finance & Admin" description="Verify Remita and bank payments, post them to the right ledger, and reconcile. Finance never sets prices." />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile index={0} label="Payments to verify" value={toVerify} tone="wait" icon={BadgeCheck} onClick={() => setTab("reconcile")} />
            <StatTile index={1} label="Part payments open" value={part} tone="stop" icon={SplitSquareHorizontal} note={owed ? `${naira(owed)} outstanding` : "Nothing outstanding"} />
            <StatTile index={2} label="Collected (reconciled)" value={collected} tone="clear" icon={Wallet} onClick={() => setTab("ledger")} />
            <StatTile index={3} label="Flagged with the Director" value={flagged} tone="stop" icon={ShieldAlert} />
          </div>
          <FinanceQueue />
        </div>
      ) : null}
      {tab === "reconcile" ? (
        <div className="space-y-5">
          <PageHeading title="Reconciliation" description="Match the declared RRR against settlement, then dispatch the receipt to the Director for permit sign-off." />
          <FinanceQueue />
        </div>
      ) : null}
      {tab === "ledger" ? (
        <div className="space-y-5">
          <PageHeading title="Ledger" description="Every figure is computed from reconciled payments — nothing is entered twice." />
          <LedgerPanel />
        </div>
      ) : null}
      {tab === "staff" ? <StaffPanel /> : null}
      {tab === "chat" ? <ChatPanel role="finance" channels={channelsFor("finance")} /> : null}
      {tab === "tasks" ? <TasksPanel unit={DEPARTMENT.finance} /> : null}
      {tab === "notifications" || tab === "settings" ? <NotificationsPanel audience="finance" /> : null}
    </DashboardShell>
  )
}
