"use client"

import { useState, useEffect } from "react"
import {
  collection, query, orderBy, onSnapshot, doc,
  updateDoc, addDoc, arrayUnion, where
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Eye, Search, Forward, XCircle, User, Building,
  MapPin, Phone, Mail, Hash, FileText, AlertCircle,
  Clock, CheckCircle, Filter,
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface Submission {
  id: string
  submissionId: string
  applicantName: string
  contactPhoneNumber: string
  email: string
  applicationType: string
  status: string
  department: string
  isFirstParty: boolean
  companyName?: string
  createdAt: any
  gpsCoordinates?: string
  purposeOfApplication?: string
  addressLine1?: string
  addressLine2?: string
  signDimensions?: string
  structuralHeight?: string
  numberOfSigns?: string
  typeOfSign?: string
  structureDuration?: string
  practitionerName?: string
  practitionerLicenseNumber?: string
  companyRegistrationNumber?: string
  companyAddress?: string
  comments?: Array<{ text: string; timestamp: string; action: string }>
}

const safeDate = (value: any): Date | null => {
  if (!value) return null
  if (typeof value.toDate === "function") return value.toDate()
  if (typeof value === "string" || typeof value === "number") return new Date(value)
  if (value instanceof Date) return value
  return null
}

const statusStyles: Record<string, string> = {
  Pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  "Under Review": "bg-blue-100 text-blue-800 border-blue-200",
  "Forwarded to Business Development": "bg-purple-100 text-purple-800 border-purple-200",
  "Forwarded to Director": "bg-indigo-100 text-indigo-800 border-indigo-200",
  "Site Visit Approved": "bg-emerald-100 text-emerald-800 border-emerald-200",
  Rejected: "bg-red-100 text-red-800 border-red-200",
  Approved: "bg-green-100 text-green-800 border-green-200",
}

export default function SubmissionsTable() {
  const { toast } = useToast()
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("first-party")
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null)
  const [comment, setComment] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [dialogTab, setDialogTab] = useState("details")
  const [isProcessing, setIsProcessing] = useState(false)

  // ── Realtime listener ────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true)
    const collName = activeTab === "first-party" ? "firstPartySubmissions" : "thirdPartySubmissions"
    let q = filterStatus === "all"
      ? query(collection(db, collName), orderBy("createdAt", "desc"))
      : query(collection(db, collName), where("status", "==", filterStatus), orderBy("createdAt", "desc"))

    const unsub = onSnapshot(q, (snap) => {
      const data: Submission[] = snap.docs.map((d) => ({
        id: d.id,
        isFirstParty: activeTab === "first-party",
        ...(d.data() as any),
      }))
      setSubmissions(data)
      setLoading(false)
    }, (err) => {
      console.error(err)
      setLoading(false)
    })

    return () => unsub()
  }, [activeTab, filterStatus])

  // ── Actions ──────────────────────────────────────────────────────────────
  const handleForward = async (nextDept: string, nextStatus: string) => {
    if (!selectedSubmission) return
    setIsProcessing(true)
    try {
      const collName = selectedSubmission.isFirstParty ? "firstPartySubmissions" : "thirdPartySubmissions"
      const ref = doc(db, collName, selectedSubmission.id)
      const now = new Date().toISOString()
      const action = `Forwarded to ${nextDept} by CSU`

      await updateDoc(ref, {
        status: nextStatus,
        department: nextDept,
        comments: arrayUnion({ text: comment || `Application forwarded to ${nextDept}`, timestamp: now, action }),
        updatedAt: now,
      })

      const notifUserId = nextDept === "Business Development" ? "business_development"
        : nextDept === "Director" ? "director" : ""

      if (notifUserId) {
        await addDoc(collection(db, "notifications"), {
          userId: notifUserId,
          content: `New ${selectedSubmission.isFirstParty ? "first-party" : "third-party"} submission from ${selectedSubmission.applicantName}`,
          type: "info",
          referenceId: selectedSubmission.id,
          isRead: false,
          createdAt: now,
        })
      }

      toast({ title: `Forwarded to ${nextDept}`, description: `Submission forwarded successfully.` })
      setIsDialogOpen(false)
      setComment("")
    } catch (err) {
      console.error(err)
      toast({ title: "Error", description: "Failed to forward submission.", variant: "destructive" })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!selectedSubmission) return
    setIsProcessing(true)
    try {
      const collName = selectedSubmission.isFirstParty ? "firstPartySubmissions" : "thirdPartySubmissions"
      const ref = doc(db, collName, selectedSubmission.id)
      const now = new Date().toISOString()

      await updateDoc(ref, {
        status: "Rejected",
        department: "CSU",
        comments: arrayUnion({ text: comment || "Application rejected by CSU", timestamp: now, action: "Rejected by CSU" }),
        updatedAt: now,
      })

      toast({ title: "Submission Rejected", description: "The submission has been rejected." })
      setIsDialogOpen(false)
      setComment("")
    } catch (err) {
      toast({ title: "Error", description: "Failed to reject submission.", variant: "destructive" })
    } finally {
      setIsProcessing(false)
    }
  }

  const openDialog = (s: Submission) => {
    setSelectedSubmission(s)
    setComment("")
    setDialogTab("details")
    setIsDialogOpen(true)
  }

  // ── Filtered list ────────────────────────────────────────────────────────
  const filtered = submissions.filter((s) =>
    s.applicantName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.submissionId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.companyName?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const StatusBadge = ({ status }: { status: string }) => (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusStyles[status] || "bg-gray-100 text-gray-800 border-gray-200"}`}>
      {status}
    </span>
  )

  const DetailRow = ({ label, value }: { label: string; value?: string }) =>
    value ? (
      <div>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-sm mt-0.5">{value}</p>
      </div>
    ) : null

  return (
    <>
      {/* ── Tab Filter ─────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setFilterStatus("all") }}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <TabsList>
              <TabsTrigger value="first-party" className="flex items-center gap-2">
                <User className="h-4 w-4" /> First Party
              </TabsTrigger>
              <TabsTrigger value="third-party" className="flex items-center gap-2">
                <Building className="h-4 w-4" /> Third Party
              </TabsTrigger>
            </TabsList>

            <div className="flex gap-3">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[200px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Under Review">Under Review</SelectItem>
                  <SelectItem value="Forwarded to Business Development">Forwarded to Biz Dev</SelectItem>
                  <SelectItem value="Forwarded to Director">Forwarded to Director</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>

              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search submissions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
            </div>
          </div>

          {/* ── Stats ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            {[
              { label: "Pending", count: submissions.filter(s => s.status === "Pending").length, color: "text-yellow-600", icon: Clock },
              { label: "Under Review", count: submissions.filter(s => s.status === "Under Review").length, color: "text-blue-600", icon: AlertCircle },
              { label: "Total", count: submissions.length, color: "text-purple-600", icon: FileText },
            ].map(({ label, count, color, icon: Icon }) => (
              <Card key={label}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className={`text-2xl font-bold ${color}`}>{count}</div>
                      <p className="text-sm text-muted-foreground">{label}</p>
                    </div>
                    <div className={`h-10 w-10 rounded-full bg-muted flex items-center justify-center`}>
                      <Icon className={`h-5 w-5 ${color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* ── Info Banner ────────────────────────────────────────────── */}
          <div className={`p-4 rounded-lg border mb-4 flex items-start gap-3 ${
            activeTab === "first-party" ? "bg-blue-50 border-blue-200" : "bg-green-50 border-green-200"
          }`}>
            <AlertCircle className={`h-5 w-5 mt-0.5 flex-shrink-0 ${activeTab === "first-party" ? "text-blue-600" : "text-green-600"}`} />
            <div>
              <p className={`font-medium text-sm ${activeTab === "first-party" ? "text-blue-800" : "text-green-800"}`}>
                {activeTab === "first-party" ? "First-Party Applications" : "Third-Party Applications"}
              </p>
              <p className={`text-xs mt-0.5 ${activeTab === "first-party" ? "text-blue-700" : "text-green-700"}`}>
                {activeTab === "first-party"
                  ? "Applications submitted directly by property owners. Review and forward to Business Development for site visits."
                  : "Applications submitted by registered practitioners on behalf of clients. Review and forward to the Director."}
              </p>
            </div>
          </div>

          <TabsContent value="first-party">
            <SubmissionTable
              submissions={filtered}
              loading={loading}
              isFirstParty={true}
              onView={openDialog}
            />
          </TabsContent>

          <TabsContent value="third-party">
            <SubmissionTable
              submissions={filtered}
              loading={loading}
              isFirstParty={false}
              onView={openDialog}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* ── View/Review Dialog ─────────────────────────────────────────── */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedSubmission?.isFirstParty ? (
                <User className="h-5 w-5 text-blue-600" />
              ) : (
                <Building className="h-5 w-5 text-green-600" />
              )}
              Submission Review
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                {selectedSubmission?.submissionId}
              </span>
              {selectedSubmission && <StatusBadge status={selectedSubmission.status} />}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1">
            <Tabs value={dialogTab} onValueChange={setDialogTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="details">Application Details</TabsTrigger>
                <TabsTrigger value="signage">Signage Details</TabsTrigger>
                {!selectedSubmission?.isFirstParty && (
                  <TabsTrigger value="company">Company & Practitioner</TabsTrigger>
                )}
                <TabsTrigger value="history">
                  History ({selectedSubmission?.comments?.length || 0})
                </TabsTrigger>
              </TabsList>

              {/* Details */}
              <TabsContent value="details" className="space-y-4">
                <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-muted/30">
                  <DetailRow label="Applicant Name" value={selectedSubmission?.applicantName} />
                  <DetailRow label="Phone Number" value={selectedSubmission?.contactPhoneNumber} />
                  <DetailRow label="Email" value={selectedSubmission?.email} />
                  <DetailRow label="Application Type" value={selectedSubmission?.applicationType} />
                  <DetailRow label="Purpose" value={selectedSubmission?.purposeOfApplication} />
                  <DetailRow label="Address Line 1" value={selectedSubmission?.addressLine1} />
                  {selectedSubmission?.addressLine2 && (
                    <DetailRow label="Address Line 2" value={selectedSubmission?.addressLine2} />
                  )}
                  {selectedSubmission?.gpsCoordinates && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">GPS Coordinates</p>
                      <p className="text-sm mt-0.5 flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {selectedSubmission.gpsCoordinates}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Current Status</p>
                    <div className="mt-1">
                      {selectedSubmission && <StatusBadge status={selectedSubmission.status} />}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Submitted</p>
                    <p className="text-sm mt-0.5">
                      {selectedSubmission?.createdAt
                        ? safeDate(selectedSubmission.createdAt)?.toLocaleDateString() ?? "N/A"
                        : "N/A"}
                    </p>
                  </div>
                </div>
              </TabsContent>

              {/* Signage */}
              <TabsContent value="signage">
                <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-muted/30">
                  <DetailRow label="Sign Dimensions" value={selectedSubmission?.signDimensions} />
                  <DetailRow label="Structural Height" value={selectedSubmission?.structuralHeight} />
                  <DetailRow label="Number of Signs" value={selectedSubmission?.numberOfSigns} />
                  <DetailRow label="Type of Sign" value={selectedSubmission?.typeOfSign} />
                  <DetailRow label="Structure Duration" value={selectedSubmission?.structureDuration} />
                </div>
              </TabsContent>

              {/* Company & Practitioner */}
              {!selectedSubmission?.isFirstParty && (
                <TabsContent value="company">
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                        Company Details
                      </h4>
                      <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-muted/30">
                        <DetailRow label="Company Name" value={selectedSubmission?.companyName} />
                        <DetailRow label="Company Reg. No." value={selectedSubmission?.companyRegistrationNumber} />
                        <DetailRow label="Company Address" value={selectedSubmission?.companyAddress} />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                        Practitioner Details
                      </h4>
                      <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-muted/30">
                        <DetailRow label="Practitioner Name" value={selectedSubmission?.practitionerName} />
                        <DetailRow label="License Number" value={selectedSubmission?.practitionerLicenseNumber} />
                      </div>
                    </div>
                  </div>
                </TabsContent>
              )}

              {/* History */}
              <TabsContent value="history">
                <div className="space-y-3">
                  {selectedSubmission?.comments?.length ? (
                    selectedSubmission.comments.map((c, i) => {
                      const d = safeDate(c.timestamp)
                      return (
                        <div key={i} className="flex gap-3 p-3 rounded-xl border bg-muted/20">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <CheckCircle className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{c.action}</p>
                            <p className="text-xs text-muted-foreground">{d ? d.toLocaleString() : c.timestamp}</p>
                            <p className="text-sm mt-1 text-muted-foreground">{c.text}</p>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="text-center py-10 text-muted-foreground">
                      <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      <p>No history yet. This is a new submission.</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            {/* Comment Box */}
            <div className="mt-4 pt-4 border-t">
              <Label htmlFor="comment" className="text-sm font-medium">
                Review Comment
              </Label>
              <Textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add your review notes or comments..."
                className="mt-2"
                rows={3}
              />
            </div>
          </ScrollArea>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-4 border-t">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isProcessing}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleReject} disabled={isProcessing}>
                <XCircle className="h-4 w-4 mr-2" /> Reject
              </Button>
            </div>
            <div className="sm:ml-auto">
              {selectedSubmission?.isFirstParty ? (
                <Button
                  onClick={() => handleForward("Business Development", "Forwarded to Business Development")}
                  disabled={isProcessing}
                >
                  <Forward className="h-4 w-4 mr-2" />
                  {isProcessing ? "Forwarding..." : "Forward to Business Development"}
                </Button>
              ) : (
                <Button
                  onClick={() => handleForward("Director", "Forwarded to Director")}
                  disabled={isProcessing}
                >
                  <Forward className="h-4 w-4 mr-2" />
                  {isProcessing ? "Forwarding..." : "Forward to Director"}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Reusable table sub-component ───────────────────────────────────────────
function SubmissionTable({
  submissions,
  loading,
  isFirstParty,
  onView,
}: {
  submissions: Submission[]
  loading: boolean
  isFirstParty: boolean
  onView: (s: Submission) => void
}) {
  const safeDate = (value: any): Date | null => {
    if (!value) return null
    if (typeof value.toDate === "function") return value.toDate()
    if (typeof value === "string" || typeof value === "number") return new Date(value)
    return null
  }

  const statusStyles: Record<string, string> = {
    Pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    "Under Review": "bg-blue-100 text-blue-800 border-blue-200",
    "Forwarded to Business Development": "bg-purple-100 text-purple-800 border-purple-200",
    "Forwarded to Director": "bg-indigo-100 text-indigo-800 border-indigo-200",
    "Site Visit Approved": "bg-emerald-100 text-emerald-800 border-emerald-200",
    Rejected: "bg-red-100 text-red-800 border-red-200",
    Approved: "bg-green-100 text-green-800 border-green-200",
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${isFirstParty ? "border-blue-600" : "border-green-600"}`} />
      </div>
    )
  }

  if (submissions.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground border rounded-xl bg-muted/20">
        <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p className="font-medium">No submissions found</p>
        <p className="text-sm">Try adjusting your filters</p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-[calc(100vh-34rem)]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Submission ID</TableHead>
            <TableHead>{isFirstParty ? "Applicant" : "Applicant / Company"}</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Application Type</TableHead>
            {isFirstParty ? <TableHead>Location</TableHead> : <TableHead>Purpose</TableHead>}
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions.map((s) => {
            const date = safeDate(s.createdAt)
            return (
              <TableRow key={s.id} className="hover:bg-muted/30 group">
                <TableCell className="font-mono text-xs">
                  {s.submissionId || `${isFirstParty ? "FP" : "TP"}-${s.id.slice(0, 8)}`}
                </TableCell>
                <TableCell>
                  <div className="font-medium text-sm">{s.applicantName}</div>
                  {!isFirstParty && s.companyName && (
                    <div className="text-xs text-muted-foreground">{s.companyName}</div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="text-sm">{s.contactPhoneNumber}</div>
                  <div className="text-xs text-muted-foreground">{s.email}</div>
                </TableCell>
                <TableCell className="text-sm">{s.applicationType}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[140px] truncate">
                  {isFirstParty ? (s.gpsCoordinates || "—") : (s.purposeOfApplication || "—")}
                </TableCell>
                <TableCell>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusStyles[s.status] || "bg-gray-100 text-gray-800 border-gray-200"}`}>
                    {s.status}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {date ? date.toLocaleDateString() : "N/A"}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onView(s)}
                    className="opacity-70 group-hover:opacity-100 transition-opacity"
                  >
                    <Eye className="h-4 w-4 mr-1" /> Review
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </ScrollArea>
  )
}