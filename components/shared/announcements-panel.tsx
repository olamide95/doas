"use client"

import * as React from "react"
import { addDoc, collection, doc, limit, orderBy, updateDoc } from "firebase/firestore"
import { ImagePlus, Loader2, Megaphone, MapPin, Pencil, Plus, XCircle } from "lucide-react"
import { COL, db } from "@/lib/firebase"
import { AREA_COUNCILS, notifyIdFor } from "@/lib/workflow"
import { STRUCTURE_TYPES, typeLabel } from "@/lib/tariff"
import { uploadRecordFile } from "@/lib/practitioner-registry"
import { useRealtimeCollection } from "@/hooks/use-firestore"
import { formatDate, truncate } from "@/lib/format"
import { toast } from "@/components/ui/toast"
import { Sheet } from "@/components/dashboard/sheet"
import { ActionButton, FieldGrid, SelectField, TextField, TextareaField } from "@/components/dashboard/form-kit"
import { EmptyState, LoadFailed, Panel, RowsSkeleton, StatusPill } from "@/components/dashboard/kit"
import { Segmented } from "@/components/dashboard/notifications-panel"

/**
 * New sites announced to practitioners. CSU and the Director post them here;
 * every practitioner sees open announcements on their portal dashboard and can
 * apply for the site directly from it.
 */

export interface Announcement {
  title: string
  description: string
  address: string
  areaCouncil: string
  district: string
  latitude: string
  longitude: string
  structureType: string
  dimensions: string
  faces: string
  closingDate: string
  photoUrl: string
  status: "open" | "closed"
  postedBy: string
  createdAt: string
  updatedAt: string
}

const EMPTY: Omit<Announcement, "status" | "postedBy" | "createdAt" | "updatedAt"> = {
  title: "",
  description: "",
  address: "",
  areaCouncil: "",
  district: "",
  latitude: "",
  longitude: "",
  structureType: "",
  dimensions: "",
  faces: "1",
  closingDate: "",
  photoUrl: "",
}

export function isOpen(a: Pick<Announcement, "status" | "closingDate">) {
  if (a.status !== "open") return false
  if (!a.closingDate) return true
  return a.closingDate >= new Date().toISOString().slice(0, 10)
}

