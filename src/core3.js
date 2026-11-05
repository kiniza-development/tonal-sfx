/* ---------- playback ---------- */
class Player{
  constructor(){this.ctx=null;this.srcs=[];this.gains=[];this.playing=false;}
  ensure(){if(!this.ctx){const AC=window.AudioContext||window.webkitAudioContext;this.ctx=new AC();this.out=this.ctx.createGain();
    this.an=this.ctx.createAnalyser();this.an.fftSize=2048;this.out.connect(this.an);this.an.connect(this.ctx.destination);}
    if(this.ctx.state==='suspended')this.ctx.resume();return this.ctx;}
  play(bufs,loop,offset=0,gains){this.stop(true);const c=this.ensure(),t0=c.currentTime+0.05;this.dur=bufs[0].duration;this.loop=loop;
    offset=loop?offset%this.dur:0;this.t0=t0-offset;this.vg=c.createGain();this.vg.gain.setValueAtTime(0,t0);this.vg.gain.linearRampToValueAtTime(1,t0+0.01);this.vg.connect(this.out);
    this.gains=bufs.map((b,i)=>{const g=c.createGain();g.gain.value=gains?gains[i]:1;g.connect(this.vg);return g;});
    this.srcs=bufs.map((b,i)=>{const s=c.createBufferSource();s.buffer=b;s.loop=loop;s.connect(this.gains[i]);s.start(t0,offset);return s;});
    this.playing=true;const first=this.srcs[0];if(!loop)first.onended=()=>{if(this.srcs[0]===first){this.playing=false;this.onend&&this.onend();}};}
  setGain(i,v){if(this.gains[i])this.gains[i].gain.setTargetAtTime(v,this.ctx.currentTime,0.015);}
  stop(){if(!this.ctx)return;const t=this.ctx.currentTime,vg=this.vg;if(vg){vg.gain.cancelScheduledValues(t);vg.gain.setValueAtTime(vg.gain.value,t);vg.gain.linearRampToValueAtTime(0,t+0.03);}
    for(const s of this.srcs){s.onended=null;try{s.stop(t+0.04);}catch(e){}}this.srcs=[];this.playing=false;}
  pos(){if(!this.playing)return null;const e=this.ctx.currentTime-this.t0;if(e<0)return 0;return this.loop?e%this.dur:Math.min(e,this.dur);}
}

/* ---------- drawing ---------- */
function fitCanvas(cv){const r=window.devicePixelRatio||1,w=Math.round(cv.clientWidth*r),h=Math.round(cv.clientHeight*r);if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h;}return [w,h,r];}
const cssVar=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function waveImage(cv,buf,markers,barSec){const [w,h,r]=fitCanvas(cv),o=document.createElement('canvas');o.width=w;o.height=h;const g=o.getContext('2d');
  g.fillStyle='#09090a';g.fillRect(0,0,w,h);const dur=buf.duration;
  if(barSec){g.strokeStyle='#1d1d21';g.lineWidth=1;for(let t=barSec;t<dur-1e-3;t+=barSec){const x=Math.round(t/dur*w)+0.5;g.beginPath();g.moveTo(x,0);g.lineTo(x,h);g.stroke();}}
  g.strokeStyle='#1a1a1e';g.beginPath();g.moveTo(0,h/2+0.5);g.lineTo(w,h/2+0.5);g.stroke();
  const L=buf.getChannelData(0),R=buf.getChannelData(1),spp=L.length/w,acc=cssVar('--accent');
  g.fillStyle=acc;g.globalAlpha=0.85;
  for(let x=0;x<w;x++){let mn=1,mx=-1;const a=Math.floor(x*spp),b=Math.min(L.length,Math.floor((x+1)*spp));for(let i=a;i<b;i+=Math.max(1,Math.floor((b-a)/64))){const v=(L[i]+R[i])*0.5;if(v<mn)mn=v;if(v>mx)mx=v;}
    const y1=h/2-mx*h*0.46,y2=h/2-mn*h*0.46;g.fillRect(x,y1,1,Math.max(1,y2-y1));}
  g.globalAlpha=1;(markers||[]).forEach(m=>{const x=Math.round(m.t/dur*w)+0.5;g.strokeStyle='#ece8e1';g.setLineDash([4*r,3*r]);g.beginPath();g.moveTo(x,0);g.lineTo(x,h);g.stroke();g.setLineDash([]);
    g.fillStyle='#ece8e1';g.font=`${10*r}px ${cssVar('--mono')}`;g.fillText(m.label,Math.min(x+5*r,w-90*r),13*r);});
  return o;}
