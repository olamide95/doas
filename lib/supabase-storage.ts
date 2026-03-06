import { v4 as uuidv4 } from "uuid"

const SUBMISSIONS_BUCKET = "submissions"
const AVATARS_BUCKET = "avatars"
const CHAT_ATTACHMENTS_BUCKET = "chat-attachments"

// Upload a file to a specific bucket
export async function uploadFile(bucket: string, filePath: string, file: File) {
  try {
    console.log(`Uploading file to ${bucket} bucket:`, filePath)

    // Create form data for the API request
    const formData = new FormData()
    formData.append("file", file)
    formData.append("bucket", bucket)
    formData.append("path", filePath)

    // Use the server API route to bypass RLS
    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      let errorMessage = "Error uploading file via API"
      try {
        const errorData = await response.json()
        errorMessage = errorData.error || errorMessage
      } catch (e) {
        console.error("Could not parse error response:", e)
      }

      console.error("Upload API error:", errorMessage)
      throw new Error(errorMessage)
    }

    const data = await response.json()
    console.log("File uploaded successfully:", data.url)
    return { url: data.url, error: null }
  } catch (error) {
    console.error(`Error uploading file to ${bucket}:`, error)
    return { url: null, error }
  }
}

// Upload a submission document
export async function uploadSubmissionDocument(file: File, submissionId: string) {
  const fileExt = file.name.split(".").pop()
  const filePath = `${submissionId}/${uuidv4()}.${fileExt}`

  const { url, error } = await uploadFile(SUBMISSIONS_BUCKET, filePath, file)

  if (error) {
    console.error("Error uploading file:", error)
    throw error
  }

  return url
}

// Upload a profile avatar
export async function uploadAvatar(file: File, userId: string) {
  const fileExt = file.name.split(".").pop()
  const filePath = `${userId}.${fileExt}`

  const { url, error } = await uploadFile(AVATARS_BUCKET, filePath, file)

  if (error) {
    console.error("Error uploading avatar:", error)
    throw error
  }

  return url
}

// Upload a chat attachment
export async function uploadChatAttachment(file: File, chatRoomId: string) {
  const fileExt = file.name.split(".").pop()
  const filePath = `${chatRoomId}/${uuidv4()}.${fileExt}`

  const { url, error } = await uploadFile(CHAT_ATTACHMENTS_BUCKET, filePath, file)

  if (error) {
    console.error("Error uploading chat attachment:", error)
    throw error
  }

  return url
}

// Delete a file
export async function deleteFile(bucket: string, filePath: string) {
  // This would require authentication or server-side handling
  throw new Error("Operation not supported for public users")
}
