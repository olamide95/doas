// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app"
import { getFirestore } from "firebase/firestore"
import { getAuth } from "firebase/auth"
import { getStorage } from "firebase/storage"

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA3R15_tAiapTQcKc_6cL8nN_FPoWRDFI0",
  authDomain: "doas-771c4.firebaseapp.com",
  projectId: "doas-771c4",
  storageBucket: "doas-771c4.appspot.com",
  messagingSenderId: "376823252081",
  appId: "1:376823252081:web:871302513d4da5fae107d0",
  measurementId: "G-5RM0N8JG2W"
};
  
// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize Firestore
const db = getFirestore(app)

// Initialize Firebase Authentication
const auth = getAuth(app)

// Initialize Firebase Storage
const storage = getStorage(app)

// Export Firebase services
export { app, db, auth, storage }
