"use client"

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  Check,
  ChevronDown,
  Download,
  FileText,
  Gavel,
  Mail,
  MapPin,
  Menu,
  Pause,
  Phone,
  Play,
  Quote,
  Search,
  ShieldCheck,
  Store,
  Truck,
  X,
} from "lucide-react"
import { Reveal, Counter, Words, GrowLine, useInView } from "./reveal"
import { Carousel } from "./carousel"
import { ChatWidget } from "./chat-widget"
import { NotifyDialog, openNotify, type NotifyIntent } from "./notify-dialog"
import { db } from "@/lib/firebase"
import { addDoc, collection, serverTimestamp } from "firebase/firestore"

/* ------------------------------------------------------------------ */
/* Content                                                             */
/* ------------------------------------------------------------------ */

const NAV = [
  { label: "Mandate", href: "#mandate" },
  { label: "Services", href: "#services" },
  { label: "Process", href: "#process" },
  { label: "Gallery", href: "#gallery" },
  { label: "FAQs", href: "#faqs" },
  { label: "Contact", href: "#contact" },
]

const COUNCILS = ["AMAC", "Abaji", "Bwari", "Gwagwalada", "Kuje", "Kwali"]

/**
 * Photography. Drop real frames into /public/photos — the component falls back
 * to a branded gradient panel while a file is missing, so nothing breaks.
 * Recommended: 2400×1500, JPEG q80, landscape, no logos burnt in.
 */
type Photo = { src: string; alt: string; caption: string; place: string }

const HERO_PHOTOS: Photo[] = [
  {
    src: "/hero-city-gate.jpg",
    alt: "Abuja City Gate at dusk with orderly roadside signage",
    caption: "Every sign in Abuja, accounted for.",
    place: "City Gate · Airport Road",
  },
  {
    src: "/photos/hero-cbd.jpg",
    alt: "Central Business District skyline with approved billboard sites",
    caption: "One register. Six Area Councils.",
    place: "Central Business District",
  },
  {
    src: "/photos/hero-storefront.jpg",
    alt: "A row of registered storefront signs on a Wuse II street",
    caption: "Storefront signage, properly registered.",
    place: "Wuse II",
  },
  {
    src: "/photos/hero-expressway.jpg",
    alt: "Unipole billboard beside the Kubwa expressway at golden hour",
    caption: "Large-format sites that respect the Master Plan.",
    place: "Kubwa Expressway",
  },
]

const GALLERY: Photo[] = [
  { src: "/photos/g-unipole.jpg", alt: "Approved unipole on an arterial road", caption: "Third-party unipole, allocated through a registered practitioner", place: "y" },
  { src: "/photos/g-led.jpg", alt: "LED screen on a junction at night", caption: "LED screen on an approved junction site", place: "" },
  { src: "/photos/g-storefront.jpg", alt: "Registered bank signage on a commercial frontage", caption: "First-party fascia sign, entered in the register", place: "" },
  { src: "/photos/g-fleet.jpg", alt: "Branded delivery vans with mobile advert permits", caption: "Mobile advert permits listed by registration number", place: "" },
  { src: "/photos/g-enforcement.jpg", alt: "Enforcement officers inspecting signage", caption: "Monitoring & Enforcement on a routine inspection", place: "" },
  { src: "/photos/g-office.jpg", alt: "The DOAS Customer Service Unit in Jahi", caption: "The Customer Service Unit, Jahi Head Office", place: "" },
]

type Service = {
  n: string
  icon: typeof Store
  title: string
  who: string
  body: string
  cta: string
  intent: NotifyIntent
  tint: string
}

const SERVICES: Service[] = [
  {
    n: "01",
    icon: Store,
    title: "First-Party Signage Regularization",
    who: "Shops, offices, banks, filling stations, hotels — any sign on your own premises.",
    body:
      "Every storefront sign in the FCT must be registered with DOAS. Your file is screened, inspected and entered in the first-party register once the invoice is settled. Online submission opens shortly — leave your email to be notified.",
    cta: "Join the registration list",
    intent: "first-party",
    tint: "bg-gold/30 text-gold-ink",
  },
  {
    n: "02",
    icon: Building2,
    title: "Third-Party Billboards & Posters",
    who: "Advertising agencies and practitioners placing adverts on public or leased sites.",
    body:
      "Unipoles, gantries, LED screens, wall wraps, hoardings and poster sites are allocated through registered practitioners, after Monitoring and Planning & Development confirm the site meets the Abuja Master Plan.",
    cta: "Request the practitioner pack",
    intent: "third-party",
    tint: "bg-sky/40 text-sky-ink",
  },
  {
    n: "03",
    icon: Truck,
    title: "Mobile Advertisements & Haulage",
    who: "Branded vehicles, buses, trucks and haulage fleets operating in the FCT.",
    body:
      "Vehicle branding is outdoor advertising in motion. Fleet owners and agencies obtain a mobile advert permit for each vehicle, listed by registration number, before the artwork goes on the road.",
    cta: "Get the fleet requirements",
    intent: "mobile",
    tint: "bg-primary/15 text-primary",
  },
  {
    n: "04",
    icon: Gavel,
    title: "Enforcement & Demolition",
    who: "Unapproved structures, expired permits and banners that breach the Master Plan.",
    body:
      "Monitoring & Enforcement officers inspect the territory, serve notices and remove structures that are unregistered, unsafe or out of place. Residents can report a violation directly to the department.",
    cta: "Report a violation",
    intent: "report",
    tint: "bg-destructive/10 text-destructive",
  },
]

const PROCESS = [
  { desk: "Customer Service Unit", step: "Submission screened", note: "Your file is checked for completeness and given a reference number." },
  { desk: "Director's Office", step: "First review", note: "The Director accepts the file for inspection, or returns it with a written reason." },
  { desk: "Business Development", step: "Site visit", note: "An officer visits the premises and confirms the sign as described." },
  { desk: "Finance", step: "Invoice & payment", note: "Your assessment is issued; payment is confirmed against the file." },
  { desk: "Director's Office", step: "Permit approved", note: "The approved sign is entered in the first-party register." },
]

const CHECKLIST = [
  { t: "Photograph of the sign", d: "A clear, daylight photo showing the sign in place on the frontage." },
  { t: "Dimensions", d: "Width and height in metres, and the mounting height from the ground." },
  { t: "Business registration", d: "CAC certificate, or the name under which the premises is let." },
  { t: "Site address", d: "Street, plot number, district and Area Council." },
  { t: "Proof of occupancy", d: "Tenancy agreement or title document for the premises." },
  { t: "Contact details", d: "A phone number and email that the Customer Service Unit can reach." },
]

