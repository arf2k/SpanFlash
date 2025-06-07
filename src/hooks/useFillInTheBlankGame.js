import { useState, useEffect, useCallback, useRef } from 'react';
import { getTatoebaExamples } from '../services/tatoebaServices.js';

function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

const MAX_WORDS_FOR_FILL_IN_BLANK = 3; 
const NUM_QUESTIONS_TO_PREFETCH = 5;  
const REFETCH_QUEUE_THRESHOLD = 2;   
export function useFillInTheBlankGame(wordList = [], numChoices = 4) {
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [gameMessage, setGameMessage] = useState('');
    const [gameScore, setGameScore] = useState(0);
    const [feedback, setFeedback] = useState({ message: '', type: '' });

    const [questionQueue, setQuestionQueue] = useState([]);
    const isFetchingQueue = useRef(false);

    const fetchQuestionBatch = useCallback(async () => {
        if (!wordList || wordList.length < numChoices || isFetchingQueue.current) {
            return []; 
        }
        
        isFetchingQueue.current = true;
        console.log("useFillInTheBlankGame: Starting background fetch for question batch...");

        const candidateWordList = wordList.filter(pair => 
            pair.spanish && pair.spanish.trim().split(' ').length <= MAX_WORDS_FOR_FILL_IN_BLANK
        );

        if (candidateWordList.length < numChoices) {
            isFetchingQueue.current = false;
            return [];
        }

        const newQuestions = [];
        const maxWordsToTry = Math.min(candidateWordList.length, 15);
        const shuffledCandidates = shuffleArray(candidateWordList);

        const promises = shuffledCandidates.slice(0, maxWordsToTry).map(async (targetPair) => {
            if (!targetPair || !targetPair.spanish) return null;
            
            const examples = await getTatoebaExamples(targetPair.spanish);
            if (!examples || examples.length === 0) return null;
            
            for (const example of shuffleArray(examples)) {
                const escapedWord = targetPair.spanish.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`\\b${escapedWord}\\b`, 'i');

                if (example.text_spa && regex.test(example.text_spa)) {
                    const sentenceWithBlank = example.text_spa.replace(regex, "_______");
                    
                    let distractors = [];
                    const tempWordListForDistractors = shuffleArray([...candidateWordList]);
                    for (const distractorPair of tempWordListForDistractors) {
                        if (distractors.length >= numChoices - 1) break;
                        if (distractorPair.id !== targetPair.id) {
                            distractors.push(distractorPair.spanish);
                        }
                    }
                    distractors = [...new Set(distractors)];

                    if (distractors.length < numChoices - 1) continue; 

                    const choices = shuffleArray([targetPair.spanish, ...distractors]);

                    return {
                        targetPair, sentenceWithBlank, choices,
                        correctAnswer: targetPair.spanish,
                        originalSentenceSpa: example.text_spa,
                        originalSentenceEng: example.text_eng
                    };
                }
            }
            return null; 
        });

        const settledResults = await Promise.allSettled(promises);
        settledResults.forEach(res => {
            if (res.status === 'fulfilled' && res.value) {
                newQuestions.push(res.value);
            }
        });
        
        console.log(`useFillInTheBlankGame: Background fetch complete. Added ${newQuestions.length} new questions.`);
        isFetchingQueue.current = false;
        return newQuestions;

    }, [wordList, numChoices]);

    const serveNextQuestion = useCallback(() => {
        setFeedback({ message: '', type: '' });
        setCurrentQuestion(null);
        setIsLoading(true);

        if (questionQueue.length > 0) {
            const nextQuestion = questionQueue[0];
            setQuestionQueue(prevQueue => prevQueue.slice(1)); 
            setCurrentQuestion(nextQuestion);
            setIsLoading(false);
        } else {
            console.log("useFillInTheBlankGame: Queue is empty. Fetching a new batch now.");
            fetchQuestionBatch().then(newQuestions => {
                if (newQuestions.length > 0) {
                    setCurrentQuestion(newQuestions[0]);
                    setQuestionQueue(newQuestions.slice(1));
                } else {
                    setGameMessage("Could not load a new question. Please try starting a new game.");
                }
                setIsLoading(false);
            });
        }
    }, [questionQueue, fetchQuestionBatch]);

    useEffect(() => {
        if (questionQueue.length <= REFETCH_QUEUE_THRESHOLD && !isFetchingQueue.current) {
            console.log(`useFillInTheBlankGame: Queue is low (${questionQueue.length}). Pre-fetching more in background.`);
            fetchQuestionBatch().then(newQuestions => {
                setQuestionQueue(prevQueue => [...prevQueue, ...newQuestions]);
            });
        }
    }, [questionQueue.length, fetchQuestionBatch]);


    const submitUserChoice = useCallback((chosenWord) => {
        if (!currentQuestion) return;
        
        if (chosenWord.toLowerCase().trim() === currentQuestion.correctAnswer.toLowerCase().trim()) {
            setGameScore(prev => prev + 1);
            setFeedback({ message: 'Correct!', type: 'correct' });
        } else {
            setGameScore(0);
            setFeedback({ 
                message: `Oops! The correct answer was "${currentQuestion.correctAnswer}".`, 
                type: 'incorrect' 
            });
        }

        setTimeout(() => {
            serveNextQuestion();
        }, 1500); 

    }, [currentQuestion, serveNextQuestion]);

    const startNewGame = useCallback(() => {
        setGameScore(0);
        setQuestionQueue([]); 
        setCurrentQuestion(null);
        setIsLoading(true);
        setGameMessage('Preparing your game...');
        
        fetchQuestionBatch().then(newQuestions => {
            if (newQuestions.length > 0) {
                setCurrentQuestion(newQuestions[0]);
                setQuestionQueue(newQuestions.slice(1));
                setGameMessage('');
            } else {
                setGameMessage("Could not start game. Try again or check your word list.");
            }
            setIsLoading(false);
        });
    }, [fetchQuestionBatch]);

    useEffect(() => {
        if (wordList && wordList.length >= numChoices) {
            startNewGame();
        }
    }, [wordList, numChoices]);

    return {
        currentQuestion,
        isLoading,
        gameMessage,
        gameScore,
        feedback,
        submitUserChoice,
        startNewGame, 
    };
}