function rollImage(cv,events,dur,key,barSec,colors){const [w,h,r]=fitCanvas(cv),o=document.createElement('canvas');o.width=w;o.height=h;const g=o.getContext('2d');
  g.fillStyle='#09090a';g.fillRect(0,0,w,h);if(!events.length)return o;
  let lo=Infinity,hi=-Infinity;events.forEach(e=>{lo=Math.min(lo,e.midi,e.midi2??e.midi);hi=Math.max(hi,e.midi,e.midi2??e.midi);});lo-=2;hi+=2;if(hi-lo<24){const c=(hi+lo)/2;lo=Math.floor(c-12);hi=Math.ceil(c+12);}
  const rows=hi-lo+1,rh=h/rows,y=m=>h-(m-lo+1)*rh;
  for(let m=lo;m<=hi;m++){const pc=((m-key.root)%12+12)%12;if(pc===0){g.fillStyle='rgba(255,255,255,.05)';g.fillRect(0,y(m),w,rh);}else if(inKey(key,m)){g.fillStyle='rgba(255,255,255,.018)';g.fillRect(0,y(m),w,rh);}}
  if(barSec){g.strokeStyle='#202025';for(let t=0;t<dur;t+=barSec){const x=Math.round(t/dur*w)+0.5;g.beginPath();g.moveTo(x,0);g.lineTo(x,h);g.stroke();}}
  events.forEach(e=>{const x=e.t/dur*w,ww=Math.max(2*r,e.dur/dur*w);g.fillStyle=colors[e.layer%colors.length];g.globalAlpha=e.layer===0?0.55:0.9;
    if(e.midi2!=null){g.strokeStyle=g.fillStyle;g.lineWidth=Math.max(1.5*r,rh*0.5);g.beginPath();g.moveTo(x,y(e.midi)+rh/2);g.lineTo(x+ww,y(e.midi2)+rh/2);g.stroke();}
    else g.fillRect(x,y(e.midi)+rh*0.12,Math.min(ww,w-x),Math.max(1.5*r,rh*0.76));});
  g.globalAlpha=1;g.fillStyle='#6d6a64';g.font=`${9*r}px ${cssVar('--mono')}`;for(let m=lo;m<=hi;m++)if(((m-key.root)%12+12)%12===0)g.fillText(midiName(m),4*r,y(m)+rh*0.8);
  return o;}
function drawWithHead(cv,img,p,dur){const g=cv.getContext('2d');if(!img)return;g.drawImage(img,0,0);if(p==null)return;const x=Math.round(p/dur*cv.width)+0.5;
  g.strokeStyle='#ece8e1';g.lineWidth=1.5*(window.devicePixelRatio||1);g.beginPath();g.moveTo(x,0);g.lineTo(x,cv.height);g.stroke();}
function drawScope(cv,an){const [w,h,r]=fitCanvas(cv),g=cv.getContext('2d');g.fillStyle='#09090a';g.fillRect(0,0,w,h);g.strokeStyle='#1a1a1e';g.beginPath();g.moveTo(0,h/2);g.lineTo(w,h/2);g.stroke();
  if(!an)return;const d=new Float32Array(an.fftSize);an.getFloatTimeDomainData(d);let s=0;for(let i=1;i<d.length/2;i++){if(d[i-1]<0&&d[i]>=0){s=i;break;}}
  g.strokeStyle=cssVar('--accent');g.lineWidth=1.5*r;g.beginPath();const n=1024;for(let i=0;i<n;i++){const x=i/n*w,yy=h/2-d[s+i]*h*0.45;i?g.lineTo(x,yy):g.moveTo(x,yy);}g.stroke();}

/* ---------- app shell ---------- */
const SUITE=[['01-drone-pad-lab.html','Drone & Pad Lab','Foundation'],['02-pulse-chord-loops.html','Pulse & Chord Loops','Mid'],
  ['03-melody-phrases.html','Melody Phrases','Top'],['04-risers-hits-glue.html','Risers, Hits & Glue','Glue'],['05-layered-score-studio.html','Layered Score Studio','All four']];
