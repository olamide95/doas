// app/submissions/meeting-request/page.tsx
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
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { v4 as uuidv4 } from "uuid"
import { Calendar, User, Mail, Phone, Building, FileText } from "lucide-react"
import { db } from "@/lib/firebase"
import { collection, addDoc, serverTimestamp } from "firebase/firestore"

const storage = getStorage()

const formSchema = z.object({
  fullName: z.string().min(2, { message: "Full name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  phoneNumber: z.string().min(10, { message: "Please enter a valid phone number." }),
  organization: z.string().optional(),
  purpose: z.string().min(10, { message: "Purpose must be at least 10 characters." }),
  preferredDate: z.string().min(1, { message: "Please select a preferred date." }),
  preferredTime: z.string().min(1, { message: "Please select a preferred time." }),
  urgency: z.string().min(1, { message: "Please select an urgency level." }),
  supportingDocument: z.any().optional(),
})

export default function MeetingRequestForm() {
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [supportingDocument, setSupportingDocument] = useState<File | null>(null)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phoneNumber: "",
      organization: "",
      purpose: "",
      preferredDate: "",
      preferredTime: "",
      urgency: "medium",
      supportingDocument: undefined,
    },
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSupportingDocument(e.target.files[0])
    }
  }

  const uploadFileToStorage = async (file: File) => {
    if (!file) return null;
    
    const filePath = `meeting-requests/${uuidv4()}_${file.name}`;
    const storageRef = ref(storage, filePath);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setIsSubmitting(true)

      // Generate a unique request ID
      const requestId = `MR-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`

      // Upload supporting document if provided
      let documentUrl = null
      if (supportingDocument) {
        documentUrl = await uploadFileToStorage(supportingDocument)
      }

      // Create meeting request in Firestore - REMOVE the supportingDocument field
      const { supportingDocument: _, ...valuesWithoutDocument } = values; // Remove the file object from values

      const docRef = await addDoc(collection(db, "meetingRequests"), {
        ...valuesWithoutDocument, // Spread the filtered values
        requestId,
        status: "Pending",
        department: "CSU",
        title: `Meeting Request - ${values.fullName}`,
        description: values.purpose,
        supportingDocumentUrl: documentUrl || null, // Store only the URL, not the file object
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Create notification for CSU staff in Firestore
      await addDoc(collection(db, "notifications"), {
        userId: "csu_department",
        content: `New meeting request from ${values.fullName}`,
        type: "info",
        referenceId: docRef.id,
        isRead: false,
        createdAt: serverTimestamp(),
      });

      toast({
        title: "Request Submitted Successfully",
        description: "Your meeting request has been submitted and will be reviewed by our Customer Service Unit.",
      })

      // Reset form and file state
      setSupportingDocument(null)
      form.reset()

      // Redirect to success page with the request ID
      router.push(`/submission-success?id=${requestId}`)
    } catch (error) {
      console.error("Error submitting meeting request:", error)
      toast({
        title: "Submission Failed",
        description: "There was an error submitting your meeting request. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 py-8">
      <div className="container mx-auto px-4">
        <Card className="max-w-2xl mx-auto shadow-2xl border-0">
          <CardHeader className="bg-gradient-to-r from-purple-600 to-purple-800 text-white rounded-t-lg">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl">Request a Meeting with the Director</CardTitle>
                <CardDescription className="text-purple-100">
                  Fill out this form to request a meeting with the Director
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Full Name *
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="Enter your full name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          Email Address *
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="Enter your email" type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          Phone Number *
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="Enter your phone number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="organization"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Building className="h-4 w-4" />
                          Organization (Optional)
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="Enter your organization" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="purpose"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purpose of Meeting *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Please describe the purpose of your meeting request in detail..."
                          className="min-h-[120px] resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Please provide as much detail as possible to help us understand your requirements.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FormField
                    control={form.control}
                    name="preferredDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Preferred Date *
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="date" 
                            {...field} 
                            min={new Date().toISOString().split("T")[0]}
                            className="w-full"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="preferredTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preferred Time *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select time" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="9:00 AM">9:00 AM</SelectItem>
                            <SelectItem value="10:00 AM">10:00 AM</SelectItem>
                            <SelectItem value="11:00 AM">11:00 AM</SelectItem>
                            <SelectItem value="12:00 PM">12:00 PM</SelectItem>
                            <SelectItem value="2:00 PM">2:00 PM</SelectItem>
                            <SelectItem value="3:00 PM">3:00 PM</SelectItem>
                            <SelectItem value="4:00 PM">4:00 PM</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="urgency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Urgency Level *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select urgency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="supportingDocument"
                  render={({ field: { value, onChange, ...fieldProps } }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Supporting Document (Optional)
                      </FormLabel>
                      <FormControl>
                        <Input
                          id="supportingDocument"
                          type="file"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setSupportingDocument(e.target.files[0])
                            }
                          }}
                          className="mt-1"
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          {...fieldProps}
                        />
                      </FormControl>
                      {supportingDocument && (
                        <p className="text-sm text-green-600 mt-1">Selected: {supportingDocument.name}</p>
                      )}
                      <FormDescription>
                        Upload any relevant document to support your meeting request (max 10MB).
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full bg-purple-600 hover:bg-purple-700 py-6 text-lg font-semibold" 
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Submitting Request...
                    </>
                  ) : (
                    "Submit Meeting Request"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="bg-slate-50 border-t px-6 py-4">
            <p className="text-sm text-slate-600">
              <span className="font-medium">Note:</span> Your request will be reviewed by our Customer Service Unit. 
              You will receive a confirmation email with your request ID and further instructions.
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}