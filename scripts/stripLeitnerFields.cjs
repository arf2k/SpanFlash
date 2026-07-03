// scripts/stripLeitnerFields.cjs
// One-time cleanup: removes legacy Leitner fields (leitnerBox, lastReviewed, dueDate)
// from public/scrapedSpan411.json. These fields carry no live data since the
// exposure-system migration (db v5+); all real progress lives in exposureLevel,
// timesStudied, timesCorrect, lastStudied, gamePerformance.
//
// Usage:
//   node scripts/stripLeitnerFields.cjs           <- DRY RUN (default, writes nothing)
//   node scripts/stripLeitnerFields.cjs --apply   <- writes backup, strips, bumps version

const fs = require("fs");
const path = require("path");

const LEGACY_FIELDS = ["leitnerBox", "lastReviewed", "dueDate"];
const PROGRESS_FIELDS = [
  "spanish",
  "english",
  "exposureLevel",
  "timesStudied",
  "timesCorrect",
  "lastStudied",
  "gamePerformance",
  "frequencyRank",
  "synonyms_english",
  "synonyms_spanish",
  "notes",
  "category",
  "source",
];

const masterPath = path.join(__dirname, "..", "public", "scrapedSpan411.json");
const backupPath = masterPath + ".pre-strip-backup";
const applyMode = process.argv.includes("--apply");

function bumpPatchVersion(version) {
  const parts = String(version).split(".");
  if (parts.length !== 3 || parts.some((p) => isNaN(parseInt(p, 10)))) {
    throw new Error(`Cannot auto-bump non-semver version: "${version}"`);
  }
  parts[2] = String(parseInt(parts[2], 10) + 1);
  return parts.join(".");
}

function main() {
  console.log(`=== Leitner Field Strip (${applyMode ? "APPLY" : "DRY RUN"}) ===\n`);

  // 1. Load
  if (!fs.existsSync(masterPath)) {
    console.error(`ABORT: master file not found at ${masterPath}`);
    process.exit(1);
  }
  const rawOriginal = fs.readFileSync(masterPath, "utf-8");
  const data = JSON.parse(rawOriginal);

  if (typeof data.version !== "string" || !Array.isArray(data.words)) {
    console.error("ABORT: master file has unexpected shape (need version + words[]).");
    process.exit(1);
  }
  console.log(`Loaded master: version ${data.version}, ${data.words.length} words`);

  // 2. Safety assertion: no live Leitner data may exist
  const liveLeitner = data.words.filter((w) => (w.leitnerBox || 0) > 0);
  if (liveLeitner.length > 0) {
    console.error(`\nABORT: ${liveLeitner.length} word(s) have leitnerBox > 0 (real data at risk).`);
    console.error("Examples:");
    liveLeitner.slice(0, 5).forEach((w) =>
      console.error(`  - "${w.spanish}" (box ${w.leitnerBox})`)
    );
    console.error("Nothing was changed. Investigate before stripping.");
    process.exit(1);
  }
  console.log("Safety check passed: zero words carry live Leitner data.");

  // 3. Strip
  let fieldsRemoved = 0;
  const strippedWords = data.words.map((w) => {
    const copy = { ...w };
    for (const f of LEGACY_FIELDS) {
      if (f in copy) {
        delete copy[f];
        fieldsRemoved++;
      }
    }
    return copy;
  });

  // 4. Verify: word count identical, every progress field byte-identical
  if (strippedWords.length !== data.words.length) {
    console.error("ABORT: word count changed during strip. Nothing written.");
    process.exit(1);
  }
  for (let i = 0; i < data.words.length; i++) {
    for (const f of PROGRESS_FIELDS) {
      const before = JSON.stringify(data.words[i][f] ?? null);
      const after = JSON.stringify(strippedWords[i][f] ?? null);
      if (before !== after) {
        console.error(
          `ABORT: field "${f}" changed for word "${data.words[i].spanish}". Nothing written.`
        );
        process.exit(1);
      }
    }
    // Also confirm no unexpected keys were lost
    const lostKeys = Object.keys(data.words[i]).filter(
      (k) => !LEGACY_FIELDS.includes(k) && !(k in strippedWords[i])
    );
    if (lostKeys.length > 0) {
      console.error(
        `ABORT: unexpected key loss on "${data.words[i].spanish}": ${lostKeys.join(", ")}`
      );
      process.exit(1);
    }
  }
  console.log("Verification passed: all progress fields identical, no unexpected key loss.");

  // 5. Report
  const newVersion = bumpPatchVersion(data.version);
  const output = { ...data, version: newVersion, words: strippedWords };
  const rawNew = JSON.stringify(output, null, 2);
  const mbOld = (rawOriginal.length / 1e6).toFixed(2);
  const mbNew = (rawNew.length / 1e6).toFixed(2);
  const saved = (((rawOriginal.length - rawNew.length) / rawOriginal.length) * 100).toFixed(1);

  const withProgress = strippedWords.filter((w) => (w.timesStudied || 0) > 0).length;

  console.log(`\nReport:`);
  console.log(`  Legacy field instances removed: ${fieldsRemoved}`);
  console.log(`  Words with study progress (preserved): ${withProgress}`);
  console.log(`  File size: ${mbOld}MB -> ${mbNew}MB (${saved}% smaller)`);
  console.log(`  Version: ${data.version} -> ${newVersion}`);

  if (!applyMode) {
    console.log("\nDRY RUN complete - nothing written.");
    console.log("Run with --apply to write the stripped file.");
    return;
  }

  // 6. Write (backup first)
  fs.copyFileSync(masterPath, backupPath);
  console.log(`\nBackup written: ${backupPath}`);
  fs.writeFileSync(masterPath, rawNew, "utf-8");
  console.log(`Stripped master written: ${masterPath}`);
  console.log(`\nDone. Next steps:`);
  console.log(`  1. npm run dev - confirm app loads, word count correct, studied words keep progress`);
  console.log(`  2. Commit + push (do NOT commit the .pre-strip-backup file)`);
  console.log(`  3. Verify on phone after deploy, then delete the backup`);
}

main();
