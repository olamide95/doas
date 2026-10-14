"use client"

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react"

/* ------------------------------------------------------------------ */
/* useInView — one shared observer hook for every motion primitive     */
/* ------------------------------------------------------------------ */

export function useInView<T extends HTMLElement>(options?: { once?: boolean; threshold?: number; rootMargin?: string }) {
  const { once = true, threshold = 0.15, rootMargin = "0px 0px -8% 0px" } = options ?? {}
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === "undefined") {
      setInView(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setInView(true)
            if (once) io.disconnect()
          } else if (!once) {
            setInView(false)
          }
        }
      },
      { threshold, rootMargin },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [once, threshold, rootMargin])

  return { ref, inView }
}

function prefersReduced() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/* ------------------------------------------------------------------ */
/* Reveal — rise + fade on first entry                                 */
/* ------------------------------------------------------------------ */

type RevealProps = {
  children: ReactNode
  className?: string
  /** stagger index — multiplied by 70ms (see .reveal in globals.css) */
  index?: number
  as?: ElementType
  once?: boolean
}

/**
 * Adds the `.reveal` animation class the first time the element scrolls into
 * view. Content renders visible for crawlers and for reduced-motion users; the
 * opacity is only pulled to 0 once JS has attached the observer.
 */
export function Reveal({ children, className = "", index = 0, as: Tag = "div", once = true }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null)
  const [armed, setArmed] = useState(false)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (prefersReduced()) {
      setShown(true)
      return
    }
    setArmed(true)
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true)
            if (once) io.disconnect()
          } else if (!once) {
            setShown(false)
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [once])

  const Component = Tag as ElementType
  return (
    <Component
      ref={ref}
      style={{ ["--i" as string]: index }}
      className={[className, armed && !shown ? "opacity-0" : "", shown ? "reveal" : ""].join(" ").trim()}
    >
      {children}
    </Component>
  )
}

/* ------------------------------------------------------------------ */
/* Words — headline that assembles word by word                        */
/* ------------------------------------------------------------------ */

type WordsProps = {
  text: string
  className?: string
  /** word index to start the stagger from, so lines can continue a sequence */
  start?: number
  /** sweep a gold highlight under these words once they land */
  mark?: boolean
  as?: ElementType
}

export function Words({ text, className = "", start = 0, mark = false, as: Tag = "span" }: WordsProps) {
  const { ref, inView } = useInView<HTMLSpanElement>({ threshold: 0.25 })
  const [reduced, setReduced] = useState(false)
  useEffect(() => setReduced(prefersReduced()), [])

  const words = text.split(" ")
  const Component = Tag as ElementType

  return (
    <Component ref={ref} className={className}>
      {words.map((w, i) => (
        <span key={`${w}-${i}`} className="inline-block overflow-hidden align-bottom">
          <span
            className={!reduced && inView ? "word" : "inline-block"}
            style={{ ["--w" as string]: start + i }}
          >
            <span className={mark ? "gold-mark" : undefined} data-on={mark ? inView : undefined}>
              {w}
            </span>
            {i < words.length - 1 ? "\u00A0" : ""}
          </span>
        </span>
      ))}
    </Component>
  )
}

/* ------------------------------------------------------------------ */
/* Counter — counts up on first view                                   */
/* ------------------------------------------------------------------ */

export function Counter({
  value,
  suffix = "",
  prefix = "",
  className = "",
  duration = 1300,
}: {
  value: number
  suffix?: string
  prefix?: string
  className?: string
  duration?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [n, setN] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (prefersReduced()) {
      setN(value)
      return
    }
    let raf = 0
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        io.disconnect()
        const start = performance.now()
        const tick = (t: number) => {
          const p = Math.min(1, (t - start) / duration)
          const eased = 1 - Math.pow(1 - p, 4)
          setN(Math.round(value * eased))
          if (p < 1) raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      },
      { threshold: 0.4 },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [value, duration])

  return (
    <span ref={ref} className={`figure ${className}`}>
      {prefix}
      {n.toLocaleString()}
      {suffix}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* GrowLine — a rule that draws itself across a section                */
/* ------------------------------------------------------------------ */

export function GrowLine({ className = "" }: { className?: string }) {
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.2 })
  return (
    <div ref={ref} className={`h-px w-full bg-border ${className}`} aria-hidden>
      <div className="line-grow h-full w-full bg-gold" data-on={inView} />
    </div>
  )
}
