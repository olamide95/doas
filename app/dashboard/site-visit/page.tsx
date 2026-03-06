// app/admin/site-visit/page.tsx
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { collection, getDocs, query, where, updateDoc, doc, arrayUnion, addDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Search, MapPin, Building, User, CheckCircle, XCircle } from "lucide-react"

const siteVisitSchema = z.object({
  clientName: z.string().min(2, "Client name is required"),
  registrationWithDOAS: z.string().min(1, "Registration status is required"),
  categoryOfApplicant: z.string().min(1, "Category is required"),
  typeOfConcept: z.string().min(1, "Concept type is required"),
  sizeOfBoard: z.string().min(1, "Board size is required"),
  boardLocation: z.string().min(1, "Location is required"),
  gpsCoordinates: z.string().min(1, "GPS coordinates are required"),
  boardToBoardDistance: z.string().min(1, "Distance is required"),
  roadKerb: z.string().min(1, "Road kerb distance is required"),
  fenceBuilding: z.string().min(1, "Fence/building distance is required"),
  humanObstruction: z.enum(["Yes", "No"]),
  vehicularTrafficObstruction: z.enum(["Yes", "No"]),
  visibilityObstruction: z.enum(["Yes", "No"]),
  vacant: z.enum(["Yes", "No"]),
  approvableComments: z.string().min(1, "Comments are required"),
  reportingOfficer: z.string().min(1, "Reporting officer name is required"),
  reportingOfficerRank: z.string().min(1, "Rank is required"),
  headOfSection: z.string().min(1, "Head of section name is required"),
  headOfSectionRank: z.string().min(1, "Rank is required"),
  commend: z.string().optional(),
})

interface Submission {
  id: string
  submissionId: string
  applicantName: string
  companyName: string
  applicationType: string
  gpsCoordinates: string
  status: string
  department: string
}

