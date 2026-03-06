import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const bucket = formData.get('bucket') as string
    const path = formData.get('path') as string

    if (!file || !bucket || !path) {
      throw new Error('Missing required fields')
    }

    // Upload file
    const { data, error } = await supabaseAdmin
      .storage
      .from(bucket)
      .upload(path, file)

    if (error) throw error

    // Get public URL
    const { data: urlData } = supabaseAdmin
      .storage
      .from(bucket)
      .getPublicUrl(path)

    return NextResponse.json({
      url: urlData.publicUrl,
      path
    })

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}