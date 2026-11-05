mountApp({
  n:1,id:'drone',short:'drone',accent:'#e8a33d',layers:[0],layerLabel:'01 · Foundation',
  titleHTML:'Drone &amp; <em>Pad</em> Lab',
  tagline:'Generative foundation beds — sustained drones, evolving pads and tuned air, rendered as phase-locked loops that sit under any cue in the same key.',
  legend:['Root drone','Pad chord','Shimmer'],
  controls:[
    {legend:'Character',items:[
      {id:'mood',label:'Mood',type:'seg',options:['Warm','Dark','Glass','Choir','Tape'],value:'Warm'},
      {id:'length',label:'Loop length',type:'select',options:[8,16,32,64],value:16,fmt:v=>v+' s'},
      {id:'evolve',label:'Evolve',type:'range',value:45,pct:true,fmt:v=>v<20?'static':v<55?'2 chords':v<85?'4 chords':'8 chords'},
    ]},
    {legend:'Tone',items:[
      {id:'bright',label:'Brightness',type:'range',value:45,pct:true,unit:'%'},
      {id:'motion',label:'Motion',type:'range',value:40,pct:true,unit:'%'},
      {id:'texture',label:'Tuned air',type:'range',value:25,pct:true,unit:'%'},
      {id:'reverb',label:'Space',type:'range',value:50,pct:true,unit:'%'},
      {id:'sub',label:'Sub octave',type:'toggle',value:true},
    ]},
  ],
  async render(P,rng){
    const L=+P.length,tail=7;let info;
    const r=await renderLoop({loopSec:L,tailSec:tail,fold:true,build:(ctx,out,total)=>{info=genDrone(ctx,out,P,rng,{loopSec:L,total});return info.events;}});
    const rn=ROMAN[P.key.mode];
    return single(r,{progLabel:info.chords.map(d=>rn[d]).join(' → '),readout:[['Mood',P.mood],['Loop',L+' s']],stats:[['Chords',info.chords.length]]});
  },
  fileTag:P=>`pad-${P.mood.toLowerCase()}_${P.length}s`,
  noteTitle:'Foundation layer: the bed everything else sits on',
  noteHTML:`<p><b>Tonal sound effects</b> carry a definite pitch and are built in a musical key, unlike noise-based whooshes or footsteps. Because they're keyed, you can stack them under a licensed track or other tonal elements without dissonance — pick the key of your music and everything lines up.</p>
  <p>This lab makes the <b>foundation</b>: low drones, slowly shifting pads and pitched "air" (band-passed noise tuned to the root and fifth). Every oscillator and LFO is snapped to a whole number of cycles per loop, and release tails are folded back into the start, so the WAV loops on a timeline with no seam. Use <i>Evolve</i> for harmonic movement (i → VI → iv…), <i>Motion</i> for filter drift.</p>`,
});
