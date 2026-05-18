/**
 * @fileoverview Custom React hook for authentication management
 * 
 * This hook encapsulates all authentication logic including:
 * - User login/logout
 * - Session state management
 * - Role-based access control (Student, Teacher, Admin)
 * - Credential validation
 * 
 * Context: StudyPixel is an adaptive learning platform. We have three types of users:
 * 1. Students: Learn and interact with PixelBots.
 * 2. Teachers: Manage students and view analytics.
 * 3. Admins: Manage the system.
 * 
 * Why use a custom hook:
 * - Centralizes auth logic in one reusable place
 * - Makes components cleaner (no auth logic in UI code)
 * - Consistent auth behavior across the app
 * 
 * How to use:
 * ```javascript
 * function MyComponent() {
 *   const { user, login, logout, isAuthenticated } = useAuth();
 *   
 *   if (!isAuthenticated) {
 *     return <LoginScreen onLogin={login} />;
 *   }
 *   
 *   return <Dashboard user={user} onLogout={logout} />;
 * }
 * ```
 */

"use strict";

// React hooks will be available globally from React CDN
import { useState, useCallback, useEffect } from 'react';
import { authenticateUser } from '@/lib/dataService';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

/**
 * Custom hook for authentication management
 * 
 * Manages user authentication state and provides login/logout functions.
 * Uses localStorage to persist session across page refreshes (demo only -
 * production should use secure HTTP-only cookies or Firebase Auth).
 * 
 * State Management:
 * - user: Current authenticated user object (or null)
 * - isAuthenticated: Boolean convenience flag
 * 
 * Methods:
 * - login(email, password, role): Authenticates user and sets session
 * - logout(): Clears session and user state
 * 
 * @returns {Object} Authentication state and methods
 * @property {Object|null} user - Current authenticated user
 * @property {boolean} isAuthenticated - Whether user is logged in
 * @property {Function} login - Login function
 * @property {Function} logout - Logout function
 * @property {boolean} isLoading - Whether auth check is in progress
 * @property {string|null} error - Auth error message
 * 
 * @example
 * const { user, login, logout, error } = useAuth();
 * 
 * const handleLogin = async () => {
 *   const success = await login('student@studypixel.com', 'student123', 'student');
 *   if (!success) {
 *     console.error(error);
 *   }
 * };
 */
