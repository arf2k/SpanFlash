import { db } from "../db";

export const createWordManagementHandlers = (
  setWordList,
  currentPair,
  selectNewPairCard,
  listForFlashcardGame,
  setIsSearchModalOpen,
  loadSpecificCard,
  currentDataVersion,
  closeEditModal
) => {
  const handleAddWord = async (newWordObject) => {
    try {
      const newId = await db.allWords.add(newWordObject);
      const wordWithId = await db.allWords.get(newId);
      if (wordWithId)
        setWordList((prevWordList) => [...prevWordList, wordWithId]);
      else console.error("Failed to retrieve new word from DB:", newId);
      console.log("New word added:", wordWithId);
    } catch (error) {
      console.error("Failed to add new word:", error);
    }
  };

  const handleUpdateWord = async (updatedWordData) => {
    if (!updatedWordData || updatedWordData.id == null) {
      console.error("Update attempt with invalid data:", updatedWordData);
      return;
    }
    try {
      await db.allWords.put(updatedWordData);
      setWordList((prevWordList) =>
        prevWordList.map((w) =>
          w.id === updatedWordData.id ? updatedWordData : w
        )
      );
      if (currentPair && currentPair.id === updatedWordData.id)
        selectNewPairCard();
      console.log("Word updated:", updatedWordData);
      closeEditModal();
    } catch (error) {
      console.error("Failed to update word:", error);
    }
  };

  const handleDeleteWord = async (idToDelete) => {
    if (idToDelete == null) {
      console.error("Delete attempt with invalid ID.");
      return;
    }
    try {
      await db.allWords.delete(idToDelete);
      setWordList((prevWordList) =>
        prevWordList.filter((word) => word.id !== idToDelete)
      );
      console.log(`Word ID ${idToDelete} deleted.`);
      if (currentPair && currentPair.id === idToDelete) {
        selectNewPairCard();
      } else if (
        listForFlashcardGame.filter((w) => w.id !== idToDelete).length === 0
      ) {
        selectNewPairCard();
      }
    } catch (error) {
      console.error(`Failed to delete word ID ${idToDelete}:`, error);
    }
  };

  const handleSelectWordFromSearch = (selectedPair) => {
    if (selectedPair && loadSpecificCard) {
      loadSpecificCard(selectedPair);
      setIsSearchModalOpen(false);
    } else
      console.warn("handleSelectWordFromSearch: invalid pair or loadSpecificCard.");
  };

  const handleExportWordList = async () => {
    console.log("Exporting word list...");
    try {
      const allWordsFromDB = await db.allWords.toArray();
      const wordsForExport = allWordsFromDB.map(({ id, ...restOfWord }) => restOfWord);
      
      const wordsWithProgress = wordsForExport.filter((w) => w.leitnerBox > 0).length;
      const boxDistribution = {};
      wordsForExport.forEach((w) => {
        const box = w.leitnerBox || 0;
        boxDistribution[box] = (boxDistribution[box] || 0) + 1;
      });

      const exportObject = {
        version: currentDataVersion || "1.0.0",
        exportDate: new Date().toISOString(),
        exportMetadata: {
          totalWords: wordsForExport.length,
          wordsWithProgress: wordsWithProgress,
          boxDistribution: boxDistribution,
          deviceInfo: navigator.userAgent,
          deviceType: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? "mobile" : "desktop",
          warning: "DO NOT manually edit leitnerBox, lastReviewed, or dueDate fields - use merge script instead",
          mergeInstructions: "To merge with master: node scripts/mergePhoneExport.cjs",
        },
        words: wordsForExport,
      };

      const jsonString = JSON.stringify(exportObject, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;

      const date = new Date();
      const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const timeString = `${String(date.getHours()).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}`;
      const deviceType = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? "mobile" : "desktop";

      a.download = `flashcard_export_${deviceType}_${dateString}_${timeString}.json`;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log(`Word list exported successfully.`);
      console.log(`  - Total words: ${wordsForExport.length}`);
      console.log(`  - Words with progress: ${wordsWithProgress}`);
      console.log(`  - Filename: ${a.download}`);
    } catch (error) {
      console.error("Failed to export word list:", error);
    }
  };

  return {
    handleAddWord,
    handleUpdateWord,
    handleDeleteWord,
    handleSelectWordFromSearch,
    handleExportWordList,
  };
};