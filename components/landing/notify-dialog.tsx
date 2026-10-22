"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { Check, Loader2, Mail, Phone, ShieldCheck, X } from "lucide-react"
import { db } from "@/lib/firebase"
import { addDoc, collection, serverTimestamp } from "firebase/firestore"
import { CONTACT, type NotifyIntent } from "./content"

export type { NotifyIntent }

/* ------------------------------------------------------------------ */
/* Online submission is not open yet — every service CTA collects an   */
/* email address instead of routing to a form that cannot be filed.    */
/* ------------------------------------------------------------------ */

const COPY: Record<NotifyIntent, { eyebrow: string; title: string; body: string; cta: string }> = {
  practitioner: {
    eyebrow: "Practitioner registration",
    title: "Get the eligibility checklist",
    body: "New outdoor advertising practitioners provide a financial-capacity bond and professional association support or credentials. Leave your email and the Customer Service Unit will send the approved checklist and tell you when online registration opens.",
    cta: "Send me the checklist",
  },
  revalidation: {
    eyebrow: "Practitioner revalidation",
    title: "Hear about your licence first",
    body: "Successful practitioners are notified in writing before the ₦1,000,000 certification fee is paid through Remita. Leave your email to receive revalidation notices and the successful-list publication as soon as they are issued.",
    cta: "Notify me",
  },
  site: {
    eyebrow: "Sites & structures",
    title: "Online site filing is being prepared",
    body: "Site applications, approval revalidation, Setting Out Certificates and exemption requests are currently handled at the Customer Service Unit. Leave your email and we will write to you when online filing opens and when the stop-work order changes.",
    cta: "Notify me when it opens",
  },
  "first-party": {
    eyebrow: "First-party signage",
    title: "Signage on your own premises",
    body: "Leave your email and the Customer Service Unit will send the first-party requirements and write to you when online registration opens. You can also regularise your signage in person at the CSU in Jahi today.",
    cta: "Send me the requirements",
  },
  telecom: {
    eyebrow: "Telecom sites",
    title: "Telecom site documentation",
    body: "The Telecom Team handles site documentation, inventory and administrative requirements. Leave your email to receive the current requirements and any updates to them.",
    cta: "Send me the requirements",
  },
  billing: {
    eyebrow: "Billing & reconciliation",
    title: "Query a bill or verify a payment",
    body: "Leave your email and Accounts will contact you. Have your bill number, site reference, the amount in question and your supporting evidence ready. Never pay an individual — only against an official DOAS bill.",
    cta: "Ask Accounts to contact me",
  },
  report: {
    eyebrow: "Safety & integrity",
    title: "Report a structure or an improper demand",
    body: `Send the exact location, a photograph and any visible advertiser details to ${CONTACT.email}, or call ${CONTACT.phones[0].display}. Leave your email here and an officer will follow up with you directly.`,
    cta: "Ask an officer to contact me",
  },
  meeting: {
    eyebrow: "Office of the Overseeing Director",
    title: "Request a meeting",
    body: "Complex sites, large-format structures and policy questions are handled by the Office of the Overseeing Director. Leave your email and the Customer Service Unit will contact you to schedule an appointment in Jahi.",
    cta: "Request a callback",
  },
  status: {
    eyebrow: "Permit verification",
    title: "Online verification is coming",
    body: "A verified site register is being built so anyone can check a structure's approved status. Until then, quote your reference number to the Customer Service Unit — or leave your email and we will write to you the day online verification opens.",
    cta: "Notify me when it opens",
  },
  general: {
    eyebrow: "DOAS notices",
    title: "Official notices by email",
    body: "Stop-work updates, revalidation windows, fee circulars and removal notices, sent the day they are issued. Official notices only.",
    cta: "Get notices",
  },
}

/** Fire from anywhere: openNotify("site") */
export function openNotify(intent: NotifyIntent = "general") {
  window.dispatchEvent(new CustomEvent<NotifyIntent>("doas:notify", { detail: intent }))
}

