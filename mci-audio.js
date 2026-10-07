/* Local-only MCI sound layer. It reads the existing rendered game snapshot; no network or Firebase writes. */
(function(root){'use strict';
const DIR='assets-sound/', FILES={ambient:'scene_ambience.mp3',siren:'siren.mp3',engine:'vehicle_engine.mp3',radio:'radio_chirp.mp3',step:'footstep.mp3',gear:'treatment_gear.mp3',patients:'patient_bed.mp3',monitor:'monitor.mp3'};
const KEY='mci-sound-v1', defaults={enabled:false,master:.7,scene:.65,effects:.75,intense:true};
let settings={...defaults};try{settings={...settings,...JSON.parse(localStorage.getItem(KEY)||'{}')};}catch(_){}
let unlocked=false, last=null, lastStep=0,lastRadio=0,seenMessages=new Set(),loops={},panel=null,latest=null,motionAt=null,stepIndex=0,stepPool=[];
const clamp=n=>Math.max(0,Math.min(1,Number(n)||0));
function save(){try{localStorage.setItem(KEY,JSON.stringify(settings));}catch(_){}}
function sound(file){const a=new Audio(DIR+file);a.preload='auto';return a;}
function loop(name,file){const a=sound(file);a.loop=true;a.volume=0;loops[name]=a;return a;}
function gain(name,value){const a=loops[name];if(!a)return;a.volume=clamp(value);if(unlocked&&settings.enabled&&a.volume>.001&&a.paused)a.play().catch(()=>{});if((!settings.enabled||a.volume<=.001)&&!a.paused)a.pause();}
function one(file,volume){if(!unlocked||!settings.enabled||document.hidden)return;const a=sound(file);a.volume=clamp(volume*settings.master);a.play().catch(()=>{});a.addEventListener('ended',()=>{a.src='';},{once:true});}
function init(){if(panel)return;loop('ambient',FILES.ambient);loop('siren',FILES.siren);loop('engine',FILES.engine);loop('patients',FILES.patients);loop('monitor',FILES.monitor);stepPool=[sound(FILES.step),sound(FILES.step)];
 panel=document.createElement('aside');panel.id='mciAudioDock';panel.setAttribute('aria-label','Game audio settings');
 panel.innerHTML='<button type="button" id="mciAudioToggle" aria-expanded="false">🔇 <span>เปิดเสียง</span></button><div id="mciAudioSettings" hidden><label>เสียงรวม <input data-sound="master" type="range" min="0" max="100"></label><label>บรรยากาศ <input data-sound="scene" type="range" min="0" max="100"></label><label>ไซเรน / เอฟเฟกต์ <input data-sound="effects" type="range" min="0" max="100"></label><label><input data-sound="intense" type="checkbox"> โหมดกดดัน / Intense</label><small>เสียงเล่นในเครื่องนี้เท่านั้น</small></div>';
 document.body.appendChild(panel);const btn=panel.querySelector('#mciAudioToggle'),box=panel.querySelector('#mciAudioSettings');
 btn.addEventListener('click',()=>{settings.enabled=!settings.enabled;unlocked=true;save();btn.setAttribute('aria-expanded',settings.enabled?'true':'false');box.hidden=!settings.enabled;refreshLabel();update(latest);});
 panel.querySelectorAll('input[data-sound]').forEach(input=>{const k=input.dataset.sound;if(input.type==='checkbox')input.checked=!!settings[k];else input.value=Math.round(clamp(settings[k])*100);input.addEventListener('input',()=>{settings[k]=input.type==='checkbox'?input.checked:Number(input.value)/100;save();update(latest);});});
 // Browsers unlock audio only after a user gesture. A saved preference resumes on the next gesture.
 document.addEventListener('pointerdown',()=>{if(settings.enabled&&!unlocked){unlocked=true;update(latest);}}, {capture:true});
 document.addEventListener('visibilitychange',()=>update(latest));refreshLabel();}
function refreshLabel(){if(!panel)return;panel.querySelector('#mciAudioToggle').innerHTML=(settings.enabled?'🔊 <span>เสียงเปิด':'🔇 <span>เปิดเสียง')+'</span>';}
function motion(p){
 if(!p||!Number.isFinite(Number(p.x))||!Number.isFinite(Number(p.y)))return;
 const now=Date.now(),pos={scene:p.scene,x:Number(p.x),y:Number(p.y)};
 if(motionAt&&motionAt.scene===pos.scene){
  const dx=pos.x-motionAt.x,dy=pos.y-motionAt.y,d2=dx*dx+dy*dy;
  if(d2>.000025&&d2<2500&&now-lastStep>300&&latest&&latest.status==='RUNNING'&&!latest.paused&&unlocked&&settings.enabled&&!document.hidden){
   const a=stepPool[stepIndex++%stepPool.length];a.volume=clamp(settings.master*settings.effects*.47);
   try{a.currentTime=0;a.play().catch(()=>{});}catch(_){}lastStep=now;
  }
 }
 motionAt=pos;
}
function update(s){latest=s;if(!panel)init();const active=!!(s&&s.status==='RUNNING'&&!s.paused&&!document.hidden&&settings.enabled&&unlocked);
 const field=!!(s&&s.station!=='HOSPITAL'),pressure=settings.intense?1:.62,master=settings.master;
 gain('ambient',active?master*settings.scene*(field?.65:.27)*pressure:0);
 const coming=active&&s.vehicles&&s.vehicles.some(v=>v.state==='TO_PARKING'||v.state==='TO_LOADING');
 gain('siren',active?master*settings.effects*(field?(coming?.42:.31):.10)*pressure:0);
 gain('engine',coming?master*settings.effects*(field?.19:.08)*pressure:0);
 const nearby=(s&&s.patients||[]).filter(p=>!p.dead&&p.nearby);
 gain('patients',active&&nearby.some(p=>p.conscious)?master*settings.scene*(settings.intense?.55:.36):0);
 const treatment=!!(s&&['TX_RED','TX_YELLOW','TX_GREEN'].includes(s.station));
 gain('monitor',active&&treatment&&nearby.length?master*settings.effects*.25:0);
 if(!active){last=null;motionAt=null;return;}
 const now=Date.now();
 if(s.messages){for(const m of s.messages){if(!m||!m.id)continue;if(!seenMessages.has(m.id)&&last&&m.at>last.when&&m.incoming&&now-lastRadio>900){one(FILES.radio,settings.effects*(m.urgent?.48:.24));lastRadio=now;}seenMessages.add(m.id);}if(seenMessages.size>500)seenMessages=new Set(s.messages.map(m=>m.id));}
 last={when:now};
}
function cue(kind){if(kind==='treatment')one(FILES.gear,settings.effects*.28);}
root.MCIAudio={update,cue,motion};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);
