import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBF7P-Soao-ZSams3JceNVRYpr5tNs_RIs",
  authDomain: "campeonato-82be4.firebaseapp.com",
  projectId: "campeonato-82be4",
  storageBucket: "campeonato-82be4.firebasestorage.app",
  messagingSenderId: "185901856877",
  appId: "1:185901856877:web:f1336e539b7a92aeb36764"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