function useAuth() {
  // WHAT: Creates a state variable named 'user'.
  // WHY:  Holds the profile of the currently logged-in person (e.g., "Ravi", "Student").
  // HOW:  It uses React's `useState` hook. We initialize it to `null` because when the app first loads, no user is logged in.
  // WHAT IF: No one is logged in? It stays `null`.
  const [user, setUser] = useState(null);

  // WHAT: Creates a state variable named 'isLoading'.
  // WHY:  Prevents the UI from flashing the "Login" screen while we are still checking if the user is already logged in from a previous session.
  // HOW:  It uses `useState` and is initialized to `true`. The app is "loading" until Firebase tells us the user's status.
  // WHAT IF: The internet is slow? The app stays in "Loading..." mode until Firebase responds.
  const [isLoading, setIsLoading] = useState(true); // Start loading until auth state is confirmed

  // WHAT: Creates a state variable named 'error'.
  // WHY:  Stores messages like "Wrong password" or "Network error" to show to the user.
  // HOW:  It uses `useState` and is initialized to `null` because there are no errors at the start.
  const [error, setError] = useState(null);

  // WHAT: A React Effect that runs once when the application first loads.
  // WHY:  This is the "Listener". It runs automatically whenever the user's login status changes (login, logout, or app open).
  // HOW:  It uses `useEffect` with an empty dependency array `[]`, which means it runs only on the initial render.
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      try {
        // WHAT: Checks if Firebase has told us a user is logged in.
        if (firebaseUser) {
          // SCENARIO: User is logged into Google/Firebase. Now we need to know WHO they are in StudyPixel.
          // ACTION: Fetch their full profile (Name, Role, Grade) from our 'users' database.
          // HOW: We create a reference to the user's document in the 'users' collection in Firestore, using their unique ID (`firebaseUser.uid`).
          const userDocRef = doc(db, 'users', firebaseUser.uid);
        console.log("Attempting to fetch Firestore user profile for UID:", firebaseUser.uid);

          // WHAT: Fetches the document from Firestore.
          // HOW:  `getDoc` is an asynchronous function from the Firestore SDK that retrieves a single document.
          const userDoc = await getDoc(userDocRef);

          // WHAT: Checks if the user's profile document actually exists in our database.
          if (userDoc.exists()) {
            // SUCCESS: User exists in Auth AND Database.
            // ACTION: Update the app state so the UI knows who is logged in.
            // HOW:  We create a complete `userData` object by combining the user's ID from Auth and their profile data from Firestore.
            const userData = { uid: firebaseUser.uid, ...userDoc.data() };

            // WHAT: Updates our application's state with the complete user data.
            setUser(userData);

            // ACTION: Save to local storage so the user stays logged in if they refresh the page.
            // WHY:  This allows the app to remember the user even if they refresh the page, providing a slightly faster load time on the next visit.
            localStorage.setItem('studypixel_user', JSON.stringify(userData));
          } else {
            // WHAT IF: The user exists in Firebase Auth, but their profile is missing from our Database?
            // (e.g., An admin manually deleted the user record but left the login account).
            // ACTION: This is a corrupted state. Force logout immediately.
            await signOut(auth);
            setError("User profile not found in database.");
          }
        } else {
          // SCENARIO: User clicked "Logout" or was never logged in.
          // ACTION: Wipe all user data from memory.
          setUser(null);
          localStorage.removeItem('studypixel_user');
        }
      } catch (err) {
        // WHAT IF: The internet connection drops while fetching the user profile?
        // ACTION: Catch the error, log it, and ensure the app doesn't crash.
        console.error("Auth state change error:", err);
        setError("Failed to verify authentication status.");
        setUser(null);
      } finally {
        // ACTION: Turn off the "Loading..." spinner. The check is done.
        // WHY:  This code is GUARANTEED to run, whether the `try` block succeeded or the `catch` block was triggered.
        // HOW:  We set `isLoading` to `false` here to signal that the initial authentication check is complete.
        setIsLoading(false);
      }
    });

    // CLEANUP: Stop listening when the user leaves the app to save memory.
    // WHY:  When the component is removed from the screen (e.g., navigating away), we must unsubscribe from the `onAuthStateChanged` listener.
    // HOW:  `onAuthStateChanged` returns a function (`unsubscribe`). We return this function from our effect, and React will automatically call it during cleanup.
    return () => unsubscribe();
  }, []); // Empty dependency array ensures this runs only once on mount.
  
  /**
   * WHAT: The Login Function.
   * WHY:  Called when the user clicks "Sign In" on the Login Screen.
   * HOW:  It uses `useCallback` to prevent the function from being recreated on every render, which is a performance optimization.
   * 
   * @param {string} email - User email
   * @param {string} password - User password
   * @param {string} role - Expected role (admin/teacher/student)
   * @returns {Promise<boolean>} True if login successful, false otherwise
   */
  const login = useCallback(async (email, password, role) => {
    // WHAT: Resets any previous error messages.
    // WHY:  Ensures that old errors don't persist on the screen when the user tries to log in again.
    setError(null);
    
    try {
      // ACTION: Ask Firebase to check the email and password.
      // WHY:  This keeps our component clean. The `dataService` is responsible for the details of talking to Firebase.
      const authenticatedUser = await authenticateUser(email, password);

      // WHAT IF: The password is correct, but the user selected the wrong role?
      // (e.g., A Student tries to log in using the "Teacher" tab).
      if (authenticatedUser && authenticatedUser.role === role) {
        // SUCCESS: Credentials match AND Role matches.
        // HOW:  We simply return `true`. We don't need to `setUser` here because the `onAuthStateChanged` listener we set up earlier will automatically detect the login and handle setting the user state.
        return true;
      } else if (authenticatedUser && authenticatedUser.role !== role) {
        // FAILURE: Role Mismatch.
        // ACTION: Log them out immediately and explain why. Security feature.
        // HOW:  We immediately call `signOut` to terminate the session, and set a specific error message.
        await signOut(auth);
        setError("Role mismatch. Please select the correct role and try again.");
        return false;
      } else {
        // FAILURE: Generic credential error.
        setError("Invalid credentials. Please check your email and password.");
        return false;
      }
    } catch (err) {
      // WHAT IF: Firebase throws a technical error (e.g., 'auth/user-not-found')?
      // ACTION: Translate the technical code into a human-readable message.
      console.error('Login error:', err);
      // HOW:  We format the error message from Firebase to be more user-friendly and set it in our state.
      let friendlyMessage = 'An error occurred during login.';
      // WHAT: Checks the specific error code from Firebase.
      // WHY:  This provides much more specific and actionable feedback to the user instead of a generic message.
      if (err.code) {
        if (err.code.startsWith('auth/')) {
          // It's an auth error like 'auth/wrong-password'.
          friendlyMessage = err.message.replace('Firebase: ', '');
        } else if (err.code === 'permission-denied') {
          // It's a security rule error from Firestore. This is the most likely cause of the current issue.
          friendlyMessage = 'Permission Denied: Could not read user profile from the database. Please check Firestore security rules.';
        }
      }
      setError(friendlyMessage);
      return false;
    }
  }, []); // No dependencies needed for login function
  
  /**
   * WHAT: The Logout Function.
   * WHY:  Clears the session when the user clicks "Sign Out".
   * HOW:  It calls Firebase's `signOut` function. The `onAuthStateChanged` listener will then automatically handle clearing the user state and local storage.
   */
  const logout = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
      setError('Failed to log out.');
    }
  }, []);
  
  /**
   * WHAT: A simple flag to check if the user is logged in.
   * WHY:  Easier than checking `if (user !== null)` everywhere in the UI.
   */
  const isAuthenticated = user !== null;
  
  // WHAT: The "Public API" of this hook.
  // WHY:  These are the only things other components can see and use.
  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    setError,  // Exposed for manual error setting (e.g., from components)
  };
}

// Export for use throughout the application
export { useAuth };