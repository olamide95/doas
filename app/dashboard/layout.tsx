"use client"

import { DeskGuard } from "@/components/auth/staff-context"

/** Every /dashboard/<desk> page is locked to staff of that desk. */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DeskGuard>{children}</DeskGuard>
}
