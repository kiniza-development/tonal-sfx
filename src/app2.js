mountApp({
  n:2,id:'pulse',short:'pulse',accent:'#3fc1b0',accentInk:'#03211d',layers:[1],layerLabel:'02 · Mid',
  titleHTML:'Pulse &amp; <em>Chord</em> Loops',
  tagline:'Bar-aligned rhythmic harmony — Euclidean pulses, arps, ostinatos and gated chords that drive a scene forward at your edit tempo.',
  legend:['Bass','Pulse / chords'],
  controls:[
    {legend:'Tempo',items:[
      {id:'bpm',label:'BPM',type:'range',min:60,max:170,value:104,unit:''},
      {id:'bars',label:'Bars',type:'select',options:[1,2,4,8],value:4},
      {id:'swing',label:'Swing',type:'range',min:0,max:60,value:12,pct:true,unit:'%'},
    ]},
    {legend:'Pattern',items:[
      {id:'style',label:'Style',type:'seg',options:PULSE_STYLES,value:'Arp Pluck'},
      {id:'chordRate',label:'Chord rate',type:'select',options:['½ bar','1 bar','2 bars'],value:'1 bar'},
      {id:'density',label:'Density',type:'range',value:55,pct:true,unit:'%'},
      {id:'bass',label:'Bass',type:'toggle',value:true},
    ]},
    {legend:'Space',items:[
      {id:'pump',label:'Pump',type:'range',value:25,pct:true,unit:'%'},
      {id:'delay',label:'Echo',type:'range',value:25,pct:true,unit:'%'},
      {id:'reverb',label:'Room',type:'range',value:25,pct:true,unit:'%'},
    ]},
  ],
  async render(P,rng){
    const barSec=240/P.bpm,bars=+P.bars,L=barSec*bars;let info;
    const r=await renderLoop({loopSec:L,tailSec:4,fold:true,build:(ctx,out,total)=>{info=genPulse(ctx,out,P,rng,{barSec,bars,loopSec:L,total});return info.events;}});
    const rn=ROMAN[P.key.mode];
    return single(r,{barSec,progLabel:info.prog.map(d=>rn[d]).join(' · '),readout:[['BPM',P.bpm],['Bars',bars],['Style',P.style]],stats:[['Bar',barSec.toFixed(3)+' s']]});
  },
  fileTag:P=>`${P.style.toLowerCase().replace(/\s+/g,'-')}_${P.bpm}bpm_${P.bars}bar`,
  noteTitle:'Mid layer: pulse and harmony',
  noteHTML:`<p><b>Tonal SFX</b> are pitched, keyed sound elements; editors stack them like Lego to score a cut. The <b>mid layer</b> adds momentum: a rhythmic bed and a chord progression that tells the viewer where the scene is heading.</p>
  <p>Rhythms come from Euclidean distributions (hits spread evenly across 16 steps), chords from common progressions in the chosen mode, and every loop is an exact number of bars at the BPM — drop it on a timeline at the same tempo and it snaps to the grid. Echo tails wrap into the loop start, so it repeats cleanly.</p>`,
});
