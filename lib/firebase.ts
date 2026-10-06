import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app"
import { getFirestore } from "firebase/firestore"
import { getAuth } from "firebase/auth"
import { getStorage } from "firebase/storage"

/**
 * Web config comes from .env.local (and the hosting provider's env settings).
 * Each variable is referenced literally so Next.js can inline it at build time —
 * don't refactor these into a loop or dynamic lookup.
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

const REQUIRED: [keyof typeof firebaseConfig, string][] = [
  ["apiKey", "NEXT_PUBLIC_FIREBASE_API_KEY"],
  ["authDomain", "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"],
  ["projectId", "NEXT_PUBLIC_FIREBASE_PROJECT_ID"],
  ["storageBucket", "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"],
  ["appId", "NEXT_PUBLIC_FIREBASE_APP_ID"],
]

const missing = REQUIRED.filter(([key]) => !firebaseConfig[key]).map(([, name]) => name)
if (missing.length) {
  throw new Error(
    `Firebase config missing: ${missing.join(", ")}. Add them to .env.local (or your host's environment variables) and restart the server.`,
  )
}

const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig)

export const db = getFirestore(app)
export const auth = getAuth(app)
export const storage = getStorage(app)
export { app }

/** Firestore collection names, in one place so a rename is a one-line change. */
export const COL = {
  firstParty: "firstPartySubmissions",
  thirdParty: "thirdPartySubmissions",
  practitioners: "practitioners",
  meetings: "meetingRequests",
  notifications: "notifications",
  tasks: "tasks",
  staff: "staff",
  activity: "activityLogs",
  chats: "chats",
  register: "permitRegister",
  tariffs: "tariffSchedules",
  compliance: "complianceIssues",
} as const