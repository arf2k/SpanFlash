export const createModalHandlers = (
  setWordCurrentlyBeingEdited,
  setIsEditModalOpen,
  setTatoebaExamples,
  setTatoebaError,
  setIsLoadingTatoebaExamples,
  setIsDetailsModalOpen,
  setIsAddWordModalOpen,
  setIsSettingsModalOpen
) => {
  const openEditModal = (wordToEdit) => {
    if (!wordToEdit || wordToEdit.id == null) {
      console.error("Edit attempt on invalid word:", wordToEdit);
      return;
    }
    setWordCurrentlyBeingEdited(wordToEdit);
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setWordCurrentlyBeingEdited(null);
  };

  const handleShowDetailsModal = (currentPair) => {
    if (currentPair) {
      setTatoebaExamples([]);
      setTatoebaError(null);
      setIsLoadingTatoebaExamples(false);
      setIsDetailsModalOpen(true);
    } else {
      console.warn("Tried to show details but no currentPair is set.");
    }
  };

  const handleCloseDetailsModal = () => setIsDetailsModalOpen(false);

  const handleOpenAddWordModalFromSettings = () => {
    setIsAddWordModalOpen(true);
    setIsSettingsModalOpen(false);
  };

  return {
    openEditModal,
    closeEditModal,
    handleShowDetailsModal,
    handleCloseDetailsModal,
    handleOpenAddWordModalFromSettings,
  };
};