"use client"

import { useState, useEffect } from "react"
import { collection, getDocs, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { CheckCircle, Clock, Shield, AlertTriangle } from "lucide-react"
import MonitoringHeader from "@/components/monitoring/monitoring-header"
import SubmissionsTable from "@/components/monitoring/submissions-table"
import ChatPanel from "@/components/shared/chat-panel"
import TasksPanel from "@/components/shared/tasks-panel"
import NotificationsPanel from "@/components/shared/notifications-panel"
import CompliancePanel from "@/components/monitoring/compliance-panel"





export default function MonitoringDashboard() {
  const [activeTab, setActiveTab] = useState("overview")
  const [pendingSubmissions, setPendingSubmissions] = useState(0)
  const [approvedSubmissions, setApprovedSubmissions] = useState(0)
  const [complianceIssues, setComplianceIssues] = useState(0)
  const [isFirstParty, setIsFirstParty] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadNotifications, setUnreadNotifications] = useState(0)

  useEffect(() => {
    const fetchData = async () => {
      // Fetch Pending Submissions
      const collectionName = isFirstParty ? "firstpartysubmissions" : "submissions"
      const pendingQuery = query(collection(db, collectionName), where("status", "==", "Monitoring and Enforcement"))
      const pendingSnapshot = await getDocs(pendingQuery)
      setPendingSubmissions(pendingSnapshot.size)

      // Fetch Approved Submissions
      const approvedQuery = query(collection(db, collectionName), where("status", "==", "Final Approval"))
      const approvedSnapshot = await getDocs(approvedQuery)
      setApprovedSubmissions(approvedSnapshot.size)

      // Fetch Compliance Issues (dummy data for now)
      setComplianceIssues(5)

      // Fetch Notifications
      const notificationsQuery = query(
        collection(db, "notifications"),
        where("department", "==", "Monitoring and Enforcement"),
      )
      const notificationsSnapshot = await getDocs(notificationsQuery)
      const notificationsData = notificationsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date(),
      }))

      setNotifications(notificationsData)
      setUnreadNotifications(notificationsData.filter((n) => !n.read).length)
    }

    fetchData()
  }, [isFirstParty])

  return (
    <div className="flex min-h-screen flex-col">
      <MonitoringHeader
        unreadNotifications={unreadNotifications}
        onToggleSubmissionType={() => setIsFirstParty(!isFirstParty)}
        submissionType={isFirstParty ? "First-Party" : "Third-Party"}
      />

      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight">Monitoring & Enforcement Dashboard</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setIsFirstParty(!isFirstParty)}>
              {isFirstParty ? "Switch to Third-Party" : "Switch to First-Party"}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="submissions">Submissions</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
            <TabsTrigger value="chat">
              Chat
              <Badge variant="secondary" className="ml-2">
                3
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="tasks">
              Tasks
              <Badge variant="secondary" className="ml-2">
                6
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="notifications">
              Notifications
              {unreadNotifications > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {unreadNotifications}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card className="bg-blue-600 text-white">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending Submissions</CardTitle>
                  <Clock className="h-4 w-4 text-white" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{pendingSubmissions}</div>
                  <p className="text-xs text-white/70">+2 since last week</p>
                </CardContent>
              </Card>

              <Card className="bg-green-600 text-white">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Approved Submissions</CardTitle>
                  <CheckCircle className="h-4 w-4 text-white" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{approvedSubmissions}</div>
                  <p className="text-xs text-white/70">+1 since last week</p>
                </CardContent>
              </Card>

              <Card className="bg-red-600 text-white">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Compliance Issues</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-white" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{complianceIssues}</div>
                  <p className="text-xs text-white/70">-2 since last month</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
              <Card className="col-span-4">
                <CardHeader>
                  <CardTitle>Recent Submissions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-8">
                    {[1, 2, 3].map((_, i) => (
                      <div className="flex items-center" key={i}>
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={`/placeholder.svg?height=36&width=36`} alt="Avatar" />
                          <AvatarFallback>{`A${i + 1}`}</AvatarFallback>
                        </Avatar>
                        <div className="ml-4 space-y-1">
                          <p className="text-sm font-medium leading-none">Applicant {i + 1}</p>
                          <p className="text-sm text-muted-foreground">
                            {["New Sign", "Upgrading of Existing Sign", "Change of Existing Sign"][i]}
                          </p>
                        </div>
                        <div className="ml-auto font-medium">
                          <Badge variant={["default", "secondary", "outline"][i]}>
                            {["Pending", "In Progress", "Approved"][i]}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="col-span-3">
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>You have {unreadNotifications} unread notifications</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-8">
                    {[
                      { icon: CheckCircle, text: "Submission #1234 approved", time: "2 hours ago" },
                      { icon: Shield, text: "Compliance check completed", time: "4 hours ago" },
                      { icon: AlertTriangle, text: "Non-compliance issue detected", time: "1 day ago" },
                    ].map((item, i) => (
                      <div className="flex items-center" key={i}>
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                          <item.icon className="h-5 w-5" />
                        </div>
                        <div className="ml-4 space-y-1">
                          <p className="text-sm font-medium leading-none">{item.text}</p>
                          <p className="text-sm text-muted-foreground">{item.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="submissions">
            <Card>
              <CardHeader>
                <CardTitle>Submissions Management</CardTitle>
                <CardDescription>
                  Review and enforce {isFirstParty ? "first-party" : "third-party"} submissions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SubmissionsTable isFirstParty={isFirstParty} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="compliance">
            <CompliancePanel />
          </TabsContent>

          <TabsContent value="chat">
            <ChatPanel department="Monitoring and Enforcement" />
          </TabsContent>

          <TabsContent value="tasks">
            <TasksPanel department="Monitoring and Enforcement" />
          </TabsContent>

          <TabsContent value="notifications">
            <NotificationsPanel department="Monitoring and Enforcement" notifications={notifications} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
