// app/admin/business-development/page.tsx
"use client"

import { useState, useEffect } from "react"
import { collection, getDocs, query, where, updateDoc, doc, arrayUnion, addDoc } from "firebase/firestore"
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Building, MapPin, User } from "lucide-react"

interface Submission {
  id: string
  submissionId: string
  applicantName: string
  contactPhoneNumber: string
  email: string
  applicationType: string
  gpsCoordinates: string
  status: string
  businessDevelopmentReport?: any
}

export default function BusinessDevelopmentDashboard() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null)
  const [comment, setComment] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState("pending")

  const [siteVisitData, setSiteVisitData] = useState({
    companyName: "",
    typeOfConcept: "",
    numberOfProposedSignage: "",
    length: "",
    width: "",
    area: "",
    location: "",
    gpsCoordinates: "",
    boardToBoardDistance: "",
    roadKerbDistance: "",
    humanObstruction: "No",
    vehicleObstruction: "No",
    visibilityObstruction: "No",
    vacant: "No",
    comments: "",
    reportingOfficer: "",
    reportingOfficerRank: "",
    headOfSection: "",
    headOfSectionRank: "",
    commend: "",
  })

  useEffect(() => {
    fetchSubmissions()
  }, [activeTab])

  const fetchSubmissions = async () => {
    const q = query(
      collection(db, "firstPartySubmissions"),
      where("department", "==", "Business Development"),
      where("status", "==", activeTab === "pending" ? "Forwarded to Business Development" : "Site Visit Completed")
    )
    
    const snapshot = await getDocs(q)
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Submission))
    setSubmissions(data)
  }

  const handleView = (submission: Submission) => {
    setSelectedSubmission(submission)
    setSiteVisitData(prev => ({
      ...prev,
      companyName: submission.applicantName,
      typeOfConcept: submission.applicationType,
      gpsCoordinates: submission.gpsCoordinates,
      location: `Location for ${submission.applicantName}`
    }))
    setIsDialogOpen(true)
  }

  const handleClose = () => {
    setSelectedSubmission(null)
    setComment("")
    setIsDialogOpen(false)
    setSiteVisitData({
      companyName: "",
      typeOfConcept: "",
      numberOfProposedSignage: "",
      length: "",
      width: "",
      area: "",
      location: "",
      gpsCoordinates: "",
      boardToBoardDistance: "",
      roadKerbDistance: "",
      humanObstruction: "No",
      vehicleObstruction: "No",
      visibilityObstruction: "No",
      vacant: "No",
      comments: "",
      reportingOfficer: "",
      reportingOfficerRank: "",
      headOfSection: "",
      headOfSectionRank: "",
      commend: "",
    })
  }

  const handleSubmitSiteVisit = async () => {
    if (!selectedSubmission) return

    try {
      const submissionRef = doc(db, "firstPartySubmissions", selectedSubmission.id)
      const now = new Date().toISOString()

      await updateDoc(submissionRef, {
        status: "Site Visit Completed",
        department: "Finance",
        businessDevelopmentReport: siteVisitData,
        comments: arrayUnion({
          text: comment || siteVisitData.comments,
          timestamp: now,
          action: "Site visit completed by Business Development",
        }),
        updatedAt: now,
      })

      // Log activity
      await addDoc(collection(db, "activityLogs"), {
        submissionId: selectedSubmission.id,
        action: "Business Development site visit completed",
        timestamp: now,
        comment: comment,
        userId: "business_development",
      })

      // Create notification for Finance
      await addDoc(collection(db, "notifications"), {
        userId: "finance",
        content: `Site visit completed for ${selectedSubmission.applicantName}`,
        type: "info",
        referenceId: selectedSubmission.id,
        isRead: false,
        createdAt: now,
      })

      fetchSubmissions()
      handleClose()
    } catch (err) {
      console.error("Error submitting site visit:", err)
    }
  }

  const filteredSubmissions = submissions.filter(submission =>
    submission.applicantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    submission.submissionId.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Business Development Dashboard</CardTitle>
          <CardDescription>Manage first-party submissions and conduct site visits</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-6">
            <div className="flex gap-4">
              <Button
                variant={activeTab === "pending" ? "default" : "outline"}
                onClick={() => setActiveTab("pending")}
              >
                Pending Site Visits
              </Button>
              <Button
                variant={activeTab === "completed" ? "default" : "outline"}
                onClick={() => setActiveTab("completed")}
              >
                Completed Visits
              </Button>
            </div>
            
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

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Submission ID</TableHead>
                <TableHead>Applicant Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Application Type</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSubmissions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                    No submissions found
                  </TableCell>
                </TableRow>
              ) : (
                filteredSubmissions.map((submission) => (
                  <TableRow key={submission.id}>
                    <TableCell className="font-mono text-sm">
                      {submission.submissionId}
                    </TableCell>
                    <TableCell className="font-medium">{submission.applicantName}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{submission.contactPhoneNumber}</p>
                        <p className="text-muted-foreground">{submission.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>{submission.applicationType}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{submission.gpsCoordinates}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={submission.status === "Site Visit Completed" ? "default" : "outline"}>
                        {submission.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleView(submission)}>
                        {activeTab === "pending" ? "Conduct Site Visit" : "View Report"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Business Development Site Visit Report</DialogTitle>
            <DialogDescription>
              Complete site visit report for {selectedSubmission?.applicantName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Name of Company/Organization</Label>
                <Input
                  id="companyName"
                  value={siteVisitData.companyName}
                  onChange={(e) => setSiteVisitData(prev => ({ ...prev, companyName: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="typeOfConcept">Type of Concept (Signage)</Label>
                <Input
                  id="typeOfConcept"
                  value={siteVisitData.typeOfConcept}
                  onChange={(e) => setSiteVisitData(prev => ({ ...prev, typeOfConcept: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="numberOfProposedSignage">Number of proposed Signage</Label>
                <Input
                  id="numberOfProposedSignage"
                  value={siteVisitData.numberOfProposedSignage}
                  onChange={(e) => setSiteVisitData(prev => ({ ...prev, numberOfProposedSignage: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="length">Length (Metric)</Label>
                <Input
                  id="length"
                  value={siteVisitData.length}
                  onChange={(e) => setSiteVisitData(prev => ({ ...prev, length: e.target.value }))}
                  placeholder="e.g., 4m"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="width">Width (Metric)</Label>
                <Input
                  id="width"
                  value={siteVisitData.width}
                  onChange={(e) => setSiteVisitData(prev => ({ ...prev, width: e.target.value }))}
                  placeholder="e.g., 6m"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="area">Area (Square Meters)</Label>
                <Input
                  id="area"
                  value={siteVisitData.area}
                  onChange={(e) => setSiteVisitData(prev => ({ ...prev, area: e.target.value }))}
                  placeholder="e.g., 24m²"
                />
              </div>

              <div className="space-y-2 col-span-2">
                <Label htmlFor="location">Location of the Signage</Label>
                <Input
                  id="location"
                  value={siteVisitData.location}
                  onChange={(e) => setSiteVisitData(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="Full description of Street and district"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gpsCoordinates">GPS Coordinates</Label>
                <Input
                  id="gpsCoordinates"
                  value={siteVisitData.gpsCoordinates}
                  onChange={(e) => setSiteVisitData(prev => ({ ...prev, gpsCoordinates: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="boardToBoardDistance">Board to Board Distance</Label>
                <Input
                  id="boardToBoardDistance"
                  value={siteVisitData.boardToBoardDistance}
                  onChange={(e) => setSiteVisitData(prev => ({ ...prev, boardToBoardDistance: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="roadKerbDistance">Road Kerb Distance</Label>
                <Input
                  id="roadKerbDistance"
                  value={siteVisitData.roadKerbDistance}
                  onChange={(e) => setSiteVisitData(prev => ({ ...prev, roadKerbDistance: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="humanObstruction">Human Obstruction</Label>
                <Select
                  value={siteVisitData.humanObstruction}
                  onValueChange={(value) => setSiteVisitData(prev => ({ ...prev, humanObstruction: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Yes">Yes</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vehicleObstruction">Vehicle Obstruction</Label>
                <Select
                  value={siteVisitData.vehicleObstruction}
                  onValueChange={(value) => setSiteVisitData(prev => ({ ...prev, vehicleObstruction: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Yes">Yes</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="visibilityObstruction">Visibility Obstruction</Label>
                <Select
                  value={siteVisitData.visibilityObstruction}
                  onValueChange={(value) => setSiteVisitData(prev => ({ ...prev, visibilityObstruction: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Yes">Yes</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vacant">Vacant or Availability</Label>
                <Select
                  value={siteVisitData.vacant}
                  onValueChange={(value) => setSiteVisitData(prev => ({ ...prev, vacant: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Yes">Yes</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 col-span-2">
                <Label htmlFor="comments">Comment/Recommendations</Label>
                <Textarea
                  id="comments"
                  value={siteVisitData.comments}
                  onChange={(e) => setSiteVisitData(prev => ({ ...prev, comments: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reportingOfficer">Name of Reporting Officer</Label>
                <Input
                  id="reportingOfficer"
                  value={siteVisitData.reportingOfficer}
                  onChange={(e) => setSiteVisitData(prev => ({ ...prev, reportingOfficer: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reportingOfficerRank">Rank of Reporting Officer</Label>
                <Input
                  id="reportingOfficerRank"
                  value={siteVisitData.reportingOfficerRank}
                  onChange={(e) => setSiteVisitData(prev => ({ ...prev, reportingOfficerRank: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="headOfSection">Head of Section/Team Leader</Label>
                <Input
                  id="headOfSection"
                  value={siteVisitData.headOfSection}
                  onChange={(e) => setSiteVisitData(prev => ({ ...prev, headOfSection: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="headOfSectionRank">Rank of Head of Section</Label>
                <Input
                  id="headOfSectionRank"
                  value={siteVisitData.headOfSectionRank}
                  onChange={(e) => setSiteVisitData(prev => ({ ...prev, headOfSectionRank: e.target.value }))}
                />
              </div>

              <div className="space-y-2 col-span-2">
                <Label htmlFor="commend">Commend</Label>
                <Textarea
                  id="commend"
                  value={siteVisitData.commend}
                  onChange={(e) => setSiteVisitData(prev => ({ ...prev, commend: e.target.value }))}
                />
              </div>

              <div className="space-y-2 col-span-2">
                <Label htmlFor="comment">Additional Comments</Label>
                <Textarea
                  id="comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add any additional comments..."
                />
              </div>
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Note:</strong> Please attach picture of site visited with coordinates, date and time.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmitSiteVisit}>
              Submit Site Visit Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}