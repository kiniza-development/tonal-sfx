const KITS=['Toms','Claves','Bells','Wood','Mixed'];
const PATS=['Straight','Syncopated','Ostinato','Triplet'];
mountApp({
  n:12,id:'perc',short:'perc',accent:'#c4a574',accentInk:'#1a1208',layers:[1],layerLabel:'12 · Mid',
  titleHTML:'Tuned <em>Percussion</em>',
  tagline:'Pitched hits on scale degrees — toms, claves, bells and wood — as kits and simple rhythmic loops that lock to your edit BPM.',
  legend:['Low toms / root','Kit body','High bells'],
  controls:[
    {legend:'Kit',items:[
      {id:'kit',label:'Kit',type:'seg',options:KITS,value:'Mixed'},
      {id:'pattern',label:'Pattern',type:'seg',options:PATS,value:'Straight'},
      {id:'bpm',label:'BPM',type:'range',min:70,max:160,value:112},
      {id:'bars',label:'Bars',type:'select',options:[1,2,4,8],value:4},
    ]},
    {legend:'Feel',items:[
      {id:'density',label:'Density',type:'range',value:55,pct:true,unit:'%'},
      {id:'decay',label:'Decay',type:'range',value:40,pct:true,unit:'%'},
      {id:'swing',label:'Swing',type:'range',min:0,max:50,value:10,pct:true,unit:'%'},
      {id:'reverb',label:'Room',type:'range',value:22,pct:true,unit:'%'},
    ]},
  ],
  async render(P,rng){
    const barSec=240/P.bpm,bars=+P.bars,L=barSec*bars;let info;
    const r=await renderLoop({loopSec:L,tailSec:3,fold:true,build:(ctx,out)=>{info=genTunedPerc(ctx,out,P,rng,{barSec,bars,loopSec:L});return info.events;}});
    return single(r,{barSec,progLabel:P.kit+' · '+P.pattern,readout:[['BPM',P.bpm],['Bars',bars],['Kit',P.kit]],stats:[['Hits',info.hits]]});
  },
  fileTag:P=>`perc-${P.kit.toLowerCase()}-${P.pattern.toLowerCase()}_${P.bpm}bpm_${P.bars}bar`,
  noteTitle:'Rhythm that still has a key',
  noteHTML:`<p>Most percussion libraries are unpitched. These hits sit on <b>scale degrees</b> — root and fifth in the low toms, thirds and octaves in the bells and wood — so a rhythm loop can live under a keyed track without clashing. Patterns are simple on purpose: straight, syncopated, a 3+3+2 ostinato, or triplets. They are meant to lock to a timeline, not to show off.</p>
  <p>Every hit is an exact subdivision of the bar at your BPM, and the room tail folds into the loop start. Layer this under Pulse &amp; Chord Loops, or use it alone as a tuned bed for motion graphics.</p>`,
});
function percTom(ctx,d,t,m,vel,dec){
  const o=ctx.createOscillator();o.frequency.setValueAtTime(mtof(m+6),t);o.frequency.exponentialRampToValueAtTime(Math.max(20,mtof(m)),t+0.07);
  const g=ctx.createGain(),end=perc(g.gain,t,0.003,0.28+dec*0.7,0.55*vel);o.connect(g);g.connect(d);o.start(t);o.stop(end+0.04);
  const n=noiseSrc(ctx,t,t+0.04),hp=ctx.createBiquadFilter();hp.type='lowpass';hp.frequency.value=900;const ng=ctx.createGain();perc(ng.gain,t,0.001,0.04,0.12*vel);n.connect(hp);hp.connect(ng);ng.connect(d);
}
function percClave(ctx,d,t,m,vel){
  const g=ctx.createGain();perc(g.gain,t,0.001,0.09,0.28*vel);osc(ctx,'square',mtof(m),t,t+0.1).connect(g);osc(ctx,'sine',mtof(m)*2.2,t,t+0.08).connect(g);g.connect(d);
  const n=noiseSrc(ctx,t,t+0.02),hp=ctx.createBiquadFilter();hp.type='highpass';hp.frequency.value=2500;const ng=ctx.createGain();perc(ng.gain,t,0.001,0.018,0.2*vel);n.connect(hp);hp.connect(ng);ng.connect(d);
}
function percWood(ctx,d,t,m,vel,dec){V.mallet(ctx,d,t,0.15,m,vel);const g=ctx.createGain();perc(g.gain,t,0.001,0.07+dec*0.1,0.08*vel);osc(ctx,'triangle',mtof(m)*2,t,t+0.12).connect(g);g.connect(d);}
function percBellHit(ctx,d,t,m,vel,dec){V.bell(ctx,d,t,0.4,m,vel,{ratio:2.4,decay:0.6+dec*1.4,index:1.5});}
function genTunedPerc(ctx,out,P,rng,T){
  const k=P.key,bar=T.barSec,bars=T.bars,ev=[],D=P.density??0.55,dec=P.decay??0.4;
  const bus=fxBus(ctx,out,{reverb:P.reverb??0.22,size:2.2,bright:0.45});
  const steps=P.pattern==='Triplet'?12:16,st0=bar/steps;
  const grid=P.pattern==='Straight'?[0,4,8,12]:P.pattern==='Syncopated'?[0,3,6,10,12,14]:P.pattern==='Ostinato'?[0,3,6,8,11,14]:[0,4,8];
  const extra=P.pattern==='Triplet'?[2,6,10]:[2,6,10,14];
  const hit=(t,m,vel,kind,layer)=>{
    if(kind==='Toms')percTom(ctx,bus,t,m,vel,dec);
    else if(kind==='Claves')percClave(ctx,bus,t,m,vel);
    else if(kind==='Bells')percBellHit(ctx,bus,t,m,vel,dec);
    else percWood(ctx,bus,t,m,vel,dec);
    ev.push({t,dur:0.22,midi:m,layer});
  };
  const pickKind=base=>{
    if(P.kit!=='Mixed')return P.kit;
    if(base==='low')return rng.chance(0.7)?'Toms':'Wood';
    if(base==='high')return rng.chance(0.55)?'Bells':'Claves';
    return rng.pick(['Wood','Claves','Toms']);
  };
  let hits=0;
  for(let b=0;b<bars;b++){
    const t0=b*bar,degs=[0,4,0,2];
    grid.forEach((s,j)=>{const sw=(s%2===1?(P.swing||0)*st0*0.7:0),t=t0+s*st0+sw,acc=s===0?1:0.75;
      const deg=degs[j%degs.length],oct=s===0?2:3,m=fold([degMidi(k,deg,oct)],s===0?36:50,s===0?52:72)[0];
      hit(t,m,acc,pickKind(s===0?'low':'mid'),s===0?0:1);hits++;});
    extra.forEach(s=>{if(!rng.chance(D*0.75))return;const t=t0+s*st0,m=degMidi(k,rng.pick([0,2,4,7]),5);
      hit(t,m,0.62,pickKind('high'),2);hits++;});
  }
  return {events:ev,hits};
}
