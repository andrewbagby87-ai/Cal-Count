// src/services/auth.ts
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  updateProfile,
  fetchSignInMethodsForEmail // ADD THIS IMPORT
} from 'firebase/auth';
import { auth } from './firebase';
import { createUserProfile } from './database';
import { UserProfile } from '../types';

export async function signUp(email: string, password: string, displayName: string) {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(userCredential.user, {
    displayName,
  });
  return userCredential.user;
}

export async function signIn(email: string, password: string) {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
}

export async function logout() {
  await signOut(auth);
}

export function onAuthChange(callback: (user: FirebaseUser | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export async function createNewUserProfile(uid: string, profile: Omit<UserProfile, 'uid' | 'createdAt'>) {
  await createUserProfile(uid, profile);
}

// NEW: Helper function to securely check if an email is registered
export async function checkEmailExists(email: string) {
  try {
    const methods = await fetchSignInMethodsForEmail(auth, email);
    return methods.length > 0;
  } catch (error) {
    console.error("Error checking email:", error);
    return false;
  }
}