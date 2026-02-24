const { onRequest } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");
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

    // CHANGE: Write to a top-level collection 'healthLogs'
    // Include userId as a field so you can filter it later
    await db.collection("healthLogs").add({
      ...data,
      userId: userId, 
      timestamp: new Date().toISOString()
    });

    res.status(200).send("Data synced successfully!");
  } catch (error) {
    console.error("Error saving to Firestore:", error);
    res.status(500).send("Error saving data.");
  }
});