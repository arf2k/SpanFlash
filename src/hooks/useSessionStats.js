import { useState, useEffect, useRef } from 'react';
import { db } from '../db';

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
      conjugation: { correct: 0, incorrect: 0 }
    }
  });

  const sessionInitialized = useRef(false);

  // Initialize session on first load
  useEffect(() => {
    if (!sessionInitialized.current) {
      startNewSession();
      sessionInitialized.current = true;
    }
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
        conjugation: { correct: 0, incorrect: 0 }
      }
    };
    setSessionStats(newSession);
    
    // Save to IndexedDB
    db.appState.put({ id: 'currentSession', ...newSession });
    console.log('Session started:', new Date(now).toLocaleTimeString());
  };

  const recordAnswer = async (isCorrect, gameType = 'flashcards') => {
    const updatedStats = {
      ...sessionStats,
      cardsReviewed: sessionStats.cardsReviewed + 1,
      correctAnswers: sessionStats.correctAnswers + (isCorrect ? 1 : 0),
      incorrectAnswers: sessionStats.incorrectAnswers + (isCorrect ? 0 : 1),
      gameTypeStats: {
        ...sessionStats.gameTypeStats,
        [gameType]: {
          correct: sessionStats.gameTypeStats[gameType].correct + (isCorrect ? 1 : 0),
          incorrect: sessionStats.gameTypeStats[gameType].incorrect + (isCorrect ? 0 : 1)
        }
      }
    };
    
    setSessionStats(updatedStats);
    
    // Save to IndexedDB
    try {
      await db.appState.put({ id: 'currentSession', ...updatedStats });
    } catch (error) {
      console.error('Failed to save session stats:', error);
    }
  };

  const getSessionAccuracy = () => {
    const total = sessionStats.correctAnswers + sessionStats.incorrectAnswers;
    return total > 0 ? Math.round((sessionStats.correctAnswers / total) * 100) : 0;
  };

  const getSessionDuration = () => {
    if (!sessionStats.sessionStartTime) return '0 min';
    const duration = Date.now() - sessionStats.sessionStartTime;
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return minutes > 0 ? `${minutes} min` : `${seconds} sec`;
  };

  return {
    sessionStats,
    recordAnswer,
    startNewSession,
    getSessionAccuracy,
    getSessionDuration,
  };
}