const NOTICES = [
  "First-party regularization exercise is ongoing across all six Area Councils",
  "No DOAS fee is ever collected outside an official invoice",
  "Online filing and permit verification open with the public portal",
  "Demand letters must be acted upon within the period stated on them",
]

const FAQS = [
  {
    q: "What is the primary role of DOAS?",
    a: "DOAS regulates all outdoor signage, billboards, mobile adverts and banners across the Federal Capital Territory, so that outdoor advertising aligns with the Abuja Master Plan and the capital is kept free of visual clutter.",
  },
  {
    q: "Do I need a permit for a sign right outside my business storefront?",
    a: "Yes. This is classified as First-Party Signage. DOAS is running a mandatory First-Party Signage Regularization exercise, and every storefront sign must be registered at the Jahi Head Office to avoid operational sanctions. Online registration is being connected to the internal register and will open shortly.",
  },
  {
    q: "How does DOAS interact with the Area Councils, such as AMAC?",
    a: "Under a Memorandum of Understanding, DOAS is the central regulatory and revenue-collection point for signage in the FCT. Collected funds are shared by law among all six Area Councils, which ends the double billing of the same sign.",
  },
  {
    q: "Where is the DOAS headquarters located for registration?",
    a: "The DOAS Head Office is at Katampe Road, Jahi, Abuja, FCT 900321. Office hours are Monday to Friday, 8:00am to 4:00pm.",
  },
  {
    q: "How do I check the status of an application I have already submitted?",
    a: "Quote your reference number to the Customer Service Unit on +234 9 291 9181 and the desk currently holding your file will be confirmed to you. Online tracking — showing every movement between the CSU, the Director's office, Business Development and Finance — opens with the public portal.",
  },
  {
    q: "I received a demand letter. What should I do?",
    a: "Act within the period stated on the letter. Bring it, together with your business registration and a photograph of the sign, to the Jahi Head Office. Signs regularized in time are not subject to removal, and no DOAS fee is ever collected outside an official invoice.",
  },
  {
    q: "What happens to a sign that is never registered?",
    a: "Unregistered structures are served notice by Monitoring & Enforcement and, if not regularized within the period stated, are removed at the owner's cost. Registering is faster, cheaper and keeps your frontage intact.",
  },
]

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2.5 focus:text-ink-foreground"
      >
        Skip to content
      </a>

      <Header />

      <main id="main">
        <Hero />
        <NoticeTicker />
        <CouncilStrip />
        <Mandate />
        <Services />
        <Leadership />
        <Process />
        <Checklist />
        <Gallery />
        <Faqs />
        <Newsletter />
        <Contact />
      </main>

      <Footer />
      <ChatWidget />
      <NotifyDialog />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Photo — next/image with a branded fallback                          */
/* ------------------------------------------------------------------ */

