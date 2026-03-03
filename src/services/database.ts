// src/services/database.ts
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
  arrayUnion,
  arrayRemove
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
  const foods = querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data as Omit<Food, 'id'>,
      // Safely parse createdAt to prevent crashes on older foods
      createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : (data.createdAt || 0),
    };
  });
  return foods.sort((a, b) => b.createdAt - a.createdAt);
}

export async function updateFood(id: string, updates: Partial<Food>) {
  const docRef = doc(db, 'foods', id);
  await updateDoc(docRef, updates);
}

export async function deleteFood(id: string) {
  await deleteDoc(doc(db, 'foods', id));
}

// --- Food Log Operations ---
export async function createFoodLog(userId: string, foodLog: Omit<FoodLog, 'id' | 'userId' | 'timestamp'>) {
  const docRef = doc(db, 'foodLogs', userId);
  const docSnap = await getDoc(docRef);
  
  const newLog = {
    ...foodLog,
    id: crypto.randomUUID(), 
    timestamp: Timestamp.now().toMillis(),
  };

  if (docSnap.exists()) {
    const data = docSnap.data();
    const existingData = data.foodData || data.logs || [];
    await updateDoc(docRef, {
      foodData: [newLog, ...existingData]
    });
  } else {
    await setDoc(docRef, {
      userId,
      foodData: [newLog]
    });
  }
  return newLog.id;
}

export async function getAllFoodLogs(userId: string): Promise<FoodLog[]> {
  const allLogs: any[] = [];
  
  try {
    const exactDoc = await getDoc(doc(db, 'foodLogs', userId));
    if (exactDoc.exists()) {
      const data = exactDoc.data();
      if (data.foodData) allLogs.push(...data.foodData);
      else if (data.logs) allLogs.push(...data.logs);
    }
  } catch (e) {
    console.warn("Could not fetch all foodLogs array:", e);
  }

  // Backup fetch for old legacy multi-doc logs
  try {
    const qExact = query(collection(db, 'foodLogs'), where('userId', '==', userId));
    const snapExact = await getDocs(qExact);
    snapExact.docs.forEach(d => {
      if (d.id !== userId) {
        allLogs.push({
          id: d.id,
          ...d.data(),
          timestamp: d.data().timestamp?.toMillis ? d.data().timestamp.toMillis() : d.data().timestamp,
        });
      }
    });
  } catch (e) {
    console.warn("Could not fetch multi-doc format logs:", e);
  }

  return allLogs.sort((a: any, b: any) => b.timestamp - a.timestamp);
}

export async function getDayFoodLogs(userId: string, date: string): Promise<FoodLog[]> {
  const allLogs: any[] = [];
  
  try {
    const exactDoc = await getDoc(doc(db, 'foodLogs', userId));
    if (exactDoc.exists()) {
      const data = exactDoc.data();
      if (data.foodData) allLogs.push(...data.foodData);
      else if (data.logs) allLogs.push(...data.logs);
    }
  } catch (e) {
    console.warn("Could not fetch exact foodLogs doc:", e);
  }

  try {
    const qExact = query(
      collection(db, 'foodLogs'),
      where('userId', '==', userId),
      where('date', '==', date)
    );
    const snapExact = await getDocs(qExact);
    snapExact.docs.forEach(d => {
      if (d.id !== userId) {
        allLogs.push({
          id: d.id,
          ...d.data(),
          timestamp: d.data().timestamp?.toMillis ? d.data().timestamp.toMillis() : d.data().timestamp,
        });
      }
    });
  } catch (e) {
    console.warn("Could not fetch multi-doc format logs:", e);
  }

  const dailyLogs = allLogs.filter((log: any) => log.date === date);
  return dailyLogs.sort((a: any, b: any) => b.timestamp - a.timestamp);
}

export async function updateFoodLog(userId: string, id: string, updates: Partial<FoodLog>) {
  const docRef = doc(db, 'foodLogs', userId);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const data = docSnap.data();
    let updated = false;
    
    if (data.foodData) {
      const newFoodData = data.foodData.map((log: any) => {
        if (log.id === id) {
          updated = true;
          return { ...log, ...updates };
        }
        return log;
      });
      if (updated) {
        await updateDoc(docRef, { foodData: newFoodData });
        return;
      }
    }
    
    if (data.logs && !updated) {
      const newLogs = data.logs.map((log: any) => {
        if (log.id === id) {
          updated = true;
          return { ...log, ...updates };
        }
        return log;
      });
      if (updated) {
        await updateDoc(docRef, { logs: newLogs });
        return;
      }
    }
  }

  try {
    const fallbackRef = doc(db, 'foodLogs', id);
    await updateDoc(fallbackRef, updates);
  } catch (e) {
    console.warn("Could not update multi-doc format fallback:", e);
  }
}

