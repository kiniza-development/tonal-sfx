const SCENES=['Dialogue Bed','Explainer','Montage','Reveal','Night Drive','Quiet Tension'];
const ST={vol:[0.82,0.72,0.68],mute:[false,false,false],names:['Bed','Pulse','Line'],n:2,els:null};
function scenEff(){return ST.vol.map((v,i)=>i<ST.n&&!ST.mute[i]?v:0);}
function scaledCopy15(b,s){const o=newBuf(b.length);for(let c=0;c<2;c++){const d=o.getChannelData(c),x=b.getChannelData(c);for(let i=0;i<x.length;i++)d[i]=x[i]*s;}return o;}
mountApp({
  n:15,id:'scene',short:'scene',accent:'#e8b86d',accentInk:'#1a1206',layers:[0,1,2],layerLabel:'15 · Mix',
  titleHTML:'Scene <em>Underscore</em> Mixer',
  tagline:'Lighter than Score Studio — pick a scene mood and a key, auto-layer two or three complementary beds, and export the mix or a stems zip.',
  legend:['Foundation','Motion','Line'],rollColors:['#c4a882','#5eead4','#7ab8ff'],
  controls:[
    {legend:'Scene',items:[
      {id:'scene',label:'Mood',type:'seg',options:SCENES,value:'Explainer'},
      {id:'bpm',label:'BPM',type:'range',min:64,max:140,value:96},
      {id:'bars',label:'Bars',type:'select',options:[4,8],value:4},
      {id:'energy',label:'Energy',type:'range',value:45,pct:true,unit:'%'},
      {id:'reverb',label:'Space',type:'range',value:40,pct:true,unit:'%'},
    ]},
  ],
  async render(P,rng,api){
    const barSec=240/P.bpm,bars=+P.bars,L=bars*barSec,E=P.energy,scene=P.scene;
    const specs=sceneSpecs(P,barSec,bars,L,E);
    ST.n=specs.length;ST.names=specs.map(s=>s.name);
    const results=await Promise.all(specs.map(async(sp,i)=>{
      const rr=makeRng('scene|'+P.seed+'|'+scene+'|'+i);
      const r=await renderLoop({loopSec:L,tailSec:sp.tail,fold:true,normalizeTo:sp.target||0.55,build:(ctx,out,total)=>sp.gen(ctx,out,total,rr)});
      r.events.forEach(e=>e.layer=i);return r;}));
    const bufs=results.map(r=>r.buffer),sum=newBuf(bufs[0].length);
    bufs.forEach(b=>{for(let c=0;c<2;c++){const s=b.getChannelData(c),d=sum.getChannelData(c);for(let j=0;j<Math.min(s.length,d.length);j++)d[j]+=s[j];}});
    const master=0.95/Math.max(0.05,peakOf([sum]));
    const res={buffers:bufs,events:results.flatMap(r=>r.events),dur:bufs[0].duration,folded:true,markers:[],barSec,master,
      readout:[['Scene',scene],['BPM',P.bpm],['Bars',bars]],progLabel:ST.names.join(' + '),
      stats:[['Stems',String(ST.n)],['Bar',barSec.toFixed(3)+' s']]};
    res.mixBuf=mixBufs(bufs,scenEff().map(g=>g*master));
    if(ST.els)buildSceneMix(api);
    return res;
  },
  gains:res=>scenEff().map(g=>g*res.master),
  mix:res=>mixBufs(res.buffers,scenEff().map(g=>g*res.master)),
  extraExports:[{label:'Stems .zip',run:async(res,api,fileBase)=>{if(!res)return;api.setStatus('Packing stems…');
    const base=fileBase(res.P),reps=api.S.repeats;
    const files=res.buffers.map((b,i)=>({name:`${base}_stem-${String(i+1).padStart(2,'0')}-${ST.names[i].toLowerCase().replace(/\s+/g,'-')}.wav`,blob:encodeWAV(scaledCopy15(b,res.master*ST.vol[i]),reps)}));
    files.push({name:`${base}_mix.wav`,blob:encodeWAV(mixBufs(res.buffers,scenEff().map(g=>g*res.master)),reps)});
    download(await makeZip(files),base+'_stems.zip');api.setStatus('Stems exported');}}],
  fileTag:P=>`scene-${P.scene.toLowerCase().replace(/\s+/g,'-')}_${P.bpm}bpm_${P.bars}bar`,
  mountExtra(el,api){
    el.innerHTML=`<div class="panel scenemix"><div class="head"><h2>Scene stems</h2>
      <button type="button" id="todayScene">✦ Today's scene</button></div>
      <div id="sstrips"></div>
      <p class="hint" style="margin-top:8px">Two or three complementary layers for the chosen scene. Mute and volume are live; the stems zip uses each layer's volume and ignores mute.</p></div>`;
    ST.els=el;
    el.querySelector('#todayScene').addEventListener('click',()=>{const d=todaySeed(),r=makeRng('today-scene|'+d);
      api.setSeed(d);api.setKey(r.int(0,11),r.chance(0.6)?'minor':'major');api.set('bpm',r.pick([72,80,88,96,104,112]));api.set('scene',r.pick(SCENES));api.set('energy',r.int(30,70));api.rerender();});
  },
  onFrame(){},
  noteTitle:'A cue, not a whole score',
  noteHTML:`<p>Score Studio stacks all four tonal layers with an arrangement grid. This mixer is the lighter cousin: pick a <b>scene mood</b>, and it auto-layers two or three parts that already agree — a dialogue bed, an explainer pulse plus motif, a montage, a reveal, a night-drive ostinato, or quiet tension.</p>
  <p>Everything shares the key and seed. Export the mix, or a <b>stems zip</b> to ride the layers yourself. Pair a stem with any of the dedicated apps (Pedal, Cascade, Call &amp; Response, Tension) when you want more control over one part.</p>`,
});
function sceneSpecs(P,barSec,bars,L,E){
  const k=P.key,rv=P.reverb??0.4,prog=null;
  const drone=(mood,extra)=>(ctx,out,total,rr)=>genDrone(ctx,out,{key:k,mood,evolve:extra.evolve??0.25,bright:extra.bright??0.4,motion:extra.motion??0.3,texture:extra.texture??0.12,sub:true,reverb:rv,prog},rr,{loopSec:L,total,barSec,bars}).events;
  const pulse=(style,dens)=>(ctx,out,total,rr)=>genPulse(ctx,out,{key:k,style,density:dens,swing:0.08,chordRate:'1 bar',bass:true,pump:E*0.35,delay:0.18,reverb:rv*0.6,prog},rr,{barSec,bars,loopSec:L,total}).events;
  const motif=(inst,cont)=>(ctx,out,total,rr)=>genMelody(ctx,out,{key:k,instrument:inst,contour:cont,density:0.28+E*0.35,range:0.45,develop:0.4,ending:'Loop',bed:'None',delay:0.22,reverb:rv,prog},rr,{barSec,bars,total}).events;
  if(P.scene==='Dialogue Bed')return [
    {name:'Pedal',tail:7,target:0.58,gen:drone('Warm',{evolve:0.15,bright:0.32,motion:0.2,texture:0.08})},
    {name:'Air',tail:5,target:0.4,gen:drone('Glass',{evolve:0.35,bright:0.7,motion:0.25,texture:0.35})},
  ];
  if(P.scene==='Explainer')return [
    {name:'Bed',tail:7,target:0.5,gen:drone('Warm',{evolve:0.3,bright:0.45})},
    {name:'Pulse',tail:4,target:0.48,gen:pulse('Mallet',0.25+E*0.35)},
    {name:'Motif',tail:4,target:0.42,gen:motif('Bell','Arch')},
  ];
  if(P.scene==='Montage')return [
    {name:'Bed',tail:7,target:0.5,gen:drone('Tape',{evolve:0.45,bright:0.5,motion:0.4})},
    {name:'Pulse',tail:4,target:0.5,gen:pulse('Arp Pluck',0.4+E*0.4)},
    {name:'Motif',tail:4,target:0.45,gen:motif('Soft Lead','Rise')},
  ];
  if(P.scene==='Reveal')return [
    {name:'Tension',tail:6,target:0.52,gen:(ctx,out,total,rr)=>genTension(ctx,out,{key:k,interval:'sus4',resolve:'Cadence',intensity:0.45+E*0.3,motion:0.35,bright:0.35,reverb:rv},rr,{loopSec:L,total}).events},
    {name:'Swell',tail:5,target:0.48,gen:(ctx,out,total,rr)=>genSwells(ctx,out,{key:k,character:'Brass',crest:'Two bars',bright:0.45+E*0.3,brass:0.4,reverb:rv},rr,{barSec,bars,loopSec:L,total}).events},
    {name:'Land',tail:6,target:0.6,gen:(ctx,out,total,rr)=>{const ev=[],b=fxBus(ctx,out,{reverb:0.5,size:4,bright:0.5});glueImpact(ctx,b,{key:k,intensity:0.5+E*0.35,tension:0.25,character:'Cinematic'},rr,L-0.01,ev,4);return ev.map(e=>({...e,t:((e.t%L)+L)%L}));}},
  ];
  if(P.scene==='Night Drive')return [
    {name:'Bed',tail:7,target:0.52,gen:drone('Dark',{evolve:0.3,bright:0.28,motion:0.45})},
    {name:'Ostinato',tail:4,target:0.48,gen:pulse('Ostinato',0.35+E*0.35)},
    {name:'Lead',tail:4,target:0.4,gen:motif('Soft Lead','Wave')},
  ];
  return [
    {name:'Suspension',tail:6,target:0.55,gen:(ctx,out,total,rr)=>genTension(ctx,out,{key:k,interval:'Mixed',resolve:'Hold',intensity:0.4+E*0.25,motion:0.3,bright:0.3,reverb:rv},rr,{loopSec:L,total}).events},
    {name:'Grains',tail:5,target:0.42,gen:(ctx,out,total,rr)=>genGlassGrains(ctx,out,{key:k,grain:'Glass',density:0.22+E*0.25,decay:0.6,scatter:0.55,evolve:0.4,reverb:rv},rr,{loopSec:L}).events},
  ];
}
function buildSceneMix(api){if(!ST.els)return;const host=ST.els.querySelector('#sstrips');
  const cols=['#c4a882','#5eead4','#7ab8ff'];
  host.innerHTML=ST.names.map((n,i)=>`<div class="sstrip" style="--lc:${cols[i]}"><div class="nm"><b>${String(i+1).padStart(2,'0')} ${n}</b><span>stem</span></div>
    <button type="button" data-m="${i}" aria-pressed="${ST.mute[i]}" aria-label="Mute ${n}">M</button>
    <input class="vol" type="range" min="0" max="100" value="${Math.round(ST.vol[i]*100)}" data-vol="${i}" aria-label="${n} volume"></div>`).join('');
  const live=()=>{const g=scenEff();g.forEach((v,i)=>api.player.setGain(i,v*(api.res?api.res.master:1)));if(api.res){api.res.mixBuf=mixBufs(api.res.buffers,g.map(x=>x*api.res.master));api.redraw();}};
  host.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{const i=+b.dataset.m;ST.mute[i]=!ST.mute[i];b.setAttribute('aria-pressed',ST.mute[i]);live();});
  host.querySelectorAll('[data-vol]').forEach(s=>{s.oninput=()=>{ST.vol[+s.dataset.vol]=s.value/100;live();};});
}
