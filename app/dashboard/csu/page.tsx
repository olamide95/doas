"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import CSUHeader from "@/components/csu/csu-header"
import PractitionerUploadPanel from "@/components/csu/practitioner-upload-panel"
import MeetingRequestsPanel from "@/components/csu/meeting-requests-panel"
import SubmissionsTable from "@/components/csu/submissions-table"
import { ChatPanel } from "@/components/common/chat-panel"
import { TasksPanel } from "@/components/common/tasks-panel"
import { NotificationsPanel } from "@/components/common/notifications-panel"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  FileText, CheckCircle, Clock, Upload, Users,
  TrendingUp, ArrowUpRight, Calendar, Bell,
} from "lucide-react"

export default function CSUDashboard() {
  const [activeTab, setActiveTab] = useState("overview")
  const [isFirstParty, setIsFirstParty] = useState(false)
  const [pendingSubmissions] = useState(5)
  const [approvedSubmissions] = useState(12)
  const [practitioners] = useState(24)
  const [unreadNotifications, setUnreadNotifications] = useState(3)

  const recentSubmissions = [
    { name: "Adebayo Okafor", type: "New Sign", status: "Pending", statusColor: "bg-yellow-100 text-yellow-800 border-yellow-200", avatar: "AO" },
    { name: "Chisom Enterprises Ltd", type: "Upgrading of Existing Sign", status: "In Progress", statusColor: "bg-blue-100 text-blue-800 border-blue-200", avatar: "CE" },
    { name: "Federal Capital Authority", type: "Change of Existing Sign", status: "Approved", statusColor: "bg-green-100 text-green-800 border-green-200", avatar: "FC" },
  ]

  const recentActivity = [
    { icon: CheckCircle, text: "Submission #1234 forwarded to Finance", time: "1 hour ago", color: "text-green-600", bg: "bg-green-100" },
    { icon: FileText, text: "New first-party submission received", time: "3 hours ago", color: "text-blue-600", bg: "bg-blue-100" },
    { icon: Upload, text: "New practitioner documents uploaded", time: "1 day ago", color: "text-purple-600", bg: "bg-purple-100" },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-slate-50/50">
      <CSUHeader
        unreadNotifications={unreadNotifications}
        onToggleSubmissionType={() => setIsFirstParty(!isFirstParty)}
        submissionType={isFirstParty ? "First-Party" : "Third-Party"}
      />

      <div className="flex-1 space-y-6 p-6 pt-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">CSU Dashboard</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Customer Service Unit — Manage submissions and practitioners
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-white border rounded-lg px-3 py-2">
            <Calendar className="h-4 w-4" />
            {new Date().toLocaleDateString("en-NG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </div>
        </div>

        <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="bg-white border rounded-xl p-1 inline-flex">
            <TabsList className="bg-transparent gap-1 h-auto">
              {[
                { value: "overview", label: "Overview" },
                { value: "submissions", label: "Submissions" },
                { value: "meeting-requests", label: "Meeting Requests" },
                { value: "practitioners", label: "Practitioners" },
                { value: "chat", label: "Chat", badge: 2 },
                { value: "tasks", label: "Tasks", badge: 3 },
                { value: "notifications", label: "Notifications", badge: unreadNotifications > 0 ? unreadNotifications : null },
              ].map(({ value, label, badge }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-sm h-9 px-4 text-sm font-medium gap-2"
                >
                  {label}
                  {badge && (
                    <span className="inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
                      {badge}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* ── OVERVIEW ──────────────────────────────────────────────── */}
          <TabsContent value="overview" className="space-y-6">
            {/* Stat Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  title: "Pending Submissions",
                  value: pendingSubmissions,
                  change: "+3 this week",
                  icon: Clock,
                  gradient: "from-amber-500 to-orange-500",
                  bg: "bg-amber-50",
                  iconColor: "text-amber-600",
                },
                {
                  title: "Approved Submissions",
                  value: approvedSubmissions,
                  change: "+2 this week",
                  icon: CheckCircle,
                  gradient: "from-emerald-500 to-green-600",
                  bg: "bg-emerald-50",
                  iconColor: "text-emerald-600",
                },
                {
                  title: "Registered Practitioners",
                  value: practitioners,
                  change: "+5 this month",
                  icon: Users,
                  gradient: "from-violet-500 to-purple-600",
                  bg: "bg-violet-50",
                  iconColor: "text-violet-600",
                },
              ].map((stat) => (
                <Card key={stat.title} className="border-0 shadow-sm overflow-hidden">
                  <CardContent className="p-0">
                    <div className={`bg-gradient-to-br ${stat.gradient} p-5 text-white`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-white/80 text-sm font-medium">{stat.title}</p>
                          <p className="text-4xl font-bold mt-2">{stat.value}</p>
                        </div>
                        <div className="h-12 w-12 rounded-2xl bg-white/20 flex items-center justify-center">
                          <stat.icon className="h-6 w-6 text-white" />
                        </div>
                      </div>
                      <div className="flex items-center gap-1 mt-4 text-white/70 text-xs">
                        <TrendingUp className="h-3 w-3" />
                        {stat.change}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
              {/* Recent Submissions */}
              <Card className="col-span-4 border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">Recent Submissions</CardTitle>
                    <button
                      onClick={() => setActiveTab("submissions")}
                      className="text-xs text-primary flex items-center gap-1 hover:underline"
                    >
                      View all <ArrowUpRight className="h-3 w-3" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentSubmissions.map((item, i) => (
                      <div key={i} className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted/40 transition-colors">
                        <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                          <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs font-bold">
                            {item.avatar}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.type}</p>
                        </div>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${item.statusColor}`}>
                          {item.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card className="col-span-3 border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
                    <button
                      onClick={() => setActiveTab("notifications")}
                      className="relative"
                    >
                      <Bell className="h-4 w-4 text-muted-foreground" />
                      {unreadNotifications > 0 && (
                        <span className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-red-500 rounded-full flex items-center justify-center text-[8px] text-white font-bold">
                          {unreadNotifications}
                        </span>
                      )}
                    </button>
                  </div>
                  <CardDescription className="text-xs">
                    {unreadNotifications} unread notification{unreadNotifications !== 1 ? "s" : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentActivity.map((item, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className={`h-8 w-8 rounded-xl ${item.bg} flex items-center justify-center flex-shrink-0`}>
                          <item.icon className={`h-4 w-4 ${item.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-snug">{item.text}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{item.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── SUBMISSIONS ───────────────────────────────────────────── */}
          <TabsContent value="submissions">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Submissions Management</CardTitle>
                <CardDescription>
                  Manage {isFirstParty ? "first-party" : "third-party"} submissions — review, forward, or reject applications
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SubmissionsTable />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── MEETING REQUESTS ──────────────────────────────────────── */}
          <TabsContent value="meeting-requests">
            <MeetingRequestsPanel />
          </TabsContent>

          {/* ── PRACTITIONERS ────────────────────────────────────────── */}
          <TabsContent value="practitioners">
            <PractitionerUploadPanel />
          </TabsContent>

          {/* ── CHAT / TASKS / NOTIFICATIONS ─────────────────────────── */}
          <TabsContent value="chat">
            <ChatPanel department="CSU" />
          </TabsContent>

          <TabsContent value="tasks">
            <TasksPanel department="CSU" />
          </TabsContent>

          <TabsContent value="notifications">
            <NotificationsPanel department="CSU" />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}