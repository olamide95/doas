"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { addDoc, collection, serverTimestamp } from "firebase/firestore"
import { getDownloadURL, ref, uploadBytes } from "firebase/storage"
import { CalendarClock, Loader2, Paperclip, Send } from "lucide-react"
import { COL, db, storage } from "@/lib/firebase"
import { DEPARTMENT, MEETING_STATUS, meetingRequestId } from "@/lib/workflow"
import { toast } from "@/components/ui/toast"
import {
  ActionButton,
  FieldGrid,
  SelectField,
  TextField,
  TextareaField,
} from "@/components/dashboard/form-kit"
import { Panel } from "@/components/dashboard/kit"

const TIMES = [
  "9:00 AM",
  "10:00 AM",
  "11:00 AM",
  "12:00 PM",
  "2:00 PM",
  "3:00 PM",
  "4:00 PM",
]

const URGENCY = [
  { value: "low", label: "Low — whenever suits" },
  { value: "medium", label: "Medium — within a couple of weeks" },
  { value: "high", label: "High — this week if possible" },
]

const today = () => new Date().toISOString().slice(0, 10)

export function MeetingRequestForm() {
  const router = useRouter()
  const [values, setValues] = React.useState({
    fullName: "",
    email: "",
    phoneNumber: "",
    organization: "",
    purpose: "",
    preferredDate: "",
    preferredTime: "",
    urgency: "medium",
  })
  const [document, setDocument] = React.useState<File | null>(null)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [submitting, setSubmitting] = React.useState(false)

  const set = (name: keyof typeof values, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => {
      if (!prev[name]) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
  }

  const validate = () => {
    const found: Record<string, string> = {}
    if (values.fullName.trim().length < 2) found.fullName = "Tell us who you are"
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.email)) found.email = "Enter a valid email address"
    if (values.phoneNumber.replace(/\D/g, "").length < 10)
      found.phoneNumber = "Enter a valid phone number"
    if (values.purpose.trim().length < 10)
      found.purpose = "Say a little more about what you need to discuss"
    if (!values.preferredDate) found.preferredDate = "Pick a date"
    if (!values.preferredTime) found.preferredTime = "Pick a time"
    setErrors(found)
    return Object.keys(found).length === 0
  }

  const submit = async () => {
    if (!validate()) {
      toast.warning({
        title: "Some fields need attention",
        description: "The highlighted fields have to be filled in before you can send this.",
      })
      return
    }

    setSubmitting(true)
    const requestId = meetingRequestId()

    try {
      let supportingDocumentUrl: string | null = null
      if (document) {
        const path = `meeting-requests/${requestId}/${document.name.replace(/\s+/g, "-")}`
        const target = ref(storage, path)
        await uploadBytes(target, document, { contentType: document.type })
        supportingDocumentUrl = await getDownloadURL(target)
      }

      await addDoc(collection(db, COL.meetings), {
        ...values,
        requestId,
        // Lowercase throughout. The old form wrote "Pending" with a capital P,
        // which matched none of the dashboard filters.
        status: MEETING_STATUS.withCsu,
        department: DEPARTMENT.csu,
        supportingDocumentUrl,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      await addDoc(collection(db, COL.notifications), {
        userId: "csu",
        content: `New meeting request from ${values.fullName}`,
        type: "message",
        referenceId: requestId,
        isRead: false,
        createdAt: new Date().toISOString(),
      })

      toast.success({
        title: "Request sent",
        description: `Keep your reference: ${requestId}`,
        duration: 9000,
      })

      router.push(`/submission-status?id=${requestId}`)
    } catch (err) {
      toast.error({
        title: "Request not sent",
        description: err instanceof Error ? err.message : "Check your connection and try again.",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="mx-auto w-full max-w-2xl px-4">
        <header className="mb-6">
          <h1 className="font-display text-[26px] font-semibold text-foreground sm:text-[30px]">
            Request a meeting with the Director
          </h1>
          <p className="mt-1 max-w-[62ch] text-[13.5px] leading-relaxed text-muted-foreground">
            Customer Service reads every request first and passes on the ones that need the
            Director&rsquo;s time. You&rsquo;ll get a reference to track the decision.
          </p>
        </header>

        <Panel bodyClassName="p-4 sm:p-5">
          <FieldGrid>
            <div>
              <TextField
                id="fullName"
                label="Your name *"
                value={values.fullName}
                onChange={(v) => set("fullName", v)}
              />
              {errors.fullName ? <Err>{errors.fullName}</Err> : null}
            </div>
            <div>
              <TextField
                id="organization"
                label="Organisation"
                value={values.organization}
                placeholder="Leave blank if you're coming as an individual"
                onChange={(v) => set("organization", v)}
              />
            </div>
            <div>
              <TextField
                id="email"
                label="Email *"
                type="email"
                value={values.email}
                onChange={(v) => set("email", v)}
              />
              {errors.email ? <Err>{errors.email}</Err> : null}
            </div>
            <div>
              <TextField
                id="phoneNumber"
                label="Phone *"
                type="tel"
                value={values.phoneNumber}
                placeholder="+234 800 000 0000"
                onChange={(v) => set("phoneNumber", v)}
              />
              {errors.phoneNumber ? <Err>{errors.phoneNumber}</Err> : null}
            </div>
          </FieldGrid>

          <div className="mt-4">
            <TextareaField
              id="purpose"
              label="What do you need to discuss? *"
              value={values.purpose}
              rows={4}
              placeholder="Be specific. Customer Service uses this to decide whether the Director is the right person, or whether another desk can help you faster."
              onChange={(v) => set("purpose", v)}
            />
            {errors.purpose ? <Err>{errors.purpose}</Err> : null}
          </div>

          <div className="mt-4">
            <FieldGrid columns={3}>
              <div>
                <TextField
                  id="preferredDate"
                  label="Preferred date *"
                  type="date"
                  value={values.preferredDate}
                  hint={`Any date from ${today()}`}
                  onChange={(v) => set("preferredDate", v)}
                />
                {errors.preferredDate ? <Err>{errors.preferredDate}</Err> : null}
              </div>
              <div>
                <SelectField
                  id="preferredTime"
                  label="Preferred time *"
                  value={values.preferredTime}
                  onChange={(v) => set("preferredTime", v)}
                  options={TIMES.map((time) => ({ value: time, label: time }))}
                />
                {errors.preferredTime ? <Err>{errors.preferredTime}</Err> : null}
              </div>
              <SelectField
                id="urgency"
                label="How urgent is it?"
                value={values.urgency}
                onChange={(v) => set("urgency", v)}
                options={URGENCY}
              />
            </FieldGrid>
          </div>

          <div className="mt-4 flex flex-col gap-2 rounded-lg border border-border px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[13.5px] font-medium text-foreground">Supporting document</p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                {document ? document.name : "Optional. PDF, Word or image, up to 10 MB."}
              </p>
            </div>
            <label
              htmlFor="supportingDocument"
              className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors hover:bg-muted"
            >
              <Paperclip className="h-3.5 w-3.5" />
              {document ? "Replace" : "Choose file"}
              <input
                id="supportingDocument"
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null
                  if (file && file.size > 10 * 1024 * 1024) {
                    toast.warning({
                      title: "File too large",
                      description: `${file.name} is over 10 MB.`,
                    })
                    return
                  }
                  setDocument(file)
                }}
              />
            </label>
          </div>

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-4">
            <p className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5 shrink-0" />
              A date isn&rsquo;t confirmed until the Director approves it.
            </p>
            <ActionButton icon={submitting ? Loader2 : Send} disabled={submitting} onClick={submit}>
              {submitting ? "Sending…" : "Send request"}
            </ActionButton>
          </div>
        </Panel>
      </div>
    </div>
  )
}

function Err({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1 text-[11.5px] font-medium text-[hsl(var(--state-stop))]">{children}</p>
  )
}
