"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, User, Mail, Phone, Clock, Download, ArrowRight } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/components/ui/use-toast"
import { collection, query, orderBy, onSnapshot, doc, updateDoc, addDoc, where } from "firebase/firestore"
import { getStorage, ref, getDownloadURL } from "firebase/storage"
import { format } from "date-fns"
import { db } from "@/lib/firebase"

const storage = getStorage()

// ── Safe date converter handles Firestore Timestamp, ISO string, JS Date ──
const safeToDate = (value: any): Date => {
  if (!value) return new Date()
  if (typeof value.toDate === "function") return value.toDate()
  if (typeof value === "string" || typeof value === "number") return new Date(value)
  if (value instanceof Date) return value
  return new Date()
}

type MeetingRequest = {
  id: string
  fullName: string
  email: string
  phoneNumber: string
  organization?: string
  purpose: string
  preferredDate: string
  preferredTime: string
  urgency: "low" | "medium" | "high"
  supportingDocumentUrl?: string
  status: "pending" | "approved" | "rejected" | "forwarded" | "scheduled" | "completed"
  department: string
  notes?: string
  createdAt: Date
  updatedAt: Date
  assignedTo?: string
  scheduledDateTime?: Date
}

export default function MeetingRequestsPanel() {
  const { toast } = useToast()
  const [meetingRequests, setMeetingRequests] = useState<MeetingRequest[]>([])
  const [selectedRequest, setSelectedRequest] = useState<MeetingRequest | null>(null)
  const [notes, setNotes] = useState("")
  const [status, setStatus] = useState("pending")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "pending" | "forwarded" | "approved">("all")

  useEffect(() => {
    setLoading(true)
    let q

    if (filter === "all") {
      q = query(collection(db, "meetingRequests"), orderBy("createdAt", "desc"))
    } else {
      q = query(
        collection(db, "meetingRequests"),
        where("status", "==", filter),
        orderBy("createdAt", "desc")
      )
    }

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const requests: MeetingRequest[] = []
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data()
        requests.push({
          id: docSnap.id,
          fullName: data.fullName ?? "",
          email: data.email ?? "",
          phoneNumber: data.phoneNumber ?? "",
          organization: data.organization,
          purpose: data.purpose ?? "",
          preferredDate: data.preferredDate ?? "",
          preferredTime: data.preferredTime ?? "",
          urgency: data.urgency ?? "low",
          supportingDocumentUrl: data.supportingDocumentUrl,
          status: data.status ?? "pending",
          department: data.department ?? "",
          notes: data.notes,
          createdAt: safeToDate(data.createdAt),
          updatedAt: safeToDate(data.updatedAt),
          assignedTo: data.assignedTo,
          scheduledDateTime: data.scheduledDateTime
            ? safeToDate(data.scheduledDateTime)
            : undefined,
        })
      })
      setMeetingRequests(requests)
      setLoading(false)
    }, (error) => {
      console.error("Snapshot error:", error)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [filter])

  const handleViewDetails = (request: MeetingRequest) => {
    setSelectedRequest(request)
    setNotes(request.notes || "")
    setStatus(request.status)
    setIsDialogOpen(true)
  }

  const handleSaveChanges = async () => {
    if (!selectedRequest) return

    try {
      const requestRef = doc(db, "meetingRequests", selectedRequest.id)

      await updateDoc(requestRef, {
        notes,
        status,
        updatedAt: new Date(),
        ...(status === "forwarded" && {
          assignedTo: "director",
          department: "Director",
        }),
      })

      if (status === "forwarded") {
        await addDoc(collection(db, "notifications"), {
          userId: "director",
          content: `New meeting request forwarded from CSU — ${selectedRequest.fullName}: "${selectedRequest.purpose}"`,
          type: "info",
          referenceId: selectedRequest.id,
          isRead: false,
          createdAt: new Date(),
        })
      }

      toast({
        title: status === "forwarded" ? "Forwarded to Director" : "Changes Saved",
        description:
          status === "forwarded"
            ? `Meeting request from ${selectedRequest.fullName} has been forwarded to the Director.`
            : "Meeting request has been updated.",
      })

      setIsDialogOpen(false)
    } catch (error) {
      console.error("Error saving changes:", error)
      toast({
        title: "Error",
        description: "Failed to save changes",
        variant: "destructive",
      })
    }
  }

  const handleDownloadDocument = async (url: string) => {
    try {
      const downloadUrl = await getDownloadURL(ref(storage, url))
      window.open(downloadUrl, "_blank")
    } catch (error) {
      console.error("Error downloading document:", error)
      toast({
        title: "Error",
        description: "Failed to download document",
        variant: "destructive",
      })
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline">Pending Review</Badge>
      case "approved":
        return <Badge className="bg-green-500 text-white">Approved</Badge>
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>
      case "forwarded":
        return <Badge className="bg-blue-500 text-white">Forwarded to Director</Badge>
      case "scheduled":
        return <Badge className="bg-purple-500 text-white">Scheduled</Badge>
      case "completed":
        return <Badge className="bg-gray-500 text-white">Completed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case "high":
        return <Badge variant="destructive">High</Badge>
      case "medium":
        return <Badge className="bg-yellow-500 text-white">Medium</Badge>
      case "low":
        return <Badge className="bg-gray-400 text-white">Low</Badge>
      default:
        return <Badge variant="outline">{urgency}</Badge>
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Meeting Requests</CardTitle>
            <CardDescription>Manage requests to meet with the Director</CardDescription>
          </div>
          <div className="flex space-x-2">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              onClick={() => setFilter("all")}
            >
              All
            </Button>
            <Button
              variant={filter === "pending" ? "default" : "outline"}
              onClick={() => setFilter("pending")}
            >
              Pending
            </Button>
            <Button
              variant={filter === "forwarded" ? "default" : "outline"}
              onClick={() => setFilter("forwarded")}
            >
              Forwarded
            </Button>
            <Button
              variant={filter === "approved" ? "default" : "outline"}
              onClick={() => setFilter("approved")}
            >
              Approved
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <ScrollArea className="h-[calc(100vh-20rem)]">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
            </div>
          ) : meetingRequests.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              No meeting requests found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request ID</TableHead>
                  <TableHead>Requester</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead>Date / Time</TableHead>
                  <TableHead>Urgency</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {meetingRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-mono text-sm">
                      {request.id.slice(0, 8)}…
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{request.fullName}</div>
                      <div className="text-sm text-muted-foreground">
                        {request.organization || "Individual"}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {request.purpose}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {request.preferredDate
                          ? format(new Date(request.preferredDate), "MMM dd, yyyy")
                          : "N/A"}
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {request.preferredTime || "N/A"}
                      </div>
                    </TableCell>
                    <TableCell>{getUrgencyBadge(request.urgency)}</TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetails(request)}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>

        {/* ── Detail Dialog ── */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Meeting Request Details</DialogTitle>
              <DialogDescription>
                {selectedRequest?.status === "forwarded"
                  ? "This request has been forwarded to the Director"
                  : "Review and update meeting request details"}
              </DialogDescription>
            </DialogHeader>

            {selectedRequest && (
              <div className="grid gap-4 py-4">

                {/* Request ID */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Request ID</Label>
                  <div className="col-span-3 font-mono text-sm">{selectedRequest.id}</div>
                </div>

                {/* Requester */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Requester</Label>
                  <div className="col-span-3 flex items-center gap-2">
                    <User className="h-4 w-4 shrink-0" />
                    <div>
                      <div className="font-medium">{selectedRequest.fullName}</div>
                      {selectedRequest.organization && (
                        <div className="text-sm text-muted-foreground">
                          {selectedRequest.organization}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Contact */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Contact</Label>
                  <div className="col-span-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {selectedRequest.email}
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      {selectedRequest.phoneNumber}
                    </div>
                  </div>
                </div>

                {/* Meeting Details */}
                <div className="grid grid-cols-4 gap-4">
                  <Label className="text-right pt-2">Meeting</Label>
                  <div className="col-span-3 space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Purpose</Label>
                      <div className="mt-1 p-3 rounded-md bg-muted/50 text-sm">
                        {selectedRequest.purpose}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Preferred Date</Label>
                        <div className="flex items-center gap-1 mt-1 text-sm">
                          <Calendar className="h-4 w-4" />
                          {selectedRequest.preferredDate
                            ? format(new Date(selectedRequest.preferredDate), "MMM dd, yyyy")
                            : "N/A"}
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Preferred Time</Label>
                        <div className="flex items-center gap-1 mt-1 text-sm">
                          <Clock className="h-4 w-4" />
                          {selectedRequest.preferredTime || "N/A"}
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Urgency</Label>
                      <div className="mt-1">{getUrgencyBadge(selectedRequest.urgency)}</div>
                    </div>
                  </div>
                </div>

                {/* Supporting Document */}
                {selectedRequest.supportingDocumentUrl && (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Document</Label>
                    <div className="col-span-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleDownloadDocument(selectedRequest.supportingDocumentUrl!)
                        }
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download Supporting Document
                      </Button>
                    </div>
                  </div>
                )}

                {/* Director Response (read-only if already responded) */}
                {(selectedRequest.status === "approved" || selectedRequest.status === "rejected") && (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Response</Label>
                    <div className="col-span-3 space-y-1">
                      {getStatusBadge(selectedRequest.status)}
                      {(selectedRequest as any).directorComment && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {(selectedRequest as any).directorComment}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Status selector — hide if already approved/rejected by director */}
                {selectedRequest.status !== "approved" && selectedRequest.status !== "rejected" && (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="status" className="text-right">Status</Label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger id="status" className="col-span-3">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending Review</SelectItem>
                        <SelectItem value="forwarded">Forward to Director</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Notes */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="notes" className="text-right">Notes</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add notes or comments about this meeting request"
                    className="col-span-3"
                    rows={3}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              {selectedRequest?.status !== "approved" &&
                selectedRequest?.status !== "rejected" && (
                  <Button onClick={handleSaveChanges}>
                    {status === "forwarded" ? (
                      <>
                        <ArrowRight className="mr-2 h-4 w-4" />
                        Forward to Director
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}