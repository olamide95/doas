"use client"

import * as React from "react"
import { limit, orderBy } from "firebase/firestore"
import { BadgeCheck, BarChart3, Bell, CalendarDays, CheckCircle2, FileText, Gavel, LayoutDashboard, ListTodo, MessagesSquare, Receipt, ScrollText, ShieldAlert, Stamp, Users } from "lucide-react"
import { COL } from "@/lib/firebase"
import { COMPLIANCE_COLLECTION, DEPARTMENT, DIRECTOR_DESK, channelsFor, stage } from "@/lib/workflow"
import { useRealtimeCollection } from "@/hooks/use-firestore"
import { DashboardShell, type ShellNavItem } from "@/components/dashboard/shell"
import { ChatPanel } from "@/components/dashboard/chat-panel"
import { NotificationsPanel } from "@/components/dashboard/notifications-panel"
import { TasksPanel } from "@/components/dashboard/tasks-panel"
import { useSubmissions } from "@/components/dashboard/work-queue"
import { DirectorMeetings, DirectorSubmissions } from "@/components/director/review-panels"
import { DirectorateReport } from "@/components/director/oversight-panel"
import { CompliancePanel } from "@/components/monitoring/compliance-panel"
import { StaffPanel } from "@/components/shared/staff-panel"
import { RegisterPanel } from "@/components/shared/register-panel"
import { PageHeading, StatTile } from "@/components/dashboard/kit"
import PractitionerUploadPanel from "@/components/csu/practitioner-upload-panel"

export default function DirectorDashboard() {
  const [tab, setTab] = React.useState("overview")
  const { rows } = useSubmissions()
  const meetings = useRealtimeCollection<{ status?: string }>(COL.meetings, [orderBy("createdAt", "desc"), limit(200)], [])
  const issues = useRealtimeCollection<{ status?: string }>(COMPLIANCE_COLLECTION, [limit(300)], [])

  const has = (statuses: string[]) => rows.filter((r) => statuses.includes(r.status ?? "")).length
  const onDesk = has(DIRECTOR_DESK)
  const pricing = has(stage("billProposed"))
  const signoffs = has(stage("paymentReconciled"))
  const issued = has(stage("issued"))
  const meetingsWaiting = meetings.data.filter((m) => m.status === "forwarded").length
  const openIssues = issues.data.filter((i) => i.status !== "Resolved").length

  const nav: ShellNavItem[] = [
    { value: "overview", label: "Overview", icon: LayoutDashboard },
    { value: "applications", label: "Director's desk", icon: FileText, badge: onDesk },
    { value: "meetings", label: "Meeting requests", icon: CalendarDays, badge: meetingsWaiting },
    { value: "reports", label: "Reports", icon: BarChart3 },
    { value: "register", label: "Permit register", icon: ScrollText },
    { value: "practitioners", label: "Practitioners", icon: BadgeCheck },
    { value: "compliance", label: "Compliance", icon: ShieldAlert, badge: openIssues },
    { value: "staff", label: "Staff", icon: Users },
    { value: "chat", label: "Chat", icon: MessagesSquare },
    { value: "tasks", label: "Tasks", icon: ListTodo },
    { value: "notifications", label: "Notifications", icon: Bell },
  ]

  return (
    <DashboardShell audience="director" unitName="Director's Office" unitCaption="Director's Office" nav={nav} active={tab} onNavigate={setTab}>
      {tab === "overview" ? (
        <div className="space-y-6">
          <PageHeading title="Director's Office" description="No file moves between departments without your signature. Everything waiting on you is below." />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile index={0} label="On your desk" value={onDesk} tone="wait" icon={Gavel} onClick={() => setTab("applications")} />
            <StatTile index={1} label="Bills to confirm" value={pricing} tone="move" icon={Receipt} note="From Billing, incl. renewals" onClick={() => setTab("applications")} />
            <StatTile index={2} label="Permits to sign" value={signoffs} tone="move" icon={Stamp} note="Payment reconciled by Finance" onClick={() => setTab("applications")} />
            <StatTile index={3} label="Permits issued" value={issued} tone="clear" icon={CheckCircle2} note={`${rows.length} files on record`} onClick={() => setTab("register")} />
          </div>
          <DirectorSubmissions />
        </div>
      ) : null}
      {tab === "applications" ? (
        <div className="space-y-5">
          <PageHeading title="Director's desk" description="Accept, return, or route each file to the next desk." />
          <DirectorSubmissions />
        </div>
      ) : null}
      {tab === "meetings" ? <DirectorMeetings /> : null}
      {tab === "reports" ? <DirectorateReport /> : null}
      {tab === "register" ? <RegisterPanel /> : null}
      {tab === "practitioners" ? <PractitionerUploadPanel /> : null}
      {tab === "compliance" ? <CompliancePanel unit={DEPARTMENT.director} /> : null}
      {tab === "staff" ? <StaffPanel /> : null}
      {tab === "chat" ? <ChatPanel role="director" channels={channelsFor("director")} /> : null}
      {tab === "tasks" ? <TasksPanel unit={DEPARTMENT.director} /> : null}
      {tab === "notifications" || tab === "settings" ? <NotificationsPanel audience="director" /> : null}
    </DashboardShell>
  )
}
