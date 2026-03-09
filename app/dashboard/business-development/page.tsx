// app/admin/business-development/page.tsx
"use client"

import { useState, useEffect, useCallback } from "react"
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  updateDoc, 
  doc, 
  arrayUnion, 
  addDoc,
  orderBy,
  Timestamp,
  getDoc
} from "firebase/firestore"
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from "firebase/storage"
import { db, storage } from "@/lib/firebase"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
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
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { 
  Search, 
  Building2, 
  MapPin, 
  User, 
  FileText, 
  Camera, 
  Upload, 
  Eye, 
  CheckCircle2, 
  Clock, 
  MoreHorizontal, 
  Download,
  Trash2,
  Image as ImageIcon,
  X,
  ChevronRight,
  Filter,
  Calendar,
  RefreshCw,
  Plus
} from "lucide-react"
import { format } from "date-fns"

interface Submission {
  id: string
  submissionId: string
  applicantName: string
  contactPhoneNumber: string
  email: string
  applicationType: string
  gpsCoordinates: string
  status: string
  createdAt?: Timestamp
  updatedAt?: string
  businessDevelopmentReport?: SiteVisitData
  files?: {
    eiaReport?: string
    soilTestReport?: string
    proofOfPayment?: string
    structuralEngineeringDrawings?: string
    sitePhotos?: string[]
  }
  comments?: Comment[]
}

interface Comment {
  text: string
  timestamp: string
  action: string
  userId?: string
}

interface SiteVisitData {
  companyName: string
  typeOfConcept: string
  numberOfProposedSignage: string
  length: string
  width: string
  area: string
  location: string
  gpsCoordinates: string
  boardToBoardDistance: string
  roadKerbDistance: string
  humanObstruction: string
  vehicleObstruction: string
  visibilityObstruction: string
  vacant: string
  comments: string
  reportingOfficer: string
  reportingOfficerRank: string
  headOfSection: string
  headOfSectionRank: string
  commend: string
  sitePhotos?: string[]
  visitDate?: string
}

interface SitePhoto {
  id: string
  url: string
  name: string
  timestamp: string
  coordinates?: string
}

