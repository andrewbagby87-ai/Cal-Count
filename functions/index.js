const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth"); 

initializeApp();

exports.syncHealthData = onRequest({ invoker: "public" }, async (req, res) => {
  const userId = req.headers['x-user-id'];

  if (!userId) {
    return res.status(401).send("Unauthorized: No User ID provided.");
  }

  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  try {
    const db = getFirestore();
    const data = req.body; 

    // Prepare the new sync entry
    const newSyncEntry = {
      ...data,
      timestamp: new Date().toISOString()
    };

    // Reference the specific document named after the userId
    const docRef = db.collection("healthLogs").doc(userId);

    // Use set with { merge: true } and arrayUnion to add the new sync
    // into a 'syncs' array. If the doc doesn't exist, it creates it.
    await docRef.set({
      userId: userId,
      syncs: FieldValue.arrayUnion(newSyncEntry)
    }, { merge: true });

    res.status(200).send("Data synced successfully!");
  } catch (error) {
    console.error("Error saving to Firestore:", error);
    res.status(500).send("Error saving data.");
  }
});

// NEW Function to securely approve a login session
exports.approveRemoteLogin = onCall(async (request) => {
  const uid = request.auth?.uid;
  const sessionId = request.data.sessionId;

  if (!uid) {
    throw new HttpsError("unauthenticated", "User must be logged in to approve a session.");
  }
  if (!sessionId) {
    throw new HttpsError("invalid-argument", "Session ID is required.");
  }

  try {
    // Generate a Custom Token using the Admin SDK
    const customToken = await getAuth().createCustomToken(uid);
    const db = getFirestore();

    // Write the Custom Token to Firestore where the original device is listening
    await db.collection("login_sessions").doc(sessionId).update({
      status: "approved",
      customToken: customToken
    });

    return { success: true };
  } catch (error) {
    console.error("Error approving remote login:", error);
    throw new HttpsError("internal", "Failed to approve remote login.");
  }
});