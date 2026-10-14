"use client"

import { useEffect, useRef, useState } from "react"
import { MessageSquare, Send, Sparkles, X, Minus, BellRing } from "lucide-react"
import { openNotify, type NotifyIntent } from "./notify-dialog"

type Msg = { id: number; from: "bot" | "user"; text: string; at: number; intent?: NotifyIntent }

const QUICK = [
  "Where is your office?",
  "How do I register a storefront sign?",
  "Report an illegal billboard",
  "What does a permit cost?",
] as const

const WELCOME =
  "Hello, and welcome to DOAS. Ask me anything about signage permits, first-party regularization, or how to reach our office at Jahi."

function stamp(t: number) {
  return new Date(t).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })
}

/** Keyword router → institutional replies. Swap for a real model/API call later. */
function answer(q: string): { text: string; intent?: NotifyIntent } {
  const s = q.toLowerCase()

  if (/(where|office|address|located|headquarters|jahi|katampe|visit|open|hours)/.test(s))
    return {
      text: "Our Head Office is at Katampe Road, Jahi, Abuja, FCT 900321, open Monday to Friday, 8:00am – 4:00pm. The Customer Service Unit is on +234 9 291 9181 or service@doas.abj.gov.ng.",
    }

  if (/(storefront|shop|first.?party|regulari|register|my sign|business sign)/.test(s))
    return {
      text: "A sign on your own premises is a First-Party signage and must be registered with DOAS. Online filing is being connected to the internal register and is not open to the public yet — for now, bring a photograph of the sign, its dimensions, your business registration and your address to the Jahi Head Office. Leave your email and we will write to you the day the online portal opens.",
      intent: "first-party",
    }

  if (/(illegal|report|unapproved|unauthori|complain|demolish|remove|violation|banner)/.test(s))
    return {
      text: "Thank you for helping keep the FCT orderly. Send the location (street, landmark and area council), a photograph and any visible advertiser details to service@doas.abj.gov.ng, or call +234 9 291 9181. Monitoring & Enforcement will inspect and act in line with the Abuja Master Plan.",
      intent: "report",
    }

  if (/(billboard|third.?party|led|hoarding|poster|practitioner|agency|unipole|gantry)/.test(s))
    return {
      text: "Billboards, LED screens, hoardings and posters on public or leased sites are Third-Party advertising, filed through a registered practitioner. Files pass through Monitoring & Enforcement and Planning & Development reports before the Director's approval. Online filing opens soon — leave your email for the practitioner application pack.",
      intent: "third-party",
    }

  if (/(vehicle|mobile|haulage|truck|bus|car|branded|fleet)/.test(s))
    return {
      text: "Vehicle branding and mobile advertising on trucks, buses and haulage fleets in the FCT require a DOAS mobile advert permit, listed by each vehicle's registration number. Leave your email and we will send the fleet schedule template and requirements.",
      intent: "mobile",
    }

  if (/(status|track|check|reference|my application|verify)/.test(s))
    return {
      text: "Online tracking by reference number is being connected to the internal register. In the meantime, quote your reference number to the Customer Service Unit on +234 9 291 9181 and the desk holding your file will be confirmed to you.",
      intent: "status",
    }

  if (/(fee|cost|price|how much|pay|invoice|tariff|charge)/.test(s))
    return {
      text: "Fees depend on signage class, size and location, and are set out in the DOAS tariff schedule. For a first-party sign, Finance issues your invoice after the site visit; third-party sites are assessed individually. Never pay a fee that is not on a DOAS invoice.",
    }

  if (/(area council|amac|bwari|kuje|kwali|abaji|gwagwalada|double|mou|twice)/.test(s))
    return {
      text: "Under the Memorandum of Understanding with the six Area Councils — AMAC, Abaji, Bwari, Gwagwalada, Kuje and Kwali — DOAS is the single regulatory and collection point for outdoor advertising in the FCT. Revenue is shared with the councils by law, so you should not be billed twice for the same sign.",
    }

  if (/(demand letter|notice|sanction|penalt|deadline|court)/.test(s))
    return {
      text: "If you have received a demand letter, act within the period stated on it. Bring the letter, your business registration and a photograph of the sign to the Jahi Head Office. Signs regularized within the stated period are not subject to removal.",
      intent: "first-party",
    }

  if (/(hello|hi|good (morning|afternoon|evening)|hey|greetings)/.test(s))
    return {
      text: "Good day, and welcome. I can help with permits, first-party regularization, reporting unapproved structures, and finding our office. What would you like to know?",
    }

  if (/(thank|thanks|appreciate)/.test(s))
    return { text: "You are welcome. DOAS is here to help you stay compliant. Is there anything else?" }

  return {
    text: "I can help with signage permits, first-party regularization, billboard and mobile advert applications, reporting unapproved structures, and our office location. For anything else, the Customer Service Unit is on +234 9 291 9181 (Mon–Fri, 8am–4pm) or service@doas.abj.gov.ng.",
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
          "fixed z-[80] right-4 bottom-24 sm:right-6 w-[calc(100vw-2rem)] max-w-[392px]",
          "origin-bottom-right transition-all duration-[380ms] ease-out",
          open
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "pointer-events-none translate-y-4 scale-95 opacity-0",
        ].join(" ")}
      >
        <div className="surface-raised flex h-[min(580px,calc(100vh-8rem))] flex-col overflow-hidden rounded-[1.5rem]">
          {/* header */}
          <div className="relative flex items-center gap-3 bg-ink px-4 py-3.5 text-ink-foreground">
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-gold via-sky to-transparent" aria-hidden />
            <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold font-display text-[15px] font-bold text-ink">
              D
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
                <span className="mt-1 px-1 text-[10.5px] tnum text-muted-foreground/70">{stamp(m.at)}</span>
                {m.from === "bot" && m.intent && (
                  <button
                    onClick={() => openNotify(m.intent!)}
                    className="mt-1 inline-flex items-center gap-2 rounded-full bg-gold px-3.5 py-2 text-[12.5px] font-semibold text-ink transition-transform hover:brightness-105 active:scale-95"
                  >
                    <BellRing className="h-3.5 w-3.5" />
                    Notify me when this opens
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
        <span
          className={`absolute transition-all duration-300 ${open ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"}`}
        >
          <MessageSquare className="h-6 w-6" />
        </span>
        <span
          className={`absolute transition-all duration-300 ${open ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0"}`}
        >
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
