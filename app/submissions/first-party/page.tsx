// app/submissions/first-party/page.tsx
"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { v4 as uuidv4 } from "uuid"
import { initializeApp } from "firebase/app"
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore"
import { Building, User, FileText, MapPin, ChevronRight, ChevronLeft } from "lucide-react"

// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyA3R15_tAiapTQcKc_6cL8nN_FPoWRDFI0",
  authDomain: "doas-771c4.firebaseapp.com",
  projectId: "doas-771c4",
  storageBucket: "doas-771c4.firebasestorage.app",
  messagingSenderId: "376823252081",
  appId: "1:376823252081:web:871302513d4da5fae107d0",
  measurementId: "G-5RM0N8JG2W"
};

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);
const db = getFirestore(app);

const formSchema = z.object({
  applicantName: z.string().min(2, { message: "Applicant name must be at least 2 characters." }),
  contactPhoneNumber: z.string().min(10, { message: "Please enter a valid phone number." }),
  areaCouncilEmail: z.string().email({ message: "Please enter a valid email address." }),
  addressLine1: z.string().min(5, { message: "Address must be at least 5 characters." }),
  addressLine2: z.string().optional(),
  purposeOfApplication: z.string().min(1, { message: "Please select a purpose." }),
  applicationType: z.string().min(1, { message: "Please select an application type." }),
  gpsCoordinates: z.string().min(1, { message: "GPS coordinates are required." }),
  structureDuration: z.string().min(1, { message: "Please select a duration." }),
  numberOfSigns: z.string().min(1, { message: "Please enter the number of signs." }),
  typeOfSign: z.string().min(1, { message: "Please select a sign type." }),
  signDimensions: z.string().min(1, { message: "Please enter the sign dimensions." }),
  structuralHeight: z.string().min(1, { message: "Please enter the structural height." }),
})

