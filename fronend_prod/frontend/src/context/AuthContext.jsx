// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '../firebase/config';

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if Firebase is properly configured
  const isFirebaseConfigured = auth !== null;

  // Demo mode functions for when Firebase is not configured
  const demoSignup = async (email, password, displayName) => {
    // Simulate signup delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const mockUser = {
      uid: 'demo-uid-' + Date.now(),
      email: email,
      displayName: displayName,
      photoURL: null
    };
    
    setCurrentUser(mockUser);
    localStorage.setItem('demoUser', JSON.stringify(mockUser));
    return { user: mockUser };
  };

  const demoLogin = async (email, password) => {
    // Simulate login delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const mockUser = {
      uid: 'demo-uid-' + Date.now(),
      email: email,
      displayName: email.split('@')[0],
      photoURL: null
    };
    
    setCurrentUser(mockUser);
    localStorage.setItem('demoUser', JSON.stringify(mockUser));
    return { user: mockUser };
  };

  const demoGoogleSignIn = async () => {
    // Simulate Google sign-in delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const mockUser = {
      uid: 'demo-google-uid-' + Date.now(),
      email: 'demo@gmail.com',
      displayName: 'Demo User',
      photoURL: 'https://via.placeholder.com/40/6366f1/ffffff?text=DU'
    };
    
    setCurrentUser(mockUser);
    localStorage.setItem('demoUser', JSON.stringify(mockUser));
    return { user: mockUser };
  };

  const demoLogout = async () => {
    setCurrentUser(null);
    localStorage.removeItem('demoUser');
  };

  // Real Firebase functions
  const signup = async (email, password, displayName) => {
    if (!isFirebaseConfigured) {
      return demoSignup(email, password, displayName);
    }

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    await updateProfile(userCredential.user, {
      displayName: displayName
    });

    await setDoc(doc(db, 'users', userCredential.user.uid), {
      uid: userCredential.user.uid,
      email: userCredential.user.email,
      displayName: displayName,
      createdAt: new Date(),
      lastLogin: new Date()
    });

    return userCredential;
  };

  const login = async (email, password) => {
    if (!isFirebaseConfigured) {
      return demoLogin(email, password);
    }

    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    
    await setDoc(doc(db, 'users', userCredential.user.uid), {
      lastLogin: new Date()
    }, { merge: true });

    return userCredential;
  };

  const signInWithGoogle = async () => {
    if (!isFirebaseConfigured) {
      return demoGoogleSignIn();
    }

    const userCredential = await signInWithPopup(auth, googleProvider);
    
    const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
    
    if (!userDoc.exists()) {
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        displayName: userCredential.user.displayName,
        photoURL: userCredential.user.photoURL,
        createdAt: new Date(),
        lastLogin: new Date()
      });
    } else {
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        lastLogin: new Date()
      }, { merge: true });
    }

    return userCredential;
  };

  const logout = () => {
    if (!isFirebaseConfigured) {
      return demoLogout();
    }
    return signOut(auth);
  };

  useEffect(() => {
    if (!isFirebaseConfigured) {
      // Check for demo user in localStorage
      const demoUser = localStorage.getItem('demoUser');
      if (demoUser) {
        setCurrentUser(JSON.parse(demoUser));
      }
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, [isFirebaseConfigured]);

  const value = {
    currentUser,
    loading,  // ← ADD THIS LINE
    signup,
    login,
    signInWithGoogle,
    logout,
    isFirebaseConfigured
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};