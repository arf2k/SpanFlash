// src/components/Flashcard.jsx
import React, { useState, useEffect } from 'react';

const Flashcard = ({ pair, direction, onAnswerSubmit, showFeedback }) => {

    const [answer, setAnswer] = useState('');

    useEffect(() => {
        setAnswer('');
    }, [pair, showFeedback]);

    // --- Check if this block is present and correct in your file ---
    let wordToShow = ''; // <--- DEFINITION IS HERE
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
    // --- End check ---


    const handleSubmit = (event) => {
     event.preventDefault(); // Stop page reload
    if (!answer.trim() || showFeedback) {
         console.log("Submit prevented (empty answer or feedback showing)."); // Optional log
         return; // Don't submit if answer is empty or feedback is showing
    }

    console.log('Flashcard: Submitting answer:', answer); // Log that Flashcard's submit ran

    // Call the function passed down from App component
    onAnswerSubmit(answer);

    // Note: Clearing the input ('setAnswer('')') is now handled by the useEffect hook
    // based on changes to 'pair' or 'showFeedback', so we don't need it here.

    };

    return (
        <div className="flashcard">
            {/* Word Display */}
            {pair ? (
                 // Make sure 'wordToShow' is spelled correctly here
                <p className="flashcard-word">{wordToShow}</p>
            ) : (
                <p>No card data.</p>
            )}

            {/* Answer Form */}
            {pair && !showFeedback && (
               <form onSubmit={handleSubmit} className="answer-form">
               <input
                   type="text"
                   value={answer}
                   onChange={(e) => setAnswer(e.target.value)}
                   placeholder={placeholderText}
                   className="answer-input"
                   autoFocus
                   required
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