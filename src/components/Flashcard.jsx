import React, { useState } from 'react'; 

const Flashcard = ({ pair, direction, onAnswerSubmit }) => { 

    const [answer, setAnswer] = useState('');

 
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

    const handleSubmit = (event) => {
        event.preventDefault(); 
        if (!answer.trim()) return; // Don't submit empty answers (optional)

        console.log('Submitting answer:', answer); 

      
        onAnswerSubmit(answer);

        // Clear the input field after submitting
        setAnswer('');
    };

    return (
        <div className="flashcard">
            {/* Conditionally render the word */}
            {pair ? (
                <p className="flashcard-word">{wordToShow}</p>
            ) : (
                <p>No card data.</p>
            )}

            {/* Render form only if there's a card to answer */}
            {pair && (
                <form onSubmit={handleSubmit} className="answer-form">
                    <input
                        type="text"
                        value={answer} 
                        onChange={(e) => setAnswer(e.target.value)} 
                        placeholder={placeholderText}
                        className="answer-input"
                        autoFocus // Automatically focus the input field
                        required // Basic HTML validation: requires an answer
                    />
                    <button type="submit" className="submit-button">
                        Check Answer
                    </button>
                </form>
            )}
        </div>
    );
};

export default Flashcard;