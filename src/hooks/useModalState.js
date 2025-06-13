import { useState } from 'react';

export function useModalState() {
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isAddWordModalOpen, setIsAddWordModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Helper functions for convenience
  const closeAllModals = () => {
    setIsSearchModalOpen(false);
    setIsAddWordModalOpen(false);
    setIsEditModalOpen(false);
    setIsDetailsModalOpen(false);
    setIsSettingsModalOpen(false);
  };

  return {
    // State values
    isSearchModalOpen,
    isAddWordModalOpen,
    isEditModalOpen,
    isDetailsModalOpen,
    isSettingsModalOpen,
    
    // Setters
    setIsSearchModalOpen,
    setIsAddWordModalOpen,
    setIsEditModalOpen,
    setIsDetailsModalOpen,
    setIsSettingsModalOpen,
    
    // Helper
    closeAllModals,
  };
}