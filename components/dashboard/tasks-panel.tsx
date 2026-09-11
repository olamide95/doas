"use client"

import * as React from "react"
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  orderBy,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore"
import { CalendarDays, ListTodo, Plus, Trash2, UserRound, X } from "lucide-react"
import { COL, db } from "@/lib/firebase"
import { useCurrentUser, useRealtimeCollection } from "@/hooks/use-firestore"
import { formatDate, toMillis } from "@/lib/format"
import { toast } from "@/components/ui/toast"
import { EmptyState, LoadFailed, Panel, RowsSkeleton, TONE, type StateTone } from "./kit"
import { Segmented } from "./notifications-panel"
import { cn } from "@/lib/utils"

interface TaskDoc {
  title?: string
  description?: string
  assignedTo?: string
  assignedBy?: string
  unit?: string
  priority?: "low" | "medium" | "high"
  dueDate?: string
  completed?: boolean
  createdAt?: unknown
}

const PRIORITY_TONE: Record<string, StateTone> = { high: "stop", medium: "wait", low: "idle" }

export function TasksPanel({ unit }: { unit: string }) {
  const { user } = useCurrentUser()
  const [tab, setTab] = React.useState<"open" | "done" | "all">("open")
  const [composing, setComposing] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [form, setForm] = React.useState({
    title: "",
    description: "",
    assignedTo: "",
    priority: "medium" as TaskDoc["priority"],
    dueDate: "",
  })

  const { data, loading, error } = useRealtimeCollection<TaskDoc>(
    COL.tasks,
    [orderBy("createdAt", "desc"), limit(150)],
    [],
  )

  const tasks = React.useMemo(() => {
    const scoped = data.filter((t) => !t.unit || t.unit === unit)
    if (tab === "open") return scoped.filter((t) => !t.completed)
    if (tab === "done") return scoped.filter((t) => t.completed)
    return scoped
  }, [data, tab, unit])

  const openCount = data.filter((t) => (!t.unit || t.unit === unit) && !t.completed).length

  const resetForm = () =>
    setForm({ title: "", description: "", assignedTo: "", priority: "medium", dueDate: "" })

  const createTask = async () => {
    if (!form.title.trim()) {
      toast.warning({ title: "Add a title", description: "A task needs a name before it can be saved." })
      return
    }
    setSaving(true)
    try {
      await addDoc(collection(db, COL.tasks), {
        title: form.title.trim(),
        description: form.description.trim(),
        assignedTo: form.assignedTo.trim(),
        assignedBy: user?.displayName || user?.email || unit,
        unit,
        priority: form.priority,
        dueDate: form.dueDate,
        completed: false,
        createdAt: serverTimestamp(),
      })
      toast.success({ title: "Task created", description: form.title.trim() })
      resetForm()
      setComposing(false)
      setTab("open")
    } catch (err) {
      toast.error({
        title: "Task not created",
        description: err instanceof Error ? err.message : "Try again in a moment.",
      })
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (id: string, completed: boolean, title?: string) => {
    try {
      await updateDoc(doc(db, COL.tasks, id), { completed: !completed, updatedAt: new Date() })
      toast.success({
        title: completed ? "Task reopened" : "Task completed",
        description: title,
      })
    } catch {
      toast.error({ title: "Task not updated", description: "Check your connection and try again." })
    }
  }

  const remove = async (id: string, title?: string) => {
    try {
      await deleteDoc(doc(db, COL.tasks, id))
      toast.success({ title: "Task deleted", description: title })
    } catch {
      toast.error({ title: "Task not deleted", description: "Check your connection and try again." })
    }
  }

  return (
    <Panel
      title="Tasks"
      description={openCount ? `${openCount} still open` : "Nothing outstanding"}
      actions={
        <>
          <Segmented
            value={tab}
            onChange={(v) => setTab(v as typeof tab)}
            options={[
              { value: "open", label: "Open" },
              { value: "done", label: "Done" },
              { value: "all", label: "All" },
            ]}
          />
          <button
            type="button"
            onClick={() => setComposing((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[12.5px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            {composing ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {composing ? "Cancel" : "New task"}
          </button>
        </>
      }
      bodyClassName="p-3 sm:p-4"
    >
      {composing ? (
        <div className="reveal mb-4 rounded-lg border border-border bg-muted/40 p-3.5">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="What needs doing?"
              className="sm:col-span-2 rounded-lg border border-input bg-card px-3 py-2 text-[13.5px] outline-none focus:border-ring"
            />
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Any detail the assignee will need"
              rows={2}
              className="sm:col-span-2 resize-none rounded-lg border border-input bg-card px-3 py-2 text-[13.5px] outline-none focus:border-ring"
            />
            <input
              value={form.assignedTo}
              onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
              placeholder="Assign to"
              className="rounded-lg border border-input bg-card px-3 py-2 text-[13.5px] outline-none focus:border-ring"
            />
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              className="rounded-lg border border-input bg-card px-3 py-2 text-[13.5px] outline-none focus:border-ring"
            />
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value as TaskDoc["priority"] })}
              className="rounded-lg border border-input bg-card px-3 py-2 text-[13.5px] outline-none focus:border-ring"
            >
              <option value="low">Low priority</option>
              <option value="medium">Medium priority</option>
              <option value="high">High priority</option>
            </select>
            <button
              type="button"
              onClick={createTask}
              disabled={saving}
              className="rounded-lg bg-primary px-3 py-2 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Creating…" : "Create task"}
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <LoadFailed error={error} what="Tasks" />
      ) : loading ? (
        <RowsSkeleton rows={3} columns={3} />
      ) : !tasks.length ? (
        <EmptyState
          icon={ListTodo}
          title={tab === "done" ? "Nothing completed yet" : "No open tasks"}
          description="Create a task to track follow-ups that don't belong to a single application."
        />
      ) : (
        <ul className="space-y-2">
          {tasks
            .slice()
            .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
            .map((task, i) => (
              <li
                key={task.id}
                style={{ ["--i" as string]: Math.min(i, 8) }}
                className={cn(
                  "reveal group flex items-start gap-3 rounded-lg border border-border px-3.5 py-3",
                  task.completed ? "bg-muted/40" : "bg-card",
                )}
              >
                <input
                  type="checkbox"
                  checked={Boolean(task.completed)}
                  onChange={() => toggle(task.id, Boolean(task.completed), task.title)}
                  aria-label={task.completed ? "Reopen task" : "Complete task"}
                  className="mt-1 h-4 w-4 shrink-0 accent-[hsl(var(--accent))]"
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-[13.5px] font-semibold text-foreground",
                      task.completed && "text-muted-foreground line-through",
                    )}
                  >
                    {task.title}
                  </p>
                  {task.description ? (
                    <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
                      {task.description}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px] text-muted-foreground">
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.5 font-semibold",
                        TONE[PRIORITY_TONE[task.priority ?? "low"] ?? "idle"].soft,
                      )}
                    >
                      {(task.priority ?? "low").replace(/^./, (c) => c.toUpperCase())}
                    </span>
                    {task.assignedTo ? (
                      <span className="inline-flex items-center gap-1">
                        <UserRound className="h-3 w-3" />
                        {task.assignedTo}
                      </span>
                    ) : null}
                    {task.dueDate ? (
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        Due {formatDate(task.dueDate)}
                      </span>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => remove(task.id, task.title)}
                  aria-label="Delete task"
                  className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-[hsl(var(--state-stop-soft))] hover:text-[hsl(var(--state-stop))] focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
        </ul>
      )}
    </Panel>
  )
}