function Photo({
  photo,
  priority = false,
  sizes = "100vw",
  className = "",
}: {
  photo: Photo
  priority?: boolean
  sizes?: string
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <div
        className={`absolute inset-0 bg-[radial-gradient(ellipse_at_70%_30%,hsl(var(--sky)/.45),transparent_55%),radial-gradient(ellipse_at_20%_80%,hsl(var(--gold)/.35),transparent_50%),linear-gradient(160deg,hsl(var(--ink-raised)),hsl(var(--ink)))] ${className}`}
        role="img"
        aria-label={photo.alt}
      >
        <div className="absolute inset-0 grid-paper opacity-[0.08] [--border:48_30%_96%]" />
      </div>
    )
  }
  return (
    <Image
      src={photo.src}
      alt={photo.alt}
      fill
      priority={priority}
      sizes={sizes}
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  )
}

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [progress, setProgress] = useState(0)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      const h = document.documentElement.scrollHeight - window.innerHeight
      setScrolled(y > 20)
      setProgress(h > 0 ? Math.min(100, (y / h) * 100) : 0)
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  return (
    <>
      {/* government strip */}
      <div className="bg-ink text-[11.5px] tracking-wide text-ink-foreground/75">
        <div className="mx-auto flex h-9 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <p className="flex items-center gap-2 truncate">
            <span
              className="inline-block h-3 w-[18px] rounded-[2px] bg-[linear-gradient(90deg,#008751_33%,#fff_33%,#fff_66%,#008751_66%)]"
              aria-hidden
            />
            An official agency of the Federal Capital Territory Administration
          </p>
          <p className="hidden tnum sm:block">Mon – Fri · 8:00am – 4:00pm · +234 9 291 9181</p>
        </div>
      </div>

      <header
        className={[
          "sticky top-0 z-50 transition-all duration-300",
          scrolled ? "bg-background/80 shadow-[0_1px_0_0_hsl(var(--border))] backdrop-blur-xl" : "bg-background",
        ].join(" ")}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className={`flex items-center justify-between transition-[height] duration-300 ${scrolled ? "h-[68px]" : "h-20"}`}>
            <Link href="/" className="group flex items-center gap-3" aria-label="DOAS home">
              <span className="relative">
                <span className="absolute -inset-1.5 rounded-full bg-gold/0 transition-colors duration-300 group-hover:bg-gold/25" aria-hidden />
                <Image
                  src="/doas-logo.png"
                  alt="DOAS — Department of Outdoor Advertisement and Signage"
                  width={48}
                  height={48}
                  priority
                  className={`relative transition-all duration-300 ${scrolled ? "h-10 w-10" : "h-12 w-12"}`}
                />
              </span>
              <span className="leading-tight">
                <span className="block font-display text-[19px] font-semibold tracking-tight">DOAS</span>
                <span className="block text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
                  Outdoor Advertisement &amp; Signage
                </span>
              </span>
            </Link>

            <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary">
              {NAV.map((n) => (
                <a
                  key={n.href}
                  href={n.href}
                  className="relative text-[14.5px] font-medium text-foreground/70 transition-colors after:absolute after:-bottom-1.5 after:left-0 after:h-[2.5px] after:w-full after:origin-left after:scale-x-0 after:rounded-full after:bg-gold after:transition-transform after:duration-300 hover:text-foreground hover:after:scale-x-100"
                >
                  {n.label}
                </a>
              ))}
            </nav>

            <div className="hidden items-center gap-2 lg:flex">
              <button
                onClick={() => openNotify("status")}
                className="inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-medium text-foreground/80 transition-colors hover:bg-secondary"
              >
                <Search className="h-4 w-4" />
                Verify a permit
              </button>
              <button
                onClick={() => openNotify("first-party")}
                className="sheen inline-flex h-11 items-center gap-2 rounded-xl bg-ink px-5 text-sm font-semibold text-ink-foreground transition-transform active:scale-[0.98]"
              >
                Register signage
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <button
              onClick={() => setOpen(true)}
              className="-mr-2 grid h-11 w-11 place-items-center rounded-xl text-foreground hover:bg-secondary lg:hidden"
              aria-label="Open menu"
              aria-expanded={open}
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="h-[2px] w-full bg-transparent">
          <div
            className="h-full bg-gradient-to-r from-gold to-primary transition-[width] duration-150 ease-out"
            style={{ width: `${progress}%` }}
            aria-hidden
          />
        </div>
      </header>

      {/* mobile sheet */}
      <div
        className={`fixed inset-0 z-[60] transition lg:hidden ${open ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!open}
      >
        <div
          onClick={() => setOpen(false)}
          className={`absolute inset-0 bg-ink/70 backdrop-blur-sm transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
        />
        <div
          className={`absolute right-0 top-0 flex h-full w-[88%] max-w-sm flex-col bg-card shadow-2xl transition-transform duration-[420ms] ease-out ${open ? "translate-x-0" : "translate-x-full"}`}
        >
          <div className="flex h-20 items-center justify-between border-b border-border px-5">
            <p className="font-display text-lg font-semibold">Menu</p>
            <button onClick={() => setOpen(false)} className="grid h-11 w-11 place-items-center rounded-xl hover:bg-secondary" aria-label="Close menu">
              <X className="h-6 w-6" />
            </button>
          </div>
          <nav className="flex flex-col px-3 py-4" aria-label="Mobile">
            {NAV.map((n, i) => (
              <a
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                style={{ transitionDelay: `${open ? 90 + i * 45 : 0}ms` }}
                className={`flex items-center justify-between rounded-xl px-3 py-3.5 text-[17px] font-medium transition-all duration-300 hover:bg-secondary ${open ? "translate-x-0 opacity-100" : "translate-x-5 opacity-0"}`}
              >
                {n.label}
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </a>
            ))}
          </nav>
          <div className="mt-auto space-y-2 border-t border-border p-5">
            <button
              onClick={() => {
                setOpen(false)
                openNotify("first-party")
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink py-3.5 font-semibold text-ink-foreground"
            >
              Register signage <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setOpen(false)
                openNotify("status")
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-medium hairline"
            >
              <Search className="h-4 w-4" /> Verify a permit
            </button>
            <p className="pt-2 text-center text-xs text-muted-foreground">Katampe Road, Jahi, Abuja · +234 9 291 9181</p>
          </div>
        </div>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Hero — full-bleed photo carousel                                     */
/* ------------------------------------------------------------------ */

const HERO_INTERVAL = 6500

function Hero() {
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [reduced, setReduced] = useState(false)
  const count = HERO_PHOTOS.length
  const touchX = useRef<number | null>(null)

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  }, [])

  const go = useCallback((n: number) => setI(((n % count) + count) % count), [count])

  useEffect(() => {
    if (!playing || reduced || count < 2) return
    const id = window.setInterval(() => setI((x) => (x + 1) % count), HERO_INTERVAL)
    return () => window.clearInterval(id)
  }, [playing, reduced, count, i])

  const photo = HERO_PHOTOS[i]

  return (
    <section
      className="relative isolate overflow-hidden bg-ink text-ink-foreground"
      aria-roledescription="carousel"
      aria-label="Abuja signage photography"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return
        const dx = e.changedTouches[0].clientX - touchX.current
        if (Math.abs(dx) > 48) go(dx < 0 ? i + 1 : i - 1)
        touchX.current = null
      }}
    >
      {/* slides */}
      {HERO_PHOTOS.map((p, k) => {
        const active = k === i
        return (
          <div
            key={p.src}
            aria-hidden={!active}
            className={`absolute inset-0 transition-opacity duration-[1400ms] ease-[cubic-bezier(.4,0,.2,1)] ${active ? "opacity-100" : "opacity-0"}`}
          >
            <div className={`absolute inset-0 ${active && !reduced ? "kenburns" : ""}`}>
              <Photo photo={p} priority={k === 0} sizes="100vw" />
            </div>
          </div>
        )
      })}

      {/* grading */}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,hsl(var(--ink)/.92)_0%,hsl(var(--ink)/.72)_38%,hsl(var(--ink)/.25)_70%,hsl(var(--ink)/.1)_100%)]" aria-hidden />
      <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-ink to-transparent" aria-hidden />
      <div className="absolute inset-0 grid-paper opacity-[0.07] [--border:48_30%_96%] [mask-image:radial-gradient(ellipse_at_20%_40%,black_10%,transparent_65%)]" aria-hidden />

      <div className="relative mx-auto flex min-h-[86svh] max-w-7xl flex-col justify-end px-4 pb-14 pt-20 sm:px-6 lg:min-h-[88vh] lg:px-8 lg:pb-20 lg:pt-24">
        <div className="max-w-3xl">
          <Reveal index={0}>
            <p className="inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-[11.5px] font-semibold uppercase tracking-[0.16em] text-gold backdrop-blur">
              <span className="relative h-2 w-2 rounded-full bg-gold ping-dot" />
              FCT Administration · Abuja
            </p>
          </Reveal>

          <h1 className="mt-7 font-display text-[2.9rem] font-semibold leading-[0.98] tracking-tight sm:text-6xl lg:text-[5rem]">
            <Words text="Every sign in Abuja," as="span" className="block" />
            <Words text="accounted for." as="span" className="mt-1 block text-gold" start={4} />
          </h1>

          <Reveal index={4} as="p" className="mt-7 max-w-xl text-[17px] leading-relaxed text-ink-foreground/80">
            The Department of Outdoor Advertisement and Signage regulates billboards, storefront signs, mobile adverts and
            banners across the Federal Capital Territory — one register, one permit, and one point of contact for the
            capital&rsquo;s advertisers, property owners and residents.
          </Reveal>

          <Reveal index={5} className="mt-9 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => openNotify("first-party")}
              className="group inline-flex h-[56px] items-center justify-center gap-2.5 rounded-2xl bg-gold px-7 text-[15px] font-semibold text-ink shadow-[0_18px_40px_-16px_hsl(46_90%_40%/.7)] transition-transform hover:brightness-105 active:scale-[0.98]"
            >
              Register First-Party Signage
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
            <a
              href="/downloads/doas-signage-guidelines.pdf"
              className="inline-flex h-[56px] items-center justify-center gap-2.5 rounded-2xl border border-white/15 bg-white/[0.06] px-7 text-[15px] font-semibold text-ink-foreground backdrop-blur transition-colors hover:bg-white/10"
            >
              <Download className="h-4 w-4" />
              Download Guidelines (PDF)
            </a>
          </Reveal>

          <Reveal index={6} className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-2.5 text-[13.5px] text-ink-foreground/70">
            {["One register for all six Area Councils", "No fee outside an official invoice"].map((t) => (
              <span key={t} className="inline-flex items-center gap-2">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-[hsl(var(--state-clear))]">
                  <Check className="h-3 w-3 text-white" strokeWidth={3.5} />
                </span>
                {t}
              </span>
            ))}
          </Reveal>
        </div>

        {/* carousel chrome */}
        <div className="mt-12 flex flex-col gap-5 border-t border-white/10 pt-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0" aria-live="polite">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold/90">{photo.place}</p>
            <p key={photo.src} className="fade-in mt-1 font-display text-[17px] font-medium tracking-tight text-ink-foreground/90 sm:text-[19px]">
              {photo.caption}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <span className="figure text-[13px] text-ink-foreground/60">
              {String(i + 1).padStart(2, "0")}
              <span className="mx-1.5 text-ink-foreground/30">/</span>
              {String(count).padStart(2, "0")}
            </span>
            <div className="flex items-center gap-2">
              {HERO_PHOTOS.map((p, k) => (
                <button
                  key={p.src}
                  onClick={() => go(k)}
                  aria-label={`Show photo ${k + 1}: ${p.place}`}
                  aria-current={k === i}
                  className="relative h-1 w-9 overflow-hidden rounded-full bg-white/20"
                >
                  <span
                    className={`absolute inset-y-0 left-0 bg-gold ${k === i && playing && !reduced ? "hero-bar" : ""}`}
                    style={{ width: k < i ? "100%" : k === i ? (playing && !reduced ? undefined : "100%") : "0%" }}
                  />
                </button>
              ))}
            </div>
            <button
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? "Pause slideshow" : "Play slideshow"}
              className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/[0.06] backdrop-blur transition-colors hover:bg-white/10"
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Notice ticker                                                        */
/* ------------------------------------------------------------------ */

