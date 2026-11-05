mountApp({
  n:14,id:'counter',short:'counter',accent:'#7ab8ff',accentInk:'#071225',layers:[2],layerLabel:'14 · Top',
  titleHTML:'Counter-Melody <em>Weaver</em>',
  tagline:'A secondary line against a held progression — contrary, parallel or oblique motion — written to complement Melody Phrases rather than replace it.',
  legend:['Held progression','—','Counter line'],rollColors:['#5e6b78','#5e6b78','#7ab8ff'],
  controls:[
    {legend:'Tempo',items:[
      {id:'bpm',label:'BPM',type:'range',min:60,max:150,value:92},
      {id:'bars',label:'Bars',type:'select',options:[2,4,8],value:4},
      {id:'ending',label:'Ending',type:'seg',options:['Loop','Resolve'],value:'Loop'},
    ]},
    {legend:'Line',items:[
      {id:'motion',label:'Motion',type:'seg',options:['Contrary','Parallel','Oblique'],value:'Contrary'},
      {id:'instrument',label:'Voice',type:'seg',options:Object.keys(INSTRUMENTS),value:'Soft Lead'},
      {id:'density',label:'Density',type:'range',value:50,pct:true,unit:'%'},
      {id:'range',label:'Range',type:'range',value:45,pct:true,unit:'%'},
      {id:'bed',label:'Hold chords',type:'toggle',value:true},
      {id:'delay',label:'Echo',type:'range',value:22,pct:true,unit:'%'},
      {id:'reverb',label:'Space',type:'range',value:36,pct:true,unit:'%'},
    ]},
  ],
  async render(P,rng){
    const barSec=240/P.bpm,bars=+P.bars,L=barSec*bars,loop=P.ending==='Loop';let info;
    const r=await renderLoop({loopSec:L,tailSec:loop?4:6,fold:loop,build:(ctx,out)=>{info=genCounter(ctx,out,P,rng,{barSec,bars,loopSec:L});return info.events;}});
    const mel=info.events.filter(e=>e.layer===2);
    return single(r,{barSec,progLabel:info.label,readout:[['BPM',P.bpm],['Motion',P.motion],['Voice',P.instrument]],stats:[['Notes',mel.length]]});
  },
  fileTag:P=>`counter-${P.motion.toLowerCase()}-${P.instrument.toLowerCase().replace(/\s+/g,'-')}_${P.bpm}bpm_${P.bars}bar`,
  noteTitle:'The other melody',
  noteHTML:`<p>Melody Phrases writes the line people hum. This weaver writes the <b>second line</b> — the one that moves against a held progression so the cue feels arranged, not soloed. <i>Contrary</i> motion leans the opposite way to the chord roots, <i>Parallel</i> follows them (starting on a 3rd, so it is not a unison), and <i>Oblique</i> holds a common tone then moves at the phrase end.</p>
  <p>Export this in the same key and seed as a Melody Phrase and stack the two WAVs. Or mute the held chords and drop the counter line over a Pulse loop or a pedal bed.</p>`,
});
function genCounter(ctx,out,P,rng,T){
  const k=P.key,bar=T.barSec,s16=bar/16,bars=T.bars,ev=[],prog=rng.pick(PROGS[k.mode]);
  const bus=fxBus(ctx,out,{reverb:P.reverb??0.36,size:3.2,bright:0.55,delay:P.delay??0.22,delayTime:bar*3/16,feedback:0.3});
  const inst=INSTRUMENTS[P.instrument]||INSTRUMENTS['Soft Lead'],oct=INST_OCT[P.instrument]||4;
  const roots=Array.from({length:bars},(_,b)=>degMidi(k,prog[b%prog.length],2));
  const span=Math.round(1+(P.range??0.45)*5),stepN=P.density>0.65?2:P.density<0.35?4:2;
  let deg=prog[0]+2;
  const notes=[];
  for(let b=0;b<bars;b++){
    const bassDelta=b===0?0:Math.sign(roots[b]-roots[b-1]);
    const nSteps=Math.round(16/stepN*(0.65+P.density*0.5));
    for(let i=0;i<nSteps;i++){
      const s=i*stepN;if(s>=16)break;
      if(P.motion==='Contrary')deg=clamp(deg-bassDelta*(s===0?2:rng.pick([1,1,2])),-1,7+span);
      else if(P.motion==='Parallel')deg=clamp((prog[b%prog.length]+2)+bassDelta*(s===0?1:0)+rng.pick([-1,0,1]),-1,7+span);
      else{if(s===0&&i===0)deg=prog[b%prog.length]+2;else if(s>=12)deg=clamp(deg+rng.pick([-1,1,2]),-1,8);/* hold otherwise */}
      if(s%8===0){const cd=prog[b%prog.length],tones=[cd+2,cd+4,cd];let best=deg,bd=9;
        for(let o=-4;o<=4;o++){const x=deg+o;if(tones.includes(((x%7)+7)%7)&&Math.abs(o)<bd){bd=Math.abs(o);best=x;}}deg=best;}
      notes.push({bar:b,s,len:stepN,deg});
    }
  }
  if(P.ending==='Resolve'&&notes.length){const last=notes[notes.length-1];last.deg=0;last.len=16-last.s;}
  notes.forEach(n=>{const t=n.bar*bar+n.s*s16,m=degMidi(k,n.deg,oct),dur=n.len*s16;
    inst(ctx,bus,t,dur*0.92,m,n.s%8===0?1:0.74);ev.push({t,dur,midi:m,layer:2});});
  if(P.bed){const bed=ctx.createGain();bed.gain.value=0.62;bed.connect(bus);
    for(let b=0;b<bars;b++){const t0=b*bar,cd=prog[b%prog.length];
      fold(chordMidis(k,cd,3,3),48,67).forEach(m=>{const g=ctx.createGain();const e=adsr(g.gain,t0,{a:0.28,d:0.35,s:0.8,r:0.45,peak:0.05,hold:t0+bar-0.22});
        const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=1400;osc(ctx,'sawtooth',mtof(m),t0,e,-4).connect(lp);osc(ctx,'triangle',mtof(m),t0,e,4).connect(lp);lp.connect(g);g.connect(bed);
        ev.push({t:t0,dur:bar,midi:m,layer:0});});}}
  const rn=ROMAN[k.mode];
  return {events:ev,label:P.motion+' over '+prog.map(d=>rn[d]).join(' · ')};
}