export function NotifyDialog() {
  const [intent, setIntent] = useState<NotifyIntent | null>(null)
  const [email, setEmail] = useState("")
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle")
  const inputRef = useRef<HTMLInputElement>(null)

  const open = intent !== null
  const copy = COPY[intent ?? "general"]

  useEffect(() => {
    const onNotify = (e: Event) => {
      setIntent((e as CustomEvent<NotifyIntent>).detail ?? "general")
      setState("idle")
    }
    window.addEventListener("doas:notify", onNotify)
    return () => window.removeEventListener("doas:notify", onNotify)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setIntent(null)
    window.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    const t = window.setTimeout(() => inputRef.current?.focus(), 260)
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
      window.clearTimeout(t)
    }
  }, [open])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setState("error")
    setState("busy")
    try {
      await addDoc(collection(db, "permitInterest"), {
        email: email.trim().toLowerCase(),
        intent,
        source: "landing-dialog",
        createdAt: serverTimestamp(),
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      })
      try {
        localStorage.setItem("doas.leads", String(Number(localStorage.getItem("doas.leads") || 0) + 1))
      } catch {}
      setState("done")
      setEmail("")
    } catch {
      setState("error")
    }
  }

  return (
    <div className={`fixed inset-0 z-[90] transition ${open ? "pointer-events-auto" : "pointer-events-none"}`} aria-hidden={!open}>
      {/* scrim */}
      <div
        onClick={() => setIntent(null)}
        className={`absolute inset-0 bg-ink/70 backdrop-blur-sm transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
      />

      <div className="pointer-events-none absolute inset-0 grid place-items-end overflow-y-auto p-0 sm:place-items-center sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={copy.title}
          className={[
            "relative w-full overflow-hidden rounded-t-[1.75rem] bg-card hairline sm:max-w-lg sm:rounded-[1.75rem]",
            "shadow-[0_-20px_60px_-30px_hsl(101_50%_4%/0.6)] sm:shadow-[0_40px_90px_-40px_hsl(101_50%_4%/0.7)]",
            "transition-all duration-[420ms] ease-out",
            open ? "pointer-events-auto translate-y-0 opacity-100 sm:scale-100" : "translate-y-8 opacity-0 sm:scale-95",
          ].join(" ")}
        >
          {/* gold seal bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-gold via-sky to-primary" aria-hidden />

          <button
            onClick={() => setIntent(null)}
            aria-label="Close"
            className="absolute right-4 top-5 grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-[18px] w-[18px]" />
          </button>

          <div className="px-6 pb-7 pt-7 sm:px-8 sm:pb-8">
            {state === "done" ? (
              <div className="pop py-6 text-center">
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gold/25">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-gold text-ink">
                    <Check className="h-6 w-6" strokeWidth={3} />
                  </span>
                </span>
                <h2 className="mt-5 font-display text-2xl font-semibold tracking-tight">Thank you — you are on the list.</h2>
                <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-muted-foreground">
                  Your email has been recorded safely. DOAS will write to you directly. Nothing else is required from you today.
                </p>
                <button
                  onClick={() => setIntent(null)}
                  className="mt-7 inline-flex h-12 items-center justify-center rounded-xl bg-ink px-7 text-[15px] font-semibold text-ink-foreground transition-transform active:scale-[0.98]"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <p className="inline-flex items-center gap-2 pr-10 text-[11.5px] font-semibold uppercase tracking-[0.18em] text-primary">
                  <span className="h-px w-6 bg-gold" />
                  {copy.eyebrow}
                </p>
                <h2 className="mt-3 text-balance font-display text-[26px] font-semibold leading-[1.12] tracking-tight sm:text-[30px]">
                  {copy.title}
                </h2>
                <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{copy.body}</p>

                <form onSubmit={submit} className="mt-6">
                  <label htmlFor="notify-email" className="sr-only">
                    Email address
                  </label>
                  <div className="flex flex-col gap-2.5">
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
                      <input
                        ref={inputRef}
                        id="notify-email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value)
                          if (state === "error") setState("idle")
                        }}
                        placeholder="you@company.ng"
                        className="h-14 w-full rounded-xl bg-background pl-11 pr-4 text-[15px] outline-none hairline transition focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={state === "busy"}
                      className="sheen inline-flex h-14 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-ink px-6 text-[15px] font-semibold text-ink-foreground transition-transform active:scale-[0.98] disabled:opacity-60"
                    >
                      {state === "busy" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {state === "busy" ? "Saving…" : copy.cta}
                    </button>
                  </div>
                  <p
                    className={`mt-3 flex items-start gap-2 text-[12.5px] leading-relaxed ${
                      state === "error" ? "text-destructive" : "text-muted-foreground"
                    }`}
                  >
                    {state === "error" ? null : <ShieldCheck className="mt-px h-4 w-4 shrink-0 text-[hsl(var(--state-clear))]" />}
                    {state === "error"
                      ? "Please enter a valid email address and try again."
                      : "Held by DOAS for official correspondence only. No marketing, and no fee is ever requested by email."}
                  </p>
                </form>

                <div className="mt-6 rounded-xl bg-secondary/70 p-4 text-[13px] text-secondary-foreground">
                  <p className="font-medium">Need it today? Visit the Customer Service Unit.</p>
                  <p className="mt-0.5 text-muted-foreground">
                    {CONTACT.landmark}, {CONTACT.addressShort}
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1">
                    {CONTACT.phones.map((p) => (
                      <a key={p.tel} href={`tel:${p.tel}`} className="inline-flex items-center gap-1.5 font-semibold text-primary tnum hover:underline">
                        <Phone className="h-3.5 w-3.5" /> {p.display}
                      </a>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
