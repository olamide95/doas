"use client"

import * as React from "react"
import { limit, orderBy } from "firebase/firestore"
import { BadgeCheck, Bell, CalendarDays, CheckCircle2, ClipboardList, FileText, Inbox, LayoutDashboard, ListTodo, MessagesSquare, ScrollText, Users } from "lucide-react"
import { COL } from "@/lib/firebase"
import { channelsFor, stage } from "@/lib/workflow"
import { RegisterPanel } from "@/components/shared/register-panel"
import { useRealtimeCollection } from "@/hooks/use-firestore"
import { formatDate, initials, timeAgo, truncate } from "@/lib/format"
import { typeLabel } from "@/lib/tariff"
import { DashboardShell, type ShellNavItem } from "@/components/dashboard/shell"
import { ChatPanel } from "@/components/dashboard/chat-panel"
import { NotificationsPanel } from "@/components/dashboard/notifications-panel"
import { TasksPanel } from "@/components/dashboard/tasks-panel"
import { useSubmissions } from "@/components/dashboard/work-queue"
import { EmptyState, PageHeading, Panel, RowsSkeleton, StatTile, StatusPill, TONE, toneForStatus } from "@/components/dashboard/kit"
import { CsuSubmissions } from "@/components/csu/submissions-queue"
import MeetingRequestsPanel from "@/components/csu/meeting-requests-panel"
import PractitionerUploadPanel from "@/components/csu/practitioner-upload-panel"

interface ActivityRow {
  action?: string
  comment?: string
  userId?: string
  timestamp?: unknown
}

export default function CSUDashboard() {
  const [tab, setTab] = React.useState("overview")
  const { rows, loading } = useSubmissions(200)

  const practitioners = useRealtimeCollection<{ status?: string }>(COL.practitioners, [orderBy("timestamp", "desc"), limit(400)], [])
  const meetings = useRealtimeCollection<{ status?: string }>(COL.meetings, [orderBy("createdAt", "desc"), limit(200)], [])
  const activity = useRealtimeCollection<ActivityRow>(COL.activity, [orderBy("timestamp", "desc"), limit(12)], [])

  const waiting = rows.filter((r) => stage("withCsu").includes(r.status ?? "")).length
  const returned = rows.filter((r) => stage("blocked").includes(r.status ?? "")).length
  const issued = rows.filter((r) => stage("issued").includes(r.status ?? "")).length
  const meetingsWaiting = meetings.data.filter((m) => (m.status ?? "") === "pending").length
  const activePractitioners = practitioners.data.filter((p) => (p.status ?? "active") === "active").length

  const nav: ShellNavItem[] = [
    { value: "overview", label: "Overview", icon: LayoutDashboard },
    { value: "submissions", label: "Submissions", icon: FileText, badge: waiting + returned },
    { value: "register", label: "Permit register", icon: ScrollText },
    { value: "meetings", label: "Meeting requests", icon: CalendarDays, badge: meetingsWaiting },
    { value: "practitioners", label: "Practitioners", icon: Users },
    { value: "chat", label: "Chat", icon: MessagesSquare },
    { value: "tasks", label: "Tasks", icon: ListTodo },
    { value: "notifications", label: "Notifications", icon: Bell },
  ]

  return (
    <DashboardShell audience="csu" unitName="Customer Service Unit" unitCaption="Customer Service Unit" nav={nav} active={tab} onNavigate={setTab}>
      {tab === "overview" ? (
        <div className="space-y-6">
          <PageHeading
            title="Customer Service Unit"
            description="First point of contact. Screen what comes in, send complete files to the Director, and hand issued permits back to applicants."
          />

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile index={0} label="Waiting on your screening" value={waiting} tone="wait" icon={Inbox} onClick={() => setTab("submissions")} />
            <StatTile index={1} label="Meeting requests to screen" value={meetingsWaiting} tone="move" icon={CalendarDays} onClick={() => setTab("meetings")} />
            <StatTile index={2} label="Permits issued" value={issued} tone="clear" icon={CheckCircle2} onClick={() => setTab("register")} />
            <StatTile
              index={3}
              label="Active practitioners"
              value={activePractitioners}
              tone="idle"
              icon={BadgeCheck}
              note={`${practitioners.data.length} on the register`}
              onClick={() => setTab("practitioners")}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <Panel
              className="lg:col-span-3"
              title="Latest submissions"
              description="Newest first, across both routes"
              actions={
                <button type="button" onClick={() => setTab("submissions")} className="rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] font-semibold hover:bg-muted">
                  Open queue
                </button>
              }
              bodyClassName="p-3 sm:p-4"
            >
              {loading ? (
                <RowsSkeleton rows={5} columns={4} />
              ) : !rows.length ? (
                <EmptyState icon={FileText} title="No submissions yet" description="Applications filed from the public portal land here the moment they're submitted." />
              ) : (
                <ul className="divide-y divide-border">
                  {rows.slice(0, 6).map((row) => (
                    <li key={`${row.route}-${row.id}`} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted font-display text-[11.5px] font-semibold text-muted-foreground">
                        {initials(row.companyName || row.applicantName)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-medium text-foreground">{row.companyName ?? row.applicantName ?? "Unnamed applicant"}</p>
                        <p className="truncate text-[12px] text-muted-foreground">
                          {truncate(typeLabel(row.applicationType), 40)} · {formatDate(row.createdAt)}
                        </p>
                      </div>
                      <StatusPill status={row.status} />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel className="lg:col-span-2" title="Recent activity" description="Every decision recorded across the directorate" bodyClassName="p-3 sm:p-4">
              {activity.loading ? (
                <RowsSkeleton rows={4} columns={2} />
              ) : !activity.data.length ? (
                <EmptyState icon={ClipboardList} title="No activity recorded" description="Every hand-off writes an entry here." />
              ) : (
                <ol className="space-y-3.5">
                  {activity.data.map((entry) => (
                    <li key={entry.id} className="flex gap-3">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE[toneForStatus(entry.action)].dot}`} aria-hidden />
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium leading-snug text-foreground">{entry.action ?? "Update"}</p>
                        <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                          {entry.userId ? `${entry.userId} · ` : ""}
                          {timeAgo(entry.timestamp)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          </div>
        </div>
      ) : null}

      {tab === "submissions" ? (
        <div className="space-y-5">
          <PageHeading title="Submissions" description="Screen what has been filed, then send it to the Director. CSU never routes to a unit directly." />
          <CsuSubmissions />
        </div>
      ) : null}

      {tab === "register" ? (
        <div className="space-y-5">
          <PageHeading title="Permit register" description="Everyone holding a live DOAS permit. Entries are written when the Director signs the permit." />
          <RegisterPanel />
        </div>
      ) : null}

      {tab === "meetings" ? (
        <div className="space-y-5">
          <PageHeading title="Meeting requests" description="Screen visitor requests before they reach the Director's diary." />
          <MeetingRequestsPanel />
        </div>
      ) : null}

      {tab === "practitioners" ? (
        <div className="space-y-5">
          <PageHeading title="Practitioners" description="The register of licensed signage practitioners and the firms they work for." />
          <PractitionerUploadPanel />
        </div>
      ) : null}

      {tab === "chat" ? <ChatPanel role="csu" channels={channelsFor("csu")} /> : null}
      {tab === "tasks" ? <TasksPanel unit="CSU" /> : null}
      {tab === "notifications" || tab === "settings" ? <NotificationsPanel audience="csu" /> : null}
    </DashboardShell>
  )
}
