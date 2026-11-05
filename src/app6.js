mountApp({
  n:6,id:'pedal',short:'pedal',accent:'#c4a882',accentInk:'#1a1408',layers:[0],layerLabel:'06 · Foundation',
  titleHTML:'Pedal &amp; <em>Sub</em> Beds',
  tagline:'Sustained pedal tones, tuned sub pulses and fifth/octave beds — foundation weight that sits under dialogue without leaving the key.',
  legend:['Pedal / sub','Fifth / octave','Sub pulse'],
  controls:[
    {legend:'Bed',items:[
      {id:'character',label:'Character',type:'seg',options:['Pedal','Sub Pulse','Fifth Bed','Octave Stack'],value:'Sub Pulse'},
      {id:'length',label:'Loop length',type:'select',options:[8,16,32,64],value:16,fmt:v=>v+' s'},
      {id:'rate',label:'Pulse rate',type:'seg',options:['Slow','Medium','Fast'],value:'Medium'},
    ]},
    {legend:'Weight',items:[
      {id:'weight',label:'Weight',type:'range',value:65,pct:true,unit:'%'},
      {id:'rumble',label:'Rumble',type:'range',value:40,pct:true,unit:'%'},
      {id:'fifth',label:'Add fifth',type:'toggle',value:true},
      {id:'reverb',label:'Space',type:'range',value:42,pct:true,unit:'%'},
    ]},
  ],
  async render(P,rng){
    const L=+P.length,tail=6;let info;
    const r=await renderLoop({loopSec:L,tailSec:tail,fold:true,build:(ctx,out,total)=>{info=genPedalBed(ctx,out,P,rng,{loopSec:L,total});return info.events;}});
    return single(r,{progLabel:'root pedal'+(P.fifth||P.character!=='Pedal'?' + fifth':''),readout:[['Character',P.character],['Loop',L+' s']],stats:[['Pulses',String(info.pulses)]]});
  },
  fileTag:P=>`pedal-${P.character.toLowerCase().replace(/\s+/g,'-')}_${P.length}s`,
  noteTitle:'Foundation weight under dialogue',
  noteHTML:`<p>A <b>pedal</b> is a sustained tone — usually the tonic — that everything else leans on. These beds add a tuned sub, a fifth and an octave so the low end has pitch, not just rumble. Because every partial sits on the key, you can park this under speech or a licensed track without muddying the harmony.</p>
  <p><i>Sub Pulse</i> gates the lowest octave on an integer number of beats per loop, so the pulse wraps seamlessly. <i>Rumble</i> is a slow amplitude beat between two closely detuned sub sines, snapped to whole cycles per loop. Use it quiet: the point is weight, not a bassline.</p>`,
});
function genPedalBed(ctx,out,P,rng,T){
  const L=T.loopSec,k=P.key,ev=[],fade=Math.min(3.2,L/5),W=P.weight??0.65,R=P.rumble??0.4;
  const snap=f=>Math.max(1/L,Math.round(f*L)/L);
  const bus=fxBus(ctx,out,{reverb:P.reverb??0.42,size:6.2,bright:0.22});
  const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=420+W*280;lp.Q.value=0.6;lp.connect(bus);
  const voice=(midi,gain,wave,voices,dest)=>{
    const g=ctx.createGain();g.gain.setValueAtTime(0,0);g.gain.linearRampToValueAtTime(gain,fade);g.gain.setValueAtTime(gain,L);g.gain.linearRampToValueAtTime(0,L+fade);g.connect(dest);
    for(let i=0;i<voices;i++){const c=voices===1?0:(i/(voices-1)*2-1)*4;osc(ctx,wave,snap(mtof(midi)*Math.pow(2,c/1200)),0,L+fade).connect(g);}
    ev.push({t:0,dur:L,midi,layer:midi<40?0:1});
  };
  let root=degMidi(k,0,2);if(root>48)root-=12;const sub=root-12,fifth=root+7,oct=root+12;
  voice(root,0.20+W*0.12,'sine',2,lp);
  if(R>0.02){const sg=ctx.createGain();sg.gain.value=0.22+R*0.28;sg.connect(lp);
    const a=osc(ctx,'sine',snap(mtof(sub)),0,L+fade),b=osc(ctx,'sine',snap(mtof(sub)*Math.pow(2,3.5/1200)),0,L+fade);
    const cyc=Math.max(1,Math.round(L*(0.15+R*0.25))),lfo=osc(ctx,'sine',cyc/L,0,L+fade),lg=ctx.createGain();lg.gain.value=0.35*R;lfo.connect(lg);lg.connect(sg.gain);
    a.connect(sg);b.connect(sg);ev.push({t:0,dur:L,midi:sub,layer:0});}
  const wantFifth=P.fifth||P.character==='Fifth Bed'||P.character==='Octave Stack';
  if(wantFifth)voice(fifth,P.character==='Fifth Bed'?0.14:0.07,'triangle',1,bus);
  if(P.character==='Octave Stack'){voice(oct,0.09,'sine',2,bus);voice(root+19,0.04,'sine',1,bus);}
  let pulses=0;
  if(P.character==='Sub Pulse'){const period=P.rate==='Slow'?2:P.rate==='Fast'?0.5:1;const n=Math.max(1,Math.round(L/period)),dt=L/n;
    for(let i=0;i<n;i++){const t=i*dt,m=sub<28?sub+12:sub,g=ctx.createGain();perc(g.gain,t,0.012,dt*0.82,0.28+W*0.22);
      osc(ctx,'sine',mtof(m),t,t+dt).connect(g);const tg=ctx.createGain();tg.gain.value=0.25;osc(ctx,'triangle',mtof(m),t,t+dt).connect(tg);tg.connect(g);g.connect(lp);
      ev.push({t,dur:dt*0.55,midi:m,layer:2});pulses++;}}
  return {events:ev,pulses};
}
