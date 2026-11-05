#!/usr/bin/env python3
"""Publish today's Tonal SFX daily session.

Writes daily/YYYY-MM-DD.html for today's Europe/London date, rebuilds
daily/index.html (newest first), daily/latest.json, and the "Today" block
on the hub index.html. Idempotent: running twice on one day changes nothing.

Usage: python3 src/daily_publish.py [--date YYYY-MM-DD]
"""
import argparse, datetime, hashlib, html, json, pathlib, re
from zoneinfo import ZoneInfo

ROOT = pathlib.Path(__file__).resolve().parent.parent
DAILY = ROOT / "daily"
NOTES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"]
MOODS = [("Noir", "low, slow and shadowed"), ("Ascent", "rising, hopeful, forward"),
         ("Glass", "bright, crystalline, airy"), ("Tension", "held breath before the cut"),
         ("Nocturne", "late-night, intimate, warm"), ("Pulse", "driving, rhythmic, tight"),
         ("Drift", "floating, unhurried, wide"), ("Reveal", "build into a title card"),
         ("Dust", "tape-worn, nostalgic"), ("Horizon", "open, cinematic, vast")]
APPS = [("01-drone-pad-lab.html", "Drone & Pad Lab", "Foundation", "Lay a seamless bed under the whole scene."),
        ("02-pulse-chord-loops.html", "Pulse & Chord Loops", "Mid", "Bar-exact loop at the day's tempo."),
        ("03-melody-phrases.html", "Melody Phrases", "Top", "A motif for the focal moment."),
        ("04-risers-hits-glue.html", "Risers, Hits & Glue", "Glue", "Risers and impacts with a CUT marker."),
        ("05-layered-score-studio.html", "Layered Score Studio", "All", "All four layers, stems export.")]


def session(day: str) -> dict:
    h = hashlib.sha256(("tonal-sfx-daily|" + day).encode()).digest()
    root, mode = h[0] % 12, ("minor" if h[1] % 3 else "major")
    mood, desc = MOODS[h[2] % len(MOODS)]
    bpm = 70 + (h[3] % 12) * 5
    rel = (root + 3) % 12 if mode == "minor" else (root + 9) % 12
    return {"date": day, "seed": day, "root": root, "mode": mode,
            "key": f"{NOTES[root]} {mode}", "relative": f"{NOTES[rel]} {'major' if mode == 'minor' else 'minor'}",
            "mood": mood, "mood_desc": desc, "bpm": bpm, "path": f"daily/{day}.html"}


def app_href(s: dict, fn: str, prefix: str) -> str:
    return f"{prefix}apps/{fn}#seed={s['seed']}&root={s['root']}&mode={s['mode']}"


HEAD = """<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title><meta name="description" content="{desc}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&family=Manrope:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{css}"></head><body><div class="wrap">"""


def day_page(s: dict, prev: str | None, nxt: str | None) -> str:
    cards = "".join(
        f'<a class="card" href="{app_href(s, fn, "../")}"><span class="n">{i+1:02d} · {layer}</span>'
        f'<h3>{html.escape(name)}</h3><p>{html.escape(tip)}</p><span class="go">Open in {html.escape(s["key"])} →</span></a>'
        for i, (fn, name, layer, tip) in enumerate(APPS))
    nav = ""
    if prev: nav += f'<a href="{prev}.html">← {prev}</a>'
    nav += '<a href="index.html">All days</a>'
    if nxt: nav += f'<a href="{nxt}.html">{nxt} →</a>'
    return HEAD.format(title=f"{s['date']} · Daily tonal session · Tonal SFX", css="../assets/site.css",
                       desc=f"Daily tonal SFX session for {s['date']}: {s['key']}, {s['bpm']} BPM, {s['mood']}.") + f"""
<header class="top"><a class="brand" href="../index.html">Tonal SFX <em>Suite</em></a><nav><a href="../index.html">Hub</a><a href="index.html">Daily</a><a href="https://github.com/kiniza-development/tonal-sfx">GitHub</a></nav></header>
<section class="hero small"><div class="eyebrow">Daily session · <b>{s['date']}</b></div>
<h1>{html.escape(s['mood'])} <em>in {html.escape(s['key'])}</em></h1>
<p class="lede">{html.escape(s['mood_desc']).capitalize()}. Seed <code>{s['seed']}</code> · {s['bpm']} BPM · relative {html.escape(s['relative'])}. Every link below opens with today's seed and key, so all five layers stack without clashing.</p>
<div class="cta"><a class="btn" href="{app_href(s, APPS[4][0], '../')}">✦ Open today's score</a></div></section>
<section class="grid5">{cards}</section>
<section class="note"><h2>How to use today's session</h2><ol>
<li>Set Pulse &amp; Chord Loops to <b>{s['bpm']} BPM</b> so loops land on your edit's bar grid.</li>
<li>Export a drone in <b>{html.escape(s['key'])}</b> first, then layer mid, top and glue on top.</li>
<li>Line risers' CUT markers up with the edit points; use Resolve phrases on end cards.</li></ol></section>
<nav class="pager">{nav}</nav>
<footer>Generated {s['date']} (Europe/London) by <code>src/daily_publish.py</code>.</footer></div></body></html>
"""


