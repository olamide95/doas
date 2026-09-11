"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { signOut } from "firebase/auth"
import { limit, orderBy, query, where } from "firebase/firestore"
import type { LucideIcon } from "lucide-react"
import { Bell, ChevronsLeft, LogOut, Menu, PanelsTopLeft, Settings, User, X } from "lucide-react"
import { auth, COL } from "@/lib/firebase"
import { useCurrentUser, useRealtimeCollection } from "@/hooks/use-firestore"
import { formatLongDate, initials } from "@/lib/format"
import { toast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"

export interface ShellNavItem {
  value: string
  label: string
  icon: LucideIcon
  /** Live count shown beside the label. Hidden when 0. */
  badge?: number
}

interface ShellProps {
  /** Matches the `userId` written onto notification documents. */
  audience: string
  unitName: string
  unitCaption: string
  nav: ShellNavItem[]
  active: string
  onNavigate: (value: string) => void
  children: React.ReactNode
}

export function DashboardShell({
  audience,
  unitName,
  unitCaption,
  nav,
  active,
  onNavigate,
  children,
}: ShellProps) {
  const router = useRouter()
  const { user } = useCurrentUser()
  const [collapsed, setCollapsed] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)

  // Unread count is read client-side from the last 100 notifications so the
  // query needs no composite index, and it tolerates both the `isRead` and
  // `read` field names already in the database.
  const { data: notifications } = useRealtimeCollection<Record<string, unknown>>(
    COL.notifications,
    [where("userId", "==", audience), limit(100)],
    [audience],
  )
  const unread = notifications.filter((n) => !(n.isRead ?? n.read ?? false)).length

  const displayName = user?.displayName || user?.email?.split("@")[0] || unitName
  const activeItem = nav.find((item) => item.value === active)

  const handleSignOut = async () => {
    try {
      await signOut(auth)
      router.push("/login")
    } catch (error) {
      toast.error({
        title: "Sign out failed",
        description: error instanceof Error ? error.message : "Try again in a moment.",
      })
    }
  }

  const Rail = ({ onPick }: { onPick?: () => void }) => (
    <div className="flex h-full flex-col bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))]">
      <div className="flex h-16 items-center gap-2.5 border-b border-[hsl(var(--sidebar-border))] px-4">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[hsl(var(--sidebar-primary))] font-display text-[13px] font-bold text-[hsl(var(--sidebar-primary-foreground))]">
          DO
        </span>
        {!collapsed ? (
          <div className="min-w-0 leading-tight">
            <p className="font-display text-[14px] font-semibold text-white">DOAS</p>
            <p className="truncate text-[11px] text-[hsl(var(--sidebar-foreground))]/70">
              {unitCaption}
            </p>
          </div>
        ) : null}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto scroll-slim p-2.5">
        {nav.map((item) => {
          const isActive = item.value === active
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => {
                onNavigate(item.value)
                onPick?.()
              }}
              title={collapsed ? item.label : undefined}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors",
                isActive
                  ? "bg-[hsl(var(--sidebar-accent))] text-white"
                  : "text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))]/60 hover:text-white",
              )}
            >
              <item.icon className="h-[17px] w-[17px] shrink-0" aria-hidden />
              {!collapsed ? <span className="flex-1 truncate text-left">{item.label}</span> : null}
              {!collapsed && item.badge ? (
                <span className="tnum rounded-md bg-[hsl(var(--sidebar-primary))] px-1.5 py-0.5 text-[10.5px] font-bold text-[hsl(var(--sidebar-primary-foreground))]">
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              ) : null}
              {collapsed && item.badge ? (
                <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--sidebar-primary))]" />
              ) : null}
            </button>
          )
        })}
      </nav>

      <div className="border-t border-[hsl(var(--sidebar-border))] p-2.5">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="hidden w-full items-center gap-3 rounded-lg px-3 py-2 text-[12.5px] text-[hsl(var(--sidebar-foreground))]/80 transition-colors hover:bg-[hsl(var(--sidebar-accent))] hover:text-white lg:flex"
        >
          <ChevronsLeft
            className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")}
            aria-hidden
          />
          {!collapsed ? "Collapse" : null}
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop rail */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 transition-[width] duration-200 lg:block",
          collapsed ? "w-[68px]" : "w-[232px]",
        )}
      >
        <Rail />
      </aside>

      {/* Mobile rail */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
            className="fade-in absolute inset-0 bg-foreground/40 backdrop-blur-[2px]"
          />
          <div className="reveal absolute inset-y-0 left-0 w-[248px]">
            <Rail onPick={() => setMobileOpen(false)} />
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-4 rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-[15px] font-semibold text-foreground">
                {activeItem?.label ?? unitName}
              </p>
              <p className="truncate text-[11.5px] text-muted-foreground">{formatLongDate()}</p>
            </div>

            <button
              type="button"
              onClick={() => onNavigate("notifications")}
              aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
              className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Bell className="h-[18px] w-[18px]" />
              {unread > 0 ? (
                <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-[hsl(var(--state-stop))] px-1 text-[9.5px] font-bold leading-none text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </button>

            <AccountMenu
              name={displayName}
              email={user?.email ?? undefined}
              unit={unitName}
              onProfile={() => onNavigate("settings")}
              onSignOut={handleSignOut}
            />
          </div>
        </header>

        <main className="flex-1 px-4 py-5 sm:px-6 sm:py-7">{children}</main>
      </div>
    </div>
  )
}

function AccountMenu({
  name,
  email,
  unit,
  onProfile,
  onSignOut,
}: {
  name: string
  email?: string
  unit: string
  onProfile: () => void
  onSignOut: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg p-1 transition-colors hover:bg-muted"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-primary font-display text-[12px] font-semibold text-primary-foreground">
          {initials(name)}
        </span>
        <span className="hidden min-w-0 text-left sm:block">
          <span className="block max-w-[140px] truncate text-[13px] font-medium text-foreground">
            {name}
          </span>
          <span className="block text-[11px] text-muted-foreground">{unit}</span>
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className="reveal absolute right-0 top-[calc(100%+8px)] w-60 overflow-hidden rounded-xl surface-raised"
        >
          <div className="border-b border-border px-3.5 py-3">
            <p className="truncate text-[13px] font-semibold text-foreground">{name}</p>
            <p className="truncate text-[11.5px] text-muted-foreground">{email ?? unit}</p>
          </div>
          <div className="p-1.5">
            <MenuItem icon={User} label="Profile" onClick={() => { setOpen(false); onProfile() }} />
            <MenuItem icon={Settings} label="Settings" onClick={() => { setOpen(false); onProfile() }} />
            <MenuItem
              icon={PanelsTopLeft}
              label="Keyboard shortcuts"
              onClick={() => {
                setOpen(false)
                toast.info({
                  title: "Shortcuts",
                  description: "Press / to search a table, Esc to close any dialog.",
                })
              }}
            />
          </div>
          <div className="border-t border-border p-1.5">
            <MenuItem
              icon={LogOut}
              label="Sign out"
              destructive
              onClick={() => { setOpen(false); onSignOut() }}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  destructive,
}: {
  icon: LucideIcon
  label: string
  onClick: () => void
  destructive?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
        destructive
          ? "text-[hsl(var(--state-stop))] hover:bg-[hsl(var(--state-stop-soft))]"
          : "text-foreground hover:bg-muted",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {label}
    </button>
  )
}
