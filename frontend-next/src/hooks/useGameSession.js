import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import axios from "axios";
import { calculateNextDifficulty } from "../utils/difficultyEngine";
import { auth } from "../services/firebase";
import { logQuizAttempt } from "../services/progressService";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function useGameSession(gameType, userId) {
  const [sessionId, setSessionId] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [attempts, setAttempts] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [reactionTimes, setReactionTimes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const difficultyRef = useRef(1);
  const activeRef = useRef(false);
  const endingRef = useRef(false);

  const accuracy = useMemo(
    () => (attempts > 0 ? correctCount / attempts : 0),
    [correctCount, attempts]
  );

  const avgReactionTime = useMemo(() => {
    if (reactionTimes.length === 0) return 0;
    return Math.round(
      reactionTimes.reduce((s, t) => s + t, 0) / reactionTimes.length
    );
  }, [reactionTimes]);

  const startSession = useCallback(
    async (difficulty = 1) => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await axios.post(`${API}/api/games/session/start`, {
          game_type: gameType,
          user_id: userId,
          difficulty,
        });
        const id = data.session_id;
        setSessionId(id);
        setStartTime(Date.now());
        setAttempts(0);
        setCorrectCount(0);
        setReactionTimes([]);
        difficultyRef.current = difficulty;
        activeRef.current = true;
        endingRef.current = false;
        return id;
      } catch (err) {
        setError(err.response?.data?.detail || err.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [gameType, userId]
  );

  const recordAttempt = useCallback((isCorrect, reactionTimeMs) => {
    setAttempts((a) => a + 1);
    if (isCorrect) setCorrectCount((c) => c + 1);
    if (typeof reactionTimeMs === "number" && reactionTimeMs > 0) {
      setReactionTimes((rt) => [...rt, reactionTimeMs]);
    }
  }, []);

  const endSession = useCallback(async () => {
    if (!activeRef.current || endingRef.current) return null;
    endingRef.current = true;
    activeRef.current = false;
    setLoading(true);
    setError(null);

    const duration = startTime ? Math.round((Date.now() - startTime) / 1000) : 0;
    const finalAccuracy = attempts > 0 ? correctCount / attempts : 0;
    const finalAvgRt =
      reactionTimes.length > 0
        ? Math.round(reactionTimes.reduce((s, t) => s + t, 0) / reactionTimes.length)
        : 0;
    const nextDifficulty = calculateNextDifficulty(
      finalAccuracy,
      finalAvgRt,
      difficultyRef.current,
      gameType
    );

    const payload = {
      session_id: sessionId,
      game_type: gameType,
      user_id: userId,
      difficulty: difficultyRef.current,
      attempts,
      correct_count: correctCount,
      accuracy: finalAccuracy,
      avg_reaction_time_ms: finalAvgRt,
      reaction_times: reactionTimes,
      duration_seconds: duration,
      next_difficulty: nextDifficulty,
    };

    try {
      const { data } = await axios.post(`${API}/api/games/session/end`, payload);
      // Write score to Firestore for analytics
      const uid = auth.currentUser?.uid;
      if (uid && attempts > 0) {
        logQuizAttempt(uid, {
          score: correctCount,
          totalQuestions: attempts,
          topic: gameType,
        }).catch(() => {});
      }
      setSessionId(null);
      return { nextDifficulty, summary: data };
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
      // Still write score to Firestore even if backend call fails
      const uid = auth.currentUser?.uid;
      if (uid && attempts > 0) {
        logQuizAttempt(uid, {
          score: correctCount,
          totalQuestions: attempts,
          topic: gameType,
        }).catch(() => {});
      }
      setSessionId(null);
      return { nextDifficulty, summary: payload };
    } finally {
      setLoading(false);
      endingRef.current = false;
    }
  }, [sessionId, gameType, userId, startTime, attempts, correctCount, reactionTimes]);

  // Auto-end on unmount if session is active
  useEffect(() => {
    return () => {
      if (activeRef.current && !endingRef.current) {
        endingRef.current = true;
        activeRef.current = false;
        const finalAcc = attempts > 0 ? correctCount / attempts : 0;
        const finalRt =
          reactionTimes.length > 0
            ? Math.round(reactionTimes.reduce((s, t) => s + t, 0) / reactionTimes.length)
            : 0;
        axios
          .post(`${API}/api/games/session/end`, {
            session_id: sessionId,
            game_type: gameType,
            user_id: userId,
            difficulty: difficultyRef.current,
            attempts,
            correct_count: correctCount,
            accuracy: finalAcc,
            avg_reaction_time_ms: finalRt,
            reaction_times: reactionTimes,
            duration_seconds: startTime ? Math.round((Date.now() - startTime) / 1000) : 0,
            next_difficulty: calculateNextDifficulty(finalAcc, finalRt, difficultyRef.current, gameType),
          })
          .catch(() => { });
      }
    };
  }, [sessionId, gameType, userId, startTime, attempts, correctCount, reactionTimes]);

  return {
    sessionId,
    startTime,
    attempts,
    correctCount,
    reactionTimes,
    accuracy,
    avgReactionTime,
    loading,
    error,
    startSession,
    recordAttempt,
    endSession,
  };
}