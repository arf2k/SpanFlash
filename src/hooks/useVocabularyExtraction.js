import { useState, useEffect } from "react";
import { spanishVerbLemmatizer } from "../utils/verbLemmatizer";

export function useVocabularyExtraction(existingVocabulary = []) {
  const [inputText, setInputText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [unknownWords, setUnknownWords] = useState([]);
  const [selectedWords, setSelectedWords] = useState(new Set());
  const [analysisStats, setAnalysisStats] = useState(null);
  const [isLemmatizerReady, setIsLemmatizerReady] = useState(false);

  // Initialize verb lemmatizer
  useEffect(() => {
    initializeLemmatizer();
  }, []);

  const initializeLemmatizer = async () => {
    if (spanishVerbLemmatizer.isInitialized) {
      setIsLemmatizerReady(true);
      return;
    }

    try {
      const response = await fetch("/conjugations.json");
      const verbData = await response.json();
      await spanishVerbLemmatizer.initialize(verbData);
      setIsLemmatizerReady(true);
      console.log("✅ Hybrid verb lemmatizer initialized (JSON + Rules)");
    } catch (error) {
      console.error("Failed to initialize verb lemmatizer:", error);
      setIsLemmatizerReady(false);
    }
  };
  const extractWordsFromText = (text) => {
    return text
      .toLowerCase()
      .replace(/[¿¡]/g, "")
      .replace(/[.,;:!?"'()—–\-\[\]{}]/g, " ")
      .split(/\s+/)
      .map((word) => word.trim())
      .filter((word) => word.length > 0 && word.length <= 25)
      .filter((word) => !/^\d+$/.test(word));
  };

  const getSingularForms = (word) => {
    const forms = [word];

    // Handle common Spanish plural patterns
    if (word.endsWith("s")) {
      // Pattern 1: vowel + s (casas → casa, empresas → empresa)
      if (word.length > 2 && "aeiou".includes(word[word.length - 2])) {
        forms.push(word.slice(0, -1));
      }

      // Pattern 2: consonant + es (compañías → compañía, colores → color)
      if (word.endsWith("es") && word.length > 3) {
        forms.push(word.slice(0, -2));
      }

      // Pattern 3: -ces → -z (luces → luz)
      if (word.endsWith("ces") && word.length > 4) {
        forms.push(word.slice(0, -3) + "z");
      }

      // Pattern 4: -iones → -ión (acciones → acción)
      if (word.endsWith("iones") && word.length > 6) {
        forms.push(word.slice(0, -5) + "ión");
      }
    }

    // Handle gender variations for adjectives/nouns
    // -a/-o endings (innovadora → innovador)
    if (word.endsWith("a") && word.length > 2) {
      forms.push(word.slice(0, -1) + "o");
    }
    if (word.endsWith("o") && word.length > 2) {
      forms.push(word.slice(0, -1) + "a");
    }

    // -as/-os endings (innovadoras → innovador)
    if (word.endsWith("as") && word.length > 3) {
      const base = word.slice(0, -2);
      forms.push(base);
      forms.push(base + "o");
      forms.push(base + "or"); // for adjectives like innovadoras → innovador
    }
    if (word.endsWith("os") && word.length > 3) {
      const base = word.slice(0, -2);
      forms.push(base);
      forms.push(base + "a");
      forms.push(base + "or"); // for adjectives like innovadores → innovador
    }

    // -es endings for adjectives (responsables → responsable)
    if (word.endsWith("es") && word.length > 3) {
      const base = word.slice(0, -2);
      forms.push(base + "e");
    }

    return [...new Set(forms)]; // Remove duplicates
  };

  const isWordKnown = (word, vocabularySet) => {
    // Get all possible singular/base forms of the word
    const possibleForms = getSingularForms(word);

    // Check if any form exists in vocabulary
    for (const form of possibleForms) {
      if (vocabularySet.has(form)) {
        return true;
      }
    }

    return false;
  };

  const isCommonWord = (word) => {
    const commonWords = new Set([
      // Articles
      "el",
      "la",
      "los",
      "las",
      "un",
      "una",
      "unos",
      "unas",

      // Prepositions
      "de",
      "a",
      "en",
      "por",
      "para",
      "con",
      "sin",
      "sobre",
      "bajo",
      "entre",
      "hacia",
      "hasta",
      "desde",
      "durante",
      "contra",
      "según",
      "tras",
      "ante",
      "mediante",

      // Conjunctions
      "que",
      "y",
      "o",
      "pero",
      "sino",
      "aunque",
      "porque",
      "como",
      "cuando",
      "donde",
      "mientras",
      "si",
      "pues",
      "así",
      "entonces",

      // Pronouns
      "yo",
      "tú",
      "él",
      "ella",
      "nosotros",
      "nosotras",
      "vosotros",
      "vosotras",
      "ellos",
      "ellas",
      "usted",
      "ustedes",
      "me",
      "te",
      "se",
      "le",
      "lo",
      "la",
      "nos",
      "os",
      "les",
      "nos",
      "mi",
      "tu",
      "su",
      "nuestro",
      "nuestra",
      "vuestro",
      "vuestra",
      "sus",
      "mí",
      "ti",
      "sí",

      // Demonstratives - ADDING MISSING ONES
      "este",
      "esta",
      "estos",
      "estas",
      "ese",
      "esa",
      "esos",
      "esas",
      "aquel",
      "aquella",
      "aquellos",
      "aquellas",
      "esto",
      "eso",
      "aquello", // <-- "esto" from BBC test

      // Determiners/Quantifiers - ADDING MISSING ONES
      "todo",
      "toda",
      "todos",
      "todas",
      "cada",
      "algún",
      "alguna",
      "algunos",
      "algunas",
      "ningún",
      "ninguna",
      "ningunos",
      "ningunas",
      "otro",
      "otra",
      "otros",
      "otras",
      "mismo",
      "misma",
      "mismos",
      "mismas",
      "poco",
      "poca",
      "pocos",
      "pocas",
      "mucho",
      "mucha",
      "muchos",
      "muchas",
      "tanto",
      "tanta",
      "tantos",
      "tantas",
      "varios",
      "varias",
      "cierto",
      "cierta",
      "ciertos",
      "ciertas",
      "ambos",
      "ambas", // <-- "ambas" from BBC test

      // Basic adverbs
      "no",
      "sí",
      "muy",
      "más",
      "menos",
      "bien",
      "mal",
      "mejor",
      "peor",
      "aquí",
      "ahí",
      "allí",
      "acá",
      "allá",
      "arriba",
      "abajo",
      "dentro",
      "fuera",
      "antes",
      "después",
      "ahora",
      "hoy",
      "ayer",
      "mañana",
      "siempre",
      "nunca",
      "ya",
      "aún",
      "todavía",
      "solo",
      "sólo",
      "también",
      "tampoco",
      "además",

      // Basic adjectives - ADDING MISSING ONES
      "bueno",
      "buena",
      "buenos",
      "buenas",
      "buen", // <-- "buen" from BBC test
      "malo",
      "mala",
      "malos",
      "malas",
      "mal",
      "grande",
      "grandes",
      "gran",
      "pequeño",
      "pequeña",
      "pequeños",
      "pequeñas",
      "nuevo",
      "nueva",
      "nuevos",
      "nuevas",
      "viejo",
      "vieja",
      "viejos",
      "viejas",
      "primer",
      "primera",
      "primero",
      "primeros",
      "primeras",
      "último",
      "última",
      "últimos",
      "últimas",

      // Common contractions
      "del",
      "al",

      // Basic question words
      "qué",
      "quién",
      "quiénes",
      "cuál",
      "cuáles",
      "cuándo",
      "cómo",
      "dónde",
      "por qué",

      // Numbers (most basic)
      "uno",
      "una",
      "dos",
      "tres",
      "cuatro",
      "cinco",
      "seis",
      "siete",
      "ocho",
      "nueve",
      "diez",

      // Very basic verbs that are typically known
      "ser",
      "estar",
      "tener",
      "hacer",
      "ir",
      "venir",
      "ver",
      "dar",
      "saber",
      "poder",

      // Common expressions/fillers
      "vez",
      "veces",
      "cosa",
      "cosas",
      "vez",
    ]);

    return commonWords.has(word);
  };

  const handleReflexiveVerb = (word, vocabularySet) => {
    // Check if word ends with reflexive pronouns
    const reflexivePronouns = ["me", "te", "se", "nos", "os"];

    for (const pronoun of reflexivePronouns) {
      if (word.endsWith(pronoun) && word.length > pronoun.length + 2) {
        // Strip the reflexive pronoun to get base verb
        const baseVerb = word.slice(0, -pronoun.length);

        // Check if reflexive infinitive form exists (baseVerb + "se")
        const reflexiveInfinitive = baseVerb + "se";

        if (vocabularySet.has(reflexiveInfinitive)) {
          return {
            isKnown: true,
            suggestedForm: reflexiveInfinitive,
            resolvedForm: reflexiveInfinitive,
          };
        } else {
          // Reflexive infinitive not in vocabulary - suggest it
          return {
            isKnown: false,
            suggestedForm: reflexiveInfinitive,
            resolvedForm: reflexiveInfinitive,
          };
        }
      }
    }

    return null; // Not a reflexive verb
  };

  const analyzeWords = async (words, vocabularySet) => {
    const unknownWords = [];
    const wordCounts = new Map();
    let totalWords = 0;
    let knownWords = 0;
    let conjugatedVerbsResolved = 0;

    // Count word frequencies
    words.forEach((word) => {
      totalWords++;
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    });

    // Analyze unique words
    for (const [word, count] of wordCounts.entries()) {
      let isKnown = false;
      let resolvedForm = word;
      let wordToSuggest = word;

      // Check if word is in vocabulary (including plural/gender forms)
      if (isWordKnown(word, vocabularySet)) {
        isKnown = true;
        knownWords += count;
      } else {
        const reflexiveResult = handleReflexiveVerb(word, vocabularySet);

        if (reflexiveResult) {
          // Handle reflexive verb
          if (reflexiveResult.isKnown) {
            isKnown = true;
            knownWords += count;
            conjugatedVerbsResolved += count;
          }
          wordToSuggest = reflexiveResult.suggestedForm;
          resolvedForm = reflexiveResult.resolvedForm;
        } else {
          // Check if it's a regular conjugated verb
          const infinitive = spanishVerbLemmatizer.getInfinitive(word);
          if (infinitive && vocabularySet.has(infinitive)) {
            isKnown = true;
            knownWords += count;
            conjugatedVerbsResolved += count;
            resolvedForm = infinitive;
          } else if (infinitive && !vocabularySet.has(infinitive)) {
            // Conjugated verb but infinitive not in vocabulary - suggest infinitive instead
            wordToSuggest = infinitive;
            resolvedForm = infinitive;
          }
        }
      }

      // If still unknown, add to unknown list (only if not a common word)
      if (!isKnown && !isCommonWord(wordToSuggest)) {
        unknownWords.push({
          word: wordToSuggest,
          count: count,
          resolvedForm: resolvedForm,
          originalForm: wordToSuggest !== word ? word : undefined,
        });
      } else if (!isKnown && isCommonWord(wordToSuggest)) {
        // Count common words as "known" for comprehension but don't add to unknown list
        knownWords += count;
      }
    }

    // Sort unknown words by frequency (most common first)
    unknownWords.sort((a, b) => b.count - a.count);

    return {
      unknownWords,
      stats: {
        totalWords,
        uniqueWords: wordCounts.size,
        knownWords,
        unknownWordsCount: unknownWords.length,
        conjugatedVerbsResolved,
      },
    };
  };

  const analyzeText = async () => {
    if (!inputText.trim() || !isLemmatizerReady) return;

    setIsAnalyzing(true);
    setUnknownWords([]);
    setSelectedWords(new Set());

    try {
      // Create vocabulary lookup for fast comparison
      const vocabularySet = new Set();
      existingVocabulary.forEach((word) => {
        vocabularySet.add(word.spanish.toLowerCase().trim());
        // Also add without articles for comparison
        const withoutArticle = word.spanish
          .replace(/^(el|la|los|las|un|una|unos|unas)\s+/i, "")
          .toLowerCase()
          .trim();
        if (withoutArticle !== word.spanish.toLowerCase().trim()) {
          vocabularySet.add(withoutArticle);
        }
      });

      // Process the text
      const words = extractWordsFromText(inputText);
      const analysis = await analyzeWords(words, vocabularySet);

      setUnknownWords(analysis.unknownWords);
      setAnalysisStats(analysis.stats);
    } catch (error) {
      console.error("Error analyzing text:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleWordSelection = (word) => {
    const newSelected = new Set(selectedWords);
    if (newSelected.has(word)) {
      newSelected.delete(word);
    } else {
      newSelected.add(word);
    }
    setSelectedWords(newSelected);
  };

  const selectAllWords = () => {
    setSelectedWords(new Set(unknownWords.map((w) => w.word)));
  };

  const clearSelection = () => {
    setSelectedWords(new Set());
  };

  const clearAll = () => {
    setInputText("");
    setUnknownWords([]);
    setSelectedWords(new Set());
    setAnalysisStats(null);
  };

  return {
    // State
    inputText,
    isAnalyzing,
    unknownWords,
    selectedWords,
    analysisStats,
    isLemmatizerReady,

    // Actions
    setInputText,
    analyzeText,
    toggleWordSelection,
    selectAllWords,
    clearSelection,
    clearAll,
  };
}
