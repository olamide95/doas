"use client"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FileText, MoreHorizontal, Search } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabase"
import { format } from "date-fns"

type Submission = {
  id: string
  title: string
  description: string
  status: string
  submitter_id: string
  assigned_to: string | null
  document_url: string | null
  created_at: string
  updated_at: string
  department: string
  priority: string
  submitter_name?: string
}

export function SubmissionsTable({
  department = null,
  limit = 10,
  showFilters = true,
  canAssign = false,
  userId = null,
}: {
  department?: string | null
  limit?: number
  showFilters?: boolean
  canAssign?: boolean
  userId?: string | null
}) {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [staffList, setStaffList] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    const fetchSubmissions = async () => {
      try {
        let query = supabase.from("submissions").select("*").order("created_at", { ascending: false })

        // Apply department filter if specified
        if (department) {
          query = query.eq("department", department)
        }

        // Filter by status if selected
        if (statusFilter !== "all") {
          query = query.eq("status", statusFilter)
        }

        // Filter by search query if provided
        if (searchQuery) {
          query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
        }

        // Filter by assigned user if provided
        if (userId && !canAssign) {
          query = query.eq("assigned_to", userId)
        }

        // Limit the number of results
        query = query.limit(limit)

        const { data, error } = await query

        if (error) throw error

        // Get submitter details
        const userIds = [...new Set(data.map((s) => s.submitter_id))]

        if (userIds.length > 0) {
          const { data: profiles, error: profilesError } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", userIds)

          if (profilesError) throw profilesError

          // Merge submitter names with submissions
          const submissionsWithNames = data.map((submission) => {
            const submitter = profiles.find((p) => p.id === submission.submitter_id)
            return {
              ...submission,
              submitter_name: submitter?.full_name || "Unknown User",
            }
          })

          setSubmissions(submissionsWithNames)
        } else {
          setSubmissions(data)
        }
      } catch (error) {
        console.error("Error fetching submissions:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchSubmissions()

    // Fetch staff list if assignment is allowed
    if (canAssign) {
      const fetchStaff = async () => {
        try {
          const { data, error } = await supabase.from("profiles").select("id, full_name")

          if (error) throw error

          setStaffList(
            data.map((staff) => ({
              id: staff.id,
              name: staff.full_name,
            })),
          )
        } catch (error) {
          console.error("Error fetching staff list:", error)
        }
      }

      fetchStaff()
    }
  }, [department, limit, statusFilter, searchQuery, canAssign, userId])

  const handleViewSubmission = (submission: Submission) => {
    setSelectedSubmission(submission)
    setShowDialog(true)
  }

  const handleAssignSubmission = async (submissionId: string, assignedTo: string) => {
    try {
      const { error } = await supabase.from("submissions").update({ assigned_to: assignedTo }).eq("id", submissionId)

      if (error) throw error

      // Update local state
      setSubmissions((prev) =>
        prev.map((submission) =>
          submission.id === submissionId ? { ...submission, assigned_to: assignedTo } : submission,
        ),
      )

      // Create notification for assigned user
      await supabase.from("notifications").insert({
        user_id: assignedTo,
        content: `You have been assigned to submission: ${selectedSubmission?.title}`,
        type: "info",
        reference_id: submissionId,
      })
    } catch (error) {
      console.error("Error assigning submission:", error)
    }
  }

  const handleUpdateStatus = async (submissionId: string, status: string) => {
    try {
      const { error } = await supabase.from("submissions").update({ status }).eq("id", submissionId)

      if (error) throw error

      // Update local state
      setSubmissions((prev) =>
        prev.map((submission) => (submission.id === submissionId ? { ...submission, status } : submission)),
      )

      // Create notification for submitter
      await supabase.from("notifications").insert({
        user_id: selectedSubmission?.submitter_id as string,
        content: `Your submission "${selectedSubmission?.title}" status updated to: ${status}`,
        type: status === "approved" ? "success" : status === "rejected" ? "error" : "info",
        reference_id: submissionId,
      })
    } catch (error) {
      console.error("Error updating submission status:", error)
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
      case "in progress":
        return (
          <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
            In Progress
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
    <>
      {showFilters && (
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search submissions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in progress">In Progress</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-4">
                  Loading submissions...
                </TableCell>
              </TableRow>
            ) : submissions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-4">
                  No submissions found.
                </TableCell>
              </TableRow>
            ) : (
              submissions.map((submission) => (
                <TableRow key={submission.id}>
                  <TableCell className="font-medium">{submission.title}</TableCell>
                  <TableCell>{getStatusBadge(submission.status)}</TableCell>
                  <TableCell>{submission.department}</TableCell>
                  <TableCell>{format(new Date(submission.created_at), "MMM d, yyyy")}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        submission.priority === "high"
                          ? "destructive"
                          : submission.priority === "medium"
                            ? "default"
                            : "secondary"
                      }
                    >
                      {submission.priority}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleViewSubmission(submission)}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Submission Detail Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedSubmission?.title}</DialogTitle>
            <DialogDescription>
              Submitted by {selectedSubmission?.submitter_name} on{" "}
              {selectedSubmission?.created_at && format(new Date(selectedSubmission.created_at), "MMMM d, yyyy")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <div className="font-medium">Status:</div>
              <div className="col-span-3">
                {canAssign ? (
                  <Select
                    defaultValue={selectedSubmission?.status}
                    onValueChange={(value) => selectedSubmission && handleUpdateStatus(selectedSubmission.id, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in progress">In Progress</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  getStatusBadge(selectedSubmission?.status || "pending")
                )}
              </div>
            </div>

            {canAssign && (
              <div className="grid grid-cols-4 items-center gap-4">
                <div className="font-medium">Assign To:</div>
                <div className="col-span-3">
                  <Select
                    defaultValue={selectedSubmission?.assigned_to || ""}
                    onValueChange={(value) =>
                      selectedSubmission && handleAssignSubmission(selectedSubmission.id, value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select staff member" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {staffList.map((staff) => (
                        <SelectItem key={staff.id} value={staff.id}>
                          {staff.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-4 items-center gap-4">
              <div className="font-medium">Department:</div>
              <div className="col-span-3">{selectedSubmission?.department}</div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <div className="font-medium">Priority:</div>
              <div className="col-span-3">
                <Badge
                  variant={
                    selectedSubmission?.priority === "high"
                      ? "destructive"
                      : selectedSubmission?.priority === "medium"
                        ? "default"
                        : "secondary"
                  }
                >
                  {selectedSubmission?.priority}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="font-medium">Description:</div>
              <div className="col-span-3 whitespace-pre-wrap">{selectedSubmission?.description}</div>
            </div>

            {selectedSubmission?.document_url && (
              <div className="grid grid-cols-4 gap-4">
                <div className="font-medium">Document:</div>
                <div className="col-span-3">
                  <a
                    href={selectedSubmission.document_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-primary hover:underline"
                  >
                    <FileText className="h-4 w-4" />
                    View Document
                  </a>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
