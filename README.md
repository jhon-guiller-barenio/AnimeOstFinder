# SakuraSound — Anime OST Finder

Discover anime opening and ending themes, find their album artwork, and listen in a lightweight music player.

![SakuraSound website preview](assets/sakura-sound-preview.jpg)

## Features

### Find anime themes

- **Live catalog:** Load anime theme metadata from the public [AnimeThemes API](https://animethemes.moe/). If the live catalog is unavailable, SakuraSound falls back to a set of curated picks.
- **Smart suggestions:** Search by anime, song title, or artist. Suggestions update as you type; use the arrow keys to move through them, **Enter** to select, or **Escape** to close the list.
- **Quick searches:** Start with popular anime shortcuts, then search the wider catalog.
- **Useful filters:** Browse all songs, openings, endings, or your saved favorites.
- **Sort and keep exploring:** Sort featured picks, alphabetically, or by newest anime. Load more live catalog results as you browse.
- **Clear results:** Empty states explain when a search has no matches and provide a one-click way back to the full catalog.
- **Track details:** Cards show opening/ending type, sequence, anime year, song name, anime, and artist when provider data includes them.

### Find album artwork

- **Provider lookup:** SakuraSound searches Apple Music and Deezer for a matching album cover and release listing, then checks MusicBrainz and Cover Art Archive when those searches do not find a match.
- **Match-aware results:** Lookups use the song title and artist, with anime and album names used to help distinguish releases.
- **Fast repeat visits:** Artwork results are cached in the browser; the artwork API also uses Vercel's CDN cache. Covers are requested as they approach the screen, so a long list does not fetch every image at once.
- **Honest fallback:** A cover may be unavailable for some themes. In that case, the illustrated cover remains in place instead of showing a broken image.
- **Open the release:** Matched store results link to their provider listing when one is available.

### Listen and manage playback

- **Play available media:** Open a track in the player and preview its AnimeThemes audio or video when that theme has media attached.
- **Full player controls:** Play or pause, skip to the previous or next track in the current queue, view the source theme, and download the available media.
- **Up Next queue:** See upcoming tracks and select one to start it.
- **Sticky mini-player:** Keep playback controls visible while scrolling. The mini-player includes album art, track details, play/pause, previous/next, a seek bar, and elapsed/total time.
- **One-click downloads:** Download an available audio file or theme video directly. The Vercel download route streams supported files from AnimeThemes and starts the file download without an extra confirmation page.
- **Playback-aware controls:** Previous and next buttons disable at the ends of the current queue.

### Make it yours

- **Favorites collection:** Save or remove tracks with the heart button and open **My collection** to see saved songs. Favorites persist in the browser on that device.
- **Light and dark modes:** Switch themes from the header; your selected appearance is remembered in the browser.
- **Anime-inspired motion:** Zero Two artwork, falling petals, animated record and album details, and subtle neon accents give the interface its SakuraSound look.
- **Reduced-motion support:** Animations and smooth scrolling tone down when the device asks for reduced motion.
- **Scroll helpers:** The header and mini-player stay available while you browse, and a back-to-top control appears after scrolling down.
- **Responsive layout:** Search, catalog, and player adapt to mobile and desktop screens.
- **Tip Me panel:** A support dialog is included; its Buy Me a Coffee button becomes active after a page URL is configured.

## How it works

- The browser requests anime metadata and available theme media from AnimeThemes.
- Album artwork is looked up through the Vercel `/api/album-art` function and its music catalog providers.
- Downloads go through the Vercel `/api/download` function, which accepts only supported AnimeThemes media hosts.
- Favorites, theme preference, and artwork results are stored in the visitor's browser. No account or database is needed.

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

Set `MUSICBRAINZ_CONTACT` in Vercel to a project contact URL or email if you want the album-art API to use it in its User-Agent.

Music and artwork remain the property of their respective rights holders. Availability depends on the providers and the specific anime theme.
