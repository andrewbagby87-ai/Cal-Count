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

    const newSyncEntry = {
      ...data,
      timestamp: new Date().toISOString()
    };

    // Use a subcollection instead of an unbounded array.
    // This creates a new document for every sync, preventing the 1MB crash limit.
    const syncsRef = db.collection("healthLogs").doc(userId).collection("syncs");
    
    // .add() automatically generates a unique ID for this specific sync payload
    await syncsRef.add(newSyncEntry);

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