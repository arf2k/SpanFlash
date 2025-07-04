export const createModalHandlers = (
  setWordCurrentlyBeingEdited,
  setIsEditModalOpen,
  setTatoebaExamples,
  setTatoebaError,
  setIsLoadingTatoebaExamples,
  setIsDetailsModalOpen,
  setIsAddWordModalOpen,
  setIsSettingsModalOpen,
  setAddWordFromSearch,     
  setIsSearchModalOpen  
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
  const handleAddWordFromSearch = (searchTerm) => {
    console.log("ModalHandlers: Adding word from search:", searchTerm);
    setAddWordFromSearch(searchTerm);
    setIsSearchModalOpen(false);
    setIsAddWordModalOpen(true);
  };


  return {
    openEditModal,
    closeEditModal,
    handleShowDetailsModal,
    handleCloseDetailsModal,
    handleOpenAddWordModalFromSettings,
    handleAddWordFromSearch,
  };
};