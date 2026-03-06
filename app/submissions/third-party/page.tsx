// app/submissions/third-party/page.tsx
"use client"

import type React from "react"
import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { collection, addDoc, serverTimestamp, doc, updateDoc, query, where, getDocs } from "firebase/firestore"
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { v4 as uuidv4 } from "uuid"
import { Building, User, FileText, MapPin, Briefcase, ChevronRight, ChevronLeft, Lock } from "lucide-react"

import { db } from "@/lib/firebase"

const storage = getStorage()

const formSchema = z.object({
  applicantName: z.string().min(2, { message: "Applicant name must be at least 2 characters." }),
  contactPhoneNumber: z.string().min(10, { message: "Please enter a valid phone number." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  addressLine1: z.string().min(5, { message: "Address must be at least 5 characters." }),
  addressLine2: z.string().optional(),
  companyName: z.string().min(2, { message: "Company name must be at least 2 characters." }),
  companyAddress: z.string().min(5, { message: "Company address must be at least 5 characters." }),
  companyRegistrationNumber: z.string().min(1, { message: "Registration number is required." }),
  purposeOfApplication: z.string().min(1, { message: "Please select a purpose." }),
  applicationType: z.string().min(1, { message: "Please select an application type." }),
  gpsCoordinates: z.string().min(1, { message: "GPS coordinates are required." }),
  structureDuration: z.string().min(1, { message: "Please select a duration." }),
  numberOfSigns: z.string().min(1, { message: "Please enter the number of signs." }),
  typeOfSign: z.string().min(1, { message: "Please select a sign type." }),
  signDimensions: z.string().min(1, { message: "Please enter the sign dimensions." }),
  structuralHeight: z.string().min(1, { message: "Please enter the structural height." }),
  practitionerName: z.string().min(2, { message: "Practitioner name must be at least 2 characters." }).optional(),
  practitionerLicenseNumber: z.string().min(1, { message: "License number is required." }).optional(),
})

// ── Inner component that uses useSearchParams ──────────────────────────────
function ThirdPartyForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const submissionId = searchParams.get("id")
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState("applicant-info")
  const [files, setFiles] = useState<Record<string, File | null>>({
    eiaReport: null,
    soilTestReport: null,
    proofOfPayment: null,
    structuralEngineeringDrawings: null,
    practitionerLicense: null,
    companyRegistration: null,
  })
  const [existingSubmission, setExistingSubmission] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      applicantName: "",
      contactPhoneNumber: "",
      email: "",
      addressLine1: "",
      addressLine2: "",
      companyName: "",
      companyAddress: "",
      companyRegistrationNumber: "",
      purposeOfApplication: "",
      applicationType: "",
      gpsCoordinates: "",
      structureDuration: "",
      numberOfSigns: "",
      typeOfSign: "",
      signDimensions: "",
      structuralHeight: "",
      practitionerName: "",
      practitionerLicenseNumber: "",
    },
  })

  useEffect(() => {
    if (submissionId) {
      fetchExistingSubmission()
    }
  }, [submissionId])

  const fetchExistingSubmission = async () => {
    try {
      setIsLoading(true)
      const q = query(collection(db, "thirdPartySubmissions"), where("submissionId", "==", submissionId))
      const querySnapshot = await getDocs(q)

      if (!querySnapshot.empty) {
        const data = querySnapshot.docs[0].data()
        setExistingSubmission({ id: querySnapshot.docs[0].id, ...data })

        form.reset({
          applicantName: data.applicantName || "",
          contactPhoneNumber: data.contactPhoneNumber || "",
          email: data.email || "",
          addressLine1: data.addressLine1 || "",
          addressLine2: data.addressLine2 || "",
          companyName: data.companyName || "",
          companyAddress: data.companyAddress || "",
          companyRegistrationNumber: data.companyRegistrationNumber || "",
          purposeOfApplication: data.purposeOfApplication || "",
          applicationType: data.applicationType || "",
          gpsCoordinates: data.gpsCoordinates || "",
          structureDuration: data.structureDuration || "",
          numberOfSigns: data.numberOfSigns || "",
          typeOfSign: data.typeOfSign || "",
          signDimensions: data.signDimensions || "",
          structuralHeight: data.structuralHeight || "",
          practitionerName: data.practitionerName || "",
          practitionerLicenseNumber: data.practitionerLicenseNumber || "",
        })

        if (data.status === "Pending") {
          setActiveTab("applicant-info")
        } else if (data.status === "Site Visit Completed") {
          setActiveTab("practitioner-info")
        } else if (data.status === "Documents Submitted") {
          setActiveTab("documents")
        }
      }
    } catch (error) {
      console.error("Error fetching submission:", error)
      toast({
        title: "Error",
        description: "Failed to load submission data.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fileType: string) => {
    if (e.target.files && e.target.files[0]) {
      setFiles({ ...files, [fileType]: e.target.files[0] })
    }
  }

  const uploadFileToStorage = async (file: File, path: string) => {
    if (!file) return null
    const filePath = `${path}/${uuidv4()}_${file.name}`
    const storageRef = ref(storage, filePath)
    await uploadBytes(storageRef, file)
    return getDownloadURL(storageRef)
  }

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setIsSubmitting(true)

      let submissionIdToUse = submissionId
      if (!submissionId) {
        submissionIdToUse = `TP-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`
      }

      let status = "Pending"
      let nextDepartment = "CSU"
      if (activeTab === "practitioner-info") {
        status = "Practitioner Info Submitted"
        nextDepartment = "Director"
      } else if (activeTab === "documents") {
        status = "Documents Submitted"
        nextDepartment = "Director"
      }

      const fileUploads = await Promise.all([
        files.eiaReport ? uploadFileToStorage(files.eiaReport, `submissions/${submissionIdToUse}/eia`) : null,
        files.soilTestReport ? uploadFileToStorage(files.soilTestReport, `submissions/${submissionIdToUse}/soil`) : null,
        files.proofOfPayment ? uploadFileToStorage(files.proofOfPayment, `submissions/${submissionIdToUse}/payment`) : null,
        files.structuralEngineeringDrawings ? uploadFileToStorage(files.structuralEngineeringDrawings, `submissions/${submissionIdToUse}/drawings`) : null,
        files.practitionerLicense ? uploadFileToStorage(files.practitionerLicense, `submissions/${submissionIdToUse}/license`) : null,
        files.companyRegistration ? uploadFileToStorage(files.companyRegistration, `submissions/${submissionIdToUse}/registration`) : null,
      ])

      const [eiaUrl, soilUrl, paymentUrl, drawingsUrl, licenseUrl, registrationUrl] = fileUploads

      const submissionData = {
        ...values,
        submissionId: submissionIdToUse,
        status,
        isFirstParty: false,
        department: nextDepartment,
        priority: "medium",
        title: `Third-Party Application - ${values.applicantName} (${values.companyName})`,
        description: `Application for ${values.applicationType} - ${values.purposeOfApplication}`,
        files: {
          eiaReport: eiaUrl,
          soilTestReport: soilUrl,
          proofOfPayment: paymentUrl,
          structuralEngineeringDrawings: drawingsUrl,
          practitionerLicense: licenseUrl,
          companyRegistration: registrationUrl,
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        currentStep:
          activeTab === "applicant-info" ? 1
          : activeTab === "signage-details" ? 2
          : activeTab === "company-info" ? 3
          : activeTab === "practitioner-info" ? 4
          : 5,
      }

      if (existingSubmission) {
        const submissionRef = doc(db, "thirdPartySubmissions", existingSubmission.id)
        await updateDoc(submissionRef, submissionData)
      } else {
        await addDoc(collection(db, "thirdPartySubmissions"), submissionData)
      }

      await addDoc(collection(db, "notifications"), {
        userId: nextDepartment === "CSU" ? "csu_department" : "director_office",
        content: `New third-party application from ${values.applicantName}`,
        type: "info",
        referenceId: submissionIdToUse,
        isRead: false,
        createdAt: serverTimestamp(),
      })

      toast({
        title: "Submission Successful",
        description: `Your application has been submitted successfully. Your submission ID is: ${submissionIdToUse}`,
      })

      router.push(`/submission-success?id=${submissionIdToUse}`)
    } catch (error) {
      console.error("Error submitting form:", error)
      toast({
        title: "Submission Failed",
        description: `There was an error submitting your application: ${error instanceof Error ? error.message : "Please try again."}`,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const nextTab = () => {
    if (activeTab === "applicant-info") setActiveTab("signage-details")
    else if (activeTab === "signage-details") setActiveTab("company-info")
    else if (activeTab === "company-info") {
      if (!existingSubmission || existingSubmission.status === "Site Visit Completed") {
        setActiveTab("practitioner-info")
      } else {
        setActiveTab("documents")
      }
    } else if (activeTab === "practitioner-info") setActiveTab("documents")
  }

  const prevTab = () => {
    if (activeTab === "documents") setActiveTab("practitioner-info")
    else if (activeTab === "practitioner-info") setActiveTab("company-info")
    else if (activeTab === "company-info") setActiveTab("signage-details")
    else if (activeTab === "signage-details") setActiveTab("applicant-info")
  }

  const isTabLocked = (tabName: string) => {
    if (!existingSubmission) {
      return tabName === "practitioner-info" || tabName === "documents"
    }
    if (existingSubmission.status === "Pending" || existingSubmission.status === "Under Review") {
      return tabName === "practitioner-info" || tabName === "documents"
    }
    return false
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-green-50 py-8">
      <div className="container mx-auto px-4">
        <Card className="max-w-4xl mx-auto shadow-2xl border-0">
          <CardHeader className="bg-gradient-to-r from-green-600 to-green-800 text-white rounded-t-lg">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Briefcase className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl">Third-Party Signage Application</CardTitle>
                <CardDescription className="text-green-100">
                  {submissionId ? `Updating Submission: ${submissionId}` : "Submit your application through a registered practitioner"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            {isLoading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-5 mb-8">
                      <TabsTrigger value="applicant-info" className="flex items-center gap-2">
                        <User className="h-4 w-4" />Applicant
                      </TabsTrigger>
                      <TabsTrigger value="signage-details" className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />Signage
                      </TabsTrigger>
                      <TabsTrigger value="company-info" className="flex items-center gap-2">
                        <Building className="h-4 w-4" />Company
                      </TabsTrigger>
                      <TabsTrigger value="practitioner-info" className="flex items-center gap-2" disabled={isTabLocked("practitioner-info")}>
                        {isTabLocked("practitioner-info") && <Lock className="h-3 w-3" />}
                        <Briefcase className="h-4 w-4" />Practitioner
                      </TabsTrigger>
                      <TabsTrigger value="documents" className="flex items-center gap-2" disabled={isTabLocked("documents")}>
                        {isTabLocked("documents") && <Lock className="h-3 w-3" />}
                        <FileText className="h-4 w-4" />Documents
                      </TabsTrigger>
                    </TabsList>

                    {/* ── Applicant Info ── */}
                    <TabsContent value="applicant-info" className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={form.control} name="applicantName" render={({ field }) => (
                          <FormItem><FormLabel>Applicant Name *</FormLabel><FormControl><Input placeholder="Enter full name" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="contactPhoneNumber" render={({ field }) => (
                          <FormItem><FormLabel>Contact Phone Number *</FormLabel><FormControl><Input placeholder="Enter phone number" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="email" render={({ field }) => (
                          <FormItem><FormLabel>Email Address *</FormLabel><FormControl><Input placeholder="Enter email address" type="email" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="addressLine1" render={({ field }) => (
                          <FormItem><FormLabel>Address Line 1 *</FormLabel><FormControl><Input placeholder="Enter address line 1" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="addressLine2" render={({ field }) => (
                          <FormItem className="md:col-span-2"><FormLabel>Address Line 2 (Optional)</FormLabel><FormControl><Input placeholder="Enter address line 2" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                      </div>
                      <div className="flex justify-end pt-4">
                        <Button type="button" onClick={nextTab} className="bg-green-600 hover:bg-green-700">
                          Next: Signage Details <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </TabsContent>

                    {/* ── Signage Details ── */}
                    <TabsContent value="signage-details" className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={form.control} name="purposeOfApplication" render={({ field }) => (
                          <FormItem><FormLabel>Purpose of Application *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Select purpose" /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="New Sign">New Sign</SelectItem>
                                <SelectItem value="Upgrading of Existing Sign">Upgrading of Existing Sign</SelectItem>
                                <SelectItem value="Change of Existing Sign">Change of Existing Sign</SelectItem>
                              </SelectContent>
                            </Select><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="applicationType" render={({ field }) => (
                          <FormItem><FormLabel>Application Type *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Select application type" /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="Billboard">Billboard</SelectItem>
                                <SelectItem value="Gantry">Gantry</SelectItem>
                                <SelectItem value="Unipole">Unipole</SelectItem>
                                <SelectItem value="Wall Drape">Wall Drape</SelectItem>
                                <SelectItem value="Roof Sign">Roof Sign</SelectItem>
                              </SelectContent>
                            </Select><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="gpsCoordinates" render={({ field }) => (
                          <FormItem><FormLabel>GPS Coordinates *</FormLabel><FormControl><Input placeholder="Enter GPS coordinates" {...field} /></FormControl>
                            <FormDescription>Format: Latitude, Longitude (e.g., 9.0765, 7.3986)</FormDescription><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="structureDuration" render={({ field }) => (
                          <FormItem><FormLabel>Structure Duration *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Select duration" /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="Temporary">Temporary</SelectItem>
                                <SelectItem value="Permanent">Permanent</SelectItem>
                              </SelectContent>
                            </Select><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="numberOfSigns" render={({ field }) => (
                          <FormItem><FormLabel>Number of Signs *</FormLabel><FormControl><Input placeholder="Enter number of signs" type="number" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="typeOfSign" render={({ field }) => (
                          <FormItem><FormLabel>Type of Sign *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Select sign type" /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="Static">Static</SelectItem>
                                <SelectItem value="Digital">Digital</SelectItem>
                                <SelectItem value="LED">LED</SelectItem>
                                <SelectItem value="Scrolling">Scrolling</SelectItem>
                              </SelectContent>
                            </Select><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="signDimensions" render={({ field }) => (
                          <FormItem><FormLabel>Sign Dimensions *</FormLabel><FormControl><Input placeholder="Enter dimensions (e.g., 4m x 6m)" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="structuralHeight" render={({ field }) => (
                          <FormItem><FormLabel>Structural Height *</FormLabel><FormControl><Input placeholder="Enter height in meters" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                      </div>
                      <div className="flex justify-between pt-4">
                        <Button type="button" variant="outline" onClick={prevTab}><ChevronLeft className="mr-2 h-4 w-4" />Previous</Button>
                        <Button type="button" onClick={nextTab} className="bg-green-600 hover:bg-green-700">Next: Company Information <ChevronRight className="ml-2 h-4 w-4" /></Button>
                      </div>
                    </TabsContent>

                    {/* ── Company Info ── */}
                    <TabsContent value="company-info" className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={form.control} name="companyName" render={({ field }) => (
                          <FormItem><FormLabel>Company Name *</FormLabel><FormControl><Input placeholder="Enter company name" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="companyRegistrationNumber" render={({ field }) => (
                          <FormItem><FormLabel>Company Registration Number *</FormLabel><FormControl><Input placeholder="Enter registration number" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="companyAddress" render={({ field }) => (
                          <FormItem className="md:col-span-2"><FormLabel>Company Address *</FormLabel><FormControl><Textarea placeholder="Enter company address" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                      </div>
                      <div className="flex justify-between pt-4">
                        <Button type="button" variant="outline" onClick={prevTab}><ChevronLeft className="mr-2 h-4 w-4" />Previous</Button>
                        <Button type="button" onClick={nextTab} className="bg-green-600 hover:bg-green-700">
                          {existingSubmission?.status === "Site Visit Completed" ? "Next: Practitioner Information" : "Submit Initial Application"}
                          <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </TabsContent>

                    {/* ── Practitioner Info ── */}
                    <TabsContent value="practitioner-info" className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={form.control} name="practitionerName" render={({ field }) => (
                          <FormItem><FormLabel>Practitioner Name *</FormLabel><FormControl><Input placeholder="Enter practitioner's full name" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="practitionerLicenseNumber" render={({ field }) => (
                          <FormItem><FormLabel>Practitioner License Number *</FormLabel><FormControl><Input placeholder="Enter license number" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                      </div>
                      <div className="flex justify-between pt-4">
                        <Button type="button" variant="outline" onClick={prevTab}><ChevronLeft className="mr-2 h-4 w-4" />Previous</Button>
                        <Button type="button" onClick={nextTab} className="bg-green-600 hover:bg-green-700">Next: Required Documents <ChevronRight className="ml-2 h-4 w-4" /></Button>
                      </div>
                    </TabsContent>

                    {/* ── Documents ── */}
                    <TabsContent value="documents" className="space-y-6">
                      <div className="grid grid-cols-1 gap-6">
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold text-slate-900">Required Documents</h3>
                          <p className="text-sm text-slate-600">Please upload all required documents. All documents should be in PDF format and not exceed 10MB each.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {[
                            { id: "eiaReport", label: "Environmental Impact Assessment (EIA) Report *", accept: ".pdf,.doc,.docx" },
                            { id: "soilTestReport", label: "Soil Test Report *", accept: ".pdf,.doc,.docx" },
                            { id: "proofOfPayment", label: "Proof of Payment *", accept: ".pdf,.jpg,.jpeg,.png" },
                            { id: "structuralEngineeringDrawings", label: "Structural Engineering Drawings *", accept: ".pdf,.dwg,.dxf" },
                            { id: "practitionerLicense", label: "Practitioner License *", accept: ".pdf,.jpg,.jpeg,.png" },
                            { id: "companyRegistration", label: "Company Registration Certificate *", accept: ".pdf,.jpg,.jpeg,.png" },
                          ].map(({ id, label, accept }) => (
                            <div key={id} className="space-y-2">
                              <Label htmlFor={id} className="text-sm font-medium">{label}</Label>
                              <Input id={id} type="file" accept={accept} onChange={(e) => handleFileChange(e, id)} className="mt-1" />
                              {files[id] && <p className="text-sm text-green-600 mt-1">Selected: {files[id]!.name}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex justify-between pt-4">
                        <Button type="button" variant="outline" onClick={prevTab}><ChevronLeft className="mr-2 h-4 w-4" />Previous</Button>
                        <Button type="submit" disabled={isSubmitting} className="bg-green-600 hover:bg-green-700">
                          {isSubmitting ? (
                            <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>Submitting...</>
                          ) : "Submit Application"}
                        </Button>
                      </div>
                    </TabsContent>
                  </Tabs>
                </form>
              </Form>
            )}
          </CardContent>

          <CardFooter className="bg-slate-50 border-t px-6 py-4">
            <p className="text-sm text-slate-600">
              <span className="font-medium">Note:</span> All fields marked with * are required.
              Your submission ID will be generated upon successful submission.
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

// ── Page export: wraps the form in Suspense to satisfy Next.js ─────────────
export default function ThirdPartySubmissionForm() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-green-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600" />
      </div>
    }>
      <ThirdPartyForm />
    </Suspense>
  )
}