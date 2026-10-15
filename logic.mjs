export const median=a=>{const b=[...a].sort((x,y)=>x-y);return b[Math.floor(b.length/2)]};
export function calibrationQuality(samples,floor=.008){if(samples.some(a=>a.length<18))return false;const m=samples.map(median),noise=samples.map((a,i)=>median(a.map(x=>Math.abs(x-m[i]))));return (m[1]-m[0])*(m[2]-m[0])<0&&Math.min(Math.abs(m[1]-m[0]),Math.abs(m[2]-m[0]))>Math.max(floor,2*Math.max(...noise));}
export function fitCalibration(samples){const candidates=[];for(let channel=0;channel<2;channel++){const groups=samples.map(g=>g.map(v=>v[channel]));if(!calibrationQuality(groups,channel===0?.006:.035))continue;const means=groups.map(median);const spread=Math.min(Math.abs(means[1]-means[0]),Math.abs(means[2]-means[0]));const noise=Math.max(...groups.map((g,i)=>median(g.map(v=>Math.abs(v-means[i])))));candidates.push({channel,means,quality:spread/Math.max(noise,.002)})}candidates.sort((a,b)=>b.quality-a.quality);return candidates.length?{...candidates[0],channels:candidates}:null}
export function normalizeGaze(v,m){const delta=v-m[0];const down=m[2]-m[0];return delta*down>=0?delta/down:-(delta/(m[1]-m[0]));}
export function classify(v,m,threshold=.4){const n=normalizeGaze(v,m);return n>=threshold?'down':n<=-threshold?'up':'center'}
export class Dwell{constructor(){this.reset()}reset(){this.armed=false;this.zone='';this.since=0;this.centerSince=null;this.interrupted=null}interrupt(now){if(this.interrupted===null)this.interrupted=now;if(now-this.interrupted>300)this.reset()}update(zone,now,hold){if(this.interrupted!==null){const gap=now-this.interrupted;if(gap>300)this.reset();else {this.since+=gap;if(this.centerSince!==null)this.centerSince+=gap;this.interrupted=null}}if(zone==='center'){if(this.centerSince===null)this.centerSince=now;if(now-this.centerSince>=250)this.armed=true;this.zone='';return {progress:0}}this.centerSince=null;if(!this.armed||!['up','down'].includes(zone)){this.zone='';return {progress:0}}if(this.zone!==zone){this.zone=zone;this.since=now}const p=Math.min(1,(now-this.since)/hold);if(p>=1){this.armed=false;this.zone='';return {progress:0,action:zone}}return {progress:p}}}

// Orient both eye axes left-to-right before combining their vertical signals.
export function irisVertical(landmarks){
  function eye(a,b,i){let A=landmarks[a],B=landmarks[b],I=landmarks[i];if(A.x>B.x)[A,B]=[B,A];const dx=B.x-A.x,dy=B.y-A.y,den=dx*dx+dy*dy;return den>1e-8?((I.y-A.y)*dx-(I.x-A.x)*dy)/den:NaN}
  return (eye(33,133,468)+eye(362,263,473))/2;
}
export function stableDirection(n,previous,threshold=.4){
  if(n>=threshold)return 'down';if(n<=-threshold)return 'up';
  const release=threshold*.6;
  if(previous==='down'&&n>=release)return 'down';
  if(previous==='up'&&n<=-release)return 'up';
  return 'center';
}

// Combine only channels that passed calibration; disagreements reject the frame.
export function fusedGaze(features,fit){
  const channels=fit.channels||[fit];
  const values=channels.map(c=>({n:normalizeGaze(features[c.channel],c.means),w:Math.min(20,c.quality)}));
  if(values.some(v=>!Number.isFinite(v.n)))return null;
  if(values.length>1&&values.some(v=>v.n>.4)&&values.some(v=>v.n<-.4))return null;
  return values.reduce((s,v)=>s+Math.max(-2,Math.min(2,v.n))*v.w,0)/values.reduce((s,v)=>s+v.w,0);
}
export class GazeFilter{
  constructor(){this.reset()}
  reset(){this.history=[];this.value=null;this.last=null}
  update(value,now){
    if(!Number.isFinite(value))return null;
    this.history.push(value);if(this.history.length>5)this.history.shift();
    const target=median(this.history),dt=this.last===null?65:Math.max(1,now-this.last);
    const tau=this.value===null||Math.abs(target-this.value)>.5?90:180;
    const alpha=1-Math.exp(-dt/tau);
    this.value=this.value===null?target:this.value+alpha*(target-this.value);this.last=now;
    return this.value;
  }
}
