// app/submission-status/page.tsx
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle, XCircle, Clock, AlertCircle, Search, Home, FileText, Upload, DollarSign } from "lucide-react"
import Link from "next/link"
import { initializeApp } from "firebase/app"
import { getFirestore, collection, query, where, getDocs, updateDoc, doc, arrayUnion, addDoc } from "firebase/firestore"
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { v4 as uuidv4 } from "uuid"

import { db } from "@/lib/firebase"

// Initialize Firebase

const storage = getStorage()
export default function SubmissionStatus() {
  const router = useRouter()
  const [submissionId, setSubmissionId] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [submission, setSubmission] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploadingPayment, setUploadingPayment] = useState(false)
  const [paymentFile, setPaymentFile] = useState<File | null>(null)

  const checkStatus = async () => {
    if (!submissionId.trim()) {
      setError("Please enter a submission ID")
      return
    }

    setIsLoading(true)
    setError(null)
    setSubmission(null)

    try {
      // Check in submissions collection
      const q = query(
        collection(db, "submissions"), 
        where("submissionId", "==", submissionId.trim())
      )
      
      const querySnapshot = await getDocs(q)
      
      if (querySnapshot.empty) {
        // Check in specific collections
        const collections = ["firstPartySubmissions", "thirdPartySubmissions", "meetingRequests"]
        let foundSubmission = null
        let collectionName = ""

        for (const coll of collections) {
          const collQuery = query(collection(db, coll), where("submissionId", "==", submissionId.trim()))
          const collSnapshot = await getDocs(collQuery)
          if (!collSnapshot.empty) {
            foundSubmission = collSnapshot.docs[0].data()
            foundSubmission.id = collSnapshot.docs[0].id
            foundSubmission.collection = coll
            collectionName = coll
            break
          }
        }

        if (!foundSubmission) {
          setError("No submission found with this ID. Please check your submission ID and try again.")
        } else {
          setSubmission(foundSubmission)
        }
      } else {
        const submissionData = querySnapshot.docs[0].data()
        setSubmission({
          ...submissionData,
          id: querySnapshot.docs[0].id,
          collection: "submissions"
        })
      }
    } catch (err) {
      console.error("Error fetching submission:", err)
      setError("Failed to fetch submission status. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handlePaymentUpload = async () => {
    if (!paymentFile || !submission) return

    try {
      setUploadingPayment(true)

      // Upload payment proof
      const filePath = `payments/${submission.submissionId}/${uuidv4()}_${paymentFile.name}`
      const storageRef = ref(storage, filePath)
      await uploadBytes(storageRef, paymentFile)
      const downloadURL = await getDownloadURL(storageRef)

      // Update submission
      const submissionRef = doc(db, submission.collection, submission.id)
      const now = new Date().toISOString()

      await updateDoc(submissionRef, {
        paymentProof: downloadURL,
        paymentStatus: "Paid",
        status: "Payment Verified",
        department: "Director",
        comments: arrayUnion({
          text: "Payment proof uploaded by applicant",
          timestamp: now,
          action: "Payment submitted",
        }),
        updatedAt: now,
      })

      // Log activity
      await addDoc(collection(db, "activityLogs"), {
        submissionId: submission.id,
        action: "Payment proof uploaded",
        timestamp: now,
        userId: "applicant",
      })

      // Create notification for Director
      await addDoc(collection(db, "notifications"), {
        userId: "director",
        content: `Payment proof uploaded for ${submission.applicantName}`,
        type: "info",
        referenceId: submission.id,
        isRead: false,
        createdAt: now,
      })

      // Refresh submission data
      checkStatus()
      setPaymentFile(null)
      
      alert("Payment proof uploaded successfully!")
    } catch (err) {
      console.error("Error uploading payment:", err)
      alert("Failed to upload payment proof. Please try again.")
    } finally {
      setUploadingPayment(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusLower = status.toLowerCase()
    
    switch (statusLower) {
      case "approved":
      case "completed":
        return (
          <Badge className="bg-green-500 text-white">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        )
      case "rejected":
      case "denied":
        return (
          <Badge className="bg-red-500 text-white">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        )
      case "pending":
      case "under review":
        return (
          <Badge className="bg-yellow-500 text-white">
            <Clock className="h-3 w-3 mr-1" />
            Pending Review
          </Badge>
        )
      case "payment pending":
        return (
          <Badge className="bg-orange-500 text-white">
            <DollarSign className="h-3 w-3 mr-1" />
            Payment Pending
          </Badge>
        )
      case "payment verified":
        return (
          <Badge className="bg-blue-500 text-white">
            <CheckCircle className="h-3 w-3 mr-1" />
            Payment Verified
          </Badge>
        )
      default:
        return <Badge className="bg-gray-500">{status}</Badge>
    }
  }

  const getStatusMessage = (status: string, type: string) => {
    const statusLower = status.toLowerCase()
    
    if (statusLower === "payment pending") {
      return "Your invoice has been generated. Please make payment and upload proof below."
    }
    
    if (type === "meeting") {
      switch (statusLower) {
        case "approved":
        case "completed":
          return "Your meeting request has been approved. You will receive a confirmation email with meeting details."
        case "rejected":
        case "denied":
          return "Your meeting request has been declined. Please contact our office for more information."
        case "pending":
        case "under review":
          return "Your meeting request is currently under review by our Customer Service Unit."
        default:
          return "Your request is being processed."
      }
    } else {
      switch (statusLower) {
        case "approved":
        case "completed":
          return "Your application has been approved. Please check your email for further instructions and permit details."
        case "rejected":
        case "denied":
          return "Your application has been rejected. Please contact our office for more information or submit a new application."
        case "pending":
        case "under review":
          return "Your application is currently under review. Please check back later for updates."
        default:
          return "Your application is being processed."
      }
    }
  }

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase()
    
    switch (statusLower) {
      case "approved":
      case "completed":
        return "bg-green-50 text-green-700 border-green-200"
      case "rejected":
      case "denied":
        return "bg-red-50 text-red-700 border-red-200"
      case "pending":
      case "under review":
        return "bg-yellow-50 text-yellow-700 border-yellow-200"
      case "payment pending":
        return "bg-orange-50 text-orange-700 border-orange-200"
      case "payment verified":
        return "bg-blue-50 text-blue-700 border-blue-200"
      default:
        return "bg-gray-50 text-gray-700 border-gray-200"
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-8">
      <div className="container mx-auto px-4">
        <Card className="max-w-2xl mx-auto shadow-2xl border-0">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-t-lg">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Search className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl">Check Submission Status</CardTitle>
                <CardDescription className="text-blue-100">
                  Enter your submission ID to track the status of your application
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-4">
              <Label htmlFor="submissionId" className="text-lg font-medium">
                Submission ID
              </Label>
              <div className="flex gap-3">
                <Input
                  id="submissionId"
                  value={submissionId}
                  onChange={(e) => setSubmissionId(e.target.value)}
                  placeholder="Enter your submission ID"
                  className="flex-1 text-lg py-6"
                  onKeyPress={(e) => e.key === 'Enter' && checkStatus()}
                />
                <Button 
                  onClick={checkStatus} 
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-700 py-6 px-8"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-5 w-5" />
                      Check Status
                    </>
                  )}
                </Button>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                <div>
                  <p className="font-medium">Error</p>
                  <p>{error}</p>
                </div>
              </div>
            )}

            {submission && (
              <div className="space-y-6">
                <div className={`p-6 rounded-lg border-2 ${getStatusColor(submission.status)}`}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold mb-2">Application Details</h3>
                      <p className="text-lg font-semibold">{submission.applicantName}</p>
                      {submission.companyName && (
                        <p className="text-sm text-slate-600">{submission.companyName}</p>
                      )}
                    </div>
                    {getStatusBadge(submission.status)}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Submission ID</p>
                      <p className="font-mono font-bold">{submission.submissionId}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-600">Application Type</p>
                      <p className="font-medium">{submission.applicationType}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-600">Current Department</p>
                      <p className="font-medium">{submission.department}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-600">Status</p>
                      <p className="font-medium">{submission.status}</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-white/50">
                    <p className="font-medium">
                      {getStatusMessage(submission.status, submission.type)}
                    </p>
                  </div>

                  {submission.billing && (
                    <div className="mt-4 p-4 bg-white rounded-lg border">
                      <h4 className="font-bold mb-2">Billing Information</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Application Fee:</span>
                          <span className="font-bold">₦{submission.billing.applicationFee?.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Processing Fee:</span>
                          <span className="font-bold">₦{submission.billing.processingFee?.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Annual Fee:</span>
                          <span className="font-bold">₦{submission.billing.annualFee?.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between border-t pt-2">
                          <span className="font-bold">Total:</span>
                          <span className="font-bold text-lg">₦{submission.billing.totalAmount?.toLocaleString()}</span>
                        </div>
                        {submission.billing.invoiceNumber && (
                          <div className="text-sm text-slate-600">
                            Invoice: {submission.billing.invoiceNumber}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Payment Upload Section */}
                {submission.status === "Payment Pending" && (
                  <div className="p-6 bg-orange-50 rounded-lg border-2 border-orange-200">
                    <h4 className="text-lg font-bold mb-4">Upload Payment Proof</h4>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="paymentProof" className="mb-2 block">
                          Upload proof of payment (PDF, JPG, PNG)
                        </Label>
                        <Input
                          id="paymentProof"
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => setPaymentFile(e.target.files?.[0] || null)}
                          className="mb-2"
                        />
                        {paymentFile && (
                          <p className="text-sm text-green-600">Selected: {paymentFile.name}</p>
                        )}
                      </div>
                      <Button
                        onClick={handlePaymentUpload}
                        disabled={!paymentFile || uploadingPayment}
                        className="w-full"
                      >
                        {uploadingPayment ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            Upload Payment Proof
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Next Steps */}
                <div className="bg-slate-50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">Next Steps</h4>
                  <ul className="text-sm text-slate-700 space-y-1">
                    <li>• Keep your submission ID safe for future reference</li>
                    <li>• Check back regularly for status updates</li>
                    <li>• Contact our office if you have any questions</li>
                    <li>• You will receive email notifications for important updates</li>
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="bg-slate-50 border-t px-6 py-4 flex justify-between">
            <Button variant="outline" asChild>
              <Link href="/">
                <Home className="mr-2 h-4 w-4" />
                Return to Home
              </Link>
            </Button>
            {submission && (
              <Button asChild>
                <Link href={`/submissions/${submission.isFirstParty ? 'first-party' : 'third-party'}?id=${submission.submissionId}`}>
                  <FileText className="mr-2 h-4 w-4" />
                  Update Application
                </Link>
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}