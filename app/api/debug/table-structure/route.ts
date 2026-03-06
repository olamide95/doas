import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET(request: NextRequest) {
  try {
    // Validate environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAdminKey = process.env.SUPABASE_ADMIN_KEY

    if (!supabaseUrl || !supabaseAdminKey) {
      return NextResponse.json({ error: "Missing Supabase credentials" }, { status: 500 })
    }

    // Create a Supabase client with admin privileges
    const supabaseAdmin = createClient(supabaseUrl, supabaseAdminKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Get table structure
    const { data: tableInfo, error: tableError } = await supabaseAdmin
      .from("submissions")
      .select("*")
      .limit(1)
      .maybeSingle()

    if (tableError) {
      return NextResponse.json({ error: tableError.message }, { status: 500 })
    }

    // Get table definition from Postgres
    const { data: tableDefinition, error: definitionError } = await supabaseAdmin
      .rpc("get_table_definition", { table_name: "submissions" })
      .maybeSingle()

    // Return table structure information
    return NextResponse.json({
      columns: tableInfo ? Object.keys(tableInfo) : [],
      sample: tableInfo,
      definition: tableDefinition || { error: definitionError?.message || "Could not get table definition" },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
