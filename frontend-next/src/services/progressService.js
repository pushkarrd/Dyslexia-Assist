// Firestore service for tracking and reading progress data — with real-time listeners
import { db } from './firebase';
import {
    collection, addDoc, getDocs, query, where, limit,
    serverTimestamp, onSnapshot
} from 'firebase/firestore';

// ────────────── WRITE: log events ──────────────

// Log a reading session
export async function logReadingSession(userId, data) {
    try {
        await addDoc(collection(db, 'readingSessions'), {
            userId,
            textLength: data.textLength || 0,
            readingTime: data.readingTime || 0,    // seconds
            reReadingCount: data.reReadingCount || 0,
            difficultyScore: data.difficultyScore || 0,
            createdAt: serverTimestamp(),
        });
    } catch (error) {
        console.error('Error logging reading session:', error);
    }
}

// Log a quiz attempt
export async function logQuizAttempt(userId, data) {
    try {
        await addDoc(collection(db, 'quizAttempts'), {
            userId,
            score: data.score,
            totalQuestions: data.totalQuestions,
            topic: data.topic || 'general',
            createdAt: serverTimestamp(),
        });
    } catch (error) {
        console.error('Error logging quiz attempt:', error);
    }
}

// Log handwriting upload
export async function logHandwritingUpload(userId, data) {
    try {
        await addDoc(collection(db, 'handwritingUploads'), {
            userId,
            errorCount: data.errorCount || 0,
            score: data.score || 0,
            errors: data.errors || [],
            createdAt: serverTimestamp(),
        });
    } catch (error) {
        console.error('Error logging handwriting upload:', error);
    }
}

// Log a content generation event
export async function logContentGeneration(userId, data) {
    try {
        await addDoc(collection(db, 'contentGenerations'), {
            userId,
            inputLength: data.inputLength || 0,
            types: data.types || [],  // ['notes','flashcards','quiz','mindmap','audio']
            createdAt: serverTimestamp(),
        });
    } catch (error) {
        console.error('Error logging content generation:', error);
    }
}

// Log a lecture session (recording + processing)
export async function logLectureSession(userId, data) {
    try {
        await addDoc(collection(db, 'lectureSessions'), {
            userId,
            lectureId: data.lectureId || '',
            duration: data.duration || 0,   // seconds
            createdAt: serverTimestamp(),
        });
    } catch (error) {
        console.error('Error logging lecture session:', error);
    }
}

// ────────────── READ: one-time fetches ──────────────

