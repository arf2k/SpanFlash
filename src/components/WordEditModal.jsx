import React, { useState, useEffect, useCallback, useRef } from 'react';
import './SearchModal.css'; 


const WordEditModal = ({ isOpen, onClose, onSaveWord, wordToEdit, onDeleteWord }) => {
    const [currentId, setCurrentId] = useState(null);
    const [spanish, setSpanish] = useState('');
    const [english, setEnglish] = useState('');
    const [notes, setNotes] = useState('');
    const [synonymsSpanishInput, setSynonymsSpanishInput] = useState('');
    const [synonymsEnglishInput, setSynonymsEnglishInput] = useState('');
    const [category, setCategory] = useState('');
    const [error, setError] = useState('');

    const modalContentRef = useRef(null);
    const spanishInputRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            if (wordToEdit && wordToEdit.id != null) {
                setCurrentId(wordToEdit.id);
                setSpanish(wordToEdit.spanish || '');
                setEnglish(wordToEdit.english || '');
                setNotes(wordToEdit.notes || '');
                setSynonymsSpanishInput((wordToEdit.synonyms_spanish || []).join(', '));
                setSynonymsEnglishInput((wordToEdit.synonyms_english || []).join(', '));
                setCategory(wordToEdit.category || '');
                setError('');
                console.log("WordEditModal: Populating form with word to edit:", wordToEdit);
            } else {
                console.log("WordEditModal: Opened without valid wordToEdit, resetting form.");
                setCurrentId(null);
                setSpanish('');
                setEnglish('');
                setNotes('');
                setSynonymsSpanishInput('');
                setSynonymsEnglishInput('');
                setCategory('');
                setError('');
            }
            setTimeout(() => {
                if (spanishInputRef.current) {
                    spanishInputRef.current.focus();
                }
            }, 100);
        }
    }, [isOpen, wordToEdit]);

    const handleEscapeKey = useCallback((event) => {
        if (event.key === 'Escape') {
            onClose();
        }
    }, [onClose]);

    useEffect(() => {
        if (isOpen) {
            document.addEventListener('keydown', handleEscapeKey);
        } else {
            document.removeEventListener('keydown', handleEscapeKey);
        }
        return () => {
            document.removeEventListener('keydown', handleEscapeKey);
        };
    }, [isOpen, handleEscapeKey]);

    const handleClickOutside = useCallback((event) => {
        if (modalContentRef.current && !modalContentRef.current.contains(event.target)) {
            onClose();
        }
    }, [onClose]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!spanish.trim() || !english.trim()) {
            setError('Spanish and English fields are required.');
            return;
        }
        if (currentId === null) {
             setError('Cannot save changes: Word ID is missing.');
             return;
        }
        setError('');

        const updatedWordData = {
            id: currentId,
            spanish: spanish.trim(),
            english: english.trim(),
            notes: notes.trim(),
            synonyms_spanish: synonymsSpanishInput.split(',').map(s => s.trim()).filter(s => s),
            synonyms_english: synonymsEnglishInput.split(',').map(s => s.trim()).filter(s => s),
            category: category.trim(),
        };
        onSaveWord(updatedWordData);
        onClose();
    };

    const handleDelete = () => {
        if (currentId === null) {
            console.error("WordEditModal: Cannot delete, word ID is missing.");
            setError("Cannot delete: Word ID is missing."); // Should not happen if modal opened correctly for an existing word
            return;
        }

        if (window.confirm(`Are you sure you want to delete the word: "${spanish || (wordToEdit && wordToEdit.spanish)}"? This action cannot be undone.`)) {
            if (onDeleteWord) {
                onDeleteWord(currentId); // Pass the ID of the word to delete
            }
            onClose(); // Close the modal after attempting deletion
        }
    };
  


    if (!isOpen) {
        return null;
    }

    return (
        <div className="search-modal-overlay" onClick={handleClickOutside}>
            <div className="search-modal-content" ref={modalContentRef} onClick={(e) => e.stopPropagation()}>
                <div className="search-modal-header">
                    <h2>Edit Word Pair</h2>
                    <button onClick={onClose} className="search-modal-close-btn">&times;</button>
                </div>
                <form onSubmit={handleSubmit} className="add-word-form">
                    {error && <p style={{ color: 'red', textAlign: 'center' }}>{error}</p>}
                    {/* Form groups for spanish, english, notes, synonyms, category as before */}
                    <div className="form-group">
                        <label htmlFor="editSpanishWord">Spanish Word/Phrase*:</label>
                        <input id="editSpanishWord" ref={spanishInputRef} type="text" value={spanish} onChange={(e) => setSpanish(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="editEnglishWord">English Translation*:</label>
                        <input id="editEnglishWord" type="text" value={english} onChange={(e) => setEnglish(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="editNotes">Notes:</label>
                        <textarea id="editNotes" value={notes} onChange={(e) => setNotes(e.target.value)} rows="3" />
                    </div>
                    <div className="form-group">
                        <label htmlFor="editSynonymsSpanish">Spanish Synonyms (comma-separated):</label>
                        <input id="editSynonymsSpanish" type="text" value={synonymsSpanishInput} onChange={(e) => setSynonymsSpanishInput(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="editSynonymsEnglish">English Synonyms (comma-separated):</label>
                        <input id="editSynonymsEnglish" type="text" value={synonymsEnglishInput} onChange={(e) => setSynonymsEnglishInput(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="editCategory">Category:</label>
                        <input id="editCategory" type="text" value={category} onChange={(e) => setCategory(e.target.value)} />
                    </div>

                    {/* Form Actions */}
                    <div className="form-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
                        {/* Delete Button - New */}
                        <button 
                            type="button" 
                            onClick={handleDelete} 
                            className="delete-button" 
                            style={{ backgroundColor: 'var(--color-danger)', color: 'white', borderColor: 'var(--color-danger-darker)' }}
                            disabled={currentId === null} // Disable if no word is loaded (shouldn't happen)
                        >
                            Delete Word
                        </button>
                        <div>
                            <button type="button" onClick={onClose} style={{ marginRight: '10px' }}>Cancel</button>
                            <button type="submit" className="submit-button">Save Changes</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default WordEditModal;