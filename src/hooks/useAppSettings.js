import { useState } from 'react';

export function useAppSettings() {
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(() => {
    const storedTheme = localStorage.getItem("flashcardAppTheme");
    const prefersDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    return storedTheme || (prefersDark ? "dark" : "light");
  });

  // Helper function to toggle theme
  const toggleTheme = () => {
    setCurrentTheme((prevTheme) => (prevTheme === "light" ? "dark" : "light"));
  };

  // Helper function to toggle admin mode
  const toggleAdminMode = () => {
    setIsAdminMode((prevMode) => !prevMode);
  };

  return {
    // State values
    isAdminMode,
    currentTheme,
    
    // Setters
    setIsAdminMode,
    setCurrentTheme,
    
    // Helpers
    toggleTheme,
    toggleAdminMode,
  };
}