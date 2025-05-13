import React, { useState, useEffect, useCallback, useRef } from 'react';
import './SearchModal.css'; 
import './WordEditModal.css'; 

const WordEditModal = ({ isOpen, onClose, onSaveWord, wordToEdit, onDeleteWord }) => {
    const [currentId, setCurrentId] = useState(null);
    const [spanish, setSpanish] = useState('');
    const [english, setEnglish] = useState('');
    const [notes, setNotes] = useState('');
    const [synonymsSpanishInput, setSynonymsSpanishInput] = useState('');
    const [synonymsEnglishInput, setSynonymsEnglishInput] = useState('');
    const [category, setCategory] = useState('');
    const [error, setError] = useState('');

    const modalDialogRef = useRef(null); 
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
            } else {
                setCurrentId(null); setSpanish(''); setEnglish(''); setNotes('');
                setSynonymsSpanishInput(''); setSynonymsEnglishInput(''); setCategory(''); setError('');
            }
            setTimeout(() => spanishInputRef.current?.focus(), 100);
        }
    }, [isOpen, wordToEdit]);

    const handleEscapeKey = useCallback((event) => {
        if (event.key === 'Escape') onClose();
    }, [onClose]);

    useEffect(() => {
        if (isOpen) document.addEventListener('keydown', handleEscapeKey);
        else document.removeEventListener('keydown', handleEscapeKey);
        return () => document.removeEventListener('keydown', handleEscapeKey);
    }, [isOpen, handleEscapeKey]);

    const handleClickOutside = useCallback((event) => {
        if (modalDialogRef.current && !modalDialogRef.current.contains(event.target)) {
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
        onSaveWord({
            id: currentId,
            spanish: spanish.trim(), english: english.trim(), notes: notes.trim(),
            synonyms_spanish: synonymsSpanishInput.split(',').map(s => s.trim()).filter(s => s),
            synonyms_english: synonymsEnglishInput.split(',').map(s => s.trim()).filter(s => s),
            category: category.trim(),
        });
        onClose();
    };

    const handleDelete = () => {
        if (currentId === null) {
            setError("Cannot delete: Word ID is missing.");
            return;
        }
        if (window.confirm(`Are you sure you want to delete "${spanish || (wordToEdit && wordToEdit.spanish)}"?`)) {
            if (onDeleteWord) onDeleteWord(currentId);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="search-modal-overlay" onClick={handleClickOutside}>
            {/* Added ref to modalDialogRef here for click outside detection */}
            <div className="search-modal-content word-edit-modal-content" ref={modalDialogRef} onClick={(e) => e.stopPropagation()}>
                <div className="search-modal-header">
                    <h2>Edit Word Pair</h2>
                    <button onClick={onClose} className="search-modal-close-btn">&times;</button>
                </div>
                {/* Form now has specific class and internal structure for scrolling */}
                <form onSubmit={handleSubmit} className="word-edit-form">
                    <div className="word-form-scrollable-area">
                        {error && <p className="form-error-message">{error}</p>}
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
                    </div>
                    {/* Actions are part of the form but styled to be at the bottom */}
                    <div className="word-form-actions">
                        <button
                            type="button"
                            onClick={handleDelete}
                            className="button-delete" // Specific class for delete button styling
                            disabled={currentId === null}
                        >
                            Delete
                        </button>
                        <div className="form-actions-right">
                            <button type="button" onClick={onClose} className="button-cancel">Cancel</button>
                            <button type="submit" className="button-save submit-button">Save Changes</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default WordEditModal;