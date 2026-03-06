import { supabase } from "./supabase"

export type UserRole = "director" | "csu" | "planning" | "monitoring" | "finance" | "user"

export type User = {
  id: string
  email: string
  name: string
  role: UserRole
  department: string
  designation?: string
  avatar_url?: string
  active: boolean
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

    if (sessionError || !sessionData.session) {
      return null
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", sessionData.session.user.id)
      .single()

    if (profileError || !profile) {
      return null
    }

    return {
      id: sessionData.session.user.id,
      email: sessionData.session.user.email || "",
      name: profile.full_name || "",
      role: profile.role as UserRole,
      department: profile.department || "",
      designation: profile.designation || "",
      avatar_url: profile.avatar_url,
      active: profile.active !== false, // Default to true if not set
    }
  } catch (error) {
    console.error("Error getting current user:", error)
    return null
  }
}
