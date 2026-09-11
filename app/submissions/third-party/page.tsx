import { Suspense } from "react"
import { ApplicationForm, THIRD_PARTY_STEPS } from "@/components/public/application-form"

export default function ThirdPartySubmissionPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <ApplicationForm
        route="third"
        steps={THIRD_PARTY_STEPS}
        title="Apply through a practitioner"
        intro="For licensed practitioners applying on behalf of a client. Customer Service checks the application first, then it goes to the Director, who routes it for inspection and planning review."
      />
    </Suspense>
  )
} 