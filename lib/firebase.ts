import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app"
import { getFirestore } from "firebase/firestore"
import { getAuth } from "firebase/auth"
import { getStorage } from "firebase/storage"

/**
 * Config comes from .env.local so it isn't hard-coded in the repo:
 *
 * NEXT_PUBLIC_FIREBASE_API_KEY=...
 * NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=doas-771c4.firebaseapp.com
 * NEXT_PUBLIC_FIREBASE_PROJECT_ID=doas-771c4
 * NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=doas-771c4.firebasestorage.app
 * NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
 * NEXT_PUBLIC_FIREBASE_APP_ID=...
 * NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=...
 *
 * A web API key is not a secret — it identifies the project, it doesn't grant
 * access. What actually protects your data is Firestore + Storage security
 * rules, so make sure those are locked to authenticated staff before launch.
 */
const firebaseConfig = {
  apiKey: "AIzaSyA3R15_tAiapTQcKc_6cL8nN_FPoWRDFI0",
  authDomain: "doas-771c4.firebaseapp.com",
  projectId: "doas-771c4",
  storageBucket: "doas-771c4.firebasestorage.app",
  messagingSenderId: "376823252081",
  appId: "1:376823252081:web:871302513d4da5fae107d0",
  measurementId: "G-5RM0N8JG2W"
};

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
} as const
