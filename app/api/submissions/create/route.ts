import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { v4 as uuidv4 } from "uuid"

export async function POST(request: Request) {
  try {
    const submissionData = await request.json()
    
    // Generate submission ID
    const submissionId = `submission_${Date.now()}_${uuidv4().substring(0, 8)}`
    
    // Insert submission
    const { data, error } = await supabaseAdmin
      .from('submissions')
      .insert({
        title: `${submissionData.isFirstParty ? 'First' : 'Third'}-Party Application - ${submissionData.applicantName}`,
        description: `Application for ${submissionData.applicationType}`,
        status: 'Pending',
        department: 'Director',
        is_first_party: submissionData.isFirstParty,
        submission_id: submissionId,
        form_data: submissionData,
        file_urls: submissionData.fileUrls || null
      })
      .select()

    if (error) throw error

    return NextResponse.json({
      success: true,
      submissionId,
      data: data[0]
    })

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}