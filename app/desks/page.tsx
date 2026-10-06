"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { onAuthStateChanged } from "firebase/auth"
import { Loader2 } from "lucide-react"
import { auth } from "@/lib/firebase"
import { deskForDepartment } from "@/lib/roles"
import { loadStaff } from "@/components/auth/staff-context"

/** Sends whoever is signed in to their own dashboard, or to /login. */
export default function DesksRedirect() {
  const router = useRouter()

  React.useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login")
        return
      }
      const staff = await loadStaff(user).catch(() => null)
      router.replace(deskForDepartment(staff?.department)?.path ?? "/login")
    })
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )
}
