"use client"

import {
  Children,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { ArrowLeft, ArrowRight } from "lucide-react"

type CarouselProps = {
  children: ReactNode
  /** accessible name for the region */
  label: string
  /** width classes applied to every slide, e.g. "w-[86%] sm:w-[60%] lg:w-[31%]" */
  slideClass?: string
  /** ms between automatic advances; 0 disables autoplay */
  autoplay?: number
  className?: string
  /** show the thin progress rail under the track */
  progress?: boolean
}

/**
 * Scroll-snap carousel: native momentum on touch, pointer-drag on desktop,
 * arrow keys, dots, autoplay that yields to any human input.
 */
export function Carousel({
  children,
  label,
  slideClass = "w-[86%] sm:w-[58%] lg:w-[38%]",
  autoplay = 0,
  className = "",
  progress = true,
}: CarouselProps) {
  const slides = Children.toArray(children)
  const count = slides.length

  const trackRef = useRef<HTMLUListElement>(null)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const dragging = useRef(false)
  const moved = useRef(false)
  const startX = useRef(0)
  const startScroll = useRef(0)

  /* ---------- position tracking ---------- */
  const syncIndex = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    const kids = Array.from(track.children) as HTMLElement[]
    const left = track.scrollLeft
    let best = 0
    let bestDist = Infinity
    kids.forEach((kid, i) => {
      const d = Math.abs(kid.offsetLeft - track.offsetLeft - left)
      if (d < bestDist) {
        bestDist = d
        best = i
      }
    })
    setIndex(best)
  }, [])

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(syncIndex)
    }
    track.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      track.removeEventListener("scroll", onScroll)
      cancelAnimationFrame(frame)
    }
  }, [syncIndex])

  /* ---------- navigation ---------- */
  const goTo = useCallback((i: number) => {
    const track = trackRef.current
    if (!track) return
    const kids = Array.from(track.children) as HTMLElement[]
    const target = kids[Math.max(0, Math.min(kids.length - 1, i))]
    if (!target) return
    track.scrollTo({ left: target.offsetLeft - track.offsetLeft, behavior: "smooth" })
  }, [])

  const next = useCallback(() => goTo(index + 1 >= count ? 0 : index + 1), [goTo, index, count])
  const prev = useCallback(() => goTo(index - 1 < 0 ? count - 1 : index - 1), [goTo, index, count])

  /* ---------- autoplay ---------- */
  useEffect(() => {
    if (!autoplay || paused || count < 2) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const id = window.setInterval(next, autoplay)
    return () => window.clearInterval(id)
  }, [autoplay, paused, next, count])

  /* ---------- pointer drag ---------- */
  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "touch") return // let the browser do native scrolling
    const track = trackRef.current
    if (!track) return
    dragging.current = true
    moved.current = false
    startX.current = e.clientX
    startScroll.current = track.scrollLeft
    track.setPointerCapture(e.pointerId)
    track.style.scrollSnapType = "none"
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return
    const track = trackRef.current
    if (!track) return
    const dx = e.clientX - startX.current
    if (Math.abs(dx) > 4) moved.current = true
    track.scrollLeft = startScroll.current - dx
  }

  function endDrag(e: React.PointerEvent) {
    const track = trackRef.current
    if (!track || !dragging.current) return
    dragging.current = false
    try {
      track.releasePointerCapture(e.pointerId)
    } catch {}
    track.style.scrollSnapType = ""
    syncIndex()
  }

  return (
    <div
      className={`relative ${className}`}
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <ul
        ref={trackRef}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault()
            next()
          }
          if (e.key === "ArrowLeft") {
            e.preventDefault()
            prev()
          }
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={(e) => {
          if (moved.current) {
            e.preventDefault()
            e.stopPropagation()
            moved.current = false
          }
        }}
        className="no-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto overscroll-x-contain pb-2 outline-none cursor-grab active:cursor-grabbing [scrollbar-width:none]"
      >
        {slides.map((slide, i) => (
          <li
            key={i}
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
            className={`snap-start shrink-0 ${slideClass}`}
          >
            {slide}
          </li>
        ))}
      </ul>

      {/* controls */}
      <div className="mt-6 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prev}
            aria-label="Previous"
            className="grid h-11 w-11 place-items-center rounded-full hairline bg-card text-foreground transition-all hover:bg-ink hover:text-ink-foreground active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Next"
            className="grid h-11 w-11 place-items-center rounded-full hairline bg-card text-foreground transition-all hover:bg-ink hover:text-ink-foreground active:scale-95"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {progress && (
          <div className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-border" aria-hidden>
            <div
              className="absolute inset-y-0 rounded-full bg-gold transition-[left,width] duration-500 ease-out"
              style={{ width: `${100 / count}%`, left: `${(index * 100) / count}%` }}
            />
          </div>
        )}

        <div className="flex items-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === index}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === index ? "w-6 bg-ink dark:bg-gold" : "w-2 bg-border hover:bg-muted-foreground/50"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
