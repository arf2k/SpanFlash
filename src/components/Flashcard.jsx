import React, { useState, useEffect } from 'react';


const Flashcard = ({
    pair,
    direction,
    onAnswerSubmit,
    showFeedback,
    onGetHint,        
    hint,            
    isHintLoading    
 }) => {

    const [answer, setAnswer] = useState('');

    useEffect(() => {
        setAnswer('');
    }, [pair, showFeedback]);

    // ... (wordToShow, placeholderText logic) ...

    const handleSubmit = (event) => {
        event.preventDefault();
        if (!answer.trim() || showFeedback) return;
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
                <form onSubmit={handleSubmit} className="answer-form">
                    <input
                        // ... (input props) ...
                        placeholder={placeholderText}
                        className="answer-input"
                        autoFocus
                        required
                    />
                    <button type="submit" className="submit-button">
                        Check Answer
                    </button>
                    <button
                        type="button" // Important: type="button" prevents form submission
                        onClick={onGetHint}
                        className="hint-button"
                        disabled={isHintLoading || !!hint} // Disable if loading or hint already shown
                        style={{ marginLeft: '10px' }} // Basic spacing
                    >
                        {isHintLoading ? 'Getting Hint...' : 'Hint'}
                    </button>
                    {/* --- END HINT BUTTON --- */}
                </form>
            )}

             {/* --- ADD HINT DISPLAY AREA --- */}
             {hint && ( // Only display if hint data exists
                <div className="hint-display" style={{ marginTop: '10px', fontSize: '0.9em', fontStyle: 'italic', borderTop: '1px solid #eee', paddingTop: '5px' }}>
                    <strong>Hint:</strong> {JSON.stringify(hint)} {/* Basic display for now */}
                </div>
             )}
             {/* --- END HINT DISPLAY AREA --- */}
        </div>
    );
};

export default Flashcard;