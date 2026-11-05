const GLUE_TYPES=['Riser','Impact','Melodic Hit','Downlifter','Reverse Swell','Stinger'];
const parseLen=(s,bpm)=>s.endsWith('s')&&!s.includes('bar')?parseFloat(s):parseFloat(s)*240/bpm;
mountApp({
  n:4,id:'glue',short:'glue',accent:'#d8f05a',accentInk:'#1b2203',layers:[3],layerLabel:'04 · Glue',loopDefault:false,
  titleHTML:'Risers, Hits <em>&amp;</em> Glue',
  tagline:'Pitched transitions for the cut — risers that land exactly on the tonic, tuned sub impacts, melodic hits, downlifters and reverse swells, all in the key of your track.',
  legend:['Sub / drone','Chord body','Arp / bells'],
  controls:[
    {legend:'Type',items:[
      {id:'type',label:'Element',type:'seg',options:GLUE_TYPES,value:'Riser'},
      {id:'length',label:'Length',type:'select',options:['1s','2s','3s','4s','6s','8s','12s','1 bar','2 bars','4 bars'],value:'4s'},
      {id:'bpm',label:'BPM (bars)',type:'range',min:60,max:170,value:100},
      {id:'land',label:'Land on hit',type:'toggle',value:true},
    ]},
    {legend:'Shape',items:[
      {id:'character',label:'Character',type:'seg',options:['Cinematic','Synth','Clean','Metallic'],value:'Cinematic'},
      {id:'intensity',label:'Intensity',type:'range',value:70,pct:true,unit:'%'},
      {id:'tension',label:'Tension',type:'range',value:30,pct:true,fmt:v=>v<35?'triad':v<70?'sus4':'sus2'},
      {id:'tail',label:'Tail',type:'range',value:50,pct:true,unit:'%'},
    ]},
  ],
  async render(P,rng){
    const D=parseLen(P.length,P.bpm),tail=0.6+P.tail*5,fx=(ctx,out)=>fxBus(ctx,out,{reverb:0.15+P.tail*0.75,size:1.5+P.tail*5,bright:0.55});
    const T=P.type;let cut=0,r;
    if(T==='Reverse Swell'){
      const r1=await renderLoop({loopSec:0.1,tailSec:D+0.6,fold:false,build:(ctx,out)=>{const b=fx(ctx,out),ev=[];const w=ctx.createGain();w.gain.value=1;w.connect(b);
        const cv=ctx.createConvolver();cv.buffer=makeIR(ctx,Math.max(2,D),0.6);const wg=ctx.createGain();wg.gain.value=1.4;w.connect(cv);cv.connect(wg);wg.connect(out);glueMelHit(ctx,w,P,rng,0.01,ev,false);return ev;}});
      let rev=reverseBuf(r1.buffer);const want=Math.round(D*SR);if(rev.length>want){const o=newBuf(want),off=rev.length-want,fi=Math.round(0.05*SR);for(let c=0;c<2;c++){const s=rev.getChannelData(c),d=o.getChannelData(c);d.set(s.subarray(off));for(let i=0;i<fi;i++)d[i]*=i/fi;}rev=o;}
      normalize(rev);const rd=rev.duration;cut=rd;
      const evs=r1.events.map(e=>({...e,t:Math.max(0,rd-0.2-e.dur),dur:Math.min(e.dur,rd)}));let buf=rev;
      if(P.land){const r2=await renderLoop({loopSec:0.5,tailSec:tail+1,fold:false,build:(ctx,out)=>{const ev=[];glueImpact(ctx,fx(ctx,out),P,rng,0,ev,tail+1);return ev;}});
        buf=concatBufs(rev,r2.buffer);normalize(buf);r2.events.forEach(e=>evs.push({...e,t:e.t+rd}));}
      r={buffer:buf,events:evs,folded:false,markers:[{t:cut,label:'CUT '+cut.toFixed(2)+'s'}]};
    }else{
      r=await renderLoop({loopSec:D,tailSec:tail+(P.land?2:0),fold:false,build:(ctx,out,total,meta)=>{const b=fx(ctx,out),ev=[];
        if(T==='Riser'){glueRiser(ctx,b,P,rng,0,D,ev);cut=D;if(P.land)glueImpact(ctx,b,P,rng,D,ev,tail+2);}
        else if(T==='Impact'){glueImpact(ctx,b,P,rng,0.01,ev,D);cut=0.01;}
        else if(T==='Melodic Hit'){cut=glueMelHit(ctx,b,P,rng,0.01,ev);}
        else if(T==='Downlifter'){glueImpact(ctx,b,P,{...rng},0.01,[],Math.min(D,1.2));glueDownlifter(ctx,b,P,rng,0.01,D,ev);cut=0.01;}
        else if(T==='Stinger'){const h=D*0.7;glueRiser(ctx,b,P,rng,0,h,ev);glueImpact(ctx,b,P,rng,h,ev,tail+1);
          const beat=60/P.bpm;[4,2,0].forEach((dg,i)=>{const m=degMidi(P.key,dg+7,4),t=h+beat*(0.5+i*0.5);V.bell(ctx,b,t,0.5,m,0.8,{ratio:3.5,decay:2});ev.push({t,dur:0.6,midi:m,layer:2});});cut=h;}
        meta.markers.push({t:cut,label:(T==='Riser'||T==='Stinger'?'CUT ':'HIT ')+cut.toFixed(2)+'s'});return ev;}});
    }
    const res=single(r,{readout:[['Type',T],['Length',D.toFixed(2)+' s'],['Cut',cut.toFixed(2)+' s']],stats:[['Cut point',cut.toFixed(3)+' s']],progLabel:'cut marker = where the picture edit lands'});
    res.cut=cut;return res;
  },
  fileTag:(P,res)=>`${P.type.toLowerCase().replace(/\s+/g,'-')}-${P.character.toLowerCase()}_${P.length.replace(/\s+/g,'')}${res&&res.cut!=null?'_cut'+Math.round(res.cut*1000)+'ms':''}`,
  noteTitle:'Glue layer: punctuation between shots',
  noteHTML:`<p><b>Tonal SFX</b> have a real musical pitch, so a riser or impact can match the key of the music instead of fighting it. The <b>glue layer</b> is where that matters most: risers build into a cut, pitched impacts mark it, melodic hits accent a title, downlifters release the energy.</p>
  <p>Risers glide <i>up into</i> the root, 5th and octave and finish on the tonic; the accelerating arpeggio climbs the scale and the sub impact drops an octave onto the key's root. The dashed <b>CUT</b> marker (also written into the filename in milliseconds) shows where to line it up with your edit point.</p>`,
});
