"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { MessageSquare, Send, Sparkles, X, Minus, BellRing } from "lucide-react"
import { openNotify } from "./notify-dialog"
import { CONTACT, DIRECTOR, type NotifyIntent } from "./content"

type Msg = { id: number; from: "bot" | "user"; text: string; at: number; intent?: NotifyIntent }

const QUICK = [
  "Where is your office?",
  "Can I build a new billboard now?",
  "When do I pay the revalidation fee?",
  "How far apart must billboards be?",
  "Report an unsafe structure",
] as const

const PHONES = `${CONTACT.phones[0].display} or ${CONTACT.phones[1].display}`

const WELCOME =
  "Hello, and welcome to DOAS. Ask me about current notices, billboard standards, revalidation, payments or how to reach the Customer Service Unit in Jahi."

function stamp(t: number) {
  return new Date(t).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })
}

/** Keyword router → institutional replies. Order matters: specific topics first. Swap for a real model/API call later. */
function answer(q: string): { text: string; intent?: NotifyIntent } {
  const s = q.toLowerCase()

  if (/(stop.?work|construct|build|erect|excavat|foundation|new billboard|new structure)/.test(s))
    return {
      text: "A temporary stop-work order is in force. New billboard construction, excavation, foundation work and erection are suspended until further official direction, and no practitioner may start or continue structural work without express written clearance from DOAS. Flex replacement and critical safety maintenance on existing structures remain subject to DOAS requirements. An exemption must be written and site-specific — a request is not permission to proceed.",
      intent: "site",
    }

  if (/(revalidat|certificat|licen[cs]e|successful list)/.test(s))
    return {
      text: "The practitioner revalidation certification fee is ₦1,000,000 per successful practitioner (circular of 29 September 2026). It is payable only after DOAS publishes the successful list and notifies you in writing — not when you submit documents. Pay through Remita and submit your evidence for verification before the revalidated licence is issued. Site approval revalidation covered approvals issued January 2025 – August 2026, with submissions through the Customer Service Unit from 21 September to 4:00pm on 5 October 2026.",
      intent: "revalidation",
    }

  if (/(newly approved|new site|pay for (my|a|the) site|site payment)/.test(s))
    return {
      text: "Do not pay for newly approved billboard sites until further notice. Approved bills and liabilities for existing or old structures are unaffected and remain payable.",
      intent: "billing",
    }

  if (/(spacing|distance|how far|apart|metre|meter|junction|intersection|gantry|unipole|portrait|48 sheet|96 sheet|light ?box|eye catcher|flag ?pole)/.test(s))
    return {
      text: "Minimum spacing between new structures: 1 km for gantries, eye catchers and flag poles; 500 m for large format and unipoles; 400 m for 96 sheet and portrait; 200 m for light box and 48 sheet (existing portrait 200 m only where expressly permitted). A maximum of two alternating billboards is allowed at a junction. Meeting the minimum does not by itself mean a site is approved.",
    }

  if (/(tree|flower|walkway|bus stop|setback|environment|flex|skeleton|untidy|torn)/.test(s))
    return {
      text: "Billboards must not occupy flower beds or obstruct walkways, bus stops, roadside setbacks or public landscaping. Trees may not be cut, trimmed, damaged or felled for visibility without prior DOAS written clearance — Parks and Recreation approval alone is not enough. Every board must stay neatly flexed or covered, including between campaigns; naked, torn or skeleton boards are prohibited.",
    }

  if (/(high.?tension|power line|electric)/.test(s))
    return {
      text: "Billboards beneath high-tension electricity lines, or in a high-tension corridor, must be removed within 21 days of the applicable official notice. The deadline runs from the date of the notice served, not from any other date.",
      intent: "report",
    }

  if (/(safety|ppe|hse|helmet|harness|installer|contractor)/.test(s))
    return {
      text: "All practitioners must follow the DOAS Health, Safety and Environment policy during installation, maintenance, flex replacement, campaign changes and dismantling. Use appropriate PPE, secure the work area, protect pedestrians and road users, and hold every required approval before work starts. Brief your installers and contractors on these requirements.",
    }

  if (/(consent|private property|setting.?out|site assessment|build permit)/.test(s))
    return {
      text: "For a billboard in front of or around private property, obtain a valid consent letter from the owner or their authorised representative before you apply. A Setting Out Certificate and every other applicable written approval are required before any construction or maintenance, and a Site Assessment Certificate precedes a Site Build Permit.",
      intent: "site",
    }

  if (/(storefront|shop|first.?party|my sign|business sign|signage on)/.test(s))
    return {
      text: "A sign on your own business premises is first-party signage. Businesses and approved first-party compliance facilitators confirm requirements and regularise signage through the Customer Service Unit in Jahi. Pay only against an official DOAS bill — never to an individual.",
      intent: "first-party",
    }

  if (/(telecom|mast|tower|base station)/.test(s))
    return {
      text: "Telecom site documentation, inventory and administrative requirements are handled by the Telecom Team within its approved remit. Submit through the Customer Service Unit, or leave your email for the current requirements.",
      intent: "telecom",
    }

  if (/(bill|invoice|receipt|reconcil|discrepan|remita|fee|cost|price|how much|pay|charge|tariff)/.test(s))
    return {
      text: "Pay only against an official DOAS bill. The published revalidation certification fee is ₦1,000,000 per successful practitioner, via Remita, after written notification. Payment for newly approved sites is suspended until further notice. For a bill query, bring the bill number, site reference, the amount in question and your evidence — Accounts will verify. A receipt never replaces an approval.",
      intent: "billing",
    }

  if (/(illegal|report|unsafe|danger|complain|bribe|induce|extort|demand|intermediar|agent|tout|violation)/.test(s))
    return {
      text: `Thank you for helping keep the FCT safe. Send the exact location, a photograph and any visible advertiser details to ${CONTACT.email}, or call ${PHONES}. Report any request for an inducement or any unofficial payment demand too — deal only with the Customer Service Unit.`,
      intent: "report",
    }

  if (/(status|track|verify|reference|my application|my file)/.test(s))
    return {
      text: `Online verification is being built into a verified site register. For now, quote your reference number to the Customer Service Unit on ${PHONES}. Remember: submission, acknowledgement, payment and approval are separate statuses.`,
      intent: "status",
    }

  if (/(director|head of|who (runs|heads|leads))/.test(s))
    return {
      text: `${DIRECTOR.name} is the ${DIRECTOR.title} of DOAS. He assumed office on 31 August 2026. Meeting requests go through the Customer Service Unit.`,
      intent: "meeting",
    }

  if (/(area council|amac|bwari|kuje|kwali|abaji|gwagwalada|jurisdiction)/.test(s))
    return {
      text: `DOAS regulates outdoor advertisement and signage across the Federal Capital Territory, which includes all six Area Councils. For a question about who bills a particular sign, contact the Customer Service Unit on ${PHONES}.`,
    }

  if (/(where|office|address|located|location|direction|jahi|visit|hours|open|phone|call|number|contact|email)/.test(s))
    return {
      text: `The Customer Service Unit is at the ${CONTACT.addressOneLine}. Office hours: ${CONTACT.hours}. Call ${PHONES}, or email ${CONTACT.email}.`,
    }

  if (/\b(hello|hi|hey|greetings|good (morning|afternoon|evening))\b/.test(s))
    return {
      text: "Good day, and welcome. I can help with notices in force, billboard standards, revalidation, payments, reporting a structure and finding our office. What would you like to know?",
    }

  if (/\b(thank|thanks|appreciate)/.test(s)) return { text: "You are welcome. DOAS is here to help you stay compliant. Is there anything else?" }

  return {
    text: `I can help with current notices, billboard spacing and safety standards, revalidation, payments, first-party signage and reporting a structure. For anything else, call the Customer Service Unit on ${PHONES} (${CONTACT.hoursShort}) or email ${CONTACT.email}.`,
  }
}

