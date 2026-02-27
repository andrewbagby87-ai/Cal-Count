import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  Timestamp,
  updateDoc,
  deleteDoc,
  addDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  UserProfile,
  Food,
  FoodLog,
  WorkoutLog,
  WeightLog,
} from '../types';

// User Profile Operations
export async function createUserProfile(uid: string, profile: Omit<UserProfile, 'uid' | 'createdAt'>) {
  const docRef = doc(db, 'users', uid);
  await setDoc(docRef, {
    ...profile,
    uid,
    createdAt: Timestamp.now(),
  });
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const docRef = doc(db, 'users', uid);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const data = docSnap.data() as any;
    return {
      ...data,
      createdAt: (data.createdAt as Timestamp).toMillis?.() ?? (data.createdAt as number),
    };
  }
  return null;
}

export async function updateUserProfile(uid: string, updates: Partial<UserProfile>) {
  const docRef = doc(db, 'users', uid);
  await updateDoc(docRef, updates);
}

export async function deleteAllUserData(uid: string) {
  try {
    const db = getFirestore();
    const collectionsToClean = ['foods', 'foodLogs', 'workoutLogs', 'weightLogs'];
    
    for (const collectionName of collectionsToClean) {
      const q = query(collection(db, collectionName), where('userId', '==', uid));
      const querySnapshot = await getDocs(q);
      const deletePromises = querySnapshot.docs.map(document => 
        deleteDoc(doc(db, collectionName, document.id))
      );
      await Promise.all(deletePromises);
    }
    
    await deleteDoc(doc(db, 'users', uid));
  } catch (error) {
    console.error('Error deleting all user data:', error);
    throw error;
  }
}

// Food Operations
export async function createFood(userId: string, food: Omit<Food, 'id' | 'userId' | 'createdAt'>) {
  const docRef = await addDoc(collection(db, 'foods'), {
    ...food,
    userId,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function getUserFoods(userId: string): Promise<Food[]> {
  const q = query(collection(db, 'foods'), where('userId', '==', userId));
  const querySnapshot = await getDocs(q);
  const foods = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data() as Omit<Food, 'id'>,
    createdAt: (doc.data().createdAt as Timestamp).toMillis(),
  }));
  return foods.sort((a, b) => b.createdAt - a.createdAt);
}

export async function updateFood(id: string, updates: Partial<Food>) {
  const docRef = doc(db, 'foods', id);
  await updateDoc(docRef, updates);
}

export async function deleteFood(id: string) {
  await deleteDoc(doc(db, 'foods', id));
}

export async function createFoodLog(userId: string, foodLog: Omit<FoodLog, 'id' | 'userId' | 'timestamp'>) {
  const docRef = doc(db, 'foodLogs', userId);
  const docSnap = await getDoc(docRef);
  
  const newLog = {
    ...foodLog,
    id: crypto.randomUUID(), // Generate a unique ID for the log entry
    timestamp: Timestamp.now().toMillis(),
  };

  if (docSnap.exists()) {
    // If document exists, append to the logs array
    const existingLogs = docSnap.data().logs || [];
    await updateDoc(docRef, {
      logs: [newLog, ...existingLogs]
    });
  } else {
    // If document doesn't exist, create it with the first log
    await setDoc(docRef, {
      userId,
      logs: [newLog]
    });
  }
  return newLog.id;
}

export async function getDayFoodLogs(userId: string, date: string): Promise<FoodLog[]> {
  // REMOVED orderBy to fix the index crash!
  const q = query(
    collection(db, 'foodLogs'),
    where('userId', '==', userId),
    where('date', '==', date)
  );
  const querySnapshot = await getDocs(q);
  const logs = querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data as Omit<FoodLog, 'id'>,
      timestamp: (data.timestamp as Timestamp).toMillis(),
    };
  });
  
  // Sorting manually in Javascript instead
  return logs.sort((a, b) => b.timestamp - a.timestamp);
}

export async function updateFoodLog(id: string, updates: Partial<FoodLog>) {
  const docRef = doc(db, 'foodLogs', id);
  await updateDoc(docRef, updates);
}

export async function deleteFoodLog(id: string) {
  await deleteDoc(doc(db, 'foodLogs', id));
}

// Workout Log Operations
export async function createWorkoutLog(userId: string, workout: Omit<WorkoutLog, 'id' | 'userId' | 'timestamp'>) {
  const docRef = await addDoc(collection(db, 'workoutLogs'), {
    ...workout,
    userId,
    timestamp: Timestamp.now(),
  });
  return docRef.id;
}

