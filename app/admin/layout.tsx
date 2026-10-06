"use client"

import { DEPARTMENT } from "@/lib/workflow"
import { DeskGuard } from "@/components/auth/staff-context"

/** Admin tools (e.g. /admin/migrate) are for the Director only. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <DeskGuard desk={DEPARTMENT.director}>{children}</DeskGuard>
}
