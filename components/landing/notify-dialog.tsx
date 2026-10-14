"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { Check, Loader2, Mail, ShieldCheck, X } from "lucide-react"
import { db } from "@/lib/firebase"
import { addDoc, collection, serverTimestamp } from "firebase/firestore"

/* ------------------------------------------------------------------ */
/* Intents                                                             */
/* Online submission is not open yet — every permit CTA collects an    */
/* email address instead of routing to a form that cannot be filed.    */
/* ------------------------------------------------------------------ */

export type NotifyIntent =
  | "first-party"
  | "third-party"
  | "mobile"
  | "meeting"
  | "status"
  | "report"
  | "general"

const COPY: Record<NotifyIntent, { eyebrow: string; title: string; body: string; cta: string }> = {
  "first-party": {
    eyebrow: "First-party signage",
    title: "Online registration opens shortly",
    body: "Leave your email and the Customer Service Unit will send you the first-party registration link, the document checklist and the regularization deadline the moment the portal goes live. Walk-in registration continues at the Jahi Head Office.",
    cta: "Notify me when it opens",
  },
  "third-party": {
    eyebrow: "Third-party advertising",
    title: "Practitioner applications — join the list",
    body: "Billboard, LED, hoarding and poster allocations are being migrated online. Leave your email to receive the practitioner application pack and the site allocation schedule as soon as filing opens.",
    cta: "Send me the application pack",
  },
  mobile: {
    eyebrow: "Mobile adverts & haulage",
    title: "Fleet permits — join the list",
    body: "Vehicle branding permits are issued per registration number. Leave your email and we will send the mobile advert permit requirements and fleet schedule template when online filing opens.",
    cta: "Notify me when it opens",
  },
  meeting: {
    eyebrow: "Director's office",
    title: "Request a meeting",
    body: "Complex sites, large-format structures and policy questions are handled directly by the Director's office. Leave your email and the Customer Service Unit will contact you to schedule an appointment at Jahi.",
    cta: "Request a callback",
  },
  status: {
    eyebrow: "Permit verification",
    title: "Online verification is coming",
    body: "File tracking by reference number is being connected to the internal register. For now, call the Customer Service Unit on +234 9 291 9181 — or leave your email and we will write to you the day online verification opens.",
    cta: "Notify me when it opens",
  },
  report: {
    eyebrow: "Monitoring & Enforcement",
    title: "Report an unapproved structure",
    body: "Send the location, a photograph and any visible advertiser details to service@doas.abj.gov.ng, or call +234 9 291 9181. Leave your email here and an Enforcement officer will follow up with you directly.",
    cta: "Ask an officer to contact me",
  },
  general: {
    eyebrow: "DOAS notices",
    title: "Stay compliant with FCTA advertising law",
    body: "Leave your email for regularization notices, guideline updates and demand letter announcements. Official notices only.",
    cta: "Get updates",
  },
}

/** Fire from anywhere: openNotify("first-party") */
export function openNotify(intent: NotifyIntent = "general") {
  window.dispatchEvent(new CustomEvent<NotifyIntent>("doas:notify", { detail: intent }))
}

export function NotifyDialog() {
  const [intent, setIntent] = useState<NotifyIntent | null>(null)
  const [email, setEmail] = useState("")
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle")
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

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
    <div
      className={`fixed inset-0 z-[90] transition ${open ? "pointer-events-auto" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      {/* scrim */}
      <div
        onClick={() => setIntent(null)}
        className={`absolute inset-0 bg-ink/70 backdrop-blur-sm transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
      />

      <div className="absolute inset-0 grid place-items-end sm:place-items-center p-0 sm:p-6 overflow-y-auto">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={copy.title}
          className={[
            "relative w-full sm:max-w-lg bg-card rounded-t-[1.75rem] sm:rounded-[1.75rem] overflow-hidden",
            "shadow-[0_-20px_60px_-30px_hsl(101_50%_4%/0.6)] sm:shadow-plaque hairline",
            "transition-all duration-[420ms] ease-out",
            open ? "translate-y-0 opacity-100 sm:scale-100" : "translate-y-8 opacity-0 sm:scale-95",
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
              <div className="py-6 text-center pop">
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gold/25">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-gold text-ink">
                    <Check className="h-6 w-6" strokeWidth={3} />
                  </span>
                </span>
                <h2 className="mt-5 font-display text-2xl font-semibold tracking-tight">Thank you — you are on the list.</h2>
                <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-muted-foreground">
                  Your email has been recorded safely. DOAS will write to you directly when this service opens. Nothing else is
                  required from you today.
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
                <p className="inline-flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.18em] text-primary">
                  <span className="h-px w-6 bg-gold" />
                  {copy.eyebrow}
                </p>
                <h2 className="mt-3 font-display text-[26px] sm:text-[30px] font-semibold leading-[1.12] tracking-tight text-balance">
                  {copy.title}
                </h2>
                <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{copy.body}</p>

                <form onSubmit={submit} className="mt-6">
                  <label htmlFor="notify-email" className="sr-only">
                    Email address
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="relative flex-1">
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
                        placeholder="you@business.ng"
                        className="h-14 w-full rounded-xl bg-background pl-11 pr-4 text-[15px] outline-none hairline transition focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={state === "busy"}
                      className="sheen inline-flex h-14 shrink-0 items-center justify-center gap-2 rounded-xl bg-ink px-6 text-[15px] font-semibold text-ink-foreground shadow-cta transition-transform active:scale-[0.98] disabled:opacity-60"
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

                <div className="mt-6 flex flex-col gap-1 rounded-xl bg-secondary/70 p-4 text-[13px] text-secondary-foreground sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-medium">Need it today? Walk in to the Head Office.</span>
                  <a href="tel:+23492919181" className="font-semibold text-primary tnum hover:underline">
                    +234 9 291 9181
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
