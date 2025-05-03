/**
 * Finds pairs of Spanish (UO6pWUJR) and English (xLusdC9B) words
 * assuming the English element immediately follows the Spanish element,
 * and outputs them as a JSON array of objects.
 * Uses class names confirmed working as of May 3rd ~4:28 PM.
 */

// --- Configuration ---
const spanishClass = 'UO6pWUJR'; // Confirmed working (Letter 'O')
const englishClass = 'xLusdC9B'; // Confirmed working (lowercase 'x', uppercase 'C')
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

    // Add the pair as an object to our results array, only if both texts are non-empty.
    if (spanishText && englishText) { 
       wordPairs.push({
         spanish: spanishText,
         english: englishText
       });
    }
  } 
});

// --- Output ---
// Convert the array of pair objects into a JSON string.
const jsonOutput = JSON.stringify(wordPairs, null, 2);

// Log the JSON string to the console.
console.log("Extracted Word Pairs (JSON):");
// Handle case where no pairs were extracted despite finding Spanish elements
if (jsonOutput === "[]" && spanishElements.length > 0) {
     console.log("[] (Found Spanish elements, but couldn't find matching English pairs immediately after. Check HTML structure.)");
} else if (jsonOutput === "[]") {
     console.log("[] (No Spanish elements found with the specified class.)");
}
else {
    console.log(jsonOutput); 
}