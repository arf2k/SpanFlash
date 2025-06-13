import { db } from "../db";

export const createHardWordsHandlers = (
  hardWordsList,
  setHardWordsList,
  showHardWordsView,
  setShowHardWordsView,
  isInHardWordsMode,
  setIsInHardWordsMode,
  setModeChangeMessage,
  setGameShowFeedback
) => {
  const handleMarkHard = async (pairToMark) => {
    if (!pairToMark?.spanish || !pairToMark?.english) {
      console.error("handleMarkHard: Invalid pair received", pairToMark);
      return;
    }
    const { spanish, english } = pairToMark;

    const isAlreadyHard = hardWordsList.some(
      (w) => w.spanish === spanish && w.english === english
    );

    try {
      if (isAlreadyHard) {
        const compoundKey = [spanish, english];
        await db.hardWords.delete(compoundKey);
        setHardWordsList((prevList) =>
          prevList.filter(
            (w) => !(w.spanish === spanish && w.english === english)
          )
        );
        console.log(`Word "${spanish}" unmarked as hard and removed from DB.`);
      } else {
        const hardWordEntry = { spanish, english };
        await db.hardWords.put(hardWordEntry);
        const updatedHardWords = await db.hardWords.toArray();
        setHardWordsList(updatedHardWords);
        console.log(`Word "${spanish}" marked as hard and added/updated in DB.`);
      }
    } catch (error) {
      console.error("Failed to toggle hard word status:", error);
    }
  };

  const handleRemoveHardWord = async (pairToRemove) => {
    if (!pairToRemove?.spanish || !pairToRemove?.english) return;
    const compoundKey = [pairToRemove.spanish, pairToRemove.english];
    try {
      await db.hardWords.delete(compoundKey);
      const updatedHardWords = await db.hardWords.toArray();
      setHardWordsList(updatedHardWords);
    } catch (error) {
      console.error("Failed to remove hard word:", error);
    }
  };

  const handleToggleHardWordsMode = () => {
    setModeChangeMessage("");
    if (!isInHardWordsMode) {
      if (!hardWordsList || hardWordsList.length === 0) {
        setModeChangeMessage(
          "Your hard words list is empty. Add some words as hard first!"
        );
        setTimeout(() => setModeChangeMessage(""), 3000);
        return;
      }
    }
    setIsInHardWordsMode((prevMode) => !prevMode);
  };

  const handleToggleHardWordsView = () =>
    setShowHardWordsView((prev) => {
      if (!prev) setGameShowFeedback(false);
      return !prev;
    });

  return {
    handleMarkHard,
    handleRemoveHardWord,
    handleToggleHardWordsMode,
    handleToggleHardWordsView,
  };
};