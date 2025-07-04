import { useState } from "react";

export function useModalState() {
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isAddWordModalOpen, setIsAddWordModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [addWordFromSearch, setAddWordFromSearch] = useState(null);

  const closeAllModals = () => {
    setIsSearchModalOpen(false);
    setIsAddWordModalOpen(false);
    setIsEditModalOpen(false);
    setIsDetailsModalOpen(false);
    setIsSettingsModalOpen(false);
    setIsStatsModalOpen(false);
  };

  return {
    isSearchModalOpen,
    isAddWordModalOpen,
    isEditModalOpen,
    isDetailsModalOpen,
    isSettingsModalOpen,
    isStatsModalOpen,
    addWordFromSearch,

    setIsSearchModalOpen,
    setIsAddWordModalOpen,
    setIsEditModalOpen,
    setIsDetailsModalOpen,
    setIsSettingsModalOpen,
    setIsStatsModalOpen,
    setAddWordFromSearch,
    closeAllModals,
  };
}
