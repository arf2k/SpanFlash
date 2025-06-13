import { useState } from 'react';

export function useGameModes() {
  const [isInHardWordsMode, setIsInHardWordsMode] = useState(false);
  const [isMatchingGameModeActive, setIsMatchingGameModeActive] = useState(false);
  const [isFillInTheBlankModeActive, setIsFillInTheBlankModeActive] = useState(false);
  const [isVerbConjugationGameActive, setIsVerbConjugationGameActive] = useState(false);
  const [modeChangeMessage, setModeChangeMessage] = useState("");

  // Helper function to check if any game is active
  const isAnyGameActive = isMatchingGameModeActive || 
                         isFillInTheBlankModeActive || 
                         isVerbConjugationGameActive;

  // Helper function to reset all game modes
  const resetAllGameModes = () => {
    setIsMatchingGameModeActive(false);
    setIsFillInTheBlankModeActive(false);
    setIsVerbConjugationGameActive(false);
  };

  return {
    // State values
    isInHardWordsMode,
    isMatchingGameModeActive,
    isFillInTheBlankModeActive,
    isVerbConjugationGameActive,
    modeChangeMessage,
    
    // Setters
    setIsInHardWordsMode,
    setIsMatchingGameModeActive,
    setIsFillInTheBlankModeActive,
    setIsVerbConjugationGameActive,
    setModeChangeMessage,
    
    // Helpers
    isAnyGameActive,
    resetAllGameModes,
  };
}