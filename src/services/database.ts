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
export async function createFoodLog(userId: string, foodLog: any) {
  const docRef = doc(db, 'foodLogs', userId);
  
  // 1. Deep clean undefined values
  const cleanFoodLog = JSON.parse(JSON.stringify(foodLog));

  const newLog = {
    ...cleanFoodLog,
    id: cleanFoodLog.id || crypto.randomUUID(),
    timestamp: cleanFoodLog.timestamp || Date.now(),
  };

  // 2. ATOMIC SAVE: Use arrayUnion to append directly on the server.
  // This completely eliminates race conditions when batch-adding items.
  await setDoc(docRef, {
    userId,
    foodData: arrayUnion(newLog)
  }, { merge: true });

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

// 🚀 OPTIMIZATION: Fetches a date range of foods in 1 single read
export async function getWeeklyFoodLogs(userId: string, startDate: string, endDate: string): Promise<FoodLog[]> {
  const allLogs = await getAllFoodLogs(userId);
  return allLogs.filter((log: any) => log.date >= startDate && log.date <= endDate);
}

export async function updateFoodLog(userId: string, id: string, updates: Partial<FoodLog>) {
  const docRef = doc(db, 'foodLogs', userId);
  const docSnap = await getDoc(docRef);

  // Strip any undefined values to prevent Firebase from silently crashing
  const cleanUpdates = JSON.parse(JSON.stringify(updates));

  if (docSnap.exists()) {
    const data = docSnap.data();
    let updated = false;
    
    if (data.foodData) {
      const newFoodData = data.foodData.map((log: any) => {
        if (log.id === id) {
          updated = true;
          return { ...log, ...cleanUpdates };
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
          return { ...log, ...cleanUpdates };
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
    await updateDoc(fallbackRef, cleanUpdates);
  } catch (e) {
    console.warn("Could not update multi-doc format fallback:", e);
  }
}

export async function deleteFoodLog(userId: string, id: string) {
  const docRef = doc(db, 'foodLogs', userId);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const data = docSnap.data();

    // 1. ATOMIC DELETE: Find the exact object and tell the server to remove it
    if (data.foodData) {
      const exactLog = data.foodData.find((log: any) => log.id === id);
      if (exactLog) {
        await updateDoc(docRef, { foodData: arrayRemove(exactLog) });
        return;
      }
    }

    if (data.logs) {
      const exactLog = data.logs.find((log: any) => log.id === id);
      if (exactLog) {
        await updateDoc(docRef, { logs: arrayRemove(exactLog) });
        return;
      }
    }
  }

  // Fallback for older data structures
  try {
    const fallbackRef = doc(db, 'foodLogs', id);
    await deleteDoc(fallbackRef);
  } catch (e) {
    console.warn("Could not delete multi-doc format fallback:", e);
  }
}

// BATCH UPDATE: Cascades food label edits to past logs and recipes
export async function updateAllPastLogsForFood(userId: string, foodId: string, updatedFood: Food) {
  const docRef = doc(db, 'foodLogs', userId);
  const docSnap = await getDoc(docRef);

  const cleanUpdatedFood = Object.fromEntries(
    Object.entries(updatedFood).filter(([_, v]) => v !== undefined)
  ) as Food;

  // 1. HELPER to recalculate a recipe's macros based on the newly updated ingredient
  const recalculateRecipeNutrition = (recipe: any) => {
    let updatedIngredients = recipe.recipeIngredients.map((ing: any) => {
      if (ing.food.id === foodId || ing.food?.id === foodId) {
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
            calories: calc(cleanUpdatedFood.calories),
            protein: calc(cleanUpdatedFood.protein),
            carbs: calc(cleanUpdatedFood.carbs),
            fat: calc(cleanUpdatedFood.fat),
            saturatedFat: calc(cleanUpdatedFood.saturatedFat),
            transFat: calc((cleanUpdatedFood as any).transFat),
            cholesterol: calc((cleanUpdatedFood as any).cholesterol),
            sodium: calc((cleanUpdatedFood as any).sodium),
            fiber: calc(cleanUpdatedFood.fiber),
            sugar: calc(cleanUpdatedFood.sugar),
          }
        };
      }
      return ing;
    });

    const totalMacros = updatedIngredients.reduce((acc: any, curr: any) => {
      acc.calories += curr.macros.calories || 0;
      acc.protein += curr.macros.protein || 0;
      acc.carbs += curr.macros.carbs || 0;
      acc.fat += curr.macros.fat || 0;
      acc.saturatedFat += curr.macros.saturatedFat || 0;
      acc.transFat += curr.macros.transFat || 0;
      acc.cholesterol += curr.macros.cholesterol || 0;
      acc.sodium += curr.macros.sodium || 0;
      acc.fiber += curr.macros.fiber || 0;
      acc.sugar += curr.macros.sugar || 0;
      return acc;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0, saturatedFat: 0, transFat: 0, cholesterol: 0, sodium: 0, fiber: 0, sugar: 0 });

    const servings = recipe.recipeServings || 1;

    return {
      ...recipe,
      recipeIngredients: updatedIngredients,
      calories: Number((totalMacros.calories / servings).toFixed(2)),
      protein: Number((totalMacros.protein / servings).toFixed(2)),
      carbs: Number((totalMacros.carbs / servings).toFixed(2)),
      fat: Number((totalMacros.fat / servings).toFixed(2)),
      saturatedFat: Number((totalMacros.saturatedFat / servings).toFixed(2)),
      transFat: Number((totalMacros.transFat / servings).toFixed(2)),
      cholesterol: Number((totalMacros.cholesterol / servings).toFixed(2)),
      sodium: Number((totalMacros.sodium / servings).toFixed(2)),
      fiber: Number((totalMacros.fiber / servings).toFixed(2)),
      sugar: Number((totalMacros.sugar / servings).toFixed(2)),
    };
  };

  // 2. UPDATE ANY RECIPES IN "PREVIOUS FOODS" THAT CONTAIN THIS INGREDIENT
  try {
    const foodsQuery = query(collection(db, 'foods'), where('userId', '==', userId));
    const foodsSnap = await getDocs(foodsQuery);
    const recipeUpdatePromises: Promise<void>[] = [];

    foodsSnap.docs.forEach(docSnap => {
      const foodData = docSnap.data();
      if (foodData.isRecipe && foodData.recipeIngredients) {
        const hasIngredient = foodData.recipeIngredients.some((ing: any) => ing.food.id === foodId || ing.food?.id === foodId);
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

  // 3. UPDATE PAST LOGS (BOTH DIRECT LOGS & RECIPE LOGS)
  if (!docSnap.exists()) return;
  const data = docSnap.data();
  let updated = false;

  const recalculateLog = (log: any) => {
    // CASE A: The log is directly the food we edited
    if (log.foodId === foodId || log.food?.id === foodId) {
      updated = true;
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
        calories: calcConsumed(cleanUpdatedFood.calories) || 0,
        fat: calcConsumed(cleanUpdatedFood.fat),
        saturatedFat: calcConsumed(cleanUpdatedFood.saturatedFat),
        transFat: calcConsumed((cleanUpdatedFood as any).transFat),
        cholesterol: calcConsumed((cleanUpdatedFood as any).cholesterol),
        sodium: calcConsumed((cleanUpdatedFood as any).sodium),
        carbs: calcConsumed(cleanUpdatedFood.carbs),
        fiber: calcConsumed(cleanUpdatedFood.fiber),
        sugar: calcConsumed(cleanUpdatedFood.sugar),
        protein: calcConsumed(cleanUpdatedFood.protein),
      };

      const cleanConsumedNutrition = Object.fromEntries(
        Object.entries(consumedNutrition).filter(([_, v]) => v !== undefined)
      ) as any;

      return {
        ...log,
        food: cleanUpdatedFood,
        ...cleanConsumedNutrition
      };
    }

    // CASE B: The log is a RECIPE that contains the food we edited
    if (log.food?.isRecipe && log.food?.recipeIngredients) {
      const hasIngredient = log.food.recipeIngredients.some((ing: any) => ing.food.id === foodId || ing.food?.id === foodId);
      
      if (hasIngredient) {
        updated = true;
        const updatedRecipe = recalculateRecipeNutrition(log.food);
        
        // Recalculate what the user consumed of this updated recipe
        const multiplier = log.amount; 

        const calcConsumed = (val: number | undefined) => {
          if (val === undefined || isNaN(val)) return undefined;
          return Number((val * multiplier).toFixed(2));
        };

        const consumedNutrition = {
          calories: calcConsumed(updatedRecipe.calories) || 0,
          fat: calcConsumed(updatedRecipe.fat),
          saturatedFat: calcConsumed(updatedRecipe.saturatedFat),
          transFat: calcConsumed(updatedRecipe.transFat),
          cholesterol: calcConsumed(updatedRecipe.cholesterol),
          sodium: calcConsumed(updatedRecipe.sodium),
          carbs: calcConsumed(updatedRecipe.carbs),
          fiber: calcConsumed(updatedRecipe.fiber),
          sugar: calcConsumed(updatedRecipe.sugar),
          protein: calcConsumed(updatedRecipe.protein),
        };

        const cleanConsumedNutrition = Object.fromEntries(
          Object.entries(consumedNutrition).filter(([_, v]) => v !== undefined)
        ) as any;

        return {
          ...log,
          food: updatedRecipe,
          ...cleanConsumedNutrition
        };
      }
    }

    return log;
  };

  if (data.foodData) {
    const newFoodData = data.foodData.map(recalculateLog);
    if (updated) {
      await updateDoc(docRef, { foodData: newFoodData });
    }
  } else if (data.logs) {
    const newLogs = data.logs.map(recalculateLog);
    if (updated) {
      await updateDoc(docRef, { logs: newLogs });
    }
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

// 🚀 OPTIMIZATION: Range query for workouts
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

// 🚀 OPTIMIZATION: Query specifically for a single day
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
        payload.syncs.forEach((syncBatch: any) => {
          if (syncBatch.data && syncBatch.data.workouts) {
            allWorkouts.push(...extractData(syncBatch.data.workouts));
          } else if (syncBatch.workouts) {
            allWorkouts.push(...extractData(syncBatch.workouts));
          }
        });
      } else if (payload.data && payload.data.workouts) {
        allWorkouts.push(...extractData(payload.data.workouts));
      } else if (payload.workouts) {
        allWorkouts.push(...extractData(payload.workouts));
      }
    }
  } catch (err: any) {
    console.warn(`❌ Error reading root doc:`, err.message);
  }

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
  }

  const uniqueWorkouts = Array.from(
    new Map(allWorkouts.filter(w => w != null).map(w => [w.id || w.dbId || Math.random(), w])).values()
  );

  uniqueWorkouts.sort((a: any, b: any) => {
    const dateA = new Date(a.start || a.date || a.timestamp || 0).getTime();
    const dateB = new Date(b.start || b.date || b.timestamp || 0).getTime();
    return dateB - dateA;
  });

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
export async function getDoneLoggingDates(userId: string): Promise<Record<string, boolean>> {
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

export async function toggleDoneLoggingDate(userId: string, dateStr: string, isDone: boolean) {
  try {
    const docRef = doc(db, 'users', userId);
    await setDoc(docRef, {
      doneLoggingDates: {
        [dateStr]: isDone
      }
    }, { merge: true });
  } catch (error) {
    console.error("Error toggling done logging date:", error);
    throw error;
  }
}