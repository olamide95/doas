"use client"

import * as React from "react"
import { AlertCircle, FileText, ImageIcon, Paperclip, Upload, X } from "lucide-react"
import { ACCEPT, checkFile, type StoredFile } from "@/lib/practitioner-registry"
import { cn } from "@/lib/utils"

/* Small, dependency-free field primitives for the registry forms. Native
 * inputs and selects so they behave on the low-end Android phones CSU uses. */

const control =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60"

export function FieldShell({
  id,
  label,
  required,
  error,
  hint,
  className,
  children,
}: {
  id: string
  label: string
  required?: boolean
  error?: string
  hint?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={id} className="text-[12.5px] font-semibold text-foreground">
        {label}
        {required ? <span className="ml-0.5 text-[hsl(var(--state-stop))]">*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="flex items-center gap-1 text-[11.5px] text-[hsl(var(--state-stop))]">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-[11.5px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

type Common = {
  id: string
  label: string
  required?: boolean
  error?: string
  hint?: string
  className?: string
  disabled?: boolean
}

export function TextInput({
  value,
  onChange,
  onBlur,
  placeholder,
  type = "text",
  inputMode,
  list,
  suffix,
  ...shell
}: Common & {
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  placeholder?: string
  type?: "text" | "email" | "tel" | "date"
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]
  list?: string
  suffix?: string
}) {
  return (
    <FieldShell {...shell}>
      <div className="relative">
        <input
          id={shell.id}
          type={type}
          value={value}
          list={list}
          inputMode={inputMode}
          disabled={shell.disabled}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-invalid={!!shell.error}
          className={cn(control, suffix && "pr-12", shell.error && "border-[hsl(var(--state-stop))]")}
        />
        {suffix ? (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[12px] text-muted-foreground">
            {suffix}
          </span>
        ) : null}
      </div>
    </FieldShell>
  )
}

export function SelectInput({
  value,
  onChange,
  options,
  placeholder = "Select…",
  ...shell
}: Common & {
  value: string
  onChange: (v: string) => void
  options: readonly string[]
  placeholder?: string
}) {
  return (
    <FieldShell {...shell}>
      <select
        id={shell.id}
        value={value}
        disabled={shell.disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!shell.error}
        className={cn(control, "appearance-none bg-[length:12px] pr-8", !value && "text-muted-foreground", shell.error && "border-[hsl(var(--state-stop))]")}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </FieldShell>
  )
}

export function YesNo({
  value,
  onChange,
  yes = "Yes",
  no = "No",
  ...shell
}: Common & { value: boolean | null; onChange: (v: boolean) => void; yes?: string; no?: string }) {
  return (
    <FieldShell {...shell}>
      <div id={shell.id} role="radiogroup" className="flex gap-2">
        {[
          { v: true, label: yes },
          { v: false, label: no },
        ].map((opt) => (
          <button
            key={String(opt.v)}
            type="button"
            role="radio"
            aria-checked={value === opt.v}
            onClick={() => onChange(opt.v)}
            className={cn(
              "flex-1 rounded-lg border px-3 py-2 text-[13px] font-semibold transition-colors",
              value === opt.v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </FieldShell>
  )
}

export function ReadOnly({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-[12.5px] font-semibold text-foreground">{label}</span>
      <div className="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2 text-[13px] text-foreground">
        {value || <span className="text-muted-foreground">Auto-calculated</span>}
      </div>
    </div>
  )
}

export function FormGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2", className)}>{children}</div>
}

export function FormSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{title}</h3>
        {description ? <p className="mt-0.5 text-[12px] text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

/* ------------------------------------------------------------------ *
 * File slots — a file already stored, a new file staged, or empty.
 * Uploads happen on save so a cancelled form leaves nothing behind.
 * ------------------------------------------------------------------ */

function fileIcon(type: string) {
  return type.startsWith("image/") ? ImageIcon : FileText
}

function sizeLabel(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export function FileSlot({
  id,
  label,
  hint,
  accept,
  required,
  stored,
  staged,
  onStage,
  onClear,
}: {
  id: string
  label: string
  hint?: string
  accept: keyof typeof ACCEPT
  required?: boolean
  stored?: StoredFile
  staged?: File | null
  onStage: (file: File | null) => void
  onClear?: () => void
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [error, setError] = React.useState("")

  const pick = (file?: File) => {
    if (!file) return
    const problem = checkFile(file, accept)
    if (problem) {
      setError(problem)
      return
    }
    setError("")
    onStage(file)
  }

  const current = staged ?? null
  const Icon = fileIcon(current?.type ?? stored?.type ?? "")

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12.5px] font-semibold text-foreground">
            {label}
            {required ? <span className="ml-0.5 text-[hsl(var(--state-stop))]">*</span> : null}
          </p>
          {hint ? <p className="text-[11.5px] text-muted-foreground">{hint}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[12px] font-semibold hover:bg-muted"
        >
          <Upload className="h-3.5 w-3.5" />
          {current || stored ? "Replace" : "Upload"}
        </button>
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={ACCEPT[accept]}
          className="hidden"
          onChange={(e) => {
            pick(e.target.files?.[0])
            e.target.value = ""
          }}
        />
      </div>

      {current ? (
        <div className="mt-2 flex items-center gap-2 rounded-md bg-primary/5 px-2.5 py-1.5 text-[12px]">
          <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="truncate font-medium">{current.name}</span>
          <span className="shrink-0 text-muted-foreground">{sizeLabel(current.size)} · uploads on save</span>
          <button type="button" aria-label="Remove" onClick={() => onStage(null)} className="ml-auto shrink-0 text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : stored ? (
        <div className="mt-2 flex items-center gap-2 rounded-md bg-muted/50 px-2.5 py-1.5 text-[12px]">
          <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <a href={stored.url} target="_blank" rel="noopener noreferrer" className="truncate font-medium underline-offset-2 hover:underline">
            {stored.name}
          </a>
          <span className="shrink-0 text-muted-foreground">{sizeLabel(stored.size)}</span>
          {onClear ? (
            <button type="button" aria-label="Remove file" onClick={onClear} className="ml-auto shrink-0 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="mt-1.5 flex items-center gap-1 text-[11.5px] text-[hsl(var(--state-stop))]">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function MultiFileSlot({
  id,
  label,
  accept,
  stored,
  staged,
  onStage,
  onRemoveStored,
}: {
  id: string
  label: string
  accept: keyof typeof ACCEPT
  stored: StoredFile[]
  staged: File[]
  onStage: (files: File[]) => void
  onRemoveStored: (index: number) => void
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [error, setError] = React.useState("")

  const add = (list: FileList | null) => {
    if (!list?.length) return
    const ok: File[] = []
    const problems: string[] = []
    Array.from(list).forEach((file) => {
      const problem = checkFile(file, accept)
      if (problem) problems.push(problem)
      else ok.push(file)
    })
    setError(problems.join(" · "))
    if (ok.length) onStage([...staged, ...ok])
  }

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12.5px] font-semibold text-foreground">{label}</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[12px] font-semibold hover:bg-muted"
        >
          <Paperclip className="h-3.5 w-3.5" />
          Add files
        </button>
        <input
          ref={inputRef}
          id={id}
          type="file"
          multiple
          accept={ACCEPT[accept]}
          className="hidden"
          onChange={(e) => {
            add(e.target.files)
            e.target.value = ""
          }}
        />
      </div>

      {stored.length || staged.length ? (
        <ul className="mt-2 space-y-1.5">
          {stored.map((file, i) => {
            const Icon = fileIcon(file.type)
            return (
              <li key={file.path} className="flex items-center gap-2 rounded-md bg-muted/50 px-2.5 py-1.5 text-[12px]">
                <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <a href={file.url} target="_blank" rel="noopener noreferrer" className="truncate font-medium hover:underline">
                  {file.name}
                </a>
                <span className="shrink-0 text-muted-foreground">{sizeLabel(file.size)}</span>
                <button type="button" aria-label="Remove file" onClick={() => onRemoveStored(i)} className="ml-auto shrink-0 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            )
          })}
          {staged.map((file, i) => {
            const Icon = fileIcon(file.type)
            return (
              <li key={`${file.name}-${i}`} className="flex items-center gap-2 rounded-md bg-primary/5 px-2.5 py-1.5 text-[12px]">
                <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="truncate font-medium">{file.name}</span>
                <span className="shrink-0 text-muted-foreground">{sizeLabel(file.size)} · uploads on save</span>
                <button
                  type="button"
                  aria-label="Remove"
                  onClick={() => onStage(staged.filter((_, j) => j !== i))}
                  className="ml-auto shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mt-1 text-[11.5px] text-muted-foreground">None on file</p>
      )}

      {error ? (
        <p className="mt-1.5 flex items-center gap-1 text-[11.5px] text-[hsl(var(--state-stop))]">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function ErrorSummary({ errors, labels }: { errors: Record<string, string>; labels: Record<string, string> }) {
  const keys = Object.keys(errors)
  if (!keys.length) return null
  return (
    <div className="rounded-lg border border-[hsl(var(--state-stop))]/30 bg-[hsl(var(--state-stop-soft))] px-3.5 py-2.5">
      <p className="text-[12.5px] font-semibold text-foreground">
        {keys.length} field{keys.length === 1 ? "" : "s"} need attention
      </p>
      <p className="mt-0.5 text-[12px] text-muted-foreground">{keys.map((k) => labels[k] ?? k).join(" · ")}</p>
    </div>
  )
}