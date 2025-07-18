import React, { useState, useEffect, useCallback, useRef } from "react";

import "./SearchModal.css";

const AddWordModal = ({ isOpen, onClose, onAddWord, initialSpanish = "" }) => {
  const [spanish, setSpanish] = useState("");
  const [english, setEnglish] = useState("");
  const [notes, setNotes] = useState("");
  const [synonymsSpanishInput, setSynonymsSpanishInput] = useState("");
  const [synonymsEnglishInput, setSynonymsEnglishInput] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState("");

  const modalContentRef = useRef(null);
  const spanishInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setSpanish(initialSpanish || "");
      setEnglish("");
      setNotes("");
      setSynonymsSpanishInput("");
      setSynonymsEnglishInput("");
      setCategory("");
      setError("");

      setTimeout(() => {
        if (initialSpanish) {
          const englishInput = document.getElementById("englishWord");
          if (englishInput) {
            englishInput.focus();
          }
        } else if (spanishInputRef.current) {
          spanishInputRef.current.focus();
        }
      }, 100);
    }
  }, [isOpen, initialSpanish]);

  const handleEscapeKey = useCallback(
    (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleEscapeKey);
    } else {
      document.removeEventListener("keydown", handleEscapeKey);
    }
    return () => {
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [isOpen, handleEscapeKey]);

  const handleClickOutside = useCallback(
    (event) => {
      if (
        modalContentRef.current &&
        !modalContentRef.current.contains(event.target)
      ) {
        onClose();
      }
    },
    [onClose]
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!spanish.trim() || !english.trim()) {
      setError("Spanish and English fields are required.");
      return;
    }
    setError("");

    const newWord = {
      spanish: spanish.trim(),
      english: english.trim(),
      notes: notes.trim(),
      // Split comma-separated synonyms into arrays, trimming whitespace
      synonyms_spanish: synonymsSpanishInput
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s),
      synonyms_english: synonymsEnglishInput
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s),
      category: category.trim(),
    };
    onAddWord(newWord);
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="search-modal-overlay" onClick={handleClickOutside}>
      <div
        className="search-modal-content"
        ref={modalContentRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="search-modal-header">
          <h2>
            {initialSpanish
              ? `Add "${initialSpanish}" to Vocabulary`
              : "Add New Word Pair"}
          </h2>
          <button onClick={onClose} className="search-modal-close-btn">
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit} className="add-word-form">
          {error && (
            <p style={{ color: "red", textAlign: "center" }}>{error}</p>
          )}
          <div className="form-group">
            <label htmlFor="spanishWord">Spanish Word/Phrase*:</label>
            <input
              id="spanishWord"
              ref={spanishInputRef}
              type="text"
              value={spanish}
              onChange={(e) => setSpanish(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="englishWord">English Translation*:</label>
            <input
              id="englishWord"
              type="text"
              value={english}
              onChange={(e) => setEnglish(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="notes">Notes:</label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows="3"
            />
          </div>
          <div className="form-group">
            <label htmlFor="synonymsSpanish">
              Spanish Synonyms (comma-separated):
            </label>
            <input
              id="synonymsSpanish"
              type="text"
              value={synonymsSpanishInput}
              onChange={(e) => setSynonymsSpanishInput(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="synonymsEnglish">
              English Synonyms (comma-separated):
            </label>
            <input
              id="synonymsEnglish"
              type="text"
              value={synonymsEnglishInput}
              onChange={(e) => setSynonymsEnglishInput(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="category">Category:</label>
            <input
              id="category"
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
          <div
            className="form-actions"
            style={{ textAlign: "right", marginTop: "20px" }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{ marginRight: "10px" }}
            >
              Cancel
            </button>
            <button type="submit" className="submit-button">
              Add Word
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddWordModal;
