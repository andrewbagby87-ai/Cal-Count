// src/services/auth.ts
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  updateProfile,
  fetchSignInMethodsForEmail,
  sendSignInLinkToEmail, 
  isSignInWithEmailLink, 
  signInWithEmailLink,
  signInWithCustomToken // NEW
} from 'firebase/auth';
import { doc, setDoc, onSnapshot, deleteDoc } from 'firebase/firestore'; // NEW
import { getFunctions, httpsCallable } from 'firebase/functions'; // NEW
import { auth, db } from './firebase'; // Ensure db is imported
import { createUserProfile } from './database';
import { UserProfile } from '../types';
import { sendPasswordResetEmail } from 'firebase/auth';

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

// Helper function to securely check if an email is registered
export async function checkEmailExists(email: string) {
  try {
    const methods = await fetchSignInMethodsForEmail(auth, email);
    return methods.length > 0;
  } catch (error) {
    console.error("Error checking email:", error);
    return false;
  }
}

export const resetPassword = async (email: string) => {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (error: any) {
    console.error("Error sending reset email:", error);
    if (error.code === 'auth/user-not-found') {
      return { success: false, error: "No account found with this email." };
    }
    if (error.code === 'auth/invalid-email') {
      return { success: false, error: "Please enter a valid email address." };
    }
    return { success: false, error: "Failed to send reset email. Please try again." };
  }
};

// --- CROSS DEVICE MAGIC LINK FLOW ---

export const sendCrossDeviceMagicLink = async (email: string) => {
  // 1. Generate a unique session ID
  const sessionId = crypto.randomUUID();

  // 2. Create the temporary session document in Firestore
  try {
    await setDoc(doc(db, 'login_sessions', sessionId), {
      status: 'waiting',
      email: email,
      createdAt: Date.now()
    });
  } catch (dbError) {
    console.error("Failed to create login session in Firestore:", dbError);
    return { success: false, error: "Failed to initialize login session." };
  }

  // 3. Build the Magic Link URL, appending the sessionId so the phone knows about it
  const baseUrl = window.location.href.split('?')[0];
  const actionCodeSettings = {
    url: `${baseUrl}?sessionId=${sessionId}`,
    handleCodeInApp: true,
  };

  try {
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    window.localStorage.setItem('emailForSignIn', email);
    // 4. Return the sessionId so the UI can start listening to it
    return { success: true, sessionId };
  } catch (error: any) {
    console.error("Error sending magic link:", error);
    return { success: false, error: "Failed to send the login link. Please try again." };
  }
};

export const listenForRemoteApproval = (sessionId: string, onSuccess: () => void) => {
  const unsubscribe = onSnapshot(doc(db, 'login_sessions', sessionId), async (snapshot) => {
    const data = snapshot.data();
    
    // If the document has a custom token, the phone approved it!
    if (data && data.customToken) {
      try {
        // 1. Log the computer in
        await signInWithCustomToken(auth, data.customToken);
        
        // (We removed the deleteDoc line here so it stops crashing!)
        
        // 2. Tell the UI it was successful
        onSuccess();
      } catch (err) {
        console.error("Failed to sign in with custom token", err);
      }
    }
  });

  return unsubscribe;
};

export const completePasswordlessLogin = async () => {
  if (isSignInWithEmailLink(auth, window.location.href)) {
    let email = window.localStorage.getItem('emailForSignIn');
    
    if (!email) {
      email = window.prompt('Please confirm your email address to complete sign-in:');
    }
    
    if (email) {
      try {
        await signInWithEmailLink(auth, email, window.location.href);
        window.localStorage.removeItem('emailForSignIn');

        // CHECK FOR CROSS-DEVICE SESSION
        const urlParams = new URLSearchParams(window.location.search);
        const sessionId = urlParams.get('sessionId');

        if (sessionId) {
          // The user clicked a link generated by another device!
          // Call the Cloud Function to approve it.
          const functions = getFunctions();
          const approveLogin = httpsCallable(functions, 'approveRemoteLogin');
          
          await approveLogin({ sessionId });
        }

        return { success: true };
      } catch (error: any) {
        console.error("Error logging in with magic link", error);
        return { success: false, error: "This login link has expired or is invalid." };
      }
    }
  }
  return { success: false };
};