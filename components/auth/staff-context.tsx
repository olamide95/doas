"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { onAuthStateChanged, signOut, type User } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { Loader2 } from "lucide-react"
import { auth, COL, db } from "@/lib/firebase"
import { deskForDepartment, deskForPath } from "@/lib/roles"

export interface StaffProfile {
  uid: string
  name: string
  email: string
  department: string
  designation?: string
  active: boolean
}

const StaffContext = React.createContext<{ staff: StaffProfile | null; user: User | null }>({ staff: null, user: null })

/** The signed-in staff member. Null outside a DeskGuard. */
export const useStaff = () => React.useContext(StaffContext)

/** Staff records are keyed by Firebase Auth uid. */
export async function loadStaff(user: User): Promise<StaffProfile | null> {
  const snap = await getDoc(doc(db, COL.staff, user.uid))
  if (!snap.exists()) return null
  const d = snap.data()
  return {
    uid: user.uid,
    name: String(d.name ?? user.displayName ?? user.email ?? ""),
    email: String(d.email ?? user.email ?? ""),
    department: String(d.department ?? ""),
    designation: d.designation ? String(d.designation) : undefined,
    active: d.active !== false,
  }
}

/**
 * Locks a page to one desk. `desk` is a DEPARTMENT value; if omitted it is
 * worked out from the URL (/dashboard/<desk>). Anyone on the wrong desk is
 * sent to their own dashboard; anyone signed out goes to /login.
 */
export function DeskGuard({ desk, children }: { desk?: string; children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [state, setState] = React.useState<{ user: User | null; staff: StaffProfile | null; ready: boolean }>({
    user: null,
    staff: null,
    ready: false,
  })

  React.useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({ user: null, staff: null, ready: false })
        router.replace(`/login?next=${encodeURIComponent(pathname)}`)
        return
      }
      try {
        const staff = await loadStaff(user)
        if (!staff || !staff.active) {
          await signOut(auth)
          router.replace(`/login?error=${staff ? "suspended" : "unregistered"}`)
          return
        }
        const own = deskForDepartment(staff.department)
        if (!own) {
          await signOut(auth)
          router.replace("/login?error=nodesk")
          return
        }
        const required = desk ?? deskForPath(pathname)?.department
        if (required && own.department !== required) {
          router.replace(own.path)
          return
        }
        setState({ user, staff, ready: true })
      } catch {
        await signOut(auth)
        router.replace("/login?error=failed")
      }
    })
  }, [desk, pathname, router])

  if (!state.ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Checking your access" />
      </div>
    )
  }

  return <StaffContext.Provider value={{ staff: state.staff, user: state.user }}>{children}</StaffContext.Provider>
}
