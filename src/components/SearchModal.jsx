import React, { useState, useEffect, useCallback, useRef } from "react";
import "./SearchModal.css";

const SearchModal = ({ isOpen, onClose, wordList, onSelectResult }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const modalContentRef = useRef(null);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }
    if (wordList && wordList.length > 0) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      const filtered = wordList.filter(
        (pair) =>
          (pair.spanish &&
            pair.spanish.toLowerCase().includes(lowerSearchTerm)) ||
          (pair.english && pair.english.toLowerCase().includes(lowerSearchTerm))
      );
      setSearchResults(filtered);
    } else {
      setSearchResults([]);
    }
  }, [searchTerm, wordList]);

  const handleEscapeKey = useCallback(
    (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleEscapeKey);
      setTimeout(() => {
        const inputElement = document.getElementById("searchInputInModal");
        if (inputElement) {
          inputElement.focus();
        }
      }, 100);
    } else {
      document.removeEventListener("keydown", handleEscapeKey);
      // Reset search term when modal closes for a fresh start next time
      setSearchTerm("");
    }
    return () => {
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [isOpen, handleEscapeKey]);

  const handleClickOutside = useCallback(
    (event) => {
      if (
        modalContentRef.current &&
        !modalContentRef.current.contains(event.target)
      ) {
        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen) {
    return null;
  }

  const handleClearSearch = () => {
    setSearchTerm("");
    const inputElement = document.getElementById("searchInputInModal");
    if (inputElement) {
      inputElement.focus();
    }
  };

  const handleResultClick = (pair) => {
    console.log("SearchModal: Result clicked:", pair);
    if (onSelectResult) {
      onSelectResult(pair); // Pass the selected pair to the handler from App.jsx
    }
    onClose();
  };

  return (
    <div className="search-modal-overlay" onClick={handleClickOutside}>
      <div
        className="search-modal-content"
        ref={modalContentRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="search-modal-header">
          <h2>Search Word List</h2>
          <button onClick={onClose} className="search-modal-close-btn">
            &times;
          </button>
        </div>
        <div className="search-modal-body">
          <div className="search-input-container">
            <input
              id="searchInputInModal" // Changed ID
              type="text"
              placeholder="Type to search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            {searchTerm && (
              <button onClick={handleClearSearch} className="search-clear-btn">
                &times;
              </button>
            )}
          </div>
          <div className="search-results-container">
            {searchTerm.trim() && searchResults.length === 0 && (
              <p className="search-no-results">
                No results found for "{searchTerm}"
              </p>
            )}
            {searchResults.length > 0 && (
              <ul className="search-results-list">
                {searchResults.map((pair, index) => (
                  <li
                    key={pair.id || `${pair.spanish}-${index}`}
                    className="search-result-item"
                    onClick={() => handleResultClick(pair)} // Call handleResultClick
                    // Add tabIndex to make it focusable and role for accessibility
                    tabIndex={0}
                    role="button"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ")
                        handleResultClick(pair);
                    }} // Allow selection with Enter/Space
                  >
                    {pair.spanish} - {pair.english}
                  </li>
                ))}
              </ul>
            )}
            {!searchTerm.trim() &&
              searchResults.length === 0 && ( // Show prompt only if search term is empty and no results yet (e.g. initial state)
                <p className="search-prompt">
                  Type a word or phrase to search.
                </p>
              )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchModal;
