import { useState, useEffect } from 'react';
import { db } from '../db';

export function useWordData() {
    const [wordList, setWordList] = useState([]);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [dataError, setDataError] = useState(null);
    const [currentDataVersion, setCurrentDataVersion] = useState(null);

    useEffect(() => {
        const loadWordDataAsync = async () => {
            console.log("useWordData: Starting to load word data with version check...");
            setIsLoadingData(true);
            setDataError(null);
            setCurrentDataVersion(null);
            setWordList([]); 

            let remoteVersion = null;
            let remoteWordsArray = [];

            try {
                console.log("useWordData: Fetching remote word list (/scrapedSpan411.json)...");
                const response = await fetch("/scrapedSpan411.json");
                if (!response.ok) {
                    throw new Error(`Failed to fetch word list: ${response.status} ${response.statusText}`);
                }
                const remoteJsonData = await response.json();

                if (typeof remoteJsonData.version !== 'string' || !Array.isArray(remoteJsonData.words)) {
                    console.error("useWordData: Fetched JSON data structure is invalid.", remoteJsonData);
                    throw new Error("Fetched word list data is not in the expected format.");
                }
                remoteVersion = remoteJsonData.version;
                remoteWordsArray = remoteJsonData.words;
                console.log(`useWordData: Remote JSON version: '${remoteVersion}', contains ${remoteWordsArray.length} pairs.`);

                const localDataVersionState = await db.appState.get('dataVersion');
                const localVersion = localDataVersionState ? localDataVersionState.version : null;
                setCurrentDataVersion(localVersion);
                console.log(`useWordData: Local stored data version: '${localVersion}'`);

                let wordsToSetInState = [];

                if (!localVersion || remoteVersion !== localVersion) {
                    console.log(
                        !localVersion ? 'useWordData: No local data version found.' : `useWordData: Remote version ('${remoteVersion}') differs from local ('${localVersion}').`
                    );
                    console.log('useWordData: Refreshing local word database...');

                    const validRemoteWords = remoteWordsArray.filter(
                        (item) =>
                            item &&
                            typeof item.spanish === 'string' && item.spanish.trim().length > 0 &&
                            typeof item.english === 'string' && item.english.trim().length > 0
                    );

                    if (remoteWordsArray.length > 0 && validRemoteWords.length !== remoteWordsArray.length) {
                        console.warn(
                            "useWordData: Some items were filtered out from remote JSON before DB population."
                        );
                    }
                    
                    if (validRemoteWords.length > 0) {
                        await db.allWords.clear();
                        await db.allWords.bulkPut(validRemoteWords); 
                        await db.appState.put({ id: 'dataVersion', version: remoteVersion });
                        setCurrentDataVersion(remoteVersion);
                        console.log(`useWordData: Successfully populated IndexedDB from remote. New local version: '${remoteVersion}'`);
                        
                    
                        wordsToSetInState = await db.allWords.toArray();
                        console.log(`useWordData: Fetched ${wordsToSetInState.length} words from DB to update state with IDs.`);
                     

                    } else if (remoteWordsArray.length > 0 && validRemoteWords.length === 0) {
                        console.error("useWordData: Remote JSON had words, but all were invalid. Clearing local data.");
                        await db.allWords.clear();
                        await db.appState.put({ id: 'dataVersion', version: remoteVersion });
                        setCurrentDataVersion(remoteVersion);
                        wordsToSetInState = [];
                        setDataError("The new word list was empty or contained no valid words.");
                    } else {
                        console.warn("useWordData: Remote JSON word list is empty. Clearing local data.");
                        await db.allWords.clear();
                        await db.appState.put({ id: 'dataVersion', version: remoteVersion });
setCurrentDataVersion(remoteVersion);
                        wordsToSetInState = [];
                    }
                } else {
                    console.log(`useWordData: Data version '${localVersion}' is up to date. Loading from local DB.`);
                    const currentLocalWords = await db.allWords.toArray();
                    wordsToSetInState = currentLocalWords;
                 
                    if (wordsToSetInState.length === 0 && remoteWordsArray.length > 0) {
                        console.warn("useWordData: Local DB empty despite matching versions. Re-populating from remote.");
                         const validRemoteWordsForRepopulate = remoteWordsArray.filter(
                            (item) =>
                                item &&
                                typeof item.spanish === 'string' && item.spanish.trim().length > 0 &&
                                typeof item.english === 'string' && item.english.trim().length > 0
                        );
                        if (validRemoteWordsForRepopulate.length > 0) {
                            await db.allWords.clear(); 
                            await db.allWords.bulkPut(validRemoteWordsForRepopulate);
                          
                            wordsToSetInState = await db.allWords.toArray();
                            console.log(`useWordData: Re-populated local DB with ${wordsToSetInState.length} words with IDs.`);
                            // *** END MODIFICATION ***
                        }
                    }
                }
                setWordList(wordsToSetInState);

            } catch (err) {
                console.error("useWordData: MAJOR ERROR during word data load or version check:", err);
                setDataError(`Failed to load word data: ${err.message}.`);
                try {
                    console.warn("useWordData: Attempting fallback to local DB for word list...");
                    const fallbackWords = await db.allWords.toArray(); // These will have IDs
                    setWordList(fallbackWords);
                    const localDataVersionState = await db.appState.get('dataVersion');
                    if (localDataVersionState) setCurrentDataVersion(localDataVersionState.version);
                    if (fallbackWords.length > 0) {
                        console.log(`useWordData: Fallback successful. Loaded ${fallbackWords.length} words from local DB.`);
                        setDataError(null); 
                    } else {
                         console.warn("useWordData: Fallback failed, local DB also empty.");
                    }
                } catch (dbError) {
                    console.error("useWordData: Fallback to local DB also failed:", dbError);
                }
            } finally {
                setIsLoadingData(false);
                console.log("useWordData: Word data loading sequence finished.");
            }
        };

        loadWordDataAsync();
    }, []); 

    // Remember to return setWordList if App.jsx needs to modify wordList directly (e.g., after adding a new word)
    return { wordList, isLoadingData, dataError, currentDataVersion, setWordList };
}