'use strict';
/* ===== Tonal SFX Suite · shared engine (inlined into every app) ===== */
/* ---------- seeded PRNG ---------- */
function xmur3(str){let h=1779033703^str.length;for(let i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),3432918353);h=h<<13|h>>>19;}
  return function(){h=Math.imul(h^(h>>>16),2246822507);h=Math.imul(h^(h>>>13),3266489909);return (h^=h>>>16)>>>0;};}
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function makeRng(seed){
  const r=mulberry32(xmur3(String(seed))());
  return {next:r,range:(a,b)=>a+r()*(b-a),int:(a,b)=>a+Math.floor(r()*(b-a+1)),
    pick:a=>a[Math.floor(r()*a.length)],chance:p=>r()<p,
    weighted(pairs){let s=0;for(const p of pairs)s+=p[1];let x=r()*s;for(const p of pairs){if((x-=p[1])<=0)return p[0];}return pairs[pairs.length-1][0];},
    fork:tag=>makeRng(seed+'/'+tag)};
}
function todaySeed(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
const SEED_A=['amber','basalt','cinder','dusk','ember','fjord','gilt','harbor','indigo','juniper','kiln','lumen','marrow','nocturne','ochre','pewter','quarry','rust','sable','tide','umber','vesper','willow','zinc'];
const SEED_B=['arc','bell','choir','drift','echo','field','glow','hush','iris','lake','moth','north','orbit','pulse','reel','swell','tape','veil','wake','yard'];
function randomSeedWord(){const p=a=>a[Math.floor(Math.random()*a.length)];return p(SEED_A)+'-'+p(SEED_B)+'-'+String(Math.floor(Math.random()*100)).padStart(2,'0');}

/* ---------- music theory ---------- */
const NOTE_NAMES=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const SCALES={major:[0,2,4,5,7,9,11],minor:[0,2,3,5,7,8,10]};
const ROMAN={major:['I','ii','iii','IV','V','vi','vii°'],minor:['i','ii°','III','iv','v','VI','VII']};
const PROGS={major:[[0,4,5,3],[0,5,3,4],[5,3,0,4],[0,3,5,4],[0,2,3,4],[3,4,0,5],[0,3,0,4],[0,5,1,4]],
             minor:[[0,5,2,6],[0,3,4,0],[0,6,5,6],[0,2,6,3],[5,6,0,0],[0,3,5,4],[0,5,3,4],[0,6,3,5]]};
const mtof=m=>440*Math.pow(2,(m-69)/12);
const keyName=k=>NOTE_NAMES[k.root]+' '+k.mode;
const keyTag=k=>NOTE_NAMES[k.root].replace('#','sharp')+(k.mode==='major'?'maj':'min');
const relativeKey=k=>k.mode==='major'?{root:(k.root+9)%12,mode:'minor'}:{root:(k.root+3)%12,mode:'major'};
const scaleNotes=k=>SCALES[k.mode].map(i=>NOTE_NAMES[(k.root+i)%12]);
function degMidi(k,deg,oct){const o=Math.floor(deg/7),d=deg-o*7;return 12*(oct+1)+k.root+SCALES[k.mode][d]+12*o;}
const midiName=m=>NOTE_NAMES[((m%12)+12)%12]+(Math.floor(m/12)-1);
function chordMidis(k,deg,oct,size=3){const o=[];for(let i=0;i<size;i++)o.push(degMidi(k,deg+2*i,oct));return o;}
function fold(notes,lo,hi){return notes.map(m=>{while(m<lo)m+=12;while(m>hi)m-=12;return m;}).sort((a,b)=>a-b);}
function inKey(k,m){return SCALES[k.mode].includes(((m-k.root)%12+12)%12);}
function euclid(p,n){const o=[];for(let i=0;i<n;i++)o.push(((i*p)%n)<p?1:0);return o;}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

/* ---------- envelopes & voices ---------- */
function perc(p,t,a,dec,peak){p.setValueAtTime(0,t);p.linearRampToValueAtTime(peak,t+a);p.setTargetAtTime(0,t+a,dec/6);return t+a+dec;}
function adsr(p,t,{a=0.01,d=0.1,s=0.7,r=0.3,peak=1,hold}){
  const h=Math.max(hold,t+a+0.002);p.setValueAtTime(0,t);p.linearRampToValueAtTime(peak,t+a);
  if(t+a+d<h){p.linearRampToValueAtTime(peak*s,t+a+d);p.setValueAtTime(peak*s,h);}else{p.linearRampToValueAtTime(peak+(peak*s-peak)*((h-t-a)/d),h);}
  p.linearRampToValueAtTime(0,h+r);return h+r;}
function osc(ctx,type,f,t,end,det=0){const o=ctx.createOscillator();o.type=type;o.frequency.value=f;if(det)o.detune.value=det;o.start(t);o.stop(end+0.03);return o;}
function pan(ctx,v){const n=ctx.createStereoPanner?ctx.createStereoPanner():ctx.createGain();if(n.pan)n.pan.value=clamp(v,-1,1);return n;}
const _noise={};
function noiseBuf(ctx,sec){const key=ctx.sampleRate+'_'+sec;if(_noise[key])return _noise[key];const n=Math.floor(sec*ctx.sampleRate),b=ctx.createBuffer(2,n,ctx.sampleRate),r=makeRng('noise'+sec);
  for(let c=0;c<2;c++){const d=b.getChannelData(c);for(let i=0;i<n;i++)d[i]=r.next()*2-1;}return(_noise[key]=b);}
function noiseSrc(ctx,t,end){const s=ctx.createBufferSource();s.buffer=noiseBuf(ctx,4);s.loop=true;s.start(t);s.stop(end+0.03);return s;}

const V={
  pluck(ctx,d,t,dur,m,vel=1,o={}){const f=mtof(m),dec=o.decay||Math.max(0.3,dur*2.2),lp=ctx.createBiquadFilter();lp.type='lowpass';lp.Q.value=o.q??3;
    lp.frequency.setValueAtTime(Math.min(16000,f*(o.bright??9)),t);lp.frequency.setTargetAtTime(f*1.4,t+0.002,dec/5);
    const g=ctx.createGain(),end=perc(g.gain,t,0.002,dec,0.2*vel);
    for(const c of[-7,7])osc(ctx,o.wave||'sawtooth',f,t,end,c).connect(lp);osc(ctx,'triangle',f/2,t,end).connect(lp);lp.connect(g);g.connect(d);return end;},
  stab(ctx,d,t,dur,m,vel=1,o={}){const f=mtof(m),lp=ctx.createBiquadFilter();lp.type='lowpass';lp.Q.value=1.2;
    lp.frequency.setValueAtTime(Math.min(15000,f*(o.bright??6)),t);lp.frequency.setTargetAtTime(f*(o.floor??2),t+0.01,o.fdec??0.12);
    const g=ctx.createGain(),end=adsr(g.gain,t,{a:o.a??0.004,d:o.d??0.12,s:o.s??0.5,r:o.r??0.1,peak:0.1*vel,hold:t+dur});
    for(const c of[-9,0,9])osc(ctx,'sawtooth',f,t,end,c).connect(lp);lp.connect(g);g.connect(d);return end;},
  bell(ctx,d,t,dur,m,vel=1,o={}){const f=mtof(m),ratio=o.ratio||3.5,dec=o.decay||2.4,idx=o.index??2.2;
    const car=osc(ctx,'sine',f,t,t+dec+0.01),mod=osc(ctx,'sine',f*ratio,t,t+dec+0.01),mg=ctx.createGain();
    mg.gain.setValueAtTime(f*idx,t);mg.gain.exponentialRampToValueAtTime(f*0.02+0.01,t+dec*0.5);mod.connect(mg);mg.connect(car.frequency);
    const g=ctx.createGain(),end=perc(g.gain,t,0.003,dec,0.22*vel);car.connect(g);g.connect(d);return end;},
  glass(ctx,d,t,dur,m,vel=1,o={}){const f=mtof(m),dec=o.decay||3.2,g=ctx.createGain(),end=perc(g.gain,t,0.012,dec,0.2*vel);
    [[1,1],[2,0.28],[3,0.09]].forEach(([h,a])=>{const gg=ctx.createGain();gg.gain.value=a;osc(ctx,'sine',f*h,t,end).connect(gg);gg.connect(g);});g.connect(d);return end;},
  kalimba(ctx,d,t,dur,m,vel=1){const f=mtof(m),g=ctx.createGain(),end=perc(g.gain,t,0.002,1.2,0.26*vel);osc(ctx,'sine',f,t,end).connect(g);
    const g2=ctx.createGain();perc(g2.gain,t,0.001,0.09,0.12*vel);osc(ctx,'sine',f*3,t,t+0.12).connect(g2);g2.connect(d);g.connect(d);return end;},
  mallet(ctx,d,t,dur,m,vel=1){const f=mtof(m),g=ctx.createGain(),end=perc(g.gain,t,0.002,0.7,0.22*vel);osc(ctx,'triangle',f,t,end).connect(g);
    const g2=ctx.createGain();perc(g2.gain,t,0.001,0.08,0.1*vel);osc(ctx,'sine',f*4,t,t+0.1).connect(g2);g2.connect(d);g.connect(d);return end;},
  lead(ctx,d,t,dur,m,vel=1){const f=mtof(m),lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=Math.min(9000,f*3.2);lp.Q.value=0.8;
    const g=ctx.createGain(),end=adsr(g.gain,t,{a:0.05,d:0.25,s:0.75,r:0.28,peak:0.16*vel,hold:t+dur});
    const vib=osc(ctx,'sine',5.2,t,end),vg=ctx.createGain();vg.gain.setValueAtTime(0,t);vg.gain.linearRampToValueAtTime(11,t+Math.min(0.5,dur));vib.connect(vg);
    const a=osc(ctx,'sawtooth',f,t,end,-4),b=osc(ctx,'triangle',f,t,end,4);vg.connect(a.detune);vg.connect(b.detune);
    const ag=ctx.createGain();ag.gain.value=0.45;a.connect(ag);ag.connect(lp);b.connect(lp);lp.connect(g);g.connect(d);return end;},
  bass(ctx,d,t,dur,m,vel=1){const f=mtof(m),lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=520;
    const g=ctx.createGain(),end=adsr(g.gain,t,{a:0.006,d:0.25,s:0.6,r:0.08,peak:0.38*vel,hold:t+dur});
    osc(ctx,'sine',f,t,end).connect(g);const tg=ctx.createGain();tg.gain.value=0.35;osc(ctx,'triangle',f,t,end).connect(lp);lp.connect(tg);tg.connect(g);g.connect(d);return end;},
  musicbox(ctx,d,t,dur,m,vel=1){return V.bell(ctx,d,t,dur,m+12,vel*0.9,{ratio:4,decay:1.7,index:1.1});},
};

/* ---------- FX ---------- */
const _ir={};
function makeIR(ctx,sec,bright=0.5){const key=ctx.sampleRate+'_'+sec+'_'+bright;if(_ir[key])return _ir[key];
  const sr=ctx.sampleRate,n=Math.floor(sec*sr),b=ctx.createBuffer(2,n,sr),r=makeRng('ir'+sec+bright),k=0.12+bright*0.6;
  for(let c=0;c<2;c++){const d=b.getChannelData(c);let lp=0;for(let i=0;i<n;i++){lp+=(r.next()*2-1-lp)*k;const x=i/n;d[i]=lp*Math.pow(1-x,2)*Math.exp(-x*2.2)*(i<sr*0.012?i/(sr*0.012):1);}}
  return(_ir[key]=b);}
function fxBus(ctx,out,{reverb=0.25,size=3.5,bright=0.5,delay=0,delayTime=0.375,feedback=0.35}={}){
  const inp=ctx.createGain();inp.connect(out);
  if(reverb>0.001){const cv=ctx.createConvolver();cv.buffer=makeIR(ctx,size,bright);const w=ctx.createGain();w.gain.value=reverb*0.9;inp.connect(cv);cv.connect(w);w.connect(out);}
  if(delay>0.001){const dl=ctx.createDelay(5),dr=ctx.createDelay(5);dl.delayTime.value=delayTime;dr.delayTime.value=delayTime;
    const fb=ctx.createGain();fb.gain.value=feedback;const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=3800;
    const w=ctx.createGain();w.gain.value=delay*0.6;const pl=pan(ctx,-0.7),pr=pan(ctx,0.7);
    inp.connect(lp);lp.connect(dl);dl.connect(pl);pl.connect(w);dl.connect(dr);dr.connect(pr);pr.connect(w);dr.connect(fb);fb.connect(lp);w.connect(out);}
  return inp;}
function maskGain(ctx,mask,barSec,total,fade=0.06){const g=ctx.createGain();if(!mask)return g;const n=Math.ceil(total/barSec)+1,M=i=>mask[i%mask.length]?1:0;
  g.gain.setValueAtTime(M(0),0);for(let b=1;b<n;b++){if(M(b-1)!==M(b)){const t=b*barSec;g.gain.setValueAtTime(M(b-1),Math.max(0,t-fade));g.gain.linearRampToValueAtTime(M(b),t);}}return g;}

/* ---------- offline render ---------- */
const SR=48000;
function peakOf(bufs){let p=0;for(const b of bufs)for(let c=0;c<b.numberOfChannels;c++){const d=b.getChannelData(c);for(let i=0;i<d.length;i++){const a=Math.abs(d[i]);if(a>p)p=a;}}return p;}
function scaleBuf(b,s){for(let c=0;c<b.numberOfChannels;c++){const d=b.getChannelData(c);for(let i=0;i<d.length;i++)d[i]*=s;}}
function normalize(b,target=0.89){const p=peakOf([b]);if(p>1e-6)scaleBuf(b,Math.min(30,target/p));return b;}
function newBuf(len,sr=SR){return new OfflineAudioContext(2,1,sr).createBuffer(2,Math.max(1,len),sr);}
async function renderLoop({loopSec,tailSec=4,fold:doFold=true,build,normalizeTo=0.89,gain=0.8}){
  const total=loopSec+tailSec,len=Math.ceil(total*SR),ctx=new OfflineAudioContext(2,len,SR);
  const comp=ctx.createDynamicsCompressor();comp.threshold.value=-12;comp.ratio.value=3;comp.attack.value=0.01;comp.release.value=0.25;comp.knee.value=8;comp.connect(ctx.destination);
  const master=ctx.createGain();master.gain.value=gain;master.connect(comp);
  const meta={markers:[]};const events=build(ctx,master,total,meta)||[];
  const raw=await ctx.startRendering();let buf;
  if(doFold){const L=Math.round(loopSec*SR);buf=newBuf(L);for(let c=0;c<2;c++){const s=raw.getChannelData(c),d=buf.getChannelData(c);d.set(s.subarray(0,L));for(let i=L;i<s.length;i++)d[(i-L)%L]+=s[i];}}
  else{let last=0;for(let c=0;c<2;c++){const s=raw.getChannelData(c);for(let i=s.length-1;i>last;i--){if(Math.abs(s[i])>2e-4){last=i;break;}}}
    const L=Math.min(raw.length,Math.max(Math.round(loopSec*SR),last+Math.round(0.08*SR)));buf=newBuf(L);
    const fo=Math.round(0.03*SR);for(let c=0;c<2;c++){const s=raw.getChannelData(c),d=buf.getChannelData(c);d.set(s.subarray(0,L));for(let i=0;i<fo;i++)d[L-1-i]*=i/fo;}}
  if(normalizeTo)normalize(buf,normalizeTo);
  return {buffer:buf,events,loopSec,folded:doFold,markers:meta.markers,meta};
}
function reverseBuf(b){const o=newBuf(b.length);for(let c=0;c<2;c++){const s=b.getChannelData(c),d=o.getChannelData(c),n=s.length;for(let i=0;i<n;i++)d[i]=s[n-1-i];}return o;}
function concatBufs(a,b){const o=newBuf(a.length+b.length);for(let c=0;c<2;c++){const d=o.getChannelData(c);d.set(a.getChannelData(c));d.set(b.getChannelData(c),a.length);}return o;}
function mixBufs(bufs,gains){const n=Math.max(...bufs.map(b=>b.length)),o=newBuf(n);
  bufs.forEach((b,j)=>{const g=gains?gains[j]:1;if(!g)return;for(let c=0;c<2;c++){const s=b.getChannelData(c),d=o.getChannelData(c);for(let i=0;i<s.length;i++)d[i]+=s[i]*g;}});
  const p=peakOf([o]);if(p>0.98)scaleBuf(o,0.98/p);return o;}

/* ---------- WAV + ZIP ---------- */
function encodeWAV(buf,repeats=1){const nc=buf.numberOfChannels,sr=buf.sampleRate,n=buf.length*repeats,bytes=n*nc*2,ab=new ArrayBuffer(44+bytes),v=new DataView(ab);
  const ws=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i));};
  ws(0,'RIFF');v.setUint32(4,36+bytes,true);ws(8,'WAVE');ws(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,nc,true);
  v.setUint32(24,sr,true);v.setUint32(28,sr*nc*2,true);v.setUint16(32,nc*2,true);v.setUint16(34,16,true);ws(36,'data');v.setUint32(40,bytes,true);
  const pcm=new Int16Array(ab,44),ch=[];for(let c=0;c<nc;c++)ch.push(buf.getChannelData(c));let o=0;
  for(let r=0;r<repeats;r++)for(let i=0;i<buf.length;i++)for(let c=0;c<nc;c++){const s=Math.max(-1,Math.min(1,ch[c][i]));pcm[o++]=s<0?s*32768:s*32767;}
  return new Blob([ab],{type:'audio/wav'});}
