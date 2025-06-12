import { useState, useEffect } from 'react';
import { ConjugationService } from '../services/conjugationService.js';
import { updateWordLeitnerData, shuffleArray } from '../utils/gameUtils';
import { normalizeForAnswerCheck } from '../utils/textUtils.js'; 
import './VerbConjugationGame.css';

export default function VerbConjugationGameView({ 
  wordList, 
  onExitGame 
}) {
  const [conjugationService] = useState(() => new ConjugationService());
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [score, setScore] = useState({ correct: 0, incorrect: 0 });
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [verbWords, setVerbWords] = useState([]);
  const [showAnswer, setShowAnswer] = useState(false);
  const [gameCompleted, setGameCompleted] = useState(false);

  useEffect(() => {
    const initializeGame = async () => {
      setIsLoading(true);
    
           
      const likelyVerbs = wordList.filter(word => 
        conjugationService.isVerb(word.spanish)
      );

  
      const shuffledLikelyVerbs = shuffleArray(likelyVerbs);
      const verbsToTest = shuffledLikelyVerbs.slice(0, 50);
      
      console.log(`Found ${likelyVerbs.length} potential verbs, testing up to 50 of them.`);
      
   // Create promises for parallel verb testing (much faster)
const verbTestPromises = verbsToTest.slice(0, 25).map(async (word) => {
  try {
    const question = await conjugationService.generateConjugationQuestion(word);
    return question ? word : null;
  } catch (error) {
    console.warn(`Failed to test verb ${word.spanish}:`, error);
    return null;
  }
});

// Wait for all tests to complete simultaneously
const testResults = await Promise.all(verbTestPromises);

// Filter successful verbs and take first 20
const confirmedVerbs = testResults.filter(word => word !== null).slice(0, 20);
      
      console.log(`Confirmed ${confirmedVerbs.length} working verbs`);
      setVerbWords(confirmedVerbs);
      setIsLoading(false);
      
      if (confirmedVerbs.length > 0) {
        generateNewQuestion(confirmedVerbs);
      }
    };

    if (wordList && wordList.length > 0 && !gameCompleted) {
      initializeGame();
    }
  }, [wordList, gameCompleted, conjugationService]);


  const generateNewQuestion = async (words = verbWords) => {
    if (words.length === 0) return;
    
    setIsLoading(true);
    const randomWord = words[Math.floor(Math.random() * words.length)];
  const question = await conjugationService.generateConjugationQuestion(randomWord);
    
    if (question) {
      setCurrentQuestion(question);
      setUserAnswer('');
      setFeedback(null);
      setShowAnswer(false);
    }
    setIsLoading(false);
  };

  const checkAnswer = async () => {
    if (!currentQuestion || !userAnswer.trim()) return;
    
     const normalizedUserAnswer = normalizeForAnswerCheck(userAnswer);
    const normalizedCorrectAnswer = normalizeForAnswerCheck(currentQuestion.answer);

    const isCorrect = normalizedUserAnswer === normalizedCorrectAnswer;
    
 
    
    setFeedback({
      isCorrect,
      userAnswer: userAnswer.trim(),
      correctAnswer: currentQuestion.answer,
      fullAnswer: currentQuestion.fullAnswer
    });
    setShowAnswer(true);
    
    // Update Leitner data using your existing function
    try {
      await updateWordLeitnerData(currentQuestion.word, isCorrect, "Conjugation");
    } catch (error) {
      console.error('Failed to update Leitner data:', error);
    }
    
    // Update local score
    if (isCorrect) {
      setScore(prev => ({ ...prev, correct: prev.correct + 1 }));
    } else {
      setScore(prev => ({ ...prev, incorrect: prev.incorrect + 1 }));
    }
    
    setQuestionsAnswered(prev => prev + 1);
  };

  const nextQuestion = () => {
    if (questionsAnswered >= 10) {
      setGameCompleted(true);
      return;
    }
    generateNewQuestion();
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      if (showAnswer) {
        nextQuestion();
      } else {
        checkAnswer();
      }
    }
  };

  const handleExitGame = () => {
    onExitGame();
  };

  if (isLoading && !currentQuestion) {
    return (
      <div className="verb-conjugation-game-container loading-container">
        <h2>🎮 Verb Conjugation Game</h2>
        <div className="verb-conjugation-loading-spinner"></div>
        <p className="verb-conjugation-loading-text">Loading verb conjugations...</p>
        <button onClick={handleExitGame} className="verb-conjugation-exit-button">
          Exit Game
        </button>
      </div>
    );
  }

  if (verbWords.length === 0) {
    return (
      <div className="verb-conjugation-game-container no-verbs-container">
        <h2>🎮 Verb Conjugation Game</h2>
        <h3 className="verb-conjugation-no-verbs-title">No Verbs Found</h3>
        <p className="verb-conjugation-no-verbs-message">
          We couldn't find any verbs in your word list that work with the conjugation service.
        </p>
        <p className="verb-conjugation-no-verbs-hint">
          Try adding some Spanish verbs ending in -ar, -er, or -ir to your word list.
        </p>
        <button onClick={handleExitGame} className="verb-conjugation-back-button">
          Back to Main Menu
        </button>
      </div>
    );
  }

  if (gameCompleted) {
    return (
      <div className="verb-conjugation-game-container completed-container">
        <h2>🎮 Verb Conjugation Game</h2>
        <h3 className="verb-conjugation-completed-title">🎉 Game Complete!</h3>
        <div className="verb-conjugation-final-score">
          <div className="correct">✅ Correct: {score.correct}</div>
          <div className="incorrect">❌ Incorrect: {score.incorrect}</div>
          <div className="verb-conjugation-accuracy">
            Accuracy: {score.correct + score.incorrect > 0 
              ? Math.round((score.correct / (score.correct + score.incorrect)) * 100) 
              : 0}%
          </div>
        </div>
        <p className="verb-conjugation-completion-message">
          Your progress has been saved to the Leitner system!
        </p>
        <div className="verb-conjugation-completion-actions">
          <button 
            onClick={() => {
              setGameCompleted(false);
              setQuestionsAnswered(0);
              setScore({ correct: 0, incorrect: 0 });
              generateNewQuestion();
            }}
            className="verb-conjugation-play-again-button"
          >
            Play Again
          </button>
          <button onClick={handleExitGame} className="verb-conjugation-back-button">
            Back to Main Menu
          </button>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="verb-conjugation-game-container loading-container">
        <h2>🎮 Verb Conjugation Game</h2>
        <div className="verb-conjugation-loading-spinner"></div>
        <p className="verb-conjugation-loading-text">Generating question...</p>
        <button onClick={handleExitGame} className="verb-conjugation-exit-button">
          Exit Game
        </button>
      </div>
    );
  }

  return (
    <div className="verb-conjugation-game-container">
      {/* Header */}
      <div className="verb-conjugation-game-header">
        <h2>🎮 Verb Conjugation Game</h2>
        <button onClick={handleExitGame} className="verb-conjugation-exit-button">
          Exit Game
        </button>
      </div>

      {/* Score and Progress */}
      <div className="verb-conjugation-score-progress">
        <span className="verb-conjugation-score">
          <span className="correct">✅ {score.correct}</span> | <span className="incorrect">❌ {score.incorrect}</span>
        </span>
        <span>Question: {questionsAnswered + 1}/10</span>
      </div>

      {/* Progress Bar */}
      <div className="verb-conjugation-progress-bar">
        <div 
          className="verb-conjugation-progress-fill"
          style={{ width: `${(questionsAnswered / 10) * 100}%` }}
        />
      </div>

      {/* Question */}
      <div className="verb-conjugation-question-area">
        <h3 className="verb-conjugation-question-text">
          {currentQuestion.question}
        </h3>
        <p className="verb-conjugation-english-meaning">
          English meaning: <strong>{currentQuestion.englishMeaning}</strong>
        </p>

        {/* Answer Input */}
        <input
          type="text"
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type the conjugated verb..."
          disabled={showAnswer}
          className="verb-conjugation-answer-input"
        />

        {/* Buttons */}
        <div className="verb-conjugation-button-area">
          {!showAnswer ? (
            <button
              onClick={checkAnswer}
              disabled={!userAnswer.trim() || isLoading}
              className="verb-conjugation-check-button"
            >
              Check Answer
            </button>
          ) : (
            <button
              onClick={nextQuestion}
              className="verb-conjugation-next-button"
            >
              {questionsAnswered >= 10 ? 'Finish Game' : 'Next Question'}
            </button>
          )}
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`verb-conjugation-feedback ${feedback.isCorrect ? 'correct' : 'incorrect'}`}>
          <div className="verb-conjugation-feedback-title">
            {feedback.isCorrect ? '✅ Correct!' : '❌ Incorrect'}
          </div>
          
          {!feedback.isCorrect && (
            <div className="verb-conjugation-feedback-details">
              <div>Your answer: <strong className="verb-conjugation-user-answer">{feedback.userAnswer}</strong></div>
              <div>Correct answer: <strong className="verb-conjugation-correct-answer">{feedback.correctAnswer}</strong></div>
              <div className="verb-conjugation-full-form">
                Full form: {feedback.fullAnswer}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="verb-conjugation-instructions">
        Press Enter to {showAnswer ? 'continue' : 'check your answer'}
      </div>
    </div>
  );
}