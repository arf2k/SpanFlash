// src/components/HardWordsView.jsx
import React from 'react';

// This component displays the list of marked hard words.
// Props:
// - hardWordsList: Array of word pair objects ({ spanish: '...', english: '...' })
// - onClose: Function to call when the close button is clicked
const HardWordsView = ({ hardWordsList, onClose }) => {
  return (
    // Using a distinct class name for potential specific styling
    // Adding inline style for basic layout and readability (can be moved to CSS)
    <div
      className="hard-words-view"
      style={{
        padding: '20px',
        border: '1px solid #ccc',
        borderRadius: '8px',
        marginTop: '20px',
        backgroundColor: '#f9f9f9', // Light background
        color: '#333', // Explicit dark text color for readability
        textAlign: 'left', // Align text left
      }}
    >
      <h2 style={{ marginTop: '0', marginBottom: '15px', textAlign: 'center' }}>
        Hard Words List
      </h2>

      {/* Check if the list is empty */}
      {hardWordsList.length === 0 ? (
        <p style={{ fontStyle: 'italic', textAlign: 'center' }}>
          You haven't marked any words as hard yet. Use the ⭐ icon on a flashcard!
        </p>
      ) : (
        // If not empty, display the list
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {hardWordsList.map((pair) => (
            // Use a combination of spanish and english for a more robust key
            <li
              key={`${pair.spanish}-${pair.english}`}
              style={{
                borderBottom: '1px solid #eee',
                padding: '8px 0',
                display: 'flex', // Using flex for layout within the item
                justifyContent: 'space-between', // Space out word and (future) button
                alignItems: 'center',
              }}
            >
              {/* Display the word pair */}
              <span>
                <strong>{pair.spanish}</strong> - {pair.english}
              </span>
              {/* Placeholder for future 'Remove' button */}
              {/* <button>Remove</button> */}
            </li>
          ))}
        </ul>
      )}

      {/* Close Button */}
      <button
        onClick={onClose} // Call the onClose function passed from App.jsx
        style={{
            display: 'block', // Make button block level
            margin: '20px auto 0 auto', // Center button horizontally with margin
            padding: '10px 20px',
            cursor: 'pointer'
        }}
      >
        Back to Practice
      </button>
    </div>
  );
};

export default HardWordsView;