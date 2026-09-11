"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

const CONTROL =
  "w-full rounded-lg border border-input bg-card px-3 py-2 text-[13.5px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-ring disabled:opacity-50"

export function FieldGrid({
  columns = 2,
  children,
}: {
  columns?: 1 | 2 | 3 | 4
  children: React.ReactNode
}) {
  const cols = {
    1: "sm:grid-cols-1",
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4",
  }[columns]
  return <div className={cn("grid grid-cols-1 gap-4", cols)}>{children}</div>
}

function Wrap({
  label,
  hint,
  htmlFor,
  span,
  children,
}: {
  label: string
  hint?: string
  htmlFor: string
  span?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={cn("min-w-0", span && "sm:col-span-2 lg:col-span-4")}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[12.5px] font-medium text-foreground">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-[11.5px] text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
  type = "text",
  span,
  mono,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  hint?: string
  type?: "text" | "date" | "time" | "email" | "tel"
  span?: boolean
  mono?: boolean
}) {
  return (
    <Wrap label={label} hint={hint} htmlFor={id} span={span}>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(CONTROL, mono && "font-mono text-[12.5px]")}
      />
    </Wrap>
  )
}

export function NumberField({
  id,
  label,
  value,
  onChange,
  hint,
  prefix,
  readOnly,
  span,
}: {
  id: string
  label: string
  value: number | string
  onChange?: (value: number) => void
  hint?: string
  prefix?: string
  readOnly?: boolean
  span?: boolean
}) {
  return (
    <Wrap label={label} hint={hint} htmlFor={id} span={span}>
      <div className="relative">
        {prefix ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">
            {prefix}
          </span>
        ) : null}
        <input
          id={id}
          type="number"
          inputMode="numeric"
          readOnly={readOnly}
          value={value}
          onChange={(e) => onChange?.(Number(e.target.value))}
          className={cn(
            CONTROL,
            "tnum",
            prefix && "pl-7",
            readOnly && "bg-muted text-muted-foreground",
          )}
        />
      </div>
    </Wrap>
  )
}

export function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  hint,
  span,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  hint?: string
  span?: boolean
}) {
  return (
    <Wrap label={label} hint={hint} htmlFor={id} span={span}>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={CONTROL}>
        <option value="">Select…</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Wrap>
  )
}

export function YesNoField({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-[12.5px] font-medium text-foreground">{label}</p>
      <div className="inline-flex w-full rounded-lg border border-input p-0.5">
        {["Yes", "No"].map((option) => (
          <button
            key={option}
            id={`${id}-${option}`}
            type="button"
            onClick={() => onChange(option)}
            aria-pressed={value === option}
            className={cn(
              "flex-1 rounded-[7px] px-2 py-1.5 text-[12.5px] font-semibold transition-colors",
              value === option
                ? option === "Yes"
                  ? "bg-[hsl(var(--state-stop-soft))] text-[hsl(var(--state-stop))]"
                  : "bg-[hsl(var(--state-clear-soft))] text-[hsl(var(--state-clear))]"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}

export function TextareaField({
  id,
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  hint,
  span = true,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  hint?: string
  span?: boolean
}) {
  return (
    <Wrap label={label} hint={hint} htmlFor={id} span={span}>
      <textarea
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(CONTROL, "resize-none leading-relaxed")}
      />
    </Wrap>
  )
}

export function SearchField({
  value,
  onChange,
  placeholder = "Search",
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <input
      type="search"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cn(CONTROL, "sm:w-72", className)}
    />
  )
}

export function ActionButton({
  children,
  onClick,
  tone = "primary",
  disabled,
  icon: Icon,
  type = "button",
}: {
  children: React.ReactNode
  onClick?: () => void
  tone?: "primary" | "danger" | "quiet"
  disabled?: boolean
  icon?: React.ElementType
  type?: "button" | "submit"
}) {
  const styles = {
    primary: "bg-primary text-primary-foreground hover:opacity-90",
    danger:
      "border border-[hsl(var(--state-stop))]/40 text-[hsl(var(--state-stop))] hover:bg-[hsl(var(--state-stop-soft))]",
    quiet: "border border-border text-foreground hover:bg-muted",
  }[tone]

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50",
        styles,
      )}
    >
      {Icon ? <Icon className="h-4 w-4" aria-hidden /> : null}
      {children}
    </button>
  )
}
