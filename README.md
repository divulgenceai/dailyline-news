# Dayline

A clean, mobile-ready live news feed built with React, Vite, and a small server-side source collector. Dayline prioritises a reader's country while keeping an independently refreshed Palestine desk visible in every edition.

## What it includes

- Hourly local and global editions for Australia, New Zealand, the United States, Canada, the United Kingdom, Ireland, India, Pakistan, and Singapore, with more than one Canadian endpoint so a slow publisher cannot empty that edition
- A Palestine desk refreshed every 30 minutes
- Australian reporting from 7NEWS, SBS News, Guardian Australia, and The Conversation, plus playable 9News videos
- Clickable story readers with publisher-provided feed text, source-page metadata, evidence links, and the original publisher URL
- Location-based edition selection with a manual country picker fallback
- Responsive desktop and mobile layouts, no advertising, and no paid news API keys
- Stale-cache fallback and per-source isolation so one unavailable publisher does not take down the feed

All stories remain attributed to their publishers. Availability of source-page reader text depends on what each publisher exposes publicly; the original free source is always linked.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

The Vite app runs at `http://localhost:5173` and proxies API requests to the local source server on port `8787`.

## Verify

```bash
npm run build
npm run check:editions
```

The edition check fails if any selectable country returns no genuine country-specific stories.

## Deploy to Vercel

Import this GitHub repository into Vercel and keep the detected Vite settings. The committed `vercel.json` builds the frontend into `dist`, while the files under `api/` deploy the feed, Palestine, story-detail, and health endpoints as Node.js functions.

No environment variables are required.