export async function getReadingSessions(userId, maxResults = 50) {
    try {
        const q = query(
            collection(db, 'readingSessions'),
            where('userId', '==', userId),
            limit(maxResults)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    } catch (error) {
        console.error('Error getting reading sessions:', error);
        return [];
    }
}

export async function getQuizAttempts(userId, maxResults = 50) {
    try {
        const q = query(
            collection(db, 'quizAttempts'),
            where('userId', '==', userId),
            limit(maxResults)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    } catch (error) {
        console.error('Error getting quiz attempts:', error);
        return [];
    }
}

export async function getHandwritingUploads(userId, maxResults = 50) {
    try {
        const q = query(
            collection(db, 'handwritingUploads'),
            where('userId', '==', userId),
            limit(maxResults)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    } catch (error) {
        console.error('Error getting handwriting uploads:', error);
        return [];
    }
}

export async function getContentGenerations(userId, maxResults = 50) {
    try {
        const q = query(
            collection(db, 'contentGenerations'),
            where('userId', '==', userId),
            limit(maxResults)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    } catch (error) {
        console.error('Error getting content generations:', error);
        return [];
    }
}

export async function getLectureSessions(userId, maxResults = 50) {
    try {
        const q = query(
            collection(db, 'lectureSessions'),
            where('userId', '==', userId),
            limit(maxResults)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    } catch (error) {
        console.error('Error getting lecture sessions:', error);
        return [];
    }
}

// ────────────── REAL-TIME: Firestore onSnapshot listeners ──────────────

function buildQuery(colName, userId, maxResults = 50) {
    return query(
        collection(db, colName),
        where('userId', '==', userId),
        limit(maxResults)
    );
}

/**
 * Subscribe to real-time stats for a user.
 * Returns an unsubscribe function to tear down all listeners.
 * `callback(stats)` is called every time any collection changes.
 */
export function subscribeToUserStats(userId, callback, onError) {
    if (!userId) return () => { };

    // Mutable state across listeners
    let readings = [];
    let quizzes = [];
    let handwriting = [];
    let contentGens = [];
    let lectures = [];

    const computeAndNotify = () => {
        const totalReadingTime = readings.reduce((s, r) => s + (r.readingTime || 0), 0);
        const avgQuizScore = quizzes.length > 0
            ? Math.round(quizzes.reduce((s, q) => s + (q.score / q.totalQuestions * 100), 0) / quizzes.length)
            : 0;
        const totalHandwritingErrors = handwriting.reduce((s, h) => s + (h.errorCount || 0), 0);

        // Total hours = lecture duration + reading time (in hours)
        const totalLectureSeconds = lectures.reduce((s, l) => s + (l.duration || 0), 0);
        const totalHours = ((totalReadingTime + totalLectureSeconds) / 3600).toFixed(1);

        callback({
            readings,
            quizzes,
            handwriting,
            contentGens,
            lectures,
            totalReadingTime,
            avgQuizScore,
            totalReadingSessions: readings.length,
            totalQuizzes: quizzes.length,
            totalHandwritingUploads: handwriting.length,
            totalHandwritingErrors,
            totalContentGenerations: contentGens.length,
            totalLectures: lectures.length,
            totalHours: parseFloat(totalHours),
        });
    };

    const handleError = (colName, error) => {
        console.warn(`Firestore listener error for ${colName}:`, error.code, error.message);
        // Don't kill all stats — just skip this collection and notify with what we have
        computeAndNotify();
    };

    const unsubs = [];

    try {
        const collections = [
            { name: 'readingSessions', setter: (docs) => { readings = docs; } },
            { name: 'quizAttempts', setter: (docs) => { quizzes = docs; } },
            { name: 'handwritingUploads', setter: (docs) => { handwriting = docs; } },
            { name: 'contentGenerations', setter: (docs) => { contentGens = docs; } },
            { name: 'lectureSessions', setter: (docs) => { lectures = docs; } },
        ];

        for (const col of collections) {
            try {
                unsubs.push(onSnapshot(
                    buildQuery(col.name, userId),
                    (snap) => {
                        const sorted = snap.docs
                            .map(d => ({ id: d.id, ...d.data() }))
                            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                        col.setter(sorted);
                        computeAndNotify();
                    },
                    (err) => handleError(col.name, err)
                ));
            } catch (err) {
                // If specific collection fails (e.g. missing index), use getDocs fallback
                console.warn(`Real-time listener failed for ${col.name}, using one-time fetch`);
                getDocs(buildQuery(col.name, userId))
                    .then(snap => {
                        col.setter(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                        computeAndNotify();
                    })
                    .catch(() => {
                        // collection may not exist yet — still notify so loading clears
                        computeAndNotify();
                    });
            }
        }
    } catch (error) {
        console.error('Error setting up real-time listeners:', error);
        if (onError) onError(error);
    }

    return () => unsubs.forEach(fn => fn());
}

// Legacy one-time fetch (kept for backward compat)
export async function getUserStats(userId) {
    const [readings, quizzes, handwriting, contentGens, lectures] = await Promise.all([
        getReadingSessions(userId, 50),
        getQuizAttempts(userId, 50),
        getHandwritingUploads(userId, 50),
        getContentGenerations(userId, 50),
        getLectureSessions(userId, 50),
    ]);

    const totalReadingTime = readings.reduce((sum, s) => sum + (s.readingTime || 0), 0);
    const avgQuizScore = quizzes.length > 0
        ? quizzes.reduce((sum, q) => sum + (q.score / q.totalQuestions * 100), 0) / quizzes.length
        : 0;
    const totalHandwritingErrors = handwriting.reduce((sum, h) => sum + (h.errorCount || 0), 0);
    const totalLectureSeconds = lectures.reduce((s, l) => s + (l.duration || 0), 0);
    const totalHours = ((totalReadingTime + totalLectureSeconds) / 3600).toFixed(1);

    return {
        readings,
        quizzes,
        handwriting,
        contentGens,
        lectures,
        totalReadingTime,
        avgQuizScore: Math.round(avgQuizScore),
        totalReadingSessions: readings.length,
        totalQuizzes: quizzes.length,
        totalHandwritingUploads: handwriting.length,
        totalHandwritingErrors,
        totalContentGenerations: contentGens.length,
        totalLectures: lectures.length,
        totalHours: parseFloat(totalHours),
    };
}
