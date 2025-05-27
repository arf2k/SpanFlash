import React, { useEffect, useCallback, useRef } from 'react';
import './SearchModal.css'; 
import './WordDetailsModal.css'; 

const WordDetailsModal = ({
    isOpen,
    onClose,
    pair, 
    onFetchExamples,    
    examples,           
    isLoadingExamples,  
    examplesError       
}) => {
    const modalDialogRef = useRef(null);

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
        if (modalDialogRef.current && !modalDialogRef.current.contains(event.target)) {
            onClose();
        }
    }, [onClose]);

    // Handler for the "Show Example Sentences" button within this modal
    const handleShowExamplesClick = () => {
        if (pair && pair.spanish && onFetchExamples) {
            onFetchExamples(pair.spanish);
        }
    };

    if (!isOpen || !pair) {
        return null;
    }

    return (
        <div className="search-modal-overlay" onClick={handleClickOutside}>
            <div className="search-modal-content word-details-modal-content" ref={modalDialogRef} onClick={(e) => e.stopPropagation()}>
                <div className="search-modal-header">
                    <h2 className="word-details-title">{pair.spanish}</h2>
                    <button onClick={onClose} className="search-modal-close-btn">&times;</button>
                </div>
                <div className="word-details-scrollable-area">
                    <div className="detail-section">
                        <strong className="detail-label">English:</strong>
                        <p className="detail-value">{pair.english}</p>
                    </div>

                    {pair.category && (
                        <div className="detail-section">
                            <strong className="detail-label">Category:</strong>
                            <p className="detail-value category-value">{pair.category}</p>
                        </div>
                    )}

                    {pair.notes && (
                        <div className="detail-section">
                            <strong className="detail-label">Notes:</strong>
                            <p className="detail-value notes-value">{pair.notes}</p>
                        </div>
                    )}

                    {pair.synonyms_spanish && pair.synonyms_spanish.length > 0 && (
                        <div className="detail-section">
                            <strong className="detail-label">Spanish Synonyms:</strong>
                            <p className="detail-value">{pair.synonyms_spanish.join(', ')}</p>
                        </div>
                    )}

                    {pair.synonyms_english && pair.synonyms_english.length > 0 && (
                        <div className="detail-section">
                            <strong className="detail-label">English Synonyms:</strong>
                            <p className="detail-value">{pair.synonyms_english.join(', ')}</p>
                        </div>
                    )}

                    {/* Section for Tatoeba Examples */}
                    <div className="detail-section tatoeba-examples-container">
                        <strong className="detail-label">Example Sentences:</strong>
                        {!isLoadingExamples && (!examples || examples.length === 0) && !examplesError && (
                            <button onClick={handleShowExamplesClick} className="examples-button-modal">
                                Load Examples (Tatoeba)
                            </button>
                        )}
                        {isLoadingExamples && <p className="loading-text">Loading examples...</p>}
                        {examplesError && <p className="error-text examples-error-text">Error: {examplesError}</p>}
                        {examples && examples.length > 0 && (
                            <ul className="example-sentences-list-modal">
                                {examples.map((ex, index) => (
                                    <li key={ex.id_spa || `ex-${index}`}>
                                        <p className="example-spa-modal">{ex.text_spa}</p>
                                        <p className="example-eng-modal">{ex.text_eng}</p>
                                    </li>
                                ))}
                            </ul>
                        )}
                         {!isLoadingExamples && examples && examples.length === 0 && examplesError && !examplesError.includes("No example sentences found") && (
                            // If there was an error but it wasn't "no examples found", still show button
                             <button onClick={handleShowExamplesClick} className="examples-button-modal">
                                Retry Load Examples
                            </button>
                        )}
                    </div>
                </div>
                {/* Optional: Add an Edit button here later that opens WordEditModal for this pair */}
                {/* <div className="word-details-actions">
                    <button onClick={onClose}>Close</button>
                </div> */}
            </div>
        </div>
    );
};

export default WordDetailsModal;