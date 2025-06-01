import React from 'react';


const HardWordsView = ({ hardWordsList, onClose, onRemoveWord }) => {
  return (
    <div className="hard-words-view"> 
      
      <div className="hard-words-view-header">
        <h2 className="hard-words-view-title"> 
          Hard Words List ({hardWordsList.length})
        </h2>
        <button
          onClick={onClose}
          title="Close"
          className="hard-words-view-close-btn-top" 
        >
          &times; {/* HTML entity for 'X' */}
        </button>
      </div>

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

      {/* You can decide if you still want this bottom button, 
          or if the top 'X' button is sufficient. 
          If kept, style it with its class. */}
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