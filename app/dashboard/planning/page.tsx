"use client"

import { useState, useEffect } from "react"
import { collection, getDocs, getFirestore, query, where } from "firebase/firestore"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { CheckCircle, Clock, Map, AlertTriangle } from "lucide-react"
import PlanningHeader from "@/components/planning/planning-header"
import SubmissionsTable from "@/components/planning/submissions-table"
import ChatPanel from "@/components/shared/chat-panel"
import TasksPanel from "@/components/shared/tasks-panel"
import NotificationsPanel from "@/components/shared/notifications-panel"
import SiteMapPanel from "@/components/planning/site-map-panel"



import { db } from "@/lib/firebase"

// Initialize Firestore
export default function PlanningDashboard() {
  const [activeTab, setActiveTab] = useState("overview")
  const [pendingSubmissions, setPendingSubmissions] = useState(0)
  const [approvedSubmissions, setApprovedSubmissions] = useState(0)
  const [nearbySites, setNearbySites] = useState(0)
  const [isFirstParty, setIsFirstParty] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadNotifications, setUnreadNotifications] = useState(0)

  useEffect(() => {
    const fetchData = async () => {
      // Fetch Pending Submissions
      const collectionName = isFirstParty ? "firstpartysubmissions" : "submissions"
      const pendingQuery = query(collection(db, collectionName), where("status", "==", "Planning and Development"))
      const pendingSnapshot = await getDocs(pendingQuery)
      setPendingSubmissions(pendingSnapshot.size)

      // Fetch Approved Submissions
      const approvedQuery = query(
        collection(db, collectionName),
        where("status", "==", "Monitoring and Enforcementpending"),
      )
      const approvedSnapshot = await getDocs(approvedQuery)
      setApprovedSubmissions(approvedSnapshot.size)

      // Fetch Nearby Sites (dummy data for now)
      setNearbySites(8)

      // Fetch Notifications
      const notificationsQuery = query(
        collection(db, "notifications"),
        where("department", "==", "Planning and Development"),
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
      <PlanningHeader
        unreadNotifications={unreadNotifications}
        onToggleSubmissionType={() => setIsFirstParty(!isFirstParty)}
        submissionType={isFirstParty ? "First-Party" : "Third-Party"}
      />

      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight">Planning & Development Dashboard</h2>
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
            <TabsTrigger value="sitemap">Site Map</TabsTrigger>
            <TabsTrigger value="chat">
              Chat
              <Badge variant="secondary" className="ml-2">
                2
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="tasks">
              Tasks
              <Badge variant="secondary" className="ml-2">
                4
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

              <Card className="bg-amber-500 text-white">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Nearby Sites</CardTitle>
                  <Map className="h-4 w-4 text-white" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{nearbySites}</div>
                  <p className="text-xs text-white/70">+3 since last month</p>
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
                      { icon: Map, text: "New nearby site detected", time: "5 hours ago" },
                      { icon: AlertTriangle, text: "Potential zoning conflict identified", time: "1 day ago" },
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
                  Review and approve {isFirstParty ? "first-party" : "third-party"} submissions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SubmissionsTable isFirstParty={isFirstParty} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sitemap">
            <SiteMapPanel />
          </TabsContent>

          <TabsContent value="chat">
            <ChatPanel department="Planning and Development" />
          </TabsContent>

          <TabsContent value="tasks">
            <TasksPanel department="Planning and Development" />
          </TabsContent>

          <TabsContent value="notifications">
            <NotificationsPanel department="Planning and Development" notifications={notifications} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
