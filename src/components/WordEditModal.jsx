import React, { useState, useEffect, useCallback, useRef } from 'react';
import './SearchModal.css'; 

const WordEditModal = ({ isOpen, onClose, onSaveWord, wordToEdit }) => {
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

    // Effect to populate/reset form when modal opens or wordToEdit changes
    useEffect(() => {
        if (isOpen) {
            if (wordToEdit && wordToEdit.id != null) { // Check for id as well
                setCurrentId(wordToEdit.id);
                setSpanish(wordToEdit.spanish || '');
                setEnglish(wordToEdit.english || '');
                setNotes(wordToEdit.notes || '');
                // Convert arrays to comma-separated strings for input fields
                setSynonymsSpanishInput((wordToEdit.synonyms_spanish || []).join(', '));
                setSynonymsEnglishInput((wordToEdit.synonyms_english || []).join(', '));
                setCategory(wordToEdit.category || '');
                setError('');
                console.log("WordEditModal: Populating form with word to edit:", wordToEdit);
            } else {
                // If opened without a wordToEdit (or invalid wordToEdit), reset to a clean state
                // This case ideally shouldn't happen if it's strictly an "edit" modal.
                // For an "add" modal, wordToEdit would be null/undefined.
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
            // Focus the first input field when modal opens
            setTimeout(() => {
                if (spanishInputRef.current) {
                    spanishInputRef.current.focus();
                }
            }, 100);
        } else {
            // Optional: Reset form on close if desired, though opening with new/no data also resets
            // setCurrentId(null); setSpanish(''); setEnglish(''); etc.
        }
    }, [isOpen, wordToEdit]); // Rerun when isOpen or wordToEdit changes

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
        if (currentId === null && wordToEdit && wordToEdit.id != null) {
            // This ensures we capture the ID if it wasn't set due to quick opening
            // or if the effect didn't run with the latest wordToEdit.id yet
            // However, the useEffect should handle setting currentId correctly.
            // This is more of a safeguard, can be removed if useEffect is reliable.
            console.warn("WordEditModal: currentId was null during submit, attempting to use wordToEdit.id");
            if (!wordToEdit.id) {
                 setError('Cannot save changes: Word ID is missing.');
                 return;
            }
        } else if (currentId === null && (!wordToEdit || wordToEdit.id == null)) {
            // This case implies it's being used to "add" or wordToEdit was bad, which shouldn't happen for an edit modal
            setError('Cannot save changes: Word ID is missing. This modal is for editing existing words.');
            return;
        }
        setError('');

        const updatedWordData = {
            id: currentId || wordToEdit.id, // Ensure ID is included for the update
            spanish: spanish.trim(),
            english: english.trim(),
            notes: notes.trim(),
            synonyms_spanish: synonymsSpanishInput.split(',').map(s => s.trim()).filter(s => s),
            synonyms_english: synonymsEnglishInput.split(',').map(s => s.trim()).filter(s => s),
            category: category.trim(),
        };
        onSaveWord(updatedWordData); // Pass the complete object with its ID
        onClose(); 
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
                <form onSubmit={handleSubmit} className="add-word-form"> {/* You might want a different class e.g., "word-edit-form" */}
                    {error && <p style={{ color: 'red', textAlign: 'center' }}>{error}</p>}
                    <div className="form-group">
                        <label htmlFor="editSpanishWord">Spanish Word/Phrase*:</label>
                        <input
                            id="editSpanishWord"
                            ref={spanishInputRef}
                            type="text"
                            value={spanish}
                            onChange={(e) => setSpanish(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="editEnglishWord">English Translation*:</label>
                        <input
                            id="editEnglishWord"
                            type="text"
                            value={english}
                            onChange={(e) => setEnglish(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="editNotes">Notes:</label>
                        <textarea
                            id="editNotes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows="3"
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="editSynonymsSpanish">Spanish Synonyms (comma-separated):</label>
                        <input
                            id="editSynonymsSpanish"
                            type="text"
                            value={synonymsSpanishInput}
                            onChange={(e) => setSynonymsSpanishInput(e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="editSynonymsEnglish">English Synonyms (comma-separated):</label>
                        <input
                            id="editSynonymsEnglish"
                            type="text"
                            value={synonymsEnglishInput}
                            onChange={(e) => setSynonymsEnglishInput(e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="editCategory">Category:</label>
                        <input
                            id="editCategory"
                            type="text"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                        />
                    </div>
                    <div className="form-actions" style={{ textAlign: 'right', marginTop: '20px' }}>
                        <button type="button" onClick={onClose} style={{ marginRight: '10px' }}>Cancel</button>
                        <button type="submit" className="submit-button">Save Changes</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default WordEditModal;