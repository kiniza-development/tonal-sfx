/* ---------- GENERATORS (shared by apps 01–05) ---------- */
const DRONE_MOODS={
  Warm:{wave:'sawtooth',voices:3,det:9,range:[48,70],cut:1.0,oct:3},
  Dark:{wave:'triangle',voices:2,det:6,range:[41,62],cut:0.45,oct:2},
  Glass:{wave:'sine',voices:2,det:5,range:[60,84],cut:1.8,oct:4},
  Choir:{wave:'sawtooth',voices:3,det:12,range:[50,72],cut:1.2,oct:3,formant:true},
  Tape:{wave:'sawtooth',voices:2,det:7,range:[48,72],cut:0.8,oct:3,wow:true},
};
const VOWELS=[[730,1090,2440],[300,870,2240],[530,1840,2480],[570,840,2410]];
/* Foundation: drones & pads. P: key,mood,evolve,bright,motion,texture,sub,reverb ; T: loopSec,total,barSec?,mask? */
function genDrone(ctx,out,P,rng,T){
  const L=T.loopSec,k=P.key,M=DRONE_MOODS[P.mood]||DRONE_MOODS.Warm,ev=[];
  const snap=f=>Math.max(1/L,Math.round(f*L)/L); // integer cycles per loop → phase-coherent wrap
  const gate=maskGain(ctx,T.mask,T.barSec||L,T.total);
  const bus=fxBus(ctx,out,{reverb:P.reverb??0.45,size:6,bright:P.mood==='Glass'?0.8:0.4});gate.connect(bus);
  const padBus=ctx.createGain();
  // slow filter motion: LFO with integer cycles per loop
  const mf=ctx.createBiquadFilter();mf.type='lowpass';mf.Q.value=0.7+P.motion*3;
  const cut=clamp((350+P.bright*3600)*M.cut,150,14000);mf.frequency.value=cut;
  const cyc=Math.max(1,Math.round(L/(14-10*P.motion))),lfo=osc(ctx,'sine',cyc/L,0,T.total),lg=ctx.createGain();lg.gain.value=cut*0.65*P.motion;lfo.connect(lg);lg.connect(mf.frequency);
  if(M.formant){const v=rng.pick(VOWELS),sum=ctx.createGain();sum.gain.value=2.2;v.forEach((fq,i)=>{const bp=ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=fq;bp.Q.value=6+i*3;padBus.connect(bp);bp.connect(sum);});
    sum.connect(mf);}else padBus.connect(mf);
  mf.connect(gate);
  let wow=null;if(M.wow){wow=ctx.createGain();wow.gain.value=7;osc(ctx,'sine',Math.max(1,Math.round(L*0.4))/L,0,T.total).connect(wow);}
  const fade=Math.min(4,L/4);
  const voice=(t0,t1,midi,gain,wave,voices,det,dest,spread=0.6,fd=fade)=>{
    const g=ctx.createGain();g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(gain,t0+fd);g.gain.setValueAtTime(gain,t1);g.gain.linearRampToValueAtTime(0,t1+fd);g.connect(dest);
    for(let i=0;i<voices;i++){const c=voices===1?0:(i/(voices-1)*2-1)*det,o=osc(ctx,wave,snap(mtof(midi)*Math.pow(2,c/1200)),t0,t1+fd);
      if(wow)wow.connect(o.detune);const p=pan(ctx,voices===1?0:(i/(voices-1)*2-1)*spread);o.connect(p);p.connect(g);}
  };
  // root drone (+ fifth, + sub)
  let rm=degMidi(k,0,2);const droneDest=ctx.createGain();droneDest.connect(gate);
  const dlp=ctx.createBiquadFilter();dlp.type='lowpass';dlp.frequency.value=P.mood==='Glass'?900:600;dlp.connect(droneDest);
  voice(0,L,rm,0.22,P.mood==='Dark'?'sawtooth':'triangle',2,4,dlp,0.3);ev.push({t:0,dur:L,midi:rm,layer:0});
  voice(0,L,rm+7,0.09,'sine',1,0,droneDest);ev.push({t:0,dur:L,midi:rm+7,layer:0});
  if(P.sub){voice(0,L,rm-12,0.28,'sine',1,0,droneDest);ev.push({t:0,dur:L,midi:rm-12,layer:0});}
  // chord segments
  const nSeg=P.prog?T.bars:Math.max(1,Math.min(P.evolve<0.2?1:P.evolve<0.55?2:P.evolve<0.85?4:8,Math.floor(L/2))),seg=L/nSeg,cf=Math.min(fade,seg*0.45);
  const pool=k.mode==='minor'?[5,3,6,2,4]:[3,5,4,1,2];let prev=0;const chords=[0];
  if(P.prog){chords.length=0;for(let b=0;b<nSeg;b++)chords.push(P.prog[b%P.prog.length]);}
  else for(let s=1;s<nSeg;s++){let d;do{d=rng.pick(pool);}while(d===prev);chords.push(d);prev=d;}
  const add=(P.evolve>0.35&&rng.chance(0.6))?1:0,nine=(P.mood==='Glass'||P.bright>0.7)&&rng.chance(0.6);
  chords.forEach((d,s)=>{const t0=s*seg;let notes=chordMidis(k,d,M.oct,3+add);if(nine)notes.push(degMidi(k,d+8,M.oct));notes=fold(notes,M.range[0],M.range[1]);
    notes.forEach(m=>{voice(t0,t0+seg,m,0.07,M.wave,M.voices,M.det,padBus,0.6,cf);ev.push({t:t0,dur:seg,midi:m,layer:1});});
    if(P.bright>0.35){const top=notes[notes.length-1]+12,sg=ctx.createGain();const tr=osc(ctx,'sine',Math.max(1,Math.round(L/3))/L,0,T.total),tg=ctx.createGain();tg.gain.value=0.5;tr.connect(tg);tg.connect(sg.gain);sg.gain.value=0.5;sg.connect(bus);
      voice(t0,t0+seg,top,0.03*P.bright,'sine',2,3,sg,0.9,cf);ev.push({t:t0,dur:seg,midi:top,layer:2});}
  });
  // pitched air texture: narrow band-passed noise tuned to root & fifth
  if(P.texture>0.01){[[rm+36,1],[rm+43,0.6]].forEach(([m,a])=>{const n=noiseSrc(ctx,0,L+fade),bp=ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=mtof(m);bp.Q.value=40;
    const g=ctx.createGain();const v=P.texture*0.9*a;g.gain.setValueAtTime(0,0);g.gain.linearRampToValueAtTime(v,fade);g.gain.setValueAtTime(v,L);g.gain.linearRampToValueAtTime(0,L+fade);
    n.connect(bp);bp.connect(g);g.connect(gate);});}
  return {events:ev,chords};
}

