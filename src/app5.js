const MOODS={
  Hopeful:{drone:'Warm',pulse:'Arp Pluck',mel:'Bell',glue:'Synth',contour:'Rise',bright:0.6,swing:0.08},
  Tense:{drone:'Dark',pulse:'Ostinato',mel:'Soft Lead',glue:'Cinematic',contour:'Wave',bright:0.3,swing:0},
  Melancholy:{drone:'Glass',pulse:'Mallet',mel:'Music Box',glue:'Clean',contour:'Fall',bright:0.5,swing:0.15},
  Epic:{drone:'Choir',pulse:'Pulse Stabs',mel:'Soft Lead',glue:'Cinematic',contour:'Arch',bright:0.55,swing:0},
  Dreamy:{drone:'Tape',pulse:'Gated Pad',mel:'Glass',glue:'Metallic',contour:'Arch',bright:0.7,swing:0.1},
};
const LAYER_COLORS=['#7c8ea0','#3fc1b0','#ff6b4a','#d8f05a'];
const VARIANTS=[Object.keys(DRONE_MOODS),PULSE_STYLES,Object.keys(INSTRUMENTS),['Cinematic','Synth','Clean','Metallic']];
const ST={arr:null,arrKey:'',vol:[0.8,0.75,0.7,0.8],mute:[false,false,false,false],solo:[false,false,false,false],reroll:[0,0,0,0],variant:['Auto','Auto','Auto','Auto'],cache:[null,null,null,null],els:null};
const TARGET=[0.55,0.5,0.45,0.7];
function effGains(){const anySolo=ST.solo.some(Boolean);return ST.vol.map((v,i)=>(ST.mute[i]||(anySolo&&!ST.solo[i]))?0:v);}
function makeArrangement(seed,bars,energy){const r=makeRng('arr|'+seed+'|'+bars),A=[[],[],[],[]];
  for(let b=0;b<bars;b++){const p=b/bars;
    A[0][b]=true;
    A[1][b]=bars<=2?true:(b>=(r.chance(0.5)?0:Math.floor(bars/4))) && !(b===bars-1&&r.chance(0.3-energy*0.2));
    A[2][b]=bars<=2?true:p>=(r.chance(energy)?0.25:0.5)||(b%2===1&&r.chance(0.3));
    A[3][b]=b===bars-1||(bars===8&&b===3&&r.chance(0.4+energy*0.4));}
  return A;}
