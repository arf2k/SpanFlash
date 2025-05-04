import React from 'react';

const HardWordsView = ({ hardWordsList, onClose, onRemoveWord }) => {
  return (
    <div
      className="hard-words-view"
      style={{
        padding: '20px',
        border: '1px solid #ccc',
        borderRadius: '8px',
        marginTop: '20px',
        backgroundColor: '#f9f9f9',
        color: '#333',
        textAlign: 'left',
      }}
    >
      <h2 style={{ marginTop: '0', marginBottom: '15px', textAlign: 'center' }}>
        Hard Words List ({hardWordsList.length}) {/* Added count to title */}
      </h2>

      {hardWordsList.length === 0 ? (
        <p style={{ fontStyle: 'italic', textAlign: 'center' }}>
          You haven't marked any words as hard yet. Use the ⭐ icon on a flashcard!
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {hardWordsList.map((pair) => (
            <li
              key={`${pair.spanish}-${pair.english}`} 
              style={{
                borderBottom: '1px solid #eee',
                padding: '10px 5px', 
                display: 'flex',
                justifyContent: 'space-between', 
                alignItems: 'center',
                gap: '10px', 
              }}
            >
              {/* Word pair display */}
              <span style={{ flexGrow: 1 /* Allow text to take up space */ }}>
                <strong>{pair.spanish}</strong> - {pair.english}
              </span>

             
              {/* Remove Button          */}
       
              <button
                onClick={() => onRemoveWord(pair)} // Call handler from App.jsx
                title={`Remove "${pair.spanish}"`}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#D90429', // Use vivid red
                  cursor: 'pointer',
                  fontSize: '1.1em', // Adjust size
                  padding: '0 5px',
                  lineHeight: '1',
                }}
              >
                &times; {/* Simple 'X' character for remove */}
                {/* Or use text: Remove */}
                {/* Or an icon: 🗑️ */}
              </button>
              {/* ============================= */}
              {/* END Remove Button           */}
              {/* ============================= */}
            </li>
          ))}
        </ul>
      )}

      {/* Close Button */}
      <button
        onClick={onClose}
        style={{
            display: 'block',
            margin: '25px auto 0 auto', 
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