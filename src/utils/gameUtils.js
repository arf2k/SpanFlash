import { db } from "../db";

// Leitner System Constants
export const MAX_LEITNER_BOX = 7;
export const LEITNER_SCHEDULE_IN_DAYS = [0, 1, 2, 4, 8, 16, 32, 90];

// Shared shuffle function
export function shuffleArray(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

// Shared Leitner update function
export const updateWordLeitnerData = async (word, isCorrect, gameType = "Game") => {
  const newBox = isCorrect
    ? Math.min((word.leitnerBox || 0) + 1, MAX_LEITNER_BOX)
    : 1;

  const now = Date.now();
  const intervalInDays = LEITNER_SCHEDULE_IN_DAYS[newBox] || 1;
  const intervalInMs = intervalInDays * 24 * 60 * 60 * 1000;
  const newDueDate = now + intervalInMs;

  const updatedWord = {
    ...word,
    leitnerBox: newBox,
    lastReviewed: now,
    dueDate: newDueDate,
  };

  try {
    await db.allWords.put(updatedWord);
    console.log(
      `${gameType}: Updated "${word.spanish}" to Box ${newBox} (${
        isCorrect ? "correct" : "incorrect"
      })`
    );
    return updatedWord;
  } catch (error) {
    console.error(`${gameType}: Failed to update word with Leitner data:`, error);
    return word; 
  }
};