export function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [seen, setSeen] = useState(false)
  const [typing, setTyping] = useState(false)
  const [input, setInput] = useState("")
  const [msgs, setMsgs] = useState<Msg[]>([{ id: 1, from: "bot", text: WELCOME, at: Date.now() }])
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const openedAt = useRef<number | null>(null)

  useEffect(() => {
    if (!open) return
    openedAt.current = Date.now()
    setSeen(true)
    const t = setTimeout(() => inputRef.current?.focus(), 260)
    return () => {
      clearTimeout(t)
      // record session length for the telemetry console
      try {
        const s = Number(localStorage.getItem("doas.chat.seconds") || 0)
        const n = Number(localStorage.getItem("doas.chat.sessions") || 0)
        const dur = Math.round((Date.now() - (openedAt.current ?? Date.now())) / 1000)
        localStorage.setItem("doas.chat.seconds", String(s + dur))
        localStorage.setItem("doas.chat.sessions", String(n + 1))
      } catch {}
    }
  }, [open])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" })
  }, [msgs, typing])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    const onOpen = () => setOpen(true)
    const onAsk = (e: Event) => {
      setOpen(true)
      const text = (e as CustomEvent<string>).detail
      if (text) setTimeout(() => send(text), 340)
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("doas:open-chat", onOpen)
    window.addEventListener("doas:ask", onAsk)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("doas:open-chat", onOpen)
      window.removeEventListener("doas:ask", onAsk)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function send(text: string) {
    const clean = text.trim()
    if (!clean) return
    setInput("")
    setMsgs((m) => [...m, { id: Date.now(), from: "user", text: clean, at: Date.now() }])
    setTyping(true)
    const delay = 600 + Math.min(900, clean.length * 11)
    setTimeout(() => {
      const a = answer(clean)
      setTyping(false)
      setMsgs((m) => [...m, { id: Date.now() + 1, from: "bot", text: a.text, at: Date.now(), intent: a.intent }])
    }, delay)
  }

  const showQuick = msgs.length <= 1
  const lastBot = [...msgs].reverse().find((m) => m.from === "bot")

  return (
    <>
      {/* Panel */}
      <div
        role="dialog"
        aria-label="DOAS Assistant"
        aria-hidden={!open}
        className={[
          "fixed bottom-24 right-4 z-[80] w-[calc(100vw-2rem)] max-w-[392px] sm:right-6",
          "origin-bottom-right transition-all duration-[380ms] ease-out",
          open ? "pointer-events-auto translate-y-0 scale-100 opacity-100" : "pointer-events-none translate-y-4 scale-95 opacity-0",
        ].join(" ")}
      >
        <div className="surface-raised flex h-[min(580px,calc(100vh-8rem))] flex-col overflow-hidden rounded-[1.5rem]">
          {/* header */}
          <div className="relative flex items-center gap-3 bg-ink px-4 py-3.5 text-ink-foreground">
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-gold via-sky to-transparent" aria-hidden />
            <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white p-1.5">
              <Image src="/doas-logo.png" alt="" width={80} height={80} className="h-full w-auto max-w-full object-contain" />
              <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-ink bg-[hsl(var(--state-clear))]" />
            </div>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[14px] font-semibold leading-tight">
                DOAS Assistant <Sparkles className="h-3.5 w-3.5 text-gold" />
              </p>
              <p className="text-[11.5px] leading-tight text-ink-foreground/65">Online · replies in seconds</p>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <button
                aria-label="Minimise"
                onClick={() => setOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-lg transition-colors hover:bg-white/10"
              >
                <Minus className="h-4 w-4" />
              </button>
              <button
                aria-label="Close chat"
                onClick={() => setOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-lg transition-colors hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* messages */}
          <div ref={listRef} className="scroll-slim flex-1 space-y-3 overflow-y-auto bg-background px-3.5 py-4">
            {msgs.map((m) => (
              <div key={m.id} className={`fade-in flex flex-col ${m.from === "user" ? "items-end" : "items-start"}`}>
                <div
                  className={[
                    "max-w-[88%] px-4 py-2.5 text-[13.5px] leading-relaxed",
                    m.from === "user"
                      ? "rounded-2xl rounded-br-md bg-ink text-ink-foreground"
                      : "rounded-2xl rounded-bl-md bg-card text-foreground hairline",
                  ].join(" ")}
                >
                  {m.text}
                </div>
                {/* the welcome stamp is rendered at build time and again in the browser */}
                <span suppressHydrationWarning className="mt-1 px-1 text-[10.5px] tnum text-muted-foreground/70">
                  {stamp(m.at)}
                </span>
                {m.from === "bot" && m.intent && (
                  <button
                    onClick={() => openNotify(m.intent!)}
                    className="mt-1 inline-flex items-center gap-2 rounded-full bg-gold px-3.5 py-2 text-[12.5px] font-semibold text-ink transition-transform hover:brightness-105 active:scale-95"
                  >
                    <BellRing className="h-3.5 w-3.5" />
                    Get updates on this
                  </button>
                )}
              </div>
            ))}

            {typing && (
              <div className="fade-in flex justify-start">
                <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-card px-4 py-3 hairline">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60"
                      style={{ animationDelay: `${i * 130}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}

            {(showQuick || (!typing && lastBot && msgs.length > 1)) && (
              <div className="fade-in flex flex-wrap gap-2 pt-1">
                {(showQuick ? QUICK : QUICK.slice(0, 3)).map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="rounded-full bg-card px-3.5 py-1.5 text-[12px] font-medium text-foreground hairline transition-colors hover:bg-secondary"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* input */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              send(input)
            }}
            className="flex items-center gap-2 border-t border-border bg-card p-2.5"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your question…"
              aria-label="Message"
              className="h-11 flex-1 rounded-xl bg-background px-3.5 text-[14px] outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              type="submit"
              aria-label="Send"
              disabled={!input.trim()}
              className="grid h-11 w-11 place-items-center rounded-xl bg-ink text-ink-foreground transition-all hover:bg-primary active:scale-95 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Close DOAS Assistant" : "Open DOAS Assistant"}
        className="group fixed bottom-5 right-4 z-[80] grid h-14 w-14 place-items-center rounded-full bg-ink text-ink-foreground shadow-[0_18px_40px_-14px_hsl(101_60%_4%/0.7)] transition-all duration-300 hover:scale-105 active:scale-95 sm:bottom-6 sm:right-6"
      >
        <span className="absolute inset-0 rounded-full ring-2 ring-gold/0 transition group-hover:ring-gold/60" aria-hidden />
        <span className={`absolute transition-all duration-300 ${open ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"}`}>
          <MessageSquare className="h-6 w-6" />
        </span>
        <span className={`absolute transition-all duration-300 ${open ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0"}`}>
          <X className="h-6 w-6" />
        </span>
        {!seen && (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 w-5 place-items-center rounded-full border-2 border-background bg-gold text-[11px] font-bold text-ink">
            1
          </span>
        )}
      </button>
    </>
  )
}
