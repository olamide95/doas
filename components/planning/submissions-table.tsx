// app/admin/planning-development/page.tsx
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
import { Search, MapPin, Eye, CheckCircle, XCircle, FileText } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"

interface Submission {
  id: string
  submissionId: string
  applicantName: string
  companyName?: string
  applicationType: string
  gpsCoordinates: string
  status: string
  department: string
  createdAt: any
  documents?: any
  comments?: Array<{
    text: string
    timestamp: string
    action: string
  }>
}

export default function SubmissionsTable() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null)
  const [comment, setComment] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("site-visit")
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    fetchSubmissions()
  }, [activeTab])

  const fetchSubmissions = async () => {
    let q
    
    if (activeTab === "site-visit") {
      q = query(
        collection(db, "thirdPartySubmissions"),
        where("department", "==", "Planning and Development"),
        where("status", "in", ["Site Visit Required", "Under Review"]),
        orderBy("createdAt", "desc")
      )
    } else if (activeTab === "documents") {
      q = query(
        collection(db, "thirdPartySubmissions"),
        where("department", "==", "Planning and Development"),
        where("status", "==", "Documents Review"),
        orderBy("createdAt", "desc")
      )
    } else if (activeTab === "zoning") {
      q = query(
        collection(db, "thirdPartySubmissions"),
        where("department", "==", "Planning and Development"),
        where("status", "in", ["Zoning Review", "Zoning Approved"]),
        orderBy("createdAt", "desc")
      )
    } else if (activeTab === "completed") {
      q = query(
        collection(db, "thirdPartySubmissions"),
        where("department", "==", "Planning and Development"),
        where("status", "in", ["Site Visit Completed", "Documents Approved", "Forwarded to Director"]),
        orderBy("createdAt", "desc")
      )
    }

    if (q) {
      const snapshot = await getDocs(q)
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Submission))
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

  const handleAction = async (action: string, nextStatus: string, nextDepartment: string = "Director") => {
    if (!selectedSubmission) return

    try {
      const submissionRef = doc(db, "thirdPartySubmissions", selectedSubmission.id)
      const now = new Date().toISOString()
      const actionText = action === "complete" ? "Site visit completed" : 
                         action === "approve" ? "Documents approved" :
                         action === "zoning-approve" ? "Zoning approved" :
                         "Forwarded to Director"

      await updateDoc(submissionRef, {
        status: nextStatus,
        department: nextDepartment,
        comments: arrayUnion({
          text: comment,
          timestamp: now,
          action: actionText,
        }),
        updatedAt: now,
      })

      // Log activity
      await addDoc(collection(db, "activityLogs"), {
        submissionId: selectedSubmission.id,
        action: actionText,
        timestamp: now,
        comment: comment,
        userId: "planning_development",
      })

      // Create notification
      await addDoc(collection(db, "notifications"), {
        userId: nextDepartment.toLowerCase().replace(/ /g, "_"),
        content: `${actionText} for ${selectedSubmission.applicantName}`,
        type: "info",
        referenceId: selectedSubmission.id,
        isRead: false,
        createdAt: now,
      })

      fetchSubmissions()
      handleClose()
    } catch (err) {
      console.error("Error processing submission:", err)
    }
  }

  const filteredSubmissions = submissions.filter(submission =>
    submission.applicantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    submission.submissionId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    submission.companyName?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Planning & Development Dashboard</CardTitle>
          <CardDescription>Manage zoning reviews, site visits, and document approvals</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex justify-between items-center mb-6">
              <TabsList>
                <TabsTrigger value="site-visit">Site Visits</TabsTrigger>
                <TabsTrigger value="zoning">Zoning Reviews</TabsTrigger>
                <TabsTrigger value="documents">Document Review</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
              </TabsList>
              
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

            <TabsContent value="site-visit" className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <MapPin className="h-5 w-5 text-blue-500" />
                    <p className="text-sm text-muted-foreground">
                      Review site locations for zoning compliance and conduct site visits.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Submission ID</TableHead>
                    <TableHead>Applicant/Company</TableHead>
                    <TableHead>Application Type</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Zoning Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubmissions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                        No pending site visits found
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
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{submission.gpsCoordinates}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">Pending Review</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleView(submission)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View Details
                            </Button>
                            <Button 
                              variant="default" 
                              size="sm"
                              onClick={() => window.open('/dashboard/site-visit', '_blank')}
                            >
                              Conduct Site Visit
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="zoning" className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Submission ID</TableHead>
                    <TableHead>Applicant/Company</TableHead>
                    <TableHead>Application Type</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Zoning Compliance</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubmissions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                        No zoning reviews pending
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
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{submission.gpsCoordinates}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">Needs Review</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => handleView(submission)}>
                            <Eye className="h-4 w-4 mr-1" />
                            Review Zoning
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="documents" className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Submission ID</TableHead>
                    <TableHead>Applicant/Company</TableHead>
                    <TableHead>Application Type</TableHead>
                    <TableHead>Documents</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubmissions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                        No documents to review
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
                          {submission.documents ? (
                            <Badge variant="default">
                              <FileText className="h-3 w-3 mr-1" />
                              Documents Uploaded
                            </Badge>
                          ) : (
                            <Badge variant="outline">No Documents</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{submission.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => handleView(submission)}>
                            <Eye className="h-4 w-4 mr-1" />
                            Review Documents
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="completed" className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Submission ID</TableHead>
                    <TableHead>Applicant/Company</TableHead>
                    <TableHead>Application Type</TableHead>
                    <TableHead>Action Taken</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubmissions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                        No completed tasks found
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
                          {submission.status === "Site Visit Completed" ? "Site Visit" :
                           submission.status === "Documents Approved" ? "Document Review" :
                           submission.status === "Zoning Approved" ? "Zoning Approval" :
                           "Completed"}
                        </TableCell>
                        <TableCell>
                          {submission.createdAt?.toDate ? 
                            new Date(submission.createdAt.toDate()).toLocaleDateString() : 
                            'N/A'}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            {submission.status}
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
            <DialogTitle>Planning & Development Review</DialogTitle>
            <DialogDescription>
              Review submission for zoning compliance, site suitability, and document verification
            </DialogDescription>
          </DialogHeader>

          {selectedSubmission && (
            <ScrollArea className="flex-1 pr-4">
              <Tabs defaultValue="details" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="zoning">Zoning Info</TabsTrigger>
                  {selectedSubmission.documents && (
                    <TabsTrigger value="documents">Documents</TabsTrigger>
                  )}
                  <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Application Details</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Applicant Name</p>
                        <p>{selectedSubmission.applicantName}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Submission ID</p>
                        <p className="font-mono">{selectedSubmission.submissionId}</p>
                      </div>
                      {selectedSubmission.companyName && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Company</p>
                          <p>{selectedSubmission.companyName}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Application Type</p>
                        <p>{selectedSubmission.applicationType}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">GPS Coordinates</p>
                        <p>{selectedSubmission.gpsCoordinates}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Status</p>
                        <Badge variant="outline">{selectedSubmission.status}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="zoning" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Zoning Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Zone Type</Label>
                            <Select>
                              <SelectTrigger>
                                <SelectValue placeholder="Select zone type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="commercial">Commercial</SelectItem>
                                <SelectItem value="residential">Residential</SelectItem>
                                <SelectItem value="industrial">Industrial</SelectItem>
                                <SelectItem value="mixed-use">Mixed Use</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Height Restriction (meters)</Label>
                            <Input type="number" placeholder="e.g., 10" />
                          </div>
                          <div>
                            <Label>Setback Requirements</Label>
                            <Input placeholder="e.g., 5m from road" />
                          </div>
                          <div>
                            <Label>Signage Area Limit</Label>
                            <Input placeholder="e.g., 24m²" />
                          </div>
                        </div>
                        <div>
                          <Label>Zoning Comments</Label>
                          <Textarea placeholder="Enter zoning compliance comments..." />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="documents" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Uploaded Documents</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {selectedSubmission.documents ? (
                        <div className="space-y-4">
                          {Object.entries(selectedSubmission.documents).map(([key, value]) => (
                            value && (
                              <div key={key} className="flex items-center justify-between p-2 border rounded">
                                <span className="capitalize">
                                  {key.replace(/([A-Z])/g, ' $1').trim()}
                                </span>
                                <Button size="sm" variant="outline">
                                  <a 
                                    href={value as string} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex items-center"
                                  >
                                    View Document
                                  </a>
                                </Button>
                              </div>
                            )
                          ))}
                        </div>
                      ) : (
                        <p className="text-center text-muted-foreground py-8">
                          No documents uploaded yet
                        </p>
                      )}
                    </CardContent>
                  </Card>
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
              placeholder="Add your review comments here..."
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
              {selectedSubmission && (
                <>
                  <Button 
                    variant="destructive" 
                    onClick={() => handleAction("reject", "Rejected", "CSU")}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                  {activeTab === "zoning" && (
                    <Button 
                      variant="default" 
                      onClick={() => handleAction("zoning-approve", "Zoning Approved", "Director")}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve Zoning
                    </Button>
                  )}
                  {activeTab === "documents" && (
                    <Button 
                      variant="default" 
                      onClick={() => handleAction("approve", "Documents Approved", "Director")}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve Documents
                    </Button>
                  )}
                </>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}