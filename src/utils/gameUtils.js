import { db } from "../db";

export function shuffleArray(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export const updateWordExposure = async (
  word,
  isCorrect,
  gameType = "flashcards"
) => {
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
        conjugation: { correct: 0, total: 0 },
      };
    }

    if (updatedWord.gamePerformance[gameType]) {
      updatedWord.gamePerformance[gameType].total++;
      if (isCorrect) updatedWord.gamePerformance[gameType].correct++;
    }

    const previousLevel = word.exposureLevel || "new";
    updatedWord.exposureLevel = calculateExposureLevel(updatedWord);
    const newLevel = updatedWord.exposureLevel;

    await db.allWords.put(updatedWord);
    console.log(
      `${gameType}: Updated "${word.spanish}" exposure to ${
        updatedWord.exposureLevel
      } (${isCorrect ? "correct" : "incorrect"})`
    );

    // LEVEL-UP DETECTION: Check if level increased
    const levelProgression = ["new", "learning", "familiar", "mastered"];
    const previousIndex = levelProgression.indexOf(previousLevel);
    const newIndex = levelProgression.indexOf(newLevel);
    const hasLeveledUp = newIndex > previousIndex;

    return {
      ...updatedWord,
      hasLeveledUp,
      previousLevel,
      celebrationType: hasLeveledUp ? newLevel : null,
    };
  } catch (error) {
    console.error(`${gameType}: Failed to update word exposure:`, error);
    return word;
  }
};

function calculateExposureLevel(word) {
  if (word.exposureLevel === "known") return "known";

  const accuracy =
    word.timesStudied > 0 ? word.timesCorrect / word.timesStudied : 0;
  const timesStudied = word.timesStudied || 0;

  if (timesStudied === 0) return "new";
  if (timesStudied < 2 || accuracy < 0.5) return "learning"; // 2 attempts to graduate from learning
  if (timesStudied < 4 || accuracy < 0.8) return "familiar"; // 4 attempts to graduate to mastered
  return "mastered";
}
