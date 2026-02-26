import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
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
    
    // List of collections where user data is stored
    const collectionsToClean = ['foods', 'foodLogs', 'workoutLogs', 'weightLogs'];
    
    // Delete all documents in related collections where userId matches
    for (const collectionName of collectionsToClean) {
      const q = query(collection(db, collectionName), where('userId', '==', uid));
      const querySnapshot = await getDocs(q);
      const deletePromises = querySnapshot.docs.map(document => 
        deleteDoc(doc(db, collectionName, document.id))
      );
      await Promise.all(deletePromises);
    }
    
    // Finally, delete the user profile document
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
  const q = query(collection(db, 'foods'), where('userId', '==', userId), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data() as Omit<Food, 'id'>,
    createdAt: (doc.data().createdAt as Timestamp).toMillis(),
  }));
}

export async function updateFood(id: string, updates: Partial<Food>) {
  const docRef = doc(db, 'foods', id);
  await updateDoc(docRef, updates);
}

export async function deleteFood(id: string) {
  await deleteDoc(doc(db, 'foods', id));
}

// Food Log Operations
export async function createFoodLog(userId: string, foodLog: Omit<FoodLog, 'id' | 'userId' | 'timestamp'>) {
  const docRef = await addDoc(collection(db, 'foodLogs'), {
    ...foodLog,
    userId,
    timestamp: Timestamp.now(),
  });
  return docRef.id;
}

export async function getDayFoodLogs(userId: string, date: string): Promise<FoodLog[]> {
  const q = query(
    collection(db, 'foodLogs'),
    where('userId', '==', userId),
    where('date', '==', date),
    orderBy('timestamp', 'desc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data as Omit<FoodLog, 'id'>,
      timestamp: (data.timestamp as Timestamp).toMillis(),
    };
  });
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
  const q = query(
    collection(db, 'workoutLogs'),
    where('userId', '==', userId),
    where('date', '==', date),
    orderBy('timestamp', 'desc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data as Omit<WorkoutLog, 'id'>,
      timestamp: (data.timestamp as Timestamp).toMillis(),
    };
  });
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
    // 1. We ONLY filter by userId. We removed the Firebase "orderBy" to prevent index errors.
    const q = query(
      collection(db, 'weightLogs'),
      where('userId', '==', userId)
    );
    
    const querySnapshot = await getDocs(q);
    
    const logs = querySnapshot.docs.map(doc => {
      const data = doc.data();
      
      // 2. Crash-proof timestamp reading! If a log is somehow missing a timestamp, 
      // we gracefully fall back to the current time instead of crashing the whole screen.
      let timeInMillis = Date.now();
      if (data.timestamp) {
        timeInMillis = typeof data.timestamp.toMillis === 'function' 
          ? data.timestamp.toMillis() 
          : data.timestamp; // Just in case it's already a number
      }

      return {
        id: doc.id,
        ...data as Omit<WeightLog, 'id'>,
        timestamp: timeInMillis,
      };
    });
    
    // 3. Sort the logs from newest to oldest using Javascript
    return logs.sort((a, b) => b.timestamp - a.timestamp);
    
  } catch (error) {
    console.error("CRITICAL ERROR fetching weight logs:", error);
    return []; // Return an empty array so the screen doesn't break
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

export async function getHealthLogs(userId: string) {
  try {
    // Reference the single document named after the user's ID
    const docRef = doc(db, 'healthLogs', userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      // Extract the 'syncs' array, defaulting to an empty array if it doesn't exist
      const syncs = data.syncs || [];
      
      // Sort the array so the newest syncs appear first
      return syncs.sort((a: any, b: any) => {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });
    }
    
    return []; // Return empty if the document doesn't exist yet
  } catch (error) {
    console.error("Error fetching health logs:", error);
    return [];
  }
}
