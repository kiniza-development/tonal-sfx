const TENS=['sus2','sus4','7th','9th','Mixed'];
mountApp({
  n:10,id:'tension',short:'tension',accent:'#de6a3a',accentInk:'#1c0b05',layers:[0],layerLabel:'10 · Foundation',
  titleHTML:'Tension <em>Beds</em>',
  tagline:'In-key suspensions — held 2nds, 4ths and 7ths that resolve on demand. Suspense underscore that never goes atonal.',
  legend:['Pedal','Suspension','Resolution'],
  controls:[
    {legend:'Tension',items:[
      {id:'interval',label:'Interval',type:'seg',options:TENS,value:'sus4'},
      {id:'length',label:'Loop length',type:'select',options:[8,16,32],value:16,fmt:v=>v+' s'},
      {id:'resolve',label:'Resolve',type:'seg',options:['Hold','Half','Cadence'],value:'Cadence'},
    ]},
    {legend:'Colour',items:[
      {id:'intensity',label:'Intensity',type:'range',value:55,pct:true,unit:'%'},
      {id:'motion',label:'Motion',type:'range',value:40,pct:true,unit:'%'},
      {id:'bright',label:'Brightness',type:'range',value:40,pct:true,unit:'%'},
      {id:'reverb',label:'Space',type:'range',value:48,pct:true,unit:'%'},
    ]},
  ],
  async render(P,rng){
    const L=+P.length;let info;
    const r=await renderLoop({loopSec:L,tailSec:6,fold:true,build:(ctx,out,total)=>{info=genTension(ctx,out,P,rng,{loopSec:L,total});return info.events;}});
    return single(r,{progLabel:info.label,readout:[['Interval',P.interval],['Resolve',P.resolve],['Loop',L+' s']],stats:[['Segments',info.segs]]});
  },
  fileTag:P=>`tension-${P.interval.toLowerCase()}-${P.resolve.toLowerCase()}_${P.length}s`,
  noteTitle:'Suspense that stays in key',
  noteHTML:`<p>Atonal risers and clusters fight a keyed track. These beds keep the tension <b>inside the scale</b>: a sus2 (root + 2nd + 5th), sus4, added 7th or 9th held over a tonic pedal. The ear hears unfinished business, not wrong notes.</p>
  <p><i>Hold</i> never resolves, so the loop can sit under a long scene. <i>Half</i> releases to a triad in the middle, then suspends again. <i>Cadence</i> spends the last quarter of the loop on the tonic triad — the breath-out before a cut. Filter motion is snapped to whole cycles per loop, so the bed still wraps cleanly.</p>`,
});
function genTension(ctx,out,P,rng,T){
  const L=T.loopSec,k=P.key,ev=[],I=P.intensity??0.55,fade=Math.min(2.8,L/5);
  const kinds={sus2:[0,1,4],sus4:[0,3,4],'7th':[0,2,4,6],'9th':[0,2,4,8]};
  const seq=P.interval==='Mixed'?['sus4','sus2','7th','sus4']:null;
  const nSeg=P.resolve==='Hold'?Math.max(1,P.interval==='Mixed'?4:2):4;
  const seg=L/nSeg,bus=fxBus(ctx,out,{reverb:P.reverb??0.48,size:5.5,bright:0.35+P.bright*0.4});
  const snap=f=>Math.max(1/L,Math.round(f*L)/L);
  const mf=ctx.createBiquadFilter();mf.type='lowpass';mf.Q.value=0.8+P.motion*2;mf.frequency.value=280+P.bright*3400;mf.connect(bus);
  const cyc=Math.max(1,Math.round(L/(16-10*P.motion))),lfo=osc(ctx,'sine',cyc/L,0,T.total||L+fade),lg=ctx.createGain();lg.gain.value=(280+P.bright*3400)*0.55*P.motion;lfo.connect(lg);lg.connect(mf.frequency);
  const voice=(t0,t1,midi,gain,layer)=>{
    const g=ctx.createGain(),fd=Math.min(fade, (t1-t0)*0.4);
    g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(gain,t0+fd);g.gain.setValueAtTime(gain,t1);g.gain.linearRampToValueAtTime(0,t1+fd);
    osc(ctx,'sine',snap(mtof(midi)),t0,t1+fd).connect(g);osc(ctx,'triangle',snap(mtof(midi)),t0,t1+fd,5).connect(g);g.connect(mf);
    ev.push({t:t0,dur:t1-t0,midi,layer});
  };
  const root=degMidi(k,0,2);voice(0,L,root,0.16+I*0.08,0);voice(0,L,root-12,0.22+I*0.1,0);
  const labels=[];
  for(let s=0;s<nSeg;s++){
    const t0=s*seg,t1=t0+seg;let resolved=false;
    if(P.resolve==='Cadence'&&s>=nSeg-1)resolved=true;
    if(P.resolve==='Half'&&s===Math.floor(nSeg/2))resolved=true;
    const name=resolved?'triad':(seq?seq[s%seq.length]:P.interval);
    const degs=resolved?[0,2,4]:(kinds[name]||kinds.sus4);
    labels.push(name);
    degs.forEach((d,i)=>{const oct=d>=7?4:3,m=degMidi(k,d,oct);voice(t0,t1,m,(0.055+I*0.05)*(i?0.85:1),resolved?2:1);});
  }
  return {events:ev,segs:nSeg,label:labels.join(' → ')};
}