/* Mid: rhythmic / chord loops. P: key,style,density,swing,chordRate,bass,pump,reverb,delay ; T: barSec,bars,loopSec,total,mask? */
const PULSE_STYLES=['Arp Pluck','Pulse Stabs','Ostinato','Gated Pad','Mallet'];
function genPulse(ctx,out,P,rng,T){
  const k=P.key,bar=T.barSec,s16=bar/16,bars=T.bars,ev=[],beat=bar/4;
  const prog=P.prog||rng.pick(PROGS[k.mode]);const rate=P.chordRate||'1 bar';
  const degAt=(b,step)=>{const i=rate==='½ bar'?b*2+(step>=8?1:0):rate==='2 bars'?Math.floor(b/2):b;return prog[i%4];};
  const bus=fxBus(ctx,out,{reverb:P.reverb??0.25,size:2.6,delay:P.delay??0.2,delayTime:beat*0.75,feedback:0.32});
  const pump=ctx.createGain();pump.connect(bus);
  if(P.pump>0.01){for(let b=0;b*beat<T.total;b++){const t=b*beat;pump.gain.setValueAtTime(1-0.7*P.pump,t);pump.gain.linearRampToValueAtTime(1,t+beat*0.6);}}
  const st=i=>i*s16+(i%2===1?(P.swing||0)*s16*0.66:0);
  const ok=b=>!T.mask||T.mask[b%T.mask.length];
  const hits=Math.round(3+P.density*9);let pat=euclid(hits,16);
  const rot=rng.int(0,3)*2;pat=pat.map((_,i)=>pat[(i+rot)%16]);pat[0]=1;
  const style=P.style||'Arp Pluck';
  const arpMode=rng.pick(['up','down','updown','pendulum','random']);
  const motif=rng.pick([[0,2,4,2],[0,4,7,4],[0,1,2,4],[4,2,0,2],[0,2,4,7],[0,4,2,5]]);
  const pat8=euclid(Math.round(3+P.density*5),8);
  const flips=Array.from({length:bars},()=>rng.chance(0.5)?rng.int(1,15):-1);
  let ai=0;
  for(let b=0;b<bars;b++){if(!ok(b))continue;const t0=b*bar;
    for(let i=0;i<16;i++){let on=pat[i];if(flips[b]===i&&b%2===1)on=1-on;const deg=degAt(b,i),t=t0+st(i),acc=(i%4===0?1:0.72);
      if(style==='Arp Pluck'){if(!on)continue;const pool=[...chordMidis(k,deg,4,3),...chordMidis(k,deg,5,3)];const ps=fold(pool,55,84);
        const n=ps.length;let idx;if(arpMode==='up')idx=ai%n;else if(arpMode==='down')idx=n-1-ai%n;else if(arpMode==='updown'){const c=ai%(2*n-2);idx=c<n?c:2*n-2-c;}
        else if(arpMode==='pendulum')idx=(ai%2)?n-1-Math.floor(ai/2)%n:Math.floor(ai/2)%n;else idx=rng.int(0,n-1);ai++;
        V.pluck(ctx,pump,t,s16,ps[idx],acc,{bright:6+P.density*6});ev.push({t,dur:s16*1.5,midi:ps[idx],layer:1});}
      else if(style==='Pulse Stabs'){if(!on)continue;const ns=fold(chordMidis(k,deg,4,P.density>0.5?4:3),55,74);ns.forEach(m=>{V.stab(ctx,pump,t,s16*0.8,m,acc);ev.push({t,dur:s16,midi:m,layer:1});});}
      else if(style==='Gated Pad'){if(!on)continue;const ns=fold(chordMidis(k,deg,4,4),52,74);ns.forEach(m=>{V.stab(ctx,pump,t,s16*0.85,m,0.8*acc,{a:0.012,d:0.05,s:0.9,r:s16*0.5,bright:3,floor:2.5});ev.push({t,dur:s16,midi:m,layer:1});});}
      else if(style==='Ostinato'){if(i%2)continue;if(!pat8[i/2])continue;const m=fold([degMidi(k,deg+motif[(i/2)%4],4)],57,81)[0];
        V.mallet(ctx,pump,t,s16*2,m,acc);V.pluck(ctx,pump,t,s16*2,m,0.35*acc,{bright:4,decay:0.4});ev.push({t,dur:s16*2,midi:m,layer:1});}
      else if(style==='Mallet'){if(i%2||!pat8[i/2])continue;const ns=fold(chordMidis(k,deg,5,3),64,88);ns.forEach((m,j)=>{const tt=t+j*0.018;V.bell(ctx,pump,tt,0.5,m,0.6*acc,{ratio:2,decay:1.1,index:1.4});ev.push({t:tt,dur:s16*2,midi:m,layer:1});});}
    }
    if(P.bass){const bp=[0,...[6,10,12,14].filter(()=>rng.chance(0.35+P.density*0.3))];
      bp.forEach((i,j)=>{const deg=degAt(b,i),m=fold([degMidi(k,deg,2)],33,48)[0],len=(j+1<bp.length?bp[j+1]-i:16-i)*s16*0.9,t=t0+st(i);
        V.bass(ctx,bus,t,len,m,i===0?1:0.8);ev.push({t,dur:len,midi:m,layer:0});});}
  }
  return {events:ev,prog,degAt};
}

