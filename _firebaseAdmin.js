// api/_firebaseAdmin.js
// Lazily initializes firebase-admin using a service account key stored
// in Vercel environment variables. This talks to Firestore directly —
// it does NOT need your Firebase project to be on the Blaze plan.
// (Only Cloud Functions themselves require Blaze; Firestore/Auth access
// via the Admin SDK from an external host like Vercel is free.)

const admin = require("firebase-admin");

function getAdmin() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Vercel env vars store the key as one line with literal \n —
        // convert those back into real newlines.
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n")
      })
    });
  }
  return admin;
}

module.exports = { getAdmin };
