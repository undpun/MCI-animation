/* Local-only MCI sound layer. It reads the existing rendered game snapshot; no network or Firebase writes. */
(function(root){'use strict';
const DIR='assets-sound/', FILES={ambient:'scene_ambience.mp3',siren:'siren.mp3',engine:'vehicle_engine.mp3',radio:'radio_chirp.mp3',step:'footstep.mp3',gear:'treatment_gear.mp3',patients:'patient_bed.mp3',monitor:'monitor.mp3'};
const KEY='mci-sound-v1', defaults={enabled:false,master:.7,scene:.65,effects:.75,intense:true};
let settings={...defaults};try{settings={...settings,...JSON.parse(localStorage.getItem(KEY)||'{}')};}catch(_){}
let unlocked=false, last=null, lastStep=0,lastSirenMotion=0,lastRadio=0,seenMessages=new Set(),loops={},panel=null,latest=null,motionAt=null,stepIndex=0,stepPool=[];
const clamp=n=>Math.max(0,Math.min(1,Number(n)||0));
function save(){try{localStorage.setItem(KEY,JSON.stringify(settings));}catch(_){}}
function sound(file){const a=new Audio(DIR+file);a.preload='none';return a;}
function loop(name,file){const a=sound(file);a.loop=true;a.volume=0;loops[name]=a;return a;}
function gain(name,value){const a=loops[name];if(!a)return;a.volume=clamp(value);if(unlocked&&settings.enabled&&a.volume>.001&&a.paused)a.play().catch(()=>{});if((!settings.enabled||a.volume<=.001)&&!a.paused)a.pause();}
function one(file,volume){if(!unlocked||!settings.enabled||document.hidden)return;const a=sound(file);a.volume=clamp(volume*settings.master);a.play().catch(()=>{});a.addEventListener('ended',()=>{a.src='';},{once:true});}
function init(){if(panel)return;loop('ambient',FILES.ambient);loop('siren',FILES.siren);loop('engine',FILES.engine);loop('patientsA',FILES.patients);loop('patientsB',FILES.patients);loop('monitorA',FILES.monitor);loop('monitorB',FILES.monitor);stepPool=[sound(FILES.step)];stepPool[0].preload='auto';
 panel=document.createElement('aside');panel.id='mciAudioDock';panel.setAttribute('aria-label','Game audio settings');
 panel.innerHTML='<button type="button" id="mciAudioToggle" aria-expanded="false">🔇 <span>เปิดเสียง</span></button><div id="mciAudioSettings" hidden><div class="mci-audio-heading"><span>ตั้งค่าเสียง</span><button type="button" id="mciAudioClose" aria-label="ปิดหน้าต่างตั้งค่าเสียง">✕</button></div><label>เสียงรวม <input data-sound="master" type="range" min="0" max="100"></label><label>บรรยากาศ <input data-sound="scene" type="range" min="0" max="100"></label><label>ไซเรน / เอฟเฟกต์ <input data-sound="effects" type="range" min="0" max="100"></label><label><input data-sound="intense" type="checkbox"> โหมดกดดัน / Intense</label><button type="button" id="mciAudioMute">ปิดเสียงทั้งหมด</button><small>เสียงเล่นในเครื่องนี้เท่านั้น</small></div>';
 document.body.appendChild(panel);const btn=panel.querySelector('#mciAudioToggle'),box=panel.querySelector('#mciAudioSettings');
 const closePanel=()=>{box.hidden=true;btn.setAttribute('aria-expanded','false');};
 btn.addEventListener('click',()=>{if(!settings.enabled){settings.enabled=true;unlocked=true;save();update(latest);}box.hidden=!box.hidden;btn.setAttribute('aria-expanded',box.hidden?'false':'true');refreshLabel();});
 panel.querySelector('#mciAudioClose').addEventListener('click',closePanel);
 panel.querySelector('#mciAudioMute').addEventListener('click',()=>{settings.enabled=false;save();closePanel();refreshLabel();update(latest);});
 panel.querySelectorAll('input[data-sound]').forEach(input=>{const k=input.dataset.sound;if(input.type==='checkbox')input.checked=!!settings[k];else input.value=Math.round(clamp(settings[k])*100);input.addEventListener('input',()=>{settings[k]=input.type==='checkbox'?input.checked:Number(input.value)/100;save();update(latest);});});
 // Browsers unlock audio only after a user gesture. A saved preference resumes on the next gesture.
 document.addEventListener('pointerdown',()=>{if(settings.enabled&&!unlocked){unlocked=true;update(latest);}}, {capture:true});
 document.addEventListener('pointerdown',e=>{if(!box.hidden&&!panel.contains(e.target))closePanel();}, {capture:true});
 document.addEventListener('visibilitychange',()=>update(latest));refreshLabel();}
function refreshLabel(){if(!panel)return;panel.querySelector('#mciAudioToggle').innerHTML=(settings.enabled?'🔊 <span>เสียงเปิด':'🔇 <span>เปิดเสียง')+'</span>';}
function outsideSiren(pos){
 const sources=latest&&latest.sirenSources||[];let proximity=0;
 if(pos&&pos.scene==='field_start'&&sources.length){
  const distance=Math.min(...sources.map(q=>Math.hypot(Number(pos.x)-q.x,Number(pos.y)-q.y)));
  proximity=Math.pow(Math.max(0,1-distance/1000),1.6);
 }
 return .035+.28*proximity;
}
function motion(p){
 if(!p||!Number.isFinite(Number(p.x))||!Number.isFinite(Number(p.y)))return;
 const now=Date.now(),pos={scene:p.scene,x:Number(p.x),y:Number(p.y)};
 if(motionAt&&motionAt.scene===pos.scene){
  const dx=pos.x-motionAt.x,dy=pos.y-motionAt.y,d2=dx*dx+dy*dy;
  if(d2>.000025&&d2<2500&&now-lastStep>520&&latest&&latest.status==='RUNNING'&&!latest.paused&&unlocked&&settings.enabled&&!document.hidden){
   const a=stepPool[stepIndex++%stepPool.length];a.volume=clamp(settings.master*settings.effects*.045);
   try{a.currentTime=0;a.play().catch(()=>{});}catch(_){}lastStep=now;
  }
 }
 if(pos.scene==='field_start'&&now-lastSirenMotion>250&&latest&&latest.status==='RUNNING'&&!latest.paused&&!document.hidden){lastSirenMotion=now;gain('siren',settings.master*settings.effects*outsideSiren(pos)*(settings.intense?1:.62));}
 motionAt=pos;
}
function update(s){latest=s;if(!panel)init();const active=!!(s&&s.status==='RUNNING'&&!s.paused&&!document.hidden&&settings.enabled&&unlocked);
 const station=s&&s.station||'',outside=!!(s&&s.position&&s.position.scene==='field_start'&&!station),treatment=['TX_RED','TX_YELLOW','TX_GREEN'].includes(station),triage=station==='PRIMARY'||station==='SECONDARY',transport=station==='PARKING'||station==='LOADING',pressure=settings.intense?1:.62,master=settings.master;
 gain('ambient',active?master*settings.scene*(transport?.28:triage||treatment?.48:.12)*pressure:0);
 gain('siren',active?master*settings.effects*(transport?.28:triage||treatment?.055:outside?outsideSiren(s.position):0)*pressure:0);
 gain('engine',active&&transport&&s.vehiclesMoving?master*settings.effects*.12*pressure:0);
 const voices=active?Math.max(0,Number(s.voiceCount)||0):0,monitors=active&&treatment?Math.max(0,Number(s.monitorCount)||0):0;
 const voiceLevel=master*settings.scene*(settings.intense?.30:.20)*Math.min(1.55,1+.20*Math.log2(Math.max(1,voices)));
 gain('patientsA',voices?voiceLevel:0);
 gain('patientsB',voices>=2?voiceLevel*.58:0);
 const monitorLevel=master*settings.effects*.43*Math.min(1.5,1+.16*Math.log2(Math.max(1,monitors)));
 gain('monitorA',monitors?monitorLevel:0);
 gain('monitorB',monitors>=2?monitorLevel*.48:0);
 if(!active){last=null;motionAt=null;return;}
 // Offset the second loop only when it first starts, so concurrent voices/beeps do not align.
 if(voices>=2&&!loops.patientsB.datasetOffset){try{loops.patientsB.currentTime=2.1;loops.patientsB.datasetOffset=true;}catch(_){}}if(!voices)loops.patientsB.datasetOffset=false;
 if(monitors>=2&&!loops.monitorB.datasetOffset){try{loops.monitorB.currentTime=.35;loops.monitorB.datasetOffset=true;}catch(_){}}if(!monitors)loops.monitorB.datasetOffset=false;
 const now=Date.now();
 if(s.messages){for(const m of s.messages){if(!m||!m.id)continue;if(!seenMessages.has(m.id)&&last&&m.at>last.when&&m.incoming&&now-lastRadio>900){one(FILES.radio,settings.effects*(m.urgent?.48:.24));lastRadio=now;}seenMessages.add(m.id);}if(seenMessages.size>500)seenMessages=new Set(s.messages.map(m=>m.id));}
 last={when:now};
}
function close(){if(panel){const box=panel.querySelector('#mciAudioSettings');box.hidden=true;panel.querySelector('#mciAudioToggle').setAttribute('aria-expanded','false');}}
function cue(kind){if(kind==='treatment')one(FILES.gear,settings.effects*.28);}
root.MCIAudio={update,cue,motion,close};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);