const CRC_T=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function crc32(u){let c=0xFFFFFFFF;for(let i=0;i<u.length;i++)c=CRC_T[(c^u[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0;}
async function makeZip(files){const parts=[],cen=[],enc=new TextEncoder(),now=new Date();let off=0;
  const dt=((now.getHours()<<11)|(now.getMinutes()<<5)|(now.getSeconds()>>1)),dd=(((now.getFullYear()-1980)<<9)|((now.getMonth()+1)<<5)|now.getDate());
  for(const f of files){const data=new Uint8Array(await f.blob.arrayBuffer()),nm=enc.encode(f.name),crc=crc32(data);
    const lh=new DataView(new ArrayBuffer(30));lh.setUint32(0,0x04034b50,true);lh.setUint16(4,20,true);lh.setUint16(10,dt,true);lh.setUint16(12,dd,true);
    lh.setUint32(14,crc,true);lh.setUint32(18,data.length,true);lh.setUint32(22,data.length,true);lh.setUint16(26,nm.length,true);parts.push(lh,nm,data);
    const ch=new DataView(new ArrayBuffer(46));ch.setUint32(0,0x02014b50,true);ch.setUint16(4,20,true);ch.setUint16(6,20,true);ch.setUint16(12,dt,true);ch.setUint16(14,dd,true);
    ch.setUint32(16,crc,true);ch.setUint32(20,data.length,true);ch.setUint32(24,data.length,true);ch.setUint16(28,nm.length,true);ch.setUint32(42,off,true);cen.push(ch,nm);
    off+=30+nm.length+data.length;}
  let cs=0;for(const c of cen)cs+=c.byteLength;const e=new DataView(new ArrayBuffer(22));e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);
  e.setUint32(12,cs,true);e.setUint32(16,off,true);return new Blob([...parts,...cen,e],{type:'application/zip'});}
function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},4000);}
