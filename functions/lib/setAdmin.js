"use strict";
// WHAT: Imports the Firebase Admin SDK.
// WHY:  The Admin SDK provides privileged access to Firebase services. It can bypass all security rules, which is necessary for administrative tasks like creating users and setting custom claims. This SDK is meant to be used in secure backend environments, never in a client-side app.
const admin = require("firebase-admin");
// IMPORTANT: Replace this with the actual name of the JSON file you downloaded.
// WHAT: Imports your project's service account key.
// WHY:  A service account is a special Google account that represents your backend server. The JSON file contains the private key that proves the server's identity to Firebase, granting it admin privileges.
// HOW:  You download this file from your Firebase project settings under "Service accounts". It should be kept secure and never committed to a public repository.
// const serviceAccount = require(
//     "./studypixel-9d599-firebase-adminsdk-fbsvc-f8614c03b3.json",
// );
// // WHAT: Initializes the Firebase Admin SDK with your service account credentials.
// // WHY:  This step authenticates your script with Firebase, unlocking its administrative powers.
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
// });
// WHAT: Defines the email and a temporary password for the administrator account.
// WHY:  This script is designed to create a specific, known admin user.
const email = "akashsalla14@gmail.com";
const password = "adminPassword123"; // Set a temporary password
/**
 * WHAT: A function to set a custom "admin" claim on a user's authentication token.
 * WHY:  Custom claims are the recommended way to implement role-based access control in Firebase. A claim is a piece of metadata embedded directly into a user's ID token. Our backend Cloud Functions and frontend app can then read this token to verify if a user is an admin without needing to query the database every time. This is both secure and highly efficient.
 * HOW:  It uses the `setCustomUserClaims` method from the Admin SDK. The second argument is an object where we define our claims. Here, we set `admin` to `true`.
 * @param {string} uid The user's ID.
 */
async function setAdminClaim(uid) {
    await admin.auth().setCustomUserClaims(uid, { admin: true });
    console.log(`Success! Custom claim set for ${email}. ` +
        "Log in for the changes to take effect.");
}
async function main() {
    try {
        // 1. NUCLEAR OPTION: Try to find and DELETE the user first.
        // This ensures we are starting with a 100% clean slate.
        const user = await admin.auth().getUserByEmail(email);
        console.log(`User ${email} found. Deleting to ensure clean state...`);
        await admin.auth().deleteUser(user.uid);
        // Also delete their profile from Firestore
        await admin.firestore().collection("users").doc(user.uid).delete();
    }
    catch (error) {
        // Ignore "user not found" errors, that's what we want.
        if (error.code !== "auth/user-not-found") {
            console.error("Error checking user:", error);
        }
    }
    console.log(`Creating fresh Admin user...`);
    // 2. Create the user fresh
    const userRecord = await admin.auth().createUser({
        email: email,
        password: password,
        displayName: "System Admin",
    });
    // 3. Create Firestore Profile
    await admin.firestore().collection("users").doc(userRecord.uid).set({
        name: "System Admin",
        email: email,
        role: "admin",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    // 4. Set Claims
    await setAdminClaim(userRecord.uid);
    console.log("✅ Admin Reset Complete. You can now log in.");
}
main();
