import pathlib
S=pathlib.Path(__file__).parent; O=S.parent/'apps'
css=(S/'core.css').read_text(); core=''.join((S/f).read_text() for f in ['core1.js','core2.js','core3.js'])
apps=[('01-drone-pad-lab.html','app1','Drone & Pad Lab'),('02-pulse-chord-loops.html','app2','Pulse & Chord Loops'),('03-melody-phrases.html','app3','Melody Phrases'),
      ('04-risers-hits-glue.html','app4','Risers, Hits & Glue'),('05-layered-score-studio.html','app5','Layered Score Studio')]
for fn,a,title in apps:
    extra=(S/(a+'.css')).read_text() if (S/(a+'.css')).exists() else ''
    html=f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} · Tonal SFX Suite</title>
<meta name="description" content="Generative tonal sound effects in any key — {title}. Web Audio, renders WAV loops for video editing.">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&family=Manrope:wght@400;500;600&display=swap" rel="stylesheet">
<style>
{css}
{extra}
</style></head>
<body><noscript>This app needs JavaScript and the Web Audio API.</noscript>
<script>
{core}
</script>
<script>
{(S/(a+'.js')).read_text()}
</script>
</body></html>
'''
    (O/fn).write_text(html)
    print(fn,len(html))
