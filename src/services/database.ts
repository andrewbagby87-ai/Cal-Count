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
  arrayRemove,
  runTransaction, 
  deleteField // <--- NEW: Added deleteField here
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
      createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : (data.createdAt || 0),
    };
  });
  return foods.sort((a, b) => b.createdAt - a.createdAt);
}

export async function updateFood(id: string, updates: Partial<Food>) {
  const docRef = doc(db, 'foods', id);
  
  // Convert explicit nulls to deleteField() so Firebase actually deletes the field instead of ignoring it
  const processedUpdates: any = { ...updates };
  Object.keys(processedUpdates).forEach(key => {
    if (processedUpdates[key] === null) {
      processedUpdates[key] = deleteField();
    }
  });

  await updateDoc(docRef, processedUpdates);
}

export async function deleteFood(id: string) {
  await deleteDoc(doc(db, 'foods', id));
}

// --- Food Log Operations ---
export async function createFoodLog(userId: string, foodLog: any) {
  const cleanFoodLog = JSON.parse(JSON.stringify(foodLog));

  const newLog = {
    ...cleanFoodLog,
    id: cleanFoodLog.id || crypto.randomUUID(),
    timestamp: cleanFoodLog.timestamp || Date.now(),
  };

  // NEW: Save to the infinite subcollection instead of the 1MB limited array
  const logRef = doc(db, `foodLogs/${userId}/logs`, newLog.id);
  await setDoc(logRef, newLog);

  return newLog.id;
}

export async function getAllFoodLogs(userId: string): Promise<FoodLog[]> {
  const allLogs: any[] = [];
  
  try {
    const subColRef = collection(db, `foodLogs/${userId}/logs`);
    const subSnap = await getDocs(subColRef);
    subSnap.docs.forEach(d => {
      allLogs.push({
          ...d.data(),
          timestamp: d.data().timestamp?.toMillis ? d.data().timestamp.toMillis() : d.data().timestamp,
      });
    });
  } catch (e) {
    console.warn("Could not fetch subcollection food logs:", e);
  }

  return allLogs.sort((a: any, b: any) => b.timestamp - a.timestamp);
}

export async function getDayFoodLogs(userId: string, date: string): Promise<FoodLog[]> {
  const allLogs: any[] = [];

  try {
    const subQ = query(collection(db, `foodLogs/${userId}/logs`), where('date', '==', date));
    const subSnap = await getDocs(subQ);
    subSnap.docs.forEach(d => {
      allLogs.push({
          ...d.data(),
          timestamp: d.data().timestamp?.toMillis ? d.data().timestamp.toMillis() : d.data().timestamp,
      });
    });
  } catch (e) {
    console.warn("Could not fetch subcollection food logs:", e);
  }

  return allLogs.sort((a: any, b: any) => b.timestamp - a.timestamp);
}

export async function getWeeklyFoodLogs(userId: string, startDate: string, endDate: string): Promise<FoodLog[]> {
  const allLogs = await getAllFoodLogs(userId);
  return allLogs.filter((log: any) => log.date >= startDate && log.date <= endDate);
}

export async function updateFoodLog(userId: string, id: string, updates: Partial<FoodLog>) {
  const cleanUpdates = JSON.parse(JSON.stringify(updates));
  const newLogRef = doc(db, `foodLogs/${userId}/logs`, id);
  await updateDoc(newLogRef, cleanUpdates);
}

export async function deleteFoodLog(userId: string, id: string) {
  const newLogRef = doc(db, `foodLogs/${userId}/logs`, id);
  await deleteDoc(newLogRef);
}

