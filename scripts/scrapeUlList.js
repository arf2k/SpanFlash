const mainContentSelector = 'div.the_content';
const listWithinMainSelector = 'ul';
const itemSelectorInList = 'li';
const spanishWordAnchorSelector = 'a.tts-link'; 
const spanishWordActualTagSelector = 'em';    
const wordData = [];
const mainContentDiv = document.querySelector(mainContentSelector);

if (mainContentDiv) {
    const ulElement = mainContentDiv.querySelector(listWithinMainSelector);
    if (ulElement) {
        const liElements = ulElement.querySelectorAll(itemSelectorInList);

        liElements.forEach((li) => {
            let englishWord = '';
            let spanishWord = '';

            const anchorElement = li.querySelector(spanishWordAnchorSelector);

            if (anchorElement) {
             
                const spanishTagElement = anchorElement.querySelector(spanishWordActualTagSelector);
                if (spanishTagElement) {
                    spanishWord = spanishTagElement.innerText.trim();
                } else {
                   
                    spanishWord = anchorElement.innerText.trim();
                }

                let currentNode = anchorElement.nextSibling;
                let rawFollowingText = '';
                while (currentNode) {
                    if (currentNode.nodeType === Node.TEXT_NODE) { 
                        rawFollowingText += currentNode.nodeValue;
                    }
                    currentNode = currentNode.nextSibling;
                }
                rawFollowingText = rawFollowingText.trim();
                if (rawFollowingText.startsWith('—')) {
                    englishWord = rawFollowingText.substring(rawFollowingText.indexOf('—') + 1).trim();
                }
            }

        
            if (englishWord && spanishWord) {
                wordData.push({
                    english: englishWord, 
                    spanish: spanishWord
                });
            }
        });
    }
}


const jsonOutput = JSON.stringify(wordData, null, 2);

console.log("Extracted Word Pairs for Flashcards (JSON):");
if (wordData.length > 0) {
    console.log(jsonOutput);
} else {
    console.log("[] (No word pairs were extracted. Check selectors or page structure.)");
}