function scaledCopy(b,s){const o=newBuf(b.length);for(let c=0;c<2;c++){const d=o.getChannelData(c),x=b.getChannelData(c);for(let i=0;i<x.length;i++)d[i]=x[i]*s;}return o;}
mountApp({
  n:5,id:'score',short:'score',accent:'#e5484d',accentInk:'#fff',layers:[0,1,2,3],layerLabel:'05 · Full stack',
  titleHTML:'Layered <em>Score</em> Studio',rollColors:LAYER_COLORS,legend:['Foundation','Mid','Top','Glue'],
  tagline:'All four tonal layers in one keyed loop — a daily-seeded pattern designer with an arrangement grid, mute / solo per layer, and stem export for your edit.',
  defaults:{root:2,mode:'minor'},
  controls:[
    {legend:'Score',items:[
      {id:'mood',label:'Mood',type:'seg',options:Object.keys(MOODS),value:'Hopeful'},
      {id:'bpm',label:'BPM',type:'range',min:60,max:160,value:96},
      {id:'bars',label:'Bars',type:'select',options:[2,4,8],value:8},
      {id:'energy',label:'Energy',type:'range',value:55,pct:true,unit:'%'},
    ]},
  ],
  async render(P,rng,api){
    const barSec=240/P.bpm,bars=+P.bars,L=bars*barSec,M=MOODS[P.mood]||MOODS.Hopeful,E=P.energy;
    const ak=P.seed+'|'+bars;if(ST.arrKey!==ak||!ST.arr){ST.arr=makeArrangement(P.seed,bars,E);ST.arrKey=ak;buildGrid(api);}
    const prog=makeRng('prog|'+P.seed+'|'+P.key.mode).pick(PROGS[P.key.mode]);
    const v=i=>ST.variant[i]==='Auto'?null:ST.variant[i];
    const specs=[
      {tail:7,gen:(ctx,out,total,rr)=>genDrone(ctx,out,{key:P.key,mood:v(0)||M.drone,evolve:0.5,bright:M.bright,motion:0.35+E*0.3,texture:0.15,sub:true,reverb:0.45,prog},rr,{loopSec:L,total,barSec,bars,mask:ST.arr[0]}).events},
      {tail:4,gen:(ctx,out,total,rr)=>genPulse(ctx,out,{key:P.key,style:v(1)||M.pulse,density:0.3+E*0.6,swing:M.swing,chordRate:'1 bar',bass:true,pump:E*0.5,delay:0.2,reverb:0.22,prog},rr,{barSec,bars,loopSec:L,total,mask:ST.arr[1]}).events},
      {tail:4,gen:(ctx,out,total,rr)=>genMelody(ctx,out,{key:P.key,instrument:v(2)||M.mel,contour:M.contour,density:0.25+E*0.5,range:0.5,develop:0.5,ending:'Loop',bed:'None',delay:0.3,reverb:0.4,prog},rr,{barSec,bars,total,mask:ST.arr[2]}).events},
      {tail:6,gen:(ctx,out,total,rr)=>{const ev=[],GP={key:P.key,intensity:0.4+E*0.5,tension:0.3,character:v(3)||M.glue},b=fxBus(ctx,out,{reverb:0.5,size:4,bright:0.5});
        const A=ST.arr[3];let b0=0;while(b0<bars){if(!A[b0]){b0++;continue;}let b1=b0;while(b1+1<bars&&A[b1+1])b1++;const t0=b0*barSec,D=(b1-b0+1)*barSec;
          glueRiser(ctx,b,GP,rr,t0,D,ev);glueImpact(ctx,b,GP,rr,t0+D,ev,4);b0=b1+1;}
        return ev.map(e=>({...e,t:e.t%L}));}},
    ];
    const results=await Promise.all(specs.map(async(sp,i)=>{
      const ck=JSON.stringify([P.key,P.bpm,bars,P.mood,E,P.seed,ST.variant[i],ST.reroll[i],ST.arr[i]]);
      if(ST.cache[i]&&ST.cache[i].ck===ck)return ST.cache[i].r;
      const rr=makeRng('score|'+P.seed+'|L'+i+'|'+ST.reroll[i]);
      const r=await renderLoop({loopSec:L,tailSec:sp.tail,fold:true,normalizeTo:TARGET[i],build:(ctx,out,total)=>sp.gen(ctx,out,total,rr)});
      r.events.forEach(e=>e.layer=i);ST.cache[i]={ck,r};return r;}));
    const bufs=results.map(r=>r.buffer);
    const sum=newBuf(bufs[0].length);bufs.forEach(b=>{for(let c=0;c<2;c++){const s=b.getChannelData(c),d=sum.getChannelData(c);for(let j=0;j<Math.min(s.length,d.length);j++)d[j]+=s[j];}});
    const master=0.95/Math.max(0.05,peakOf([sum]));
    const res={buffers:bufs,events:results.flatMap(r=>r.events),dur:bufs[0].duration,folded:true,markers:[],barSec,master,prog,
      readout:[['Mood',P.mood],['BPM',P.bpm],['Bars',bars]],progLabel:prog.map(d=>ROMAN[P.key.mode][d]).join(' · ')+'  (shared by all layers)',
      stats:[['Bar',barSec.toFixed(3)+' s'],['Stems','4']]};
    res.mixBuf=mixBufs(bufs,effGains().map(g=>g*master));return res;
  },
  gains:res=>effGains().map(g=>g*res.master),
  mix:res=>mixBufs(res.buffers,effGains().map(g=>g*res.master)),
  extraExports:[{label:'Stems .zip',run:async(res,api,fileBase)=>{if(!res)return;api.setStatus('Packing stems…');
    const names=['01-foundation','02-mid','03-top','04-glue'],base=fileBase(res.P),reps=api.S.repeats;
    const files=res.buffers.map((b,i)=>({name:`${base}_stem-${names[i]}.wav`,blob:encodeWAV(scaledCopy(b,res.master*ST.vol[i]),reps)}));
    files.push({name:`${base}_mix.wav`,blob:encodeWAV(mixBufs(res.buffers,effGains().map(g=>g*res.master)),reps)});
    download(await makeZip(files),base+'_stems.zip');api.setStatus('Stems exported (stems use layer volume, ignore mute/solo)');}}],
  fileTag:P=>`${P.mood.toLowerCase()}_${P.bpm}bpm_${P.bars}bar`,
  mountExtra(el,api){
    el.innerHTML=`<div class="panel mixer"><div class="head"><h2>Layer stack &amp; arrangement</h2>
      <div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="scorebtn" id="todayScore" title="Seed, key, tempo and mood all from today's date">✦ Today's score</button><button type="button" id="rerollArr">Re-deal arrangement</button></div></div>
      <div id="strips"></div><p class="hint" style="margin-top:8px">Click cells to toggle a layer per bar. A lit Glue cell = riser through that bar, landing a pitched impact on the next downbeat. M / S mute and solo live; ↻ re-rolls one layer without touching the others.</p></div>`;
    ST.els=el;el.querySelector('#todayScore').addEventListener('click',()=>{const d=todaySeed(),r=makeRng('today-score|'+d);
      api.setSeed(d);api.setKey(r.int(0,11),r.chance(0.55)?'minor':'major');api.set('bpm',r.pick([72,80,88,92,96,100,108,116,120]));api.set('mood',r.pick(Object.keys(MOODS)));api.set('energy',r.int(35,80));
      ST.arrKey='';ST.reroll=[0,0,0,0];api.rerender();});
    el.querySelector('#rerollArr').addEventListener('click',()=>{const bars=ST.arr?ST.arr[0].length:8;ST.arr=makeArrangement(api.S.seed+'|'+Math.random(),bars,api.params().energy);buildGrid(api);api.rerender();});
  },

  onFrame(pos,res){if(!ST.els)return;const cur=pos==null?-1:Math.floor(pos/res.barSec);ST.els.querySelectorAll('.cells button').forEach(b=>b.classList.toggle('now',+b.dataset.b===cur));},
  noteTitle:'The full tonal stack, in one key',
  noteHTML:`<p><b>Tonal sound effects</b> are pitched elements tuned to a key, built to be stacked like Lego into a custom score. This studio generates all four layers at once — Foundation drone/pad, Mid pulse &amp; chords, Top melody, Glue risers &amp; impacts — sharing one key <i>and one chord progression</i>, so any combination of stems will sit together.</p>
  <p>Seeds are reproducible. <b>Today's score</b> derives the seed, key, tempo and mood from the date, so opening the app each day gives a new starting pattern. Export the mix, a 12-key pack, or a <b>stems zip</b> to mix the layers yourself in Premiere, Resolve or CapCut.</p>`,
});
function buildGrid(api){if(!ST.els||!ST.arr)return;const bars=ST.arr[0].length,host=ST.els.querySelector('#strips');
  const cols=`grid-template-columns:repeat(${bars},1fr)`;
  host.innerHTML=`<div class="strip" style="border-top:0;padding-bottom:0"><span></span><span></span><span></span><span></span><span></span><div class="barnums" style="${cols}">${Array.from({length:bars},(_,b)=>`<span>${b+1}</span>`).join('')}</div><span></span></div>`+
  LAYERS.map((l,i)=>`<div class="strip" style="--lc:${LAYER_COLORS[i]}"><div class="nm"><b>${String(i+1).padStart(2,'0')} ${l[0]}</b><span>${l[1]}</span></div>
    <button type="button" data-m="${i}" aria-pressed="${ST.mute[i]}" aria-label="Mute ${l[0]}">M</button><button type="button" data-s="${i}" aria-pressed="${ST.solo[i]}" aria-label="Solo ${l[0]}">S</button>
    <select data-var="${i}" aria-label="${l[0]} sound">${['Auto',...VARIANTS[i]].map(o=>`<option${o===ST.variant[i]?' selected':''}>${o}</option>`).join('')}</select>
    <input class="vol" type="range" min="0" max="100" value="${Math.round(ST.vol[i]*100)}" data-vol="${i}" aria-label="${l[0]} volume">
    <div class="cells" style="${cols}" role="group" aria-label="${l[0]} bars">${ST.arr[i].map((on,b)=>`<button type="button" data-l="${i}" data-b="${b}" aria-pressed="${!!on}" aria-label="${l[0]} bar ${b+1}"></button>`).join('')}</div>
    <button type="button" data-rr="${i}" title="Re-roll ${l[0]}" aria-label="Re-roll ${l[0]}">↻</button></div>`).join('');
  const live=()=>{const g=effGains();g.forEach((v,i)=>api.player.setGain(i,v*(api.res?api.res.master:1)));if(api.res){api.res.mixBuf=mixBufs(api.res.buffers,g.map(x=>x*api.res.master));api.redraw();}};
  host.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{const i=+b.dataset.m;ST.mute[i]=!ST.mute[i];b.setAttribute('aria-pressed',ST.mute[i]);live();});
  host.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{const i=+b.dataset.s;ST.solo[i]=!ST.solo[i];b.setAttribute('aria-pressed',ST.solo[i]);live();});
  host.querySelectorAll('[data-vol]').forEach(s=>{s.oninput=()=>{ST.vol[+s.dataset.vol]=s.value/100;live();};});
  host.querySelectorAll('[data-var]').forEach(s=>s.onchange=()=>{ST.variant[+s.dataset.var]=s.value;api.rerender();});
  host.querySelectorAll('[data-rr]').forEach(b=>b.onclick=()=>{ST.reroll[+b.dataset.rr]++;api.rerender();});
  host.querySelectorAll('[data-l]').forEach(b=>b.onclick=()=>{const i=+b.dataset.l,j=+b.dataset.b;ST.arr[i]=ST.arr[i].slice();ST.arr[i][j]=!ST.arr[i][j];b.setAttribute('aria-pressed',ST.arr[i][j]);api.rerender();});
}
