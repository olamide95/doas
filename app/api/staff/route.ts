import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient()
    const data = await request.json()

    const { email, password, fullName, phone, department, designation, role } = data

    // Validate required fields
    if (!email || !password || !fullName || !department || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Create user with admin privileges
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        department,
        designation,
        role,
        phone,
      },
    })

    if (userError) {
      console.error("Error creating user:", userError)
      return NextResponse.json({ error: `Authentication error: ${userError.message}` }, { status: 500 })
    }

    // Ensure profile exists
    const { error: profileError } = await supabase.from("profiles").upsert({
      id: userData.user.id,
      full_name: fullName,
      email,
      phone,
      department,
      designation,
      role,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      active: true,
    })

    if (profileError) {
      console.error("Error creating profile:", profileError)
      return NextResponse.json({ error: `Profile error: ${profileError.message}` }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      user: userData.user,
    })
  } catch (error) {
    console.error("Unexpected error:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}
