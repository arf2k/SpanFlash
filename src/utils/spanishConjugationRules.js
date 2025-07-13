class SpanishConjugationRules {
  constructor() {
    this.irregularMap = new Map();
    this.isInitialized = false;
    this.initialize();
  }

  initialize() {
    if (this.isInitialized) return;

    // Common irregular verb forms mapped to infinitives
    const irregularForms = {
      // SER (to be)
      soy: "ser",
      eres: "ser",
      es: "ser",
      somos: "ser",
      sois: "ser",
      son: "ser",
      era: "ser",
      eras: "ser",
      éramos: "ser",
      erais: "ser",
      eran: "ser",
      fui: "ser",
      fuiste: "ser",
      fue: "ser",
      fuimos: "ser",
      fuisteis: "ser",
      fueron: "ser",
      sea: "ser",
      seas: "ser",
      seamos: "ser",
      seáis: "ser",
      sean: "ser",
      sido: "ser",

      // ESTAR (to be)
      estoy: "estar",
      estás: "estar",
      está: "estar",
      estamos: "estar",
      estáis: "estar",
      están: "estar",
      estaba: "estar",
      estabas: "estar",
      estábamos: "estar",
      estabais: "estar",
      estaban: "estar",
      estuve: "estar",
      estuviste: "estar",
      estuvo: "estar",
      estuvimos: "estar",
      estuvisteis: "estar",
      estuvieron: "estar",
      esté: "estar",
      estés: "estar",
      estemos: "estar",
      estéis: "estar",
      estén: "estar",
      estado: "estar",

      // TENER (to have)
      tengo: "tener",
      tienes: "tener",
      tiene: "tener",
      tenemos: "tener",
      tenéis: "tener",
      tienen: "tener",
      tenía: "tener",
      tenías: "tener",
      teníamos: "tener",
      teníais: "tener",
      tenían: "tener",
      tuve: "tener",
      tuviste: "tener",
      tuvo: "tener",
      tuvimos: "tener",
      tuvisteis: "tener",
      tuvieron: "tener",
      tenga: "tener",
      tengas: "tener",
      tengamos: "tener",
      tengáis: "tener",
      tengan: "tener",
      tenido: "tener",

      // HACER (to do/make)
      hago: "hacer",
      haces: "hacer",
      hace: "hacer",
      hacemos: "hacer",
      hacéis: "hacer",
      hacen: "hacer",
      hacía: "hacer",
      hacías: "hacer",
      hacíamos: "hacer",
      hacíais: "hacer",
      hacían: "hacer",
      hice: "hacer",
      hiciste: "hacer",
      hizo: "hacer",
      hicimos: "hacer",
      hicisteis: "hacer",
      hicieron: "hacer",
      haga: "hacer",
      hagas: "hacer",
      hagamos: "hacer",
      hagáis: "hacer",
      hagan: "hacer",
      hecho: "hacer",

      // IR (to go)
      voy: "ir",
      vas: "ir",
      va: "ir",
      vamos: "ir",
      vais: "ir",
      van: "ir",
      iba: "ir",
      ibas: "ir",
      íbamos: "ir",
      ibais: "ir",
      iban: "ir",
      // Note: fui/fue shared with ser - will handle in logic
      vaya: "ir",
      vayas: "ir",
      vayamos: "ir",
      vayáis: "ir",
      vayan: "ir",
      ido: "ir",

      // PODER (can/to be able)
      puedo: "poder",
      puedes: "poder",
      puede: "poder",
      podemos: "poder",
      podéis: "poder",
      pueden: "poder",
      podía: "poder",
      podías: "poder",
      podíamos: "poder",
      podíais: "poder",
      podían: "poder",
      pude: "poder",
      pudiste: "poder",
      pudo: "poder",
      pudimos: "poder",
      pudisteis: "poder",
      pudieron: "poder",
      pueda: "poder",
      puedas: "poder",
      podamos: "poder",
      podáis: "poder",
      puedan: "poder",
      podido: "poder",

      // DECIR (to say)
      digo: "decir",
      dices: "decir",
      dice: "decir",
      decimos: "decir",
      decís: "decir",
      dicen: "decir",
      decía: "decir",
      decías: "decir",
      decíamos: "decir",
      decíais: "decir",
      decían: "decir",
      dije: "decir",
      dijiste: "decir",
      dijo: "decir",
      dijimos: "decir",
      dijisteis: "decir",
      dijeron: "decir",
      diga: "decir",
      digas: "decir",
      digamos: "decir",
      digáis: "decir",
      digan: "decir",
      dicho: "decir",

      // SABER (to know)
      sé: "saber",
      sabes: "saber",
      sabe: "saber",
      sabemos: "saber",
      sabéis: "saber",
      saben: "saber",
      sabía: "saber",
      sabías: "saber",
      sabíamos: "saber",
      sabíais: "saber",
      sabían: "saber",
      supe: "saber",
      supiste: "saber",
      supo: "saber",
      supimos: "saber",
      supisteis: "saber",
      supieron: "saber",
      sepa: "saber",
      sepas: "saber",
      sepamos: "saber",
      sepáis: "saber",
      sepan: "saber",
      sabido: "saber",

      // VER (to see)
      veo: "ver",
      ves: "ver",
      ve: "ver",
      vemos: "ver",
      veis: "ver",
      ven: "ver",
      veía: "ver",
      veías: "ver",
      veíamos: "ver",
      veíais: "ver",
      veían: "ver",
      vi: "ver",
      viste: "ver",
      vio: "ver",
      vimos: "ver",
      visteis: "ver",
      vieron: "ver",
      vea: "ver",
      veas: "ver",
      veamos: "ver",
      veáis: "ver",
      vean: "ver",
      visto: "ver",

      // DAR (to give)
      doy: "dar",
      das: "dar",
      da: "dar",
      damos: "dar",
      dais: "dar",
      dan: "dar",
      daba: "dar",
      dabas: "dar",
      dábamos: "dar",
      dabais: "dar",
      daban: "dar",
      di: "dar",
      diste: "dar",
      dio: "dar",
      dimos: "dar",
      disteis: "dar",
      dieron: "dar",
      dé: "dar",
      des: "dar",
      demos: "dar",
      deis: "dar",
      den: "dar",
      dado: "dar",

      // SALIR (to leave/go out)
      salgo: "salir",
      sales: "salir",
      sale: "salir",
      salimos: "salir",
      salís: "salir",
      salen: "salir",
      salía: "salir",
      salías: "salir",
      salíamos: "salir",
      salíais: "salir",
      salían: "salir",
      salí: "salir",
      saliste: "salir",
      salió: "salir",
      salimos: "salir",
      salisteis: "salir",
      salieron: "salir",
      salga: "salir",
      salgas: "salir",
      salgamos: "salir",
      salgáis: "salir",
      salgan: "salir",
    };

    // Build the irregular map
    Object.entries(irregularForms).forEach(([form, infinitive]) => {
      this.irregularMap.set(form.toLowerCase(), infinitive);
    });

    this.isInitialized = true;
    console.log(
      `✅ Spanish conjugation rules initialized: ${this.irregularMap.size} irregular forms`
    );
  }

  /**
   * Get infinitive form using unified rule system
   * @param {string} word - The conjugated word
   * @returns {string|null} - The infinitive form, or null if not found
   */
  getInfinitive(word) {
    if (!word || typeof word !== "string") return null;

    const cleanWord = word.toLowerCase().trim();

    // 1. Check if already an infinitive
    if (this.isInfinitive(cleanWord)) {
      return cleanWord;
    }

    // 2. Check irregular forms first (most common verbs)
    const irregular = this.irregularMap.get(cleanWord);
    if (irregular) {
      return irregular;
    }

    // 3. Apply regular conjugation patterns
    return this.applyRegularPatterns(cleanWord);
  }

  /**
   * Check if a word is already an infinitive
   */
  isInfinitive(word) {
    return word.endsWith("ar") || word.endsWith("er") || word.endsWith("ir");
  }

  /**
   * Apply regular conjugation patterns for -ar, -er, -ir verbs
   */
  applyRegularPatterns(word) {
    // Present tense patterns
    if (word.length > 3) {
      // -ar verbs: habla → hablar, causa → causar
      if (word.endsWith("a") && !word.endsWith("ba")) {
        return word.slice(0, -1) + "ar";
      }

      // -er verbs: come → comer, bebe → beber
      if (word.endsWith("e") && !this.isCommonWordEnding(word)) {
        return word.slice(0, -1) + "er";
      }
    }

    // Preterite patterns
    if (word.length > 4) {
      // -ar verbs: causó → causar, habló → hablar
      if (word.endsWith("ó")) {
        return word.slice(0, -1) + "ar";
      }

      // -er/-ir verbs: comió → comer, vivió → vivir
      if (word.endsWith("ió")) {
        // Try -er first (more common)
        const erForm = word.slice(0, -2) + "er";
        const irForm = word.slice(0, -2) + "ir";

        // Basic heuristic: if stem ends in certain letters, prefer -ir
        const stem = word.slice(0, -2);
        if (stem.endsWith("v") || stem.endsWith("t") || stem.endsWith("b")) {
          return irForm;
        }
        return erForm;
      }
    }

    // Past participle patterns
    if (word.length > 5) {
      // -ar verbs: causado → causar, hablado → hablar
      if (word.endsWith("ado")) {
        return word.slice(0, -3) + "ar";
      }

      // -er/-ir verbs: comido → comer, vivido → vivir
      if (word.endsWith("ido")) {
        const erForm = word.slice(0, -3) + "er";
        const irForm = word.slice(0, -3) + "ir";

        // Basic heuristic for -er vs -ir
        const stem = word.slice(0, -3);
        if (stem.endsWith("v") || stem.endsWith("t") || stem.endsWith("b")) {
          return irForm;
        }
        return erForm;
      }
    }

    // Imperfect patterns
    if (word.length > 5) {
      // -ar verbs: hablaba → hablar, causaba → causar
      if (word.endsWith("aba")) {
        return word.slice(0, -3) + "ar";
      }

      // -er/-ir verbs: comía → comer, vivía → vivir
      if (word.endsWith("ía")) {
        const erForm = word.slice(0, -2) + "er";
        const irForm = word.slice(0, -2) + "ir";

        // Basic heuristic
        const stem = word.slice(0, -2);
        if (stem.endsWith("v") || stem.endsWith("t") || stem.endsWith("b")) {
          return irForm;
        }
        return erForm;
      }
    }

    // Additional present patterns
    if (word.length > 4) {
      // -ar verbs: hablan → hablar, causan → causar
      if (word.endsWith("an")) {
        return word.slice(0, -2) + "ar";
      }

      // -er verbs: comen → comer, beben → beber
      if (word.endsWith("en") && !this.isCommonWordEnding(word)) {
        return word.slice(0, -2) + "er";
      }
    }

    return null; // No pattern matched
  }

  /**
   * Check if word ending is likely NOT a verb conjugation
   */
  isCommonWordEnding(word) {
    const nonVerbEndings = [
      "que",
      "se",
      "le",
      "me",
      "te",
      "ne",
      "de",
      "ante",
      "entre",
    ];
    return nonVerbEndings.includes(word);
  }

  /**
   * Check if a word is a known verb form
   */
  isKnownVerb(word) {
    return this.getInfinitive(word) !== null;
  }

  /**
   * Get statistics about the rule system
   */
  getStats() {
    return {
      irregularForms: this.irregularMap.size,
      isInitialized: this.isInitialized,
      systemType: "unified_rule_based",
    };
  }
}

// Create singleton instance
export const spanishConjugationRules = new SpanishConjugationRules();

// Export the class for direct usage
export { SpanishConjugationRules };
