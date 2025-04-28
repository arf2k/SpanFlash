// src/components/Flashcard.jsx
import React, { useState, useEffect } from 'react';

const Flashcard = ({
    pair,
    direction,
    onAnswerSubmit,
    showFeedback,
    onGetHint,
    hint,
    isHintLoading,
    feedbackSignal // Accepted prop
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
        if (!answer.trim() || showFeedback) return;
        console.log('Flashcard: Submitting answer:', answer);
        onAnswerSubmit(answer);
    };

    // Determine dynamic className for the flashcard div based on feedbackSignal
    const cardClassName = `flashcard ${
        feedbackSignal ? `flashcard--${feedbackSignal}` : '' // Adds 'flashcard--correct' or 'flashcard--incorrect'
    }`.trim(); // Use trim to remove potential trailing space if no signal class

    return (
        // --- Use the dynamic className ---
        <div className={cardClassName}>
            {/* Word Display */}
            {pair ? (
                <p className="flashcard-word">{wordToShow}</p>
            ) : (
                <p>No card data.</p>
            )}

            {/* Answer Form - Render only if pair exists AND feedback is NOT showing */}
            {pair && !showFeedback && (
                <form onSubmit={handleSubmit} className="answer-form" style={{ marginTop: '10px' }}>
                    <input
                        type="text"
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        placeholder={placeholderText}
                        className="answer-input"
                        autoFocus
                        required
                        style={{ marginRight: '10px' }}
                    />
                    <button type="submit" className="submit-button">
                        Check Answer
                    </button>
                    {/* Hint Button */}
                    <button
                        type="button"
                        onClick={onGetHint}
                        className="hint-button"
                        disabled={isHintLoading || (hint && hint.type !== 'error') || showFeedback || feedbackSignal === 'incorrect'} // Also disable hint if incorrect feedback showing
                        style={{ marginLeft: '10px' }}
                    >
                        {isHintLoading ? 'Getting Hint...' : 'Hint'}
                    </button>
                </form>
            )}

             {/* Hint Display Area */}
             <div className="hint-display" style={{ marginTop: '15px', fontSize: '0.9em', fontStyle: 'italic', borderTop: '1px solid #eee', paddingTop: '10px', minHeight: '1.2em' }}>
                 {isHintLoading ? (
                     <span>Loading hint...</span>
                 ) : hint ? (
                     <>
                         <strong>Hint:</strong>
                         {hint.type === 'definitions' && hint.data?.fl && (
                             <em> ({hint.data.fl})</em>
                         )}
                         {hint.type === 'definitions' && hint.data?.shortdef && hint.data.shortdef.length > 0 ? (
                             <span>: {hint.data.shortdef.join('; ')}</span>
                         ) : hint.type === 'definitions' ? (
                             <span>: Definition details not found in expected format.</span>
                         ) : null}

                         {hint.type === 'suggestions' && (
                            <span> Did you mean: {hint.suggestions.join(', ')}?</span>
                         )}

                         {hint.type === 'error' && (
                            <span style={{ color: 'orange' }}> {hint.message}</span>
                         )}

                         {hint.type === 'unknown' && (
                             <span style={{ color: 'orange' }}> Unrecognized hint format.</span>
                         )}
                     </>
                 ) : (
                     <span> </span> // Placeholder for height
                 )}
             </div>
             {/* END Hint Display Area */}
        </div>
    );
};

export default Flashcard;