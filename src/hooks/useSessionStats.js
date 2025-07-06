import { useState, useEffect, useRef } from "react";
import { db } from "../db";

export function useSessionStats() {
  const [sessionStats, setSessionStats] = useState({
    sessionStartTime: null,
    cardsReviewed: 0,
    correctAnswers: 0,
    incorrectAnswers: 0,
    gameTypeStats: {
      flashcards: { correct: 0, incorrect: 0 },
      matching: { correct: 0, incorrect: 0 },
      fillInBlank: { correct: 0, incorrect: 0 },
      conjugation: { correct: 0, incorrect: 0 },
    },
  });

  const [todaysStats, setTodaysStats] = useState({
    date: null,
    cardsReviewed: 0,
    correctAnswers: 0,
    incorrectAnswers: 0,
    gameTypeStats: {
      flashcards: { correct: 0, incorrect: 0 },
      matching: { correct: 0, incorrect: 0 },
      fillInBlank: { correct: 0, incorrect: 0 },
      conjugation: { correct: 0, incorrect: 0 },
    },
  });

  const [viewMode, setViewMode] = useState('session');

  const sessionInitialized = useRef(false);

  const shouldStartNewSession = () => {
    // Check 1: App reload detection
    const wasAppReloaded = !sessionStorage.getItem("appSessionActive");

    // Check 2: Time-based (30+ minutes of inactivity)
    const lastActivity = localStorage.getItem("lastActivityTime");
    const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
    const wasInactive =
      !lastActivity || parseInt(lastActivity) < thirtyMinutesAgo;

    return wasAppReloaded || wasInactive;
  };

  const updateActivity = () => {
    localStorage.setItem("lastActivityTime", Date.now().toString());
    sessionStorage.setItem("appSessionActive", "true");
  };

  useEffect(() => {
    if (!sessionInitialized.current) {
      if (shouldStartNewSession()) {
        startNewSession();
      }
      updateActivity();
      sessionInitialized.current = true;
    }
  }, []);

  useEffect(() => {
  const loadTodaysStats = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const todayData = await db.dailyStats.get(today);
      setTodaysStats(todayData || {
        date: today,
        cardsReviewed: 0,
        correctAnswers: 0,
        incorrectAnswers: 0,
        gameTypeStats: {
          flashcards: { correct: 0, incorrect: 0 },
          matching: { correct: 0, incorrect: 0 },
          fillInBlank: { correct: 0, incorrect: 0 },
          conjugation: { correct: 0, incorrect: 0 },
        },
      });
    } catch (error) {
      console.error("Failed to load today's stats:", error);
    }
  };
  
  loadTodaysStats();
}, []);

  const startNewSession = () => {
    const now = Date.now();
    const newSession = {
      sessionStartTime: now,
      cardsReviewed: 0,
      correctAnswers: 0,
      incorrectAnswers: 0,
      gameTypeStats: {
        flashcards: { correct: 0, incorrect: 0 },
        matching: { correct: 0, incorrect: 0 },
        fillInBlank: { correct: 0, incorrect: 0 },
        conjugation: { correct: 0, incorrect: 0 },
      },
    };
    setSessionStats(newSession);

    // Save to IndexedDB
    db.appState.put({ id: "currentSession", ...newSession });
    console.log("Session started:", new Date(now).toLocaleTimeString());
  };

  const recordAnswer = async (isCorrect, gameType = "flashcards") => {
    updateActivity();

    // Update current session stats
    const updatedStats = {
      ...sessionStats,
      cardsReviewed: sessionStats.cardsReviewed + 1,
      correctAnswers: sessionStats.correctAnswers + (isCorrect ? 1 : 0),
      incorrectAnswers: sessionStats.incorrectAnswers + (isCorrect ? 0 : 1),
      gameTypeStats: {
        ...sessionStats.gameTypeStats,
        [gameType]: {
          correct:
            sessionStats.gameTypeStats[gameType].correct + (isCorrect ? 1 : 0),
          incorrect:
            sessionStats.gameTypeStats[gameType].incorrect +
            (isCorrect ? 0 : 1),
        },
      },
    };

    setSessionStats(updatedStats);

    // Update daily stats
    const today = new Date().toISOString().split("T")[0];
    const updatedDailyStats = {
      date: today,
      cardsReviewed: todaysStats.cardsReviewed + 1,
      correctAnswers: todaysStats.correctAnswers + (isCorrect ? 1 : 0),
      incorrectAnswers: todaysStats.incorrectAnswers + (isCorrect ? 0 : 1),
      gameTypeStats: {
        ...todaysStats.gameTypeStats,
        [gameType]: {
          correct:
            todaysStats.gameTypeStats[gameType].correct + (isCorrect ? 1 : 0),
          incorrect:
            todaysStats.gameTypeStats[gameType].incorrect + (isCorrect ? 0 : 1),
        },
      },
    };

    setTodaysStats(updatedDailyStats);

    // Save to IndexedDB
    try {
      await db.appState.put({ id: "currentSession", ...updatedStats });
      await db.dailyStats.put(updatedDailyStats);
    } catch (error) {
      console.error("Failed to save stats:", error);
    }
  };

  const getSessionAccuracy = () => {
    const total = sessionStats.correctAnswers + sessionStats.incorrectAnswers;
    return total > 0
      ? Math.round((sessionStats.correctAnswers / total) * 100)
      : 0;
  };

  const getSessionDuration = () => {
    if (!sessionStats.sessionStartTime) return "0 min";
    const duration = Date.now() - sessionStats.sessionStartTime;
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return minutes > 0 ? `${minutes} min` : `${seconds} sec`;
  };

  const toggleViewMode = (mode) => {
  setViewMode(mode);
};


  return {
    sessionStats,
     todaysStats,
     viewMode,
     toggleViewMode,
    recordAnswer,
    startNewSession,
    getSessionAccuracy,
    getSessionDuration,
  };
}
