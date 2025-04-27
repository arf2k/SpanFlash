import React from 'react';

/**
 * Displays the front of the flashcard (the word/phrase to translate).
 *
 * Props:
 * - pair: Object containing { english: string, spanish: string } or null
 * - direction: String, either 'spa-eng' (show Spanish) or 'eng-spa' (show English)
 */
const Flashcard = ({ pair, direction }) => { 

    // Determine which word/phrase to display based on direction
    let wordToShow = '';
    if (pair) { // Only try to access pair properties if pair is not null
        if (direction === 'spa-eng') {
            wordToShow = pair.spanish;
        } else if (direction === 'eng-spa') {
            wordToShow = pair.english;
        }
    }

    // Basic rendering - we'll add more structure and styling later
    return (
        <div className="flashcard">
            {/* Conditionally render the word - show nothing if pair isn't loaded */}
            {pair ? (
                <p className="flashcard-word">{wordToShow}</p>
            ) : (
                <p>No card data.</p> // Fallback if pair is null
            )}
            {/* We will add input, buttons, hint display etc. here later */}
        </div>
    );
}; 

export default Flashcard;