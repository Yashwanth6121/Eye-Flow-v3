import {eyeFeatures,fitSignals,validateSignals,normalize,direction,Filter,Hold} from './tracking.mjs?v=4.0';
const $=id=>document.getElementById(id),txt=(id,t)=>$(id).textContent=t,video=$('video'),canvas=$('overlay'),ctx=canvas.getContext('2d'),filter=new Filter(),hold=new Hold();
let model,stream,running=false,starting=false,paused=true,token=0,raf=0,lastVideo=-1,lastFrame=0,interval=65,cal=null,signals=[],selected=null,headRef=null,zone='center',count=0,closedAt=null,closureUsed=false,fpsAt=0,frames=0,paintAt=0,lastFaceAt=0;
const stats={version:'4.0',frames:0,noFaceFrames:0,blinkFrames:0,headRejects:0,scrollActions:0,inferenceMs:[],calibration:null};
function status(state,message){txt('state',state);txt('liveState',state);if(message)txt('message',message)}
function progress(p=0){$('progress').style.width=p*100+'%';$('reelProgress').style.height=p*100+'%';txt('holdReadout',`${(p*Number($('dwell').value)/1000).toFixed(1)} / ${Number($('dwell').value)/1000} seconds`)}
function reset(){hold.reset();filter.reset();zone='center';progress()}
function controls(){ $('start').disabled=starting||running;$('stop').disabled=!starting&&!running;$('calibrate').disabled=!running;$('pause').disabled=!running||!selected||!!cal;$('cameraSelect').disabled=running||starting;txt('pause',paused?'Start scrolling':'Pause scrolling');txt('dockPause',paused?'Start':'Pause');$('liveDock').hidden=!running||!selected||!!cal;document.body.classList.toggle('gazeActive',running&&!paused&&!cal)}
function stop(){token++;cancelAnimationFrame(raf);running=false;starting=false;paused=true;cal=null;signals=[];selected=null;headRef=null;stream?.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;ctx.clearRect(0,0,canvas.width,canvas.height);$('calibration').hidden=true;reset();controls();status('Camera off','Camera stopped. Start again to calibrate.');txt('direction','—');txt('fps','—');txt('cameraLabel','Camera off');txt('signalText','No camera signal');txt('calQuality','—')}
async function cameras(){try{const current=$('cameraSelect').value;const all=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');$('cameraSelect').replaceChildren(new Option('Default / front camera',''));all.forEach((d,i)=>$('cameraSelect').add(new Option(d.label||`Camera ${i+1}`,d.deviceId)));$('cameraSelect').value=current}catch{}}
$('start').onclick=async()=>{
  if(starting||running)return;const id=++token;starting=true;controls();status('Starting','Allow camera access. Loading the face model…');
  try{if(!navigator.mediaDevices?.getUserMedia||!isSecureContext)throw Error('Open the HTTPS demo directly in Safari, Chrome, or Edge. Camera access is unavailable here.');
    const device=$('cameraSelect').value;const acquired=await navigator.mediaDevices.getUserMedia({video:{...(device?{deviceId:{exact:device}}:{facingMode:'user'}),width:{ideal:640},height:{ideal:480},frameRate:{ideal:24,max:30}},audio:false});
    if(id!==token){acquired.getTracks().forEach(t=>t.stop());return}stream=acquired;video.srcObject=stream;await video.play();await cameras();
    if(!model){const {FaceLandmarker,FilesetResolver}=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs');const files=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm');model=await FaceLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'},runningMode:'VIDEO',numFaces:1,outputFaceBlendshapes:true,minFaceDetectionConfidence:.5,minFacePresenceConfidence:.5,minTrackingConfidence:.5})}
    if(id!==token)return;starting=false;running=true;lastVideo=-1;lastFrame=0;fpsAt=0;frames=0;lastFaceAt=performance.now();controls();status('Camera ready','Step 2: choose Calibrate. Six short targets train and then check your gaze.');txt('cameraLabel',`${video.videoWidth} × ${video.videoHeight} · local processing`);raf=requestAnimationFrame(loop);
  }catch(e){if(id!==token)return;stop();status('Camera issue',e.name==='NotAllowedError'?'Camera permission is blocked. Allow it in browser site settings, then try again.':e.name==='NotReadableError'?'Camera is busy. Close other camera apps or tabs, then try again.':e.message)}
};
$('stop').onclick=stop;
$('pause').onclick=()=>{if(!selected)return;paused=!paused;reset();controls();status(paused?'Paused':'Center to arm',paused?'Scrolling paused; camera remains on.':'Look at center for a moment, then hold down. The progress timer shows recognized gaze time.');txt('hint',paused?'Paused · manual controls available':'Center to arm, then look up or down')};$('dockPause').onclick=()=>$('pause').click();
$('dwell').oninput=()=>{txt('dwellValue',($('dwell').value/1000).toFixed(1)+' s');reset()};
$('quick').onclick=()=>{$('dwell').value=2000;$('dwell').oninput();status('2s test selected','Two-second test hold selected. Change Hold time back to 20 seconds for your original interaction.')};
$('sensitivity').oninput=()=>{txt('sensitivityValue',Number($('sensitivity').value)<35?'Easier':Number($('sensitivity').value)>50?'Deliberate':'Balanced');reset()};$('invert').onchange=reset;
$('top').onclick=()=>window.dispatchEvent(new Event('eyeflow-first'));window.addEventListener('eyeflow-manual',reset);
function head(l){return [l[1].x,l[1].y,Math.hypot(l[33].x-l[263].x,l[33].y-l[263].y),l[1].z]}
function moved(h){return headRef&&h.some((v,i)=>Math.abs(v-headRef[i])>[.10,.10,.07,.08][i])}
function showTarget(){const i=cal.step%3;txt('calTitle',`${cal.step<3?'Learn':'Check'} ${i===0?'center':i===1?'top':'bottom'} gaze`);txt('calText',`Target ${cal.step+1} / 6 · Follow the dot with your eyes. Keep your head still.`);$('target').style.top=[50,12,88][i]+'%';cal.started=performance.now();}
$('calibrate').onclick=()=>{if(!running)return;paused=true;signals=[];selected=null;headRef=null;closedAt=null;cal={step:0,started:0,train:[[],[],[]],check:[[],[],[]],candidates:[]};$('calibration').hidden=false;reset();controls();showTarget()};
function endCalibration(message){cal=null;$('calibration').hidden=true;controls();status(selected?'Verified':'Retry calibration',message)}
$('cancel').onclick=()=>{selected=null;signals=[];endCalibration('Calibration cancelled. Choose Calibrate to start again.')};
function collect(features,h,now){
  if(now-cal.started<1000)return;
  if(!headRef)headRef=h;
  if(moved(h)){txt('calText','Head moved. Return to your starting position or cancel and retry.');return}
  const group=(cal.step<3?cal.train:cal.check)[cal.step%3],needed=cal.step<3?24:16;group.push(features);
  txt('calText',`Target ${cal.step+1} / 6 · ${Math.min(100,Math.round(group.length/needed*100))}% · Keep looking at the dot`);
  if(group.length<needed)return;
  cal.step++;
  if(cal.step===3){cal.candidates=fitSignals(cal.train);if(!cal.candidates.length){endCalibration('Gaze positions overlap. Move closer, remove glare, and retry with your head steady.');return}}
  if(cal.step===6){signals=validateSignals(cal.candidates,cal.check);selected=signals[0]||null;stats.calibration={usableSignals:signals.map(s=>s.name),validationRates:selected?.rates||null};txt('calQuality',selected?'Passed':'Retry');
    if(selected){reset();endCalibration(`Gaze check passed using ${selected.name.toLowerCase()}. Step 3: choose Start scrolling. You can use the 2s test hold first.`)}else endCalibration('New check samples did not match calibration. Try again in better light; this setup may not support reliable gaze detection.');return}
  showTarget();
}
function loop(now){if(!running)return;raf=requestAnimationFrame(loop);
  if(cal&&now-cal.started>20000){selected=null;endCalibration('Target timed out. Check lighting and face position, then retry.');return}
  if(now-lastFrame<interval||video.readyState<2||video.currentTime===lastVideo)return;
  lastFrame=now;lastVideo=video.currentTime;
  try{const began=performance.now(),result=model.detectForVideo(video,now),ms=performance.now()-began;interval=Math.min(200,Math.max(65,ms*1.5));stats.frames++;stats.inferenceMs.push(ms);if(stats.inferenceMs.length>300)stats.inferenceMs.shift();
    frames++;if(!fpsAt)fpsAt=now;if(now-fpsAt>=1000){txt('fps',(frames*1000/(now-fpsAt)).toFixed(1));txt('latency',Math.round(ms));fpsAt=now;frames=0}
    const l=result.faceLandmarks?.[0],cats=result.faceBlendshapes?.[0]?.categories||[];
    if(canvas.width!==video.videoWidth||canvas.height!==video.videoHeight){canvas.width=video.videoWidth;canvas.height=video.videoHeight}
    if(now-paintAt>100){ctx.clearRect(0,0,canvas.width,canvas.height);if(l)for(const i of [33,133,362,263,468,473]){ctx.beginPath();ctx.arc(l[i].x*canvas.width,l[i].y*canvas.height,3,0,7);ctx.fillStyle='#c4f48b';ctx.fill()}paintAt=now}
    if(!l){stats.noFaceFrames++;reset();txt('direction','No face');txt('liveDirection','No face');txt('signalText','No face found. Face the camera; add light in front of you.');if(cal)txt('calText','Face not detected. Look toward the camera and improve lighting.');if(now-lastFaceAt>2000&&!cal)status('Find face','No face detected. Check lighting, distance, and camera selection.');return}lastFaceAt=now;
    const score=n=>cats.find(c=>c.categoryName===n)?.score||0,blink=score('eyeBlinkLeft')>.75||score('eyeBlinkRight')>.75,both=score('eyeBlinkLeft')>.7&&score('eyeBlinkRight')>.7;
    if(both&&!cal&&selected&&$('eyePause').checked){if(closedAt===null)closedAt=now;if(now-closedAt>=1400&&!closureUsed){closureUsed=true;$('pause').click()}}else{closedAt=null;closureUsed=false}
    if(blink){stats.blinkFrames++;progress(hold.update('blink',now,Number($('dwell').value)).progress);filter.reset();txt('direction','Blink');txt('liveDirection','Blink');return}
    const features=eyeFeatures(l,cats,video.videoWidth/video.videoHeight),h=head(l);
    if(cal){collect(features,h,now);return}
    if(!selected){txt('signalText','Face found. Select Calibrate to learn and check your gaze.');return}
    if(moved(h)){stats.headRejects++;reset();txt('direction','Head moved');txt('liveDirection','Recenter');txt('signalText','Head position changed. Return to your starting pose or recalibrate.');return}
    const raw=normalize(features[selected.channel],selected.means);if(!Number.isFinite(raw)){reset();return}
    const n=filter.update(raw,now);zone=direction(n,zone,Number($('sensitivity').value)/100);txt('direction',zone);txt('liveDirection',zone.toUpperCase());$('signalDot').style.left=(50+Math.max(-1.3,Math.min(1.3,n))*35)+'%';txt('signalText',`${selected.name} · ${n.toFixed(2)} · ${paused?'scrolling paused':'tracking'}`);
    if(paused)return;const r=hold.update(zone,now,Number($('dwell').value));progress(r.progress);txt('state',hold.armed?'Armed':'Center to arm');txt('liveState',hold.armed?zone==='center'?'Ready · look down/up':`${(r.progress*$('dwell').value/1000).toFixed(1)} / ${$('dwell').value/1000}s`:'Look at center to arm');
    if(r.action){let step=r.action==='down'?1:-1;if($('invert').checked)step*=-1;const e=new CustomEvent('eyeflow-navigate',{detail:{step,moved:false}});window.dispatchEvent(e);if(e.detail.moved){count++;stats.scrollActions++;txt('count',count);txt('hint','Scrolled · look at center to rearm')}else txt('hint','End of feed · look at center, then the opposite direction')}
  }catch(e){stop();status('Tracking error','Processing stopped: '+e.message)}
}
$('diagnostics').onclick=()=>{const times=stats.inferenceMs;const data={...stats,inferenceMs:undefined,meanInferenceMs:times.length?times.reduce((a,b)=>a+b,0)/times.length:null,holdMs:Number($('dwell').value),videoSize:video.videoWidth?`${video.videoWidth}x${video.videoHeight}`:null,notes:'Session counters only. No camera images, audio, identity, or raw landmarks included. Validation rates are calibration checks, not general gaze accuracy.'};const u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download='EyeFlow-session-diagnostics.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(starting){stop();return}if(running){paused=true;cal=null;$('calibration').hidden=true;reset();controls();status('Paused','Page hidden. Start scrolling when ready, or recalibrate if you moved.')}}});
window.addEventListener('pagehide',stop);let width=innerWidth;window.addEventListener('resize',()=>{if(Math.abs(innerWidth-width)<40)return;width=innerWidth;if(running){paused=true;selected=null;cal=null;$('calibration').hidden=true;reset();controls();status('Recalibrate','Screen dimensions changed. Calibrate again.')}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(cal)$('cancel').click();else if(running&&!paused)$('pause').click()}});if(navigator.mediaDevices)cameras();