/* Top: melodic phrases / motifs. P: key,instrument,contour,density,range,develop,ending,bed,reverb,delay ; T: barSec,bars,total,mask? */
const INSTRUMENTS={'Bell':(c,d,t,u,m,v)=>V.bell(c,d,t,u,m,v,{ratio:3.5,decay:2.2}),'Glass':(c,d,t,u,m,v)=>V.glass(c,d,t,u,m,v),
  'Kalimba':(c,d,t,u,m,v)=>V.kalimba(c,d,t,u,m,v),'Soft Lead':(c,d,t,u,m,v)=>V.lead(c,d,t,u,m,v),'Music Box':(c,d,t,u,m,v)=>V.musicbox(c,d,t,u,m,v)};
const INST_OCT={'Bell':5,'Glass':5,'Kalimba':4,'Soft Lead':4,'Music Box':4};
const CONTOURS={Arch:p=>Math.sin(Math.PI*p),Rise:p=>p,Fall:p=>1-p,Wave:p=>0.5+0.5*Math.sin(2*Math.PI*p),'Call/Answer':p=>0};
function genMelody(ctx,out,P,rng,T){
  const k=P.key,bar=T.barSec,s16=bar/16,bars=T.bars,ev=[];
  const prog=P.prog||rng.pick(PROGS[k.mode]),chordDeg=b=>prog[b%4];
  const inst=INSTRUMENTS[P.instrument]||INSTRUMENTS.Bell,oct=INST_OCT[P.instrument]||5;
  const bus=fxBus(ctx,out,{reverb:P.reverb??0.35,size:3.5,bright:0.6,delay:P.delay??0.3,delayTime:bar*3/16,feedback:0.38});
  const D=P.density??0.5;
  const sparse=[[[4],3],[[-2,2],1],[[3,1],1.5],[[-4],1.2],[[2,2],1]],dense=[[[1,1,1,1],1],[[2,1,1],2],[[1,1,2],2],[[2,2],2],[[3,1],1.5],[[1,3],1]];
  const cells=[];for(let b=0;b<4;b++){const pool=rng.chance(D)?dense:sparse;let c=rng.weighted(pool);if(b===0&&c[0]<0)c=[4];cells.push(c);}
  if(rng.chance(0.5))cells[3]=rng.chance(0.5)?[4]:[-2,2];
  const rhythm=[];let pos=0;for(const c of cells)for(const v of c){if(v>0)rhythm.push({s:pos,len:v});pos+=Math.abs(v);}
  // motif pitches as scale-degree offsets
  const steps=[[1,3],[-1,3],[2,1.4],[-2,1.4],[0,0.8],[3,0.5],[-3,0.5],[4,0.35]];
  let d=rng.pick([0,2,4]);const motif=rhythm.map((r,i)=>{if(i>0)d+=rng.weighted(steps);d=clamp(d,-3,9);return{...r,deg:d};});
  const span=Math.round(2+(P.range??0.5)*6),C=CONTOURS[P.contour]||CONTOURS.Arch,dev=P.develop??0.5;
  const ok=b=>!T.mask||T.mask[b%T.mask.length];
  const snapChord=(deg,cd)=>{const tones=[cd,cd+2,cd+4].map(x=>x%7);let best=deg,bd=9;for(let o=-3;o<=3;o++){const x=deg+o;if(tones.includes(((x%7)+7)%7)&&Math.abs(o)<bd){bd=Math.abs(o);best=x;}}return best;};
  const notes=[];
  for(let b=0;b<bars;b++){const p=bars>1?b/(bars-1):0;let shift=Math.round(C(p)*span)-Math.round(span/3);
    if(P.contour==='Call/Answer')shift=b%2?-1:2;
    let phr=motif.map(n=>({...n}));const mode=b===0?'motif':rng.weighted([['repeat',1.4-dev],['sequence',1],['vary',0.4+dev],['invert',dev*0.6]]);
    if(mode==='vary'){const j=rng.int(0,phr.length-1);phr[j].deg+=rng.pick([-2,-1,1,2]);if(phr.length>2&&rng.chance(dev)){const q=rng.int(1,phr.length-1);phr[q].deg+=rng.pick([-1,1]);}}
    if(mode==='invert'){const a=phr[0].deg;phr.forEach(n=>n.deg=a-(n.deg-a));}
    if(mode==='repeat')shift=b%2?shift:0;
    phr.forEach(n=>{let dg=n.deg+shift;if(n.s%8===0)dg=snapChord(dg,chordDeg(b));notes.push({bar:b,s:n.s,len:n.len,deg:dg});});
  }
  // ending
  if(notes.length){const lastBar=bars-1;
    if(P.ending==='Resolve'){for(let i=notes.length-1;i>=0;i--)if(notes[i].bar===lastBar&&notes[i].s>=8)notes.splice(i,1);
      const cand=notes.filter(n=>n.bar===lastBar);const f=cand.length?cand[cand.length-1]:null;
      const tonic=(f&&f.deg>4)?7:0;if(f&&f.s<8){f.len=16-f.s;f.deg=tonic;}else notes.push({bar:lastBar,s:8,len:8,deg:tonic});
      const fl=notes[notes.length-1];fl.len=16-fl.s;fl.deg=tonic;}
    else{const l=notes[notes.length-1],first=notes[0].deg;l.deg=snapChord(first+rng.pick([1,-1,2]),prog[(bars-1)%4]);}}
  notes.forEach(n=>{if(!ok(n.bar))return;const t=n.bar*bar+n.s*s16,m=degMidi(k,n.deg,oct),dur=n.len*s16,vel=(n.s%4===0?1:0.75);
    inst(ctx,bus,t,dur,m,vel);ev.push({t,dur,midi:m,layer:2});});
  // optional bed for context
  if(P.bed&&P.bed!=='None'){const bed=ctx.createGain();bed.gain.value=0.6;bed.connect(bus);
    for(let b=0;b<bars;b++){if(!ok(b))continue;const t0=b*bar,cd=chordDeg(b);
      if(P.bed==='Chords'){fold(chordMidis(k,cd,3,3),48,67).forEach(m=>{const g=ctx.createGain();const e=adsr(g.gain,t0,{a:0.35,d:0.4,s:0.8,r:0.6,peak:0.05,hold:t0+bar-0.3});
        const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=1200;osc(ctx,'sawtooth',mtof(m),t0,e,-5).connect(lp);osc(ctx,'triangle',mtof(m),t0,e,5).connect(lp);lp.connect(g);g.connect(bed);ev.push({t:t0,dur:bar,midi:m,layer:0});});}
      else{const m=degMidi(k,0,2);[m,m+7].forEach((x,j)=>{const g=ctx.createGain();const e=adsr(g.gain,t0,{a:0.4,d:0.2,s:1,r:0.5,peak:j?0.07:0.12,hold:t0+bar});osc(ctx,'triangle',mtof(x),t0,e).connect(g);g.connect(bed);ev.push({t:t0,dur:bar,midi:x,layer:0});});}}}
  return {events:ev,prog};
}

