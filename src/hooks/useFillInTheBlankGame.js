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
    const [isLoadingNextQuestion, setIsLoadingNextQuestion] = useState(true);
    const [gameMessage, setGameMessage] = useState('');
    const [gameScore, setGameScore] = useState(0);
    const [feedback, setFeedback] = useState({ message: '', type: '' });

    const fetchNewQuestion = useCallback(async () => {
        setIsLoadingNextQuestion(true);
        setGameMessage('');
        setFeedback({ message: '', type: '' });
        setCurrentQuestion(null);

        if (!wordList || wordList.length < numChoices) {
            setGameMessage(`Not enough words in list to start game (need at least ${numChoices}).`);
            setIsLoadingNextQuestion(false);
            return;
        }

        // --- NEW, SMARTER LOGIC ---
        // 1. Prioritize non-verbs (nouns, adjectives, short phrases) as they are easier to match in sentences.
        const verbRegex = /ar$|er$|ir$/;
        const candidateWordList = wordList.filter(pair => 
            pair.spanish && !verbRegex.test(pair.spanish.trim())
        );

        if (candidateWordList.length < numChoices) {
            setGameMessage(`Not enough non-verb words in your list to play this game.`);
            setIsLoadingNextQuestion(false);
            return;
        }
        
        // 2. Pick a batch of candidates and fetch for them in parallel
        const shuffledCandidates = shuffleArray(candidateWordList);
        const candidatesToFetch = shuffledCandidates.slice(0, 5); // Try 5 words at once

        const promises = candidatesToFetch.map(pair => 
            getTatoebaExamples(pair.spanish).then(examples => ({ targetPair: pair, examples: examples || [] }))
        );

        const results = await Promise.allSettled(promises);
        
        let questionData = null;

        // 3. Use the first successful result from the parallel fetch
        for (const result of results) {
            if (result.status === 'fulfilled' && result.value.examples.length > 0) {
                const { targetPair, examples } = result.value;
                for (const example of shuffleArray(examples)) {
                    const escapedWord = targetPair.spanish.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp(`\\b${escapedWord}\\b`, 'i');

                    if (example.text_spa && regex.test(example.text_spa)) {
                        const sentenceWithBlank = example.text_spa.replace(regex, "_______");
                        let distractors = shuffleArray(candidateWordList.filter(p => p.id !== targetPair.id)).slice(0, numChoices - 1).map(p => p.spanish);
                        if (distractors.length < numChoices - 1) continue;

                        const choices = shuffleArray([targetPair.spanish, ...distractors]);
                        questionData = { targetPair, sentenceWithBlank, choices, correctAnswer: targetPair.spanish };
                        break; 
                    }
                }
            }
            if (questionData) break; 
        }
        // --- END NEW LOGIC ---

        if (questionData) {
            setCurrentQuestion(questionData);
        } else {
            setGameMessage("Could not find a suitable example sentence. Please try again.");
            console.warn("useFillInTheBlankGame: Failed to find any suitable question from the batch.");
        }
        setIsLoadingNextQuestion(false);
        
    }, [wordList, numChoices]);

    const submitUserChoice = useCallback((chosenWord) => {
        if (!currentQuestion) return;
        
        if (chosenWord.toLowerCase().trim() === currentQuestion.correctAnswer.toLowerCase().trim()) {
            setGameScore(prev => prev + 1);
            setFeedback({ message: 'Correct!', type: 'correct' });
        } else {
            setGameScore(0);
            setFeedback({ 
                message: `The correct answer was "${currentQuestion.correctAnswer}".`, 
                type: 'incorrect' 
            });
        }
        setTimeout(() => fetchNewQuestion(), 2000); 

    }, [currentQuestion, fetchNewQuestion]);

    const startNewGame = useCallback(() => {
        setGameScore(0);
        fetchNewQuestion();
    }, [fetchNewQuestion]);

    useEffect(() => {
        if (wordList && wordList.length >= numChoices) {
            startNewGame();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [wordList]);

    return { currentQuestion, isLoadingNextQuestion, gameMessage, gameScore, feedback, submitUserChoice, startNewGame };
}