const LAYERS=[['Foundation','drones · pads · textures'],['Mid','pulse · chords · ostinato'],['Top','melodies · motifs'],['Glue','risers · hits · transitions']];
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function ctlHTML(c){const id='c_'+c.id;
  if(c.type==='range')return `<div class="ctl"><label for="${id}">${c.label}</label><div class="rangewrap"><input type="range" id="${id}" min="${c.min??0}" max="${c.max??100}" step="${c.step??1}" value="${c.value}"><output id="${id}_o" for="${id}"></output></div></div>`;
  if(c.type==='select')return `<div class="ctl"><label for="${id}">${c.label}</label><select id="${id}">${c.options.map(o=>`<option${String(o)===String(c.value)?' selected':''}>${esc(o)}</option>`).join('')}</select></div>`;
  if(c.type==='seg')return `<div class="ctl col"><span class="lbl" id="${id}_l">${c.label}</span><div class="seg" role="group" aria-labelledby="${id}_l" id="${id}">${c.options.map(o=>`<button type="button" data-v="${esc(o)}" aria-pressed="${o===c.value}">${esc(o)}</button>`).join('')}</div></div>`;
  if(c.type==='toggle')return `<div class="ctl"><span class="lbl" id="${id}_l">${c.label}</span><button type="button" id="${id}" aria-labelledby="${id}_l" aria-pressed="${!!c.value}">${c.value?'On':'Off'}</button></div>`;
  return '';}