export const updateAllPastLogsForFood = async (userId: string, foodId: string, updatedFood: any, fallbackName?: string) => {
  const docRef = doc(db, 'foodLogs', userId);

  const cleanUpdatedFood = Object.fromEntries(
    Object.entries(updatedFood).filter(([_, v]) => v !== undefined)
  ) as unknown as Food;

  const recalculateRecipeNutrition = (recipe: any) => {
    let updatedIngredients = recipe.recipeIngredients.map((ing: any) => {
      if (ing.food.id === foodId || ing.food?.id === foodId || (fallbackName && ing.food?.name === fallbackName)) {
        let multiplier = 1;
        if (ing.unit === 'serving') {
          multiplier = ing.amount / (cleanUpdatedFood.servingSize || 1);
        } else {
          const vol = cleanUpdatedFood.volumes?.find((v: any) => v.unit === ing.unit);
          multiplier = (vol && vol.amount) ? ing.amount / vol.amount : 0;
        }
        
        const calc = (val: number | undefined) => val ? Number((val * multiplier).toFixed(2)) : 0;
        
        return {
          ...ing,
          food: cleanUpdatedFood,
          macros: {
            calories: calc(cleanUpdatedFood.calories), protein: calc(cleanUpdatedFood.protein),
            carbs: calc(cleanUpdatedFood.carbs), fat: calc(cleanUpdatedFood.fat),
            saturatedFat: calc(cleanUpdatedFood.saturatedFat), transFat: calc((cleanUpdatedFood as any).transFat),
            cholesterol: calc((cleanUpdatedFood as any).cholesterol), sodium: calc((cleanUpdatedFood as any).sodium),
            fiber: calc(cleanUpdatedFood.fiber), sugar: calc(cleanUpdatedFood.sugar),
          }
        };
      }
      return ing;
    });

    const totalMacros = updatedIngredients.reduce((acc: any, curr: any) => {
      acc.calories += curr.macros.calories || 0; acc.protein += curr.macros.protein || 0;
      acc.carbs += curr.macros.carbs || 0; acc.fat += curr.macros.fat || 0;
      acc.saturatedFat += curr.macros.saturatedFat || 0; acc.transFat += curr.macros.transFat || 0;
      acc.cholesterol += curr.macros.cholesterol || 0; acc.sodium += curr.macros.sodium || 0;
      acc.fiber += curr.macros.fiber || 0; acc.sugar += curr.macros.sugar || 0;
      return acc;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0, saturatedFat: 0, transFat: 0, cholesterol: 0, sodium: 0, fiber: 0, sugar: 0 });

    const servings = recipe.recipeServings || 1;
    return {
      ...recipe, recipeIngredients: updatedIngredients,
      calories: Number((totalMacros.calories / servings).toFixed(2)), protein: Number((totalMacros.protein / servings).toFixed(2)),
      carbs: Number((totalMacros.carbs / servings).toFixed(2)), fat: Number((totalMacros.fat / servings).toFixed(2)),
      saturatedFat: Number((totalMacros.saturatedFat / servings).toFixed(2)), transFat: Number((totalMacros.transFat / servings).toFixed(2)),
      cholesterol: Number((totalMacros.cholesterol / servings).toFixed(2)), sodium: Number((totalMacros.sodium / servings).toFixed(2)),
      fiber: Number((totalMacros.fiber / servings).toFixed(2)), sugar: Number((totalMacros.sugar / servings).toFixed(2)),
    };
  };

  try {
    const foodsQuery = query(collection(db, 'foods'), where('userId', '==', userId));
    const foodsSnap = await getDocs(foodsQuery);
    const recipeUpdatePromises: Promise<void>[] = [];

    foodsSnap.docs.forEach(docSnap => {
      const foodData = docSnap.data();
      if (foodData.isRecipe && foodData.recipeIngredients) {
        const hasIngredient = foodData.recipeIngredients.some((ing: any) => ing.food.id === foodId || ing.food?.id === foodId || (fallbackName && ing.food?.name === fallbackName));
        if (hasIngredient) {
          const updatedRecipe = recalculateRecipeNutrition(foodData);
          recipeUpdatePromises.push(updateDoc(doc(db, 'foods', docSnap.id), updatedRecipe));
        }
      }
    });

    await Promise.all(recipeUpdatePromises);
  } catch (e) {
    console.error("Failed to cascade updates to master recipes:", e);
  }

  const recalculateLog = (log: any) => {
    if (log.foodId === foodId || log.food?.id === foodId || (fallbackName && log.food?.name === fallbackName)) {
      let multiplier = 1;
      if (log.unit === 'serving') {
        multiplier = log.amount / (cleanUpdatedFood.servingSize || 1);
      } else {
        const vol = cleanUpdatedFood.volumes?.find(v => v.unit === log.unit);
        if (vol && vol.amount) {
          multiplier = log.amount / vol.amount;
        } else {
          multiplier = 0;
        }
      }

      const calcConsumed = (val: number | undefined) => {
        if (val === undefined || isNaN(val)) return undefined;
        return Number((val * multiplier).toFixed(2));
      };

      const consumedNutrition = {
        calories: calcConsumed(cleanUpdatedFood.calories) || 0, fat: calcConsumed(cleanUpdatedFood.fat),
        saturatedFat: calcConsumed(cleanUpdatedFood.saturatedFat), transFat: calcConsumed((cleanUpdatedFood as any).transFat),
        cholesterol: calcConsumed((cleanUpdatedFood as any).cholesterol), sodium: calcConsumed((cleanUpdatedFood as any).sodium),
        carbs: calcConsumed(cleanUpdatedFood.carbs), fiber: calcConsumed(cleanUpdatedFood.fiber),
        sugar: calcConsumed(cleanUpdatedFood.sugar), protein: calcConsumed(cleanUpdatedFood.protein),
      };

      const cleanConsumedNutrition = Object.fromEntries(Object.entries(consumedNutrition).filter(([_, v]) => v !== undefined)) as any;
      return { ...log, foodId: foodId, food: cleanUpdatedFood, ...cleanConsumedNutrition };
    }

    if (log.food?.isRecipe && log.food?.recipeIngredients) {
      const hasIngredient = log.food.recipeIngredients.some((ing: any) => ing.food.id === foodId || ing.food?.id === foodId || (fallbackName && ing.food?.name === fallbackName));
      if (hasIngredient) {
        const updatedRecipe = recalculateRecipeNutrition(log.food);
        const multiplier = log.amount; 
        const calcConsumed = (val: number | undefined) => {
          if (val === undefined || isNaN(val)) return undefined;
          return Number((val * multiplier).toFixed(2));
        };

        const consumedNutrition = {
          calories: calcConsumed(updatedRecipe.calories) || 0, fat: calcConsumed(updatedRecipe.fat),
          saturatedFat: calcConsumed(updatedRecipe.saturatedFat), transFat: calcConsumed(updatedRecipe.transFat),
          cholesterol: calcConsumed(updatedRecipe.cholesterol), sodium: calcConsumed(updatedRecipe.sodium),
          carbs: calcConsumed(updatedRecipe.carbs), fiber: calcConsumed(updatedRecipe.fiber),
          sugar: calcConsumed(updatedRecipe.sugar), protein: calcConsumed(updatedRecipe.protein),
        };

        const cleanConsumedNutrition = Object.fromEntries(Object.entries(consumedNutrition).filter(([_, v]) => v !== undefined)) as any;
        return { ...log, food: updatedRecipe, ...cleanConsumedNutrition };
      }
    }
    return log;
  };

  // 1. Update Old Array Structure
  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      let updatedArray = false;

      if (data.foodData) {
        const newFoodData = data.foodData.map((log: any) => {
          const updatedLog = recalculateLog(log);
          if (updatedLog !== log) updatedArray = true;
          return updatedLog;
        });
        if (updatedArray) await updateDoc(docRef, { foodData: newFoodData });
      } 
      
      if (data.logs) {
        updatedArray = false;
        const newLogs = data.logs.map((log: any) => {
          const updatedLog = recalculateLog(log);
          if (updatedLog !== log) updatedArray = true;
          return updatedLog;
        });
        if (updatedArray) await updateDoc(docRef, { logs: newLogs });
      }
    }
  } catch (e) {
    console.warn("Error updating old array logs:", e);
  }

  // 2. NEW: Update Infinite Subcollection
  try {
    const subColRef = collection(db, `foodLogs/${userId}/logs`);
    const subSnap = await getDocs(subColRef);
    const subUpdatePromises: Promise<void>[] = [];

    subSnap.docs.forEach(docSnapshot => {
      const log = docSnapshot.data();
      const updatedLog = recalculateLog(log);
      if (updatedLog !== log) {
        subUpdatePromises.push(updateDoc(docSnapshot.ref, updatedLog));
      }
    });
    await Promise.all(subUpdatePromises);
  } catch (e) {
    console.error("Failed to update subcollection logs:", e);
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

export async function getWeeklyWorkoutLogs(userId: string, startDate: string, endDate: string): Promise<WorkoutLog[]> {
  const q = query(
    collection(db, 'workoutLogs'),
    where('userId', '==', userId),
    where('date', '>=', startDate),
    where('date', '<=', endDate)
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

export async function getWeightLogsForDate(userId: string, date: string): Promise<WeightLog[]> {
  try {
    const q = query(
      collection(db, 'weightLogs'),
      where('userId', '==', userId),
      where('date', '==', date)
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
    console.error("CRITICAL ERROR fetching weight logs for date:", error);
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
    if (exactDoc.exists() && exactDoc.data().syncs) allSyncs.push(...exactDoc.data().syncs);
  } catch (e) { console.warn(e); }

  try {
    const qExact = query(collection(db, 'healthLogs'), where('userId', '==', userId));
    const snapExact = await getDocs(qExact);
    snapExact.docs.forEach(d => {
      if (d.id !== userId && d.id !== lowerUserId) allSyncs.push({ ...(d.data() as any), id: d.id });
    });
  } catch (e) { console.warn(e); }

  try {
    const syncsSubRef = collection(db, `healthLogs/${userId}/syncs`);
    const subSnap = await getDocs(syncsSubRef);
    subSnap.docs.forEach(d => allSyncs.push({ ...(d.data() as any), id: d.id }));
  } catch (e) { console.warn(e); }

  return allSyncs;
}

export const getSyncedHealthWorkouts = async (userId: string) => {
  let allWorkouts: any[] = [];
  
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
      if (payload.syncs && Array.isArray(payload.syncs)) {
        payload.syncs.forEach((s: any) => {
          if (s.data?.workouts) allWorkouts.push(...extractData(s.data.workouts));
          else if (s.workouts) allWorkouts.push(...extractData(s.workouts));
        });
      }
    }
  } catch (err) { console.warn(err); }

  try {
    const workoutsRef = collection(db, `healthLogs/${userId}/workouts`);
    const snapshot = await getDocs(workoutsRef);
    snapshot.docs.forEach(docSnap => {
      const payload = docSnap.data() as any;
      if (payload.data?.workouts) allWorkouts.push(...extractData(payload.data.workouts));
      else if (payload.workouts) allWorkouts.push(...extractData(payload.workouts));
      else if (payload.name && payload.duration) allWorkouts.push({ dbId: docSnap.id, ...payload });
    });
  } catch (err) {}

  try {
    const syncsSubRef = collection(db, `healthLogs/${userId}/syncs`);
    const subSnap = await getDocs(syncsSubRef);
    subSnap.docs.forEach(docSnap => {
      const payload = docSnap.data() as any;
      if (payload.data?.workouts) allWorkouts.push(...extractData(payload.data.workouts));
      else if (payload.workouts) allWorkouts.push(...extractData(payload.workouts));
    });
  } catch (err) {}

  const uniqueWorkouts = Array.from(new Map(allWorkouts.filter(w => w != null).map(w => [w.id || w.dbId || Math.random(), w])).values());
  return uniqueWorkouts;
};

export const getIgnoredWorkouts = async (userId: string): Promise<string[]> => {
  try {
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
    const docRef = doc(db, 'users', userId);
    await setDoc(docRef, {
      ignoredWorkouts: ignore ? arrayUnion(workoutId) : arrayRemove(workoutId)
    }, { merge: true });
  } catch (error) {
    console.error("Error toggling workout:", error);
    throw error;
  }
};

// --- Done Logging & Streak Operations ---
export async function getDoneLoggingDates(userId: string): Promise<Record<string, any>> {
  try {
    const docRef = doc(db, 'users', userId);
    const snap = await getDoc(docRef);
    if (snap.exists() && snap.data().doneLoggingDates) {
      return snap.data().doneLoggingDates;
    }
    return {};
  } catch (e) {
    console.error("Error fetching done logging dates:", e);
    return {};
  }
}

export async function toggleDoneLoggingDate(
  userId: string, 
  dateStr: string, 
  payload: boolean | { isDone: boolean, totalCalories: number, budget: number }
) {
  try {
    const docRef = doc(db, 'users', userId);
    
    // Using dot notation to target the specific date key inside the map
    await updateDoc(docRef, {
      [`doneLoggingDates.${dateStr}`]: payload
    });
  } catch (error) {
    console.error("Error toggling done logging date:", error);
    throw error;
  }
}

// Add these with your other export functions in database.ts
export const getWeightLogsSince = async (userId: string, cutoffMs: number): Promise<any[]> => {
  const logsRef = collection(db, 'weightLogs');
  const q = query(
    logsRef,
    where('userId', '==', userId),
    where('timestamp', '>=', cutoffMs)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getHealthLogsSince = async (userId: string, cutoffMs: number): Promise<any[]> => {
  const logsRef = collection(db, 'healthLogs');
  const q = query(
    logsRef,
    where('userId', '==', userId),
    where('timestamp', '>=', cutoffMs)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export async function migrateLegacyDoneDates(userId: string, userProfile: any) {
  try {
    const docRef = doc(db, 'users', userId);
    const snap = await getDoc(docRef);
    
    if (!snap.exists() || !snap.data().doneLoggingDates) {
      console.log("No done dates found to migrate.");
      return;
    }

    const dates = snap.data().doneLoggingDates;
    const updates: Record<string, any> = {};
    let needsUpdate = false;

    // Loop through every saved date in the user's profile
    for (const [dateStr, value] of Object.entries(dates)) {
      // If the value is exactly true, it's the old format that needs updating
      if (value === true) { 
        console.log(`Migrating data for ${dateStr}...`);
        
        // Fetch the historical data for this specific day
        const [foods, workouts, healthLogs, ignoredWorkouts] = await Promise.all([
           getDayFoodLogs(userId, dateStr),
           getDayWorkoutLogs(userId, dateStr),
           getSyncedHealthWorkouts(userId),
           getIgnoredWorkouts(userId)
        ]);

        // Calculate total calories consumed
        const consumed = foods.reduce((sum: number, log: any) => sum + (log.editedNutrition?.calories ?? log.calories ?? 0), 0);
        
        // Calculate total calories burned
        const todaysSynced = healthLogs.filter((w: any) => {
          // Re-use your existing date parsing logic
          const d = new Date(w.start || w.date || w.timestamp);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          const isToday = `${y}-${m}-${day}` === dateStr;
          return isToday && !ignoredWorkouts.includes(String(w.id || w.dbId));
        });
        
        let burned = todaysSynced.reduce((sum, w) => (w.activeEnergyBurned?.units === 'kcal' ? sum + Math.round(w.activeEnergyBurned.qty) : sum), 0);
        burned += workouts.reduce((sum: number, w: any) => sum + (w.caloriesBurned || 0), 0);

        // Get the historical budget using your Time Machine function
        let historicalProfile = userProfile;
        if (userProfile.goalHistory && userProfile.goalHistory.length > 0) {
           for (const entry of userProfile.goalHistory) {
             if (entry.date <= dateStr) historicalProfile = { ...userProfile, ...entry };
             else break;
           }
        }
        const budget = (historicalProfile?.caloriesBudget || 0) + burned;

        // Queue the Firebase update using dot notation to update just the nested key
        updates[`doneLoggingDates.${dateStr}`] = {
          isDone: true,
          totalCalories: consumed,
          budget: budget
        };
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      await updateDoc(docRef, updates);
      console.log("Migration successfully completed!");
    } else {
      console.log("All dates are already using the new summary format.");
    }
  } catch (error) {
    console.error("Migration failed:", error);
  }
}

export async function migrateLegacyFoodLogs(userId: string | undefined) {
  if (!userId) {
    console.error("Missing User ID for migration.");
    return;
  }

  console.log("Starting legacy food log migration...");
  const logsToMigrate = new Map();

  try {
    // 1. Fetch old array-based logs
    const exactDoc = await getDoc(doc(db, 'foodLogs', userId));
    if (exactDoc.exists()) {
      const data = exactDoc.data();
      if (data.foodData) data.foodData.forEach((log: any) => logsToMigrate.set(log.id, log));
      if (data.logs) data.logs.forEach((log: any) => logsToMigrate.set(log.id, log));
    }

    // 2. Fetch old multi-doc format logs
    const qExact = query(collection(db, 'foodLogs'), where('userId', '==', userId));
    const snapExact = await getDocs(qExact);
    snapExact.docs.forEach(d => {
      if (d.id !== userId) {
        logsToMigrate.set(d.id, { id: d.id, ...d.data() });
      }
    });

    if (logsToMigrate.size === 0) {
      console.log("No legacy logs found! Everything is already in the new format.");
      return;
    }

    console.log(`Found ${logsToMigrate.size} legacy logs to move. Copying to subcollection...`);

    // 3. Copy them to the new subcollection
    const migrationPromises = [];
    for (const [id, log] of logsToMigrate.entries()) {
      const newLogRef = doc(db, `foodLogs/${userId}/logs`, id);
      migrationPromises.push(setDoc(newLogRef, log));
    }

    // Wait for all saves to finish
    await Promise.all(migrationPromises);
    
    console.log(`Migration Complete! Successfully copied ${logsToMigrate.size} logs to the new subcollection.`);
    console.log("You can now safely remove the legacy fallback queries from your code.");

  } catch (error) {
    console.error("Error migrating food logs:", error);
  }
}