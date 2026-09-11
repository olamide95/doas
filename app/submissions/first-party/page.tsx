import { Suspense } from "react"
import { ApplicationForm, FIRST_PARTY_STEPS } from "@/components/public/application-form"

export default function FirstPartySubmissionPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <ApplicationForm
        route="first"
        steps={FIRST_PARTY_STEPS}
        title="Apply for a signage permit"
        intro="For property owners applying for signage on their own premises. Customer Service checks your application first, then it goes to the Director for a decision."
      />
    </Suspense>
  )
}