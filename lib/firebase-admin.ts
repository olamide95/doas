import { cert, getApps, initializeApp, type App } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import { getFirestore } from "firebase-admin/firestore"

/**
 * Server-only Firebase Admin. Never import this from a "use client" file.
 * .env.local:
 *   FIREBASE_ADMIN_PROJECT_ID=doas-771c4
 *   FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxx@doas-771c4.iam.gserviceaccount.com
 *   FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
 */
function adminApp(): App {
  const existing = getApps()
  if (existing.length) return existing[0]
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n")
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin credentials are missing. Set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY in .env.local, then restart the server.",
    )
  }
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
}

export const adminAuth = () => getAuth(adminApp())
export const adminDb = () => getFirestore(adminApp())