export async function deleteFoodLog(userId: string, id: string) {
  const docRef = doc(db, 'foodLogs', userId);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const data = docSnap.data();
    let updated = false;

    if (data.foodData) {
      const initialLength = data.foodData.length;
      const newFoodData = data.foodData.filter((log: any) => log.id !== id);
      if (newFoodData.length !== initialLength) {
        await updateDoc(docRef, { foodData: newFoodData });
        updated = true;
      }
    }

    if (data.logs && !updated) {
      const initialLength = data.logs.length;
      const newLogs = data.logs.filter((log: any) => log.id !== id);
      if (newLogs.length !== initialLength) {
        await updateDoc(docRef, { logs: newLogs });
        updated = true;
      }
    }
    
    if (updated) return;
  }

  try {
    const fallbackRef = doc(db, 'foodLogs', id);
    await deleteDoc(fallbackRef);
  } catch (e) {
    console.warn("Could not delete multi-doc format fallback:", e);
  }
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

// Health Log Operations
export async function getHealthLogs(userId: string) {
  const allSyncs: any[] = [];
  const lowerUserId = userId.toLowerCase();

  try {
    const exactDoc = await getDoc(doc(db, 'healthLogs', userId));
    if (exactDoc.exists() && exactDoc.data().syncs) {
      allSyncs.push(...exactDoc.data().syncs);
    }
  } catch (e) {
    console.warn("Could not fetch exact health doc:", e);
  }

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

  try {
    const qExact = query(collection(db, 'healthLogs'), where('userId', '==', userId));
    const snapExact = await getDocs(qExact);
    snapExact.docs.forEach(d => {
      if (d.id !== userId && d.id !== lowerUserId) allSyncs.push({ ...d.data(), id: d.id });
    });
  } catch (e) {
    console.warn("Could not fetch exact health queries:", e);
  }

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

export const getSyncedHealthWorkouts = async (userId: string) => {
  let allWorkouts: any[] = [];
  
  // Helper function to force Firebase Object Maps back into usable Arrays
  const extractData = (dataPart: any) => {
    if (!dataPart) return [];
    if (Array.isArray(dataPart)) return dataPart;
    if (typeof dataPart === 'object') return Object.values(dataPart);
    return [];
  };

  try {
    const userDocRef = doc(db, 'healthLogs', userId);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      const payload = userDocSnap.data();

      // THE FIX: Loop through the 'syncs' array to find the hidden workouts!
      if (payload.syncs && Array.isArray(payload.syncs)) {
        payload.syncs.forEach((syncBatch: any) => {
          if (syncBatch.data && syncBatch.data.workouts) {
            allWorkouts.push(...extractData(syncBatch.data.workouts));
          } else if (syncBatch.workouts) {
            allWorkouts.push(...extractData(syncBatch.workouts));
          }
        });
      } 
      // Fallback 1: Just in case it's saved directly to data
      else if (payload.data && payload.data.workouts) {
        allWorkouts.push(...extractData(payload.data.workouts));
      } 
      // Fallback 2: Just in case it's sitting at the root level
      else if (payload.workouts) {
        allWorkouts.push(...extractData(payload.workouts));
      }
    }
  } catch (err: any) {
    console.warn(`❌ Error reading root doc:`, err.message);
  }

  // Fallback 3: Double-check the sub-collection just in case
  try {
    const workoutsRef = collection(db, `healthLogs/${userId}/workouts`);
    const snapshot = await getDocs(workoutsRef);
    
    if (snapshot.docs.length > 0) {
        snapshot.docs.forEach(docSnap => {
          const payload = docSnap.data();
          if (payload.data && payload.data.workouts) {
            allWorkouts.push(...extractData(payload.data.workouts));
          } else if (payload.workouts) {
            allWorkouts.push(...extractData(payload.workouts));
          } else if (payload.name && payload.duration) {
            allWorkouts.push({ dbId: docSnap.id, ...payload });
          }
        });
    }
  } catch (err: any) {
    // Silently ignore missing sub-collections
  }

  // Remove any duplicates (Using Apple Health's unique ID so workouts don't double up)
  const uniqueWorkouts = Array.from(
    new Map(allWorkouts.filter(w => w != null).map(w => [w.id || w.dbId || Math.random(), w])).values()
  );

  // Sort newest on top
  uniqueWorkouts.sort((a: any, b: any) => {
    const dateA = new Date(a.start || a.date || a.timestamp || 0).getTime();
    const dateB = new Date(b.start || b.date || b.timestamp || 0).getTime();
    return dateB - dateA; // Descending order
  });

  return uniqueWorkouts;
};

export const getIgnoredWorkouts = async (userId: string): Promise<string[]> => {
  try {
    // FIX: Read directly from the main user profile document
    const docRef = doc(db, 'users', userId);
    const snap = await getDoc(docRef);
    if (snap.exists() && snap.data().ignoredWorkouts) {
      return snap.data().ignoredWorkouts;
    }
    return [];
  } catch (e) {
    console.error("Error fetching ignored workouts:", e);
    return [];
  }
};

export const toggleIgnoredWorkout = async (userId: string, workoutId: string, ignore: boolean) => {
  try {
    // FIX: Save directly to the main user profile document
    const docRef = doc(db, 'users', userId);
    await setDoc(docRef, {
      ignoredWorkouts: ignore ? arrayUnion(workoutId) : arrayRemove(workoutId)
    }, { merge: true });
  } catch (error) {
    console.error("Error toggling workout:", error);
    throw error;
  }
};