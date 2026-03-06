import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function POST(request: Request) {
  try {
    const requestData = await request.json()
    
    const { data, error } = await supabaseAdmin
      .from('meeting_requests')
      .insert({
        ...requestData,
        status: 'Pending',
        department: 'CSU'
      })
      .select()

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: data[0]
    })

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}