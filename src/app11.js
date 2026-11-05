const STING=['Bright','Soft','Heraldic','Tech'];
mountApp({
  n:11,id:'sting',short:'sting',accent:'#f0d56a',accentInk:'#1c1603',layers:[3],layerLabel:'11 · Glue',loopDefault:false,
  titleHTML:'Brand <em>Sting</em> Factory',
  tagline:'One-to-four-bar logo and end-card stings that always resolve to the tonic, with a marked CUT point and four characters — bright, soft, heraldic, tech.',
  legend:['Sub / pedal','Harmony','Motif'],
  controls:[
    {legend:'Sting',items:[
      {id:'style',label:'Style',type:'seg',options:STING,value:'Bright'},
      {id:'bars',label:'Bars',type:'select',options:[1,2,4],value:2},
      {id:'bpm',label:'BPM',type:'range',min:70,max:140,value:100},
    ]},
    {legend:'Shape',items:[
      {id:'intensity',label:'Intensity',type:'range',value:70,pct:true,unit:'%'},
      {id:'tail',label:'Tail',type:'range',value:55,pct:true,unit:'%'},
      {id:'sparkle',label:'Sparkle',type:'range',value:45,pct:true,unit:'%'},
    ]},
  ],
  async render(P,rng){
    const barSec=240/P.bpm,bars=+P.bars,D=barSec*bars,tail=0.8+P.tail*4;let cut=D;
    const r=await renderLoop({loopSec:D,tailSec:tail+1.2,fold:false,build:(ctx,out,total,meta)=>{
      const ev=genSting(ctx,out,P,rng,{barSec,bars,loopSec:D,total});cut=D;
      meta.markers.push({t:cut,label:'CUT '+cut.toFixed(2)+'s'});return ev;}});
    const res=single(r,{barSec,readout:[['Style',P.style],['Bars',bars],['Cut',cut.toFixed(2)+' s']],stats:[['Cut point',cut.toFixed(3)+' s']],progLabel:'lands on the tonic at the CUT'});
    res.cut=cut;return res;
  },
  fileTag:(P,res)=>`sting-${P.style.toLowerCase()}_${P.bars}bar_${P.bpm}bpm${res&&res.cut!=null?'_cut'+Math.round(res.cut*1000)+'ms':''}`,
  noteTitle:'A logo that agrees with the track',
  noteHTML:`<p>End cards and brand stings fail when they fight the music. Every sting here is written in the chosen key and <b>resolves to the tonic</b> at the CUT marker — line that dashed line up with the logo lockup or the last frame of the card.</p>
  <p><i>Bright</i> climbs bell tones into a sparkling tonic triad. <i>Soft</i> swells a warm pad and lands a gentle glass hit. <i>Heraldic</i> opens on fifths, then a short fanfare. <i>Tech</i> sequences a plucky cadence. Export the one-shot (not a loop) and drop it on the timeline.</p>`,
});
function genSting(ctx,out,P,rng,T){
  const k=P.key,bar=T.barSec,D=T.loopSec,I=P.intensity??0.7,ev=[],cut=D;
  const bus=fxBus(ctx,out,{reverb:0.25+P.tail*0.55,size:2.2+P.tail*4,bright:0.6});
  const st=P.style;
  const land=()=>{
    const triad=fold(chordMidis(k,0,4,3),55,76);
    triad.forEach((m,i)=>{V.bell(ctx,bus,cut+i*0.012,1.4,m+12,0.55+I*0.25,{ratio:st==='Heraldic'?2:3.2,decay:2.2+P.tail*1.4,index:1.6});ev.push({t:cut,dur:1.6,midi:m,layer:1});});
    const root=degMidi(k,0,2);V.bass(ctx,bus,cut,0.7,root,0.85);ev.push({t:cut,dur:0.8,midi:root,layer:0});
    if(P.sparkle>0.05){[0,4,7,11].forEach((dg,i)=>{const m=degMidi(k,dg,6);V.glass(ctx,bus,cut+0.02+i*0.018,0.4,m,P.sparkle*0.7,{decay:2});ev.push({t:cut,dur:0.8,midi:m,layer:2});});}
  };
  if(st==='Bright'){const N=Math.max(5,Math.round(D*7));
    for(let i=0;i<N;i++){const p=i/N,t=D*Math.pow(p,0.85)*0.92,m=degMidi(k,Math.round(p*7),5);V.bell(ctx,bus,t,0.25,m,0.35+0.65*p,{ratio:3.5,decay:0.7});ev.push({t,dur:0.25,midi:m,layer:2});}}
  else if(st==='Soft'){const notes=fold(chordMidis(k,3,3,3).concat(chordMidis(k,0,3,3)),50,69);
    notes.forEach(m=>{const g=ctx.createGain();g.gain.setValueAtTime(0.0001,0);g.gain.exponentialRampToValueAtTime(0.08+I*0.04,cut-0.08);g.gain.linearRampToValueAtTime(0,cut+0.4);osc(ctx,'triangle',mtof(m),0,cut+0.5).connect(g);g.connect(bus);ev.push({t:0,dur:D,midi:m,layer:1});});
    V.glass(ctx,bus,cut*0.55,0.4,degMidi(k,2,5),0.5,{decay:1.6});}
  else if(st==='Heraldic'){const hits=[[0,0],[0,4],[bar*0.5,0],[bar*0.5,4],[Math.min(D*0.65,bar),0],[Math.min(D*0.65,bar),7]];
    hits.forEach(([t,dg])=>{if(t>=cut-0.05)return;const m=degMidi(k,dg,3);V.stab(ctx,bus,t,0.28,m,0.85+I*0.15,{bright:5,r:0.2});ev.push({t,dur:0.35,midi:m,layer:1});
      V.stab(ctx,bus,t,0.28,m+7,0.55,{bright:4});ev.push({t,dur:0.35,midi:m+7,layer:1});});
    const fan=[0,2,4,7];fan.forEach((dg,i)=>{const t=Math.max(0,cut-bar*0.45)+i*(bar*0.08);V.bell(ctx,bus,t,0.4,degMidi(k,dg,5),0.7,{ratio:2,decay:1.1});ev.push({t,dur:0.4,midi:degMidi(k,dg,5),layer:2});});}
  else{const div=16,step=D/div;let deg=0;
    for(let i=0;i<div-1;i++){const t=i*step;deg=clamp(deg+rng.pick([-1,1,1,2]),0,7);if(i%4===0)deg=[0,2,4][i/4%3];
      const m=degMidi(k,deg,4);V.pluck(ctx,bus,t,step*0.8,m,i%4===0?1:0.7,{bright:8,decay:0.28});ev.push({t,dur:step,midi:m,layer:2});}
    V.pluck(ctx,bus,cut-step,step,degMidi(k,0,5),1,{bright:9,decay:0.5});ev.push({t:cut-step,dur:step,midi:degMidi(k,0,5),layer:2});}
  land();
  return ev;
}
