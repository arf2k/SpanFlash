// src/components/Flashcard.jsx
import React, { useState, useEffect } from 'react';

const Flashcard = ({
    pair,
    direction,
    onAnswerSubmit,
    showFeedback,
    onGetHint,
    hint,             // Hint object { type: '...', data: ..., etc. } or null
    isHintLoading     // Boolean
 }) => {

    const [answer, setAnswer] = useState('');

    useEffect(() => {
        // Clear input when card changes or feedback appears
        setAnswer('');
    }, [pair, showFeedback]);

    // Determine word to show and placeholder text
    let wordToShow = '';
    let placeholderText = 'Type your answer...';
    if (pair) {
        if (direction === 'spa-eng') {
            wordToShow = pair.spanish;
            placeholderText = 'Type the English translation...';
        } else if (direction === 'eng-spa') {
            wordToShow = pair.english;
            placeholderText = 'Type the Spanish translation...';
        }
    }

    // Handle form submission
    const handleSubmit = (event) => {
        event.preventDefault();
        if (!answer.trim() || showFeedback) return; // Prevent submit if empty or feedback showing
        console.log('Flashcard: Submitting answer:', answer);
        onAnswerSubmit(answer);
    };

    return (
        <div className="flashcard">
            {/* Word Display */}
            {pair ? (
                <p className="flashcard-word">{wordToShow}</p>
            ) : (
                <p>No card data.</p>
            )}

            {/* Answer Form - Render only if pair exists AND feedback is NOT showing */}
            {pair && !showFeedback && (
                <form onSubmit={handleSubmit} className="answer-form" style={{ marginTop: '10px' }}> {/* Added margin */}
                    <input
                        type="text"
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        placeholder={placeholderText}
                        className="answer-input"
                        autoFocus
                        required
                        style={{ marginRight: '10px' }} // Added margin
                    />
                    <button type="submit" className="submit-button">
                        Check Answer
                    </button>
                    {/* Hint Button */}
                    <button
                        type="button"
                        onClick={onGetHint}
                        className="hint-button"
                        // Disable if loading, hint shown (unless it was an error), or feedback showing
                        disabled={isHintLoading || (hint && hint.type !== 'error') || showFeedback}
                        style={{ marginLeft: '10px' }}
                    >
                        {isHintLoading ? 'Getting Hint...' : 'Hint'}
                    </button>
                </form>
            )}

            {/* --- UPDATED HINT DISPLAY AREA --- */}
            <div className="hint-display" style={{ marginTop: '15px', fontSize: '0.9em', fontStyle: 'italic', borderTop: '1px solid #eee', paddingTop: '10px', minHeight: '1.2em' }}>
                {isHintLoading ? (
                    // Show loading indicator
                    <span>Loading hint...</span>
                ) : hint ? (
                    // If not loading and hint object exists, process it
                    <>
                        <strong>Hint:</strong>
                        {hint.type === 'definitions' && hint.data?.fl && (
                            // Show functional label (part of speech) if available
                            <em> ({hint.data.fl})</em>
                        )}
                        {hint.type === 'definitions' && hint.data?.shortdef && hint.data.shortdef.length > 0 ? (
                            // Show short definitions, joined by semicolon
                            <span>: {hint.data.shortdef.join('; ')}</span>
                        ) : hint.type === 'definitions' ? (
                            // Handle case where definition exists but no shortdef
                            <span>: Definition details not found in expected format.</span>
                        ) : null /* End of definitions check */}

                        {hint.type === 'suggestions' && (
                           // Show suggestions if API returned them
                           <span> Did you mean: {hint.suggestions.join(', ')}?</span>
                        )}

                        {hint.type === 'error' && (
                           // Show error message from App.jsx
                           <span style={{ color: 'orange' }}> {hint.message}</span>
                        )}

                        {hint.type === 'unknown' && (
                            // Handle unknown structure
                            <span style={{ color: 'orange' }}> Unrecognized hint format.</span>
                        )}
                    </>
                ) : (
                    // If not loading and no hint data, show nothing (or a placeholder)
                    <span> </span> // Ensures the div keeps its height
                )}
            </div>
            {/* --- END HINT DISPLAY AREA --- */}
        </div>
    );
};

export default Flashcard;