"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { onAuthStateChanged, signOut, type User } from "firebase/auth"
import { doc, getDoc, onSnapshot } from "firebase/firestore"
import { Loader2 } from "lucide-react"
import { auth, COL, db } from "@/lib/firebase"
import { PRACTITIONER_COL, type PractitionerProfile } from "@/lib/practitioner-registry"

export interface PortalUser {
  uid: string
  email: string
  practitionerId: string
  companyName: string
  active: boolean
}

export type PortalProfile = PractitionerProfile & { id: string }

interface PortalState {
  user: User | null
  portal: PortalUser | null
  profile: PortalProfile | null
}

const PortalContext = React.createContext<PortalState>({ user: null, portal: null, profile: null })

/** The signed-in practitioner. Null outside a PortalGuard. */
export const usePortal = () => React.useContext(PortalContext)

/** Portal links are keyed by Firebase Auth uid. */
export async function loadPortalUser(user: User): Promise<PortalUser | null> {
  const snap = await getDoc(doc(db, COL.portalUsers, user.uid))
  if (!snap.exists()) return null
  const d = snap.data()
  return {
    uid: user.uid,
    email: String(d.email ?? user.email ?? ""),
    practitionerId: String(d.practitionerId ?? ""),
    companyName: String(d.companyName ?? ""),
    active: d.active !== false,
  }
}

/** Calls a portal API route with the practitioner's ID token. */
export async function portalApi<T = Record<string, unknown>>(path: string, body: Record<string, unknown>): Promise<T> {
  const token = await auth.currentUser?.getIdToken()
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`)
  return json as T
}

/** Locks /portal to signed-in, active practitioners. */
export function PortalGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [state, setState] = React.useState<PortalState & { ready: boolean }>({ user: null, portal: null, profile: null, ready: false })

  React.useEffect(() => {
    let stopProfile: (() => void) | undefined
    const stopAuth = onAuthStateChanged(auth, async (user) => {
      stopProfile?.()
      if (!user) {
        setState({ user: null, portal: null, profile: null, ready: false })
        router.replace("/login?next=/portal")
        return
      }
      try {
        const portal = await loadPortalUser(user)
        if (!portal || !portal.active || !portal.practitionerId) {
          await signOut(auth)
          router.replace(`/login?error=${portal ? "portalSuspended" : "unregistered"}`)
          return
        }
        stopProfile = onSnapshot(
          doc(db, PRACTITIONER_COL.profiles, portal.practitionerId),
          (snap) => {
            const profile = snap.exists() ? ({ id: snap.id, ...(snap.data() as PractitionerProfile) } as PortalProfile) : null
            setState({ user, portal, profile, ready: true })
          },
          () => setState({ user, portal, profile: null, ready: true }),
        )
      } catch {
        await signOut(auth)
        router.replace("/login?error=failed")
      }
    })
    return () => {
      stopProfile?.()
      stopAuth()
    }
  }, [router])

  if (!state.ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Checking your access" />
      </div>
    )
  }

  return <PortalContext.Provider value={{ user: state.user, portal: state.portal, profile: state.profile }}>{children}</PortalContext.Provider>
}
