import { useState, useEffect, useCallback, useRef } from 'react';
import { getTatoebaExamples } from '../services/tatoebaService.js';

function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

const MAX_WORDS_FOR_FILL_IN_BLANK = 3; 
const NUM_QUESTIONS_TO_PREFETCH = 10; 
const REFETCH_QUEUE_THRESHOLD = 3;   

export function useFillInTheBlankGame(wordList = [], numChoices = 4) {
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [gameMessage, setGameMessage] = useState('Click "Start Game" to begin!');
    const [gameScore, setGameScore] = useState(0);
    const [feedback, setFeedback] = useState({ message: '', type: '' });

    const [questionQueue, setQuestionQueue] = useState([]); 
    const isFetchingQueue = useRef(false); // Ref to prevent multiple simultaneous fetches

    const populateQuestionQueue = useCallback(async () => {
        if (!wordList || wordList.length < numChoices || isFetchingQueue.current) {
            return;
        }
        
        isFetchingQueue.current = true;
        setIsLoading(true);
        setGameMessage('Preparing your next set of questions...');
        console.log("useFillInTheBlankGame: Populating question queue...");

        const candidateWordList = wordList.filter(pair => 
            pair.spanish && 
            pair.spanish.trim().split(' ').length <= MAX_WORDS_FOR_FILL_IN_BLANK
        );

        if (candidateWordList.length < numChoices) {
            setGameMessage(`Not enough words in list to generate ${numChoices} choices for the game.`);
            setIsLoading(false);
            isFetchingQueue.current = false;
            return;
        }

        const newQuestions = [];
        let attempts = 0;
        const maxAttempts = candidateWordList.length < 20 ? candidateWordList.length : 20; 

        while (newQuestions.length < NUM_QUESTIONS_TO_PREFETCH && attempts < maxAttempts) {
            attempts++;
            const targetPair = candidateWordList[Math.floor(Math.random() * candidateWordList.length)];
            if (!targetPair || !targetPair.spanish) continue;

            const examples = await getTatoebaExamples(targetPair.spanish);
            if (!examples || examples.length === 0) continue;

            const shuffledExamples = shuffleArray(examples);
            for (const example of shuffledExamples) {
                const escapedWord = targetPair.spanish.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`\\b${escapedWord}\\b`, 'i');
                if (example.text_spa && regex.test(example.text_spa)) {
                    const sentenceWithBlank = example.text_spa.replace(regex, "_______");
                    
                    let distractors = [];
                    const shuffledCandidates = shuffleArray([...wordList]);
                    for (const distractorPair of shuffledCandidates) {
                        if (distractors.length >= numChoices - 1) break;
                        if (distractorPair.id !== targetPair.id) {
                            distractors.push(distractorPair.spanish);
                        }
                    }
                    distractors = [...new Set(distractors)].slice(0, numChoices - 1);
                    const choices = shuffleArray([targetPair.spanish, ...distractors]);

                    newQuestions.push({
                        targetPair, sentenceWithBlank, choices,
                        correctAnswer: targetPair.spanish,
                        originalSentenceSpa: example.text_spa,
                        originalSentenceEng: example.text_eng
                    });
                    break; 
                }
            }
        }
        
        setQuestionQueue(prevQueue => [...prevQueue, ...newQuestions]);
        console.log(`useFillInTheBlankGame: Added ${newQuestions.length} new questions to the queue.`);
        isFetchingQueue.current = false;
        setIsLoading(false);
        setGameMessage('');

    }, [wordList, numChoices]);

    const serveNextQuestion = useCallback(() => {
        setFeedback({ message: '', type: '' });
        setCurrentQuestion(null);

        if (questionQueue.length > 0) {
            const nextQuestion = questionQueue[0];
            setQuestionQueue(prevQueue => prevQueue.slice(1)); 
            setCurrentQuestion(nextQuestion);
        } else {
            console.log("useFillInTheBlankGame: Question queue is empty, trying to populate.");
        
            populateQuestionQueue();
        }
    }, [questionQueue, populateQuestionQueue]);

    // Effect to pre-fetch more questions when the queue gets low
    useEffect(() => {
        if (!isFetchingQueue.current && questionQueue.length > 0 && questionQueue.length <= REFETCH_QUEUE_THRESHOLD) {
            console.log(`useFillInTheBlankGame: Queue is low (${questionQueue.length}). Fetching more in background.`);
            populateQuestionQueue();
        }
    }, [questionQueue, populateQuestionQueue]);

    const submitUserChoice = useCallback((chosenWord) => {
        if (!currentQuestion) return;
        
        if (chosenWord.toLowerCase().trim() === currentQuestion.correctAnswer.toLowerCase().trim()) {
            setGameScore(prev => prev + 1);
            setFeedback({ message: 'Correct!', type: 'correct' });
            console.log("Correct!");
        } else {
            // --- Reset score if answer is incorrect ---
            setGameScore(0);
            setFeedback({ 
                message: `Oops! The correct answer was "${currentQuestion.correctAnswer}".`, 
                type: 'incorrect' 
            });
            console.log("Incorrect. Score reset.");
        }

        // Automatically serve next question after a short delay to show feedback
        setTimeout(() => {
            serveNextQuestion();
        }, 1500); 

    }, [currentQuestion, serveNextQuestion]);

    const startNewGame = useCallback(() => {
        setGameScore(0);
        setQuestionQueue([]); // Clear any old questions
        setCurrentQuestion(null); // Clear current question
        populateQuestionQueue();
    }, [populateQuestionQueue]);

    return {
        currentQuestion,
        isLoading: isLoading, 
        gameMessage,
        gameScore,
        feedback,
        submitUserChoice,
        startNewGame, 
        queueLength: questionQueue.length 
    };
}