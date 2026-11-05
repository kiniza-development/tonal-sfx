mountApp({
  n:13,id:'swells',short:'swells',accent:'#8b7cf6',accentInk:'#100a28',layers:[0],layerLabel:'13 · Foundation',
  titleHTML:'Harmonic <em>Swells</em>',
  tagline:'Chord-tone filter and volume swells that crest on the bar line — pad-to-brass colour that never leaves the key.',
  legend:['Low chord tone','Body','Crest harmonic'],
  controls:[
    {legend:'Time',items:[
      {id:'bpm',label:'BPM',type:'range',min:60,max:140,value:88},
      {id:'bars',label:'Bars',type:'select',options:[2,4,8],value:4},
      {id:'crest',label:'Crest',type:'seg',options:['Bar line','Half bar','Two bars'],value:'Bar line'},
    ]},
    {legend:'Colour',items:[
      {id:'character',label:'Character',type:'seg',options:['Pad','Brass','Silk','Choir'],value:'Pad'},
      {id:'bright',label:'Brightness',type:'range',value:50,pct:true,unit:'%'},
      {id:'brass',label:'Brassiness',type:'range',value:35,pct:true,unit:'%'},
      {id:'reverb',label:'Space',type:'range',value:40,pct:true,unit:'%'},
    ]},
  ],
  async render(P,rng){
    const barSec=240/P.bpm,bars=+P.bars,L=barSec*bars;let info;
    const r=await renderLoop({loopSec:L,tailSec:5,fold:true,build:(ctx,out,total)=>{info=genSwells(ctx,out,P,rng,{barSec,bars,loopSec:L,total});return info.events;}});
    const rn=ROMAN[P.key.mode];
    return single(r,{barSec,progLabel:info.prog.map(d=>rn[d]).join(' · '),readout:[['BPM',P.bpm],['Crest',P.crest],['Colour',P.character]],stats:[['Swells',info.n]]});
  },
  fileTag:P=>`swells-${P.character.toLowerCase()}-${P.crest.toLowerCase().replace(/\s+/g,'-')}_${P.bpm}bpm_${P.bars}bar`,
  noteTitle:'A breath that lands on the cut',
  noteHTML:`<p>Each swell is built from the <b>chord tones of the bar</b> and crests on a downbeat (or a half-bar, or every two bars). Volume and a low-pass filter open together, so the harmony blooms without introducing notes outside the key. <i>Brass</i> pushes sawtooths and a brighter ceiling; <i>Silk</i> stays on sines; <i>Choir</i> adds a simple formant.</p>
  <p>Because the crest sits on the bar line, you can line a swell up with a cut, a title, or a camera move and it will feel scored rather than sprayed on. The loop folds its own decay, so a chain of swells repeats cleanly.</p>`,
});
function genSwells(ctx,out,P,rng,T){
  const k=P.key,bar=T.barSec,bars=T.bars,L=T.loopSec,ev=[],prog=rng.pick(PROGS[k.mode]);
  const win=P.crest==='Half bar'?bar/2:P.crest==='Two bars'?bar*2:bar;
  const n=Math.max(1,Math.round(L/win)),W=L/n;
  const bus=fxBus(ctx,out,{reverb:P.reverb??0.4,size:4.5,bright:0.45+P.bright*0.3});
  const wave=P.character==='Silk'?'sine':P.character==='Brass'?'sawtooth':P.character==='Choir'?'sawtooth':'triangle';
  const openF=900+P.bright*7000+P.brass*2500,closedF=180+P.bright*220;
  let swells=0;
  for(let s=0;s<n;s++){
    const t0=s*W,peak=t0+W*0.92,t1=t0+W,deg=prog[Math.floor((t0+1e-6)/bar)%prog.length];
    const notes=fold(chordMidis(k,deg,3,P.character==='Silk'?3:4),48,76);
    const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.Q.value=0.7+P.brass*3;lp.frequency.setValueAtTime(closedF,t0);lp.frequency.linearRampToValueAtTime(openF,peak);lp.frequency.linearRampToValueAtTime(closedF,t1+0.2);lp.connect(bus);
    notes.forEach((m,i)=>{
      const g=ctx.createGain();const pk=(0.055+P.brass*0.04)*(i?0.75:1);
      g.gain.setValueAtTime(0.0001,t0);g.gain.exponentialRampToValueAtTime(pk,peak);g.gain.linearRampToValueAtTime(0.0001,t1+0.15);
      for(const c of(P.character==='Silk'?[0]:[-7,7]))osc(ctx,wave,mtof(m),t0,t1+0.2,c).connect(g);
      g.connect(lp);ev.push({t:t0,dur:W,midi:m,layer:i===0?0:i===notes.length-1?2:1});
    });
    if(P.character==='Choir'){const v=rng.pick(VOWELS),sum=ctx.createGain();sum.gain.value=0.9;v.forEach((fq,i)=>{const bp=ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=fq;bp.Q.value=5+i*2;lp.connect(bp);bp.connect(sum);});sum.connect(bus);}
    swells++;
  }
  return {events:ev,prog,n:swells};
}
