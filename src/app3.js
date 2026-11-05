mountApp({
  n:3,id:'melody',short:'motif',accent:'#ff6b4a',accentInk:'#260a03',layers:[2],layerLabel:'03 · Top',
  titleHTML:'Melody <em>Phrases</em>',
  tagline:'Signature motifs and short melodic phrases — a one-bar idea developed by repetition, sequence and inversion, resolved to the tonic or left open to loop.',
  legend:['Context bed','—','Melody'],rollColors:['#5e6b78','#5e6b78','#ff6b4a'],
  controls:[
    {legend:'Tempo',items:[
      {id:'bpm',label:'BPM',type:'range',min:60,max:160,value:92},
      {id:'bars',label:'Bars',type:'select',options:[1,2,4,8],value:4},
      {id:'ending',label:'Ending',type:'seg',options:['Loop','Resolve'],value:'Loop'},
    ]},
    {legend:'Phrase',items:[
      {id:'instrument',label:'Voice',type:'seg',options:Object.keys(INSTRUMENTS),value:'Bell'},
      {id:'contour',label:'Contour',type:'seg',options:Object.keys(CONTOURS),value:'Arch'},
      {id:'density',label:'Density',type:'range',value:45,pct:true,unit:'%'},
      {id:'range',label:'Range',type:'range',value:50,pct:true,unit:'%'},
      {id:'develop',label:'Develop',type:'range',value:50,pct:true,fmt:v=>v<30?'repeat':v<70?'vary':'transform'},
    ]},
    {legend:'Context',items:[
      {id:'bed',label:'Bed',type:'select',options:['None','Drone','Chords'],value:'Drone'},
      {id:'delay',label:'Echo',type:'range',value:30,pct:true,unit:'%'},
      {id:'reverb',label:'Space',type:'range',value:40,pct:true,unit:'%'},
    ]},
  ],
  async render(P,rng){
    const barSec=240/P.bpm,bars=+P.bars,L=barSec*bars,loop=P.ending==='Loop';let info;
    const r=await renderLoop({loopSec:L,tailSec:loop?4:6,fold:loop,build:(ctx,out,total)=>{info=genMelody(ctx,out,P,rng,{barSec,bars,total});return info.events;}});
    const mel=info.events.filter(e=>e.layer===2);
    return single(r,{barSec,progLabel:mel.slice(0,10).map(e=>midiName(e.midi)).join(' ')+(mel.length>10?' …':''),
      readout:[['BPM',P.bpm],['Bars',bars],['Voice',P.instrument]],stats:[['Phrase',mel.length+' notes'],['Range',mel.length?midiName(Math.min(...mel.map(e=>e.midi)))+'–'+midiName(Math.max(...mel.map(e=>e.midi))):'—']]});
  },
  fileTag:P=>`${P.instrument.toLowerCase().replace(/\s+/g,'-')}-${P.ending.toLowerCase()}_${P.bpm}bpm_${P.bars}bar${P.bed!=='None'?'_bed':''}`,
  noteTitle:'Top layer: the line people remember',
  noteHTML:`<p>Tonal sound effects are pitched and keyed, so they can be layered like parts of a score. The <b>top layer</b> is the focal point — a melody, sting motif or "signature phrase" that a viewer actually hums.</p>
  <p>The generator writes a one-bar rhythmic cell and a stepwise motif, then develops it bar by bar (repeat, sequence along the chosen contour, vary, invert), snapping strong beats to the chord of each bar. <i>Resolve</i> lands on the tonic for end cards and logos; <i>Loop</i> leaves it open so the phrase can repeat under a sequence. Turn the <i>Bed</i> off to export the melody alone.</p>`,
});
