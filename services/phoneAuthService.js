// Phone sign-in: the phone proves the number to Firebase (SMS code), Firebase gives the app a signed ID token, and this
// service checks that token. Only the project id is needed to check it (Google's public keys do the rest), so no
// secret is stored on the server. Disabled until FIREBASE_PROJECT_ID is set.
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || '';
if (!FIREBASE_PROJECT_ID) {
  console.warn('FIREBASE_PROJECT_ID is not set — phone sign-in is disabled.');
}

let adminAuth = null;
const getAdminAuth = () => {
  if (!adminAuth) {
    const admin = require('firebase-admin');
    const app = admin.apps.length ? admin.app() : admin.initializeApp({ projectId: FIREBASE_PROJECT_ID });
    adminAuth = app.auth();
  }
  return adminAuth;
};

const isEnabled = () => Boolean(FIREBASE_PROJECT_ID);

// Returns the verified phone number in international form (+919876543210), or throws.
const verifyPhoneToken = async (idToken, verifier) => {
  const decoded = await (verifier ? verifier(idToken) : getAdminAuth().verifyIdToken(idToken));
  if (!decoded || !decoded.phone_number) {
    throw new Error('The token does not carry a verified phone number');
  }
  return decoded.phone_number;
};

// Phone numbers are stored as typed (9876543215, +91 98765 43215, ...). Two numbers are the same person's when their
// last 10 digits agree.
const lastTenDigits = (phone) => String(phone || '').replace(/\D/g, '').slice(-10);

module.exports = { isEnabled, verifyPhoneToken, lastTenDigits };
