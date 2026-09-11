/**
 * Firestore hands back Timestamps, ISO strings, millisecond numbers and the
 * occasional Date depending on which screen wrote the record. Everything goes
 * through here so the UI only ever deals with a Date or null.
 */
export function toDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === "object" && value !== null && "toDate" in value) {
    try {
      const d = (value as { toDate: () => Date }).toDate()
      return Number.isNaN(d.getTime()) ? null : d
    } catch {
      return null
    }
  }
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

export function toMillis(value: unknown): number {
  return toDate(value)?.getTime() ?? 0
}

const dateFmt = new Intl.DateTimeFormat("en-NG", {
  day: "2-digit",
  month: "short",
  year: "numeric",
})

const timeFmt = new Intl.DateTimeFormat("en-NG", {
  hour: "2-digit",
  minute: "2-digit",
})

const longDateFmt = new Intl.DateTimeFormat("en-NG", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
})

export function formatDate(value: unknown, fallback = "—"): string {
  const d = toDate(value)
  return d ? dateFmt.format(d) : fallback
}

export function formatTime(value: unknown, fallback = "—"): string {
  const d = toDate(value)
  return d ? timeFmt.format(d) : fallback
}

export function formatDateTime(value: unknown, fallback = "—"): string {
  const d = toDate(value)
  return d ? `${dateFmt.format(d)}, ${timeFmt.format(d)}` : fallback
}

export function formatLongDate(value: unknown = new Date()): string {
  const d = toDate(value)
  return d ? longDateFmt.format(d) : ""
}

/** "just now", "12 min ago", "3 days ago" */
export function timeAgo(value: unknown, fallback = "—"): string {
  const d = toDate(value)
  if (!d) return fallback
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000)
  if (seconds < 45) return "just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600)
    return `${h} hour${h > 1 ? "s" : ""} ago`
  }
  if (seconds < 604800) {
    const days = Math.floor(seconds / 86400)
    return `${days} day${days > 1 ? "s" : ""} ago`
  }
  return dateFmt.format(d)
}

export function naira(value?: number | string | null): string {
  const n = typeof value === "string" ? Number(value) : value
  if (n == null || Number.isNaN(n)) return "—"
  return `₦${n.toLocaleString("en-NG")}`
}

export function initials(name?: string | null, count = 2): string {
  if (!name) return "?"
  return name
    .trim()
    .split(/\s+/)
    .slice(0, count)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

export function truncate(text?: string | null, max = 60): string {
  if (!text) return "—"
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

/** Turn "companyRegistrationNumber" into "Company registration number". */
export function humanise(key: string): string {
  const spaced = key.replace(/([A-Z])/g, " $1").replace(/[_-]+/g, " ").trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase()
}
