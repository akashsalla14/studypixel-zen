/**
 * @fileoverview Data Service Layer for StudyPixel
 * 
 * This module provides a clean abstraction layer for all data persistence
 * operations using Firebase. It handles:
 * - User authentication via Firebase Auth
 * - Student progress, configurations, and logs via Firestore
 * This module acts as the "Librarian" and "Gatekeeper" for all data in StudyPixel.
 * It handles talking to the database (Firebase Firestore) and the identity system (Firebase Auth).
 * 
 * Context: StudyPixel stores data in the cloud. This file ensures that when a user
 * clicks "Save" or "Login", the correct data is securely sent to or retrieved from Google's servers.
 * 
 * Architecture Benefits:
 * 1. Separation of Concerns: UI components are decoupled from Firebase.
 * 2. Easy Testing: This service can be mocked for component unit tests.
 * 3. Centralized Logic: All Firestore and Auth logic is in one place.
 * 
 * Backend Implementation:
 * - Firebase Authentication for user management.
 * - Firestore for real-time data storage of users, pixelbots, progress, etc.
 * 1. Separation of Concerns: The buttons on the screen don't need to know *how* to talk to the database, they just ask this service.
 * 2. Centralized Logic: If we change how we store data, we only change it here, not in 50 different files.
 */

"use strict";

// Import dependencies
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

/**
 * Authenticates user credentials
 * 
 * This function calls Firebase Authentication to verify the user's email and
 * password. If successful, it fetches the user's profile (including their role)
 * from the Firestore 'users' collection.
 * 
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object|null>} A complete user object if authenticated and profile exists, otherwise null.
 * 
 * @example
 * const user = await authenticateUser('student@studypixel.com', 'student123');
 * if (user) {
 *   console.log(`Welcome, ${user.name}!`);
 * }
 */


async function authenticateUser(email, password) {
  // WHAT: This function attempts to sign in a user using their email and password.
  // WHY:  It's the first step in the login process, verifying the user's credentials with the Firebase backend.
  // HOW:  It uses the `signInWithEmailAndPassword` function from the Firebase Authentication SDK.
  // WHAT: Attempts to sign in a user using their email and password.
  // WHY:  This is the digital "ID Check". We need to prove they are who they say they are before showing any private data.
  // HOW:  We send the credentials to Google's secure authentication system.
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    // WHAT: If the sign-in is successful, we get a `userCredential` object. We then create a reference to that user's document in our 'users' database collection.
    
    // WHAT: Once Google says "Password Correct", we look up their personal file in our database.
    // WHY:  Google Auth only knows their email. We need to know their Name, Role (Student/Teacher), and Class.
    const userDocRef = doc(db, 'users', userCredential.user.uid);
    // WHAT: We fetch the document from the database.
    const userDoc = await getDoc(userDocRef);

    // WHAT: We check if the document was actually found.
    // WHAT IF: The user has a login, but their file is missing from our database?
    // SCENARIO: An admin accidentally deleted the user's record but left their login active.
    if (userDoc.exists()) {
      // WHY:  A successful login means the user exists in Auth AND has a profile in Firestore.
      // HOW:  We return a complete user object, combining their unique ID (uid) from Auth with the profile data (name, role) from the Firestore document.
      // SUCCESS: User is valid and has a profile. Return everything.
      return { uid: userCredential.user.uid, ...userDoc.data() };
    } else {
      // WHAT: This is a safety check for an inconsistent state.
      // WHY:  If a user exists in the authentication system but has no profile in our database, we cannot let them proceed. We treat this as a failed login.
      // FAILURE: Inconsistent state. Deny access to prevent errors later.
      return null;
    }
  } catch (error) {
    console.error('Authentication failed:', error);
    // WHAT: If `signInWithEmailAndPassword` fails (e.g., wrong password), it throws an error.
    // WHY:  We need to pass this error up to the UI so the user can be notified of what went wrong.
    // HOW:  The `throw` keyword sends the error object to the `catch` block in the `useAuth` hook's `login` function.
    throw error; // Re-throw the error to be handled by the caller (useAuth hook)
  }
}

