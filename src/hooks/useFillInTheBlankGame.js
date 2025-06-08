// src/hooks/useFillInTheBlankGame.js
import { useState, useEffect, useCallback } from 'react';
import { getTatoebaExamples } from '../services/tatoebaServices.js';

function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

export function useFillInTheBlankGame(wordList = [], numChoices = 4) {
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [gameMessage, setGameMessage] = useState('');
    const [gameScore, setGameScore] = useState(0);
    const [feedback, setFeedback] = useState({ message: '', type: '' });

    const fetchNewQuestion = useCallback(async () => {
        console.log("HOOK: Fetching a new question...");
        setIsLoading(true);
        setGameMessage('');
        setFeedback({ message: '', type: '' });
        setCurrentQuestion(null);

        if (!wordList || wordList.length < numChoices) {
            setGameMessage(`Not enough words in list to start game (need at least ${numChoices}).`);
            setIsLoading(false);
            return;
        }

        let attempts = 0;
        const maxAttempts = 15; // Try up to 15 random words to find a usable sentence
        while (attempts < maxAttempts) {
            attempts++;
            const targetPair = wordList[Math.floor(Math.random() * wordList.length)];
            if (!targetPair?.spanish) continue;

            const examples = await getTatoebaExamples(targetPair.spanish);
            if (!examples || examples.length === 0) continue;

            for (const example of shuffleArray(examples)) {
                const escapedWord = targetPair.spanish.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`\\b${escapedWord}\\b`, 'i');

                if (example.text_spa && regex.test(example.text_spa)) {
                    const sentenceWithBlank = example.text_spa.replace(regex, "_______");
                    
                    let distractors = shuffleArray(wordList.filter(p => p.id !== targetPair.id))
                                      .slice(0, numChoices - 1)
                                      .map(p => p.spanish);

                    if (distractors.length < numChoices - 1) continue;

                    const choices = shuffleArray([targetPair.spanish, ...distractors]);

                    setCurrentQuestion({
                        targetPair,
                        sentenceWithBlank,
                        choices,
                        correctAnswer: targetPair.spanish,
                        originalSentenceSpa: example.text_spa,
                        originalSentenceEng: targetPair.english, // Use the word's direct translation as prompt
                    });
                    setIsLoading(false);
                    console.log("HOOK: New question set for", targetPair.spanish);
                    return; // Exit successfully
                }
            }
        }

        setGameMessage(`Could not find a suitable sentence after ${maxAttempts} attempts. Please try again.`);
        setIsLoading(false);
    }, [wordList, numChoices]);

    const submitUserChoice = useCallback((chosenWord) => {
        if (!currentQuestion || feedback.message) return;
        
        const isCorrect = chosenWord.toLowerCase().trim() === currentQuestion.correctAnswer.toLowerCase().trim();
        setGameScore(isCorrect ? prev => prev + 1 : 0);
        setFeedback({ 
            message: isCorrect ? 'Correct!' : `Oops! The correct answer was "${currentQuestion.correctAnswer}".`, 
            type: isCorrect ? 'correct' : 'incorrect' 
        });

        // After showing feedback, wait for the user to click "Next" in the UI.
        // We will remove the automatic advance for now to stabilize.
    }, [currentQuestion]);

    const startNewGame = useCallback(() => {
        setGameScore(0);
        fetchNewQuestion();
    }, [fetchNewQuestion]);

    // This effect initializes the very first game when the hook mounts with a valid list
    useEffect(() => {
        if (wordList && wordList.length >= numChoices) {
            startNewGame();
        }
    // We disable the lint rule here because we truly only want this effect
    // to run when the wordList reference changes, not startNewGame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [wordList, numChoices]);

    return {
        currentQuestion,
        isLoading,
        gameMessage,
        gameScore,
        feedback,
        submitUserChoice,
        startNewGame,
        fetchNewQuestion, // Expose this so the "Next" button can call it
    };
}