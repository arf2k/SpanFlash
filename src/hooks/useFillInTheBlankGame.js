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

const MAX_WORDS_FOR_FILL_IN_BLANK = 3; 

export function useFillInTheBlankGame(wordList = [], numChoices = 4) {
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [isLoadingNextQuestion, setIsLoadingNextQuestion] = useState(false);
    const [gameMessage, setGameMessage] = useState('');
    const [gameScore, setGameScore] = useState(0);
    const [feedback, setFeedback] = useState({ message: '', type: '' });

    const fetchNewQuestion = useCallback(async () => {
        console.log("useFillInTheBlankGame: Fetching new question...");
        setIsLoadingNextQuestion(true);
        setGameMessage('');
        setFeedback({ message: '', type: '' });
        setCurrentQuestion(null);

        if (!wordList || wordList.length === 0) {
            setGameMessage("Word list is empty. Cannot fetch question.");
            setIsLoadingNextQuestion(false);
            return;
        }

        const candidateWordList = wordList.filter(pair => 
            pair.spanish && 
            pair.spanish.trim().split(' ').length <= MAX_WORDS_FOR_FILL_IN_BLANK
        );

        if (candidateWordList.length === 0) {
            setGameMessage(`No words/short phrases (up to ${MAX_WORDS_FOR_FILL_IN_BLANK} words) found in your list for this game.`);
            setIsLoadingNextQuestion(false);
            return;
        }

        let attempts = 0;
        const maxAttemptsToFindSentence = 10; // Try up to 10 random words from candidate list

        while (attempts < maxAttemptsToFindSentence) {
            attempts++;
            const randomIndex = Math.floor(Math.random() * candidateWordList.length);
            const targetPair = candidateWordList[randomIndex];

            if (!targetPair || !targetPair.spanish || !targetPair.english) {
                console.warn("Selected targetPair is invalid during attempt:", attempts, targetPair);
                continue; 
            }
            
            console.log(`Attempt ${attempts}: Trying word "${targetPair.spanish}" for fill-in-the-blank.`);
            const examples = await getTatoebaExamples(targetPair.spanish);

            if (examples && examples.length > 0) {
                for (const example of shuffleArray(examples)) { 
                    const spanishWordToFind = targetPair.spanish;
                    // Regex to find whole word/phrase, case insensitive
                    // Escape special regex characters in spanishWordToFind
                    const escapedWordToFind = spanishWordToFind.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp(`\\b${escapedWordToFind}\\b`, 'i');

                    if (example.text_spa && regex.test(example.text_spa)) {
                        // Replace only the first occurrence found by regex to avoid issues if word repeats
                        const sentenceWithBlank = example.text_spa.replace(regex, "_______");
                        
                        let distractors = [];
                        const tempWordListForDistractors = shuffleArray([...candidateWordList]); 
                        for (const distractorPair of tempWordListForDistractors) {
                            if (distractors.length >= numChoices - 1) break;
                            if (distractorPair.id !== targetPair.id &&
                                distractorPair.spanish.toLowerCase().trim() !== targetPair.spanish.toLowerCase().trim()) {
                                distractors.push(distractorPair.spanish);
                            }
                        }
                        // Fill remaining distractors if not enough unique ones, more robustly
                        let safetyCount = 0;
                        while(distractors.length < numChoices - 1 && safetyCount < wordList.length * 2) {
                            const randomPair = wordList[Math.floor(Math.random() * wordList.length)];
                            if (randomPair.spanish.toLowerCase().trim() !== targetPair.spanish.toLowerCase().trim() &&
                                !distractors.includes(randomPair.spanish)) {
                                distractors.push(randomPair.spanish);
                            }
                            safetyCount++;
                        }
                        // Ensure we have the correct number of distractors, even if it means fewer total choices
                        distractors = distractors.slice(0, numChoices -1);


                        const choices = shuffleArray([targetPair.spanish, ...distractors]);

                        setCurrentQuestion({
                            targetPair,
                            sentenceWithBlank,
                            choices,
                            correctAnswer: targetPair.spanish,
                            originalSentenceSpa: example.text_spa,
                            originalSentenceEng: example.text_eng
                        });
                        setIsLoadingNextQuestion(false);
                        console.log("useFillInTheBlankGame: New question set for", targetPair.spanish);
                        return; 
                    }
                }
            }
            console.log(`No suitable sentence containing "${targetPair.spanish}" found in its examples after checking ${examples?.length || 0} examples.`);
        }

        setGameMessage(`Could not find a suitable question with an example sentence after ${maxAttemptsToFindSentence} attempts. Try again or add more varied words.`);
        setIsLoadingNextQuestion(false);
        console.warn("useFillInTheBlankGame: Failed to find a suitable question.");

    }, [wordList, numChoices, getTatoebaExamples]); 


    const submitUserChoice = useCallback((chosenWord) => {
        if (!currentQuestion) return;
        console.log(`useFillInTheBlankGame: User chose "${chosenWord}", Correct is "${currentQuestion.correctAnswer}"`);
        if (chosenWord.toLowerCase().trim() === currentQuestion.correctAnswer.toLowerCase().trim()) {
            setGameScore(prev => prev + 1);
            setFeedback({ message: 'Correct!', type: 'correct' });
            console.log("Correct!");
        } else {
            setFeedback({ 
                message: `Oops! The correct answer was "${currentQuestion.correctAnswer}".`, 
                type: 'incorrect' 
            });
            console.log("Incorrect.");
        }

        setTimeout(() => {
            fetchNewQuestion();
        }, 1500); 

    }, [currentQuestion, fetchNewQuestion]);

    useEffect(() => {
        if (wordList && wordList.length > 0 && wordList.filter(p => p.spanish.trim().split(' ').length <= MAX_WORDS_FOR_FILL_IN_BLANK).length >= 1) {
            console.log("useFillInTheBlankGame: Initializing first question.");
            fetchNewQuestion();
        } else if (wordList && wordList.length > 0) {
            setGameMessage(`No words suitable (1-${MAX_WORDS_FOR_FILL_IN_BLANK} words long) for Fill-in-the-Blank found in your list.`);
        }
    }, [wordList, fetchNewQuestion, numChoices]);


    const startNewGame = useCallback(() => {
        setGameScore(0);
        // Potentially reset other session-specific tracking here if added later
        fetchNewQuestion();
    }, [fetchNewQuestion]);

    return {
        currentQuestion,
        isLoadingNextQuestion,
        gameMessage,
        gameScore,
        feedback,
        submitUserChoice,
        startNewGame 
    };
}