function mountApp(APP){
  document.documentElement.style.setProperty('--accent',APP.accent);if(APP.accentInk)document.documentElement.style.setProperty('--accent-ink',APP.accentInk);
  const S={root:APP.defaults?.root??9,mode:APP.defaults?.mode??'minor',seed:todaySeed(),loop:APP.loopDefault??true,repeats:1,v:{}};
  APP.controls.forEach(sec=>sec.items.forEach(c=>S.v[c.id]=c.value));
  // restore from URL hash (shareable/reproducible patterns)
  try{const q=new URLSearchParams(location.hash.slice(1));if(q.get('seed'))S.seed=q.get('seed');if(q.has('root'))S.root=clamp(+q.get('root')|0,0,11);if(q.get('mode'))S.mode=q.get('mode')==='major'?'major':'minor';
    APP.controls.forEach(sec=>sec.items.forEach(c=>{if(!q.has(c.id))return;const r=q.get(c.id);S.v[c.id]=c.type==='range'?+r:c.type==='toggle'?r==='1':(c.options&&c.options.map(String).includes(r)?(typeof c.options[0]==='number'?+r:r):S.v[c.id]);}));}catch(e){}
  const idx=APP.n-1;
  document.body.innerHTML=`<a class="skip" href="#transport">Skip to transport</a><div class="wrap">
  <header class="top"><div><div class="eyebrow">Tonal SFX Suite · <b>Nº 0${APP.n}</b> / 05 · Layer <b>${APP.layerLabel}</b></div><h1>${APP.titleHTML}</h1><p class="tagline">${APP.tagline}</p></div>
  <nav class="suite" aria-label="Apps in the suite"><a class="home" href="../index.html"><span class="bar"></span>← Hub<small>Home · <span data-daily>Daily</span></small></a>${SUITE.map((s,i)=>`<a href="${s[0]}"${i===idx?' aria-current="page"':''}><span class="bar"></span>${String(i+1).padStart(2,'0')} ${s[1]}<small>${s[2]}</small></a>`).join('')}</nav></header>
  <main class="grid"><section class="panel controls" aria-label="Controls"><form id="ctl" onsubmit="return false">
    <fieldset><legend>Key</legend><div class="keygrid" role="group" aria-label="Root note">${NOTE_NAMES.map((n,i)=>`<button type="button" data-root="${i}" aria-pressed="${i===S.root}">${n}</button>`).join('')}</div>
      <div class="seg" role="group" aria-label="Mode" style="margin-top:6px"><button type="button" data-mode="major">Major</button><button type="button" data-mode="minor">Minor</button></div>
      <div class="chips" id="chips" aria-label="Scale notes"></div><p class="hint" id="relhint"></p></fieldset>
    <fieldset><legend>Seed</legend><div class="seedrow"><label class="sr" for="seed">Seed</label><input type="text" id="seed" spellcheck="false" autocomplete="off"><button type="button" id="today" title="Use today's date as the seed">Today</button><button type="button" id="dice" title="Random seed (R)">Dice</button></div>
      <p class="hint">Same seed + settings = same result. Today's date gives a fresh pattern every day.</p></fieldset>
    ${APP.controls.map(sec=>`<fieldset><legend>${sec.legend}</legend>${sec.items.map(ctlHTML).join('')}</fieldset>`).join('')}
  </form></section>
  <section class="stage">
    <div class="panel screen"><div class="head"><div class="bigkey" id="bigkey"></div><div class="readout" id="readout"></div></div><canvas class="wave" id="wave" aria-label="Waveform overview" role="img"></canvas></div>
    <div class="row2"><div class="panel screen"><div class="head"><span class="eyebrow">Pattern · in-key rows lit</span><span class="readout" id="proglabel"></span></div><canvas class="roll" id="roll" role="img" aria-label="Piano roll of generated notes"></canvas>
      <div class="legend-row" id="legend"></div></div>
      <div class="panel screen"><div class="head"><span class="eyebrow">Scope</span></div><canvas class="scope" id="scope" aria-hidden="true"></canvas><dl class="stats" id="stats"></dl></div></div>
    <div class="panel transport" id="transport" role="toolbar" aria-label="Transport">
      <button type="button" class="primary play" id="play">▶ Play<span class="kbd">Space</span></button>
      <button type="button" id="loop" aria-pressed="${S.loop}">Loop<span class="kbd">L</span></button>
      <button type="button" id="regen">New pattern<span class="kbd">R</span></button>
      <span class="sp"></span>
      <label class="sr" for="repeats">Export length</label><select id="repeats" style="width:auto"><option value="1">1× loop</option><option value="2">2×</option><option value="4">4×</option></select>
      <button type="button" id="export">Export WAV<span class="kbd">E</span></button>
      <button type="button" id="pack" title="Render this pattern in all 12 roots of the current mode">12-key pack .zip</button>
      ${(APP.extraExports||[]).map((x,i)=>`<button type="button" data-extra="${i}">${x.label}</button>`).join('')}
      <span class="status" id="status" role="status" aria-live="polite"></span></div>
    <div id="extra"></div>
    <div class="panel note"><h2>${APP.noteTitle}</h2>${APP.noteHTML}
      <div class="stack">${LAYERS.map((l,i)=>`<div class="${APP.layers.includes(i)?'on':''}"><b>${String(i+1).padStart(2,'0')} ${l[0]}</b>${l[1]}</div>`).join('')}</div>
      <p class="hint">Shortcuts: Space play/stop · R new pattern · L loop · E export · [ ] transpose root. Exports are 48 kHz / 16-bit WAV; loop exports are sample-exact and wrap their own reverb tails, so they loop click-free on a timeline.</p></div>
  </section></main>
  <footer><span>Tonal SFX Suite — generative, keyed sound design for video · Craig Stanley</span><span>Web Audio · offline-rendered · no samples</span></footer></div>`;
  const $=s=>document.querySelector(s),player=new Player();const colors=()=>APP.rollColors||['#5e6b78','#c9b58f',cssVar('--accent'),'#ece8e1'];
  let res=null,waveImg=null,rollImg=null,job=0,raf=0,timer=0,busy=false;
  // wire controls
  const ctlMap={};APP.controls.forEach(sec=>sec.items.forEach(c=>ctlMap[c.id]=c));
  const fmt=c=>{const v=S.v[c.id];return c.fmt?c.fmt(v,S):v+(c.unit||'');};
  for(const c of Object.values(ctlMap)){const el=$('#c_'+c.id);
    if(c.type==='range'){el.value=S.v[c.id];const o=$('#c_'+c.id+'_o');o.textContent=fmt(c);el.addEventListener('input',()=>{S.v[c.id]=+el.value;o.textContent=fmt(c);schedule();});}
    else if(c.type==='select'){el.value=String(S.v[c.id]);el.addEventListener('change',()=>{S.v[c.id]=typeof c.options[0]==='number'?+el.value:el.value;schedule(0);});}
    else if(c.type==='seg'){el.querySelectorAll('button').forEach(b=>{b.setAttribute('aria-pressed',b.dataset.v===String(S.v[c.id]));b.addEventListener('click',()=>{S.v[c.id]=b.dataset.v;el.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b));schedule(0);});});}
    else if(c.type==='toggle'){el.addEventListener('click',()=>{S.v[c.id]=!S.v[c.id];el.setAttribute('aria-pressed',S.v[c.id]);el.textContent=S.v[c.id]?'On':'Off';schedule(0);});el.setAttribute('aria-pressed',!!S.v[c.id]);el.textContent=S.v[c.id]?'On':'Off';}}
  const setKeyUI=()=>{document.querySelectorAll('[data-root]').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.root===S.root));document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.mode===S.mode));
    const k={root:S.root,mode:S.mode};$('#chips').innerHTML=scaleNotes(k).map((n,i)=>`<span class="chip${i?'':' tonic'}">${n}</span>`).join('');
    const rk=relativeKey(k);$('#relhint').textContent=`Relative ${keyName(rk)} shares these notes — layers in either key will sit together.`;};
  document.querySelectorAll('[data-root]').forEach(b=>b.addEventListener('click',()=>{S.root=+b.dataset.root;setKeyUI();schedule(0);}));
  document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{S.mode=b.dataset.mode;setKeyUI();schedule(0);}));
  const seedEl=$('#seed');seedEl.value=S.seed;seedEl.addEventListener('change',()=>{S.seed=seedEl.value.trim()||todaySeed();schedule(0);});
  $('#today').addEventListener('click',()=>{S.seed=todaySeed();seedEl.value=S.seed;schedule(0);});
  const newSeed=()=>{S.seed=randomSeedWord();seedEl.value=S.seed;schedule(0);};
  $('#dice').addEventListener('click',newSeed);$('#regen').addEventListener('click',newSeed);
  function params(over){const P={key:{root:S.root,mode:S.mode},seed:S.seed};for(const c of Object.values(ctlMap)){let v=S.v[c.id];if(c.pct)v=v/100;P[c.id]=v;}return Object.assign(P,over||{});}
  const syncCtl=c=>{const el=$('#c_'+c.id),v=S.v[c.id];if(c.type==='range'){el.value=v;$('#c_'+c.id+'_o').textContent=fmt(c);}else if(c.type==='select')el.value=String(v);
    else if(c.type==='seg')el.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===String(v)));else if(c.type==='toggle'){el.setAttribute('aria-pressed',!!v);el.textContent=v?'On':'Off';}};
  const api={S,params,player,set:(id,v)=>{S.v[id]=v;syncCtl(ctlMap[id]);},setKey:(root,mode)=>{S.root=root;S.mode=mode;setKeyUI();},setSeed:s=>{S.seed=s;seedEl.value=s;},get res(){return res;},rerender:()=>schedule(0),setStatus:t=>$('#status').textContent=t,redraw:()=>buildImages(),colors};
  function schedule(ms=140){clearTimeout(timer);timer=setTimeout(regen,ms);}
  async function renderWith(P){return APP.render(P,makeRng(APP.id+'|'+P.seed),api);}
  async function regen(){const my=++job;const P=params();$('#status').textContent='Rendering…';
    let r;try{r=await renderWith(P);}catch(e){console.error(e);$('#status').textContent='Render failed: '+e.message;return;}
    if(my!==job)return;res=r;res.P=P;const wasPlaying=player.playing,pos=player.pos();buildImages();updateInfo();
    if(wasPlaying)startPlay(pos||0);
    try{const q=new URLSearchParams({seed:S.seed,root:S.root,mode:S.mode});for(const c of Object.values(ctlMap))q.set(c.id,c.type==='toggle'?(S.v[c.id]?'1':'0'):S.v[c.id]);history.replaceState(null,'','#'+q.toString());}catch(e){}
    $('#status').textContent=`${res.dur.toFixed(2)} s · ${res.folded?'seamless loop':'one-shot'} · ready`;APP.after&&APP.after(res,api);}
  function buildImages(){if(!res)return;const k=res.P.key;waveImg=waveImage($('#wave'),res.mixBuf||res.buffers[0],res.markers,res.barSec);rollImg=rollImage($('#roll'),res.events,res.dur,k,res.barSec,colors());frame(true);}
  function updateInfo(){const P=res.P,k=P.key;$('#bigkey').innerHTML=`${NOTE_NAMES[k.root]} <em style="font-style:italic;color:var(--accent)">${k.mode}</em><small>${keyTag(k)} · SEED ${esc(P.seed)}</small>`;
    $('#readout').innerHTML=(res.readout||[]).map(x=>`<span>${x[0]} <b>${esc(x[1])}</b></span>`).join(' &nbsp;·&nbsp; ');
    $('#proglabel').textContent=res.progLabel||'';
    const ln=APP.legend||['Bass / drone','Harmony','Lead / motif'];$('#legend').innerHTML=ln.map((l,i)=>`<span><i style="background:${colors()[i]}"></i>${l}</span>`).join('');
    $('#stats').innerHTML=[['Length',res.dur.toFixed(2)+' s'],['Notes',res.events.length],['Type',res.folded?'Loop':'One-shot'],['Format','48k WAV'],...(res.stats||[])].map(s=>`<dt>${s[0]}</dt><dd>${esc(s[1])}</dd>`).join('');}
  function frame(once){const pos=player.pos(),dur=res?res.dur:1;drawWithHead($('#wave'),waveImg,pos,dur);drawWithHead($('#roll'),rollImg,pos,dur);drawScope($('#scope'),player.playing?player.an:null);
    if(APP.onFrame)APP.onFrame(pos,res,api);if(!once&&player.playing)raf=requestAnimationFrame(()=>frame());}
  function startPlay(offset=0){if(!res)return;const gains=APP.gains?APP.gains(res,api):null;player.play(res.buffers,S.loop,offset,gains);setPlayUI();cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>frame());}
  function stopPlay(){player.stop();setPlayUI();cancelAnimationFrame(raf);frame(true);}
  player.onend=()=>{setPlayUI();frame(true);};
  function setPlayUI(){$('#play').innerHTML=(player.playing?'■ Stop':'▶ Play')+'<span class="kbd">Space</span>';$('#play').setAttribute('aria-pressed',player.playing);}
  $('#play').addEventListener('click',()=>player.playing?stopPlay():startPlay(0));
  $('#loop').addEventListener('click',()=>{S.loop=!S.loop;$('#loop').setAttribute('aria-pressed',S.loop);if(player.playing)startPlay(player.pos()||0);});
  $('#repeats').addEventListener('change',e=>S.repeats=+e.target.value);
  const fileBase=(P)=>`tonal-${APP.short}_${keyTag(P.key)}_${APP.fileTag(P,res)}_${String(P.seed).replace(/[^a-z0-9-]/gi,'').slice(0,24)}`;
  const exportBuf=r=>APP.mix?APP.mix(r,api):r.buffers[0];
  async function doExport(){if(!res)return;const reps=res.folded?S.repeats:1;download(encodeWAV(exportBuf(res),reps),fileBase(res.P)+(reps>1?'_x'+reps:'')+'.wav');$('#status').textContent='Exported WAV';}
  async function doPack(){if(!res||busy)return;busy=true;const btns=document.querySelectorAll('#transport button');btns.forEach(b=>{if(b.id!=='play')b.disabled=true;});
    try{const files=[];for(let r=0;r<12;r++){const root=(S.root+r)%12;$('#status').textContent=`Rendering ${NOTE_NAMES[root]} (${r+1}/12)…`;
        const P=params({key:{root,mode:S.mode}});const rr=await renderWith(P);rr.P=P;files.push({name:fileBase(P)+'.wav',blob:encodeWAV(exportBuf(rr),rr.folded?S.repeats:1)});await new Promise(q=>setTimeout(q,0));}
      $('#status').textContent='Zipping…';const z=await makeZip(files);download(z,`tonal-${APP.short}_12keys-${S.mode}_${APP.fileTag(res.P,res)}_${String(S.seed).replace(/[^a-z0-9-]/gi,'').slice(0,24)}.zip`);$('#status').textContent='12-key pack exported';}
    catch(e){console.error(e);$('#status').textContent='Pack failed: '+e.message;}finally{busy=false;btns.forEach(b=>b.disabled=false);}}
  $('#export').addEventListener('click',doExport);$('#pack').addEventListener('click',doPack);
  document.querySelectorAll('[data-extra]').forEach(b=>b.addEventListener('click',()=>APP.extraExports[+b.dataset.extra].run(res,api,fileBase)));
  document.addEventListener('keydown',e=>{const t=e.target,tag=t.tagName;if(e.metaKey||e.ctrlKey||e.altKey)return;if(tag==='INPUT'&&t.type==='text'||tag==='SELECT'||tag==='TEXTAREA')return;
    if(e.code==='Space'){if(tag==='BUTTON')return;e.preventDefault();player.playing?stopPlay():startPlay(0);}
    else if(e.key==='r'||e.key==='R')newSeed();else if(e.key==='l'||e.key==='L')$('#loop').click();else if(e.key==='e'||e.key==='E')doExport();
    else if(e.key==='['||e.key===']'){S.root=(S.root+(e.key===']'?1:11))%12;setKeyUI();schedule(0);}});
  let rz=0;window.addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(buildImages,150);});
  if(APP.mountExtra)APP.mountExtra($('#extra'),api);
  setKeyUI();setPlayUI();regen();
  window.__app={api,S,regen,get res(){return res;}};
}
/* single-buffer helper for apps 01–04 */
function single(r,extra){return Object.assign({buffers:[r.buffer],events:r.events,dur:r.buffer.duration,folded:r.folded,markers:r.markers},extra||{});}
