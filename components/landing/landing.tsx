"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  Check,
  ChevronDown,
  Clock,
  Download,
  FileText,
  Leaf,
  Mail,
  MapPin,
  Menu,
  Navigation,
  Pause,
  Phone,
  Play,
  Quote,
  Search,
  ShieldAlert,
  ShieldCheck,
  Ruler,
  HardHat,
  X,
} from "lucide-react"
import { Reveal, Counter, Words, GrowLine, useInView } from "./reveal"
import { Carousel } from "./carousel"
import { ChatWidget } from "./chat-widget"
import { NotifyDialog, openNotify } from "./notify-dialog"
import {
  ABOUT,
  AUDIENCES,
  CHECKLIST,
  CONTACT,
  COUNCILS,
  DIRECTOR,
  DIVISIONS,
  DOWNLOADS,
  ENVIRONMENT_RULES,
  FAQS,
  GALLERY,
  GUARDRAILS,
  HERO_PHOTOS,
  MANDATE,
  MISSION,
  NOTICES,
  PROCESS,
  REGISTER_FEATURES,
  SAFETY_RULES,
  SERVICES,
  SITING_RULES,
  SPACING,
  TAGLINES,
  VALUES,
  VISION,
  type Audience,
  type Notice,
  type NotifyIntent,
  type Photo as PhotoT,
  type Tone,
} from "./content"
import { db } from "@/lib/firebase"
import { addDoc, collection, serverTimestamp } from "firebase/firestore"

