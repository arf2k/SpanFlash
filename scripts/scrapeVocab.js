/**
 * Finds pairs of Spanish (UO6pWUJR) and English (xLusdC9B) words
 * assuming the English element immediately follows the Spanish element,
 * and outputs them as a JSON array of objects.
 */

// --- Configuration ---
const spanishClass = 'UO6pWUJR';
const englishClass = 'xLusdC9B';
// --- End Configuration ---

// --- Logic ---
const wordPairs = [];
// Select all the Spanish word elements first.
const spanishElements = document.querySelectorAll(`.${spanishClass}`);

// Loop through each found Spanish element.
spanishElements.forEach(spanishElement => {
  // Find the very next element in the HTML structure.
  const nextElement = spanishElement.nextElementSibling;

  // Check if that next element exists AND has the correct English class.
  if (nextElement && nextElement.classList.contains(englishClass)) {
    // If we found a match, extract the text for both.
    const spanishText = spanishElement.innerText.trim();
    const englishText = nextElement.innerText.trim();

    // Add the pair as an object to our results array.
    if (spanishText && englishText) { // Ensure neither text is empty
       wordPairs.push({
         spanish: spanishText,
         english: englishText
       });
    }
  } 
  // Optional: Handle cases where a Spanish word doesn't have an English pair right after it
  // else {
  //   console.warn('Could not find matching English word immediately after:', spanishElement.innerText);
  // }
});

// --- Output ---
// Convert the array of pair objects into a JSON string.
// The 'null, 2' arguments make the output nicely formatted (indented).
const jsonOutput = JSON.stringify(wordPairs, null, 2);

// Log the JSON string to the console.
console.log("Extracted Word Pairs (JSON):");
console.log(jsonOutput);

// Optional: Log the array of objects directly (useful for further manipulation in console)
// console.log("\nWord Pairs (JavaScript Array):");
// console.log(wordPairs);