/* Glue: risers / impacts / hits. P: key,intensity,tension,character,tail */
const WAVES={Clean:'triangle',Cinematic:'sawtooth',Synth:'sawtooth',Metallic:'square'};
function glueRiser(ctx,dest,P,rng,t0,D,ev){
  const k=P.key,I=P.intensity??0.7,ch=P.character||'Cinematic',end=t0+D,ten=P.tension??0.3;
  const degs=[0,4,7];if(ten>0.35)degs.push(ten>0.7?1:3);
  const glide=Math.round(5+I*7);
  const g=ctx.createGain();g.gain.setValueAtTime(0.0001,t0);g.gain.exponentialRampToValueAtTime(1,end-0.012);g.gain.linearRampToValueAtTime(0,end+0.01);g.connect(dest);
  const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.Q.value=1+I*5;lp.frequency.setValueAtTime(240,t0);lp.frequency.exponentialRampToValueAtTime(1600+I*9000,end);
  const trem=ctx.createGain();trem.gain.value=1-0.3*I;const lfo=ctx.createOscillator();lfo.frequency.setValueAtTime(2,t0);lfo.frequency.exponentialRampToValueAtTime(16,end);lfo.start(t0);lfo.stop(end+0.05);
  const lg=ctx.createGain();lg.gain.value=0.3*I;lfo.connect(lg);lg.connect(trem.gain);lp.connect(trem);trem.connect(g);
  degs.forEach((dg,i)=>{const m=degMidi(k,dg,3),fE=mtof(m),fS=fE*Math.pow(2,-glide/12);
    for(const c of[-8,8]){const o=ctx.createOscillator();o.type=WAVES[ch];o.detune.value=c;o.frequency.setValueAtTime(fS,t0);o.frequency.exponentialRampToValueAtTime(fE,end);
      const vg=ctx.createGain();vg.gain.value=ch==='Metallic'?0.03:0.06;const p=pan(ctx,(i%2?1:-1)*0.4*(c>0?1:-1));o.connect(vg);vg.connect(p);p.connect(lp);o.start(t0);o.stop(end+0.05);}
    ev.push({t:t0,dur:D,midi:m-glide,midi2:m,layer:1});});
  // accelerating stepped arpeggio climbing the scale — lands on the tonic at the cut
  if(ch!=='Clean'||I>0.4){const N=Math.max(6,Math.round(D*5*(0.5+I))),spanD=I>0.6?14:7,ag=ctx.createGain();ag.gain.value=0.7;ag.connect(dest);
    for(let i=0;i<N;i++){const p=i/N,t=t0+D*Math.pow(p,0.6);if(t>end-0.04)break;const m=degMidi(k,Math.round(p*spanD),4),vel=0.25+0.75*p;
      if(ch==='Metallic')V.bell(ctx,ag,t,0.2,m,vel,{ratio:3.5,decay:0.5});else V.pluck(ctx,ag,t,0.08,m,vel,{bright:5+I*6,decay:0.25});ev.push({t,dur:0.08,midi:m,layer:2});}}
  // tuned air: band-pass sweep (texture under the pitched layers)
  const n=noiseSrc(ctx,t0,end),bp=ctx.createBiquadFilter();bp.type='bandpass';bp.Q.value=5;const r0=degMidi(k,0,4);
  bp.frequency.setValueAtTime(mtof(r0),t0);bp.frequency.exponentialRampToValueAtTime(mtof(r0+36),end);const ng=ctx.createGain();ng.gain.setValueAtTime(0.0001,t0);ng.gain.exponentialRampToValueAtTime(0.12*I+0.01,end-0.01);ng.gain.linearRampToValueAtTime(0,end+0.01);
  n.connect(bp);bp.connect(ng);ng.connect(dest);
  if(ch==='Cinematic'){const m=degMidi(k,0,2),og=ctx.createGain();og.gain.setValueAtTime(0.0001,t0);og.gain.exponentialRampToValueAtTime(0.25,end-0.01);og.gain.linearRampToValueAtTime(0,end+0.01);osc(ctx,'sine',mtof(m),t0,end).connect(og);og.connect(dest);ev.push({t:t0,dur:D,midi:m,layer:0});}
}
function glueImpact(ctx,dest,P,rng,t,ev,D=3){
  const k=P.key,I=P.intensity??0.7,ch=P.character||'Cinematic',ten=P.tension??0.3;
  let sm=degMidi(k,0,1);if(sm<28)sm+=12;
  const so=ctx.createOscillator();so.frequency.setValueAtTime(mtof(sm+12),t);so.frequency.exponentialRampToValueAtTime(mtof(sm),t+0.09);
  const sg=ctx.createGain();const e1=perc(sg.gain,t,0.002,Math.min(D,1+I*2.5),0.9*(0.5+I*0.5));so.connect(sg);sg.connect(dest);so.start(t);so.stop(e1+0.05);ev.push({t,dur:e1-t,midi:sm,layer:0});
  const degs=[0,4,7];if(ten>0.5)degs.push(ten>0.8?1:3);
  const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.setValueAtTime(3000+I*6000,t);lp.frequency.setTargetAtTime(350,t+0.01,0.15);lp.connect(dest);
  degs.forEach(dg=>{const m=degMidi(k,dg,3),g=ctx.createGain();const e=adsr(g.gain,t,{a:0.003,d:0.3,s:0.25,r:Math.min(D,1.2),peak:0.1,hold:t+0.25});
    for(const c of[-10,0,10])osc(ctx,WAVES[ch]==='square'?'sawtooth':WAVES[ch],mtof(m),t,e,c).connect(g);g.connect(lp);ev.push({t,dur:0.6,midi:m,layer:1});});
  const r=ch==='Metallic'?1.41:3.5;[0,4,7].forEach(dg=>{const m=degMidi(k,dg,5);V.bell(ctx,dest,t,1,m,0.55,{ratio:r,decay:Math.min(D,2.6),index:ch==='Metallic'?4:2});ev.push({t,dur:1.2,midi:m,layer:2});});
  const n=noiseSrc(ctx,t,t+0.03),hp=ctx.createBiquadFilter();hp.type='highpass';hp.frequency.value=2500;const ng=ctx.createGain();perc(ng.gain,t,0.001,0.025,0.35*I);n.connect(hp);hp.connect(ng);ng.connect(dest);
}
function glueMelHit(ctx,dest,P,rng,t,ev,grace=true){
  const k=P.key,ch=P.character||'Cinematic';const seq=rng.pick([[0,2,4,7],[4,7,9,11],[0,4,7,9,11],[2,4,7],[0,4,7,11,14]]);let tt=t;const gap=rng.range(0.028,0.05);
  if(grace)seq.forEach((dg,i)=>{const m=degMidi(k,dg,4);V.pluck(ctx,dest,tt,0.1,m,0.5+i*0.1,{bright:7,decay:0.6});ev.push({t:tt,dur:0.15,midi:m,layer:2});tt+=gap;});
  const fin=[0,4,7,9].map(dg=>degMidi(k,dg,4));fin.forEach((m,i)=>{const s=tt+i*0.012;
    if(ch==='Metallic')V.bell(ctx,dest,s,1,m+12,0.6,{ratio:1.41,decay:3,index:3});else{V.bell(ctx,dest,s,1,m+12,0.5,{ratio:2,decay:3,index:1.6});V.glass(ctx,dest,s,1,m,0.6,{decay:3.5});}
    ev.push({t:s,dur:2.5,midi:m,layer:1});});
  const b=degMidi(k,0,2);V.bass(ctx,dest,tt,0.6,b,0.8);ev.push({t:tt,dur:0.8,midi:b,layer:0});return tt;
}
function glueDownlifter(ctx,dest,P,rng,t0,D,ev){
  const k=P.key,I=P.intensity??0.7,ch=P.character||'Cinematic',end=t0+D;
  const g=ctx.createGain();g.gain.setValueAtTime(1,t0);g.gain.exponentialRampToValueAtTime(0.001,end);g.gain.linearRampToValueAtTime(0,end+0.02);g.connect(dest);
  const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.setValueAtTime(2000+I*9000,t0);lp.frequency.exponentialRampToValueAtTime(180,end);lp.connect(g);
  [0,4,7].forEach((dg,i)=>{const m=degMidi(k,dg,4);for(const c of[-8,8]){const o=ctx.createOscillator();o.type=WAVES[ch];o.detune.value=c;o.frequency.setValueAtTime(mtof(m),t0);o.frequency.exponentialRampToValueAtTime(mtof(m-12),end);
    const vg=ctx.createGain();vg.gain.value=0.06;o.connect(vg);vg.connect(lp);o.start(t0);o.stop(end+0.05);}ev.push({t:t0,dur:D,midi:m,midi2:m-12,layer:1});});
  const sm=degMidi(k,0,2),so=ctx.createOscillator();so.frequency.setValueAtTime(mtof(sm),t0);so.frequency.exponentialRampToValueAtTime(mtof(sm-12),end);const sg=ctx.createGain();sg.gain.value=0.35;so.connect(sg);sg.connect(g);so.start(t0);so.stop(end+0.05);
  ev.push({t:t0,dur:D,midi:sm,midi2:sm-12,layer:0});
  const n=noiseSrc(ctx,t0,end),bp=ctx.createBiquadFilter();bp.type='bandpass';bp.Q.value=5;bp.frequency.setValueAtTime(mtof(degMidi(k,0,7)),t0);bp.frequency.exponentialRampToValueAtTime(mtof(degMidi(k,0,4)),end);const ng=ctx.createGain();ng.gain.value=0.1*I;n.connect(bp);bp.connect(ng);ng.connect(g);
}

