// Pure tracking functions; no camera, DOM, or network dependencies.
export const median=a=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.floor(s.length/2)]:NaN};
export const names=['Left iris','Right iris','Both irises','Eye-direction model'];
export function eyeFeatures(l,cats=[],aspect=4/3){
  const eye=(a,b,i)=>{let A=l[a],B=l[b],I=l[i];if(!A||!B||!I)return NaN;if(A.x>B.x)[A,B]=[B,A];const dx=(B.x-A.x)*aspect,dy=B.y-A.y;return ((I.y-A.y)*dx-(I.x-A.x)*aspect*dy)/(dx*dx+dy*dy)};
  const left=eye(33,133,468),right=eye(362,263,473),s=n=>cats.find(c=>c.categoryName===n)?.score||0;
  return [left,right,(left+right)/2,(s('eyeLookDownLeft')+s('eyeLookDownRight')-s('eyeLookUpLeft')-s('eyeLookUpRight'))/2];
}
export function normalize(v,m){const d=v-m[0];return d*(m[2]-m[0])>=0?d/(m[2]-m[0]):-d/(m[1]-m[0])}
export function fitSignals(groups){
  if(groups.length!==3||groups.some(g=>g.length<20))return [];
  return names.map((name,channel)=>{const g=groups.map(a=>a.map(v=>v[channel]));if(g.some(a=>a.some(v=>!Number.isFinite(v))))return null;
    const means=g.map(median),noise=Math.max(...g.map((a,i)=>median(a.map(v=>Math.abs(v-means[i]))))),spread=Math.min(Math.abs(means[1]-means[0]),Math.abs(means[2]-means[0]));
    if((means[1]-means[0])*(means[2]-means[0])>=0||spread<Math.max(channel===3?.035:.004,noise*3))return null;
    return {channel,name,means,quality:spread/Math.max(noise,.001)};
  }).filter(Boolean).sort((a,b)=>b.quality-a.quality);
}
export function validateSignals(candidates,groups){
  if(groups.length!==3||groups.some(g=>g.length<12))return [];
  return candidates.map(c=>{const rates=groups.map((g,i)=>g.filter(f=>{const n=normalize(f[c.channel],c.means);return Number.isFinite(n)&&(i===0?Math.abs(n)<.35:i===1?n<-.45:n>.45)}).length/g.length);return {...c,rates}}).filter(c=>c.rates.every(r=>r>=.75)).sort((a,b)=>Math.min(...b.rates)-Math.min(...a.rates)||b.quality-a.quality);
}
export function direction(n,previous,threshold=.4){if(n>=threshold)return 'down';if(n<=-threshold)return 'up';if(previous==='down'&&n>=threshold*.6)return 'down';if(previous==='up'&&n<=-threshold*.6)return 'up';return 'center'}
export class Filter{constructor(){this.reset()}reset(){this.a=[];this.v=null;this.t=null}update(n,t){if(!Number.isFinite(n))return null;if(this.t!==null&&t-this.t>400)this.reset();this.a.push(n);if(this.a.length>3)this.a.shift();const m=median(this.a),dt=this.t===null?65:t-this.t,alpha=1-Math.exp(-dt/100);this.v=this.v===null?m:this.v+alpha*(m-this.v);this.t=t;return this.v}}
// Pauses do not count toward dwell. Long gaps require center to rearm.
export class Hold{
  constructor(){this.reset()}
  reset(){this.armed=false;this.zone=null;this.elapsed=0;this.center=null;this.last=null;this.lastZone=null;this.gap=null}
  update(zone,t,hold){
    if(this.last!==null&&t-this.last>500)this.reset();
    const dt=this.last===null?0:Math.max(0,t-this.last);this.last=t;
    if(zone==='lost'){this.reset();return {progress:0}}
    if(zone==='blink'){
      if(this.gap===null)this.gap=t;
      if(t-this.gap>350)this.reset();
      this.lastZone='blink';return {progress:this.elapsed/hold};
    }
    if(this.gap!==null){if(t-this.gap>350){this.reset();this.last=t}this.gap=null}
    if(zone==='center'){
      this.zone=null;this.elapsed=0;if(this.center===null)this.center=t;if(t-this.center>=350)this.armed=true;
    }else if(zone==='down'||zone==='up'){
      this.center=null;if(this.armed){if(this.zone!==zone){this.zone=zone;this.elapsed=0}else if(this.lastZone===zone)this.elapsed+=dt;
      if(this.elapsed>=hold){this.armed=false;this.zone=null;this.elapsed=0;this.lastZone=zone;return {progress:0,action:zone}}}
    }
    this.lastZone=zone;return {progress:Math.min(1,this.elapsed/hold)};
  }
}
