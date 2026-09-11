"use client"

import { useEffect, useMemo, useState } from "react"
import {
  collection,
  onSnapshot,
  query,
  type DocumentData,
  type QueryConstraint,
} from "firebase/firestore"
import { auth, db } from "@/lib/firebase"
import { onAuthStateChanged, type User } from "firebase/auth"

export type WithId<T> = T & { id: string }

interface CollectionState<T> {
  data: WithId<T>[]
  loading: boolean
  error: Error | null
}

/**
 * Live subscription to a collection.
 *
 * `deps` controls resubscription — put anything your constraints depend on in
 * there (a status filter, a tab, a role). The constraints array itself is not
 * compared, since a fresh array is built on every render.
 */
export function useRealtimeCollection<T = DocumentData>(
  path: string | null,
  constraints: QueryConstraint[] = [],
  deps: unknown[] = [],
): CollectionState<T> {
  const [state, setState] = useState<CollectionState<T>>({
    data: [],
    loading: Boolean(path),
    error: null,
  })

  useEffect(() => {
    if (!path) {
      setState({ data: [], loading: false, error: null })
      return
    }

    setState((prev) => ({ ...prev, loading: true }))

    const unsubscribe = onSnapshot(
      query(collection(db, path), ...constraints),
      (snapshot) => {
        setState({
          data: snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as T) })),
          loading: false,
          error: null,
        })
      },
      (error) => {
        // Almost always a missing composite index or a rules rejection —
        // the console link Firebase prints will create the index for you.
        console.error(`Firestore listener failed on "${path}":`, error)
        setState({ data: [], loading: false, error: error as Error })
      },
    )

    return () => unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps])

  return state
}

/** Merge two live collections into one list, newest first. */
export function useMergedCollections<T = DocumentData>(
  sources: { path: string; constraints?: QueryConstraint[]; tag?: string }[],
  sortValue: (row: WithId<T> & { source: string }) => number,
  deps: unknown[] = [],
) {
  const a = useRealtimeCollection<T>(sources[0]?.path ?? null, sources[0]?.constraints ?? [], deps)
  const b = useRealtimeCollection<T>(sources[1]?.path ?? null, sources[1]?.constraints ?? [], deps)

  const data = useMemo(() => {
    const tagA = sources[0]?.tag ?? sources[0]?.path ?? ""
    const tagB = sources[1]?.tag ?? sources[1]?.path ?? ""
    const merged = [
      ...a.data.map((row) => ({ ...row, source: tagA })),
      ...b.data.map((row) => ({ ...row, source: tagB })),
    ]
    return merged.sort((x, y) => sortValue(y) - sortValue(x))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.data, b.data])

  return { data, loading: a.loading || b.loading, error: a.error ?? b.error }
}

/** The signed-in staff member, or null while Firebase is still resolving. */
export function useCurrentUser() {
  const [user, setUser] = useState<User | null>(auth.currentUser)
  const [resolving, setResolving] = useState(!auth.currentUser)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (next) => {
      setUser(next)
      setResolving(false)
    })
    return () => unsubscribe()
  }, [])

  return { user, resolving }
}
