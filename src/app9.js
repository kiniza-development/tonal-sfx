mountApp({
  n:9,id:'dialogue',short:'call',accent:'#f0a0b8',accentInk:'#2a0812',layers:[2],layerLabel:'09 · Top',
  titleHTML:'Call &amp; <em>Response</em>',
  tagline:'Two-voice dialogue phrases in key — a question contour answered by a complementary line. Built for explainer punctuation and beat-by-beat conversation.',
  legend:['Context bed','Call','Response'],rollColors:['#5e6b78','#f0a0b8','#7ec8d4'],
  controls:[
    {legend:'Tempo',items:[
      {id:'bpm',label:'BPM',type:'range',min:60,max:150,value:96},
      {id:'bars',label:'Bars',type:'select',options:[2,4,8],value:4},
      {id:'ending',label:'Ending',type:'seg',options:['Loop','Resolve'],value:'Resolve'},
    ]},
    {legend:'Voices',items:[
      {id:'callVoice',label:'Call',type:'seg',options:Object.keys(INSTRUMENTS),value:'Bell'},
      {id:'respVoice',label:'Response',type:'seg',options:Object.keys(INSTRUMENTS),value:'Glass'},
      {id:'contour',label:'Contour',type:'seg',options:['Ask / Answer','Rise / Fall','Near / Far'],value:'Ask / Answer'},
      {id:'gap',label:'Answer delay',type:'range',value:20,pct:true,fmt:v=>v<15?'tight':v<60?'a beat':'late'},
      {id:'density',label:'Density',type:'range',value:50,pct:true,unit:'%'},
      {id:'bed',label:'Bed',type:'toggle',value:true},
      {id:'reverb',label:'Space',type:'range',value:38,pct:true,unit:'%'},
    ]},
  ],
  async render(P,rng){
    const barSec=240/P.bpm,bars=+P.bars,L=barSec*bars,loop=P.ending==='Loop';let info;
    const r=await renderLoop({loopSec:L,tailSec:loop?4:6,fold:loop,build:(ctx,out)=>{info=genCallResp(ctx,out,P,rng,{barSec,bars,loopSec:L});return info.events;}});
    return single(r,{barSec,progLabel:info.label,readout:[['BPM',P.bpm],['Bars',bars],['Contour',P.contour]],stats:[['Exchanges',info.exchanges]]});
  },
  fileTag:P=>`call-${P.contour.toLowerCase().replace(/[^a-z]+/g,'-')}-${P.ending.toLowerCase()}_${P.bpm}bpm_${P.bars}bar`,
  noteTitle:'A conversation, not a monologue',
  noteHTML:`<p>Explainer cuts often need a <b>question then an answer</b> — two short phrases that talk to each other in the same key. The call rises or leans out; the response falls, inverts, or answers from further away. Both voices snap strong beats to chord tones, so the dialogue never leaves the key.</p>
  <p><i>Resolve</i> lands the last answer on the tonic, which is the right move for a title card or the end of a point. <i>Loop</i> leaves the last phrase open so you can repeat the exchange under a sequence. Turn the bed off to export the two voices alone.</p>`,
});
function genCallResp(ctx,out,P,rng,T){
  const k=P.key,bar=T.barSec,s16=bar/16,bars=T.bars,ev=[],prog=rng.pick(PROGS[k.mode]);
  const bus=fxBus(ctx,out,{reverb:P.reverb??0.38,size:3.4,bright:0.62,delay:0.18,delayTime:bar*3/16,feedback:0.28});
  const callI=INSTRUMENTS[P.callVoice]||INSTRUMENTS.Bell,respI=INSTRUMENTS[P.respVoice]||INSTRUMENTS.Glass;
  const callOct=INST_OCT[P.callVoice]||5,respOct=INST_OCT[P.respVoice]||5;
  const nNotes=3+Math.round((P.density??0.5)*4);
  const delaySteps=Math.round((P.gap??0.2)*6);
  const motif=()=>{let d=rng.pick([0,2,4]);const o=[{s:0,deg:d,len:2}];let pos=2;
    for(let i=1;i<nNotes;i++){const rest=rng.chance(0.15)?1:0;pos+=rest;d=clamp(d+rng.pick([-2,-1,1,2,3]),-2,9);const len=rng.pick([1,2,2,3]);o.push({s:pos,deg:d,len});pos+=len;if(pos>=14)break;}
    return o;};
  const callM=motif();
  const answer=callM.map(n=>{let deg=n.deg;
    if(P.contour==='Ask / Answer')deg=callM[0].deg-(n.deg-callM[0].deg);
    else if(P.contour==='Rise / Fall')deg=n.deg-3;
    else deg=n.deg+rng.pick([3,4,5]);
    return {...n,deg,s:n.s+delaySteps};});
  let exchanges=0;
  for(let pair=0;pair<Math.floor(bars/2);pair++){
    const bCall=pair*2,bResp=bCall+1;exchanges++;
    const snap=(deg,b)=>{const cd=prog[b%prog.length],tones=[cd,cd+2,cd+4].map(x=>x%7);let best=deg,bd=9;
      for(let o=-3;o<=3;o++){const x=deg+o;if(tones.includes(((x%7)+7)%7)&&Math.abs(o)<bd){bd=Math.abs(o);best=x;}}return best;};
    callM.forEach(n=>{const t=bCall*bar+n.s*s16,dg=n.s%4===0?snap(n.deg,bCall):n.deg,m=degMidi(k,dg,callOct);
      callI(ctx,bus,t,n.len*s16,m,n.s===0?1:0.78);ev.push({t,dur:n.len*s16,midi:m,layer:1});});
    let phrase=answer;
    if(P.ending==='Resolve'&&bResp===bars-1){phrase=answer.map(n=>({...n}));const last=phrase[phrase.length-1];last.deg=0;last.len=Math.max(last.len,16-last.s);}
    phrase.forEach(n=>{if(n.s>=16)return;const t=bResp*bar+n.s*s16,dg=n.s%4===0?snap(n.deg,bResp):n.deg,m=degMidi(k,dg,respOct);
      respI(ctx,bus,t,n.len*s16,m,0.82);ev.push({t,dur:n.len*s16,midi:m,layer:2});});
  }
  if(P.bed){const bed=ctx.createGain();bed.gain.value=0.55;bed.connect(bus);
    for(let b=0;b<bars;b++){const t0=b*bar,cd=prog[b%prog.length];
      fold(chordMidis(k,cd,3,3),48,67).forEach(m=>{const g=ctx.createGain();const e=adsr(g.gain,t0,{a:0.3,d:0.3,s:0.75,r:0.5,peak:0.045,hold:t0+bar-0.25});
        osc(ctx,'triangle',mtof(m),t0,e).connect(g);g.connect(bed);ev.push({t:t0,dur:bar,midi:m,layer:0});});}}
  const calls=ev.filter(e=>e.layer===1).slice(0,6).map(e=>midiName(e.midi)).join(' ');
  return {events:ev,exchanges,label:calls+'  ↔  answer'};
}
