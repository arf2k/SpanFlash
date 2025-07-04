import React, { useState, useEffect, useCallback, useRef } from "react";
import "./SearchModal.css";

const SearchModal = ({
  isOpen,
  onClose,
  wordList,
  onSelectResult,
  onAddWord = null,
  isAdminMode = false,
}) => {
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
      const filtered = wordList.filter((pair) => {
        let match = false;

        // Check primary Spanish field
        if (
          pair.spanish &&
          pair.spanish.toLowerCase().includes(lowerSearchTerm)
        ) {
          match = true;
        }
        // Check primary English field
        if (
          !match &&
          pair.english &&
          pair.english.toLowerCase().includes(lowerSearchTerm)
        ) {
          match = true;
        }
        // Check Spanish synonyms (if they exist and are an array)
        if (
          !match &&
          pair.synonyms_spanish &&
          Array.isArray(pair.synonyms_spanish)
        ) {
          for (const syn of pair.synonyms_spanish) {
            if (syn && syn.toLowerCase().includes(lowerSearchTerm)) {
              match = true;
              break;
            }
          }
        }
        // Check English synonyms (if they exist and are an array)
        if (
          !match &&
          pair.synonyms_english &&
          Array.isArray(pair.synonyms_english)
        ) {
          for (const syn of pair.synonyms_english) {
            if (syn && syn.toLowerCase().includes(lowerSearchTerm)) {
              match = true;
              break;
            }
          }
        }
        return match;
      });
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
      onSelectResult(pair);
    }
    onClose();
  };

  // NEW: Handle add word from search (admin only)
  const handleAddWordFromSearch = () => {
    console.log("SearchModal: Adding word from search:", searchTerm);
    if (onAddWord && searchTerm.trim()) {
      onAddWord(searchTerm.trim());
      onClose();
    }
  };

  // NEW: Show add button only for admin when no results found
  const showAddWordButton =
    searchTerm.trim() && searchResults.length === 0 && onAddWord && isAdminMode;

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
              id="searchInputInModal"
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
            {/* MODIFIED: Admin-only add word option when no results */}
            {showAddWordButton && (
              <div className="search-no-results-container">
                <p className="search-no-results">
                  No results found for "{searchTerm}"
                </p>
                <button
                  onClick={handleAddWordFromSearch}
                  className="add-word-from-search-btn"
                  title={`Add "${searchTerm}" to your vocabulary`}
                >
                  <span role="img" aria-label="add icon">
                    ➕
                  </span>{" "}
                  Add "{searchTerm}" to vocabulary
                </button>
              </div>
            )}

            {/* Regular no results (non-admin or no onAddWord callback) */}
            {searchTerm.trim() &&
              searchResults.length === 0 &&
              !showAddWordButton && (
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
                    onClick={() => handleResultClick(pair)}
                    tabIndex={0}
                    role="button"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ")
                        handleResultClick(pair);
                    }}
                  >
                    {pair.spanish} - {pair.english}
                    {/* Optionally, you could add a small indicator if the match was in synonyms */}
                  </li>
                ))}
              </ul>
            )}
            {!searchTerm.trim() && searchResults.length === 0 && (
              <p className="search-prompt">Type a word or phrase to search.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchModal;
