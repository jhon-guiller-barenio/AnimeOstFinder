# SakuraSound — Anime OST Finder

Discover anime opening and ending themes, find their album artwork, and listen in a lightweight music player.

![SakuraSound website preview](assets/sakura-sound-preview.jpg)

## Features

- **Live anime theme catalog** powered by the public [AnimeThemes API](https://animethemes.moe/), with curated picks available as a fallback.
- **Search with suggestions** across anime titles, song names, and artists. Choose a suggestion or search the full catalog.
- **Browse and filter** openings, endings, and saved favorites; sort featured songs alphabetically or by anime year, and load more results.
- **Album artwork and release links** looked up through Apple Music and Deezer, with MusicBrainz and Cover Art Archive artwork as fallbacks. Results are cached in the browser to make repeat visits faster. Some tracks may not have a matching cover.
- **Music player** with play/pause, previous/next, a queue, and a compact sticky player with a seek bar that stays available while scrolling. Playback uses media supplied by AnimeThemes when available.
- **One-click download** for available AnimeThemes audio or theme video. The download endpoint streams eligible media from AnimeThemes and starts a file download directly.
- **MP3 download option** converts available audio or extracts audio from a theme video into a 192 kbps MP3, streamed directly to the browser.
- **Favorites** saved in the browser, so they remain available on the same device and browser.
- **Light and dark themes**, with Zero Two background artwork, subtle neon accents, and animated details.
- **Tip Me panel** for creator support. Add a Buy Me a Coffee page URL to enable its support link.
- **Responsive layout** for desktop and mobile screens.

## Run locally

Use the Vercel CLI to run the site and its API routes:

```bash
npx vercel dev
```

The catalog can also be viewed from a basic static server, but album artwork lookups and downloads require the Vercel API routes.

## Deploy to Vercel

This is a static site with serverless functions in `api/`. No build command, database, or API key is required.

1. Import this GitHub repository into Vercel.
2. Choose **Other** as the framework preset, leave the build command empty, and set the output directory to `.`.
3. Deploy. New commits pushed to the connected branch trigger deployments.

## Data providers and API routes

- Anime theme metadata and playable media: [AnimeThemes](https://animethemes.moe/)
- Album artwork and music listings: Apple Music / iTunes, Deezer, MusicBrainz, and Cover Art Archive
- `GET /api/album-art` searches providers for a likely album cover and listing.
- `GET /api/download` streams an eligible AnimeThemes media file as a download.
- Add `format=mp3` to `GET /api/download` to extract or convert the theme audio using the bundled `ffmpeg-static` binary.

Set `MUSICBRAINZ_CONTACT` in Vercel to a project contact URL or email if you want the album-art API to use it in its User-Agent.

Music and artwork remain the property of their respective rights holders. Availability depends on the providers and the specific anime theme.
