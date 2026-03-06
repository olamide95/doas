"use client"

import { useState, useEffect } from "react"
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, doc, updateDoc } from "firebase/firestore"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { db, storage } from "@/lib/firebase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Upload,
  MapPin,
  FileText,
  Loader2,
  Eye,
  User,
  Phone,
  Mail,
  Building,
  Hash,
  Calendar,
  Shield,
  Download,
  CheckCircle,
  XCircle,
  AlertCircle,
  Search,
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form"
import { format } from "date-fns"

// ── Validation schema ──────────────────────────────────────────────────────
const formSchema = z.object({
  // Personal Info
  name: z.string().min(2, "Full name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phoneNumber: z.string().min(10, "Enter a valid phone number"),
  alternatePhoneNumber: z.string().optional(),

  // Professional Info
  licenseNumber: z.string().min(1, "License number is required"),
  licenseCategory: z.string().min(1, "Please select a license category"),
  licenseExpiryDate: z.string().min(1, "License expiry date is required"),
  practiceArea: z.string().min(1, "Please select a practice area"),
  yearsOfExperience: z.string().min(1, "Years of experience is required"),
  registrationNumber: z.string().optional(),

  // Company/Firm Info
  firmName: z.string().min(2, "Firm/Company name must be at least 2 characters"),
  firmAddress: z.string().min(5, "Firm address must be at least 5 characters"),
  firmRegistrationNumber: z.string().optional(),

  // Location Info
  coordinates: z
    .string()
    .regex(
      /^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/,
      "Invalid format. Use 'latitude, longitude' e.g. 9.0765, 7.3986"
    ),
  address: z.string().min(5, "Address must be at least 5 characters"),

  // Additional
  description: z.string().optional(),
  status: z.string().default("active"),
  files: z.custom<FileList>().optional(),
})

type Practitioner = {
  id: string
  name: string
  email: string
  phoneNumber: string
  alternatePhoneNumber?: string
  licenseNumber: string
  licenseCategory: string
  licenseExpiryDate: string
  practiceArea: string
  yearsOfExperience: string
  registrationNumber?: string
  firmName: string
  firmAddress: string
  firmRegistrationNumber?: string
  coordinates: string
  address: string
  description?: string
  status: string
  documents?: { url: string; name: string; type: string; size: number }[]
  timestamp: any
}

// ── Helpers ────────────────────────────────────────────────────────────────
const safeDate = (value: any): Date | null => {
  if (!value) return null
  if (typeof value.toDate === "function") return value.toDate()
  if (typeof value === "string" || typeof value === "number") return new Date(value)
  if (value instanceof Date) return value
  return null
}

const statusConfig: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  active: { label: "Active", className: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: CheckCircle },
  suspended: { label: "Suspended", className: "bg-red-100 text-red-800 border-red-200", icon: XCircle },
  pending: { label: "Pending Review", className: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: AlertCircle },
  expired: { label: "License Expired", className: "bg-gray-100 text-gray-800 border-gray-200", icon: AlertCircle },
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function PractitionerUploadPanel() {
  const { toast } = useToast()
  const [isUploading, setIsUploading] = useState(false)
  const [practitioners, setPractitioners] = useState<Practitioner[]>([])
  const [loadingPractitioners, setLoadingPractitioners] = useState(true)
  const [viewPractitioner, setViewPractitioner] = useState<Practitioner | null>(null)
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [activeTab, setActiveTab] = useState("upload")

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      phoneNumber: "",
      alternatePhoneNumber: "",
      licenseNumber: "",
      licenseCategory: "",
      licenseExpiryDate: "",
      practiceArea: "",
      yearsOfExperience: "",
      registrationNumber: "",
      firmName: "",
      firmAddress: "",
      firmRegistrationNumber: "",
      coordinates: "",
      address: "",
      description: "",
      status: "active",
      files: undefined,
    },
  })

  // ── Firestore listener ─────────────────────────────────────────────────
  useEffect(() => {
    setLoadingPractitioners(true)
    const q = query(collection(db, "practitioners"), orderBy("timestamp", "desc"))
    const unsub = onSnapshot(q, (snap) => {
      const data: Practitioner[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
      setPractitioners(data)
      setLoadingPractitioners(false)
    })
    return () => unsub()
  }, [])

  // ── Upload handler ──────────────────────────────────────────────────────
  const handleUpload = async (values: any) => {
    setIsUploading(true)
    try {
      let fileUrls: any[] = []
      if (values.files && values.files.length > 0) {
        fileUrls = await Promise.all(
          Array.from(values.files).map(async (file: any) => {
            const storageRef = ref(storage, `practitioners/${values.licenseNumber}/${file.name}`)
            await uploadBytes(storageRef, file)
            return {
              url: await getDownloadURL(storageRef),
              name: file.name,
              type: file.type,
              size: file.size,
            }
          })
        )
      }

      await addDoc(collection(db, "practitioners"), {
        name: values.name,
        email: values.email,
        phoneNumber: values.phoneNumber,
        alternatePhoneNumber: values.alternatePhoneNumber || "",
        licenseNumber: values.licenseNumber,
        licenseCategory: values.licenseCategory,
        licenseExpiryDate: values.licenseExpiryDate,
        practiceArea: values.practiceArea,
        yearsOfExperience: values.yearsOfExperience,
        registrationNumber: values.registrationNumber || "",
        firmName: values.firmName,
        firmAddress: values.firmAddress,
        firmRegistrationNumber: values.firmRegistrationNumber || "",
        coordinates: values.coordinates,
        address: values.address,
        description: values.description || "",
        status: values.status || "active",
        documents: fileUrls,
        timestamp: serverTimestamp(),
      })

      toast({ title: "Practitioner Registered", description: `${values.name} has been successfully registered.` })
      form.reset()
      setActiveTab("view")
    } catch (error) {
      console.error(error)
      toast({ title: "Error", description: "Failed to register practitioner.", variant: "destructive" })
    } finally {
      setIsUploading(false)
    }
  }

  // ── Status update ───────────────────────────────────────────────────────
  const handleStatusUpdate = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, "practitioners", id), { status: newStatus, updatedAt: new Date() })
      toast({ title: "Status Updated", description: `Practitioner status updated to ${newStatus}.` })
      if (viewPractitioner?.id === id) {
        setViewPractitioner((prev) => (prev ? { ...prev, status: newStatus } : null))
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update status.", variant: "destructive" })
    }
  }

  // ── Filtered list ───────────────────────────────────────────────────────
  const filtered = practitioners.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.licenseNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.firmName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchStatus = filterStatus === "all" || p.status === filterStatus
    return matchSearch && matchStatus
  })

  // ── Status badge ────────────────────────────────────────────────────────
  const StatusBadge = ({ status }: { status: string }) => {
    const cfg = statusConfig[status] || statusConfig.pending
    const Icon = cfg.icon
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${cfg.className}`}>
        <Icon className="h-3 w-3" />
        {cfg.label}
      </span>
    )
  }

  // ── View Dialog ─────────────────────────────────────────────────────────
  const ViewDialog = () => {
    if (!viewPractitioner) return null
    const p = viewPractitioner
    const dateAdded = safeDate(p.timestamp)

    return (
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="sm:max-w-[720px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                <User className="h-5 w-5 text-indigo-600" />
              </div>
              {p.name}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              <StatusBadge status={p.status} />
              <span className="text-muted-foreground">·</span>
              <span className="font-mono text-xs">{p.licenseNumber}</span>
              {dateAdded && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span>Added {format(dateAdded, "MMM dd, yyyy")}</span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-2">
            <div className="space-y-6 py-2">

              {/* Contact */}
              <section>
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 pb-1 border-b">
                  Contact Information
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <InfoRow icon={Mail} label="Email" value={p.email} />
                  <InfoRow icon={Phone} label="Phone" value={p.phoneNumber} />
                  {p.alternatePhoneNumber && (
                    <InfoRow icon={Phone} label="Alternate Phone" value={p.alternatePhoneNumber} />
                  )}
                  <InfoRow icon={MapPin} label="Address" value={p.address} />
                </div>
              </section>

              {/* License */}
              <section>
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 pb-1 border-b">
                  License & Professional Details
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <InfoRow icon={Hash} label="License Number" value={p.licenseNumber} mono />
                  <InfoRow icon={Shield} label="License Category" value={p.licenseCategory} />
                  <InfoRow icon={Calendar} label="License Expiry" value={p.licenseExpiryDate} />
                  <InfoRow icon={Building} label="Practice Area" value={p.practiceArea} />
                  <InfoRow icon={User} label="Experience" value={`${p.yearsOfExperience} years`} />
                  {p.registrationNumber && (
                    <InfoRow icon={Hash} label="Registration No." value={p.registrationNumber} mono />
                  )}
                </div>
              </section>

              {/* Firm */}
              <section>
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 pb-1 border-b">
                  Firm / Company Details
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <InfoRow icon={Building} label="Firm Name" value={p.firmName} />
                  <InfoRow icon={MapPin} label="Firm Address" value={p.firmAddress} />
                  {p.firmRegistrationNumber && (
                    <InfoRow icon={Hash} label="Firm Reg. No." value={p.firmRegistrationNumber} mono />
                  )}
                  <InfoRow icon={MapPin} label="GPS Coordinates" value={p.coordinates} mono />
                </div>
              </section>

              {/* Description */}
              {p.description && (
                <section>
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 pb-1 border-b">
                    Additional Notes
                  </h4>
                  <p className="text-sm text-muted-foreground bg-muted/40 rounded-lg p-3">{p.description}</p>
                </section>
              )}

              {/* Documents */}
              {p.documents && p.documents.length > 0 && (
                <section>
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 pb-1 border-b">
                    Documents ({p.documents.length})
                  </h4>
                  <div className="space-y-2">
                    {p.documents.map((doc, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{doc.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(doc.size / 1024 / 1024).toFixed(2)} MB · {doc.type}
                            </p>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => window.open(doc.url, "_blank")}>
                          <Download className="h-4 w-4 mr-1" /> Download
                        </Button>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-4 border-t">
            <div className="flex gap-2 mr-auto">
              <Select
                value={p.status}
                onValueChange={(val) => handleStatusUpdate(p.id, val)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Update Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="pending">Pending Review</SelectItem>
                  <SelectItem value="expired">License Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={() => setIsViewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-[calc(100vh-12rem)]">
        <TabsList className="mb-4">
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" /> Register Practitioner
          </TabsTrigger>
          <TabsTrigger value="view" className="flex items-center gap-2">
            <Eye className="h-4 w-4" /> View Practitioners
            {practitioners.length > 0 && (
              <Badge variant="secondary" className="ml-1">{practitioners.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── UPLOAD TAB ─────────────────────────────────────────────────── */}
        <TabsContent value="upload" className="h-full">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <User className="h-4 w-4 text-indigo-600" />
                </div>
                Register Practitioner
              </CardTitle>
              <CardDescription>
                Add a practitioner with all required professional and contact details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[calc(100vh-22rem)]">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleUpload)} className="space-y-8 pr-4">

                    {/* Personal Information */}
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 pb-2 border-b flex items-center gap-2">
                        <User className="h-4 w-4" /> Personal Information
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={form.control} name="name" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Name *</FormLabel>
                            <FormControl><Input placeholder="Enter practitioner's full name" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="email" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email Address *</FormLabel>
                            <FormControl><Input type="email" placeholder="practitioner@example.com" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="phoneNumber" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone Number *</FormLabel>
                            <FormControl><Input placeholder="+234 800 000 0000" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="alternatePhoneNumber" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Alternate Phone (Optional)</FormLabel>
                            <FormControl><Input placeholder="+234 800 000 0000" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                    </div>

                    {/* Professional Details */}
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 pb-2 border-b flex items-center gap-2">
                        <Shield className="h-4 w-4" /> Professional & License Details
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={form.control} name="licenseNumber" render={({ field }) => (
                          <FormItem>
                            <FormLabel>License Number *</FormLabel>
                            <FormControl><Input placeholder="e.g. DOAS-2024-001" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="licenseCategory" render={({ field }) => (
                          <FormItem>
                            <FormLabel>License Category *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Class A - Large Format">Class A – Large Format</SelectItem>
                                <SelectItem value="Class B - Medium Format">Class B – Medium Format</SelectItem>
                                <SelectItem value="Class C - Small Format">Class C – Small Format</SelectItem>
                                <SelectItem value="Class D - Digital Signage">Class D – Digital Signage</SelectItem>
                                <SelectItem value="Class E - Specialist">Class E – Specialist</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="licenseExpiryDate" render={({ field }) => (
                          <FormItem>
                            <FormLabel>License Expiry Date *</FormLabel>
                            <FormControl><Input type="date" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="practiceArea" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Practice Area *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger><SelectValue placeholder="Select practice area" /></SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Outdoor Advertising">Outdoor Advertising</SelectItem>
                                <SelectItem value="Signage Design">Signage Design</SelectItem>
                                <SelectItem value="Structural Engineering">Structural Engineering</SelectItem>
                                <SelectItem value="Environmental Consulting">Environmental Consulting</SelectItem>
                                <SelectItem value="Urban Planning">Urban Planning</SelectItem>
                                <SelectItem value="General Advertising">General Advertising</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="yearsOfExperience" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Years of Experience *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger><SelectValue placeholder="Select experience" /></SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="1-2">1–2 years</SelectItem>
                                <SelectItem value="3-5">3–5 years</SelectItem>
                                <SelectItem value="6-10">6–10 years</SelectItem>
                                <SelectItem value="11-15">11–15 years</SelectItem>
                                <SelectItem value="16+">16+ years</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="registrationNumber" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Professional Registration No. (Optional)</FormLabel>
                            <FormControl><Input placeholder="e.g. NIA-2024-0012" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="status" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Initial Status *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="pending">Pending Review</SelectItem>
                                <SelectItem value="suspended">Suspended</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                    </div>

                    {/* Firm Details */}
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 pb-2 border-b flex items-center gap-2">
                        <Building className="h-4 w-4" /> Firm / Company Details
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={form.control} name="firmName" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Firm / Company Name *</FormLabel>
                            <FormControl><Input placeholder="Enter firm name" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="firmRegistrationNumber" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Firm Registration No. (Optional)</FormLabel>
                            <FormControl><Input placeholder="e.g. RC-123456" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="firmAddress" render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>Firm Address *</FormLabel>
                            <FormControl><Textarea placeholder="Enter firm's full address" rows={2} {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                    </div>

                    {/* Location */}
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 pb-2 border-b flex items-center gap-2">
                        <MapPin className="h-4 w-4" /> Location Information
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={form.control} name="coordinates" render={({ field }) => (
                          <FormItem>
                            <FormLabel>GPS Coordinates *</FormLabel>
                            <FormControl><Input placeholder="e.g. 9.0765, 7.3986" {...field} /></FormControl>
                            <FormDescription>Format: latitude, longitude</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="address" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Physical Address *</FormLabel>
                            <FormControl><Input placeholder="Street, Area, City" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                    </div>

                    {/* Notes & Documents */}
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 pb-2 border-b flex items-center gap-2">
                        <FileText className="h-4 w-4" /> Additional Notes & Documents
                      </h3>
                      <div className="space-y-6">
                        <FormField control={form.control} name="description" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Additional Notes (Optional)</FormLabel>
                            <FormControl>
                              <Textarea placeholder="Any additional information about this practitioner..." rows={3} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />

                        <FormField
                          control={form.control}
                          name="files"
                          render={({ field: { value, onChange, ...rest } }) => (
                            <FormItem>
                              <FormLabel>Upload Documents (License, Certificates, etc.)</FormLabel>
                              <FormControl>
                                <>
                                  <div className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-8 text-center hover:border-primary/50 hover:bg-muted/30 transition-colors">
                                    <Input
                                      type="file"
                                      multiple
                                      onChange={(e) => onChange(e.target.files)}
                                      className="hidden"
                                      id="practitioner-docs"
                                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                      {...rest}
                                    />
                                    <Label htmlFor="practitioner-docs" className="cursor-pointer flex flex-col items-center gap-2">
                                      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                                        <Upload className="h-6 w-6 text-muted-foreground" />
                                      </div>
                                      <span className="text-sm font-medium">Click to upload documents</span>
                                      <span className="text-xs text-muted-foreground">PDF, DOC, DOCX, JPG, PNG — max 10MB each</span>
                                    </Label>
                                  </div>
                                  {value && value.length > 0 && (
                                    <div className="mt-3 space-y-2">
                                      {Array.from(value).map((file: any, i) => (
                                        <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-sm">
                                          <FileText className="h-4 w-4 text-primary" />
                                          <span className="font-medium">{file.name}</span>
                                          <span className="text-muted-foreground ml-auto">
                                            {(file.size / 1024 / 1024).toFixed(2)} MB
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <Button type="submit" className="w-full h-12 text-base font-medium" disabled={isUploading}>
                      {isUploading ? (
                        <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Registering Practitioner...</>
                      ) : (
                        <><Upload className="mr-2 h-5 w-5" /> Register Practitioner</>
                      )}
                    </Button>
                  </form>
                </Form>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── VIEW TAB ────────────────────────────────────────────────────── */}
        <TabsContent value="view" className="h-full">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Registered Practitioners</CardTitle>
                  <CardDescription>
                    {practitioners.length} practitioner{practitioners.length !== 1 ? "s" : ""} registered
                  </CardDescription>
                </div>
                <div className="flex gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search practitioners..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 w-64"
                    />
                  </div>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Filter status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[calc(100vh-22rem)]">
                {loadingPractitioners ? (
                  <div className="flex items-center justify-center h-40">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <User className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No practitioners found</p>
                    <p className="text-sm">Try adjusting your search or filter</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Practitioner</TableHead>
                        <TableHead>License</TableHead>
                        <TableHead>Firm</TableHead>
                        <TableHead>Practice Area</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Documents</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((p) => {
                        const added = safeDate(p.timestamp)
                        return (
                          <TableRow key={p.id} className="hover:bg-muted/30">
                            <TableCell>
                              <div className="font-medium">{p.name}</div>
                              <div className="text-xs text-muted-foreground">{p.email}</div>
                              <div className="text-xs text-muted-foreground">{p.phoneNumber}</div>
                            </TableCell>
                            <TableCell>
                              <div className="font-mono text-sm">{p.licenseNumber}</div>
                              <div className="text-xs text-muted-foreground">{p.licenseCategory}</div>
                              {p.licenseExpiryDate && (
                                <div className="text-xs text-muted-foreground">
                                  Exp: {p.licenseExpiryDate}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm font-medium">{p.firmName}</div>
                              <div className="text-xs text-muted-foreground line-clamp-1">{p.firmAddress}</div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">{p.practiceArea}</div>
                              <div className="text-xs text-muted-foreground">{p.yearsOfExperience} yrs exp.</div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-sm">
                                <MapPin className="h-3 w-3 text-muted-foreground" />
                                <span className="line-clamp-1 max-w-[120px]">{p.address}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-sm">
                                <FileText className="h-3 w-3 text-muted-foreground" />
                                {p.documents?.length || 0} file{(p.documents?.length || 0) !== 1 ? "s" : ""}
                              </div>
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={p.status} />
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setViewPractitioner(p); setIsViewOpen(true) }}
                                className="flex items-center gap-1"
                              >
                                <Eye className="h-4 w-4" /> View
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ViewDialog />
    </>
  )
}

// ── Helper sub-component ───────────────────────────────────────────────────
function InfoRow({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon: React.ElementType
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        <Icon className="h-3 w-3" /> {label}
      </span>
      <span className={`text-sm font-medium ${mono ? "font-mono" : ""}`}>{value || "—"}</span>
    </div>
  )
}