export function AnnouncementsPanel({ actor }: { actor: "csu" | "director" }) {
  const { data, loading, error } = useRealtimeCollection<Announcement>(COL.announcements, [orderBy("createdAt", "desc"), limit(200)], [])
  const [filter, setFilter] = React.useState<"open" | "closed" | "all">("open")
  const [editing, setEditing] = React.useState<{ id: string | null } | null>(null)
  const [form, setForm] = React.useState(EMPTY)
  const [busy, setBusy] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)

  const rows = data.filter((a) => (filter === "all" ? true : filter === "open" ? isOpen(a) : !isOpen(a)))

  const open = (row?: Announcement & { id: string }) => {
    setForm(row ? { ...EMPTY, ...row } : EMPTY)
    setEditing({ id: row?.id ?? null })
  }

  const set = (patch: Partial<typeof EMPTY>) => setForm((f) => ({ ...f, ...patch }))

  const uploadPhoto = async (file?: File) => {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.warning({ title: "Use a photo", description: "JPG or PNG." })
      return
    }
    setUploading(true)
    try {
      const stored = await uploadRecordFile("announcements", "photo", file)
      set({ photoUrl: stored.url })
    } catch (err) {
      toast.error({ title: "Upload failed", description: err instanceof Error ? err.message : "Try again." })
    } finally {
      setUploading(false)
    }
  }

  const save = async () => {
    if (!form.title.trim() || !form.address.trim() || !form.areaCouncil || !form.structureType) {
      toast.warning({ title: "Missing detail", description: "Title, address, area council and structure type are required." })
      return
    }
    if ((form.latitude && !Number.isFinite(Number(form.latitude))) || (form.longitude && !Number.isFinite(Number(form.longitude)))) {
      toast.warning({ title: "Coordinates must be numbers" })
      return
    }
    setBusy(true)
    const now = new Date().toISOString()
    try {
      const clean = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, String(v).trim()]))
      if (editing?.id) {
        await updateDoc(doc(db, COL.announcements, editing.id), { ...clean, updatedAt: now, updatedBy: actor })
        toast.success({ title: "Announcement updated" })
      } else {
        await addDoc(collection(db, COL.announcements), { ...clean, status: "open", postedBy: actor, createdAt: now, updatedAt: now })
        await addDoc(collection(db, COL.notifications), {
          userId: notifyIdFor(actor === "csu" ? "Director" : "CSU"),
          content: `New site announced to practitioners: ${clean.title}`,
          type: "info",
          isRead: false,
          createdAt: now,
        })
        toast.success({ title: "Site announced", description: "Practitioners can now see it on their dashboard." })
      }
      setEditing(null)
    } catch (err) {
      toast.error({ title: "Not saved", description: err instanceof Error ? err.message : "Try again." })
    } finally {
      setBusy(false)
    }
  }

  const close = async (id: string) => {
    try {
      await updateDoc(doc(db, COL.announcements, id), { status: "closed", updatedAt: new Date().toISOString(), updatedBy: actor })
      toast.success({ title: "Announcement closed" })
    } catch (err) {
      toast.error({ title: "Not closed", description: err instanceof Error ? err.message : "Try again." })
    }
  }

  return (
    <>
      <Panel
        title="New site announcements"
        description="Sites announced here appear on every practitioner's portal dashboard, with an Apply button"
        actions={
          <>
            <Segmented
              value={filter}
              onChange={(v) => setFilter(v as typeof filter)}
              options={[
                { value: "open", label: "Open" },
                { value: "closed", label: "Closed" },
                { value: "all", label: "All" },
              ]}
            />
            <ActionButton icon={Plus} onClick={() => open()}>
              Announce a site
            </ActionButton>
          </>
        }
        bodyClassName="p-3 sm:p-4"
      >
        {error ? (
          <LoadFailed error={error} what="Announcements" />
        ) : loading ? (
          <RowsSkeleton rows={3} columns={3} />
        ) : !rows.length ? (
          <EmptyState icon={Megaphone} title="No announcements" description="Announce a new site and practitioners can apply for it from their portal." />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {rows.map((a) => (
              <li key={a.id} className="overflow-hidden rounded-lg border border-border bg-card">
                {a.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.photoUrl} alt={a.title} className="h-36 w-full object-cover" />
                ) : null}
                <div className="space-y-1.5 p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[14px] font-semibold text-foreground">{a.title}</p>
                    <StatusPill status={isOpen(a) ? "Active" : "Expired"} />
                  </div>
                  <p className="flex items-center gap-1 text-[12.5px] text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    {truncate(a.address, 60)} · {a.district ? `${a.district}, ` : ""}
                    {a.areaCouncil}
                  </p>
                  <p className="text-[12.5px] text-muted-foreground">
                    {typeLabel(a.structureType)}
                    {a.dimensions ? ` · ${a.dimensions}` : ""}
                    {a.closingDate ? ` · closes ${formatDate(a.closingDate)}` : ""}
                  </p>
                  {a.description ? <p className="text-[12.5px] text-foreground">{truncate(a.description, 140)}</p> : null}
                  <div className="flex gap-2 pt-1.5">
                    <ActionButton tone="quiet" icon={Pencil} onClick={() => open(a)}>
                      Edit
                    </ActionButton>
                    {isOpen(a) ? (
                      <ActionButton tone="danger" icon={XCircle} onClick={() => close(a.id)}>
                        Close
                      </ActionButton>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Sheet
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Edit announcement" : "Announce a new site"}
        caption="Visible to every practitioner with a portal login"
        footer={
          <div className="flex justify-end gap-2">
            <ActionButton tone="quiet" onClick={() => setEditing(null)}>
              Cancel
            </ActionButton>
            <ActionButton icon={busy ? Loader2 : Megaphone} disabled={busy || uploading} onClick={save}>
              {editing?.id ? "Save changes" : "Publish to practitioners"}
            </ActionButton>
          </div>
        }
      >
        <div className="space-y-4">
          <FieldGrid>
            <TextField id="an-title" label="Title *" value={form.title} placeholder="Unipole site — Airport Road, Lugbe" onChange={(v) => set({ title: v })} span />
            <TextareaField id="an-address" label="Site address *" value={form.address} rows={2} onChange={(v) => set({ address: v })} />
            <SelectField id="an-council" label="Area council *" value={form.areaCouncil} options={AREA_COUNCILS.map((c) => ({ value: c, label: c }))} onChange={(v) => set({ areaCouncil: v })} />
            <TextField id="an-district" label="District" value={form.district} onChange={(v) => set({ district: v })} />
            <TextField id="an-lat" label="Latitude" mono value={form.latitude} onChange={(v) => set({ latitude: v })} />
            <TextField id="an-lng" label="Longitude" mono value={form.longitude} onChange={(v) => set({ longitude: v })} />
            <SelectField id="an-type" label="Structure type *" value={form.structureType} options={STRUCTURE_TYPES} onChange={(v) => set({ structureType: v })} />
            <TextField id="an-dims" label="Permitted dimensions" value={form.dimensions} placeholder="12m × 4m" onChange={(v) => set({ dimensions: v })} />
            <TextField id="an-faces" label="Faces" value={form.faces} onChange={(v) => set({ faces: v })} />
            <TextField id="an-close" label="Closing date" type="date" value={form.closingDate} onChange={(v) => set({ closingDate: v })} />
          </FieldGrid>
          <TextareaField id="an-desc" label="Description / conditions" rows={4} value={form.description} onChange={(v) => set({ description: v })} />
          <div>
            <p className="mb-1.5 text-[12.5px] font-medium text-foreground">Site photo</p>
            <div className="flex items-center gap-3">
              {form.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.photoUrl} alt="Site" className="h-20 w-28 rounded-lg border border-border object-cover" />
              ) : null}
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[12.5px] font-semibold hover:bg-muted">
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                {form.photoUrl ? "Replace photo" : "Add photo"}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadPhoto(e.target.files?.[0])} />
              </label>
            </div>
          </div>
        </div>
      </Sheet>
    </>
  )
}
