# Tonal SFX Suite

**Live:** https://tonal-sfx.netlify.app · **Daily sessions:** https://tonal-sfx.netlify.app/daily/ · **Today's score:** https://tonal-sfx.netlify.app/apps/05-layered-score-studio.html

Five standalone HTML apps that **generate tonal sound effects and seamless looping patterns** for video, in any of the 24 major/minor keys. They need no samples, no build step and no install. Everything is synthesised with the Web Audio API and exported as 48 kHz / 16-bit WAV.

## What tonal sound effects are
Tonal SFX have a **definite musical pitch and are tuned to a key** (C major, A minor…). Atonal SFX such as whooshes, footsteps and doors are noise-based and have no pitch. Because tonal SFX are keyed, you can layer them under a licensed track, or stack them on each other, without dissonance. Editors use them like Lego to build a custom score on the timeline. They usually fall into four layers (Duende Sounds / Multiply Sound):

| Layer | Role | App |
|---|---|---|
| 1 Foundation | drones, pads, textures: mood and weight | `01-drone-pad-lab.html` |
| 2 Mid | rhythmic loops, chord progressions: pulse and harmony | `02-pulse-chord-loops.html` |
| 3 Top | melodies, signature phrases: the focal line | `03-melody-phrases.html` |
| 4 Glue | risers, pitched impacts, melodic hits, transitions | `04-risers-hits-glue.html` |
| All | layered pattern designer with daily seed + stems | `05-layered-score-studio.html` |

## The five apps
1. **Drone & Pad Lab**: phase-locked drones and evolving pads (Warm / Dark / Glass / Choir / Tape). Every oscillator and LFO is snapped to a whole number of cycles per loop, and release and reverb tails are folded back into the start, so the drones loop with no seam. You also get "tuned air", which is noise band-passed onto the root and fifth.
2. **Pulse & Chord Loops**: Euclidean rhythms spread over 16 steps, played over seeded chord progressions in the key. Styles are arp, stabs, ostinato, gated pad and mallet, with bass, swing and pump. Loops are exact bar lengths at your BPM.
3. **Melody Phrases**: writes a one-bar rhythmic and melodic motif, then develops it across 1–8 bars by repeating, sequencing along a contour, varying and inverting it. Strong beats snap to chord tones. A phrase can end on **Resolve** (lands on the tonic, good for logos and end cards) or **Loop** (stays open).
4. **Risers, Hits & Glue**: one-shots with a marked **CUT** point (the cut time is also in the filename, in ms). Types: risers that glide up into the tonic, sub impacts that drop onto the key's root, melodic hits, downlifters, reverse swells and stingers.
5. **Layered Score Studio**: all four layers share one key **and one chord progression**. It has an arrangement grid (click cells per bar), mute/solo/volume per layer, a ↻ button to re-roll a single layer, **Today's score** (seed, key, tempo and mood all come from the date), mix export and a **stems .zip**.

## Common to every app
- Key picker (12 roots × major/minor), showing the scale notes and the relative key.
- Seed field: the same seed and settings always give the same result. **Today** uses the date, so each day starts with a new pattern. **Dice** gives a random seed. The URL hash stores the whole state, so you can bookmark a pattern or send it to someone.
- Waveform with playhead, a piano roll with in-key rows lit, and a live scope.
- **Export WAV** (1×, 2× or 4× loop) and **12-key pack .zip**, which renders the same pattern in all 12 roots so you can match any track.
- Keyboard: `Space` play/stop · `R` new pattern · `L` loop · `E` export · `[` `]` transpose.

## How to open
Use the live site at https://tonal-sfx.netlify.app, or double-click any file in `apps/`. The apps work from `file://` in Chrome, Edge, Firefox and Safari. You can also serve the repo locally:
```
python3 -m http.server 8000   # → http://localhost:8000/
```
The apps link to each other, and back to the hub, from the top-right nav.

## Suggested editor workflow
1. Find the key of your music: check the track metadata, or use a key-detection tool. If you don't know it, use the 12-key pack and audition by ear.
2. **Foundation first.** Export a drone/pad loop in that key (or its relative major/minor) and lay it under the whole scene at a low level.
3. Add a **Mid** loop at the edit's BPM so it snaps to the bar grid in Premiere, Resolve or CapCut.
4. Put a **Top** phrase on the moment you want people to notice: use Resolve for end cards and Loop for montages.
5. Use **Glue** at the cuts: line up each riser's CUT marker with the edit point, and put impacts or melodic hits on title reveals.
6. You can also do all of this in **Score Studio**: press *Today's score*, shape the arrangement grid, export stems and mix them on the timeline.

## Limitations
- Audio starts only after you click or press a key, because browsers block autoplay. Renders run offline, so heavy settings (64 s drones, or 12-key packs) take a few seconds.
- Exports are WAV only: stereo, 48 kHz, 16-bit PCM. No MP3 or WebM.
- Fonts load from Google Fonts. When you're offline, the apps fall back to system serif and mono fonts and still work fully.
- Stems in the zip use each layer's volume but ignore mute/solo. The mix file respects both.
- Risers glide through pitch by design, and only their start and end notes are in key. Every other element sits on scale tones.

## Repo layout
| Path | What |
|---|---|
| `index.html`, `assets/site.css` | Hub page |
| `apps/*.html` | The five standalone apps (built output) |
| `src/` | Shared engine (`core*.js`, `core.css`) and per-app sources. `python3 src/build.py` rebuilds `apps/*.html` |
| `src/daily_publish.py` | Writes the daily session pages |
| `daily/` | One page per day, `index.html` (newest first) and `latest.json` |
| `netlify.toml` | Static publish of the repo root, no build, headers |
| `.github/workflows/daily-tonal.yml` | Daily publish workflow |

## Daily sessions
`.github/workflows/daily-tonal.yml` runs at **08:00 UTC every day** (08:00 GMT / 09:00 BST), and you can also run it by hand from the Actions tab (*Run workflow*). It:
1. runs `python3 src/daily_publish.py`, which takes today's date in Europe/London and derives a key, tempo, mood and seed from it. It writes `daily/YYYY-MM-DD.html`, rebuilds `daily/index.html` (newest first) and `daily/latest.json`, and updates the *Today* card on the hub. Running it twice on the same day changes nothing.
2. commits and pushes to `main` using the workflow's `GITHUB_TOKEN` (`contents: write`).
3. deploys to Netlify **if** the repo has a `NETLIFY_AUTH_TOKEN` secret (plus `NETLIFY_SITE_ID`, optional). If Netlify's Git integration is connected to this repo, the push in step 2 triggers the deploy on its own, and you don't need the token.

Every link on a day page opens its app at `#seed=YYYY-MM-DD&root=N&mode=minor|major`, so all five layers share that day's key.

To build a specific day locally: `python3 src/daily_publish.py --date 2026-11-05`.

## Deploy
Netlify site `tonal-sfx` (team Kiniza-Dev), site id `7bd4e8ba-dacb-4613-b40a-c1813f7f20fa`. Manual deploy: `netlify deploy --prod --dir .`
