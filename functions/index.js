const { onRequest } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { initializeApp } = require("firebase-admin/app");

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