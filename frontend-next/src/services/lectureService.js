// Firestore service for managing lecture recordings
// Handles CRUD operations for lecture transcriptions and processed data
// Collection: lectures
// Document structure: {
//   userId: string,
//   transcription: string,
//   simpleText: string | null,
//   detailedSteps: string | null,
//   mindMap: string | null,
//   summary: string | null,
//   createdAt: timestamp,
//   updatedAt: timestamp,
//   status: 'recording' | 'processing' | 'completed'
// }

import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from './firebase';

const LECTURES_COLLECTION = 'lectures';

/**
 * Create a new lecture document with transcription
 * @param {string} userId - User ID
 * @param {string} transcription - Raw transcription text
 * @returns {Promise<string>} - Document ID
 */
export async function createLecture(userId, transcription) {
  try {
    const lectureRef = doc(collection(db, LECTURES_COLLECTION));
    const lectureData = {
      userId,
      transcription,
      simpleText: null,
      detailedSteps: null,
      mindMap: null,
      summary: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      status: 'processing'
    };
    
    await setDoc(lectureRef, lectureData);
    return lectureRef.id;
  } catch (error) {
    console.error('Error creating lecture:', error);
    throw error;
  }
}

/**
 * Get a specific lecture by ID
 * @param {string} lectureId - Document ID
 * @returns {Promise<Object>} - Lecture data
 */
export async function getLecture(lectureId) {
  try {
    const lectureRef = doc(db, LECTURES_COLLECTION, lectureId);
    const lectureSnap = await getDoc(lectureRef);
    
    if (lectureSnap.exists()) {
      return { id: lectureSnap.id, ...lectureSnap.data() };
    } else {
      throw new Error('Lecture not found');
    }
  } catch (error) {
    console.error('Error getting lecture:', error);
    throw error;
  }
}

/**
 * Get the most recent lecture for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} - Latest lecture data or null
 */
export async function getLatestLecture(userId) {
  try {
    const q = query(
      collection(db, LECTURES_COLLECTION),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting latest lecture:', error);
    throw error;
  }
}

/**
 * Update processed data for a lecture
 * @param {string} lectureId - Document ID
 * @param {Object} processedData - Processed text data
 * @param {string} processedData.simpleText - NeuroLex text
 * @param {string} processedData.detailedSteps - Detailed steps
 * @param {string} processedData.mindMap - Mind map text
 * @param {string} processedData.summary - Summary text
 */
export async function updateLectureProcessedData(lectureId, processedData) {
  try {
    const lectureRef = doc(db, LECTURES_COLLECTION, lectureId);
    const updateData = {
      ...processedData,
      updatedAt: serverTimestamp(),
      status: 'completed'
    };
    
    await updateDoc(lectureRef, updateData);
  } catch (error) {
    console.error('Error updating lecture processed data:', error);
    throw error;
  }
}

/**
 * Update specific field in lecture
 * @param {string} lectureId - Document ID
 * @param {string} field - Field name
 * @param {any} value - Field value
 */
export async function updateLectureField(lectureId, field, value) {
  try {
    const lectureRef = doc(db, LECTURES_COLLECTION, lectureId);
    await updateDoc(lectureRef, {
      [field]: value,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error(`Error updating lecture field ${field}:`, error);
    throw error;
  }
}

/**
 * Delete a lecture document
 * @param {string} lectureId - Document ID
 */
export async function deleteLecture(lectureId) {
  try {
    const lectureRef = doc(db, LECTURES_COLLECTION, lectureId);
    await deleteDoc(lectureRef);
  } catch (error) {
    console.error('Error deleting lecture:', error);
    throw error;
  }
}

/**
 * Get all lectures for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Array of lecture objects
 */
export async function getUserLectures(userId) {
  try {
    const q = query(
      collection(db, LECTURES_COLLECTION),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const lectures = [];
    
    querySnapshot.forEach((doc) => {
      lectures.push({ id: doc.id, ...doc.data() });
    });
    
    return lectures;
  } catch (error) {
    console.error('Error getting user lectures:', error);
    throw error;
  }
}
