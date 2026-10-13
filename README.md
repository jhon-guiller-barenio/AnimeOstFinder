# Sakura Sound

A responsive anime opening finder with a soft pink visual theme, search, opening/ending filters, favorites saved in the browser, and preview playback when the catalog provides media.

## Run locally

Use the Vercel CLI so the album artwork API function runs locally:

```bash
npx vercel dev
```

If you open `index.html` directly or use a basic static server, the catalog still works, but album art lookups need the Vercel function.

## Deploy to Vercel

This is a static site with one Vercel serverless function. No build command, database, or API key is required.

1. Push this folder to a GitHub repository.
2. In Vercel, choose **Add New → Project** and import the repository.
3. Keep the framework preset as **Other**. Leave the build command empty and the output directory as `.`. Vercel detects `api/album-art.js` as a serverless function.
4. Select **Deploy**. Future pushes to the connected branch deploy automatically.

The catalog uses the public AnimeThemes API for live anime theme metadata and media when available. Album artwork is searched by song title, artist, and anime in Apple's music catalog first, then MusicBrainz and the Cover Art Archive. Apple artwork cards link directly to the matching Apple Music listing. Lookups are cached and paced; some OSTs may not have matching album art, so those cards keep their illustrated fallback. Favorites and artwork lookup results are cached in the visitor's browser. Set `MUSICBRAINZ_CONTACT` in Vercel to a project contact URL or email if you want to replace the GitHub profile used by the API User-Agent.