/**
 * Saves student progress data to persistence layer
 * 
 * Stores mastery progression, response history, and system logs
 * for analytics and resume functionality.
 * 
 * @param {Object} progressData - Student progress payload
 * @param {number} progressData.userId - Student user ID
 * @param {number} progressData.pixelbotId - PixelBot ID
 * @param {number} progressData.mastery - Current mastery level (0-1)
 * @param {Array<number>} progressData.masterySeries - Historical mastery progression
 * @param {Array<Object>} progressData.chatHistory - Conversation log
 * @param {Array<string>} progressData.systemLogs - BKT update logs
 * @returns {Promise<Object>} Save confirmation with timestamp
 * 
 * @example
 * await saveStudentProgress({
 *   userId: 3,
 *   pixelbotId: 2,
 *   mastery: 0.72,
 *   masterySeries: [0.25, 0.35, 0.48, 0.62, 0.72],
 *   chatHistory: [...],
 *   systemLogs: [...]
 * });
 */
async function saveStudentProgress(progressData) {
  // WHAT: Creates a unique key for the Firestore document.
  // WHY:  Using a predictable key allows us to easily retrieve or update this specific user's progress for this specific PixelBot later.
  // HOW:  It combines the user's ID and the PixelBot's ID into a single string.
  // WHAT: Creates a unique label for this specific student's work on this specific bot.
  // WHY:  We need to find this exact record later. It's like filing a report under "StudentName_SubjectName".
  const storageKey = `progress_${progressData.userId}_${progressData.pixelbotId}`;
  // WHAT: Saves the data to Firestore.
  // WHY:  This is the core persistence step.
  // HOW:  It uses `setDoc` with `{ merge: true }`. This is a robust way to save data because it will create the document if it doesn't exist or update it if it already does, without overwriting fields that aren't included in `progressData`.
  
  // WHAT: Saves the progress (Mastery score, Chat history) to the cloud.
  // HOW:  We use `setDoc` with `merge: true`. This means "Update existing info, or create it if it's new."
  // WHAT IF: The internet cuts out? Firebase will queue this save and send it when the connection returns.
  await setDoc(doc(db, 'studentProgress', storageKey), progressData, { merge: true });
  return { 
    status: "ok", 
    record: progressData, 
    timestamp: new Date().toISOString() 
  };
}

/**
 * Loads saved student progress from persistence layer
 * 
 * @param {number} userId - Student user ID
 * @param {number} pixelbotId - PixelBot ID
 * @returns {Promise<Object|null>} Saved progress data or null if not found
 */
async function loadStudentProgress(userId, pixelbotId) {
  // WHAT: Creates the same unique key used for saving.
  // WHY:  To ensure we are fetching the correct document.
  // WHAT: Reconstructs the unique label to find the file.
  const storageKey = `progress_${userId}_${pixelbotId}`;
  // WHAT: Creates a reference to the specific document in the 'studentProgress' collection.
  
  // WHAT: Asks the database for the document.
  const docRef = doc(db, 'studentProgress', storageKey);
  // WHAT: Fetches the document from Firestore.
  const docSnap = await getDoc(docRef);
  // WHAT: Checks if the document exists and returns its data.
  // WHY:  If `docSnap.exists()` is false, it means the user has no saved progress for this bot yet, so we return `null`. Otherwise, we return the saved data.
  
  // WHAT IF: The student has never used this bot before?
  // ACTION: We return `null`, which tells the app to start a fresh session.
  return docSnap.exists() ? docSnap.data() : null;
}

