import React from 'react';

const HardWordsView = ({ hardWordsList, onClose, onRemoveWord }) => {
  return (
    <div className="hard-words-view">

      <h2> 
        Hard Words List ({hardWordsList.length})
      </h2>

      {hardWordsList.length === 0 ? (
        <p className="hard-words-empty-message">
          You haven't marked any words as hard yet. Use the ⭐ icon on a flashcard!
        </p>
      ) : (
        <ul> 
          {hardWordsList.map((pair) => (
            <li key={`${pair.spanish}-${pair.english}`}>
              <span>
                <strong>{pair.spanish}</strong> - {pair.english}
              </span>
              <button
                onClick={() => onRemoveWord(pair)}
                title={`Remove "${pair.spanish}"`}
                className="hard-words-item-remove-btn"
              >
                &times; 
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Bottom "Back to Practice" Button */}
      <button
        onClick={onClose}
        className="button-back-to-practice"
      >
        Back to Practice
      </button>
    </div>
  );
};

export default HardWordsView;