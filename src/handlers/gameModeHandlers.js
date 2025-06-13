export const createGameModeHandlers = (
  mainWordList,
  setModeChangeMessage,
  setShowHardWordsView,
  setIsSearchModalOpen,
  setIsAddWordModalOpen,
  setIsEditModalOpen,
  setIsDetailsModalOpen,
  setIsSettingsModalOpen,
  setIsMatchingGameModeActive,
  setIsFillInTheBlankModeActive,
  setIsVerbConjugationGameActive,
  setGameShowFeedback,
  setWordList
) => {
  const handleToggleMatchingGameMode = () => {
    setModeChangeMessage("");
    if (!mainWordList || mainWordList.length < 6) {
      setModeChangeMessage("Not enough words in the main list to start the matching game (need at least 6).");
      setTimeout(() => setModeChangeMessage(""), 3000);
      return;
    }
    setShowHardWordsView(false);
    setIsSearchModalOpen(false);
    setIsAddWordModalOpen(false);
    setIsEditModalOpen(false);
    setIsDetailsModalOpen(false);
    setIsSettingsModalOpen(false);
    if (setGameShowFeedback) setGameShowFeedback(false);
    setIsMatchingGameModeActive((prev) => !prev);
  };

  const handleToggleFillInTheBlankMode = () => {
    setModeChangeMessage("");
    const candidateWordListForFillInBlank = mainWordList.filter(
      (pair) => pair.spanish && pair.spanish.trim().split(" ").length <= 3
    );
    if (!mainWordList || mainWordList.length < 4 || candidateWordListForFillInBlank.length < 1) {
      setModeChangeMessage("Not enough words for Fill-in-the-Blank game.");
      setTimeout(() => setModeChangeMessage(""), 3000);
      return;
    }
    setShowHardWordsView(false);
    setIsSearchModalOpen(false);
    setIsAddWordModalOpen(false);
    setIsEditModalOpen(false);
    setIsDetailsModalOpen(false);
    setIsSettingsModalOpen(false);
    setIsMatchingGameModeActive(false);
    if (setGameShowFeedback) setGameShowFeedback(false);
    setIsFillInTheBlankModeActive((prev) => !prev);
  };

  const handleToggleVerbConjugationGame = () => {
    setModeChangeMessage("");
    const potentialVerbs = mainWordList.filter(
      (word) =>
        word.spanish &&
        (word.spanish.endsWith("ar") || word.spanish.endsWith("er") || word.spanish.endsWith("ir"))
    );

    if (!mainWordList || mainWordList.length < 4 || potentialVerbs.length < 1) {
      setModeChangeMessage("Not enough verbs in your word list. Add some Spanish verbs ending in -ar, -er, or -ir.");
      setTimeout(() => setModeChangeMessage(""), 3000);
      return;
    }

    setShowHardWordsView(false);
    setIsSearchModalOpen(false);
    setIsAddWordModalOpen(false);
    setIsEditModalOpen(false);
    setIsDetailsModalOpen(false);
    setIsSettingsModalOpen(false);
    setIsMatchingGameModeActive(false);
    setIsFillInTheBlankModeActive(false);
    if (setGameShowFeedback) setGameShowFeedback(false);
    setIsVerbConjugationGameActive((prev) => !prev);
  };

  const handleMatchingGameWordsUpdated = (updatedWords) => {
    if (updatedWords && updatedWords.length > 0) {
      setWordList((prevWordList) => {
        let updatedList = [...prevWordList];
        updatedWords.forEach((updatedWord) => {
          updatedList = updatedList.map((word) =>
            word.id === updatedWord.id ? updatedWord : word
          );
        });
        return updatedList;
      });
      console.log(`Updated ${updatedWords.length} words from matching game with Leitner data`);
    }
  };

  return {
    handleToggleMatchingGameMode,
    handleToggleFillInTheBlankMode,
    handleToggleVerbConjugationGame,
    handleMatchingGameWordsUpdated,
  };
};