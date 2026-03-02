export interface User {
  uid: string;
  email: string;
  displayName?: string;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  caloriesBudget: number;
  
  // Nutrient Budgets
  proteinBudget?: number;
  fiberBudget?: number;
  fatBudget?: number;
  saturatedFatBudget?: number;
  carbsBudget?: number;
  sugarBudget?: number;
  
  // Tracking Toggles
  trackProtein?: boolean;
  trackFiber?: boolean;
  trackFat?: boolean;
  trackSaturatedFat?: boolean;
  trackCarbs?: boolean;
  trackSugar?: boolean;
  
  createdAt: Date | number | string;
  updatedAt?: Date | number | string;
}

export interface AuthContextType {
  user: any;
  userProfile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
  deleteUserAccount: (password?: string) => Promise<void>; 
  refreshUserProfile: () => Promise<void>;
}

export interface Food {
  id: string;
  userId: string;
  name: string;
  brand?: string;
  calories: number;
  protein?: number;
  fiber?: number;
  fat?: number;
  saturatedFat?: number;
  transFat?: number;
  cholesterol?: number;
  sodium?: number;
  carbs?: number;
  sugar?: number;
  servingSize: number;
  servingUnit: 'g' | 'oz' | 'cup' | 'ml' | 'serving' | 'each';
  volume?: number;
  volumeUnit?: string;
  volumes?: { amount: number; unit: string }[];
  createdAt: number;
}

export interface FoodLog {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  foodId: string;
  food: Food;
  amount: number;
  unit: 'g' | 'oz' | 'cup' | 'ml' | 'serving' | 'each';
  calories: number;
  protein?: number;
  fiber?: number;
  fat?: number;
  saturatedFat?: number;
  transFat?: number;
  cholesterol?: number;
  sodium?: number;
  carbs?: number;
  sugar?: number;
  timestamp: number;
  
  // For edited foods (only edit this log entry)
  editedNutrition?: {
    calories: number;
    protein?: number;
    fiber?: number;
    fat?: number;
    saturatedFat?: number;
    transFat?: number;
    cholesterol?: number;
    sodium?: number;
    carbs?: number;
    sugar?: number;
  };
}

export interface WorkoutLog {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  duration: number; // minutes
  caloriesBurned: number;
  timestamp: number;
}

export interface WeightLog {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  weight: number; // in kg or lbs (user chooses)
  unit: 'kg' | 'lbs';
  timestamp: number;
}

export interface DailyStats {
  date: string;
  caloriesConsumed: number;
  caloriesBurned: number;
  totalCalorieBudget: number;
  calorieBudgetRemaining: number;
  
  proteinConsumed?: number;
  fiberConsumed?: number;
  fatConsumed?: number;
  saturatedFatConsumed?: number;
  carbsConsumed?: number;
  sugarConsumed?: number;
}