def index_page(sessions: list[dict]) -> str:
    rows = "".join(
        f'<li><a href="{s["date"]}.html"><span class="d">{s["date"]}</span><span class="k">{html.escape(s["key"])}</span>'
        f'<span class="m">{html.escape(s["mood"])}</span><span class="b">{s["bpm"]} BPM</span></a></li>' for s in sessions)
    return HEAD.format(title="Daily tonal sessions · Tonal SFX", css="../assets/site.css",
                       desc="A new keyed tonal SFX session every day.") + f"""
<header class="top"><a class="brand" href="../index.html">Tonal SFX <em>Suite</em></a><nav><a href="../index.html">Hub</a><a href="index.html" aria-current="page">Daily</a><a href="https://github.com/kiniza-development/tonal-sfx">GitHub</a></nav></header>
<section class="hero small"><div class="eyebrow">Archive · <b>{len(sessions)}</b> session{'s' if len(sessions) != 1 else ''}</div>
<h1>Daily <em>tonal sessions</em></h1><p class="lede">Each morning a new key, tempo, mood and seed is published. Open any day to load all five apps with that session's settings. Newest first.</p></section>
<ul class="days">{rows}</ul>
<footer>Published daily at 08:00 UTC by GitHub Actions.</footer></div></body></html>
"""


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--date")
    a = ap.parse_args()
    day = a.date or datetime.datetime.now(ZoneInfo("Europe/London")).date().isoformat()
    datetime.date.fromisoformat(day)
    DAILY.mkdir(exist_ok=True)
    days = {p.stem for p in DAILY.glob("????-??-??.html")} | {day}
    days = sorted(days, reverse=True)
    sessions = [session(d) for d in days]
    for i, s in enumerate(sessions):
        nxt = days[i - 1] if i > 0 else None
        prev = days[i + 1] if i + 1 < len(days) else None
        (DAILY / f"{s['date']}.html").write_text(day_page(s, prev, nxt))
    (DAILY / "index.html").write_text(index_page(sessions))
    latest = sessions[0]
    (DAILY / "latest.json").write_text(json.dumps({"latest": latest, "days": days}, indent=2) + "\n")
    idx = ROOT / "index.html"
    if idx.exists():
        block = (f'<!--TODAY--><a class="today" href="{latest["path"]}"><span class="eyebrow">Today · <b>{latest["date"]}</b></span>'
                 f'<strong>{html.escape(latest["mood"])} in {html.escape(latest["key"])}</strong><span>{latest["bpm"]} BPM · seed {latest["seed"]} →</span></a><!--/TODAY-->')
        t = idx.read_text()
        t2 = re.sub(r"<!--TODAY-->.*?<!--/TODAY-->", block, t, flags=re.S)
        if t2 != t: idx.write_text(t2)
    print(f"Published {latest['path']}: {latest['key']}, {latest['bpm']} BPM, {latest['mood']} ({len(days)} day{"s" if len(days) != 1 else ""})")


if __name__ == "__main__":
    main()
