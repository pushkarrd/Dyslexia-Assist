// Backend API service for lecture operations
// Calls Python FastAPI backend with Gemini AI integration

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

/**
 * Create a new lecture with transcription
 */
export async function createLecture(userId, transcription) {
  try {
    const response = await fetch(`${API_BASE_URL}/lectures`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, transcription })
    });

    if (!response.ok) {
      throw new Error(`Failed to create lecture: ${response.statusText}`);
    }

    const data = await response.json();
    return data.id;
  } catch (error) {
    console.error('Error creating lecture:', error);
    throw error;
  }
}

/**
 * Get a specific lecture by ID
 */
export async function getLecture(lectureId) {
  try {
    const response = await fetch(`${API_BASE_URL}/lectures/${lectureId}`);

    if (!response.ok) {
      throw new Error(`Failed to get lecture: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting lecture:', error);
    throw error;
  }
}

/**
 * Get the most recent lecture for a user
 */
export async function getLatestLecture(userId) {
  try {
    const response = await fetch(`${API_BASE_URL}/lectures/user/${userId}/latest`);

    if (!response.ok) {
      throw new Error(`Failed to get latest lecture: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting latest lecture:', error);
    throw error;
  }
}

/**
 * Process lecture transcription through Gemini AI
 */
export async function processLecture(lectureId) {
  try {
    const response = await fetch(`${API_BASE_URL}/lectures/${lectureId}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to process lecture: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error processing lecture:', error);
    throw error;
  }
}

/**
 * Update specific field in lecture
 */
export async function updateLectureField(lectureId, field, value) {
  try {
    const response = await fetch(`${API_BASE_URL}/lectures/${lectureId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ [field]: value })
    });

    if (!response.ok) {
      throw new Error(`Failed to update lecture: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Error updating lecture field ${field}:`, error);
    throw error;
  }
}

/**
 * Delete a lecture
 */
export async function deleteLecture(lectureId) {
  try {
    const response = await fetch(`${API_BASE_URL}/lectures/${lectureId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error(`Failed to delete lecture: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error deleting lecture:', error);
    throw error;
  }
}

/**
 * Get all lectures for a user
 */
export async function getUserLectures(userId) {
  try {
    const response = await fetch(`${API_BASE_URL}/lectures/user/${userId}`);

    if (!response.ok) {
      throw new Error(`Failed to get user lectures: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting user lectures:', error);
    throw error;
  }
}