export default function BusinessDevelopmentDashboard() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null)
  const [comment, setComment] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState("pending")
  const [isLoading, setIsLoading] = useState(false)
  const [sitePhotos, setSitePhotos] = useState<SitePhoto[]>([])
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [photoToDelete, setPhotoToDelete] = useState<SitePhoto | null>(null)
  const [stats, setStats] = useState({
    pending: 0,
    completed: 0,
    total: 0
  })

  const [siteVisitData, setSiteVisitData] = useState<SiteVisitData>({
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
    visitDate: format(new Date(), "yyyy-MM-dd"),
  })

  const fetchSubmissions = useCallback(async () => {
    setIsLoading(true)
    try {
      // Fetch both pending and completed for stats
      const pendingQuery = query(
        collection(db, "firstPartySubmissions"),
        where("department", "==", "Business Development"),
        where("status", "==", "Forwarded to Business Development"),
        orderBy("createdAt", "desc")
      )
      
      const completedQuery = query(
        collection(db, "firstPartySubmissions"),
        where("department", "==", "Business Development"),
        where("status", "==", "Site Visit Completed"),
        orderBy("updatedAt", "desc")
      )

      const [pendingSnap, completedSnap] = await Promise.all([
        getDocs(pendingQuery),
        getDocs(completedQuery)
      ])

      const pendingData = pendingSnap.docs.map((doc) => ({ 
        id: doc.id, 
        ...doc.data() 
      } as Submission))
      
      const completedData = completedSnap.docs.map((doc) => ({ 
        id: doc.id, 
        ...doc.data() 
      } as Submission))

      setStats({
        pending: pendingData.length,
        completed: completedData.length,
        total: pendingData.length + completedData.length
      })

      // Set active view based on tab
      if (activeTab === "pending") {
        setSubmissions(pendingData)
      } else {
        setSubmissions(completedData)
      }
    } catch (error) {
      console.error("Error fetching submissions:", error)
    } finally {
      setIsLoading(false)
    }
  }, [activeTab])

  useEffect(() => {
    fetchSubmissions()
  }, [fetchSubmissions])

  const handleView = async (submission: Submission) => {
    setSelectedSubmission(submission)
    
    // Load existing site visit data if available
    if (submission.businessDevelopmentReport) {
      setSiteVisitData({
        ...submission.businessDevelopmentReport,
        visitDate: submission.businessDevelopmentReport.visitDate || format(new Date(), "yyyy-MM-dd"),
      })
      setSitePhotos(submission.businessDevelopmentReport.sitePhotos?.map((url, idx) => ({
        id: `existing-${idx}`,
        url,
        name: `Site Photo ${idx + 1}`,
        timestamp: submission.businessDevelopmentReport?.visitDate || new Date().toISOString(),
      })) || [])
    } else {
      // Reset for new entry
      setSiteVisitData({
        companyName: submission.applicantName,
        typeOfConcept: submission.applicationType,
        gpsCoordinates: submission.gpsCoordinates,
        location: "",
        numberOfProposedSignage: "",
        length: "",
        width: "",
        area: "",
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
        visitDate: format(new Date(), "yyyy-MM-dd"),
      })
      setSitePhotos([])
    }
    
    setIsDialogOpen(true)
  }

  const handleViewDetails = (submission: Submission) => {
    setSelectedSubmission(submission)
    setIsViewDialogOpen(true)
  }

  const handleClose = () => {
    setSelectedSubmission(null)
    setComment("")
    setIsDialogOpen(false)
    setSitePhotos([])
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
      visitDate: format(new Date(), "yyyy-MM-dd"),
    })
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !selectedSubmission) return
    
    const files = Array.from(e.target.files)
    setUploadingPhoto(true)

    try {
      const uploadPromises = files.map(async (file) => {
        const photoId = `photo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        const storageRef = ref(storage, `site-visits/${selectedSubmission.id}/${photoId}`)
        
        // Add metadata for coordinates if available
        const metadata = {
          contentType: file.type,
          customMetadata: {
            originalName: file.name,
            uploadDate: new Date().toISOString(),
            submissionId: selectedSubmission.id,
          }
        }
        
        await uploadBytes(storageRef, file, metadata)
        const url = await getDownloadURL(storageRef)
        
        return {
          id: photoId,
          url,
          name: file.name,
          timestamp: new Date().toISOString(),
        }
      })

      const newPhotos = await Promise.all(uploadPromises)
      setSitePhotos(prev => [...prev, ...newPhotos])
    } catch (error) {
      console.error("Error uploading photos:", error)
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleDeletePhoto = async () => {
    if (!photoToDelete || !selectedSubmission) return

    try {
      const storageRef = ref(storage, `site-visits/${selectedSubmission.id}/${photoToDelete.id}`)
      await deleteObject(storageRef)
      setSitePhotos(prev => prev.filter(p => p.id !== photoToDelete.id))
    } catch (error) {
      console.error("Error deleting photo:", error)
    } finally {
      setDeleteDialogOpen(false)
      setPhotoToDelete(null)
    }
  }

  const handleSubmitSiteVisit = async () => {
    if (!selectedSubmission) return

    setIsLoading(true)
    try {
      const submissionRef = doc(db, "firstPartySubmissions", selectedSubmission.id)
      const now = new Date().toISOString()
      
      const reportData = {
        ...siteVisitData,
        sitePhotos: sitePhotos.map(p => p.url),
        submittedAt: now,
      }

      await updateDoc(submissionRef, {
        status: "Site Visit Completed",
        department: "Finance",
        businessDevelopmentReport: reportData,
        comments: arrayUnion({
          text: comment || "Site visit report submitted",
          timestamp: now,
          action: "Site visit completed by Business Development",
          userId: "business_development",
        }),
        updatedAt: now,
      })

      // Log activity
      await addDoc(collection(db, "activityLogs"), {
        submissionId: selectedSubmission.id,
        action: "Business Development site visit completed",
        timestamp: now,
        details: reportData,
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
    } finally {
      setIsLoading(false)
    }
  }

  const filteredSubmissions = submissions.filter(submission =>
    submission.applicantName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    submission.submissionId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    submission.applicationType?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Site Visit Completed":
        return "bg-emerald-100 text-emerald-800 border-emerald-200"
      case "Forwarded to Business Development":
        return "bg-amber-100 text-amber-800 border-amber-200"
      default:
        return "bg-slate-100 text-slate-800 border-slate-200"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Site Visit Completed":
        return <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
      case "Forwarded to Business Development":
        return <Clock className="h-3.5 w-3.5 mr-1" />
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Header Section */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
                Business Development
              </h1>
              <p className="text-slate-500 mt-1">Site visit management and first-party application processing</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={fetchSubmissions} className="gap-2">
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button className="gap-2 bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4" />
                New Application
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm hover:shadow-md transition-all">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Pending Site Visits</p>
                  <p className="text-3xl font-bold text-amber-600 mt-1">{stats.pending}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm hover:shadow-md transition-all">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Completed Visits</p>
                  <p className="text-3xl font-bold text-emerald-600 mt-1">{stats.completed}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm hover:shadow-md transition-all">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Total Applications</p>
                  <p className="text-3xl font-bold text-blue-600 mt-1">{stats.total}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Card */}
        <Card className="border-slate-200/60 shadow-lg bg-white/90 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xl font-semibold text-slate-900">Applications Queue</CardTitle>
                <CardDescription>Manage and process first-party signage applications</CardDescription>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
                  <TabsList className="grid w-full sm:w-[300px] grid-cols-2 bg-slate-100 p-1">
                    <TabsTrigger 
                      value="pending" 
                      className="data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-amber-700"
                    >
                      <Clock className="h-4 w-4 mr-2" />
                      Pending
                    </TabsTrigger>
                    <TabsTrigger 
                      value="completed"
                      className="data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-emerald-700"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Completed
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search applications..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-white border-slate-200 focus-visible:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow className="hover:bg-slate-50/80 border-slate-200">
                    <TableHead className="font-semibold text-slate-700">Submission ID</TableHead>
                    <TableHead className="font-semibold text-slate-700">Applicant</TableHead>
                    <TableHead className="font-semibold text-slate-700 hidden md:table-cell">Contact</TableHead>
                    <TableHead className="font-semibold text-slate-700">Type</TableHead>
                    <TableHead className="font-semibold text-slate-700 hidden lg:table-cell">Location</TableHead>
                    <TableHead className="font-semibold text-slate-700">Status</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center">
                        <div className="flex items-center justify-center gap-2 text-slate-500">
                          <RefreshCw className="h-5 w-5 animate-spin" />
                          Loading applications...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredSubmissions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center">
                        <div className="flex flex-col items-center justify-center text-slate-400">
                          <Building2 className="h-12 w-12 mb-2 opacity-20" />
                          <p className="text-sm">No applications found</p>
                          <p className="text-xs mt-1">Try adjusting your search or filter</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSubmissions.map((submission) => (
                      <TableRow 
                        key={submission.id} 
                        className="group hover:bg-blue-50/50 transition-colors border-slate-100"
                      >
                        <TableCell className="font-mono text-sm text-slate-600">
                          <span className="bg-slate-100 px-2 py-1 rounded text-xs font-medium">
                            {submission.submissionId}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-xs font-medium text-blue-700">
                              {submission.applicantName?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-slate-900 text-sm">{submission.applicantName}</p>
                              <p className="text-xs text-slate-500 hidden sm:block">{submission.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="text-sm text-slate-600">
                            <p>{submission.contactPhoneNumber}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 font-medium">
                            {submission.applicationType}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="flex items-center gap-1.5 text-sm text-slate-600 max-w-[200px] truncate">
                            <MapPin className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                            <span className="truncate">{submission.gpsCoordinates}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={`${getStatusColor(submission.status)} font-medium text-xs px-2.5 py-1`}
                          >
                            <span className="flex items-center">
                              {getStatusIcon(submission.status)}
                              {submission.status === "Forwarded to Business Development" ? "Pending" : "Completed"}
                            </span>
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-slate-600 hover:text-blue-600 hover:bg-blue-50"
                                    onClick={() => handleViewDetails(submission)}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>View Details</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleView(submission)}
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-medium"
                            >
                              {activeTab === "pending" ? (
                                <>
                                  <Camera className="h-4 w-4 mr-1.5" />
                                  Site Visit
                                </>
                              ) : (
                                <>
                                  <FileText className="h-4 w-4 mr-1.5" />
                                  View Report
                                </>
                              )}
                              <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Site Visit Report Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-hidden p-0 gap-0 bg-white">
          <DialogHeader className="px-6 py-4 border-b bg-slate-50/50">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl font-semibold text-slate-900 flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  Site Visit Report
                </DialogTitle>
                <DialogDescription className="text-slate-500 mt-1">
                  {selectedSubmission?.applicantName} • {selectedSubmission?.submissionId}
                </DialogDescription>
              </div>
              <Badge 
                variant="outline" 
                className={`${getStatusColor(selectedSubmission?.status || "")} px-3 py-1`}
              >
                {selectedSubmission?.status === "Site Visit Completed" ? "Viewing Report" : "New Report"}
              </Badge>
            </div>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(95vh-180px)] px-6 py-4">
            <div className="space-y-6">
              {/* Photo Upload Section */}
              <Card className="border-dashed border-2 border-slate-200 bg-slate-50/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <Camera className="h-4 w-4 text-blue-600" />
                    Site Photographs
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Upload geotagged photos of the site visit. Photos should include coordinates, date and time.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <Label 
                        htmlFor="photo-upload" 
                        className="flex-1 cursor-pointer border-2 border-dashed border-slate-300 rounded-lg p-6 hover:border-blue-400 hover:bg-blue-50/50 transition-all flex flex-col items-center gap-2"
                      >
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <Upload className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium text-slate-700">Click to upload photos</p>
                          <p className="text-xs text-slate-500 mt-1">JPG, PNG up to 10MB each</p>
                        </div>
                        <Input
                          id="photo-upload"
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={handlePhotoUpload}
                          disabled={uploadingPhoto}
                        />
                      </Label>
                    </div>

                    {sitePhotos.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {sitePhotos.map((photo) => (
                          <div 
                            key={photo.id} 
                            className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-100"
                          >
                            <img 
                              src={photo.url} 
                              alt={photo.name}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <div className="flex gap-2">
                                <Button
                                  variant="secondary"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => window.open(photo.url, '_blank')}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => {
                                    setPhotoToDelete(photo)
                                    setDeleteDialogOpen(true)
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                              <p className="text-xs text-white truncate">{photo.name}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Separator className="bg-slate-200" />

              {/* Site Visit Form */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Site Information</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName" className="text-sm font-medium text-slate-700">
                      Company/Organization Name
                    </Label>
                    <Input
                      id="companyName"
                      value={siteVisitData.companyName}
                      onChange={(e) => setSiteVisitData(prev => ({ ...prev, companyName: e.target.value }))}
                      className="bg-white border-slate-200 focus-visible:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="typeOfConcept" className="text-sm font-medium text-slate-700">
                      Type of Concept (Signage)
                    </Label>
                    <Input
                      id="typeOfConcept"
                      value={siteVisitData.typeOfConcept}
                      onChange={(e) => setSiteVisitData(prev => ({ ...prev, typeOfConcept: e.target.value }))}
                      className="bg-white border-slate-200 focus-visible:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="numberOfProposedSignage" className="text-sm font-medium text-slate-700">
                      Number of Proposed Signage
                    </Label>
                    <Input
                      id="numberOfProposedSignage"
                      type="number"
                      value={siteVisitData.numberOfProposedSignage}
                      onChange={(e) => setSiteVisitData(prev => ({ ...prev, numberOfProposedSignage: e.target.value }))}
                      className="bg-white border-slate-200 focus-visible:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="visitDate" className="text-sm font-medium text-slate-700">
                      Site Visit Date
                    </Label>
                    <Input
                      id="visitDate"
                      type="date"
                      value={siteVisitData.visitDate}
                      onChange={(e) => setSiteVisitData(prev => ({ ...prev, visitDate: e.target.value }))}
                      className="bg-white border-slate-200 focus-visible:ring-blue-500"
                    />
                  </div>
                </div>

                <Separator className="bg-slate-100" />

                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Dimensions & Measurements</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="length" className="text-sm font-medium text-slate-700">
                      Length (meters)
                    </Label>
                    <Input
                      id="length"
                      value={siteVisitData.length}
                      onChange={(e) => setSiteVisitData(prev => ({ ...prev, length: e.target.value }))}
                      placeholder="e.g., 4.5"
                      className="bg-white border-slate-200 focus-visible:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="width" className="text-sm font-medium text-slate-700">
                      Width (meters)
                    </Label>
                    <Input
                      id="width"
                      value={siteVisitData.width}
                      onChange={(e) => setSiteVisitData(prev => ({ ...prev, width: e.target.value }))}
                      placeholder="e.g., 6.0"
                      className="bg-white border-slate-200 focus-visible:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="area" className="text-sm font-medium text-slate-700">
                      Total Area (m²)
                    </Label>
                    <Input
                      id="area"
                      value={siteVisitData.area}
                      onChange={(e) => setSiteVisitData(prev => ({ ...prev, area: e.target.value }))}
                      placeholder="Auto-calculated or enter manually"
                      className="bg-white border-slate-200 focus-visible:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="location" className="text-sm font-medium text-slate-700">
                      Detailed Location Description
                    </Label>
                    <Textarea
                      id="location"
                      value={siteVisitData.location}
                      onChange={(e) => setSiteVisitData(prev => ({ ...prev, location: e.target.value }))}
                      placeholder="Street name, district, landmarks..."
                      className="bg-white border-slate-200 focus-visible:ring-blue-500 min-h-[80px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gpsCoordinates" className="text-sm font-medium text-slate-700">
                      GPS Coordinates
                    </Label>
                    <Input
                      id="gpsCoordinates"
                      value={siteVisitData.gpsCoordinates}
                      onChange={(e) => setSiteVisitData(prev => ({ ...prev, gpsCoordinates: e.target.value }))}
                      placeholder="Lat, Long"
                      className="bg-white border-slate-200 focus-visible:ring-blue-500 font-mono text-sm"
                    />
                  </div>
                </div>

                <Separator className="bg-slate-100" />

                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Clearance & Safety Assessment</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="boardToBoardDistance" className="text-sm font-medium text-slate-700">
                      Board to Board Distance
                    </Label>
                    <Input
                      id="boardToBoardDistance"
                      value={siteVisitData.boardToBoardDistance}
                      onChange={(e) => setSiteVisitData(prev => ({ ...prev, boardToBoardDistance: e.target.value }))}
                      placeholder="Distance in meters"
                      className="bg-white border-slate-200 focus-visible:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="roadKerbDistance" className="text-sm font-medium text-slate-700">
                      Distance from Road Kerb
                    </Label>
                    <Input
                      id="roadKerbDistance"
                      value={siteVisitData.roadKerbDistance}
                      onChange={(e) => setSiteVisitData(prev => ({ ...prev, roadKerbDistance: e.target.value }))}
                      placeholder="Distance in meters"
                      className="bg-white border-slate-200 focus-visible:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { id: "humanObstruction", label: "Human Obstruction" },
                    { id: "vehicleObstruction", label: "Vehicle Obstruction" },
                    { id: "visibilityObstruction", label: "Visibility Obstruction" },
                    { id: "vacant", label: "Vacant/Available" },
                  ].map((field) => (
                    <div key={field.id} className="space-y-2">
                      <Label htmlFor={field.id} className="text-sm font-medium text-slate-700">
                        {field.label}
                      </Label>
                      <Select
                        value={siteVisitData[field.id as keyof SiteVisitData] as string}
                        onValueChange={(value) => setSiteVisitData(prev => ({ ...prev, [field.id]: value }))}
                      >
                        <SelectTrigger className="bg-white border-slate-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>

                <Separator className="bg-slate-100" />

                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Officer Information</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="reportingOfficer" className="text-sm font-medium text-slate-700">
                      Reporting Officer Name
                    </Label>
                    <Input
                      id="reportingOfficer"
                      value={siteVisitData.reportingOfficer}
                      onChange={(e) => setSiteVisitData(prev => ({ ...prev, reportingOfficer: e.target.value }))}
                      className="bg-white border-slate-200 focus-visible:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reportingOfficerRank" className="text-sm font-medium text-slate-700">
                      Reporting Officer Rank
                    </Label>
                    <Input
                      id="reportingOfficerRank"
                      value={siteVisitData.reportingOfficerRank}
                      onChange={(e) => setSiteVisitData(prev => ({ ...prev, reportingOfficerRank: e.target.value }))}
                      className="bg-white border-slate-200 focus-visible:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="headOfSection" className="text-sm font-medium text-slate-700">
                      Head of Section/Team Leader
                    </Label>
                    <Input
                      id="headOfSection"
                      value={siteVisitData.headOfSection}
                      onChange={(e) => setSiteVisitData(prev => ({ ...prev, headOfSection: e.target.value }))}
                      className="bg-white border-slate-200 focus-visible:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="headOfSectionRank" className="text-sm font-medium text-slate-700">
                      Head of Section Rank
                    </Label>
                    <Input
                      id="headOfSectionRank"
                      value={siteVisitData.headOfSectionRank}
                      onChange={(e) => setSiteVisitData(prev => ({ ...prev, headOfSectionRank: e.target.value }))}
                      className="bg-white border-slate-200 focus-visible:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="comments" className="text-sm font-medium text-slate-700">
                    Site Visit Comments & Recommendations
                  </Label>
                  <Textarea
                    id="comments"
                    value={siteVisitData.comments}
                    onChange={(e) => setSiteVisitData(prev => ({ ...prev, comments: e.target.value }))}
                    placeholder="Detailed observations, recommendations, and technical notes..."
                    className="bg-white border-slate-200 focus-visible:ring-blue-500 min-h-[100px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="commend" className="text-sm font-medium text-slate-700">
                    Final Commendation
                  </Label>
                  <Textarea
                    id="commend"
                    value={siteVisitData.commend}
                    onChange={(e) => setSiteVisitData(prev => ({ ...prev, commend: e.target.value }))}
                    placeholder="Overall assessment and approval recommendation..."
                    className="bg-white border-slate-200 focus-visible:ring-blue-500 min-h-[80px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="additionalComment" className="text-sm font-medium text-slate-700">
                    Additional Comments (Internal)
                  </Label>
                  <Textarea
                    id="additionalComment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Internal notes, follow-up actions required..."
                    className="bg-amber-50 border-amber-200 focus-visible:ring-amber-500 min-h-[80px]"
                  />
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="px-6 py-4 border-t bg-slate-50/50 gap-2">
            <Button variant="outline" onClick={handleClose} className="border-slate-300">
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitSiteVisit} 
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Submit Site Visit Report
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b bg-slate-50/50">
            <DialogTitle className="text-xl font-semibold text-slate-900">
              Application Details
            </DialogTitle>
            <DialogDescription>
              {selectedSubmission?.applicantName} • {selectedSubmission?.submissionId}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[calc(90vh-140px)] px-6 py-4">
            {selectedSubmission && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-500">Applicant Name</p>
                    <p className="text-sm font-semibold text-slate-900">{selectedSubmission.applicantName}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-500">Application Type</p>
                    <p className="text-sm font-semibold text-slate-900">{selectedSubmission.applicationType}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-500">Contact Phone</p>
                    <p className="text-sm font-semibold text-slate-900">{selectedSubmission.contactPhoneNumber}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-500">Email</p>
                    <p className="text-sm font-semibold text-slate-900">{selectedSubmission.email}</p>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <p className="text-sm font-medium text-slate-500">GPS Coordinates</p>
                    <p className="text-sm font-semibold text-slate-900 font-mono">{selectedSubmission.gpsCoordinates}</p>
                  </div>
                </div>

                {selectedSubmission.businessDevelopmentReport && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 mb-3">Site Visit Report</h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="bg-slate-50 p-3 rounded-lg">
                          <p className="text-slate-500 text-xs">Location</p>
                          <p className="font-medium text-slate-900">{selectedSubmission.businessDevelopmentReport.location}</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg">
                          <p className="text-slate-500 text-xs">Dimensions</p>
                          <p className="font-medium text-slate-900">
                            {selectedSubmission.businessDevelopmentReport.length}m × {selectedSubmission.businessDevelopmentReport.width}m
                          </p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg">
                          <p className="text-slate-500 text-xs">Reporting Officer</p>
                          <p className="font-medium text-slate-900">{selectedSubmission.businessDevelopmentReport.reportingOfficer}</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg">
                          <p className="text-slate-500 text-xs">Visit Date</p>
                          <p className="font-medium text-slate-900">
                            {selectedSubmission.businessDevelopmentReport.visitDate || "Not recorded"}
                          </p>
                        </div>
                      </div>
                      
                      {selectedSubmission.businessDevelopmentReport.sitePhotos && (
                        <div className="mt-4">
                          <p className="text-sm font-medium text-slate-700 mb-2">Site Photos</p>
                          <div className="grid grid-cols-3 gap-2">
                            {selectedSubmission.businessDevelopmentReport.sitePhotos.map((url: string, idx: number) => (
                              <div key={idx} className="aspect-square rounded-lg overflow-hidden border border-slate-200">
                                <img src={url} alt={`Site ${idx + 1}`} className="w-full h-full object-cover" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {selectedSubmission.files && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 mb-3">Uploaded Documents</h4>
                      <div className="space-y-2">
                        {Object.entries(selectedSubmission.files).map(([key, url]) => (
                          url && key !== 'sitePhotos' && (
                            <div key={key} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                              <div className="flex items-center gap-3">
                                <FileText className="h-5 w-5 text-blue-600" />
                                <span className="text-sm font-medium text-slate-700 capitalize">
                                  {key.replace(/([A-Z])/g, ' $1').trim()}
                                </span>
                              </div>
                              <Button variant="ghost" size="sm" className="gap-2" onClick={() => window.open(url, '_blank')}>
                                <Download className="h-4 w-4" />
                                View
                              </Button>
                            </div>
                          )
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </ScrollArea>
          
          <DialogFooter className="px-6 py-4 border-t">
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Photo Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Photo</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this site photo? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPhotoToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePhoto} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}