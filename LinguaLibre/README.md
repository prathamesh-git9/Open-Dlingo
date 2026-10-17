# LinguaLibre — your own unlimited, open-source Duolingo-style app

🦉 **LinguaLibre** is a fully open-source language-learning web app inspired by Duolingo's teaching style:
a winding skill-path of chapters/units, bite-sized lessons, and the same kinds of exercises
(word-bank translation, multiple choice, listen & tap, tap-the-pairs matching, fill-in-the-blank, type-what-you-hear),
plus sound effects and text-to-speech.

## What makes it different (on purpose)

| Duolingo | LinguaLibre |
|---|---|
| ❤️ Hearts / battery / energy limits | ❌ None — **unlimited attempts, unlimited lessons, forever** |
| XP / points pressure | ❌ No points system. Progress stats are informational only |
| Ads & Super subscription | ❌ No ads, no subscriptions, MIT licensed |
| Closed course content | ✅ Open JSON course data — add languages in 5 minutes |
| Proprietary AI features | ✅ Bring-your-own **Grok (xAI)** API key — unlimited AI tutor, AI word explanations, AI-generated practice |

## Languages included

1. 🇩🇪 **German** (for English speakers) — 4 units, 11 lessons
2. 🇬🇧 **English** (for German speakers) — 4 units, 11 lessons

Both courses include greetings, people, "to be/sein", food & drink, restaurants, travel, directions, transport, days & time, family, and routine verbs.

## Quick start

```bash
cd LinguaLibre
npm install
cp .env.example .env        # paste your Grok (xAI) API key into .env
npm start                   # → http://localhost:3000
```

The app works **fully without an API key** — only the three AI features need it:
- 🤖 **AI Tutor chat** ("Why *der, die oder das*?")
- 💡 **"Explain with AI"** button after a wrong answer (vocab card from Grok)
- 🏹 **Unlimited AI Practice** (Grok generates fresh translate exercises on any topic)

Your key stays server-side (`grok.js` proxies calls to `api.x.ai`) — it is never sent to the browser. Get one at https://console.x.ai. There are **no rate limits or usage caps in the app** — use as much as you like.

## Project structure

```
LinguaLibre/
├── server.js          # Express server + course API + .env loader
├── grok.js            # Grok/xAI proxy: /api/tutor /api/explain /api/practice
├── data/courses.js    # Open course content (edit to add languages!)
└── public/
    ├── index.html     # Single-page app UI
    ├── css/style.css  # Duolingo-inspired styling (original CSS)
    └── js/
        ├── app.js     # Lesson engine, skill tree, AI tabs
        └── audio.js   # Web-Audio sound effects + speech synthesis TTS
```

## Adding a new language

Copy a course object in `data/courses.js`, set `id`, `name`, `flag`, `fromLang` and fill `units → lessons → exercises`. Exercise types supported:

- `select` / `choice` — pick the right option
- `fillBlank` — choose the word that fills the blank
- `translate` — build the sentence from a word bank
- `typeIn` — free typing (multiple accepted answers)
- `listen` — TTS audio + comprehension options
- `match` — tap the matching pairs

Restart `npm start` — done. No server changes needed.

## Notes on being "like Duolingo" responsibly

This project is **inspired by** Duolingo's UX but contains **no Duolingo trademarks, owl artwork, sounds, or course data**. All visuals use emoji + original CSS; all audio is synthesized locally via the Web Audio API and the browser's built-in speech engine. Feel free to fork, remix and ship it — it's MIT licensed.

## License

MIT — see [LICENSE](../LICENSE). Course data is released under CC0 (public domain): share and adapt freely.

## 🌐 Hosting it online (free, 2 options)

I can't publish to the internet from this sandbox (no hosting credentials), but the app is now built so you can go live in ~2 minutes:

**Option A — Vercel (recommended, keeps server + Grok proxy):**
1. Push this folder to a GitHub repo
2. Go to vercel.com → Import repo → Framework preset: **Other**, command `npm start`
3. Add env var `XAI_API_KEY` → Deploy. Done: full app + AI tutor on a free `*.vercel.app` URL.
(`.vercel.json` with the server rewrite is already included.)

**Option B — GitHub Pages (zero server, static):**
1. Push to GitHub → Settings → Pages → serve from the **`docs/`** folder
2. All lessons/courses/audio work instantly. For the Grok AI features, open the app and paste your xAI key under **Profile → Grok AI settings** — it's stored only in *your* browser and talks directly to api.x.ai (never to any third-party server).

The app auto-detects which mode it's running in (`public/js/app.js` API layer).