/**
 * Fetches all PixelBots (optionally filtered by teacher/student)
 * 
 * @param {Object} [filters] - Optional filter parameters
 * @param {string} [filters.role] - Filter by user role
 * @param {number} [filters.userId] - Filter by assigned user
 * @returns {Promise<Array<Object>>} Array of PixelBot configurations
 */
async function getPixelBots(filters = {}) {
  // WHAT: Creates a reference to the 'pixelbots' collection in Firestore.
  // WHAT: Prepares to search the 'pixelbots' collection.
  const pixelbotsRef = collection(db, 'pixelbots');
  // WHAT: Initializes a database query.
  let q = query(pixelbotsRef);

  // WHAT: Adds a filter to the query if a `teacherId` is provided.
  // WHY:  This allows us to fetch all PixelBots for a specific teacher, which is needed for the Teacher Dashboard.
  // HOW:  It uses the `where` clause to filter documents where the `teacherId` field matches the provided ID.
  // WHAT IF: A Teacher is logged in?
  // ACTION: Only show bots created by THIS teacher.
  if (filters.teacherId) {
    // Correctly filter by teacherId if provided
    q = query(q, where('teacherId', '==', filters.teacherId));
  }
  // WHAT: Adds a filter to the query if a `creatorId` is provided.
  // WHY:  This allows us to fetch all PixelBots created by a specific student for their "Personal PixelBots" tab.
  // HOW:  It uses the `where` clause to filter documents where the `creatorId` field matches the provided ID.
  // WHAT IF: A Student is looking at their "My Bots" list?
  // ACTION: Only show bots created by THIS student.
  if (filters.creatorId) {
    q = query(q, where('creatorId', '==', filters.creatorId));
  }
    // WHAT: Executes the query and returns the results.
  // HOW:  `getDocs` fetches all documents matching the query. We then map over the results to format them into a clean array of objects, including the document ID.
  
  // WHAT: Runs the search and returns the list.
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Fetches all users with the 'teacher' role.
 * @returns {Promise<Array<Object>>} An array of teacher user objects.
 */
async function getTeachers() {
  // WHAT: This function fetches all user documents from the 'users' collection that have a 'role' field equal to 'teacher'.
  // WHY:  The Admin Dashboard needs a list of all available teachers to populate the dropdown when creating a new student.
  // HOW:  It uses Firestore's `query` and `where` functions to build a database query. `getDocs` executes the query and returns the results.
  // WHAT: Searches for all users who are marked as 'teacher'.
  // WHY:  Used by Admins to assign a teacher when creating a new student account.
  const teachersRef = collection(db, 'users');
  const q = query(teachersRef, where('role', '==', 'teacher'));
  const querySnapshot = await getDocs(q);
  
  // WHAT IF: No teachers exist yet?
  // ACTION: Return an empty list so the dropdown is just blank, rather than crashing.
  if (querySnapshot.empty) {
    console.log("No teachers found.");
    return [];
  }
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Creates a new class for a teacher.
 * @param {Object} classData - Data for the new class.
 * @param {string} classData.teacherId - The ID of the teacher creating the class.
 * @param {string} classData.year - The year of the class (e.g., 'first', 'second').
 * @param {string} classData.className - The name/letter of the class (e.g., 'A', 'B').
 * @returns {Promise<Object>} The created class object with its new ID.
 */
async function createClass(classData) {
  // WHAT: Prepares a new Class record (e.g., "Grade 10 - Science").
  // WHY:  Classes group students together for easier management.
  const newClass = {
    ...classData,
    studentIds: [], // Start with an empty roster
    createdAt: new Date().toISOString(),
  };
  
  // WHAT: Adds it to the database.
  const docRef = await addDoc(collection(db, 'classes'), newClass);
  return { id: docRef.id, ...newClass };
}

/**
 * Fetches all classes for a given teacher.
 * @param {string} teacherId - The ID of the teacher.
 * @returns {Promise<Array<Object>>} An array of class objects.
 */
async function getClasses(teacherId) {
  // WHAT: Finds all classes managed by a specific teacher.
  const classesRef = collection(db, 'classes');
  const q = query(classesRef, where('teacherId', '==', teacherId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Updates the complete student roster for a specific class.
 * @param {string} classId - The ID of the class to update.
 * @param {Array<string>} studentIds - The complete array of student IDs for the roster.
 * @returns {Promise<void>}
 */
async function updateClassRoster(classId, studentIds) {
  // WHAT IF: The developer forgot to provide a Class ID?
  // ACTION: Stop immediately to prevent corrupting data.
  if (!classId) {
    throw new Error("Class ID is required.");
  }
  
  // WHAT: Overwrites the list of students in a class.
  // WHY:  Used when a teacher adds or removes students from a class list.
  const classRef = doc(db, 'classes', classId);
  // Overwrites the studentIds array with the new list.
  await updateDoc(classRef, { studentIds });
}

/**
 * Assigns a PixelBot to a specific class by updating its document.
 * @param {string} pixelbotId - The ID of the PixelBot to assign.
 * @param {string} classId - The ID of the class to assign the PixelBot to.
 * @returns {Promise<void>}
 */
async function assignPixelBotToClass(pixelbotId, classId) {
  // WHAT: Links a PixelBot to a Class.
  // WHY:  This makes the bot available to all students in that class.
  if (!pixelbotId || !classId) {
    throw new Error("PixelBot ID and Class ID are required.");
  }
  const pixelbotRef = doc(db, 'pixelbots', pixelbotId);
  await updateDoc(pixelbotRef, {
    classId: classId
  });
}

/**
 * Creates a new PixelBot configuration
 * 
 * @param {Object} pixelbotData - PixelBot configuration
 * @param {string} pixelbotData.name - PixelBot display name
 * @param {string} pixelbotData.topic - Subject area
 * @param {string} pixelbotData.instructions - AI instructions
 * @param {number} pixelbotData.teacherId - Creator teacher ID
 * @returns {Promise<Object>} Created PixelBot with generated ID
 */
async function createPixelBot(pixelbotData) {
  // WHAT: Creates a new object for the PixelBot, adding a creation timestamp and default values.
  // WHY:  This ensures all new PixelBots have a consistent structure in the database.
  // WHAT: Prepares the new Bot's data.
  // WHY:  We set default values like 'mastery: 0' so the bot starts fresh.
  const newPixelBot = {
    ...pixelbotData,
    createdAt: new Date().toISOString(),
    assignedStudents: 0,
    mastery: 0
  };

  // WHAT: Adds the new object as a new document in the 'pixelbots' collection.
  // WHY:  `addDoc` is used because we want Firestore to automatically generate a unique ID for this new PixelBot.
  // HOW:  It returns a reference to the new document, from which we can get the ID. We then return the complete object, including the new ID.
  // WHAT: Saves it to the database.
  // HOW:  `addDoc` automatically creates a unique ID (like '7f8a9s7d') for the bot.
  const docRef = await addDoc(collection(db, 'pixelbots'), newPixelBot);
  return { id: docRef.id, ...newPixelBot };
}

/**
 * Orchestrates the creation of a new PixelBot by generating its prompt via a Cloud Function.
 * This is the new entry point for the "Create PixelBot" UI.
 *
 * @param {Object} builderData - The raw data from the teacher's builder UI.
 * @param {string} builderData.subject - The subject of the new bot.
 * @param {string} builderData.difficulty - The difficulty level.
 * @param {string} builderData.style - The teaching style.
 * @param {string} builderData.teacherId - The ID of the creator.
 * @returns {Promise<Object>} The fully created PixelBot object with its generated instructions.
 */
async function generateAndCreatePixelBot(builderData) {
  // Dynamically import the functions instance to call the generator.
  // WHAT: This is the "Magic" function.
  // WHY:  Teachers just type "Math, Hard, Visual". We need to turn that into a complex AI prompt.
  // HOW:  We call a Cloud Function (a server-side script) to generate the text.
  
  // Dynamically import to ensure we have the latest connection.
  const { functions } = await import('./firebase');
  const generatePromptFn = httpsCallable(functions, 'generatePixelBotPrompt');

  // 1. Call the Cloud Function to generate the instructions.
  // 1. Ask the AI Generator to write the instructions.
  const result = await generatePromptFn(builderData);
  const generatedInstructions = result.data.instructions;

  // 2. Call the original createPixelBot function with the complete data.
  // 2. Save the new Bot with these smart instructions.
  const pixelbotData = { ...builderData, instructions: generatedInstructions, name: `${builderData.subject} Mentor` };
  
  return await createPixelBot(pixelbotData);
}

/**
 * Fetches student roster with performance metrics
 * 
 * @param {number} [teacherId] - Optional filter by teacher
 * @returns {Promise<Array<Object>>} Array of student profiles
 */
async function getStudents(teacherId = null) {
  const studentsRef = collection(db, 'users');
  let q;

  // WHAT IF: A Teacher asks?
  // ACTION: Show only THEIR students.
  if (teacherId) {
    // WHAT: For a teacher, create a query to find users assigned to them.
    // WHY:  This is a more direct and efficient query that only requires a single-field index on `teacherId`, which Firestore creates automatically. It implicitly finds students, as only they have this field.
    // HOW:  It uses a single `where` clause on the `teacherId` field.
    q = query(studentsRef, where('teacherId', '==', teacherId));
  } else {
    // WHAT: For an admin (no teacherId provided), create a query to find all student users.
    // WHY:  The admin needs a complete list of all students on the platform.
    // HOW:  It uses a `where` clause on the `role` field.
    // WHAT IF: An Admin asks?
    // ACTION: Show ALL students in the system.
    q = query(studentsRef, where('role', '==', 'student'));
  }
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Logs system events for debugging and analytics
 * 
 * Tracks BKT updates, LLM evaluations, and significant system events.
 * Used for:
 * - Real-time system monitoring
 * - Post-session analytics
 * - Debugging learning algorithms
 * 
 * @param {Object} logData - Log entry data
 * @param {string} logData.type - Log type (BKT_UPDATE, LLM_EVAL, ERROR, etc.)
 * @param {string} logData.message - Human-readable log message
 * @param {Object} [logData.metadata] - Additional structured data
 * @returns {Promise<Object>} Log confirmation
 */
async function logSystemEvent(logData) {
  // WHAT: Creates a log entry object, adding a server-side timestamp.
  // WHY:  Ensures all logs have a consistent and reliable timestamp.
  // WHAT: Records an event (like "User answered question").
  // WHY:  Helps us debug issues and analyze learning patterns later.
  const logEntry = {
    ...logData,
    timestamp: new Date().toISOString()
  };
  // WHAT: Logs the event to the local console for real-time debugging during development.
  
  // HOW: Print to console for developers, save to database for history.
  console.log('[System Log]', logEntry);
  // WHAT: Saves the log entry to a 'systemLogs' collection in Firestore.
  // WHY:  Provides a persistent audit trail for later analysis and debugging.
  await addDoc(collection(db, 'systemLogs'), logEntry);
  return { status: "logged", entry: logEntry };
}

/**
 * Retrieves the chat history for a specific user and PixelBot.
 * 
 * @param {string} userId - The user's unique ID.
 * @param {string} pixelbotId - The PixelBot's unique ID.
 * @returns {Promise<Array<Object>>} The array of chat messages.
 */
async function getChatHistory(userId, pixelbotId) {
  try {
    const storageKey = `progress_${userId}_${pixelbotId}`;
    
    // 1. Fetch legacy array history (Backward Compatibility)
    let legacyMessages = [];
    const progress = await loadStudentProgress(userId, pixelbotId);
    if (progress?.chatHistory) {
      legacyMessages = progress.chatHistory;
    }

    // 2. Fetch new subcollection history (Scalable Storage)
    const messagesRef = collection(db, 'studentProgress', storageKey, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));
    const querySnapshot = await getDocs(q);
    const newMessages = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // 3. Merge them
    return [...legacyMessages, ...newMessages];
  } catch (error) {
    console.error("Error fetching chat history:", error);
    if (error.code === 'permission-denied') {
      console.warn("⚠️ Security Rule Error: Ensure Firestore rules allow read/write to 'studentProgress/{id}/messages'");
    }
    return [];
  }
}

/**
 * Saves a chat message to the persistence layer by appending it to the
 * chatHistory array in the corresponding studentProgress document.
 * 
 * NOTE: For very long conversations, a subcollection-based approach would be
 * more scalable than using `arrayUnion`, as this method rewrites the entire
 * chatHistory array on every new message.
 *
 * @param {string} userId The user's unique ID.
 * @param {string} pixelbotId The PixelBot's unique ID.
 * @param {Object} messageData The chat message object, e.g., { role: 'user', content: 'Hello' }.
 * Saves a chat message to the persistence layer.
 * @returns {Promise<Object>} A confirmation object.
 */
async function saveChatMessage(userId, pixelbotId, messageData) {
  // WHAT: Constructs the unique document key for the student's progress.
  // WHAT: Finds the student's progress file.
  const storageKey = `progress_${userId}_${pixelbotId}`;
  
  // WHAT: Enriches the message object with a timestamp before saving.
  // WHAT: Adds a timestamp to the message.
  const messageToSave = {
    ...messageData,
    timestamp: new Date().toISOString()
  };

  try {
    // WHAT: Saves to a subcollection to avoid the 1MB document limit.
    // WHY:  Scalability. Subcollections can hold infinite messages.
    const messagesRef = collection(db, 'studentProgress', storageKey, 'messages');
    const docRef = await addDoc(messagesRef, messageToSave);
    
    return { 
      status: "ok", 
      message: { id: docRef.id, ...messageToSave }
    };
  } catch (error) {
    console.error("Failed to save chat message:", error);
    if (error.code === 'permission-denied') {
      console.warn("⚠️ Security Rule Error: Ensure Firestore rules allow read/write to 'studentProgress/{id}/messages'");
    }
    return { status: "error", error: error.message };
  }
}

/**
 * Calls the secure Cloud Function to create a new user.
 * @param {Object} userData - The new user's data (name, email, password, role, teacherId).
 * @returns {Promise<Object>} A confirmation object from the backend.
 */
async function createUser(userData) {
  // WHAT: This function calls a secure backend function (a Cloud Function) to create a new user.
  // WHY:  Creating users directly from the client-side app is a major security risk. Anyone could create an admin account.
  //       By using a Cloud Function, we ensure that only an already-authenticated admin can create new users, as verified by our backend security rules.
  // HOW:  It uses `httpsCallable` from the Firebase Functions SDK to securely call the 'createUser' function deployed on Firebase's servers.

  // Dynamically import the functions instance to avoid circular dependencies if needed.
  // WHAT: Asks the server to create a new account.
  // WHY:  Security. We don't let the web app create users directly, or anyone could make themselves an Admin.
  // HOW:  We call a Cloud Function (`createUser`) which checks if the requester is an Admin before allowing it.
  
  const { functions } = await import('./firebase');
  // Get a reference to the specific Cloud Function we want to call.
  const createUserFn = httpsCallable(functions, 'createUser');
  try {
    // Execute the function, passing the new user's data.
    const result = await createUserFn(userData);
    return result.data;
  } catch (error) {
    console.error("Error calling createUser function:", error);
    throw error; // Re-throw to be handled by the UI
    // WHAT IF: The server says "Permission Denied"?
    // ACTION: We pass that error to the UI to show "You are not allowed to do this."
    throw error;
  }
}

/**
 * Calls the secure Cloud Function to update a user's details.
 * @param {Object} userData - The user's updated data (uid, name, email, role).
 * @returns {Promise<Object>} A confirmation object from the backend.
 */
async function updateUser(userData) {
  // WHAT: Asks the server to update a user's name or email.
  // WHY:  Similar to creating users, modifying accounts is a sensitive action restricted to Admins.
  const { functions } = await import('./firebase');
  const updateUserFn = httpsCallable(functions, 'updateUser');
  try {
    const result = await updateUserFn(userData);
    return result.data;
  } catch (error) {
    console.error("Error calling updateUser function:", error);
    throw error;
  }
}

/**
 * Calls the secure Cloud Function to reset a user's password.
 * @param {string} uid - The UID of the user.
 * @param {string} newPassword - The new temporary password.
 * @returns {Promise<Object>} A confirmation object from the backend.
 */
async function resetPassword(uid, newPassword) {
  // WHAT: Asks the server to force-change a user's password.
  // WHY:  Useful if a student forgets their password. Only Admins can do this.
  const { functions } = await import('./firebase');
  const resetPasswordFn = httpsCallable(functions, 'resetPassword');
  try {
    const result = await resetPasswordFn({ uid, newPassword });
    return result.data;
  } catch (error) {
    console.error("Error calling resetPassword function:", error);
    throw error;
  }
}

/**
 * Calls the secure Cloud Function to delete a user.
 * @param {string} uid - The UID of the user to delete.
 * @returns {Promise<Object>} A confirmation object from the backend.
 */
async function deleteUser(uid) {
  const { functions } = await import('./firebase');
  const deleteUserFn = httpsCallable(functions, 'deleteUser');
  try {
    const result = await deleteUserFn({ uid });
    return result.data;
  } catch (error) {
    console.error("Error calling deleteUser function:", error);
    throw error;
  }
}

/**
 * Sends a password reset email to the user.
 * @param {string} email - The user's email address.
 * @returns {Promise<Object>} Confirmation message.
 */
async function sendPasswordResetLink(email) {
  try {
    await sendPasswordResetEmail(auth, email);
    return { message: "Password reset email sent. Please check your inbox." };
  } catch (error) {
    console.error("Error sending password reset email:", error);
    throw error;
  }
}

/**
 * Sends a notification/message from a teacher to a student or a class.
 * @param {Object} notificationData - The notification payload.
 * @param {string} notificationData.teacherId - The sender's UID.
 * @param {string} notificationData.teacherName - The sender's name.
 * @param {string} notificationData.type - 'message' or 'revision_request'.
 * @param {string} notificationData.content - The message text.
 * @param {string} notificationData.recipientType - 'student' or 'class'.
 * @param {string} notificationData.recipientId - The UID/ID of the recipient.
 * @returns {Promise<Object>} The created notification object.
 */
async function sendNotification(notificationData) {
  // WHAT: Creates a "Message" record in the database.
  // WHY:  This will show up in the student's notification inbox.
  const newNotification = {
    ...notificationData,
    createdAt: new Date().toISOString(),
    read: false,
  };
  const docRef = await addDoc(collection(db, 'notifications'), newNotification);
  return { id: docRef.id, ...newNotification };
}

export {
  authenticateUser,
  saveStudentProgress,
  loadStudentProgress,
  getPixelBots,
  createPixelBot,
  generateAndCreatePixelBot, // Export the new orchestrator function
  getStudents,
  createClass,
  getClasses,
  updateClassRoster,
  assignPixelBotToClass,
  getTeachers,
  logSystemEvent,
  getChatHistory,
  saveChatMessage,
  createUser,
  updateUser,
  resetPassword,
  deleteUser,
  sendNotification,
  sendPasswordResetLink
};