export default function FirstPartySubmissionForm() {
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState("applicant-info")
  const [files, setFiles] = useState<Record<string, File | null>>({
    eiaReport: null,
    soilTestReport: null,
    proofOfPayment: null,
    structuralEngineeringDrawings: null,
  })

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      applicantName: "",
      contactPhoneNumber: "",
      areaCouncilEmail: "",
      addressLine1: "",
      addressLine2: "",
      purposeOfApplication: "",
      applicationType: "",
      gpsCoordinates: "",
      structureDuration: "",
      numberOfSigns: "",
      typeOfSign: "",
      signDimensions: "",
      structuralHeight: "",
    },
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fileType: string) => {
    if (e.target.files && e.target.files[0]) {
      setFiles({
        ...files,
        [fileType]: e.target.files[0],
      })
    }
  }

  const uploadFile = async (file: File, path: string) => {
    if (!file) return null;
    
    const storageRef = ref(storage, `${path}/${file.name}`);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setIsSubmitting(true)

      // Generate a unique submission ID
      const submissionId = `FP-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`
      console.log("Generated submission ID:", submissionId)

      // Upload files to Firebase Storage and get their URLs
      const fileUploads = await Promise.all([
        files.eiaReport ? uploadFile(files.eiaReport, `submissions/${submissionId}/eia`) : null,
        files.soilTestReport ? uploadFile(files.soilTestReport, `submissions/${submissionId}/soil`) : null,
        files.proofOfPayment ? uploadFile(files.proofOfPayment, `submissions/${submissionId}/payment`) : null,
        files.structuralEngineeringDrawings ? uploadFile(files.structuralEngineeringDrawings, `submissions/${submissionId}/drawings`) : null,
      ]);

      const [eiaUrl, soilUrl, paymentUrl, drawingsUrl] = fileUploads;

      // Prepare submission data for Firestore
       const submissionData = {
        ...values,
        submissionId,
        status: "Pending", // Initial status
        isFirstParty: true,
        department: "CSU", // FIRST PARTY goes to CSU first
        priority: "medium",
        title: `First-Party Application - ${values.applicantName}`,
        description: `Application for ${values.applicationType} - ${values.purposeOfApplication}`,
        files: {
          eiaReport: eiaUrl,
          soilTestReport: soilUrl,
          proofOfPayment: paymentUrl,
          structuralEngineeringDrawings: drawingsUrl,
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        // Additional fields that might be needed
        applicationCategory: "First Party",
        processingStage: "Initial Submission",
        lastUpdatedBy: "Applicant",
        paymentStatus: "Pending",
      }

      console.log("Submitting data to Firestore:", submissionData)

      // Add document to Firestore
      const docRef = await addDoc(collection(db, "firstPartySubmissions"), submissionData);
      console.log("Document written with ID: ", docRef.id);

      // Create notification for Director's office
      await addDoc(collection(db, "notifications"), {
        userId: "director_office",
        content: `New first-party application from ${values.applicantName}`,
        type: "info",
        referenceId: docRef.id,
        isRead: false,
        createdAt: serverTimestamp(),
      });

      toast({
        title: "Submission Successful",
        description: "Your application has been submitted successfully. Please save your submission ID for reference.",
      })

      // Redirect to success page with the submission ID
      router.push(`/submission-success?id=${submissionId}`)
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
    else if (activeTab === "signage-details") setActiveTab("documents")
  }

  const prevTab = () => {
    if (activeTab === "documents") setActiveTab("signage-details")
    else if (activeTab === "signage-details") setActiveTab("applicant-info")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-8">
      <div className="container mx-auto px-4">
        <Card className="max-w-4xl mx-auto shadow-2xl border-0">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-t-lg">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                <User className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl">First-Party Signage Application</CardTitle>
                <CardDescription className="text-blue-100">
                  Submit your application directly to the Department of Outdoor Advertising and Signage
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-3 mb-8">
                    <TabsTrigger value="applicant-info" className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Applicant Info
                    </TabsTrigger>
                    <TabsTrigger value="signage-details" className="flex items-center gap-2">
                      <Building className="h-4 w-4" />
                      Signage Details
                    </TabsTrigger>
                    <TabsTrigger value="documents" className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Documents
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="applicant-info" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="applicantName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Applicant Name *</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter full name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="contactPhoneNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contact Phone Number *</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter phone number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="areaCouncilEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email Address *</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter email address" type="email" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="addressLine1"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Address Line 1 *</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter address line 1" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="addressLine2"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>Address Line 2 (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter address line 2" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex justify-end pt-4">
                      <Button type="button" onClick={nextTab} className="bg-blue-600 hover:bg-blue-700">
                        Next: Signage Details
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="signage-details" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="purposeOfApplication"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Purpose of Application *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select purpose" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="New Sign">New Sign</SelectItem>
                                <SelectItem value="Upgrading of Existing Sign">Upgrading of Existing Sign</SelectItem>
                                <SelectItem value="Change of Existing Sign">Change of Existing Sign</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="applicationType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Application Type *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select application type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Billboard">Billboard</SelectItem>
                                <SelectItem value="Gantry">Gantry</SelectItem>
                                <SelectItem value="Unipole">Unipole</SelectItem>
                                <SelectItem value="Wall Drape">Wall Drape</SelectItem>
                                <SelectItem value="Roof Sign">Roof Sign</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="gpsCoordinates"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>GPS Coordinates *</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter GPS coordinates" {...field} />
                            </FormControl>
                            <FormDescription>Format: Latitude, Longitude (e.g., 9.0765, 7.3986)</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="structureDuration"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Structure Duration *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select duration" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Temporary">Temporary</SelectItem>
                                <SelectItem value="Permanent">Permanent</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="numberOfSigns"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Number of Signs *</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter number of signs" type="number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="typeOfSign"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Type of Sign *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select sign type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Static">Static</SelectItem>
                                <SelectItem value="Digital">Digital</SelectItem>
                                <SelectItem value="LED">LED</SelectItem>
                                <SelectItem value="Scrolling">Scrolling</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="signDimensions"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Sign Dimensions *</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter dimensions (e.g., 4m x 6m)" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="structuralHeight"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Structural Height *</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter height in meters" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex justify-between pt-4">
                      <Button type="button" variant="outline" onClick={prevTab}>
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Previous
                      </Button>
                      <Button type="button" onClick={nextTab} className="bg-blue-600 hover:bg-blue-700">
                        Next: Required Documents
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="documents" className="space-y-6">
                    <div className="grid grid-cols-1 gap-6">
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-slate-900">Required Documents</h3>
                        <p className="text-sm text-slate-600">
                          Please upload all required documents. All documents should be in PDF format and not exceed 10MB each.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="eiaReport" className="text-sm font-medium">
                            Environmental Impact Assessment (EIA) Report *
                          </Label>
                          <Input
                            id="eiaReport"
                            type="file"
                            accept=".pdf,.doc,.docx"
                            onChange={(e) => handleFileChange(e, "eiaReport")}
                            className="mt-1"
                          />
                          {files.eiaReport && (
                            <p className="text-sm text-green-600 mt-1">Selected: {files.eiaReport.name}</p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="soilTestReport" className="text-sm font-medium">
                            Soil Test Report *
                          </Label>
                          <Input
                            id="soilTestReport"
                            type="file"
                            accept=".pdf,.doc,.docx"
                            onChange={(e) => handleFileChange(e, "soilTestReport")}
                            className="mt-1"
                          />
                          {files.soilTestReport && (
                            <p className="text-sm text-green-600 mt-1">Selected: {files.soilTestReport.name}</p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="proofOfPayment" className="text-sm font-medium">
                            Proof of Payment *
                          </Label>
                          <Input
                            id="proofOfPayment"
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => handleFileChange(e, "proofOfPayment")}
                            className="mt-1"
                          />
                          {files.proofOfPayment && (
                            <p className="text-sm text-green-600 mt-1">Selected: {files.proofOfPayment.name}</p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="structuralEngineeringDrawings" className="text-sm font-medium">
                            Structural Engineering Drawings *
                          </Label>
                          <Input
                            id="structuralEngineeringDrawings"
                            type="file"
                            accept=".pdf,.dwg,.dxf"
                            onChange={(e) => handleFileChange(e, "structuralEngineeringDrawings")}
                            className="mt-1"
                          />
                          {files.structuralEngineeringDrawings && (
                            <p className="text-sm text-green-600 mt-1">
                              Selected: {files.structuralEngineeringDrawings.name}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between pt-4">
                      <Button type="button" variant="outline" onClick={prevTab}>
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Previous
                      </Button>
                      <Button type="submit" disabled={isSubmitting} className="bg-green-600 hover:bg-green-700">
                        {isSubmitting ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Submitting...
                          </>
                        ) : (
                          "Submit Application"
                        )}
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </form>
            </Form>
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