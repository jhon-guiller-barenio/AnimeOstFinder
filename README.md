# Sakura Sound

A responsive anime opening finder with a soft pink visual theme, search, opening/ending filters, favorites saved in the browser, and preview playback when the catalog provides media.

## Run locally

Open `index.html`, or start a static server in this folder:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Deploy to Vercel

This is a static site; no build command or environment variables are required.

1. Push this folder to a GitHub repository.
2. In Vercel, choose **Add New → Project** and import the repository.
3. Keep the framework preset as **Other**. Leave the build command empty and the output directory as `.`.
4. Select **Deploy**. Future pushes to the connected branch deploy automatically.

The catalog uses the public AnimeThemes API for live anime theme metadata and media when available. If that service is unavailable, Sakura Sound shows its built-in curated starter list. Favorites are stored in the visitor's browser.
