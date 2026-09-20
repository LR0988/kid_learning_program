import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';

// Replace these values with your actual Firebase Web Config from the Firebase Console
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyC2jlu9cbuHYrjGgIWYOjcwNLS2O8btRRc",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "child-finance-management.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "child-finance-management",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "child-finance-management.firebasestorage.app",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "758427738242",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:758427738242:web:748d031c1087572b57d49b"
};

const app = initializeApp(firebaseConfig);
// 啟用 ignoreUndefinedProperties: true，避免物件中含有 undefined 屬性時 Firestore 丟出致命錯誤
const db = initializeFirestore(app, {
    ignoreUndefinedProperties: true
});

export { app, db };