/* Shared by later apps (07, 10, 13, 15) */
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

function genTension(ctx,out,P,rng,T){
  const L=T.loopSec,k=P.key,ev=[],I=P.intensity??0.55,fade=Math.min(2.8,L/5);
  const kinds={sus2:[0,1,4],sus4:[0,3,4],'7th':[0,2,4,6],'9th':[0,2,4,8]};
  const seq=P.interval==='Mixed'?['sus4','sus2','7th','sus4']:null;
  const nSeg=P.resolve==='Hold'?Math.max(1,P.interval==='Mixed'?4:2):4;
  const seg=L/nSeg,bus=fxBus(ctx,out,{reverb:P.reverb??0.48,size:5.5,bright:0.35+P.bright*0.4});
  const snap=f=>Math.max(1/L,Math.round(f*L)/L);
  const mf=ctx.createBiquadFilter();mf.type='lowpass';mf.Q.value=0.8+P.motion*2;mf.frequency.value=280+P.bright*3400;mf.connect(bus);
  const cyc=Math.max(1,Math.round(L/(16-10*P.motion))),lfo=osc(ctx,'sine',cyc/L,0,T.total||L+fade),lg=ctx.createGain();lg.gain.value=(280+P.bright*3400)*0.55*P.motion;lfo.connect(lg);lg.connect(mf.frequency);
  const voice=(t0,t1,midi,gain,layer)=>{
    const g=ctx.createGain(),fd=Math.min(fade, (t1-t0)*0.4);
    g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(gain,t0+fd);g.gain.setValueAtTime(gain,t1);g.gain.linearRampToValueAtTime(0,t1+fd);
    osc(ctx,'sine',snap(mtof(midi)),t0,t1+fd).connect(g);osc(ctx,'triangle',snap(mtof(midi)),t0,t1+fd,5).connect(g);g.connect(mf);
    ev.push({t:t0,dur:t1-t0,midi,layer});
  };
  const root=degMidi(k,0,2);voice(0,L,root,0.16+I*0.08,0);voice(0,L,root-12,0.22+I*0.1,0);
  const labels=[];
  for(let s=0;s<nSeg;s++){
    const t0=s*seg,t1=t0+seg;let resolved=false;
    if(P.resolve==='Cadence'&&s>=nSeg-1)resolved=true;
    if(P.resolve==='Half'&&s===Math.floor(nSeg/2))resolved=true;
    const name=resolved?'triad':(seq?seq[s%seq.length]:P.interval);
    const degs=resolved?[0,2,4]:(kinds[name]||kinds.sus4);
    labels.push(name);
    degs.forEach((d,i)=>{const oct=d>=7?4:3,m=degMidi(k,d,oct);voice(t0,t1,m,(0.055+I*0.05)*(i?0.85:1),resolved?2:1);});
  }
  return {events:ev,segs:nSeg,label:labels.join(' → ')};
}

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