export async function getDayWorkoutLogs(userId: string, date: string): Promise<WorkoutLog[]> {
  // REMOVED orderBy to fix the index crash!
  const q = query(
    collection(db, 'workoutLogs'),
    where('userId', '==', userId),
    where('date', '==', date)
  );
  const querySnapshot = await getDocs(q);
  const logs = querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data as Omit<WorkoutLog, 'id'>,
      timestamp: (data.timestamp as Timestamp).toMillis(),
    };
  });
  
  // Sorting manually in Javascript instead
  return logs.sort((a, b) => b.timestamp - a.timestamp);
}

export async function deleteWorkoutLog(id: string) {
  await deleteDoc(doc(db, 'workoutLogs', id));
}

// Weight Log Operations
export async function createWeightLog(userId: string, weight: Omit<WeightLog, 'id' | 'userId' | 'timestamp'>) {
  const docRef = await addDoc(collection(db, 'weightLogs'), {
    ...weight,
    userId,
    timestamp: Timestamp.now(),
  });
  return docRef.id;
}

export async function getAllWeightLogs(userId: string): Promise<WeightLog[]> {
  try {
    const q = query(
      collection(db, 'weightLogs'),
      where('userId', '==', userId)
    );
    
    const querySnapshot = await getDocs(q);
    
    const logs = querySnapshot.docs.map(doc => {
      const data = doc.data();
      let timeInMillis = Date.now();
      if (data.timestamp) {
        timeInMillis = typeof data.timestamp.toMillis === 'function' 
          ? data.timestamp.toMillis() 
          : data.timestamp; 
      }

      return {
        id: doc.id,
        ...data as Omit<WeightLog, 'id'>,
        timestamp: timeInMillis,
      };
    });
    
    return logs.sort((a, b) => b.timestamp - a.timestamp);
    
  } catch (error) {
    console.error("CRITICAL ERROR fetching weight logs:", error);
    return []; 
  }
}

export async function getLastWeightLogForDate(userId: string, date: string): Promise<WeightLog | null> {
  const q = query(
    collection(db, 'weightLogs'),
    where('userId', '==', userId),
    where('date', '==', date)
  );
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) return null;
  const doc = querySnapshot.docs[0];
  const data = doc.data();
  return {
    id: doc.id,
    ...data as Omit<WeightLog, 'id'>,
    timestamp: (data.timestamp as Timestamp).toMillis(),
  };
}

export async function deleteWeightLog(id: string) {
  try {
    await deleteDoc(doc(db, 'weightLogs', id));
  } catch (error) {
    console.error('Error deleting weight log:', error);
    throw error;
  }
}

// Health Log Operations (Restored the bulletproof version without orderBy)
export async function getHealthLogs(userId: string) {
  const allSyncs: any[] = [];
  const lowerUserId = userId.toLowerCase();

  // 1. Fetch exact match document (Single doc array format)
  try {
    const exactDoc = await getDoc(doc(db, 'healthLogs', userId));
    if (exactDoc.exists() && exactDoc.data().syncs) {
      allSyncs.push(...exactDoc.data().syncs);
    }
  } catch (e) {
    console.warn("Could not fetch exact health doc:", e);
  }

  // 2. Fetch lowercase match document
  if (userId !== lowerUserId) {
    try {
      const lowerDoc = await getDoc(doc(db, 'healthLogs', lowerUserId));
      if (lowerDoc.exists() && lowerDoc.data().syncs) {
        allSyncs.push(...lowerDoc.data().syncs);
      }
    } catch (e) {
      console.warn("Could not fetch lowercase health doc:", e);
    }
  }

  // 3. Fetch exact match queries (Multi-doc format) - No OrderBy!
  try {
    const qExact = query(collection(db, 'healthLogs'), where('userId', '==', userId));
    const snapExact = await getDocs(qExact);
    snapExact.docs.forEach(d => {
      if (d.id !== userId && d.id !== lowerUserId) allSyncs.push({ ...d.data(), id: d.id });
    });
  } catch (e) {
    console.warn("Could not fetch exact health queries:", e);
  }

  // 4. Fetch lowercase match queries - No OrderBy!
  if (userId !== lowerUserId) {
    try {
      const qLower = query(collection(db, 'healthLogs'), where('userId', '==', lowerUserId));
      const snapLower = await getDocs(qLower);
      snapLower.docs.forEach(d => {
        if (d.id !== userId && d.id !== lowerUserId) allSyncs.push({ ...d.data(), id: d.id });
      });
    } catch (e) {
      console.warn("Could not fetch lowercase health queries:", e);
    }
  }

  return allSyncs;
}