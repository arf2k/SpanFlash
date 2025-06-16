import { db } from "../db";

// Shared shuffle function (unchanged)
export function shuffleArray(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

//  Update word exposure (replaces updateWordLeitnerData)
export const updateWordExposure = async (word, isCorrect, gameType = "flashcards") => {
  try {
    // Update study tracking
    const updatedWord = {
      ...word,
      timesStudied: (word.timesStudied || 0) + 1,
      timesCorrect: (word.timesCorrect || 0) + (isCorrect ? 1 : 0),
      lastStudied: Date.now(),
    };

    // Update game-specific performance
    if (!updatedWord.gamePerformance) {
      updatedWord.gamePerformance = {
        flashcards: { correct: 0, total: 0 },
        matching: { correct: 0, total: 0 },
        fillInBlank: { correct: 0, total: 0 },
        conjugation: { correct: 0, total: 0 }
      };
    }

    if (updatedWord.gamePerformance[gameType]) {
      updatedWord.gamePerformance[gameType].total++;
      if (isCorrect) updatedWord.gamePerformance[gameType].correct++;
    }

    // Calculate exposure level
    updatedWord.exposureLevel = calculateExposureLevel(updatedWord);

    await db.allWords.put(updatedWord);
    console.log(
      `${gameType}: Updated "${word.spanish}" exposure to ${updatedWord.exposureLevel} (${
        isCorrect ? "correct" : "incorrect"
      })`
    );
    return updatedWord;
  } catch (error) {
    console.error(`${gameType}: Failed to update word exposure:`, error);
    return word;
  }
};

// Helper: Calculate exposure level based on performance
function calculateExposureLevel(word) {
  if (word.exposureLevel === 'known') return 'known'; 
  
  const accuracy = word.timesStudied > 0 ? (word.timesCorrect / word.timesStudied) : 0;
  const timesStudied = word.timesStudied || 0;
  
  if (timesStudied === 0) return 'new';
  if (timesStudied < 3 || accuracy < 0.5) return 'learning';
  if (timesStudied < 8 || accuracy < 0.8) return 'familiar';
  return 'mastered';
}