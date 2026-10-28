# Pulse Grid Sequencer

Program a sixteen-step drum loop, adjust its tempo and play it with a browser synthesizer.

A portable loop link stores all 64 pads and the tempo in its URL fragment. The app restores your latest local draft when you reopen it. Opening a shared link previews that loop, and editing it makes it your local draft. Audio starts only when you press Play.

Download WAV renders one full bar at the selected tempo as 44.1 kHz, 16-bit mono PCM. Live playback and export use the same four synthesized drum voices. Any hit crossing the end of the bar wraps to the beginning of the file for looping.

## Run locally

Use Node.js 22 or newer to run `node scripts/verify.mjs`. To launch a local preview, run `python3 -m http.server 8080 --bind 127.0.0.1 --directory public` and open http://127.0.0.1:8080.

## Deployment

Vercel serves `public/` directly. The application uses browser platform APIs and ships with no package dependencies.

## Git dates

The initial commits use retrospective author dates from October–November 2026. Their committer timestamps record when this repository was assembled.
