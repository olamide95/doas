"use client"

import { Input } from "@/components/ui/input"
import { useState, useEffect } from "react"
import { format } from "date-fns"
import { Calendar, Clock, AlertCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { collection, query, where, orderBy, getDocs, doc, updateDoc, addDoc, arrayUnion } from "firebase/firestore"
import { db } from "@/lib/firebase"

type MeetingRequest = {
  id: string
  fullName: string
  email: string
  phoneNumber: string
  organization: string | null
  purpose: string
  preferredDate: string
  preferredTime: string
  urgency: string
  supportingDocumentUrl: string | null
  status: string
  department: string
  createdAt: Date
  scheduledDate: string | null
  comments: any[]
  updatedAt: Date
  assignedTo: string
  forwardedBy: string
}

export function DirectorMeetingRequestsPanel() {
  const [meetingRequests, setMeetingRequests] = useState<MeetingRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedRequest, setSelectedRequest] = useState<MeetingRequest | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [comment, setComment] = useState("")
  const [newStatus, setNewStatus] = useState("")
  const [scheduledDate, setScheduledDate] = useState("")
  const [scheduledTime, setScheduledTime] = useState("")

  useEffect(() => {
    fetchMeetingRequests()
  }, [])

  const fetchMeetingRequests = async () => {
    try {
      setIsLoading(true)
      // Get meeting requests that are assigned to Director or have status "forwarded"
      const q = query(
        collection(db, "meetingRequests"),
        where("assignedTo", "==", "director"),
        orderBy("createdAt", "desc")
      )
      
      const querySnapshot = await getDocs(q)
      const requests: MeetingRequest[] = []
      
      querySnapshot.forEach((doc) => {
        const data = doc.data()
        requests.push({
          id: doc.id,
          fullName: data.fullName,
          email: data.email,
          phoneNumber: data.phoneNumber,
          organization: data.organization || null,
          purpose: data.purpose,
          preferredDate: data.preferredDate,
          preferredTime: data.preferredTime,
          urgency: data.urgency,
          supportingDocumentUrl: data.supportingDocumentUrl || null,
          status: data.status,
          department: data.department,
          createdAt: data.createdAt?.toDate() || new Date(),
          scheduledDate: data.scheduledDate || null,
          comments: data.comments || [],
          updatedAt: data.updatedAt?.toDate() || new Date(),
          assignedTo: data.assignedTo,
          forwardedBy: data.forwardedBy || "CSU"
        })
      })

      setMeetingRequests(requests)
    } catch (error) {
      console.error("Error fetching meeting requests:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleViewRequest = (request: MeetingRequest) => {
    setSelectedRequest(request)
    setNewStatus(request.status)
    setComment("")
    if (request.scheduledDate) {
      const date = new Date(request.scheduledDate)
      setScheduledDate(format(date, "yyyy-MM-dd"))
      setScheduledTime(format(date, "HH:mm"))
    } else {
      setScheduledDate("")
      setScheduledTime("")
    }
    setShowDialog(true)
  }

  const handleUpdateRequest = async () => {
    if (!selectedRequest) return

    try {
      const requestRef = doc(db, "meetingRequests", selectedRequest.id)
      const updates: any = {
        status: newStatus,
        updatedAt: new Date(),
      }

      // If scheduling, set the scheduled date
      if (newStatus === "Scheduled" && scheduledDate && scheduledTime) {
        updates.scheduledDate = `${scheduledDate}T${scheduledTime}:00`
      }

      // Add comment if provided
      if (comment.trim()) {
        const newComment = {
          text: comment,
          timestamp: new Date().toISOString(),
          action: `Director: Status updated to ${newStatus}`,
          user: "Director",
        }

        updates.comments = arrayUnion(newComment)
      }

      // If approving or rejecting, remove assignment to director
      if (newStatus === "Approved" || newStatus === "Rejected" || newStatus === "Scheduled") {
        updates.assignedTo = null
      }

      await updateDoc(requestRef, updates)

      // Create notification for the CSU staff who forwarded the request
      await addDoc(collection(db, "notifications"), {
        userId: selectedRequest.forwardedBy, // Notify the CSU staff who forwarded it
        content: `Director has ${newStatus.toLowerCase()} your forwarded meeting request from ${selectedRequest.fullName}`,
        type: newStatus === "Approved" || newStatus === "Scheduled" ? "success" : "error",
        referenceId: selectedRequest.id,
        isRead: false,
        createdAt: new Date(),
      })

      // Also notify the original requester if approved/scheduled
      if (newStatus === "Approved" || newStatus === "Scheduled") {
        await addDoc(collection(db, "notifications"), {
          userId: "requester", // This should be the actual requester's ID
          content: `Your meeting request has been ${newStatus.toLowerCase()} by the Director`,
          type: "success",
          referenceId: selectedRequest.id,
          isRead: false,
          createdAt: new Date(),
        })
      }

      // Refresh the data
      fetchMeetingRequests()
      setShowDialog(false)
    } catch (error) {
      console.error("Error updating meeting request:", error)
    }
  }

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency.toLowerCase()) {
      case "high":
        return <Badge variant="destructive">High</Badge>
      case "medium":
        return <Badge variant="default">Medium</Badge>
      case "low":
        return <Badge variant="secondary">Low</Badge>
      default:
        return <Badge variant="outline">{urgency}</Badge>
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">
            Pending
          </Badge>
        )
      case "forwarded":
        return (
          <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
            Forwarded to Director
          </Badge>
        )
      case "scheduled":
        return (
          <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
            Scheduled
          </Badge>
        )
      case "approved":
        return (
          <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
            Approved
          </Badge>
        )
      case "rejected":
        return (
          <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
            Rejected
          </Badge>
        )
      case "completed":
        return (
          <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-200">
            Completed
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Meeting Requests - Director's Approval</CardTitle>
        <CardDescription>Review and approve meeting requests forwarded from CSU</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">Loading meeting requests...</div>
        ) : meetingRequests.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No meeting requests pending your approval</div>
        ) : (
          <div className="space-y-4">
            {meetingRequests.map((request) => (
              <div
                key={request.id}
                className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
                onClick={() => handleViewRequest(request)}
              >
                <div className="space-y-1 mb-2 md:mb-0">
                  <h4 className="font-medium">{request.fullName}</h4>
                  <div className="text-sm text-muted-foreground">{request.email}</div>
                  <div className="text-xs text-blue-600">Forwarded by: {request.forwardedBy}</div>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4 mr-1" />
                    {format(new Date(request.preferredDate), "MMM d, yyyy")}
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Clock className="h-4 w-4 mr-1" />
                    {request.preferredTime}
                  </div>
                  <div className="flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {getUrgencyBadge(request.urgency)}
                  </div>
                  <div>{getStatusBadge(request.status)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Meeting Request Detail Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Approve Meeting Request</DialogTitle>
            <DialogDescription>
              Review the meeting request forwarded from CSU and make a decision
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="grid gap-4 py-4">
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Forwarded by:</strong> {selectedRequest.forwardedBy}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-1">Full Name</h4>
                  <p>{selectedRequest.fullName}</p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Email</h4>
                  <p>{selectedRequest.email}</p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Phone Number</h4>
                  <p>{selectedRequest.phoneNumber}</p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Organization</h4>
                  <p>{selectedRequest.organization || "N/A"}</p>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-1">Purpose of Meeting</h4>
                <p className="whitespace-pre-wrap">{selectedRequest.purpose}</p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <h4 className="font-medium mb-1">Preferred Date</h4>
                  <p>{format(new Date(selectedRequest.preferredDate), "MMMM d, yyyy")}</p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Preferred Time</h4>
                  <p>{selectedRequest.preferredTime}</p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Urgency</h4>
                  <p>{getUrgencyBadge(selectedRequest.urgency)}</p>
                </div>
              </div>

              {selectedRequest.supportingDocumentUrl && (
                <div>
                  <h4 className="font-medium mb-1">Supporting Document</h4>
                  <Button variant="outline" size="sm" asChild>
                    <a href={selectedRequest.supportingDocumentUrl} target="_blank" rel="noopener noreferrer">
                      View Document
                    </a>
                  </Button>
                </div>
              )}

              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Director's Decision</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select decision" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Approved">Approve Request</SelectItem>
                      <SelectItem value="Scheduled">Schedule Meeting</SelectItem>
                      <SelectItem value="Rejected">Reject Request</SelectItem>
                      <SelectItem value="Request Changes">Request Changes</SelectItem>
                    </SelectContent>
                  </Select>

                  {newStatus === "Scheduled" && (
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        min={new Date().toISOString().split("T")[0]}
                      />
                      <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Director's Comments</h4>
                <Textarea
                  placeholder="Add your comments or instructions..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </div>

              {selectedRequest.comments && selectedRequest.comments.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Request History</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {selectedRequest.comments.map((comment, index) => (
                      <div key={index} className="border-l-2 border-muted pl-4 py-1">
                        <p className="font-medium text-sm">{comment.action}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(comment.timestamp), "MMM d, yyyy h:mm a")}
                        </p>
                        <p className="text-sm mt-1">{comment.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateRequest}>
              {newStatus === "Approved" ? "Approve Request" : 
               newStatus === "Scheduled" ? "Schedule Meeting" : 
               newStatus === "Rejected" ? "Reject Request" : 
               "Update Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}