const NAV = [
  { label: "About", href: "#about" },
  { label: "Notices", href: "#notices" },
  { label: "Services", href: "#services" },
  { label: "Standards", href: "#standards" },
  { label: "FAQs", href: "#faqs" },
  { label: "Contact", href: "#contact" },
]

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function Landing() {
  return (
    <div className="min-h-screen overflow-x-clip bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2.5 focus:text-ink-foreground"
      >
        Skip to content
      </a>

      <Header />

      <main id="main">
        <Hero />
        <TaglineMarquee />
        <About />
        <Director />
        <Notices />
        <Services />
        <Process />
        <Prepare />
        <Standards />
        <Gallery />
        <Divisions />
        <Register />
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
/* Shared bits                                                          */
/* ------------------------------------------------------------------ */

/** next/image with a branded fallback while a photo file is missing */
function Photo({
  photo,
  priority = false,
  sizes = "100vw",
  className = "",
}: {
  photo: PhotoT
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

/**
 * The emblem keeps its own proportions (w-auto + object-contain) instead of
 * being forced into a square, and gets clear space around it.
 */
function Logo({ className = "h-14", priority = false }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src="/doas-logo.png"
      alt="DOAS — Department of Outdoor Advertisement and Signage"
      width={240}
      height={240}
      priority={priority}
      className={`w-auto max-w-none object-contain ${className}`}
    />
  )
}

const TONES: Record<Tone, { dot: string; chip: string; bar: string }> = {
  clear: {
    dot: "bg-[hsl(var(--state-clear))]",
    chip: "bg-[hsl(var(--state-clear-soft))] text-[hsl(var(--state-clear))]",
    bar: "bg-[hsl(var(--state-clear))]",
  },
  wait: {
    dot: "bg-[hsl(var(--state-wait))]",
    chip: "bg-[hsl(var(--state-wait-soft))] text-[hsl(var(--state-wait))]",
    bar: "bg-[hsl(var(--state-wait))]",
  },
  stop: {
    dot: "bg-[hsl(var(--state-stop))]",
    chip: "bg-[hsl(var(--state-stop-soft))] text-[hsl(var(--state-stop))]",
    bar: "bg-[hsl(var(--state-stop))]",
  },
  move: {
    dot: "bg-[hsl(var(--state-move))]",
    chip: "bg-[hsl(var(--state-move-soft))] text-[hsl(var(--state-move))]",
    bar: "bg-[hsl(var(--state-move))]",
  },
  idle: {
    dot: "bg-[hsl(var(--state-idle))]",
    chip: "bg-[hsl(var(--state-idle-soft))] text-[hsl(var(--state-idle))]",
    bar: "bg-[hsl(var(--state-idle))]",
  },
}

function StatusChip({ tone, label, dark = false, pulse = false }: { tone: Tone; label: string; dark?: boolean; pulse?: boolean }) {
  const t = TONES[tone]
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-semibold leading-none ${
        dark ? "bg-white/10 text-ink-foreground" : t.chip
      }`}
    >
      <span className={`relative h-1.5 w-1.5 shrink-0 rounded-full ${t.dot} ${pulse ? "ping-dot" : ""}`} />
      {label}
    </span>
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

const H2 = "font-display text-[2rem] font-semibold leading-[1.08] tracking-tight text-balance sm:text-4xl lg:text-[2.9rem]"

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
      setScrolled(y > 24)
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
          <p className="flex min-w-0 items-center gap-2.5">
            <span
              className="inline-block h-3 w-[18px] shrink-0 rounded-[2px] bg-[linear-gradient(90deg,#008751_33%,#fff_33%,#fff_66%,#008751_66%)]"
              aria-hidden
            />
            <span className="truncate">A department of the Federal Capital Territory Administration</span>
          </p>
          <p className="hidden items-center gap-4 tnum md:flex">
            <span>{CONTACT.hoursShort}</span>
            <span className="h-3 w-px bg-white/20" aria-hidden />
            {CONTACT.phones.map((p) => (
              <a key={p.tel} href={`tel:${p.tel}`} className="transition-colors hover:text-gold">
                {p.display}
              </a>
            ))}
          </p>
        </div>
      </div>

      <header
        className={[
          "sticky top-0 z-50 transition-all duration-300",
          scrolled ? "bg-background/85 shadow-[0_1px_0_0_hsl(var(--border))] backdrop-blur-xl" : "bg-background",
        ].join(" ")}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className={`flex items-center justify-between gap-6 transition-[height] duration-300 ${scrolled ? "h-[76px]" : "h-[92px]"}`}>
            <Link href="/" className="group flex shrink-0 items-center gap-4 py-2" aria-label="DOAS home">
              <span className="relative flex items-center">
                <span
                  className="absolute -inset-2 rounded-full bg-gold/0 transition-colors duration-300 group-hover:bg-gold/20"
                  aria-hidden
                />
                <Logo priority className={`relative transition-all duration-300 ${scrolled ? "h-11 sm:h-12" : "h-12 sm:h-[60px]"}`} />
              </span>
              <span className="hidden h-10 w-px bg-border sm:block" aria-hidden />
              <span className="leading-none">
                <span className="block font-display text-[20px] font-semibold tracking-tight sm:text-[22px]">DOAS</span>
                <span className="mt-1.5 block text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground sm:text-[10.5px]">
                  Department of Outdoor Advertisement &amp; Signage
                </span>
                <span className="mt-1 hidden text-[11px] text-muted-foreground/80 sm:block">FCT Administration · Abuja</span>
              </span>
            </Link>

            <nav className="hidden items-center gap-6 lg:flex xl:gap-8" aria-label="Primary">
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
                className="hidden h-11 items-center gap-2 rounded-xl px-4 text-sm font-medium text-foreground/80 transition-colors hover:bg-secondary xl:inline-flex"
              >
                <Search className="h-4 w-4" />
                Verify a permit
              </button>
              <a
                href="#services"
                className="sheen inline-flex h-11 items-center gap-2 rounded-xl bg-ink px-5 text-sm font-semibold text-ink-foreground transition-transform active:scale-[0.98]"
              >
                Find a service
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>

            <button
              onClick={() => setOpen(true)}
              className="-mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-xl text-foreground hover:bg-secondary lg:hidden"
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
        className={`fixed inset-0 z-[60] overflow-hidden transition lg:hidden ${open ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!open}
      >
        <div
          onClick={() => setOpen(false)}
          className={`absolute inset-0 bg-ink/70 backdrop-blur-sm transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
        />
        <div
          className={`absolute right-0 top-0 flex h-full w-[88%] max-w-sm flex-col bg-card shadow-2xl transition-transform duration-[420ms] ease-out ${
            open ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex h-24 items-center justify-between border-b border-border px-5">
            <div className="flex items-center gap-3">
              <Logo className="h-11" />
              <p className="font-display text-lg font-semibold">Menu</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="grid h-11 w-11 place-items-center rounded-xl hover:bg-secondary"
              aria-label="Close menu"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <nav className="flex flex-col overflow-y-auto px-3 py-4" aria-label="Mobile">
            {NAV.map((n, i) => (
              <a
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                style={{ transitionDelay: `${open ? 90 + i * 45 : 0}ms` }}
                className={`flex items-center justify-between rounded-xl px-3 py-3.5 text-[17px] font-medium transition-all duration-300 hover:bg-secondary ${
                  open ? "translate-x-0 opacity-100" : "translate-x-5 opacity-0"
                }`}
              >
                {n.label}
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </a>
            ))}
          </nav>
          <div className="mt-auto space-y-2 border-t border-border p-5">
            <a
              href="#services"
              onClick={() => setOpen(false)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink py-3.5 font-semibold text-ink-foreground"
            >
              Find a service <ArrowRight className="h-4 w-4" />
            </a>
            <button
              onClick={() => {
                setOpen(false)
                openNotify("status")
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-medium hairline"
            >
              <Search className="h-4 w-4" /> Verify a permit
            </button>
            <div className="flex justify-center gap-4 pt-2 text-xs text-muted-foreground tnum">
              {CONTACT.phones.map((p) => (
                <a key={p.tel} href={`tel:${p.tel}`} className="hover:text-foreground">
                  {p.display}
                </a>
              ))}
            </div>
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
      aria-label="Abuja photography"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return
        const dx = e.changedTouches[0].clientX - touchX.current
        if (Math.abs(dx) > 48) go(dx < 0 ? i + 1 : i - 1)
        touchX.current = null
      }}
    >
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
      <div
        className="absolute inset-0 bg-[linear-gradient(90deg,hsl(var(--ink)/.94)_0%,hsl(var(--ink)/.76)_40%,hsl(var(--ink)/.35)_72%,hsl(var(--ink)/.2)_100%)]"
        aria-hidden
      />
      <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-ink to-transparent" aria-hidden />
      <div
        className="absolute inset-0 grid-paper opacity-[0.07] [--border:48_30%_96%] [mask-image:radial-gradient(ellipse_at_20%_40%,black_10%,transparent_65%)]"
        aria-hidden
      />

      <div className="relative mx-auto flex min-h-[88svh] max-w-7xl flex-col justify-end px-4 pb-12 pt-20 sm:px-6 lg:min-h-[90vh] lg:px-8 lg:pb-16 lg:pt-24">
        <Reveal index={0}>
          <p className="inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-[11.5px] font-semibold uppercase tracking-[0.16em] text-gold backdrop-blur">
            <span className="relative h-2 w-2 rounded-full bg-gold ping-dot" />
            FCT Administration · Abuja
          </p>
        </Reveal>

      <h1 className="mt-7 font-display text-[2.15rem] font-semibold leading-[1.04] tracking-tight sm:text-6xl lg:text-[4.75rem]">
  <Words text="Every iconic billboard" as="span" className="block" />
  <Words text="shining across Abuja," as="span" className="block" start={3} />
  <Words text="starts right here." as="span" className="mt-1 block text-gold" start={7} />
</h1>


        <div className="mt-8 max-w-2xl">
          <div>
            <Reveal index={4} as="p" className="max-w-xl text-[17px] leading-relaxed text-ink-foreground/80 sm:text-[18px]">
              DOAS is the FCTA department that looks after billboards and signs across Abuja. We approve sites, check that
              structures are safe, and step in when something goes up where it shouldn&rsquo;t. Whether you run an advertising
              company or just want a sign over your shop, this is where you start.
            </Reveal>

            <Reveal index={5} className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a
                href="#notices"
                className="group inline-flex h-[56px] items-center justify-center gap-2.5 rounded-2xl bg-gold px-7 text-[15px] font-semibold text-ink shadow-[0_18px_40px_-16px_hsl(46_90%_40%/.7)] transition-transform hover:brightness-105 active:scale-[0.98]"
              >
                Read current notices
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
              <a
                href="#services"
                className="inline-flex h-[56px] items-center justify-center gap-2.5 rounded-2xl border border-white/15 bg-white/[0.06] px-7 text-[15px] font-semibold text-ink-foreground backdrop-blur transition-colors hover:bg-white/10"
              >
                Find a service
              </a>
            </Reveal>

            <Reveal index={6} className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-2.5 text-[13.5px] text-ink-foreground/70">
              {["Deal with us directly, not middlemen", "Only pay against an official DOAS bill"].map((t) => (
                <span key={t} className="inline-flex items-center gap-2">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-[hsl(var(--state-clear))]">
                    <Check className="h-3 w-3 text-white" strokeWidth={3.5} />
                  </span>
                  {t}
                </span>
              ))}
            </Reveal>
          </div>
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
                    style={{
                      width: k < i ? "100%" : k === i ? (playing && !reduced ? undefined : "100%") : "0%",
                      ["--hero-interval" as string]: `${HERO_INTERVAL}ms`,
                    }}
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
/* Tagline marquee                                                      */
/* ------------------------------------------------------------------ */

function TaglineMarquee() {
  const items = [...TAGLINES, ...TAGLINES]
  return (
    <div className="overflow-hidden border-b border-gold/40 bg-gold text-ink" aria-label="DOAS taglines">
      <div className="mask-fade-x relative flex h-14 items-center">
        <div className="marquee flex w-max items-center gap-12 font-display text-[17px] font-semibold tracking-tight sm:text-[19px]">
          {items.map((n, k) => (
            <span key={k} className="flex items-center gap-12 whitespace-nowrap" aria-hidden={k >= TAGLINES.length}>
              {n}
              <span className="h-2 w-2 rotate-45 bg-ink/70" aria-hidden />
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Jurisdiction strip                                                   */
/* ------------------------------------------------------------------ */



/* ------------------------------------------------------------------ */
/* About — identity, mandate, vision, mission, values                   */
/* ------------------------------------------------------------------ */

function About() {
  return (
    <section id="about" className="scroll-mt-28 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-7">
            <Reveal>
              <SectionLabel n="01" label="About DOAS" />
              <h2 className={`mt-5 ${H2}`}>The regulator of Out-Of-Home advertising and signage in the FCT.</h2>
            </Reveal>
            <Reveal index={1} as="p" className="mt-7 font-display text-[21px] leading-snug text-foreground sm:text-[23px]">
              {ABOUT.lead}
            </Reveal>
            {ABOUT.body.map((p, k) => (
              <Reveal key={k} index={2 + k} as="p" className="mt-5 text-[16.5px] leading-relaxed text-muted-foreground">
                {p}
              </Reveal>
            ))}

            <Reveal index={4} className="mt-10">
              <p className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Our mandate</p>
              <ol className="mt-4 divide-y divide-border border-y border-border">
                {MANDATE.map((m, k) => (
                  <li key={k} className="group flex gap-5 py-4">
                    <span className="figure mt-0.5 w-6 shrink-0 text-[13px] text-muted-foreground/60 transition-colors group-hover:text-primary">
                      {String(k + 1).padStart(2, "0")}
                    </span>
                    <span className="text-[15.5px] leading-relaxed">{m}</span>
                  </li>
                ))}
              </ol>
            </Reveal>
          </div>

          <div className="flex flex-col gap-5 lg:col-span-5 lg:pt-14">
            <Reveal index={1} className="relative overflow-hidden rounded-[1.75rem] bg-ink p-7 text-ink-foreground sm:p-9">
              <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold opacity-25 blur-[70px]" aria-hidden />
              <div className="absolute inset-0 grid-paper opacity-[0.06] [--border:48_30%_96%]" aria-hidden />
              <div className="relative">
                <p className="flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.18em] text-gold">
                  <span className="h-px w-6 bg-gold" /> Vision
                </p>
                <p className="mt-4 font-display text-[21px] font-medium leading-snug tracking-tight sm:text-[23px]">{VISION}</p>
              </div>
            </Reveal>
            <Reveal index={2} className="rounded-[1.75rem] bg-card p-7 hairline sm:p-9">
              <p className="flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.18em] text-primary">
                <span className="h-px w-6 bg-gold" /> Mission
              </p>
              <p className="mt-4 font-display text-[19px] font-medium leading-snug tracking-tight sm:text-[21px]">{MISSION}</p>
            </Reveal>
            <Reveal index={3} className="relative aspect-[16/10] overflow-hidden rounded-[1.75rem] hairline">
              <Photo photo={GALLERY[2]} sizes="(min-width:1024px) 40vw, 100vw" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/85 to-transparent p-5 text-[12.5px] text-ink-foreground/85">
                {GALLERY[2].caption}
              </div>
            </Reveal>
          </div>
        </div>

        {/* values */}
        <div className="mt-16 lg:mt-20">
          <Reveal className="flex items-end justify-between gap-6">
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Core values</p>
            <GrowLine className="max-w-[60%] flex-1" />
          </Reveal>
          <div className="mt-6 grid gap-px overflow-hidden rounded-3xl bg-border hairline sm:grid-cols-2 lg:grid-cols-5">
            {VALUES.map((v, k) => {
              const Icon = v.icon
              return (
                <Reveal key={v.name} index={k} className="group relative bg-card p-6 sm:p-7">
                  <span className="absolute left-0 top-0 h-1 w-0 bg-gold transition-[width] duration-700 group-hover:w-full" aria-hidden />
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-gold/25 text-gold-ink transition-colors group-hover:bg-gold group-hover:text-ink">
                    <Icon className="h-5 w-5" />
                  </span>
                  <p className="mt-5 font-display text-[19px] font-semibold tracking-tight">{v.name}</p>
                  <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{v.body}</p>
                </Reveal>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Director                                                             */
/* ------------------------------------------------------------------ */

function Director() {
  const portrait: PhotoT = {
    src: DIRECTOR.portrait,
    alt: `${DIRECTOR.name}, ${DIRECTOR.title}, Department of Outdoor Advertisement and Signage`,
    caption: "",
    place: "",
  }
  return (
    <section id="director" className="relative scroll-mt-28 overflow-hidden bg-ink py-20 text-ink-foreground lg:py-28">
      <div className="absolute inset-0 grid-paper opacity-[0.07] [--border:48_30%_96%]" aria-hidden />
      <div className="absolute -right-24 top-0 h-96 w-96 rounded-full bg-gold opacity-20 blur-[110px]" aria-hidden />
      <div className="absolute -left-24 bottom-0 h-80 w-80 rounded-full bg-sky opacity-15 blur-[110px]" aria-hidden />

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:gap-16 lg:px-8">
        <Reveal className="lg:col-span-5">
          <div className="relative mx-auto aspect-[4/5] max-w-md overflow-hidden rounded-[2rem]">
            <Photo photo={portrait} sizes="(min-width:1024px) 40vw, 90vw" />
            <div className="absolute inset-0 ring-1 ring-inset ring-white/10" aria-hidden />
           
          </div>
        </Reveal>

        <div className="lg:col-span-7">
          <Reveal>
            <SectionLabel n="02" label="From the Overseeing Director" light />
          </Reveal>
          <Reveal index={1}>
            <Quote className="mt-6 h-9 w-9 text-gold" aria-hidden />
            <blockquote className="mt-4 font-display text-[1.4rem] font-medium leading-[1.38] tracking-tight text-balance sm:text-[1.65rem]">
              {DIRECTOR.welcome}
            </blockquote>
          
          </Reveal>

          <Reveal index={2} className="mt-9 border-t border-white/10 pt-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-foreground/50">Leadership priorities</p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {DIRECTOR.priorities.map((p) => (
                <li
                  key={p}
                  className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3.5 py-2 text-[13px] text-ink-foreground/85"
                >
                  <span className="h-1.5 w-1.5 rotate-45 bg-gold" aria-hidden />
                  {p}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal index={3} className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={() => openNotify("meeting")}
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-gold px-6 text-sm font-semibold text-ink transition-transform hover:brightness-105 active:scale-[0.98]"
            >
              Request a meeting <ArrowRight className="h-4 w-4" />
            </button>
            <a
              href="#divisions"
              className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-6 text-sm font-semibold backdrop-blur transition-colors hover:bg-white/10"
            >
              Divisions &amp; units
            </a>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Notices & circulars                                                  */
/* ------------------------------------------------------------------ */

type NoticeState = { tone: Tone; label: string; archived: boolean }

/** Time-boxed exercises archive themselves after their deadline; standing orders stay in force. */
function noticeState(n: Notice, now: number | null): NoticeState | null {
  if (n.closes) {
    if (now === null) return null
    const opens = n.opens ? Date.parse(n.opens) : -Infinity
    const closes = Date.parse(n.closes)
    if (now < opens) return { tone: "move", label: "Opens soon", archived: false }
    if (now <= closes) {
      const days = Math.ceil((closes - now) / 86_400_000)
      return { tone: "clear", label: days <= 1 ? "Open · closes today" : `Open · ${days} days left`, archived: false }
    }
    return { tone: "idle", label: "Closed", archived: true }
  }
  return { tone: n.tone ?? "move", label: n.category === "Circular" || n.category === "Standard" ? "Current" : "In force", archived: false }
}

function Notices() {
  const [now, setNow] = useState<number | null>(null)
  const [tab, setTab] = useState<"active" | "archive">("active")

  useEffect(() => {
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const rows = useMemo(
    () =>
      NOTICES.map((n) => ({ n, s: noticeState(n, now) })).filter((r): r is { n: Notice; s: NoticeState } => r.s !== null),
    [now],
  )
  const active = rows.filter((r) => !r.s.archived)
  const archive = rows.filter((r) => r.s.archived)
  const featured = tab === "active" ? active.find((r) => r.n.id === "stop-work") : undefined
  const list = (tab === "active" ? active : archive).filter((r) => r !== featured)

  return (
    <section id="notices" className="scroll-mt-28 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <Reveal className="max-w-2xl">
            <SectionLabel n="03" label="Notices & circulars" />
            <h2 className={`mt-5 ${H2}`}>What is in force right now.</h2>
            <p className="mt-4 text-[16.5px] leading-relaxed text-muted-foreground">
              Orders, circulars and exercises issued to practitioners and the public. Deadlines are in West Africa Time (WAT);
              closed exercises move to the archive with their dates preserved.
            </p>
          </Reveal>

          <Reveal index={1}>
            <div role="tablist" aria-label="Notice status" className="inline-flex rounded-2xl bg-secondary p-1">
              {(
                [
                  { id: "active", label: "Active", n: active.length },
                  { id: "archive", label: "Archive", n: archive.length },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[14px] font-semibold transition-all ${
                    tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                  <span
                    className={`figure grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] ${
                      tab === t.id ? "bg-ink text-ink-foreground" : "bg-background"
                    }`}
                  >
                    {t.n}
                  </span>
                </button>
              ))}
            </div>
          </Reveal>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-12">
          <div key={tab} className="fade-in space-y-4 lg:col-span-8">
            {featured && (
              <article className="relative overflow-hidden rounded-3xl bg-ink p-7 text-ink-foreground sm:p-9">
                <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[hsl(var(--state-stop))] opacity-25 blur-[90px]" aria-hidden />
                <div className="relative">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--state-stop))] px-2.5 py-1 text-[11.5px] font-semibold leading-none text-white">
                      <span className="relative h-1.5 w-1.5 rounded-full bg-white ping-dot" />
                      {featured.s.label}
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-foreground/55">
                      {featured.n.category}
                    </span>
                  </div>
                  <h3 className="mt-4 font-display text-[24px] font-semibold leading-tight tracking-tight sm:text-[28px]">
                    {featured.n.title}
                  </h3>
                  <p className="mt-1.5 text-[12.5px] text-ink-foreground/55">{featured.n.source}</p>
                  <p className="mt-5 text-[16px] leading-relaxed text-ink-foreground/85">{featured.n.summary}</p>
                  <ul className="mt-5 space-y-2.5">
                    {featured.n.points.map((p) => (
                      <li key={p} className="flex gap-3 text-[14.5px] leading-relaxed text-ink-foreground/75">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rotate-45 bg-gold" aria-hidden />
                        {p}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => openNotify("site")}
                    className="mt-7 inline-flex h-11 items-center gap-2 rounded-xl bg-gold px-5 text-[14px] font-semibold text-ink transition-transform hover:brightness-105 active:scale-[0.98]"
                  >
                    Ask about a written exemption <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </article>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              {list.map(({ n, s }) => (
                <article key={n.id} className="relative flex flex-col overflow-hidden rounded-3xl bg-card p-6 hairline">
                  <span className={`absolute inset-y-0 left-0 w-1 ${TONES[s.tone].bar}`} aria-hidden />
                  <div className="flex flex-wrap items-center gap-2.5">
                    <StatusChip tone={s.tone} label={s.label} />
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{n.category}</span>
                  </div>
                  <h3 className="mt-4 font-display text-[19px] font-semibold leading-snug tracking-tight">{n.title}</h3>
                  <p className="mt-1 text-[12.5px] text-muted-foreground">{n.source}</p>
                  <p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground">{n.summary}</p>
                  {n.points.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {n.points.map((p) => (
                        <li key={p} className="flex gap-2.5 text-[13.5px] leading-relaxed">
                          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rotate-45 bg-gold" aria-hidden />
                          {p}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-auto pt-5">
                    {n.window && (
                      <p className="flex items-center gap-2 rounded-xl bg-secondary/70 px-3.5 py-2.5 text-[13px] font-medium tnum">
                        <CalendarClock className="h-4 w-4 shrink-0 text-primary" />
                        {n.window}
                      </p>
                    )}
                    {s.archived && (
                      <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">
                        Missed this window? Contact the Customer Service Unit with your documents.
                      </p>
                    )}
                    {n.link && (
                      <a
                        href={n.link.href}
                        className="mt-3 inline-flex items-center gap-1.5 text-[14px] font-semibold text-primary transition-colors hover:text-foreground"
                      >
                        {n.link.label} <ArrowRight className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>

            {tab === "archive" && archive.length === 0 && (
              <p className="rounded-3xl bg-card p-8 text-center text-[15px] text-muted-foreground hairline">
                No archived notices yet.
              </p>
            )}
          </div>

          {/* forms & downloads */}
          <aside className="space-y-4 lg:col-span-4">
            <Reveal className="rounded-3xl bg-card p-6 hairline lg:sticky lg:top-28">
              <p className="font-display text-[19px] font-semibold tracking-tight">Forms &amp; downloads</p>
              <p className="mt-1 text-[13.5px] text-muted-foreground">Official versions only. Forms not yet online are issued at CSU.</p>
              <ul className="mt-5 divide-y divide-border">
                {DOWNLOADS.map((d) => (
                  <li key={d.title} className="flex items-start gap-3 py-3.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-secondary">
                      <FileText className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-medium leading-snug">{d.title}</p>
                      <p className="text-[12px] text-muted-foreground">{d.note}</p>
                    </div>
                    {d.href ? (
                      <a
                        href={d.href}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors hover:bg-ink hover:text-ink-foreground hairline"
                        aria-label={`Download ${d.title}`}
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    ) : (
                      <span className="mt-1 shrink-0 rounded-full bg-secondary px-2 py-1 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                        At CSU
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => openNotify("general")}
                className="sheen mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink text-[14px] font-semibold text-ink-foreground transition-transform active:scale-[0.98]"
              >
                <Mail className="h-4 w-4" /> Get new notices by email
              </button>
            </Reveal>
          </aside>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Services                                                             */
/* ------------------------------------------------------------------ */

function Services() {
  const [aud, setAud] = useState<Audience | "all">("all")
  const list = aud === "all" ? SERVICES : SERVICES.filter((s) => s.audience === aud)
  const tabs = [
    { id: "all" as const, label: "All services", n: SERVICES.length },
    ...AUDIENCES.map((a) => ({ id: a.id, label: a.label, n: SERVICES.filter((s) => s.audience === a.id).length })),
  ]
  const blurb = aud === "all" ? null : AUDIENCES.find((a) => a.id === aud)?.blurb

  return (
    <section id="services" className="scroll-mt-28 border-y border-border bg-card py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="max-w-3xl">
          <SectionLabel n="04" label="Services" />
          <h2 className={`mt-5 ${H2}`}>Find the right service.</h2>
          <p className="mt-4 text-[16.5px] leading-relaxed text-muted-foreground">
            Every submission goes through the Customer Service Unit in Jahi. Online filing is being prepared — leave your email on
            any service and we will write to you the day it opens.
          </p>
        </Reveal>

        <Reveal index={1} className="mt-10">
          <div role="tablist" aria-label="Filter services" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={aud === t.id}
                onClick={() => setAud(t.id)}
                className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-[14px] font-semibold transition-all ${
                  aud === t.id ? "bg-ink text-ink-foreground" : "bg-background text-foreground/75 hairline hover:text-foreground"
                }`}
              >
                {t.label}
                <span className={`figure text-[12px] ${aud === t.id ? "text-gold" : "text-muted-foreground"}`}>{t.n}</span>
              </button>
            ))}
          </div>
          {blurb && <p className="fade-in mt-4 text-[14.5px] text-muted-foreground">{blurb}</p>}
        </Reveal>

        <div key={aud} className="fade-in mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((s) => {
            const Icon = s.icon
            return (
              <article
                key={s.title}
                className="group flex h-full flex-col rounded-3xl bg-background p-6 transition-all duration-300 hairline hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-30px_hsl(101_50%_6%/.45)] sm:p-7"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-secondary transition-colors duration-300 group-hover:bg-gold group-hover:text-ink">
                    <Icon className="h-5 w-5" />
                  </span>
                  <StatusChip tone={s.status.tone} label={s.status.label} />
                </div>
                <h3 className="mt-5 font-display text-[19px] font-semibold leading-snug tracking-tight">{s.title}</h3>
                <p className="mt-2.5 text-[14.5px] leading-relaxed text-muted-foreground">{s.body}</p>
                <ul className="mt-4 space-y-1.5">
                  {s.points.map((p) => (
                    <li key={p} className="flex gap-2 text-[13.5px] leading-snug">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--state-clear))]" strokeWidth={3} />
                      {p}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Handled by</p>
                  <p className="mt-0.5 text-[13.5px] font-medium text-primary">{s.unit}</p>
                  <button
                    onClick={() => openNotify(s.intent)}
                    className="mt-4 inline-flex h-11 w-full items-center justify-between gap-2 rounded-xl bg-secondary px-4 text-left text-[14px] font-semibold transition-colors group-hover:bg-ink group-hover:text-ink-foreground"
                  >
                    {s.cta}
                    <ArrowRight className="h-4 w-4 shrink-0 transition-transform duration-300 group-hover:translate-x-1" />
                  </button>
                </div>
              </article>
            )
          })}

          {/* help card — always completes the last row */}
          <article className="relative flex h-full flex-col overflow-hidden rounded-3xl bg-ink p-6 text-ink-foreground sm:p-7">
            <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-gold opacity-20 blur-[70px]" aria-hidden />
            <span className="relative grid h-12 w-12 place-items-center rounded-2xl bg-gold text-ink">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <h3 className="relative mt-5 font-display text-[21px] font-semibold leading-snug tracking-tight">
              Not sure which service you need?
            </h3>
            <p className="relative mt-2.5 text-[14.5px] leading-relaxed text-ink-foreground/70">
              Call the Customer Service Unit. For a complex site, a large-format structure or a policy question, request a
              meeting with the Office of the Overseeing Director.
            </p>
            <div className="relative mt-5 flex flex-col gap-1.5">
              {CONTACT.phones.map((p) => (
                <a
                  key={p.tel}
                  href={`tel:${p.tel}`}
                  className="inline-flex items-center gap-2.5 text-[15px] font-semibold tnum text-ink-foreground transition-colors hover:text-gold"
                >
                  <Phone className="h-4 w-4 text-gold" /> {p.display}
                </a>
              ))}
            </div>
            <div className="relative mt-auto pt-6">
              <button
                onClick={() => openNotify("meeting")}
                className="inline-flex h-11 w-full items-center justify-between gap-2 rounded-xl bg-gold px-4 text-[14px] font-semibold text-ink transition-transform hover:brightness-105 active:scale-[0.98]"
              >
                Request a meeting <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </article>
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
            <SectionLabel n="05" label="How an application moves" />
            <h2 className={`mt-5 ${H2}`}>One file. Every step on the record.</h2>
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
          <ol ref={ref} className="grid gap-9 lg:grid-cols-6 lg:gap-6">
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
                  <h3 className="mt-1.5 font-display text-[18px] font-semibold leading-snug tracking-tight">{p.step}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{p.note}</p>
                </div>
                {k < PROCESS.length - 1 && (
                  <span className="absolute bottom-[-2.25rem] left-[17px] top-9 w-px bg-border lg:hidden" aria-hidden />
                )}
              </li>
            ))}
          </ol>
        </div>

        <Reveal index={2} className="mt-14 grid gap-px overflow-hidden rounded-3xl bg-border text-[14px] hairline sm:grid-cols-3">
          {GUARDRAILS.map((c) => (
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
/* Prepare — checklist + payments                                       */
/* ------------------------------------------------------------------ */

function Prepare() {
  return (
    <section className="border-y border-border bg-card py-20 lg:py-28">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:gap-16 lg:px-8">
        <div className="lg:col-span-5">
          <Reveal>
            <SectionLabel n="06" label="Before you visit CSU" />
            <h2 className="mt-5 font-display text-[2rem] font-semibold leading-[1.08] tracking-tight text-balance sm:text-4xl">
              What to bring for a billboard site submission.
            </h2>
            <p className="mt-4 text-[15.5px] leading-relaxed text-muted-foreground">
              One billboard site per submission form. The Customer Service Unit records what you hand in and gives you an
              acknowledgement copy with a reference number.
            </p>
          </Reveal>

          <Reveal index={1} className="mt-8 overflow-hidden rounded-3xl bg-ink p-6 text-ink-foreground sm:p-7">
            <p className="flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.16em] text-gold">
              <span className="h-px w-6 bg-gold" /> Fees &amp; payments
            </p>
            <dl className="mt-5 space-y-4 text-[14px]">
              <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
                <div>
                  <dt className="font-semibold">Revalidation certification</dt>
                  <dd className="mt-0.5 text-[12.5px] text-ink-foreground/60">Per successful practitioner · Remita · after written notice</dd>
                </div>
                <dd className="figure shrink-0 text-[18px] font-semibold text-gold">₦1,000,000</dd>
              </div>
              <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
                <div>
                  <dt className="font-semibold">Newly approved billboard sites</dt>
                  <dd className="mt-0.5 text-[12.5px] text-ink-foreground/60">Bills on existing or old structures remain payable</dd>
                </div>
                <dd className="shrink-0">
                  <StatusChip tone="wait" label="Suspended" dark />
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <dt className="font-semibold">All other charges</dt>
                  <dd className="mt-0.5 text-[12.5px] text-ink-foreground/60">As stated on your official DOAS bill — never to an individual</dd>
                </div>
                <dd className="shrink-0 text-[12.5px] font-semibold text-ink-foreground/70">On your bill</dd>
              </div>
            </dl>
            <button
              onClick={() => openNotify("billing")}
              className="mt-6 inline-flex items-center gap-2 text-[14px] font-semibold text-gold transition-colors hover:text-ink-foreground"
            >
              Query a bill or verify a payment <ArrowRight className="h-4 w-4" />
            </button>
          </Reveal>
        </div>

        <div className="lg:col-span-7">
          <div className="grid gap-4 sm:grid-cols-2">
            {CHECKLIST.map((c, k) => (
              <Reveal
                key={c.t}
                index={k}
                className="group flex gap-4 rounded-2xl bg-background p-5 transition-shadow hairline hover:shadow-[0_20px_40px_-28px_hsl(101_50%_6%/.45)]"
              >
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
          <Reveal index={3} className="mt-4 flex gap-4 rounded-2xl bg-[hsl(var(--state-wait-soft))] p-5 text-[14px] leading-relaxed">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(var(--state-wait))]" />
            <p>
              <span className="font-semibold">Before any construction or maintenance</span> you also need a Setting Out
              Certificate and every other applicable written approval. While the stop-work order is in force, new structural
              work needs express written clearance from DOAS.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Safety & standards                                                   */
/* ------------------------------------------------------------------ */

function SpacingChart() {
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.25 })
  const ticks = [0, 250, 500, 750, 1000]
  return (
    <div ref={ref} className="h-full rounded-3xl bg-card p-6 hairline sm:p-8">
      <p className="font-display text-[20px] font-semibold tracking-tight">Minimum board-to-board spacing</p>
      <p className="mt-1 text-[13.5px] text-muted-foreground">New structures · distance between boards of the same type</p>

      <ul className="mt-7 space-y-3.5" aria-label="Minimum spacing by billboard type">
        {SPACING.map((s, k) => (
          <li key={s.type} className="grid grid-cols-[7.25rem_1fr_3.5rem] items-center gap-3 sm:grid-cols-[10rem_1fr_4rem]">
            <span className="text-[13.5px] font-medium leading-tight">
              {s.type}
              {s.note && <span className="block text-[11px] font-normal text-muted-foreground">{s.note}</span>}
            </span>
            <span className="relative h-3 overflow-hidden rounded-full bg-muted" aria-hidden>
              <span
                className={`absolute inset-y-0 left-0 origin-left rounded-full ${
                  s.note ? "bg-primary/35" : s.m >= 1000 ? "bg-ink dark:bg-gold" : "bg-primary"
                }`}
                style={{
                  width: `${(s.m / 1000) * 100}%`,
                  transform: inView ? "scaleX(1)" : "scaleX(0)",
                  transition: `transform 1s cubic-bezier(.65,0,.35,1) ${k * 70}ms`,
                }}
              />
            </span>
            <span className="figure text-right text-[14px] font-semibold">{s.m >= 1000 ? `${s.m / 1000} km` : `${s.m} m`}</span>
          </li>
        ))}
      </ul>

      <div className="mt-2 grid grid-cols-[7.25rem_1fr_3.5rem] gap-3 sm:grid-cols-[10rem_1fr_4rem]" aria-hidden>
        <span />
        <div className="relative h-5">
          {ticks.map((t) => (
            <span
              key={t}
              className="figure absolute top-1 -translate-x-1/2 whitespace-nowrap text-[10.5px] text-muted-foreground/70 first:translate-x-0 last:-translate-x-full"
              style={{ left: `${(t / 1000) * 100}%` }}
            >
              {t === 1000 ? "1 km" : t}
            </span>
          ))}
        </div>
        <span />
      </div>

      <p className="mt-5 border-t border-border pt-4 text-[12.5px] leading-relaxed text-muted-foreground">
        Stricter site-specific directions apply where issued. Meeting the minimum does not by itself make a site approved.
      </p>
    </div>
  )
}

function Standards() {
  const stats = [
    { v: 1, s: " km", l: "Minimum spacing for gantries, eye catchers and flag poles" },
    { v: 2, s: "", l: "Maximum alternating billboards at any junction or intersection" },
    { v: 21, s: " days", l: "To remove a structure under high-tension lines, from the date of notice" },
  ]
  const groups = [
    { icon: Ruler, t: "Siting rules", items: SITING_RULES },
    { icon: Leaf, t: "Environmental protection", items: ENVIRONMENT_RULES },
    { icon: HardHat, t: "Safety on site", items: SAFETY_RULES },
  ]

  return (
    <section id="standards" className="scroll-mt-28 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="max-w-3xl">
          <SectionLabel n="07" label="Safety & standards" />
          <h2 className={`mt-5 ${H2}`}>Built safe. Spaced right. Kept clean.</h2>
          <p className="mt-4 text-[16.5px] leading-relaxed text-muted-foreground">
            Every practitioner observes the DOAS Health, Safety and Environment policy during installation, maintenance, flex
            replacement, campaign changes, dismantling and every other site activity. These are the standards adopted for the
            FCT in September 2026.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-5 lg:grid-cols-12">
          <Reveal className="lg:col-span-8">
            <SpacingChart />
          </Reveal>
          <div className="grid gap-5 sm:grid-cols-3 lg:col-span-4 lg:grid-cols-1">
            {stats.map((s, k) => (
              <Reveal key={s.l} index={k + 1} className="group relative overflow-hidden rounded-3xl bg-ink p-6 text-ink-foreground">
                <span className="mb-5 block h-1 w-10 rounded-full bg-gold transition-[width] duration-700 group-hover:w-20" aria-hidden />
                <p className="text-[2.4rem] font-semibold leading-none tracking-tight text-gold">
                  <Counter value={s.v} suffix={s.s} />
                </p>
                <p className="mt-3 text-[13.5px] leading-snug text-ink-foreground/70">{s.l}</p>
              </Reveal>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-3">
          {groups.map((g, k) => {
            const Icon = g.icon
            return (
              <Reveal key={g.t} index={k} className="rounded-3xl bg-card p-6 hairline sm:p-7">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-secondary">
                  <Icon className="h-5 w-5" />
                </span>
                <p className="mt-5 font-display text-[19px] font-semibold tracking-tight">{g.t}</p>
                <ul className="mt-4 space-y-3">
                  {g.items.map((it) => (
                    <li key={it} className="flex gap-3 text-[14px] leading-relaxed text-muted-foreground">
                      <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rotate-45 bg-gold" aria-hidden />
                      {it}
                    </li>
                  ))}
                </ul>
              </Reveal>
            )
          })}
        </div>

        <Reveal className="mt-5 flex flex-col gap-4 rounded-3xl bg-[hsl(var(--state-stop-soft))] p-6 sm:flex-row sm:items-center sm:p-7">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[hsl(var(--state-stop))] text-white">
            <ShieldAlert className="h-6 w-6" />
          </span>
          <p className="flex-1 text-[15px] leading-relaxed">
            <span className="font-semibold">Seen an unsafe structure?</span> A board under high-tension lines, a loose flex, an
            exposed skeleton or work without safety measures — report it through the official DOAS channel.
          </p>
          <button
            onClick={() => openNotify("report")}
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-ink px-6 text-sm font-semibold text-ink-foreground transition-transform active:scale-[0.98]"
          >
            Report a structure <ArrowRight className="h-4 w-4" />
          </button>
        </Reveal>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Gallery                                                              */
/* ------------------------------------------------------------------ */

function Gallery() {
  return (
    <section id="gallery" className="scroll-mt-28 border-y border-border bg-card py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <Reveal className="max-w-2xl">
            <SectionLabel n="08" label="Abuja, in order" />
            <h2 className={`mt-5 ${H2}`}>What a compliant city looks like.</h2>
          </Reveal>
          <Reveal index={1} className="hidden shrink-0 items-center gap-2 text-[13px] text-muted-foreground lg:flex">
            <span className="h-px w-8 bg-border" />
            Drag, swipe or use the arrows
          </Reveal>
        </div>

        <Reveal index={1} className="mt-12">
          <Carousel label="Outdoor advertising across the FCT" autoplay={5500} slideClass="w-[86%] sm:w-[58%] lg:w-[42%]">
            {GALLERY.map((p) => (
              <figure key={p.src} className="group relative aspect-[4/3] select-none overflow-hidden rounded-3xl bg-ink hairline">
                <Photo
                  photo={p}
                  sizes="(min-width:1024px) 42vw, 86vw"
                  className="transition-transform duration-[1200ms] ease-out group-hover:scale-[1.04]"
                />
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
/* Divisions & units                                                    */
/* ------------------------------------------------------------------ */

function Divisions() {
  return (
    <section id="divisions" className="scroll-mt-28 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-end gap-6 lg:grid-cols-12">
          <Reveal className="lg:col-span-7">
            <SectionLabel n="09" label="Divisions & units" />
            <h2 className={`mt-5 ${H2}`}>Who does what at DOAS.</h2>
          </Reveal>
          <Reveal index={1} as="p" className="text-[15.5px] leading-relaxed text-muted-foreground lg:col-span-5">
            Reach any division through the Customer Service Unit — the official reception and enquiry point — rather than
            individual officers or intermediaries.
          </Reveal>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {DIVISIONS.map((d, k) => {
            const Icon = d.icon
            const isCsu = d.short === "CSU"
            return (
              <Reveal
                key={d.name}
                index={k % 4}
                className={`group relative flex flex-col rounded-3xl p-6 transition-all duration-300 hover:-translate-y-0.5 ${
                  isCsu ? "bg-ink text-ink-foreground" : "bg-card hairline hover:shadow-[0_24px_50px_-30px_hsl(101_50%_6%/.45)]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={`grid h-11 w-11 place-items-center rounded-xl transition-colors ${
                      isCsu ? "bg-gold text-ink" : "bg-secondary group-hover:bg-gold group-hover:text-ink"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  {d.short && (
                    <span
                      className={`figure rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        isCsu ? "bg-white/10 text-gold" : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {d.short}
                    </span>
                  )}
                </div>
                <p className="mt-5 font-display text-[17px] font-semibold leading-snug tracking-tight">{d.name}</p>
                <p className={`mt-2 text-[13.5px] leading-relaxed ${isCsu ? "text-ink-foreground/70" : "text-muted-foreground"}`}>
                  {d.body}
                </p>
                {isCsu && (
                  <a href="#contact" className="mt-4 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-gold">
                    Start here <ArrowRight className="h-4 w-4" />
                  </a>
                )}
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Digital register — in development                                    */
/* ------------------------------------------------------------------ */

const QR_N = 21
const QR_CELLS: [number, number][] = (() => {
  let seed = 20260831
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const finder = (x: number, y: number) =>
    (x < 8 && y < 8) || (x >= QR_N - 8 && y < 8) || (x < 8 && y >= QR_N - 8)
  const out: [number, number][] = []
  for (let y = 0; y < QR_N; y++) for (let x = 0; x < QR_N; x++) if (!finder(x, y) && rnd() > 0.5) out.push([x, y])
  return out
})()

function QrMock() {
  const corners: [number, number][] = [
    [0, 0],
    [QR_N - 7, 0],
    [0, QR_N - 7],
  ]
  return (
    <svg viewBox={`-1 -1 ${QR_N + 2} ${QR_N + 2}`} className="h-full w-full" shapeRendering="crispEdges" aria-hidden>
      <rect x={-1} y={-1} width={QR_N + 2} height={QR_N + 2} fill="white" rx={1} />
      {corners.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={x} y={y} width={7} height={7} fill="hsl(101 89% 4%)" />
          <rect x={x + 1} y={y + 1} width={5} height={5} fill="white" />
          <rect x={x + 2} y={y + 2} width={3} height={3} fill="hsl(101 89% 4%)" />
        </g>
      ))}
      {QR_CELLS.map(([x, y]) => (
        <rect key={`${x}.${y}`} x={x} y={y} width={1} height={1} fill="hsl(101 89% 4%)" />
      ))}
    </svg>
  )
}

function Register() {
  return (
    <section className="relative overflow-hidden border-y border-border bg-card py-20 lg:py-28">
      <div className="absolute inset-0 dot-grid opacity-60 [mask-image:radial-gradient(ellipse_at_80%_50%,black,transparent_70%)]" aria-hidden />
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:gap-16 lg:px-8">
        <div className="lg:col-span-7">
          <Reveal>
            <SectionLabel n="10" label="Digital register" />
            <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-[hsl(var(--state-move-soft))] px-3 py-1 text-[12px] font-semibold text-[hsl(var(--state-move))]">
              <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--state-move))]" /> In development
            </p>
            <h2 className={`mt-4 ${H2}`}>Every structure, one verified record.</h2>
            <p className="mt-4 max-w-2xl text-[16.5px] leading-relaxed text-muted-foreground">
              Records, Statistics and Data Management is building a master database of outdoor advertising structures in the
              FCT — so that applications, approvals, status tracking and compliance follow-up can move online.
            </p>
          </Reveal>
          <div className="mt-9 grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {REGISTER_FEATURES.map((f, k) => (
              <Reveal key={f.t} index={k} className="flex gap-3.5">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gold/25 text-gold-ink">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
                <div>
                  <p className="font-semibold">{f.t}</p>
                  <p className="mt-0.5 text-[14px] leading-relaxed text-muted-foreground">{f.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal index={3} className="mt-10 flex flex-wrap gap-3">
            <button
              onClick={() => openNotify("status")}
              className="sheen inline-flex h-12 items-center gap-2 rounded-xl bg-ink px-6 text-sm font-semibold text-ink-foreground transition-transform active:scale-[0.98]"
            >
              Notify me when verification opens <ArrowRight className="h-4 w-4" />
            </button>
          </Reveal>
        </div>

        {/* illustrative record */}
        <Reveal index={1} className="lg:col-span-5">
          <div className="float relative mx-auto max-w-sm">
            <div className="absolute -inset-6 rounded-[2.5rem] bg-gold/20 blur-2xl" aria-hidden />
            <div className="relative overflow-hidden rounded-[1.75rem] bg-ink text-ink-foreground shadow-[0_40px_80px_-40px_hsl(101_50%_4%/.8)]">
              <div className="h-1.5 w-full bg-gradient-to-r from-gold via-sky to-primary" aria-hidden />
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="grid place-items-center rounded-xl bg-white p-1.5">
                      <Logo className="h-8" />
                    </span>
                    <div className="leading-tight">
                      <p className="text-[13px] font-semibold">Site record</p>
                      <p className="text-[11px] text-ink-foreground/50">Illustrative sample</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--state-clear))] px-2.5 py-1 text-[11px] font-semibold text-white">
                    <Check className="h-3 w-3" strokeWidth={3.5} /> Approved
                  </span>
                </div>

                <div className="mt-6 flex gap-5">
                  <div className="h-28 w-28 shrink-0 overflow-hidden rounded-xl">
                    <QrMock />
                  </div>
                  <dl className="grid flex-1 content-start gap-2.5 text-[12.5px]">
                    <div>
                      <dt className="text-ink-foreground/45">Site ID</dt>
                      <dd className="figure font-semibold text-gold">SAMPLE-0001</dd>
                    </div>
                    <div>
                      <dt className="text-ink-foreground/45">Board type</dt>
                      <dd className="font-medium">Unipole</dd>
                    </div>
                    <div>
                      <dt className="text-ink-foreground/45">Area Council</dt>
                      <dd className="font-medium">Abuja Municipal</dd>
                    </div>
                  </dl>
                </div>

                <div className="mt-6 space-y-2">
                  {["Setting Out Certificate", "Site approval", "Inspection photo"].map((r, k) => (
                    <div key={r} className="flex items-center justify-between rounded-xl bg-white/[0.05] px-3.5 py-2.5 text-[12.5px]">
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rotate-45 bg-gold" /> {r}
                      </span>
                      <span className="figure text-ink-foreground/45">{k === 2 ? "dated" : "on file"}</span>
                    </div>
                  ))}
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
/* FAQs                                                                 */
/* ------------------------------------------------------------------ */

function Faqs() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section id="faqs" className="scroll-mt-28 py-20 lg:py-28">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:gap-16 lg:px-8">
        <Reveal className="lg:col-span-4">
          <SectionLabel n="11" label="Frequently asked" />
          <h2 className="mt-5 font-display text-[2rem] font-semibold leading-[1.08] tracking-tight text-balance sm:text-4xl">
            Straight answers for practitioners and businesses.
          </h2>
          <p className="mt-4 text-[15.5px] leading-relaxed text-muted-foreground">
            Can&rsquo;t find your question? Ask the DOAS Assistant at the bottom-right of this page, or call the Customer Service
            Unit during office hours.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button
              onClick={() => window.dispatchEvent(new Event("doas:open-chat"))}
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-ink px-5 text-sm font-semibold text-ink-foreground transition-transform active:scale-[0.98]"
            >
              Ask the assistant <ArrowUpRight className="h-4 w-4" />
            </button>
            <a
              href={`tel:${CONTACT.phones[0].tel}`}
              className="inline-flex h-12 items-center gap-2 rounded-xl px-5 text-sm font-semibold tnum transition-colors hairline hover:bg-secondary"
            >
              <Phone className="h-4 w-4" /> {CONTACT.phones[0].display}
            </a>
          </div>
        </Reveal>

        <div className="lg:col-span-8">
          <dl className="divide-y divide-border border-y border-border">
            {FAQS.map((f, k) => {
              const isOpen = open === k
              return (
                <Reveal key={f.q} index={k % 5}>
                  <dt>
                    <button
                      id={`faq-btn-${k}`}
                      onClick={() => setOpen(isOpen ? null : k)}
                      aria-expanded={isOpen}
                      aria-controls={`faq-${k}`}
                      className="group flex w-full items-start gap-5 py-6 text-left"
                    >
                      <span className="figure mt-1 w-6 shrink-0 text-[13px] text-muted-foreground/60">{String(k + 1).padStart(2, "0")}</span>
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
                  <dd id={`faq-${k}`} role="region" aria-labelledby={`faq-btn-${k}`} className="disclosure" data-open={isOpen}>
                    <div>
                      <p className="pb-7 pl-11 pr-4 text-[15.5px] leading-relaxed text-muted-foreground sm:pr-12">{f.a}</p>
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
    <section className="pb-20 lg:pb-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="relative overflow-hidden rounded-[2rem] bg-ink text-ink-foreground">
          <div className="absolute inset-0">
            <Photo photo={HERO_PHOTOS[1]} sizes="100vw" className="opacity-30" />
          </div>
          <div
            className="absolute inset-0 bg-[linear-gradient(90deg,hsl(var(--ink)/.95)_0%,hsl(var(--ink)/.8)_55%,hsl(var(--ink)/.55)_100%)]"
            aria-hidden
          />
          <div className="absolute -right-20 -top-28 h-80 w-80 rounded-full bg-gold opacity-25 blur-[90px]" aria-hidden />

          <div className="relative grid items-center gap-9 px-6 py-12 sm:px-12 lg:grid-cols-12 lg:px-16 lg:py-16">
            <div className="lg:col-span-7">
              <p className="text-[11.5px] font-semibold uppercase tracking-[0.18em] text-gold">Official notices by email</p>
              <h2 className="mt-4 font-display text-[2rem] font-semibold leading-[1.08] tracking-tight text-balance sm:text-[2.6rem]">
                Never miss a deadline or a directive.
              </h2>
              <p className="mt-4 max-w-xl text-[15.5px] leading-relaxed text-ink-foreground/70">
                Stop-work updates, revalidation windows, fee circulars and removal notices — the day they are issued.
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
                      placeholder="you@company.ng"
                      className="h-14 flex-1 rounded-xl bg-transparent px-4 text-[15px] text-ink-foreground outline-none placeholder:text-ink-foreground/40 focus-visible:ring-2 focus-visible:ring-gold"
                    />
                    <button
                      type="submit"
                      disabled={state === "busy"}
                      className="rounded-xl bg-gold px-6 py-3.5 text-[15px] font-semibold text-ink transition hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
                    >
                      {state === "busy" ? "Saving…" : "Get notices"}
                    </button>
                  </div>
                  <p className={`mt-3 text-[12.5px] ${state === "error" ? "text-gold" : "text-ink-foreground/55"}`}>
                    {state === "error"
                      ? "Please enter a valid email address and try again."
                      : "Official notices only. DOAS never requests a payment by email."}
                  </p>
                </form>

                <div
                  role="status"
                  className={`absolute inset-0 flex items-center gap-4 transition-all duration-500 ${
                    state === "done" ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
                  }`}
                >
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gold text-ink">
                    <Check className="h-6 w-6" strokeWidth={3} />
                  </span>
                  <div>
                    <p className="font-display text-lg font-semibold">Thank you — you are subscribed.</p>
                    <p className="text-[14.5px] text-ink-foreground/70">Official notices will reach {email || "your inbox"}.</p>
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
  const MAPS_LINK = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(CONTACT.mapsQuery)}`
  const MAPS_EMBED = `https://maps.google.com/maps?q=${encodeURIComponent(CONTACT.mapsQuery)}&z=16&output=embed`

  return (
    <section id="contact" className="scroll-mt-28 border-t border-border bg-card py-20 lg:py-28">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:gap-16 lg:px-8">
        <Reveal className="lg:col-span-5">
          <SectionLabel n="12" label="Contact & complaints" />
          <h2 className="mt-5 font-display text-[2rem] font-semibold leading-[1.08] tracking-tight text-balance sm:text-4xl">
            Visit the Customer Service Unit in Jahi.
          </h2>
          <p className="mt-4 text-[15.5px] leading-relaxed text-muted-foreground">
            Submissions, enquiries, document collection and acknowledgements are handled at the Customer Service Unit during
            office hours.
          </p>

          <dl className="mt-9 space-y-6">
            <div className="group flex gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary transition-colors group-hover:bg-gold group-hover:text-ink">
                <MapPin className="h-[18px] w-[18px]" />
              </span>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Office address</dt>
                <dd className="mt-1">
                  <a href={MAPS_LINK} target="_blank" rel="noreferrer" className="text-[15.5px] font-medium leading-relaxed transition-colors hover:text-primary">
                    {CONTACT.addressLines.map((l) => (
                      <span key={l} className="block">
                        {l}
                      </span>
                    ))}
                  </a>
                </dd>
              </div>
            </div>

            <div className="group flex gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary transition-colors group-hover:bg-gold group-hover:text-ink">
                <Phone className="h-[18px] w-[18px]" />
              </span>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Telephone</dt>
                <dd className="mt-1 flex flex-col gap-0.5">
                  {CONTACT.phones.map((p) => (
                    <a key={p.tel} href={`tel:${p.tel}`} className="tnum text-[15.5px] font-medium transition-colors hover:text-primary">
                      {p.display}
                    </a>
                  ))}
                </dd>
              </div>
            </div>

            <div className="group flex gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary transition-colors group-hover:bg-gold group-hover:text-ink">
                <Mail className="h-[18px] w-[18px]" />
              </span>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Email</dt>
                <dd className="mt-1">
                  <a href={`mailto:${CONTACT.email}`} className="break-all text-[15.5px] font-medium transition-colors hover:text-primary">
                    {CONTACT.email}
                  </a>
                </dd>
              </div>
            </div>

            <div className="group flex gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary transition-colors group-hover:bg-gold group-hover:text-ink">
                <Clock className="h-[18px] w-[18px]" />
              </span>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Office hours</dt>
                <dd className="mt-1 text-[15.5px] font-medium">{CONTACT.hours}</dd>
                <dd className="text-[13px] text-muted-foreground">Closed on public holidays</dd>
              </div>
            </div>
          </dl>

          <div className="mt-9 rounded-2xl bg-[hsl(var(--state-stop-soft))] p-5">
            <p className="flex items-center gap-2 font-semibold">
              <ShieldAlert className="h-4 w-4 text-[hsl(var(--state-stop))]" />
              Report a problem
            </p>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-foreground/75">
              Unsafe structures, suspected illegal work, disputed allocations or any improper demand by someone claiming to act for
              DOAS. Give the exact location and a photograph.
            </p>
            <button
              onClick={() => openNotify("report")}
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-ink px-4 text-[13.5px] font-semibold text-ink-foreground transition-transform active:scale-[0.98]"
            >
              Ask an officer to contact me <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </Reveal>

        <Reveal index={1} className="lg:col-span-7">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[1.75rem] bg-secondary hairline sm:aspect-[16/10] lg:aspect-auto lg:h-full lg:min-h-[520px]">
            <iframe
              title={`DOAS office location — ${CONTACT.addressOneLine}`}
              src={MAPS_EMBED}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            />

            {/* overlays: wrapper ignores pointer events so the map stays draggable */}
            <div className="pointer-events-none absolute inset-0">
              <div className="pointer-events-auto absolute left-4 top-4 sm:left-5 sm:top-5">
                <div className="surface-raised w-max max-w-[270px] rounded-2xl px-4 py-3">
                  <p className="flex items-center gap-2 text-[13px] font-semibold">
                    <span className="relative h-2.5 w-2.5 rounded-full bg-gold ping-dot" />
                    DOAS · Customer Service Unit
                  </p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">Abuja Enterprise Agency Building</p>
                  <p className="text-[12px] text-muted-foreground">{CONTACT.landmark}</p>
                </div>
              </div>

              <a
                href={MAPS_LINK}
                target="_blank"
                rel="noreferrer"
                className="pointer-events-auto absolute bottom-4 right-4 inline-flex h-11 items-center gap-2 rounded-xl bg-gold px-5 text-[13.5px] font-semibold text-ink shadow-lg transition-transform hover:brightness-105 active:scale-95"
              >
                <Navigation className="h-4 w-4" /> Get directions
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
    { label: "Billboard site applications", intent: "site" },
    { label: "Practitioner revalidation", intent: "revalidation" },
    { label: "Billing enquiries", intent: "billing" },
    { label: "Report a structure", intent: "report" },
    { label: "Verify a permit", intent: "status" },
  ]

  return (
    <footer className="bg-ink text-ink-foreground">
      <div className="h-1 w-full bg-gradient-to-r from-gold via-sky to-primary" aria-hidden />
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-5">
            <div className="flex items-center gap-5">
              <span className="grid shrink-0 place-items-center rounded-2xl bg-white p-2.5 shadow-[0_10px_30px_-12px_rgba(0,0,0,.6)]">
                <Logo className="h-14" />
              </span>
              <div className="leading-tight">
                <p className="font-display text-[22px] font-semibold">DOAS</p>
                <p className="mt-1 text-[10.5px] uppercase tracking-[0.15em] text-ink-foreground/55">Outdoor Advertisement &amp; Signage</p>
                <p className="mt-1 text-[11.5px] text-gold/90">Strategizing for efficiency</p>
              </div>
            </div>
            <p className="mt-7 max-w-sm text-[14px] leading-relaxed text-ink-foreground/65">
              Department of Outdoor Advertisement and Signage, Federal Capital Territory Administration — for a safe, orderly and
              aesthetically pleasing outdoor advertising environment in the FCT.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {COUNCILS.map((c) => (
                <span key={c} className="rounded-full border border-white/10 px-3 py-1 text-[11.5px] text-ink-foreground/70">
                  {c}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 text-[14px] sm:grid-cols-3 md:col-span-7">
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
                <li><a href="#about" className="transition-colors hover:text-gold">About DOAS</a></li>
                <li><a href="#director" className="transition-colors hover:text-gold">Overseeing Director</a></li>
                <li><a href="#notices" className="transition-colors hover:text-gold">Notices &amp; circulars</a></li>
                <li><a href="#standards" className="transition-colors hover:text-gold">Safety &amp; standards</a></li>
                <li><a href="#divisions" className="transition-colors hover:text-gold">Divisions &amp; units</a></li>
                <li><a href="#faqs" className="transition-colors hover:text-gold">FAQs</a></li>
                <li><Link href="/admin" className="transition-colors hover:text-gold">Staff portal</Link></li>
              </ul>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-gold">Contact</p>
              <ul className="mt-4 space-y-2.5 text-ink-foreground/70">
                <li className="leading-relaxed">
                  {CONTACT.addressLines.map((l) => (
                    <span key={l} className="block">
                      {l}
                    </span>
                  ))}
                </li>
                {CONTACT.phones.map((p) => (
                  <li key={p.tel}>
                    <a href={`tel:${p.tel}`} className="tnum transition-colors hover:text-gold">
                      {p.display}
                    </a>
                  </li>
                ))}
                <li>
                  <a href={`mailto:${CONTACT.email}`} className="break-all transition-colors hover:text-gold">
                    {CONTACT.email}
                  </a>
                </li>
                <li className="text-ink-foreground/50">{CONTACT.hoursShort}</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-white/10 pt-7 text-[12.5px] text-ink-foreground/50 md:flex-row md:items-center md:justify-between">
          <p>
            © {new Date().getFullYear()} Department of Outdoor Advertisement and Signage (DOAS) — Federal Capital Territory
            Administration (FCTA). All rights reserved.
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