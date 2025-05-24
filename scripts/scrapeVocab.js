const spanishClass = 'UO6pWUJR'; 
const englishClass = 'xLusdC9B'; 

const wordPairs = [];
const spanishElements = document.querySelectorAll(`.${spanishClass}`);

spanishElements.forEach(spanishElement => {
  const nextElement = spanishElement.nextElementSibling;

  if (nextElement && nextElement.classList.contains(englishClass)) {
    const spanishText = spanishElement.innerText.trim();
    const englishText = nextElement.innerText.trim();

   
    if (spanishText && englishText) { 
       wordPairs.push({
         spanish: spanishText,
         english: englishText
       });
    }
  } 
});


const jsonOutput = JSON.stringify(wordPairs, null, 2);

console.log("Extracted Word Pairs (JSON):");
if (jsonOutput === "[]" && spanishElements.length > 0) {
     console.log("[] (Found Spanish elements, but couldn't find matching English pairs immediately after. Check HTML structure.)");
} else if (jsonOutput === "[]") {
     console.log("[] (No Spanish elements found with the specified class.)");
}
else {
    console.log(jsonOutput); 
}