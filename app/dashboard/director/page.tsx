"use client"

import { useState, useEffect } from "react"
import {
  collection, getDocs, query, where, updateDoc, doc,
  arrayUnion, addDoc, orderBy,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Eye, Forward, CheckCircle, XCircle, CalendarCheck, CalendarX, Clock, Phone, Mail, User } from "lucide-react"

interface Submission {
  id: string
  submissionId: string
  applicantName: string
  email: string
  applicationType: string
  status: string
  department: string
  isFirstParty: boolean
  companyName?: string
  createdAt: any
  siteVisitReport?: any
  businessDevelopmentReport?: any
  billing?: any
  comments?: Array<{ text: string; timestamp: string; action: string }>
}

// Matches exactly what CSU MeetingRequestsPanel saves to Firestore
interface MeetingRequest {
  id: string
  fullName: string
  email: string
  phoneNumber: string
  organization?: string
  purpose: string
  preferredDate: string
  preferredTime: string
  urgency: "low" | "medium" | "high"
  status: "pending" | "approved" | "rejected" | "forwarded" | "scheduled" | "completed"
  assignedTo?: string
  department: string
  notes?: string
  createdAt: any
  updatedAt: any
  directorComment?: string
  responseDate?: string
}

export default function DirectorDashboard() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [meetingRequests, setMeetingRequests] = useState<MeetingRequest[]>([])
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null)
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingRequest | null>(null)
  const [comment, setComment] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isMeetingDialogOpen, setIsMeetingDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("pending")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedDepartment, setSelectedDepartment] = useState<string>("")
  const [pendingMeetingCount, setPendingMeetingCount] = useState(0)

  useEffect(() => { fetchSubmissions() }, [activeTab, selectedDepartment])
  useEffect(() => { fetchMeetingRequests() }, [])

  // ── Fetch from both Firestore collections ──────────────────────────────────
  const fetchSubmissions = async () => {
    const collectionsToQuery: string[] = []
    if (!selectedDepartment || selectedDepartment === "all") {
      collectionsToQuery.push("firstPartySubmissions", "thirdPartySubmissions")
    } else if (selectedDepartment === "first-party") {
      collectionsToQuery.push("firstPartySubmissions")
    } else {
      collectionsToQuery.push("thirdPartySubmissions")
    }

    const allResults: Submission[] = []

    for (const collectionName of collectionsToQuery) {
      let q

      if (activeTab === "pending") {
        q = query(
          collection(db, collectionName),
          where("department", "==", "Director"),
          where("status", "in", ["Pending", "Forwarded to Director", "Documents Submitted", "Payment Verified"]),
          orderBy("createdAt", "desc")
        )
      } else if (activeTab === "site-visit") {
        q = query(
          collection(db, collectionName),
          where("status", "==", "Site Visit Completed"),
          orderBy("createdAt", "desc")
        )
      } else if (activeTab === "approved") {
        q = query(
          collection(db, collectionName),
          where("status", "==", "Approved"),
          orderBy("createdAt", "desc")
        )
      }

      if (q) {
        const snapshot = await getDocs(q)
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          isFirstParty: collectionName === "firstPartySubmissions",
        } as Submission))
        allResults.push(...data)
      }
    }

    allResults.sort((a, b) => {
      const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0
      const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0
      return bTime - aTime
    })

    setSubmissions(allResults)
  }

  // ── Fetch meeting requests forwarded to Director ───────────────────────────
  const fetchMeetingRequests = async () => {
    try {
      const q = query(
        collection(db, "meetingRequests"),
        where("department", "==", "Director"),
        orderBy("createdAt", "desc")
      )
      const snapshot = await getDocs(q)
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as MeetingRequest))
      setMeetingRequests(data)
      setPendingMeetingCount(data.filter((m) => m.status === "forwarded").length)
    } catch (err) {
      console.error("Error fetching meeting requests:", err)
    }
  }

  // ── Submission dialog ──────────────────────────────────────────────────────
  const handleView = (submission: Submission) => { setSelectedSubmission(submission); setIsDialogOpen(true) }
  const handleClose = () => { setSelectedSubmission(null); setComment(""); setIsDialogOpen(false) }

  // ── Meeting dialog ─────────────────────────────────────────────────────────
  const handleMeetingView = (meeting: MeetingRequest) => { setSelectedMeeting(meeting); setComment(""); setIsMeetingDialogOpen(true) }
  const handleMeetingClose = () => { setSelectedMeeting(null); setComment(""); setIsMeetingDialogOpen(false) }

  const handleMeetingAction = async (action: "approved" | "rejected") => {
    if (!selectedMeeting) return
    try {
      const now = new Date().toISOString()

      await updateDoc(doc(db, "meetingRequests", selectedMeeting.id), {
        status: action,
        directorComment: comment,
        responseDate: now,
        updatedAt: now,
      })

      // Notify CSU of the Director's decision
      await addDoc(collection(db, "notifications"), {
        userId: "csu",
        content: `Meeting request for ${selectedMeeting.fullName} has been ${action} by the Director.${comment ? ` Note: ${comment}` : ""}`,
        type: action === "approved" ? "success" : "error",
        referenceId: selectedMeeting.id,
        isRead: false,
        createdAt: now,
      })

      await addDoc(collection(db, "activityLogs"), {
        action: `Meeting Request ${action} by Director`,
        timestamp: now,
        comment,
        userId: "director",
        referenceId: selectedMeeting.id,
      })

      fetchMeetingRequests()
      handleMeetingClose()
    } catch (err) {
      console.error("Error updating meeting request:", err)
    }
  }

  // ── Submission actions ─────────────────────────────────────────────────────
  const handleAction = async (action: string, nextDepartment?: string, nextStatus?: string) => {
    if (!selectedSubmission) return
    try {
      const collectionName = selectedSubmission.isFirstParty ? "firstPartySubmissions" : "thirdPartySubmissions"
      const now = new Date().toISOString()
      const actionText =
        action === "approve" ? "Approved by Director" :
        action === "reject"  ? "Rejected by Director" :
        `Forwarded to ${nextDepartment} by Director`

      const updateData: any = {
        status: nextStatus || (action === "approve" ? "Approved" : action === "reject" ? "Rejected" : selectedSubmission.status),
        department: nextDepartment || selectedSubmission.department,
        comments: arrayUnion({ text: comment, timestamp: now, action: actionText }),
        updatedAt: now,
      }

      if (action === "approve" && !selectedSubmission.isFirstParty && selectedSubmission.status === "Site Visit Completed") {
        updateData.status = "Site Visit Approved"; updateData.department = "CSU"
      }
      if (action === "approve" && selectedSubmission.status === "Documents Submitted") {
        updateData.status = "Documents Approved"; updateData.department = "Finance"
      }
      if (action === "approve" && selectedSubmission.status === "Payment Verified") {
        updateData.status = "Approved"; updateData.department = "CSU"
      }

      await updateDoc(doc(db, collectionName, selectedSubmission.id), updateData)
      await addDoc(collection(db, "activityLogs"), {
        submissionId: selectedSubmission.id, action: actionText,
        timestamp: now, comment, userId: "director",
      })

      let notifyUserId = ""
      if (nextDepartment === "Monitoring and Enforcement" || nextDepartment === "Planning and Development")
        notifyUserId = nextDepartment.toLowerCase().replace(/ /g, "_")
      else if (nextDepartment === "Finance") notifyUserId = "finance"
      else if (nextDepartment === "CSU" || action === "reject") notifyUserId = "csu"

      if (notifyUserId) {
        await addDoc(collection(db, "notifications"), {
          userId: notifyUserId,
          content: `${actionText} for ${selectedSubmission.applicantName}`,
          type: "info", referenceId: selectedSubmission.id, isRead: false, createdAt: now,
        })
      }

      fetchSubmissions()
      handleClose()
    } catch (err) {
      console.error("Error processing submission:", err)
    }
  }

  const getAvailableActions = (submission: Submission) => {
    const rejectBtn = (
      <Button key="reject" variant="destructive" onClick={() => handleAction("reject", "CSU", "Rejected")}>
        <XCircle className="h-4 w-4 mr-2" /> Reject
      </Button>
    )
    const actions = []

    if (submission.status === "Forwarded to Director" || submission.status === "Pending") {
      actions.push(rejectBtn)
      if (submission.isFirstParty) {
        actions.push(
          <Button key="bd" onClick={() => handleAction("forward", "Business Development", "Forwarded to Business Development")}>
            <Forward className="h-4 w-4 mr-2" /> To Business Dev
          </Button>
        )
      } else {
        actions.push(
          <Button key="mon" onClick={() => handleAction("forward", "Monitoring and Enforcement", "Site Visit Required")}>
            <Forward className="h-4 w-4 mr-2" /> To Monitoring
          </Button>,
          <Button key="plan" onClick={() => handleAction("forward", "Planning and Development", "Site Visit Required")}>
            <Forward className="h-4 w-4 mr-2" /> To Planning
          </Button>
        )
      }
    } else if (submission.status === "Site Visit Completed") {
      actions.push(rejectBtn, <Button key="approve" onClick={() => handleAction("approve")}><CheckCircle className="h-4 w-4 mr-2" /> Approve Site Visit</Button>)
    } else if (submission.status === "Documents Submitted") {
      actions.push(rejectBtn, <Button key="approve" onClick={() => handleAction("approve")}><CheckCircle className="h-4 w-4 mr-2" /> Approve Documents</Button>)
    } else if (submission.status === "Payment Verified") {
      actions.push(rejectBtn, <Button key="approve" onClick={() => handleAction("approve")}><CheckCircle className="h-4 w-4 mr-2" /> Final Approval</Button>)
    }

    return actions
  }

  const filteredSubmissions = submissions.filter(
    (s) =>
      s.applicantName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.submissionId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getMeetingStatusBadge = (status: string) => {
    switch (status) {
      case "approved": return <Badge className="bg-green-100 text-green-800"><CalendarCheck className="h-3 w-3 mr-1" />Approved</Badge>
      case "rejected": return <Badge variant="destructive"><CalendarX className="h-3 w-3 mr-1" />Rejected</Badge>
      case "forwarded": return <Badge className="bg-blue-100 text-blue-800"><Clock className="h-3 w-3 mr-1" />Awaiting Review</Badge>
      case "scheduled": return <Badge className="bg-purple-100 text-purple-800"><CalendarCheck className="h-3 w-3 mr-1" />Scheduled</Badge>
      default: return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pending</Badge>
    }
  }

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case "high": return <Badge variant="destructive">High</Badge>
      case "medium": return <Badge className="bg-yellow-500 text-white">Medium</Badge>
      default: return <Badge className="bg-gray-400 text-white">Low</Badge>
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Director's Dashboard</CardTitle>
          <CardDescription>Review and manage all submissions</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">

            {/* ── Top Controls ── */}
            <div className="flex flex-col gap-4 mb-6">
              <div className="flex justify-between items-center">
                <TabsList>
                  <TabsTrigger value="pending">Pending Review</TabsTrigger>
                  <TabsTrigger value="site-visit">Site Visit Reports</TabsTrigger>
                  <TabsTrigger value="approved">Approved</TabsTrigger>
                  <TabsTrigger value="meetings">
                    Meeting Requests
                    {pendingMeetingCount > 0 && (
                      <Badge variant="secondary" className="ml-2">{pendingMeetingCount}</Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                <div className="flex gap-4">
                  <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="first-party">First Party</SelectItem>
                      <SelectItem value="third-party">Third Party</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="relative w-64">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search submissions..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8" />
                  </div>
                </div>
              </div>

              {/* ── Stats ── */}
              <div className="grid grid-cols-4 gap-4">
                <Card><CardContent className="pt-6">
                  <div className="text-2xl font-bold text-blue-600">{submissions.filter((s) => s.status === "Forwarded to Director").length}</div>
                  <p className="text-sm text-muted-foreground">Pending Review</p>
                </CardContent></Card>
                <Card><CardContent className="pt-6">
                  <div className="text-2xl font-bold text-orange-600">{submissions.filter((s) => s.status === "Site Visit Completed").length}</div>
                  <p className="text-sm text-muted-foreground">Site Visit Reports</p>
                </CardContent></Card>
                <Card><CardContent className="pt-6">
                  <div className="text-2xl font-bold text-green-600">{submissions.filter((s) => s.status === "Approved").length}</div>
                  <p className="text-sm text-muted-foreground">Approved</p>
                </CardContent></Card>
                <Card><CardContent className="pt-6">
                  <div className="text-2xl font-bold text-purple-600">{pendingMeetingCount}</div>
                  <p className="text-sm text-muted-foreground">Pending Meetings</p>
                </CardContent></Card>
              </div>
            </div>

            {/* ── Pending Review ── */}
            <TabsContent value="pending" className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Submission ID</TableHead><TableHead>Applicant</TableHead>
                    <TableHead>Type</TableHead><TableHead>Application Type</TableHead>
                    <TableHead>Status</TableHead><TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubmissions.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No pending submissions found</TableCell></TableRow>
                  ) : filteredSubmissions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-sm">{s.submissionId}</TableCell>
                      <TableCell>
                        <div className="font-medium">{s.applicantName}</div>
                        {s.companyName && <div className="text-sm text-muted-foreground">{s.companyName}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.isFirstParty ? "default" : "secondary"}>
                          {s.isFirstParty ? "First Party" : "Third Party"}
                        </Badge>
                      </TableCell>
                      <TableCell>{s.applicationType}</TableCell>
                      <TableCell>
                        <Badge variant={
                          s.status === "Pending" ? "outline" :
                          s.status === "Forwarded to Director" ? "default" :
                          s.status === "Documents Submitted" ? "secondary" : "destructive"
                        }>{s.status}</Badge>
                      </TableCell>
                      <TableCell>{s.createdAt?.toDate ? new Date(s.createdAt.toDate()).toLocaleDateString() : "N/A"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleView(s)}>
                          <Eye className="h-4 w-4 mr-1" /> Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            {/* ── Site Visit Reports ── */}
            <TabsContent value="site-visit" className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Submission ID</TableHead><TableHead>Applicant/Company</TableHead>
                    <TableHead>Reporting Officer</TableHead><TableHead>Date</TableHead>
                    <TableHead>Recommendation</TableHead><TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubmissions.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No site visit reports found</TableCell></TableRow>
                  ) : filteredSubmissions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-sm">{s.submissionId}</TableCell>
                      <TableCell>
                        <div className="font-medium">{s.applicantName}</div>
                        {s.companyName && <div className="text-sm text-muted-foreground">{s.companyName}</div>}
                      </TableCell>
                      <TableCell>{s.siteVisitReport?.reportingOfficer || s.businessDevelopmentReport?.reportingOfficer || "N/A"}</TableCell>
                      <TableCell>{s.createdAt?.toDate ? new Date(s.createdAt.toDate()).toLocaleDateString() : "N/A"}</TableCell>
                      <TableCell>
                        <Badge variant={
                          s.siteVisitReport?.approvableComments?.toLowerCase().includes("approve") ||
                          s.businessDevelopmentReport?.comments?.toLowerCase().includes("approve") ? "default" : "destructive"
                        }>
                          {s.siteVisitReport?.approvableComments || s.businessDevelopmentReport?.comments || "Pending"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleView(s)}>
                          <Eye className="h-4 w-4 mr-1" /> Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            {/* ── Approved ── */}
            <TabsContent value="approved" className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Submission ID</TableHead><TableHead>Applicant/Company</TableHead>
                    <TableHead>Application Type</TableHead><TableHead>Date</TableHead>
                    <TableHead>Type</TableHead><TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubmissions.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No approved submissions found</TableCell></TableRow>
                  ) : filteredSubmissions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-sm">{s.submissionId}</TableCell>
                      <TableCell>
                        <div className="font-medium">{s.applicantName}</div>
                        {s.companyName && <div className="text-sm text-muted-foreground">{s.companyName}</div>}
                      </TableCell>
                      <TableCell>{s.applicationType}</TableCell>
                      <TableCell>{s.createdAt?.toDate ? new Date(s.createdAt.toDate()).toLocaleDateString() : "N/A"}</TableCell>
                      <TableCell>
                        <Badge variant={s.isFirstParty ? "default" : "secondary"}>
                          {s.isFirstParty ? "First Party" : "Third Party"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" /> Approved
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            {/* ── Meeting Requests ── */}
            <TabsContent value="meetings" className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Requester</TableHead>
                    <TableHead>Purpose</TableHead>
                    <TableHead>Preferred Date</TableHead>
                    <TableHead>Preferred Time</TableHead>
                    <TableHead>Urgency</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {meetingRequests.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No meeting requests found</TableCell></TableRow>
                  ) : meetingRequests.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <div className="font-medium">{m.fullName}</div>
                        <div className="text-sm text-muted-foreground">{m.email}</div>
                        {m.organization && <div className="text-xs text-muted-foreground">{m.organization}</div>}
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate">{m.purpose}</TableCell>
                      <TableCell>{m.preferredDate ? new Date(m.preferredDate).toLocaleDateString() : "N/A"}</TableCell>
                      <TableCell>{m.preferredTime || "N/A"}</TableCell>
                      <TableCell>{getUrgencyBadge(m.urgency)}</TableCell>
                      <TableCell>{getMeetingStatusBadge(m.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleMeetingView(m)}>
                          <Eye className="h-4 w-4 mr-1" />
                          {m.status === "forwarded" ? "Review" : "View"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* ── Submission Review Dialog ── */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Submission Review</DialogTitle>
            <DialogDescription>Review submission details and take appropriate action</DialogDescription>
          </DialogHeader>

          {selectedSubmission && (
            <ScrollArea className="flex-1 pr-4">
              <Tabs defaultValue="details" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="report">Site Visit Report</TabsTrigger>
                  <TabsTrigger value="billing">Billing</TabsTrigger>
                  <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>

                <TabsContent value="details">
                  <Card>
                    <CardHeader><CardTitle>Applicant Information</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4">
                      <div><p className="text-sm font-medium text-muted-foreground">Name</p><p>{selectedSubmission.applicantName}</p></div>
                      <div><p className="text-sm font-medium text-muted-foreground">Email</p><p>{selectedSubmission.email}</p></div>
                      <div><p className="text-sm font-medium text-muted-foreground">Submission ID</p><p className="font-mono">{selectedSubmission.submissionId}</p></div>
                      <div><p className="text-sm font-medium text-muted-foreground">Application Type</p><p>{selectedSubmission.applicationType}</p></div>
                      {selectedSubmission.companyName && (
                        <div><p className="text-sm font-medium text-muted-foreground">Company</p><p>{selectedSubmission.companyName}</p></div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Type</p>
                        <Badge variant={selectedSubmission.isFirstParty ? "default" : "secondary"}>
                          {selectedSubmission.isFirstParty ? "First Party" : "Third Party"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="report">
                  {selectedSubmission.siteVisitReport ? (
                    <Card>
                      <CardHeader><CardTitle>Site Visit Report</CardTitle></CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div><p className="text-sm font-medium text-muted-foreground">Client Name</p><p>{selectedSubmission.siteVisitReport.clientName}</p></div>
                          <div><p className="text-sm font-medium text-muted-foreground">Registration</p><p>{selectedSubmission.siteVisitReport.registrationWithDOAS}</p></div>
                          <div><p className="text-sm font-medium text-muted-foreground">Board Location</p><p>{selectedSubmission.siteVisitReport.boardLocation}</p></div>
                          <div><p className="text-sm font-medium text-muted-foreground">GPS Coordinates</p><p>{selectedSubmission.siteVisitReport.gpsCoordinates}</p></div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Human Obstruction</p>
                            <Badge variant={selectedSubmission.siteVisitReport.humanObstruction === "Yes" ? "destructive" : "default"}>{selectedSubmission.siteVisitReport.humanObstruction}</Badge>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Vacant</p>
                            <Badge variant={selectedSubmission.siteVisitReport.vacant === "Yes" ? "default" : "secondary"}>{selectedSubmission.siteVisitReport.vacant}</Badge>
                          </div>
                        </div>
                        <div><p className="text-sm font-medium text-muted-foreground">Approvable Comments</p><p className="p-2 bg-muted rounded">{selectedSubmission.siteVisitReport.approvableComments}</p></div>
                        <div><p className="text-sm font-medium text-muted-foreground">Reporting Officer</p><p>{selectedSubmission.siteVisitReport.reportingOfficer} ({selectedSubmission.siteVisitReport.reportingOfficerRank})</p></div>
                      </CardContent>
                    </Card>
                  ) : selectedSubmission.businessDevelopmentReport ? (
                    <Card>
                      <CardHeader><CardTitle>Business Development Report</CardTitle></CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div><p className="text-sm font-medium text-muted-foreground">Company Name</p><p>{selectedSubmission.businessDevelopmentReport.companyName}</p></div>
                          <div><p className="text-sm font-medium text-muted-foreground">Dimensions</p><p>{selectedSubmission.businessDevelopmentReport.length}m x {selectedSubmission.businessDevelopmentReport.width}m</p></div>
                          <div><p className="text-sm font-medium text-muted-foreground">Location</p><p>{selectedSubmission.businessDevelopmentReport.location}</p></div>
                          <div><p className="text-sm font-medium text-muted-foreground">GPS Coordinates</p><p>{selectedSubmission.businessDevelopmentReport.gpsCoordinates}</p></div>
                        </div>
                        <div><p className="text-sm font-medium text-muted-foreground">Comments</p><p className="p-2 bg-muted rounded">{selectedSubmission.businessDevelopmentReport.comments}</p></div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card><CardContent className="py-8"><p className="text-center text-muted-foreground">No site visit report available</p></CardContent></Card>
                  )}
                </TabsContent>

                <TabsContent value="billing">
                  {selectedSubmission.billing ? (
                    <Card>
                      <CardHeader><CardTitle>Billing Information</CardTitle></CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                          <div><p className="text-sm font-medium text-muted-foreground">Invoice Number</p><p className="font-mono">{selectedSubmission.billing.invoiceNumber}</p></div>
                          <div><p className="text-sm font-medium text-muted-foreground">Due Date</p><p>{new Date(selectedSubmission.billing.dueDate).toLocaleDateString()}</p></div>
                          <div><p className="text-sm font-medium text-muted-foreground">Application Fee</p><p className="font-bold">₦{selectedSubmission.billing.applicationFee?.toLocaleString()}</p></div>
                          <div><p className="text-sm font-medium text-muted-foreground">Processing Fee</p><p className="font-bold">₦{selectedSubmission.billing.processingFee?.toLocaleString()}</p></div>
                          <div><p className="text-sm font-medium text-muted-foreground">Annual Fee</p><p className="font-bold">₦{selectedSubmission.billing.annualFee?.toLocaleString()}</p></div>
                          <div><p className="text-sm font-medium text-muted-foreground">Total Amount</p><p className="font-bold text-lg">₦{selectedSubmission.billing.totalAmount?.toLocaleString()}</p></div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Payment Status</p>
                            <Badge variant={selectedSubmission.billing.paymentStatus === "Paid" ? "default" : "destructive"}>
                              {selectedSubmission.billing.paymentStatus || "Pending"}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card><CardContent className="py-8"><p className="text-center text-muted-foreground">No billing information available</p></CardContent></Card>
                  )}
                </TabsContent>

                <TabsContent value="history">
                  <Card>
                    <CardHeader><CardTitle>Submission History</CardTitle></CardHeader>
                    <CardContent>
                      {selectedSubmission.comments && selectedSubmission.comments.length > 0 ? (
                        <div className="space-y-4">
                          {selectedSubmission.comments.map((c, i) => (
                            <div key={i} className="border-l-2 border-muted pl-4">
                              <p className="font-medium">{c.action}</p>
                              <p className="text-sm text-muted-foreground">{new Date(c.timestamp).toLocaleString()}</p>
                              <p className="mt-1">{c.text}</p>
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-muted-foreground">No history available</p>}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </ScrollArea>
          )}

          <div className="mt-4">
            <Label htmlFor="comment" className="mb-2 block">Comments</Label>
            <Textarea id="comment" placeholder="Add your comments here..." value={comment} onChange={(e) => setComment(e.target.value)} className="mb-4" rows={3} />
          </div>
          <DialogFooter className="flex justify-between">
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            <div className="flex gap-2">{selectedSubmission && getAvailableActions(selectedSubmission)}</div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Meeting Request Review Dialog ── */}
      <Dialog open={isMeetingDialogOpen} onOpenChange={setIsMeetingDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Meeting Request</DialogTitle>
            <DialogDescription>Review and respond to this meeting request from CSU</DialogDescription>
          </DialogHeader>

          {selectedMeeting && (
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Requester</p>
                      <p className="font-medium">{selectedMeeting.fullName}</p>
                      {selectedMeeting.organization && <p className="text-sm text-muted-foreground">{selectedMeeting.organization}</p>}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Urgency</p>
                      {getUrgencyBadge(selectedMeeting.urgency)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Email</p>
                      <p className="text-sm">{selectedMeeting.email}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Phone</p>
                      <p className="text-sm">{selectedMeeting.phoneNumber}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Preferred Date</p>
                      <p className="text-sm">{selectedMeeting.preferredDate ? new Date(selectedMeeting.preferredDate).toLocaleDateString() : "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Preferred Time</p>
                      <p className="text-sm">{selectedMeeting.preferredTime || "N/A"}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Purpose</p>
                    <p className="p-2 bg-muted rounded text-sm mt-1">{selectedMeeting.purpose}</p>
                  </div>
                  {selectedMeeting.notes && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">CSU Notes</p>
                      <p className="p-2 bg-muted rounded text-sm mt-1">{selectedMeeting.notes}</p>
                    </div>
                  )}
                  {selectedMeeting.status !== "forwarded" && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Your Response</p>
                      <div className="flex items-center gap-2">{getMeetingStatusBadge(selectedMeeting.status)}</div>
                      {selectedMeeting.directorComment && (
                        <p className="text-sm text-muted-foreground mt-1">{selectedMeeting.directorComment}</p>
                      )}
                      {selectedMeeting.responseDate && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Responded on {new Date(selectedMeeting.responseDate).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {selectedMeeting.status === "forwarded" && (
                <div>
                  <Label htmlFor="meeting-comment" className="mb-2 block">
                    Response / Comments <span className="text-muted-foreground text-xs">(optional)</span>
                  </Label>
                  <Textarea
                    id="meeting-comment"
                    placeholder="Add any notes for CSU..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex justify-between">
            <Button variant="outline" onClick={handleMeetingClose}>Close</Button>
            {selectedMeeting?.status === "forwarded" && (
              <div className="flex gap-2">
                <Button variant="destructive" onClick={() => handleMeetingAction("rejected")}>
                  <CalendarX className="h-4 w-4 mr-2" /> Reject
                </Button>
                <Button onClick={() => handleMeetingAction("approved")}>
                  <CalendarCheck className="h-4 w-4 mr-2" /> Approve
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}