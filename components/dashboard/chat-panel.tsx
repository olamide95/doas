"use client"

import * as React from "react"
import { addDoc, collection, limit, orderBy, serverTimestamp } from "firebase/firestore"
import { MessagesSquare, SendHorizontal } from "lucide-react"
import { COL, db } from "@/lib/firebase"
import { useCurrentUser, useRealtimeCollection } from "@/hooks/use-firestore"
import { formatTime, initials, toMillis } from "@/lib/format"
import { toast } from "@/components/ui/toast"
import { EmptyState, LoadFailed, Panel } from "./kit"
import { cn } from "@/lib/utils"

export interface ChatChannel {
  id: string
  name: string
}

interface MessageDoc {
  text?: string
  sender?: string
  senderName?: string
  timestamp?: unknown
}

export function ChatPanel({
  role,
  channels,
}: {
  /** The unit this staff member posts as — "csu", "director", … */
  role: string
  channels: ChatChannel[]
}) {
  const { user } = useCurrentUser()
  const [active, setActive] = React.useState(channels[0]?.id ?? "")
  const [draft, setDraft] = React.useState("")
  const [sending, setSending] = React.useState(false)
  const endRef = React.useRef<HTMLDivElement>(null)

  const { data, loading, error } = useRealtimeCollection<MessageDoc>(
    active ? `${COL.chats}/${active}/messages` : null,
    [orderBy("timestamp", "asc"), limit(200)],
    [active],
  )

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [data.length, active])

  const send = async (event: React.FormEvent) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text || sending || !active) return

    setSending(true)
    setDraft("")
    try {
      await addDoc(collection(db, `${COL.chats}/${active}/messages`), {
        text,
        sender: role,
        senderName: user?.displayName || user?.email || role.toUpperCase(),
        timestamp: serverTimestamp(),
      })
    } catch (err) {
      setDraft(text)
      toast.error({
        title: "Message not sent",
        description: err instanceof Error ? err.message : "Check your connection and try again.",
      })
    } finally {
      setSending(false)
    }
  }

  const messages = React.useMemo(
    () => data.slice().sort((a, b) => toMillis(a.timestamp) - toMillis(b.timestamp)),
    [data],
  )

  return (
    <Panel bodyClassName="p-0">
      <div className="grid min-h-[60vh] grid-rows-[auto_1fr] md:grid-cols-[200px_1fr] md:grid-rows-1">
        <aside className="border-b border-border p-2 md:border-b-0 md:border-r">
          <div className="flex gap-1 overflow-x-auto scroll-slim md:flex-col md:overflow-visible">
            {channels.map((channel) => (
              <button
                key={channel.id}
                type="button"
                onClick={() => setActive(channel.id)}
                className={cn(
                  "whitespace-nowrap rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors md:w-full",
                  active === channel.id
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                {channel.name}
              </button>
            ))}
          </div>
        </aside>

        <div className="flex min-h-0 flex-col">
          <div className="flex-1 overflow-y-auto scroll-slim p-4">
            {error ? (
              <LoadFailed error={error} what="Messages" />
            ) : loading ? (
              <div className="space-y-3" aria-hidden>
                {[70, 45, 60].map((w, i) => (
                  <div key={i} className="skeleton h-10 rounded-lg" style={{ width: `${w}%` }} />
                ))}
              </div>
            ) : !messages.length ? (
              <EmptyState
                icon={MessagesSquare}
                title="No messages in this channel"
                description="Send the first one — everyone on the other desk sees it straight away."
              />
            ) : (
              <div className="space-y-3">
                {messages.map((message) => {
                  const mine = message.sender === role
                  return (
                    <div
                      key={message.id}
                      className={cn("fade-in flex gap-2", mine ? "justify-end" : "justify-start")}
                    >
                      {!mine ? (
                        <span className="mt-auto grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-[10.5px] font-semibold text-muted-foreground">
                          {initials(message.senderName ?? message.sender)}
                        </span>
                      ) : null}
                      <div className={cn("max-w-[76%]", mine && "text-right")}>
                        <div
                          className={cn(
                            "rounded-2xl px-3.5 py-2 text-[13.5px] leading-relaxed",
                            mine
                              ? "rounded-br-sm bg-primary text-primary-foreground"
                              : "rounded-bl-sm bg-muted text-foreground",
                          )}
                        >
                          {message.text}
                        </div>
                        <p className="mt-1 text-[10.5px] text-muted-foreground">
                          {message.senderName ?? message.sender} · {formatTime(message.timestamp, "sending…")}
                        </p>
                      </div>
                    </div>
                  )
                })}
                <div ref={endRef} />
              </div>
            )}
          </div>

          <form onSubmit={send} className="flex items-center gap-2 border-t border-border p-3">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Write a message"
              className="flex-1 rounded-lg border border-input bg-card px-3.5 py-2.5 text-[13.5px] outline-none transition-colors focus:border-ring"
            />
            <button
              type="submit"
              disabled={!draft.trim() || sending}
              aria-label="Send message"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <SendHorizontal className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </Panel>
  )
}
