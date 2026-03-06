// app/admin/director/page.tsx
"use client"

import { useState, useEffect } from "react"
import { collection, getDocs, query, where, updateDoc, doc, arrayUnion, addDoc, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Filter, Eye, Forward, CheckCircle, XCircle, AlertCircle } from "lucide-react"

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
  comments?: Array<{
    text: string
    timestamp: string
    action: string
  }>
}

export default function DirectorSubmissionsTable() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null)
  const [comment, setComment] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("pending")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedDepartment, setSelectedDepartment] = useState<string>("")

  useEffect(() => {
    fetchSubmissions()
  }, [activeTab, selectedDepartment])

  const fetchSubmissions = async () => {
    let q
    
    if (activeTab === "pending") {
      q = query(
        collection(db, "submissions"),
        where("department", "==", "Director"),
        where("status", "in", ["Pending", "Forwarded to Director", "Documents Submitted", "Payment Verified"]),
        orderBy("createdAt", "desc")
      )
    } else if (activeTab === "site-visit") {
      q = query(
        collection(db, "submissions"),
        where("status", "==", "Site Visit Completed"),
        where("siteVisitReport", "!=", null),
        orderBy("createdAt", "desc")
      )
    } else if (activeTab === "approved") {
      q = query(
        collection(db, "submissions"),
        where("status", "==", "Approved"),
        orderBy("createdAt", "desc")
      )
    }

    if (q) {
      const snapshot = await getDocs(q)
      let data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Submission))
      
      // Filter by department if selected
      if (selectedDepartment && selectedDepartment !== "all") {
        data = data.filter(sub => 
          selectedDepartment === "first-party" ? sub.isFirstParty : !sub.isFirstParty
        )
      }
      
      setSubmissions(data)
    }
  }

  const handleView = (submission: Submission) => {
    setSelectedSubmission(submission)
    setIsDialogOpen(true)
  }

  const handleClose = () => {
    setSelectedSubmission(null)
    setComment("")
    setIsDialogOpen(false)
  }

  const handleAction = async (action: string, nextDepartment?: string, nextStatus?: string) => {
    if (!selectedSubmission) return

    try {
      const collectionName = selectedSubmission.isFirstParty ? "firstPartySubmissions" : "thirdPartySubmissions"
      const submissionRef = doc(db, collectionName, selectedSubmission.id)
      
      const now = new Date().toISOString()
      const actionText = action === "approve" ? "Approved by Director" : 
                         action === "reject" ? "Rejected by Director" :
                         `Forwarded to ${nextDepartment} by Director`

      const updateData: any = {
        status: nextStatus || (action === "approve" ? "Approved" : action === "reject" ? "Rejected" : selectedSubmission.status),
        department: nextDepartment || selectedSubmission.department,
        comments: arrayUnion({
          text: comment,
          timestamp: now,
          action: actionText,
        }),
        updatedAt: now,
      }

      if (action === "approve" && !selectedSubmission.isFirstParty && selectedSubmission.status === "Site Visit Completed") {
        updateData.status = "Site Visit Approved"
        updateData.department = "CSU" // Notify applicant to complete practitioner info
      }

      if (action === "approve" && selectedSubmission.status === "Documents Submitted") {
        updateData.status = "Documents Approved"
        updateData.department = "Finance"
      }

      if (action === "approve" && selectedSubmission.status === "Payment Verified") {
        updateData.status = "Approved"
        updateData.department = "CSU" // For final notification
      }

      await updateDoc(submissionRef, updateData)

      // Log activity
      await addDoc(collection(db, "activityLogs"), {
        submissionId: selectedSubmission.id,
        action: actionText,
        timestamp: now,
        comment: comment,
        userId: "director",
      })

      // Create notification
      let notificationUserId = ""
      if (nextDepartment === "Monitoring and Enforcement" || nextDepartment === "Planning and Development") {
        notificationUserId = nextDepartment.toLowerCase().replace(/ /g, "_")
      } else if (nextDepartment === "Finance") {
        notificationUserId = "finance"
      } else if (nextDepartment === "CSU") {
        notificationUserId = "csu"
      } else if (action === "reject") {
        notificationUserId = "csu" // Notify CSU about rejection
      }

      if (notificationUserId) {
        await addDoc(collection(db, "notifications"), {
          userId: notificationUserId,
          content: `${actionText} for ${selectedSubmission.applicantName}`,
          type: "info",
          referenceId: selectedSubmission.id,
          isRead: false,
          createdAt: now,
        })
      }

      fetchSubmissions()
      handleClose()
    } catch (err) {
      console.error("Error processing submission:", err)
    }
  }

  const getAvailableActions = (submission: Submission) => {
    const actions = []
    
    if (submission.status === "Forwarded to Director" || submission.status === "Pending") {
      actions.push(
        <Button key="reject" variant="destructive" onClick={() => handleAction("reject", "CSU", "Rejected")}>
          <XCircle className="h-4 w-4 mr-2" />
          Reject
        </Button>
      )
      
      if (submission.isFirstParty) {
        actions.push(
          <Button key="forward-bd" variant="default" onClick={() => handleAction("forward", "Business Development", "Forwarded to Business Development")}>
            <Forward className="h-4 w-4 mr-2" />
            To Business Dev
          </Button>
        )
      } else {
        actions.push(
          <Button key="forward-monitoring" variant="default" onClick={() => handleAction("forward", "Monitoring and Enforcement", "Site Visit Required")}>
            <Forward className="h-4 w-4 mr-2" />
            To Monitoring
          </Button>,
          <Button key="forward-planning" variant="default" onClick={() => handleAction("forward", "Planning and Development", "Site Visit Required")}>
            <Forward className="h-4 w-4 mr-2" />
            To Planning
          </Button>
        )
      }
    } else if (submission.status === "Site Visit Completed") {
      actions.push(
        <Button key="reject" variant="destructive" onClick={() => handleAction("reject", "CSU", "Rejected")}>
          <XCircle className="h-4 w-4 mr-2" />
          Reject
        </Button>,
        <Button key="approve" variant="default" onClick={() => handleAction("approve")}>
          <CheckCircle className="h-4 w-4 mr-2" />
          Approve Site Visit
        </Button>
      )
    } else if (submission.status === "Documents Submitted") {
      actions.push(
        <Button key="reject" variant="destructive" onClick={() => handleAction("reject", "CSU", "Rejected")}>
          <XCircle className="h-4 w-4 mr-2" />
          Reject
        </Button>,
        <Button key="approve" variant="default" onClick={() => handleAction("approve")}>
          <CheckCircle className="h-4 w-4 mr-2" />
          Approve Documents
        </Button>
      )
    } else if (submission.status === "Payment Verified") {
      actions.push(
        <Button key="reject" variant="destructive" onClick={() => handleAction("reject", "CSU", "Rejected")}>
          <XCircle className="h-4 w-4 mr-2" />
          Reject
        </Button>,
        <Button key="approve" variant="default" onClick={() => handleAction("approve")}>
          <CheckCircle className="h-4 w-4 mr-2" />
          Final Approval
        </Button>
      )
    }
    
    return actions
  }

  const filteredSubmissions = submissions.filter(submission =>
    submission.applicantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    submission.submissionId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    submission.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Director's Dashboard</CardTitle>
          <CardDescription>Review and manage all submissions</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex flex-col gap-4 mb-6">
              <div className="flex justify-between items-center">
                <TabsList>
                  <TabsTrigger value="pending">Pending Review</TabsTrigger>
                  <TabsTrigger value="site-visit">Site Visit Reports</TabsTrigger>
                  <TabsTrigger value="approved">Approved</TabsTrigger>
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
                    <Input
                      placeholder="Search submissions..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-blue-600">
                      {submissions.filter(s => s.status === "Forwarded to Director").length}
                    </div>
                    <p className="text-sm text-muted-foreground">Pending Review</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-orange-600">
                      {submissions.filter(s => s.status === "Site Visit Completed").length}
                    </div>
                    <p className="text-sm text-muted-foreground">Site Visit Reports</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-green-600">
                      {submissions.filter(s => s.status === "Approved").length}
                    </div>
                    <p className="text-sm text-muted-foreground">Approved</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-purple-600">
                      {submissions.length}
                    </div>
                    <p className="text-sm text-muted-foreground">Total</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            <TabsContent value="pending" className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Submission ID</TableHead>
                    <TableHead>Applicant</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Application Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubmissions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                        No pending submissions found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSubmissions.map((submission) => (
                      <TableRow key={submission.id}>
                        <TableCell className="font-mono text-sm">
                          {submission.submissionId}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{submission.applicantName}</div>
                          {submission.companyName && (
                            <div className="text-sm text-muted-foreground">{submission.companyName}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={submission.isFirstParty ? "default" : "secondary"}>
                            {submission.isFirstParty ? "First Party" : "Third Party"}
                          </Badge>
                        </TableCell>
                        <TableCell>{submission.applicationType}</TableCell>
                        <TableCell>
                          <Badge variant={
                            submission.status === "Pending" ? "outline" :
                            submission.status === "Forwarded to Director" ? "default" :
                            submission.status === "Documents Submitted" ? "secondary" :
                            "destructive"
                          }>
                            {submission.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {submission.createdAt?.toDate ? 
                            new Date(submission.createdAt.toDate()).toLocaleDateString() : 
                            'N/A'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => handleView(submission)}>
                            <Eye className="h-4 w-4 mr-1" />
                            Review
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="site-visit" className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Submission ID</TableHead>
                    <TableHead>Applicant/Company</TableHead>
                    <TableHead>Reporting Officer</TableHead>
                    <TableHead>Site Visit Date</TableHead>
                    <TableHead>Recommendation</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubmissions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                        No site visit reports found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSubmissions.map((submission) => (
                      <TableRow key={submission.id}>
                        <TableCell className="font-mono text-sm">
                          {submission.submissionId}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{submission.applicantName}</div>
                          {submission.companyName && (
                            <div className="text-sm text-muted-foreground">{submission.companyName}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          {submission.siteVisitReport?.reportingOfficer || 
                           submission.businessDevelopmentReport?.reportingOfficer || 
                           "N/A"}
                        </TableCell>
                        <TableCell>
                          {submission.createdAt?.toDate ? 
                            new Date(submission.createdAt.toDate()).toLocaleDateString() : 
                            'N/A'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            submission.siteVisitReport?.approvableComments?.toLowerCase().includes("approve") ||
                            submission.businessDevelopmentReport?.comments?.toLowerCase().includes("approve") 
                              ? "default" 
                              : "destructive"
                          }>
                            {submission.siteVisitReport?.approvableComments || 
                             submission.businessDevelopmentReport?.comments || 
                             "Pending"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => handleView(submission)}>
                            <Eye className="h-4 w-4 mr-1" />
                            Review Report
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="approved" className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Submission ID</TableHead>
                    <TableHead>Applicant/Company</TableHead>
                    <TableHead>Application Type</TableHead>
                    <TableHead>Approval Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubmissions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                        No approved submissions found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSubmissions.map((submission) => (
                      <TableRow key={submission.id}>
                        <TableCell className="font-mono text-sm">
                          {submission.submissionId}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{submission.applicantName}</div>
                          {submission.companyName && (
                            <div className="text-sm text-muted-foreground">{submission.companyName}</div>
                          )}
                        </TableCell>
                        <TableCell>{submission.applicationType}</TableCell>
                        <TableCell>
                          {submission.createdAt?.toDate ? 
                            new Date(submission.createdAt.toDate()).toLocaleDateString() : 
                            'N/A'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={submission.isFirstParty ? "default" : "secondary"}>
                            {submission.isFirstParty ? "First Party" : "Third Party"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Approved
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Submission Review</DialogTitle>
            <DialogDescription>
              Review submission details and take appropriate action
            </DialogDescription>
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

                <TabsContent value="details" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Applicant Information</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Name</p>
                        <p>{selectedSubmission.applicantName}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Email</p>
                        <p>{selectedSubmission.email}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Submission ID</p>
                        <p className="font-mono">{selectedSubmission.submissionId}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Application Type</p>
                        <p>{selectedSubmission.applicationType}</p>
                      </div>
                      {selectedSubmission.companyName && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Company</p>
                          <p>{selectedSubmission.companyName}</p>
                        </div>
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

                <TabsContent value="report" className="space-y-4">
                  {selectedSubmission.siteVisitReport ? (
                    <Card>
                      <CardHeader>
                        <CardTitle>Site Visit Report</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Client Name</p>
                            <p>{selectedSubmission.siteVisitReport.clientName}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Registration</p>
                            <p>{selectedSubmission.siteVisitReport.registrationWithDOAS}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Board Location</p>
                            <p>{selectedSubmission.siteVisitReport.boardLocation}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">GPS Coordinates</p>
                            <p>{selectedSubmission.siteVisitReport.gpsCoordinates}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Human Obstruction</p>
                            <Badge variant={selectedSubmission.siteVisitReport.humanObstruction === "Yes" ? "destructive" : "default"}>
                              {selectedSubmission.siteVisitReport.humanObstruction}
                            </Badge>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Vacant</p>
                            <Badge variant={selectedSubmission.siteVisitReport.vacant === "Yes" ? "default" : "secondary"}>
                              {selectedSubmission.siteVisitReport.vacant}
                            </Badge>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Approvable Comments</p>
                          <p className="p-2 bg-muted rounded">{selectedSubmission.siteVisitReport.approvableComments}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Reporting Officer</p>
                          <p>{selectedSubmission.siteVisitReport.reportingOfficer} ({selectedSubmission.siteVisitReport.reportingOfficerRank})</p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : selectedSubmission.businessDevelopmentReport ? (
                    <Card>
                      <CardHeader>
                        <CardTitle>Business Development Report</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Company Name</p>
                            <p>{selectedSubmission.businessDevelopmentReport.companyName}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Signage Dimensions</p>
                            <p>{selectedSubmission.businessDevelopmentReport.length}m x {selectedSubmission.businessDevelopmentReport.width}m</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Location</p>
                            <p>{selectedSubmission.businessDevelopmentReport.location}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">GPS Coordinates</p>
                            <p>{selectedSubmission.businessDevelopmentReport.gpsCoordinates}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Comments/Recommendations</p>
                          <p className="p-2 bg-muted rounded">{selectedSubmission.businessDevelopmentReport.comments}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="py-8">
                        <p className="text-center text-muted-foreground">No site visit report available</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="billing" className="space-y-4">
                  {selectedSubmission.billing ? (
                    <Card>
                      <CardHeader>
                        <CardTitle>Billing Information</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Invoice Number</p>
                            <p className="font-mono">{selectedSubmission.billing.invoiceNumber}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Due Date</p>
                            <p>{new Date(selectedSubmission.billing.dueDate).toLocaleDateString()}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Application Fee</p>
                            <p className="font-bold">₦{selectedSubmission.billing.applicationFee?.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Processing Fee</p>
                            <p className="font-bold">₦{selectedSubmission.billing.processingFee?.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Annual Fee</p>
                            <p className="font-bold">₦{selectedSubmission.billing.annualFee?.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Total Amount</p>
                            <p className="font-bold text-lg">₦{selectedSubmission.billing.totalAmount?.toLocaleString()}</p>
                          </div>
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
                    <Card>
                      <CardContent className="py-8">
                        <p className="text-center text-muted-foreground">No billing information available</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="history" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Submission History</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {selectedSubmission.comments && selectedSubmission.comments.length > 0 ? (
                        <div className="space-y-4">
                          {selectedSubmission.comments.map((comment, index) => (
                            <div key={index} className="border-l-2 border-muted pl-4">
                              <p className="font-medium">{comment.action}</p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(comment.timestamp).toLocaleString()}
                              </p>
                              <p className="mt-1">{comment.text}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">No history available</p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </ScrollArea>
          )}

          <div className="mt-4">
            <Label htmlFor="comment" className="mb-2 block">Comments</Label>
            <Textarea
              id="comment"
              placeholder="Add your comments here..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="mb-4"
              rows={3}
            />
          </div>

          <DialogFooter className="flex justify-between">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <div className="flex gap-2">
              {selectedSubmission && getAvailableActions(selectedSubmission)}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}