function NoticeTicker() {
  const items = [...NOTICES, ...NOTICES]
  return (
    <div className="border-b border-gold/40 bg-gold text-ink" role="region" aria-label="Public notices">
      <div className="mx-auto flex h-11 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
        <p className="mr-5 flex shrink-0 items-center gap-2 border-r border-ink/15 pr-5 text-[11px] font-bold uppercase tracking-[0.16em]">
          <span className="relative h-2 w-2 rounded-full bg-ink ping-dot" />
          Notices
        </p>
        <div className="mask-fade-x relative flex-1 overflow-hidden">
          <div className="marquee flex w-max items-center gap-10 text-[13.5px] font-medium">
            {items.map((n, k) => (
              <span key={k} className="flex items-center gap-10">
                {n}
                <span className="h-1.5 w-1.5 rotate-45 bg-ink/60" aria-hidden />
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Council strip                                                        */
/* ------------------------------------------------------------------ */

function CouncilStrip() {
  const items = [...COUNCILS, ...COUNCILS]
  return (
    <div className="overflow-hidden border-b border-border bg-card/70" aria-label="Area councils covered">
      <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
        <p className="mr-6 shrink-0 border-r border-border pr-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          One register
          <br className="hidden sm:block" /> six councils
        </p>
        <div className="mask-fade-x relative flex-1 overflow-hidden">
          <div className="marquee flex w-max items-center gap-10" style={{ animationDuration: "40s" }}>
            {items.map((c, k) => (
              <span key={k} className="flex items-center gap-10 font-display text-[17px] font-semibold tracking-tight text-foreground/70">
                {c} Area Council
                <span className="h-2 w-2 rotate-45 bg-gold" />
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Mandate                                                              */
/* ------------------------------------------------------------------ */

function Mandate() {
  const stats = [
    { v: 6, s: "", l: "Area Councils unified under one MoU" },
    { v: 4, s: "", l: "Classes of outdoor advertising regulated" },
    { v: 5, s: "", l: "Review desks on every first-party file" },
    { v: 100, s: "%", l: "Of signage tied to the Abuja Master Plan" },
  ]
  return (
    <section id="mandate" className="scroll-mt-28 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <Reveal>
              <SectionLabel n="01" label="Core mandate" />
              <h2 className="mt-5 font-display text-[2rem] font-semibold leading-[1.08] tracking-tight text-balance sm:text-4xl lg:text-[2.9rem]">
                A single authority for the capital&rsquo;s outdoor landscape.
              </h2>
            </Reveal>
            <Reveal index={2} className="relative mt-8 aspect-[4/3] overflow-hidden rounded-[1.75rem] hairline">
              <Photo photo={GALLERY[2]} sizes="(min-width:1024px) 40vw, 100vw" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/80 to-transparent p-5 text-[12.5px] text-ink-foreground/85">
                {GALLERY[2].caption} · <span className="text-gold">{GALLERY[2].place}</span>
              </div>
            </Reveal>
          </div>
          <div className="space-y-5 text-[16.5px] leading-relaxed text-muted-foreground lg:col-span-7">
            <Reveal index={1} as="p" className="font-display text-[22px] leading-snug text-foreground sm:text-[24px]">
              For years, a business in Wuse or Gwarinpa could be billed for the same sign by more than one authority, while
              unregulated billboards crowded the capital&rsquo;s skyline. DOAS was established to end both.
            </Reveal>
            <Reveal index={2} as="p">
              Under a Memorandum of Understanding with the six Area Councils —{" "}
              <span className="font-medium text-foreground">AMAC, Abaji, Bwari, Gwagwalada, Kuje and Kwali</span> — the department
              is now the central point for signage approval and revenue in the FCT. Every collected naira is shared among the
              councils by law, and every approved structure is tied to the Abuja Master Plan.
            </Reveal>
            <Reveal index={3} as="p">
              Four classes of outdoor advertising fall under the mandate: first-party signage on business premises, third-party
              billboards and poster sites, mobile advertising on vehicles, and temporary banners. Each has its own permit, its
              own review desks and its own place in the register.
            </Reveal>
            <Reveal index={4} as="p">
              The result is one register, one permit and one point of contact — and a capital whose streets read as the Master
              Plan intended.
            </Reveal>
            <Reveal index={5} className="flex flex-wrap gap-3 pt-2">
              <a
                href="/downloads/doas-signage-guidelines.pdf"
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-ink px-5 text-[14.5px] font-semibold text-ink-foreground transition-transform active:scale-[0.98]"
              >
                <FileText className="h-4 w-4" /> Signage guidelines
              </a>
              <a href="#process" className="inline-flex h-12 items-center gap-2 rounded-xl px-5 text-[14.5px] font-semibold transition-colors hairline hover:bg-secondary">
                How a file moves <ArrowRight className="h-4 w-4" />
              </a>
            </Reveal>
          </div>
        </div>

        <div className="mt-16 grid grid-cols-2 gap-px overflow-hidden rounded-3xl bg-border hairline lg:grid-cols-4">
          {stats.map((s, k) => (
            <Reveal key={s.l} index={k} className="group relative bg-card p-6 sm:p-8">
              <span className="absolute left-0 top-0 h-1 w-0 bg-gold transition-[width] duration-700 group-hover:w-full" aria-hidden />
              <p className="text-[2.6rem] font-semibold tracking-tight sm:text-5xl">
                <Counter value={s.v} suffix={s.s} />
              </p>
              <p className="mt-3 max-w-[18ch] text-[13.5px] leading-snug text-muted-foreground">{s.l}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function SectionLabel({ n, label, light = false }: { n: string; label: string; light?: boolean }) {
  return (
    <p className={`flex items-center gap-3 text-[11.5px] font-semibold uppercase tracking-[0.18em] ${light ? "text-gold" : "text-primary"}`}>
      <span className={`figure ${light ? "text-ink-foreground/50" : "text-muted-foreground/70"}`}>{n}</span>
      <span className="h-px w-7 bg-gold" />
      {label}
    </p>
  )
}

/* ------------------------------------------------------------------ */
/* Services — carousel                                                  */
/* ------------------------------------------------------------------ */

function Services() {
  return (
    <section id="services" className="scroll-mt-28 border-y border-border bg-card py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <Reveal className="max-w-2xl">
            <SectionLabel n="02" label="Services & permits" />
            <h2 className="mt-5 font-display text-[2rem] font-semibold leading-[1.08] tracking-tight sm:text-4xl lg:text-[2.9rem]">
              Which permit do you need?
            </h2>
            <p className="mt-4 text-[16.5px] leading-relaxed text-muted-foreground">
              Outdoor advertising in the FCT falls into four pipelines. Find yours — and while online filing is being connected,
              leave your email and we will write to you the day it opens.
            </p>
          </Reveal>
          <Reveal index={1} className="hidden shrink-0 items-center gap-2 text-[13px] text-muted-foreground lg:flex">
            <span className="h-px w-8 bg-border" />
            Drag, swipe or use the arrows
          </Reveal>
        </div>

        <Reveal index={2} className="mt-12">
          <Carousel label="DOAS permit pipelines" autoplay={7500} slideClass="w-[88%] sm:w-[62%] lg:w-[calc(33.333%-0.834rem)]">
            {SERVICES.map((s) => {
              const Icon = s.icon
              return (
                <article
                  key={s.n}
                  className="group flex h-full select-none flex-col rounded-3xl bg-background p-7 transition-shadow duration-300 hairline hover:shadow-plaque sm:p-8"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className={`grid h-14 w-14 place-items-center rounded-2xl ${s.tint}`}>
                      <Icon className="h-6 w-6" />
                    </span>
                    <span className="figure text-sm text-muted-foreground/60">{s.n}</span>
                  </div>

                  <h3 className="mt-6 font-display text-[22px] font-semibold leading-tight tracking-tight">{s.title}</h3>
                  <p className="mt-2.5 text-[13.5px] font-medium leading-relaxed text-primary">{s.who}</p>
                  <p className="mt-3.5 flex-1 text-[15px] leading-relaxed text-muted-foreground">{s.body}</p>

                  <button
                    onClick={() => openNotify(s.intent)}
                    className="mt-7 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-secondary px-5 text-[14.5px] font-semibold transition-colors group-hover:bg-ink group-hover:text-ink-foreground"
                  >
                    {s.cta}
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </button>
                </article>
              )
            })}
          </Carousel>
        </Reveal>

        <Reveal className="mt-10 flex flex-col gap-4 rounded-3xl bg-ink p-6 text-ink-foreground sm:flex-row sm:items-center sm:p-7">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gold text-ink">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <p className="flex-1 text-[15px] leading-relaxed text-ink-foreground/80">
            Complex site, large-format structure, or a policy question? Request a meeting with the Director&rsquo;s office.
          </p>
          <button
            onClick={() => openNotify("meeting")}
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-gold px-6 text-sm font-semibold text-ink transition-transform hover:brightness-105 active:scale-[0.98]"
          >
            Request a meeting <ArrowRight className="h-4 w-4" />
          </button>
        </Reveal>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Leadership                                                           */
/* ------------------------------------------------------------------ */

function Leadership() {
  const portrait: Photo = {
    src: "/photos/director.jpg",
    alt: "The Acting Director, Department of Outdoor Advertisement and Signage",
    caption: "",
    place: "",
  }
  return (
    <section className="relative overflow-hidden bg-ink py-20 text-ink-foreground lg:py-28">
      <div className="absolute inset-0 grid-paper opacity-[0.07] [--border:48_30%_96%]" aria-hidden />
      <div className="absolute -right-24 top-0 h-96 w-96 rounded-full bg-gold opacity-20 blur-[110px]" aria-hidden />
      <div className="absolute -left-24 bottom-0 h-80 w-80 rounded-full bg-sky opacity-15 blur-[110px]" aria-hidden />

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:gap-16 lg:px-8">
        <Reveal className="lg:col-span-5">
          <div className="relative mx-auto aspect-[4/5] max-w-md overflow-hidden rounded-[2rem]">
            <Photo photo={portrait} sizes="(min-width:1024px) 40vw, 90vw" />
            <div className="absolute inset-0 ring-1 ring-inset ring-white/10" aria-hidden />
            <div className="absolute bottom-5 left-5 right-5 rounded-2xl bg-ink/80 p-4 backdrop-blur">
              <p className="font-display text-[17px] font-semibold">Dr. Sunday Azaki Kachiwoyi</p>
              <p className="text-[12.5px] text-ink-foreground/65">Director, DOAS · FCT Administration</p>
            </div>
          </div>
        </Reveal>

        <div className="lg:col-span-7">
          <Reveal>
            <SectionLabel n="03" label="From the Director's office" light />
          </Reveal>
          <Reveal index={1}>
            <Quote className="mt-6 h-9 w-9 text-gold" aria-hidden />
            <blockquote className="mt-4 font-display text-[1.6rem] font-medium leading-[1.3] tracking-tight text-balance sm:text-[2rem]">
              Abuja was planned as a capital that could be read at a glance — wide avenues, clear sightlines, a skyline that
              belongs to the city and not to whoever shouts loudest. Our work is to keep it that way, fairly, with one
              register that every business can trust.
            </blockquote>
          </Reveal>
          <Reveal index={2} as="p" className="mt-7 max-w-xl text-[15.5px] leading-relaxed text-ink-foreground/70">
            The department operates across six desks — Customer Service, the Director&rsquo;s office, Business Development,
            Finance, Planning &amp; Development and Monitoring &amp; Enforcement — with every decision on a file written to the
            record, so that an applicant always knows where their file is and why.
          </Reveal>
          <Reveal index={3} className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={() => openNotify("meeting")}
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-gold px-6 text-sm font-semibold text-ink transition-transform hover:brightness-105 active:scale-[0.98]"
            >
              Request a meeting <ArrowRight className="h-4 w-4" />
            </button>
            <a
              href="#mandate"
              className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-6 text-sm font-semibold backdrop-blur transition-colors hover:bg-white/10"
            >
              Read the mandate
            </a>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Process                                                              */
/* ------------------------------------------------------------------ */

function Process() {
  const { ref, inView } = useInView<HTMLOListElement>({ threshold: 0.2 })

  return (
    <section id="process" className="scroll-mt-28 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-end gap-8 lg:grid-cols-12">
          <Reveal className="lg:col-span-7">
            <SectionLabel n="04" label="How a first-party file moves" />
            <h2 className="mt-5 font-display text-[2rem] font-semibold leading-[1.08] tracking-tight text-balance sm:text-4xl lg:text-[2.9rem]">
              Five desks. One reference number. Nothing lost.
            </h2>
          </Reveal>
          <Reveal index={1} className="lg:col-span-5 lg:text-right">
            <button
              onClick={() => openNotify("status")}
              className="inline-flex items-center gap-2 text-[15px] font-semibold text-primary transition-colors hover:text-foreground"
            >
              Track an existing application <ArrowUpRight className="h-4 w-4" />
            </button>
          </Reveal>
        </div>

        <div className="relative mt-14">
          <div className="absolute left-0 right-0 top-[18px] hidden lg:block">
            <GrowLine />
          </div>
          <ol ref={ref} className="grid gap-9 lg:grid-cols-5 lg:gap-6">
            {PROCESS.map((p, k) => (
              <li
                key={p.step}
                className="relative flex gap-5 lg:block"
                style={{
                  transition: "opacity .6s cubic-bezier(.16,1,.3,1), transform .6s cubic-bezier(.16,1,.3,1)",
                  transitionDelay: `${k * 110}ms`,
                  opacity: inView ? 1 : 0,
                  transform: inView ? "none" : "translateY(14px)",
                }}
              >
                <div className="relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-ink-foreground">
                  <span className="figure text-[12.5px] font-bold">{k + 1}</span>
                  {k === PROCESS.length - 1 && <span className="absolute -inset-1 rounded-full ring-2 ring-gold" aria-hidden />}
                </div>
                <div className="lg:mt-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-primary">{p.desk}</p>
                  <h3 className="mt-1.5 font-display text-[18px] font-semibold tracking-tight">{p.step}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{p.note}</p>
                </div>
                {k < PROCESS.length - 1 && <span className="absolute bottom-[-2.25rem] left-[17px] top-9 w-px bg-border lg:hidden" aria-hidden />}
              </li>
            ))}
          </ol>
        </div>

        <Reveal index={2} className="mt-14 grid gap-px overflow-hidden rounded-3xl bg-border text-[14px] hairline sm:grid-cols-3">
          {[
            { t: "Returned, not rejected", d: "If a desk sends a file back, the reason is written on the record so you can fix it and resubmit." },
            { t: "Pay against an invoice", d: "Finance issues your assessment after the site visit. Never pay a fee that is not on a DOAS invoice." },
            { t: "Third-party sites", d: "Billboard files route through Monitoring and Planning reports instead, and are registered by the CSU on approval." },
          ].map((c) => (
            <div key={c.t} className="bg-card p-6">
              <p className="flex items-center gap-2 font-semibold">
                <span className="h-1.5 w-1.5 rotate-45 bg-gold" aria-hidden />
                {c.t}
              </p>
              <p className="mt-2 leading-relaxed text-muted-foreground">{c.d}</p>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Checklist — before you file                                          */
/* ------------------------------------------------------------------ */

function Checklist() {
  return (
    <section className="border-y border-border bg-card py-20 lg:py-28">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:gap-16 lg:px-8">
        <Reveal className="lg:col-span-4">
          <SectionLabel n="05" label="Before you file" />
          <h2 className="mt-5 font-display text-[2rem] font-semibold leading-[1.08] tracking-tight text-balance sm:text-4xl">
            Six things the Customer Service Unit will ask for.
          </h2>
          <p className="mt-4 text-[15.5px] leading-relaxed text-muted-foreground">
            A complete file is screened in one visit. Bring these to the Jahi Head Office, or have them ready as scans for the
            day online filing opens.
          </p>
          <a
            href="/downloads/doas-signage-guidelines.pdf"
            className="mt-7 inline-flex h-12 items-center gap-2 rounded-xl bg-ink px-5 text-sm font-semibold text-ink-foreground transition-transform active:scale-[0.98]"
          >
            <Download className="h-4 w-4" /> Full checklist (PDF)
          </a>
        </Reveal>

        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-8">
          {CHECKLIST.map((c, k) => (
            <Reveal key={c.t} index={k} className="group flex gap-4 rounded-2xl bg-background p-5 transition-shadow hairline hover:shadow-plaque">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold/25 text-gold-ink transition-colors group-hover:bg-gold group-hover:text-ink">
                <Check className="h-4 w-4" strokeWidth={3} />
              </span>
              <div>
                <p className="font-display text-[17px] font-semibold tracking-tight">{c.t}</p>
                <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">{c.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Gallery — photo carousel                                             */
/* ------------------------------------------------------------------ */

function Gallery() {
  return (
    <section id="gallery" className="scroll-mt-28 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <Reveal className="max-w-2xl">
            <SectionLabel n="06" label="Abuja, in order" />
            <h2 className="mt-5 font-display text-[2rem] font-semibold leading-[1.08] tracking-tight sm:text-4xl lg:text-[2.9rem]">
              What a compliant city looks like.
            </h2>
            <p className="mt-4 text-[16.5px] leading-relaxed text-muted-foreground">
              Approved structures across the territory — each one in the register, each one where the Master Plan allows it.
            </p>
          </Reveal>
        </div>

        <Reveal index={1} className="mt-12">
          <Carousel label="Approved signage across the FCT" autoplay={5500} slideClass="w-[86%] sm:w-[58%] lg:w-[42%]">
            {GALLERY.map((p) => (
              <figure key={p.src} className="group relative aspect-[4/3] select-none overflow-hidden rounded-3xl bg-ink hairline">
                <Photo photo={p} sizes="(min-width:1024px) 42vw, 86vw" className="transition-transform duration-[1200ms] ease-out group-hover:scale-[1.04]" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/20 to-transparent" aria-hidden />
                <figcaption className="absolute inset-x-0 bottom-0 p-5 text-ink-foreground sm:p-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold">{p.place}</p>
                  <p className="mt-1 font-display text-[17px] font-medium leading-snug tracking-tight sm:text-[18px]">{p.caption}</p>
                </figcaption>
              </figure>
            ))}
          </Carousel>
        </Reveal>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* FAQs                                                                 */
/* ------------------------------------------------------------------ */

function Faqs() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section id="faqs" className="scroll-mt-28 border-y border-border bg-card py-20 lg:py-28">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:gap-16 lg:px-8">
        <Reveal className="lg:col-span-4">
          <SectionLabel n="07" label="Frequently asked" />
          <h2 className="mt-5 font-display text-[2rem] font-semibold leading-[1.08] tracking-tight text-balance sm:text-4xl">
            Straight answers on permits and regularization.
          </h2>
          <p className="mt-4 text-[15.5px] leading-relaxed text-muted-foreground">
            Can&rsquo;t find your question? The DOAS Assistant is at the bottom-right of this page, or call the Customer Service
            Unit during office hours.
          </p>
          <button
            onClick={() => window.dispatchEvent(new Event("doas:open-chat"))}
            className="mt-7 inline-flex h-12 items-center gap-2 rounded-xl px-5 text-sm font-semibold transition-colors hairline hover:bg-secondary"
          >
            Ask the assistant <ArrowUpRight className="h-4 w-4" />
          </button>
        </Reveal>

        <div className="lg:col-span-8">
          <dl className="divide-y divide-border border-y border-border">
            {FAQS.map((f, k) => {
              const isOpen = open === k
              return (
                <Reveal key={f.q} index={k}>
                  <dt>
                    <button
                      id={`faq-btn-${k}`}
                      onClick={() => setOpen(isOpen ? null : k)}
                      aria-expanded={isOpen}
                      aria-controls={`faq-${k}`}
                      className="group flex w-full items-start gap-5 py-6 text-left"
                    >
                      <span className="figure mt-1 w-6 shrink-0 text-[13px] text-muted-foreground/60">
                        {String(k + 1).padStart(2, "0")}
                      </span>
                      <span
                        className={`flex-1 font-display text-[18px] font-semibold tracking-tight transition-colors sm:text-[19px] ${
                          isOpen ? "text-primary" : "group-hover:text-primary"
                        }`}
                      >
                        {f.q}
                      </span>
                      <span
                        className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full transition-all duration-300 ${
                          isOpen ? "rotate-180 bg-gold text-ink" : "hairline"
                        }`}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </span>
                    </button>
                  </dt>
                  <dd
                    id={`faq-${k}`}
                    role="region"
                    aria-labelledby={`faq-btn-${k}`}
                    className="disclosure"
                    data-open={isOpen}
                  >
                    <div>
                      <p className="pb-7 pl-11 pr-12 text-[15.5px] leading-relaxed text-muted-foreground">{f.a}</p>
                    </div>
                  </dd>
                </Reveal>
              )
            })}
          </dl>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Newsletter                                                           */
/* ------------------------------------------------------------------ */

function Newsletter() {
  const [email, setEmail] = useState("")
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle")

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setState("error")
    setState("busy")
    try {
      await addDoc(collection(db, "newsletterLeads"), {
        email: email.trim().toLowerCase(),
        source: "landing",
        createdAt: serverTimestamp(),
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      })
      setState("done")
    } catch {
      setState("error")
    }
  }

  return (
    <section className="py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="relative overflow-hidden rounded-[2rem] bg-ink text-ink-foreground">
          <div className="absolute inset-0">
            <Photo photo={HERO_PHOTOS[1]} sizes="100vw" className="opacity-30" />
          </div>
          <div className="absolute inset-0 bg-[linear-gradient(90deg,hsl(var(--ink)/.95)_0%,hsl(var(--ink)/.8)_55%,hsl(var(--ink)/.55)_100%)]" aria-hidden />
          <div className="absolute -right-20 -top-28 h-80 w-80 rounded-full bg-gold opacity-25 blur-[90px]" aria-hidden />

          <div className="relative grid items-center gap-9 px-6 py-12 sm:px-12 lg:grid-cols-12 lg:px-16 lg:py-16">
            <div className="lg:col-span-7">
              <p className="text-[11.5px] font-semibold uppercase tracking-[0.18em] text-gold">Public notices</p>
              <h2 className="mt-4 font-display text-[2rem] font-semibold leading-[1.08] tracking-tight text-balance sm:text-[2.6rem]">
                Stay compliant with FCTA advertising laws.
              </h2>
              <p className="mt-4 max-w-xl text-[15.5px] leading-relaxed text-ink-foreground/70">
                Receive regularization exercises, guideline updates and demand-letter notices by email, the day they are
                issued.
              </p>
            </div>

            <div className="lg:col-span-5">
              <div className="relative min-h-[120px]">
                <form
                  onSubmit={submit}
                  aria-hidden={state === "done"}
                  className={`transition-all duration-[420ms] ${state === "done" ? "pointer-events-none -translate-y-2 opacity-0" : "opacity-100"}`}
                >
                  <label htmlFor="lead-email" className="sr-only">
                    Email address
                  </label>
                  <div className="flex flex-col gap-2 rounded-2xl bg-white/[0.08] p-1.5 backdrop-blur sm:flex-row">
                    <input
                      id="lead-email"
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
                      className="h-14 flex-1 rounded-xl bg-transparent px-4 text-[15px] text-ink-foreground outline-none placeholder:text-ink-foreground/40 focus-visible:ring-2 focus-visible:ring-gold"
                    />
                    <button
                      type="submit"
                      disabled={state === "busy"}
                      className="rounded-xl bg-gold px-6 py-3.5 text-[15px] font-semibold text-ink transition hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
                    >
                      {state === "busy" ? "Saving…" : "Get updates"}
                    </button>
                  </div>
                  <p className={`mt-3 text-[12.5px] ${state === "error" ? "text-gold" : "text-ink-foreground/55"}`}>
                    {state === "error" ? "Please enter a valid email address and try again." : "Official notices only. No marketing, unsubscribe any time."}
                  </p>
                </form>

                <div
                  role="status"
                  className={`absolute inset-0 flex items-center gap-4 transition-all duration-500 ${state === "done" ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"}`}
                >
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gold text-ink">
                    <Check className="h-6 w-6" strokeWidth={3} />
                  </span>
                  <div>
                    <p className="font-display text-lg font-semibold">Thank you!</p>
                    <p className="text-[14.5px] text-ink-foreground/70">Your email has been recorded safely. Notices will reach {email}.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Contact                                                              */
/* ------------------------------------------------------------------ */

function Contact() {
  const MAPS_QUERY = "DOAS Katampe Road Jahi Abuja"
  const MAPS_LINK = `https://maps.google.com/?q=${encodeURIComponent(MAPS_QUERY)}`
  const MAPS_EMBED = `https://maps.google.com/maps?q=${encodeURIComponent(MAPS_QUERY)}&z=16&output=embed`

  return (
    <section id="contact" className="scroll-mt-28 border-t border-border bg-card py-20 lg:py-28">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:gap-16 lg:px-8">
        <Reveal className="lg:col-span-5">
          <SectionLabel n="08" label="Contact & location" />
          <h2 className="mt-5 font-display text-[2rem] font-semibold leading-[1.08] tracking-tight sm:text-4xl">
            Visit the Head Office in Jahi.
          </h2>
          <p className="mt-4 text-[15.5px] leading-relaxed text-muted-foreground">
            Walk-in registration, enquiries on demand letters and practitioner matters are handled at the Customer Service Unit
            during office hours.
          </p>
          <dl className="mt-9 space-y-5">
            {[
              { icon: MapPin, k: "Address", v: "Katampe Road, Jahi, Abuja, FCT 900321", href: MAPS_LINK },
              { icon: Phone, k: "Telephone", v: "+234 9 291 9181", href: "tel:+23492919181" },
              { icon: Mail, k: "Email", v: "service@doas.abj.gov.ng", href: "mailto:service@doas.abj.gov.ng" },
            ].map((c) => {
              const Icon = c.icon
              return (
                <div key={c.k} className="group flex gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary transition-colors group-hover:bg-gold group-hover:text-ink">
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">{c.k}</dt>
                    <dd>
                      <a
                        href={c.href}
                        target={c.href.startsWith("http") ? "_blank" : undefined}
                        rel="noreferrer"
                        className="tnum text-[15.5px] font-medium transition-colors hover:text-primary"
                      >
                        {c.v}
                      </a>
                    </dd>
                  </div>
                </div>
              )
            })}
          </dl>

          <div className="mt-9 rounded-2xl bg-secondary/70 p-5 text-[13.5px] leading-relaxed text-secondary-foreground">
            <p className="font-semibold">Office hours</p>
            <p className="mt-1 text-muted-foreground">Monday – Friday, 8:00am – 4:00pm. Closed on public holidays.</p>
          </div>
        </Reveal>

        <Reveal index={1} className="lg:col-span-7">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[1.75rem] bg-secondary hairline sm:aspect-[16/10] lg:aspect-auto lg:h-full lg:min-h-[460px]">
            <iframe
              title="DOAS Head Office location, Katampe Road, Jahi, Abuja"
              src={MAPS_EMBED}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            />

            {/* Overlays: wrapper ignores pointer events so the map stays draggable */}
            <div className="pointer-events-none absolute inset-0">
              <div className="pointer-events-auto absolute left-5 top-5">
                <div className="surface-raised w-max max-w-[240px] rounded-2xl px-4 py-3">
                  <p className="flex items-center gap-2 text-[13px] font-semibold">
                    <span className="relative h-2.5 w-2.5 rounded-full bg-gold ping-dot" />
                    DOAS Head Office
                  </p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">Katampe Road, Jahi · 900321</p>
                </div>
              </div>

              <a
                href={MAPS_LINK}
                target="_blank"
                rel="noreferrer"
                className="pointer-events-auto absolute bottom-4 right-4 inline-flex h-11 items-center gap-2 rounded-xl bg-gold px-5 text-[13.5px] font-semibold text-ink shadow-lg transition-transform hover:brightness-105 active:scale-95"
              >
                Open in Maps <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Footer                                                               */
/* ------------------------------------------------------------------ */

function Footer() {
  const services: { label: string; intent: NotifyIntent }[] = [
    { label: "First-party signage", intent: "first-party" },
    { label: "Third-party billboards", intent: "third-party" },
    { label: "Mobile advert permits", intent: "mobile" },
    { label: "Request a meeting", intent: "meeting" },
    { label: "Verify a permit", intent: "status" },
  ]

  return (
    <footer className="bg-ink text-ink-foreground">
      <div className="h-1 w-full bg-gradient-to-r from-gold via-sky to-primary" aria-hidden />
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <div className="flex items-center gap-3">
              <Image src="/doas-logo.png" alt="" width={44} height={44} className="h-11 w-11" />
              <div className="leading-tight">
                <p className="font-display text-lg font-semibold">DOAS</p>
                <p className="text-[10.5px] uppercase tracking-[0.15em] text-ink-foreground/55">Strategizing for efficiency</p>
              </div>
            </div>
            <p className="mt-6 max-w-sm text-[14px] leading-relaxed text-ink-foreground/65">
              Department of Outdoor Advertisement and Signage, Federal Capital Territory Administration. Regulating outdoor
              advertising for an orderly, beautiful Abuja.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {COUNCILS.map((c) => (
                <span key={c} className="rounded-full border border-white/10 px-3 py-1 text-[11.5px] text-ink-foreground/70">
                  {c}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 text-[14px] md:col-span-7 sm:grid-cols-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-gold">Services</p>
              <ul className="mt-4 space-y-2.5 text-ink-foreground/70">
                {services.map((s) => (
                  <li key={s.label}>
                    <button onClick={() => openNotify(s.intent)} className="text-left transition-colors hover:text-gold">
                      {s.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-gold">Department</p>
              <ul className="mt-4 space-y-2.5 text-ink-foreground/70">
                <li><a href="#mandate" className="transition-colors hover:text-gold">Mandate</a></li>
                <li><a href="#process" className="transition-colors hover:text-gold">How files move</a></li>
                <li><a href="#gallery" className="transition-colors hover:text-gold">Gallery</a></li>
                <li><a href="#faqs" className="transition-colors hover:text-gold">FAQs</a></li>
                <li><Link href="/admin" className="transition-colors hover:text-gold">Staff portal</Link></li>
              </ul>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-gold">Contact</p>
              <ul className="mt-4 space-y-2.5 text-ink-foreground/70">
                <li>Katampe Road, Jahi,<br />Abuja, FCT 900321</li>
                <li><a href="tel:+23492919181" className="tnum transition-colors hover:text-gold">+234 9 291 9181</a></li>
                <li><a href="mailto:service@doas.abj.gov.ng" className="break-all transition-colors hover:text-gold">service@doas.abj.gov.ng</a></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-white/10 pt-7 text-[12.5px] text-ink-foreground/50 md:flex-row md:items-center md:justify-between">
          <p>
            © {new Date().getFullYear()} Department of Outdoor Advertisement and Signage (DOAS) — Federal Capital Territory
            Administration (FCTA). All Rights Reserved.
          </p>
          <p className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-[18px] rounded-[2px] bg-[linear-gradient(90deg,#008751_33%,#fff_33%,#fff_66%,#008751_66%)]"
              aria-hidden
            />
            Abuja · The Heart of Nigeria
          </p>
        </div>
      </div>
    </footer>
  )
}