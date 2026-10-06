import { DEPARTMENT } from "@/lib/workflow"

export interface Desk {
  slug: string
  department: string
  path: string
  label: string
  /** Older department names still found on staff records. */
  aliases?: string[]
}

export const DESKS: Desk[] = [
  { slug: "csu", department: DEPARTMENT.csu, path: "/dashboard/csu", label: "Customer Service Unit" },
  { slug: "director", department: DEPARTMENT.director, path: "/dashboard/director", label: "Director's Office", aliases: ["Director's Office"] },
  { slug: "business-development", department: DEPARTMENT.businessDevelopment, path: "/dashboard/business-development", label: "Business Development" },
  { slug: "planning", department: DEPARTMENT.planning, path: "/dashboard/planning", label: "Planning & Development" },
  { slug: "billing", department: DEPARTMENT.billing, path: "/dashboard/billing", label: "Billing" },
  { slug: "finance", department: DEPARTMENT.finance, path: "/dashboard/finance", label: "Finance & Admin", aliases: ["Finance and Admin"] },
  { slug: "monitoring", department: DEPARTMENT.monitoring, path: "/dashboard/monitoring", label: "Monitoring & Enforcement" },
]

export function deskForDepartment(department?: string | null) {
  if (!department) return undefined
  return DESKS.find((d) => d.department === department || d.aliases?.includes(department))
}

export function deskForPath(pathname?: string | null) {
  if (!pathname) return undefined
  return DESKS.find((d) => pathname === d.path || pathname.startsWith(`${d.path}/`))
}

export const DESIGNATIONS = ["Director", "Deputy Director", "Head of Unit", "Manager", "Supervisor", "Officer", "Assistant"]