export default function SiteVisitPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null)
  const [activeTab, setActiveTab] = useState("pending")
  const [searchTerm, setSearchTerm] = useState("")

  const form = useForm<z.infer<typeof siteVisitSchema>>({
    resolver: zodResolver(siteVisitSchema),
    defaultValues: {
      clientName: "",
      registrationWithDOAS: "",
      categoryOfApplicant: "",
      typeOfConcept: "",
      sizeOfBoard: "",
      boardLocation: "",
      gpsCoordinates: "",
      boardToBoardDistance: "",
      roadKerb: "",
      fenceBuilding: "",
      humanObstruction: "No",
      vehicularTrafficObstruction: "No",
      visibilityObstruction: "No",
      vacant: "No",
      approvableComments: "",
      reportingOfficer: "",
      reportingOfficerRank: "",
      headOfSection: "",
      headOfSectionRank: "",
      commend: "",
    },
  })

  useEffect(() => {
    fetchSubmissions()
  }, [activeTab])

  const fetchSubmissions = async () => {
    let statusFilter = activeTab === "pending" ? "Site Visit Required" : "Site Visit Completed"
    const q = query(
      collection(db, "thirdPartySubmissions"),
      where("status", "==", statusFilter),
      where("department", "in", ["Monitoring and Enforcement", "Planning and Development"])
    )
    
    const snapshot = await getDocs(q)
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Submission))
    setSubmissions(data)
  }

  const handleSelectSubmission = (submission: Submission) => {
    setSelectedSubmission(submission)
    form.reset({
      ...form.getValues(),
      clientName: submission.companyName || submission.applicantName,
      gpsCoordinates: submission.gpsCoordinates,
      typeOfConcept: submission.applicationType,
    })
  }

  const onSubmit = async (values: z.infer<typeof siteVisitSchema>) => {
    if (!selectedSubmission) return

    try {
      const submissionRef = doc(db, "thirdPartySubmissions", selectedSubmission.id)
      const now = new Date().toISOString()

      await updateDoc(submissionRef, {
        status: "Site Visit Completed",
        department: "Director",
        siteVisitReport: values,
        comments: arrayUnion({
          text: values.approvableComments,
          timestamp: now,
          action: `Site visit completed by ${values.reportingOfficer}`,
        }),
        updatedAt: now,
      })

      // Log activity
      await addDoc(collection(db, "activityLogs"), {
        submissionId: selectedSubmission.id,
        action: "Site visit completed",
        timestamp: now,
        comment: values.approvableComments,
        userId: "site_visit_officer",
      })

      // Create notification for Director
      await addDoc(collection(db, "notifications"), {
        userId: "director",
        content: `Site visit completed for ${selectedSubmission.applicantName}`,
        type: "info",
        referenceId: selectedSubmission.id,
        isRead: false,
        createdAt: now,
      })

      toast({
        title: "Site Visit Report Submitted",
        description: "The site visit report has been submitted successfully.",
      })

      form.reset()
      setSelectedSubmission(null)
      fetchSubmissions()
    } catch (error) {
      console.error("Error submitting site visit:", error)
      toast({
        title: "Submission Failed",
        description: "There was an error submitting the site visit report.",
        variant: "destructive",
      })
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
          <CardTitle>Site Visit Management</CardTitle>
          <CardDescription>Conduct site visits and submit reports</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex justify-between items-center mb-6">
              <TabsList>
                <TabsTrigger value="pending">Pending Site Visits</TabsTrigger>
                <TabsTrigger value="completed">Completed Visits</TabsTrigger>
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

            <TabsContent value="pending" className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Submission ID</TableHead>
                    <TableHead>Applicant/Company</TableHead>
                    <TableHead>Application Type</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Department</TableHead>
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
                          <Badge variant="outline">{submission.department}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleSelectSubmission(submission)}
                          >
                            Conduct Site Visit
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
                    <TableHead>Site Visit Date</TableHead>
                    <TableHead>Reporting Officer</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubmissions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                        No completed site visits found
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
                        <TableCell>
                          {new Date().toLocaleDateString()}
                        </TableCell>
                        <TableCell>Officer Name</TableCell>
                        <TableCell>
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Completed
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>

          {selectedSubmission && (
            <div className="mt-8">
              <Card>
                <CardHeader>
                  <CardTitle>Site Visit Report</CardTitle>
                  <CardDescription>
                    For submission: {selectedSubmission.submissionId} - {selectedSubmission.applicantName}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={form.control}
                          name="clientName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Name of client/company</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="registrationWithDOAS"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Registration with DOAS</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select registration status" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="Registered">Registered</SelectItem>
                                  <SelectItem value="Not Registered">Not Registered</SelectItem>
                                  <SelectItem value="Pending">Pending</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="categoryOfApplicant"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Category of Applicant</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select category" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="Individual">Individual</SelectItem>
                                  <SelectItem value="Company">Company</SelectItem>
                                  <SelectItem value="Government">Government</SelectItem>
                                  <SelectItem value="NGO">NGO</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="typeOfConcept"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Type of Concept/Request</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="sizeOfBoard"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Size of Board</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., 4m x 6m" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="boardLocation"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Board Location</FormLabel>
                              <FormControl>
                                <Input placeholder="Full street and district description" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="gpsCoordinates"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>GPS Coordinates</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="boardToBoardDistance"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Board to Board Distance (meters)</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="roadKerb"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Road Kerb Distance (meters)</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="fenceBuilding"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Fence/Building Distance (meters)</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="humanObstruction"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Human Obstruction</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="Yes">Yes</SelectItem>
                                  <SelectItem value="No">No</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="vehicularTrafficObstruction"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Vehicular Traffic Obstruction</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="Yes">Yes</SelectItem>
                                  <SelectItem value="No">No</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="visibilityObstruction"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Visibility Obstruction</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="Yes">Yes</SelectItem>
                                  <SelectItem value="No">No</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="vacant"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Vacant</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="Yes">Yes</SelectItem>
                                  <SelectItem value="No">No</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="reportingOfficer"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Name of Reporting Officer</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="reportingOfficerRank"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Rank of Reporting Officer</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="headOfSection"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Head of Section/Team Leader</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="headOfSectionRank"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Rank of Head of Section</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="commend"
                          render={({ field }) => (
                            <FormItem className="md:col-span-2">
                              <FormLabel>Commend</FormLabel>
                              <FormControl>
                                <Textarea {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="approvableComments"
                          render={({ field }) => (
                            <FormItem className="md:col-span-2">
                              <FormLabel>Approvable Comments</FormLabel>
                              <FormControl>
                                <Textarea {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="flex justify-end gap-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setSelectedSubmission(null)}
                        >
                          Cancel
                        </Button>
                        <Button type="submit">
                          Submit Site Visit Report
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}