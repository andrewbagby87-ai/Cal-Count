# Cal Count - PWA Calorie Counter

A Progressive Web App for tracking daily calorie intake, fitness, and weight progress. Built with React, TypeScript, Firebase, and Vite.

## Features

✅ **Authentication**
- Sign up / Sign in with email and password
- First-time setup to configure daily nutrition goals
- Persistent session management

✅ **Food Logging**
- Create new foods with nutrition information
- Log previous foods with custom amounts
- Edit nutrition values for individual log entries
- Track calories, protein, and fiber consumption

✅ **Workout Tracking**
- Log workouts with duration and calories burned
- Automatic calorie budget increase based on workouts
- Daily workout summary

✅ **Weight Tracking**
- Automatic weight logging prompt on first daily login
- Log weight at any time with date and time
- Support for both kg and lbs
- Visual weight history

✅ **Daily Dashboard**
- Real-time calorie budget tracking
- Progress bar showing calorie consumption
- Protein and fiber tracking (if configured)
- Remaining calorie calculation

✅ **Progressive Web App**
- Installable on mobile and desktop
- Offline support using service workers
- Responsive design optimized for mobile

## Prerequisites

- Node.js 16+ and npm
- Firebase account (create at [firebase.google.com](https://firebase.google.com))

## Setup Instructions

### 1. Clone and Install

```bash
cd Cal-Count
npm install
```

### 2. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project
3. Enable Authentication:
   - Go to Authentication > Sign-in method
   - Enable Email/Password
4. Create Firestore Database:
   - Go to Firestore Database
   - Create database in production mode (or test mode for development)
   - Set rules to:
     ```json
     rules_version = '2';
     service cloud.firestore {
       match /databases/{database}/documents {
         match /{document=**} {
           allow read, write: if request.auth != null;
         }
       }
     }
     ```
5. Copy your project credentials from Project Settings

### 3. Environment Configuration

1. Copy `.env.example` to `.env.local`
2. Fill in your Firebase credentials:

```bash
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### 5. Build for Production

```bash
npm run build
```

## Project Structure

```
src/
├── components/          # React components
│   ├── DailyStatsTab.tsx
│   ├── FoodLogTab.tsx
│   ├── AddFoodModal.tsx
│   ├── CreateFoodModal.tsx
│   ├── AddPreviousFoodModal.tsx
│   ├── EditFoodLogModal.tsx
│   ├── WorkoutTab.tsx
│   ├── WeightTab.tsx
│   └── WeightPrompt.tsx
├── pages/               # Page components
│   ├── AuthPage.tsx
│   ├── SetupPage.tsx
│   └── Dashboard.tsx
├── contexts/            # React contexts
│   └── AuthContext.tsx
├── services/            # Firebase and database services
│   ├── firebase.ts
│   ├── auth.ts
│   └── database.ts
├── types/               # TypeScript interfaces
│   └── index.ts
├── App.tsx
└── main.tsx
```

## Database Schema

### Collections

#### `users`
```typescript
{
  uid: string;
  dailyCalorieBudget: number;
  dailyProteinBudget?: number;
  dailyFiberBudget?: number;
  createdAt: Timestamp;
}
```

#### `foods`
```typescript
{
  userId: string;
  name: string;
  brand?: string;
  calories: number;
  protein?: number;
  fiber?: number;
  servingSize: number;
  servingUnit: 'g' | 'oz' | 'cup' | 'ml' | 'serving';
  createdAt: Timestamp;
}
```

#### `foodLogs`
```typescript
{
  userId: string;
  date: string; // YYYY-MM-DD
  foodId: string;
  amount: number;
  unit: 'g' | 'oz' | 'cup' | 'ml' | 'serving';
  calories: number;
  protein?: number;
  fiber?: number;
  editedNutrition?: { calories: number; protein?: number; fiber?: number };
  timestamp: Timestamp;
}
```

#### `workoutLogs`
```typescript
{
  userId: string;
  date: string; // YYYY-MM-DD
  duration: number; // minutes
  caloriesBurned: number;
  timestamp: Timestamp;
}
```

#### `weightLogs`
```typescript
{
  userId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  weight: number;
  unit: 'kg' | 'lbs';
  timestamp: Timestamp;
}
```

## Usage Guide

### First Time Setup
1. Sign up with email and password
2. Enter your display name
3. Configure your daily calorie budget
4. Optionally set protein and fiber goals
5. App prompts to log weight on first login each day

### Logging Food
1. Tap "Food" tab
2. Click "+ Add Food"
3. Choose "Create New Food" or "Add Previous Food"
   - **Create New**: Enters all nutrition details
   - **Previous Food**: Select from previously created foods with custom amount
4. Quantities can be entered by serving size or weight (g, oz, cup, ml)
5. Click the pencil icon to edit an individual log entry's nutrition

### Logging Workout
1. Tap "Workout" tab
2. Click "+ Add Workout"
3. Enter duration (minutes) and calories burned
4. Calorie budget increases by the amount burned

### Logging Weight
1. Tap "Weight" tab
2. Click "+ Log Weight" or respond "Yes" to daily prompt
3. Enter weight and select unit (kg or lbs)
4. Weight history appears below with dates and times

### Viewing Stats
1. Tap "Stats" tab to see daily summary
2. View calorie consumption vs budget
3. See protein and fiber tracked (if configured)
4. View calories burned from workouts

## Technologies Used

- **Frontend**: React 18, TypeScript
- **Build Tool**: Vite
- **Backend**: Firebase (Auth + Firestore)
- **PWA**: vite-plugin-pwa
- **HTTP Client**: Firebase SDK
- **Routing**: wouter

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## PWA Features

- Install on home screen (mobile and desktop)
- Offline support for previously loaded data
- Background sync
- App-like experience with full-screen mode
- Custom theme colors

## License

MIT

## Support

For issues or feature requests, please create an issue in the repository.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_FIREBASE_API_KEY` | Firebase API Key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth Domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage Bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Messaging Sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase App ID |

## Notes

- All times are stored in the user's local timezone
- Weight can be logged at any time, not just on first login
- Edited food nutrition only affects that specific log entry
- Workouts increase the calorie budget for the day
- The app uses IndexedDB for offline data caching (future enhancement)
