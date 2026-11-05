mountApp({
  n:7,id:'grains',short:'glass',accent:'#7ec8d4',accentInk:'#041318',layers:[0],layerLabel:'07 · Texture',
  titleHTML:'Glass &amp; <em>Pluck</em> Textures',
  tagline:'Short decaying glass and pluck grains, quantized to scale tones — an evolving bed that still loops cleanly when the tails fold back in.',
  legend:['Low grains','Mid grains','High sparkle'],
  controls:[
    {legend:'Texture',items:[
      {id:'grain',label:'Grain',type:'seg',options:['Glass','Pluck','Mixed','Crystal'],value:'Mixed'},
      {id:'length',label:'Loop length',type:'select',options:[8,16,32],value:16,fmt:v=>v+' s'},
      {id:'density',label:'Density',type:'range',value:48,pct:true,unit:'%'},
    ]},
    {legend:'Motion',items:[
      {id:'decay',label:'Decay',type:'range',value:55,pct:true,unit:'%'},
      {id:'scatter',label:'Scatter',type:'range',value:40,pct:true,fmt:v=>v<25?'on grid':v<70?'loose':'cloud'},
      {id:'evolve',label:'Evolve',type:'range',value:45,pct:true,unit:'%'},
      {id:'reverb',label:'Space',type:'range',value:50,pct:true,unit:'%'},
    ]},
  ],
  async render(P,rng){
    const L=+P.length;let info;
    const r=await renderLoop({loopSec:L,tailSec:5,fold:true,build:(ctx,out)=>{info=genGlassGrains(ctx,out,P,rng,{loopSec:L});return info.events;}});
    return single(r,{progLabel:info.pool.join(' · '),readout:[['Grain',P.grain],['Loop',L+' s']],stats:[['Grains',info.n]]});
  },
  fileTag:P=>`grains-${P.grain.toLowerCase()}_${P.length}s`,
  noteTitle:'Pitched air, not noise air',
  noteHTML:`<p>These textures are clouds of short <b>in-key</b> grains — glass harmonics and plucked decays — rather than filtered noise. Every grain snaps to a scale tone, so the bed shimmers without going atonal. Release tails fold into the loop start, the same way the drone lab locks its oscillators.</p>
  <p><i>Scatter</i> moves from a regular grid toward a loose cloud; <i>Evolve</i> walks the centre of the grain cloud along the scale so the colour shifts over the loop without leaving the key. <i>Crystal</i> leans on bell-like partials for title cards and freeze-frames.</p>`,
});
function genGlassGrains(ctx,out,P,rng,T){
  const L=T.loopSec,k=P.key,ev=[],D=P.density??0.48,dec=0.35+P.decay*2.8,sc=P.scatter??0.4;
  const bus=fxBus(ctx,out,{reverb:P.reverb??0.5,size:4.2,bright:0.72,delay:0.12,delayTime:L/Math.max(4,Math.round(L/0.375)),feedback:0.22});
  const n=Math.round(L*(3+D*16)),step=L/n;
  const centre=rng.int(0,4);const pool=[centre,centre+2,centre+4,centre+1,centre+7].map(d=>((d%7)+7)%7);
  const names=pool.map(d=>NOTE_NAMES[(k.root+SCALES[k.mode][d])%12]);
  const voice=P.grain,decMul=voice==='Crystal'?1.35:1;
  for(let i=0;i<n;i++){
    let t=i*step;if(sc>0.05)t=(t+rng.range(-step*sc*0.7,step*sc*0.7)+L)%L;
    if(sc<0.25)t=Math.round(t/(L/64))*(L/64)%L;
    const walk=Math.round((i/n)*P.evolve*6)*rng.pick([-1,1]);
    const deg=pool[i%pool.length]+walk;
    const oct=4+(rng.chance(0.25+D*0.2)?1:0)+(rng.chance(0.12)?1:0);
    const m=degMidi(k,deg,oct),vel=(0.45+rng.range(0,0.5))*(0.55+D*0.5);
    const kind=voice==='Mixed'?(rng.chance(0.55)?'Glass':'Pluck'):voice;
    if(kind==='Glass')V.glass(ctx,bus,t,0.2,m,vel,{decay:dec*decMul});
    else if(kind==='Crystal')V.bell(ctx,bus,t,0.3,m,vel*0.85,{ratio:rng.pick([2,2.5,3.5]),decay:dec*1.2,index:1.6});
    else V.pluck(ctx,bus,t,0.12,m,vel,{bright:7+D*5,decay:dec*0.55,wave:'triangle'});
    ev.push({t,dur:Math.min(1.2,dec*0.5),midi:m,layer:m<60?0:m<76?1:2});
  }
  return {events:ev,n,pool:names};
}
