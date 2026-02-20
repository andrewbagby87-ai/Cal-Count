import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, signOut, deleteUser, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth } from '../services/firebase';
import { getUserProfile, deleteAllUserData } from '../services/database';
import type { AuthContextType, UserProfile } from '../types/index';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const profile = await getUserProfile(currentUser.uid);
          setUserProfile(profile);
        } catch (error) {
          console.error('Error fetching user profile:', error);
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setUserProfile(null);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  const refreshUserProfile = async () => {
    if (!user) throw new Error('No user logged in');
    try {
      const profile = await getUserProfile(user.uid);
      setUserProfile(profile);
    } catch (error) {
      console.error('Error refreshing user profile:', error);
      throw error;
    }
  };

  const updateUserProfile = async (data: Partial<UserProfile>) => {
    if (!user) throw new Error('No user logged in');
    try {
      await refreshUserProfile();
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  };

  // This function takes the password from UserSettings, refreshes the token, and deletes everything
  const deleteUserAccount = async (password?: string) => {
    if (!user) throw new Error('No user logged in');
    
    try {
      // 1. Re-authenticate with the provided password to satisfy Firebase security rules
      if (password && user.email) {
        const credential = EmailAuthProvider.credential(user.email, password);
        await reauthenticateWithCredential(user, credential);
      }

      // 2. Delete ALL user data from Firestore
      await deleteAllUserData(user.uid);
      
      // 3. Delete the user account from Firebase Auth
      await deleteUser(user);
      
      // 4. Clear local session
      await logout();
      
    } catch (error: any) {
      console.error('Error deleting account:', error);
      throw error; 
    } 
  };

  const value: AuthContextType = {
    user,
    userProfile,
    loading,
    login: async () => {},
    signup: async () => {},
    logout,
    updateUserProfile,
    deleteUserAccount,
    refreshUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}