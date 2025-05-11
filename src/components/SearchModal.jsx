// src/components/SearchModal.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import './SearchModal.css'; // We'll create this for styling

const SearchModal = ({ isOpen, onClose, wordList, onSelectWord }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const modalContentRef = useRef(null);

    // Filter wordList when searchTerm or wordList changes
    useEffect(() => {
        if (!searchTerm.trim()) {
            setSearchResults([]);
            return;
        }
        if (wordList && wordList.length > 0) {
            const lowerSearchTerm = searchTerm.toLowerCase();
            const filtered = wordList.filter(pair =>
                (pair.spanish && pair.spanish.toLowerCase().includes(lowerSearchTerm)) ||
                (pair.english && pair.english.toLowerCase().includes(lowerSearchTerm))
            );
            setSearchResults(filtered);
        } else {
            setSearchResults([]);
        }
    }, [searchTerm, wordList]);

    // Handle Escape key to close modal
    const handleEscapeKey = useCallback((event) => {
        if (event.key === 'Escape') {
            onClose();
        }
    }, [onClose]);

    useEffect(() => {
        if (isOpen) {
            document.addEventListener('keydown', handleEscapeKey);
            // Focus the input when modal opens
            // We might need a ref on the input for this, or a slight delay
            setTimeout(() => {
                const inputElement = document.getElementById('searchInput');
                if (inputElement) {
                    inputElement.focus();
                }
            }, 100);
        } else {
            document.removeEventListener('keydown', handleEscapeKey);
        }
        return () => {
            document.removeEventListener('keydown', handleEscapeKey);
        };
    }, [isOpen, handleEscapeKey]);

    // Handle click outside to close
    const handleClickOutside = useCallback((event) => {
        if (modalContentRef.current && !modalContentRef.current.contains(event.target)) {
            onClose();
        }
    }, [onClose]);

    if (!isOpen) {
        return null;
    }

    const handleClearSearch = () => {
        setSearchTerm('');
        const inputElement = document.getElementById('searchInput');
        if (inputElement) {
            inputElement.focus();
        }
    };
    
    const handleResultClick = (pair) => {
        console.log("Search result clicked (V1 - no action):", pair);
        // For future: onSelectWord(pair);
        // For V1, we can just close the modal or do nothing. Let's close it.
        // onClose(); 
        // Or, for now, let's just log and keep it open to review results easily.
    };

    return (
        <div className="search-modal-overlay" onClick={handleClickOutside}>
            <div className="search-modal-content" ref={modalContentRef} onClick={(e) => e.stopPropagation()}>
                <div className="search-modal-header">
                    <h2>Search Word List</h2>
                    <button onClick={onClose} className="search-modal-close-btn">&times;</button>
                </div>
                <div className="search-modal-body">
                    <div className="search-input-container">
                        <input
                            id="searchInput"
                            type="text"
                            placeholder="Type to search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                        />
                        {searchTerm && (
                            <button onClick={handleClearSearch} className="search-clear-btn">&times;</button>
                        )}
                    </div>
                    <div className="search-results-container">
                        {searchTerm.trim() && searchResults.length === 0 && (
                            <p className="search-no-results">No results found for "{searchTerm}"</p>
                        )}
                        {searchResults.length > 0 && (
                            <ul className="search-results-list">
                                {searchResults.map((pair, index) => (
                                    <li key={pair.id || `${pair.spanish}-${index}`} className="search-result-item" onClick={() => handleResultClick(pair)}>
                                        {pair.spanish} - {pair.english}
                                    </li>
                                ))}
                            </ul>
                        )}
                        {!searchTerm.trim() && (
                             <p className="search-prompt">Type a word or phrase to search.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SearchModal;