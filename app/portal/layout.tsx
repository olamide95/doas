"use client"

import { PortalGuard } from "@/components/auth/portal-context"

/** /portal is for practitioners with a portal login created by CSU or the Director. */
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <PortalGuard>{children}</PortalGuard>
}
