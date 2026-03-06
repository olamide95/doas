// app/submission-success/page.tsx
"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, Copy, Download, Home, FileSearch } from "lucide-react"
import Link from "next/link"

export default function SubmissionSuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const submissionId = searchParams.get("id")
  const [countdown, setCountdown] = useState(10)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    // Redirect to homepage after 10 seconds
    const timer = setTimeout(() => {
      router.push("/")
    }, 10000)

    // Update countdown every second
    const countdownInterval = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)

    return () => {
      clearTimeout(timer)
      clearInterval(countdownInterval)
    }
  }, [router])

  const copyToClipboard = async () => {
    if (submissionId) {
      await navigator.clipboard.writeText(submissionId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const downloadSubmissionId = () => {
    const element = document.createElement("a")
    const file = new Blob([`DOAS Submission ID: ${submissionId}\n\nPlease keep this ID safe for tracking your application status.`], { type: 'text/plain' })
    element.href = URL.createObjectURL(file)
    element.download = `DOAS-Submission-${submissionId}.txt`
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 py-8 flex items-center justify-center">
      <Card className="max-w-md w-full mx-4 shadow-2xl border-0">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-4">
            <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>
          </div>
          <CardTitle className="text-2xl text-green-800">Submission Successful!</CardTitle>
          <CardDescription className="text-green-600 text-lg mt-2">
            Your application has been submitted successfully
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <p className="font-medium text-center text-green-800 mb-3">Your Submission ID</p>
            <div className="flex items-center justify-between bg-white p-3 rounded border border-green-300">
              <code className="text-lg font-bold text-green-700 break-all">{submissionId}</code>
              <Button
                variant="outline"
                size="sm"
                onClick={copyToClipboard}
                className="ml-2 border-green-300 hover:bg-green-50"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            {copied && (
              <p className="text-sm text-green-600 text-center mt-2">Copied to clipboard!</p>
            )}
            <p className="text-sm text-green-700 text-center mt-3">
              Please save this ID for future reference. You will need it to track your application status.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={downloadSubmissionId}
              className="flex-1 border-green-300 text-green-700 hover:bg-green-50"
            >
              <Download className="h-4 w-4 mr-2" />
              Download ID
            </Button>
            <Link href="/status" className="flex-1">
              <Button className="w-full bg-green-600 hover:bg-green-700">
                <FileSearch className="h-4 w-4 mr-2" />
                Track Status
              </Button>
            </Link>
          </div>

          <div className="text-center text-sm text-green-600 bg-green-50 p-3 rounded-lg">
            <p>You will be redirected to the homepage in</p>
            <p className="text-lg font-bold text-green-700">{countdown} seconds</p>
          </div>
        </CardContent>
        <CardFooter>
          <Link href="/" className="w-full">
            <Button variant="outline" className="w-full border-green-300 text-green-700 hover:bg-green-50">
              <Home className="h-4 w-4 mr-2" />
              Return to Homepage
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}