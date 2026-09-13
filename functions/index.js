// index.js
const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth"); 

initializeApp();

const extractDateStr = (rawDate) => {
  if (!rawDate) return null;
  if (typeof rawDate === 'string') {
    const parts = rawDate.split(' ');
    if (parts.length > 0) return parts[0].split('T')[0];
  }
  try { return new Date(rawDate).toISOString().split('T')[0]; } 
  catch (e) { return null; }
};

exports.syncHealthData = onRequest({ invoker: "public" }, async (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).send("Unauthorized: No User ID provided.");
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  try {
    const db = getFirestore();
    const payload = req.body; 
    
    let batch = db.batch();
    let opCount = 0;

    const commitBatchIfNeeded = async () => {
      if (opCount >= 450) { 
        await batch.commit();
        batch = db.batch(); 
        opCount = 0;
      }
    };

    // 1. EXTRACT WORKOUTS
    const workouts = payload.data?.workouts || payload.workouts || [];
    for (const w of workouts) {
      const rawDate = w.start || w.startDate || w.date || w.timestamp;
      const dateStr = extractDateStr(rawDate);
      if (!dateStr) continue;

      const timestampMs = new Date(rawDate).getTime() || Date.now();
      const docId = w.uuid || w.id || `workout_${timestampMs}`;
      const ref = db.collection("healthWorkouts").doc(`${userId}_${docId}`);

      batch.set(ref, {
        ...w, userId: userId, date: dateStr, timestamp: timestampMs, updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

      opCount++;
      await commitBatchIfNeeded();
    }

    // 2. EXTRACT METRICS (The Fix!)
    let metrics = [];
    if (payload.data?.metrics && Array.isArray(payload.data.metrics)) {
      metrics = payload.data.metrics;
    } else if (payload.metrics && Array.isArray(payload.metrics)) {
      metrics = payload.metrics;
    } else if (payload.name && Array.isArray(payload.data)) {
      metrics = [payload];
    } else if (Array.isArray(payload)) {
      metrics = payload;
    }

    for (const m of metrics) {
      const mName = (m.name || "").toLowerCase();
      const mData = m.data || [];
      
      for (const d of mData) {
        const rawDate = d.date || d.start || d.startDate || d.timestamp;
        const dateStr = extractDateStr(rawDate);
        if (!dateStr) continue;

        const timeMs = new Date(rawDate).getTime();
        const docId = `metric_${mName}_${timeMs}`;
        const ref = db.collection("healthMetrics").doc(`${userId}_${docId}`);

        batch.set(ref, {
          ...d, // 👇 MOVED TO THE TOP: Raw Apple data goes first!
          name: mName, 
          units: m.units || "", 
          date: dateStr, // 👇 NOW THIS OVERWRITES Apple's messy date with our clean "YYYY-MM-DD"
          timestamp: timeMs, 
          userId: userId, 
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });

        opCount++;
        await commitBatchIfNeeded();
      }
    }

    if (opCount > 0) await batch.commit();
    res.status(200).send("Data flattened and synced successfully!");
  } catch (error) {
    console.error("Error saving to Firestore:", error);
    res.status(500).send("Error saving data.");
  }
});

exports.approveRemoteLogin = onCall(async (request) => {
  const uid = request.auth?.uid;
  const sessionId = request.data.sessionId;

  if (!uid) throw new HttpsError("unauthenticated", "User must be logged in to approve a session.");
  if (!sessionId) throw new HttpsError("invalid-argument", "Session ID is required.");

  try {
    const customToken = await getAuth().createCustomToken(uid);
    const db = getFirestore();

    await db.collection("login_sessions").doc(sessionId).update({
      status: "approved", customToken: customToken
    });

    return { success: true };
  } catch (error) {
    console.error("Error approving remote login:", error);
    throw new HttpsError("internal", "Failed to approve remote login.");
  }
});