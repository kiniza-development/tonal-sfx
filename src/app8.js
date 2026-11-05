const ARP_STYLES=['Waterfall','Rising Fan','Broken Chord','Cascade'];
mountApp({
  n:8,id:'cascade',short:'cascade',accent:'#5eead4',accentInk:'#04201a',layers:[1],layerLabel:'08 · Mid',
  titleHTML:'Arpeggio <em>Cascade</em>',
  tagline:'Flowing multi-octave arpeggios — waterfall, rising fan, broken chord and double cascade — written as an exact number of bars at your edit tempo.',
  legend:['Bass tone','Arp body','High cascade'],
  controls:[
    {legend:'Tempo',items:[
      {id:'bpm',label:'BPM',type:'range',min:60,max:170,value:108},
      {id:'bars',label:'Bars',type:'select',options:[2,4,8],value:4},
      {id:'rate',label:'Rate',type:'seg',options:['1/8','1/16','1/32'],value:'1/16'},
    ]},
    {legend:'Shape',items:[
      {id:'style',label:'Style',type:'seg',options:ARP_STYLES,value:'Waterfall'},
      {id:'octaves',label:'Octaves',type:'select',options:[2,3,4],value:3},
      {id:'voice',label:'Voice',type:'seg',options:['Pluck','Glass','Kalimba','Bell'],value:'Pluck'},
      {id:'swing',label:'Swing',type:'range',min:0,max:50,value:8,pct:true,unit:'%'},
      {id:'delay',label:'Echo',type:'range',value:28,pct:true,unit:'%'},
      {id:'reverb',label:'Room',type:'range',value:22,pct:true,unit:'%'},
    ]},
  ],
  async render(P,rng){
    const barSec=240/P.bpm,bars=+P.bars,L=barSec*bars;let info;
    const r=await renderLoop({loopSec:L,tailSec:3.5,fold:true,build:(ctx,out,total)=>{info=genCascade(ctx,out,P,rng,{barSec,bars,loopSec:L,total});return info.events;}});
    const rn=ROMAN[P.key.mode];
    return single(r,{barSec,progLabel:info.prog.map(d=>rn[d]).join(' · '),readout:[['BPM',P.bpm],['Bars',bars],['Style',P.style]],stats:[['Rate',P.rate],['Octaves',P.octaves]]});
  },
  fileTag:P=>`cascade-${P.style.toLowerCase().replace(/\s+/g,'-')}_${P.bpm}bpm_${P.bars}bar`,
  noteTitle:'Not a Euclidean pulse — a flowing harp',
  noteHTML:`<p>App 02 spreads hits with Euclidean rhythms. This cascade is the other kind of mid-layer motion: a <b>continuous arp</b> that pours through the chord tones across two to four octaves. <i>Waterfall</i> descends, <i>Rising Fan</i> opens upward, <i>Broken Chord</i> rolls a repeating figure (1–5–3–5), and <i>Cascade</i> runs both directions at once.</p>
  <p>Every loop is an exact number of bars at the BPM, so it snaps to a timeline grid. Echo tails fold into the start. Pair it with a pedal or drone underneath, or with Melody Phrases on top — they share the key picker.</p>`,
});
function genCascade(ctx,out,P,rng,T){
  const k=P.key,bar=T.barSec,bars=T.bars,ev=[],div=P.rate==='1/8'?8:P.rate==='1/32'?32:16,step0=bar/div;
  const prog=P.prog||rng.pick(PROGS[k.mode]),octs=+P.octaves;
  const bus=fxBus(ctx,out,{reverb:P.reverb??0.22,size:2.8,bright:0.65,delay:P.delay??0.28,delayTime:bar*3/16,feedback:0.34});
  const play=(t,m,vel,layer)=>{
    const v=P.voice,acc=vel;
    if(v==='Glass')V.glass(ctx,bus,t,step0,m,acc,{decay:0.55});
    else if(v==='Kalimba')V.kalimba(ctx,bus,t,step0,m,acc);
    else if(v==='Bell')V.bell(ctx,bus,t,step0,m,acc,{ratio:2.2,decay:0.7,index:1.3});
    else V.pluck(ctx,bus,t,step0*0.9,m,acc,{bright:6.5,decay:0.32});
    ev.push({t,dur:step0*1.2,midi:m,layer});
  };
  const broken=[0,2,1,2];
  for(let b=0;b<bars;b++){
    const deg=prog[b%prog.length],t0=b*bar;
    let pool=[];for(let o=0;o<octs;o++)pool.push(...chordMidis(k,deg,3+o,3));
    pool=fold(pool,50,50+octs*12+4);
    const n=div;let ai=b*n;
    for(let i=0;i<n;i++){
      const sw=(i%2===1?(P.swing||0)*step0*0.7:0),t=t0+i*step0+sw;let idx,layer=1;
      if(P.style==='Waterfall')idx=pool.length-1-(ai%pool.length);
      else if(P.style==='Rising Fan'){const span=Math.min(pool.length,2+Math.floor((i/n)*(pool.length-1)));idx=ai%Math.max(1,span);}
      else if(P.style==='Broken Chord')idx=broken[i%4]%pool.length;
      else{idx=i%2? (ai%pool.length) : pool.length-1-(ai%pool.length);layer=i%2?1:2;}
      const m=pool[((idx%pool.length)+pool.length)%pool.length];
      const vel=i%4===0?1:0.72;play(t,m,vel,m<58?0:layer);ai++;
    }
    const bass=fold([degMidi(k,deg,2)],33,48)[0];V.bass(ctx,bus,t0,bar*0.9,bass,0.55);ev.push({t:t0,dur:bar,midi:bass,layer:0});
  }
  return {events:ev,prog};
}
