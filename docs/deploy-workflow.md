# Phone-first deploy workflow

This guide focuses on preserving the phone export as the source of truth while redeploying the web app so that the phone immediately receives the most up-to-date learning progress.

## Immediate recovery plan (use today)

1. **Back up the current datasets**
   - Copy `public/scrapedSpan411.json` somewhere safe before making any changes.
   - If you still have a fresh `phone_export.json`, place it in `public/` alongside the master file.
2. **Run the guided merge with the phone as source of truth**
   - From the repo root, run `node scripts/mergePhoneExport.cjs` and follow the prompts.
   - The script compares `public/phone_export.json` to `public/scrapedSpan411.json`, lets you review additions/deletions, then writes `public/scrapedSpan411_merged.json` plus a backup of the old master.
3. **Replace the master file for deployment**
   - After reviewing the merged output, rename `public/scrapedSpan411_merged.json` to `public/scrapedSpan411.json` and delete the `phone_export.json` to avoid stale re-merges.
   - Bump the `version` field inside the master JSON if you want clients to force-refresh data.
4. **Redeploy to refresh the phone**
   - Commit the updated `scrapedSpan411.json` and deploy as usual (e.g., Vercel/Netlify). The phone will pick up the new data on the next load; clearing local storage on the phone first guarantees it re-syncs with the deployed master.

## Near-term cleanup to prevent divergence

- **Add a one-command ingest**: wrap `mergePhoneExport.cjs` in an npm script (`npm run ingest-phone`) so the workflow is: drop export → run script → commit.
- **Single source of merging logic**: refactor the runtime merge logic in `src/hooks/useWordData.js` to reuse the same merging helper as the CLI so the browser never re-merges already-validated data.
- **Detect stale data before deploy**: add a simple check that fails CI if `phone_export.json` exists or if the generated `scrapedSpan411.json` is older than the latest export.
- **Document the golden path**: update README with the exact steps above so you can repeat them even after clearing local storage.

## Handling accidental data loss on the phone

- If the phone’s local storage gets wiped, treat the deployed `scrapedSpan411.json` as the recovery point: clear storage, reload the app, and let it pull the master file.
- Consider scheduling periodic exports from the phone to `phone_export.json` (dated filenames) so you always have a fallback with learning metrics.
