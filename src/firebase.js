import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: "AIzaSyDS-iDj7t9bgG1wBtld0KA4gtfCCxB6yI0",
  authDomain: "trainingplanner-53081.firebaseapp.com",
  projectId: "trainingplanner-53081",
  storageBucket: "trainingplanner-53081.firebasestorage.app",
  messagingSenderId: "1012052493782",
  appId: "1:1012052493782:web:a854bcc28cfd54bfa51077",
  measurementId: "G-BQZC2JW3GG"
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)
